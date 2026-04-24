# 5. PostgreSQL Deep Dive

### Why This Section Matters

Knowing SQL syntax is table stakes. PostgreSQL-specific knowledge — MVCC, VACUUM, index types, JSONB, connection pooling — is what separates someone who uses a database from someone who understands it.

These topics surface in two interview contexts: system design ("how would you scale this?") and debugging ("why is this query slow?"). Both require understanding what PostgreSQL is doing under the hood, not just what queries to write.

**What interviewers actually probe:**
- What is MVCC and why does PostgreSQL need VACUUM?
- You have a GIN index and a B-tree index — when do you use each?
- Your API has 1,000 concurrent users. What happens to PostgreSQL without connection pooling?
- When would you use JSONB over a normalized table?

---

## 5.1 MVCC — How PostgreSQL Handles Concurrent Reads and Writes

Most databases use locks to handle concurrency: a write blocks all reads until it's done. PostgreSQL uses **MVCC (Multi-Version Concurrency Control)** instead: it keeps multiple versions of each row, so reads never block writes and writes never block reads.

**How it works:**

Every row in PostgreSQL has two hidden system columns:
- `xmin` — the transaction ID that created this row version
- `xmax` — the transaction ID that deleted (or updated) this row version (0 if still live)

When a row is updated, PostgreSQL doesn't modify it in place. It marks the old row as deleted (`xmax = current_txn`) and inserts a new row version (`xmin = current_txn`). Both versions exist simultaneously on disk.

Each transaction has a **snapshot** — a list of which transaction IDs were committed when the transaction started. A transaction only sees row versions where `xmin` is in its snapshot and `xmax` is not.

```
Time →
Txn 100: INSERT row A (xmin=100, xmax=0)    ← row A v1 created
Txn 101: UPDATE row A (xmin=101, xmax=0)    ← row A v2 created
         row A v1 gets xmax=101             ← row A v1 marked deleted

Txn 102 (started before 101 committed):
  → sees row A v1  (xmin=100 ✅, xmax=101 not yet committed ✅)
  → does NOT see row A v2

Txn 103 (started after 101 committed):
  → sees row A v2  (xmin=101 ✅, xmax=0 ✅)
  → does NOT see row A v1 (xmax=101 committed ❌)
```

**The consequence: dead tuples.** Every UPDATE and DELETE leaves behind the old row version. These "dead tuples" still occupy disk space. MVCC needs a cleanup mechanism.

---

## 5.2 VACUUM — Why PostgreSQL Needs It

VACUUM reclaims space from dead tuples. Without it, tables grow indefinitely even if rows are constantly updated.

**Autovacuum** runs automatically in the background. For most tables, you never need to run VACUUM manually. But you need to know when it matters:

```sql
-- Check dead tuple accumulation and last vacuum time
SELECT
    relname AS table,
    n_live_tup,
    n_dead_tup,
    ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

**When autovacuum might not keep up:**
- High-write tables (millions of updates/hour) — autovacuum triggers are threshold-based and may lag
- Bloated indexes — VACUUM reclaims tuple space but index bloat requires `VACUUM FULL` or `REINDEX CONCURRENTLY`
- Long-running transactions — MVCC can't reclaim dead tuples that any open transaction might still need

**VACUUM vs VACUUM FULL:**
- `VACUUM` — marks dead space as reusable, doesn't shrink the file on disk. Non-blocking.
- `VACUUM FULL` — physically compacts the table, returns disk space to OS. Rewrites the entire table — **takes an exclusive lock**, blocks all reads and writes. Use rarely and during maintenance windows.

**`ANALYZE`** updates the query planner's statistics about data distribution. Run after bulk loads or when `EXPLAIN ANALYZE` shows wildly wrong row estimates.

---

## 5.3 Index Types — B-tree, GIN, BRIN, Hash

PostgreSQL has several index types. Choosing the wrong one means your index either doesn't get used or is larger than necessary.

**B-tree (default)** — sorted tree structure. Supports: `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `IN`, `LIKE 'prefix%'` (not leading wildcards), `ORDER BY`, `DISTINCT`.

Use for almost everything: primary keys, foreign keys, columns in WHERE clauses, columns in ORDER BY.

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_created ON orders (created_at DESC);  -- directional
```

**GIN (Generalized Inverted Index)** — maps each element of a composite value (array element, JSONB key, text lexeme) to the rows containing it. Supports: array containment (`@>`), JSONB key existence, full-text search (`@@`).

```sql
-- Index JSONB for fast key lookup
CREATE INDEX idx_products_metadata ON products USING gin(metadata);

-- Query uses the GIN index
SELECT * FROM products WHERE metadata @> '{"category": "electronics"}';
SELECT * FROM products WHERE metadata ? 'discount_code';

-- Full-text search
CREATE INDEX idx_docs_content ON documents USING gin(to_tsvector('english', content));
SELECT * FROM documents WHERE to_tsvector('english', content) @@ to_tsquery('python & async');
```

GIN indexes are larger and slower to build than B-tree but enable queries that B-tree can't serve.

**BRIN (Block Range Index)** — stores min/max values for ranges of physical blocks. Tiny index, but only useful when data is physically ordered on disk (e.g. time-series data inserted in order).

```sql
-- For a logs table where rows are naturally inserted in time order
CREATE INDEX idx_logs_created_brin ON logs USING brin(created_at);
-- Very small index; works well for "WHERE created_at BETWEEN ..." on append-only tables
```

**Hash** — exact equality only. Slightly faster than B-tree for pure equality lookups, but not crash-safe before PostgreSQL 10, and rarely outperforms B-tree enough to matter. Use B-tree instead.

**Summary:**

| Use case | Index type |
|----------|-----------|
| Most WHERE, JOIN, ORDER BY columns | B-tree |
| JSONB key/value queries | GIN |
| Array containment (`&&`, `@>`) | GIN |
| Full-text search | GIN |
| Vector similarity (pgvector) | HNSW or IVFFlat (see §8) |
| Time-series append-only logs | BRIN |

---

## 5.4 JSONB vs Normalized Tables

PostgreSQL's `JSONB` stores arbitrary JSON as a binary structure, with support for indexing and operators. It's not "NoSQL in a relational database" — it's a tool for genuinely variable-shape data.

**When to use JSONB:**
- Attributes that vary per-row with no fixed schema (product metadata, user preferences, webhook payloads)
- Storing external API responses that you occasionally query
- Prototype stages where the schema isn't settled yet

**When NOT to use JSONB:**
- Data you filter or join on regularly — pull it into a typed column
- Data with relationships to other tables — foreign keys can't point into JSONB
- High-cardinality filtering — a GIN index on JSONB is slower than a B-tree on a dedicated column

```sql
-- JSONB column
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    metadata JSONB                     -- variable attributes
);

INSERT INTO products VALUES (
    gen_random_uuid(), 'Widget', 9.99,
    '{"color": "red", "weight_kg": 0.5, "tags": ["sale", "new"]}'
);

-- Query JSONB fields
SELECT name, metadata->>'color' AS color
FROM products
WHERE metadata @> '{"tags": ["sale"]}';   -- uses GIN index

-- Extract nested value
SELECT metadata->'dimensions'->>'width' FROM products WHERE id = '...';
```

**Nativ connection:** Nativ stores per-user vocabulary session metadata (quiz results, confidence scores, spaced repetition state) as JSONB — the shape varies by language and exercise type, and we never join on it.

---

## 5.5 Connection Pooling — Why You Need PgBouncer

PostgreSQL creates a separate OS process for each connection. Creating a connection takes ~50-100ms. If your app opens a new connection per request, you're paying that cost on every request.

Worse: PostgreSQL has a hard limit on connections (default: 100). With 10 application instances each holding 10 connections, you've used them all. The next connection attempt fails.

**PgBouncer** sits between your app and PostgreSQL, maintaining a pool of ready connections:

```
App instances (100 connections) → PgBouncer → PostgreSQL (10 connections)
```

PgBouncer modes:
- **Transaction pooling** (most common): a server connection is held only for the duration of a transaction, then returned to the pool. Different requests can reuse the same server connection. ⚠️ Session-level features (prepared statements, `SET` variables, advisory locks) don't work across pooled transactions.
- **Session pooling**: one server connection per client session. Less efficient but compatible with all PostgreSQL features.
- **Statement pooling**: one server connection per statement. Most restrictive.

**Serverless context:** Serverless functions (AWS Lambda, Vercel Edge) can spawn thousands of instances, each wanting a DB connection. Without pooling, you hit PostgreSQL's limit immediately. PgBouncer or managed poolers (Supabase's built-in pooler, RDS Proxy) are essential.

```python
# SQLAlchemy connection pool settings — tune to your workload
engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,           # persistent connections in pool
    max_overflow=20,        # extra connections allowed under burst load
    pool_timeout=30,        # wait this long for a connection before error
    pool_recycle=1800,      # recycle connections after 30min (prevents stale)
)
```

---

## 5.6 Table Partitioning

Partitioning splits a large table into smaller physical pieces while presenting a single logical table to queries. The query planner can skip entire partitions that don't match the WHERE clause — "partition pruning."

**Range partitioning by date** — the most common pattern:

```sql
CREATE TABLE events (
    id BIGSERIAL,
    user_id UUID,
    event_type TEXT,
    created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_q1 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE events_2026_q2 PARTITION OF events
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

-- Query automatically targets only the relevant partition
SELECT * FROM events WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';
-- → only scans events_2026_q1
```

**Hash partitioning** — distributes rows evenly by hash of a column:

```sql
CREATE TABLE users (id UUID, ...) PARTITION BY HASH (id);
CREATE TABLE users_p0 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE users_p1 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 1);
-- 4 equal partitions; good for even distribution without a natural range
```

**When partitioning helps:**
- Tables with billions of rows where queries always filter on the partition key
- Archiving: dropping old data is instant (`DROP TABLE events_2024`) vs slow (`DELETE FROM events WHERE ...`)
- Time-series data, audit logs, event streams

**When it doesn't help:** Small tables, tables without a clear partition key, queries that don't filter on the partition key (they scan all partitions — worse than no partitioning).

---

## 5.7 Interview Answer Scripts

**Q: "What is MVCC and why does PostgreSQL need VACUUM?"**

> "MVCC — Multi-Version Concurrency Control — is PostgreSQL's approach to letting reads and writes happen concurrently without blocking each other. Instead of locking rows during a write, PostgreSQL keeps multiple versions of each row. Each row has hidden `xmin` and `xmax` columns recording which transaction created and deleted it. A reader uses a snapshot of which transactions were committed when it started, and only sees row versions consistent with that snapshot. The side effect: every UPDATE and DELETE leaves behind the old row version — a 'dead tuple' — still on disk. VACUUM is the cleanup process that reclaims that space. Without it, heavily updated tables grow indefinitely. Autovacuum handles this automatically, but you need to monitor for tables where autovacuum can't keep up with write rate."

**Q: "When would you use a GIN index over a B-tree?"**

> "GIN is for composite values where you need to search for elements within the value — arrays, JSONB, and full-text search. B-tree works by sorting values and doing binary search, so it can't answer 'does this array contain X' or 'does this JSON object have key Y'. GIN inverts the structure: it maps each element to the rows containing it, so you can answer containment queries efficiently. In Nativ, we use GIN on the metadata JSONB column to query vocabulary items by tags. The tradeoff: GIN indexes are bigger and slower to build and update than B-tree. Don't use GIN on a column you only do equality or range checks on — B-tree is better there."

**Q: "What happens without connection pooling on a high-traffic API?"**

> "Two problems. First, connection creation cost — establishing a PostgreSQL connection takes 50-100ms including the process fork, authentication, and session setup. If your app opens a new connection per request, you're adding that latency to every request. Second, connection limits — PostgreSQL has a hard cap (default 100) on simultaneous connections. With 20 app instances each holding 5 connections, you're already at 100. The next request that needs a connection fails or queues indefinitely. Connection pooling (PgBouncer, Supabase pooler, RDS Proxy) maintains a small pool of actual PostgreSQL connections and multiplexes many application connections onto them. In transaction mode, the server connection is only held during a transaction — between transactions, it's returned to the pool and available for other requests."

**Q: "JSONB or a normalized column — how do you decide?"**

> "The key question is: do I query this data, or do I just store and retrieve it? If I need to filter on it, sort by it, or join through it, I want a typed column with a B-tree index. If I need to check containment in an array or search by JSONB key, I want a GIN index on JSONB. If it's genuinely variable-shape data — like product attributes where electronics have 'voltage' and furniture has 'material' — JSONB is the right model because you can't know all possible columns upfront. Where JSONB goes wrong is when people use it as a crutch to avoid designing a schema. If the same three keys appear on 95% of rows and you query them regularly, those should be typed columns."

---

## 5.8 Self-Tests

Try answering these before looking at the answers.

1. A table has 10 million rows and 8 million dead tuples (80% dead). Autovacuum hasn't run in 6 hours. What are two possible causes, and what do you do?
2. You add a GIN index on a JSONB column. A query `WHERE metadata->>'status' = 'active'` is still doing a sequential scan. Why, and how do you fix it?
3. Your application opens a new database connection on every incoming HTTP request and closes it when the request finishes. At 500 req/s, what happens and why?
4. You're partitioning a `logs` table by `created_at` (monthly partitions). A query runs `SELECT COUNT(*) FROM logs WHERE user_id = '123'`. Does partition pruning help? Why or why not?
5. `VACUUM FULL` vs `VACUUM` — a colleague wants to run `VACUUM FULL` on a 50GB production table at 2pm on a Tuesday. What do you tell them?

<details>
<summary>Answers</summary>

1. Two possible causes: (a) **Long-running transaction** — autovacuum cannot remove dead tuples that are still visible to any open transaction. Check `SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC`. Kill the long-running transaction if appropriate. (b) **Autovacuum falling behind on a high-write table** — the default trigger is 20% dead tuples + 50 rows; for large tables this threshold fires too late. Tune `autovacuum_vacuum_scale_factor` to a smaller value (e.g., 0.01 instead of 0.2) for that specific table with `ALTER TABLE ... SET (autovacuum_vacuum_scale_factor = 0.01)`. Emergency fix: run `VACUUM ANALYZE table_name` manually during low-traffic hours.

2. `GIN` indexes support `@>` (containment), `?` (key exists), and `@@` (full-text). The `->>` operator with `=` is a text equality comparison — GIN can't answer it directly. Fix options: (a) Rewrite the query using containment: `WHERE metadata @> '{"status": "active"}'` — this uses the GIN index. (b) If `status` is queried frequently, extract it as a generated column: `ALTER TABLE products ADD COLUMN status TEXT GENERATED ALWAYS AS (metadata->>'status') STORED` and add a B-tree index on `status`. Generated columns are indexed like normal columns and kept in sync automatically.

3. At 500 req/s with a new connection per request: each connection takes ~50-100ms to establish — 500 × 75ms = 37.5 seconds of connection overhead per second (impossible to sustain). More critically, PostgreSQL's connection limit (default 100) would be exhausted almost instantly — 500 new connection requests per second vs a 100-connection limit means most requests queue or fail. The fix is a connection pool (SQLAlchemy's built-in pool or PgBouncer). With a pool of 20 connections and transaction pooling, 500 req/s can be served because connections are reused and most queries complete in milliseconds.

4. **No, partition pruning does not help here.** Partition pruning works when the WHERE clause filters on the partition key (`created_at`). This query filters on `user_id`, which is not the partition key. PostgreSQL must scan all monthly partitions to find rows for `user_id = '123'`. This query is actually *worse* with partitioning than without — instead of one sequential scan, it does one scan per partition. Fix: add an index on `user_id` within each partition (partition indexes are local, but the query planner uses them). Or reconsider whether the access pattern fits the partition key.

5. **Don't run VACUUM FULL at 2pm on a production table.** `VACUUM FULL` takes an exclusive lock — it blocks all reads and writes on that table for the entire duration. On a 50GB table, this can take 30+ minutes depending on I/O. During business hours, this is an outage for that table. Alternative: (a) `VACUUM` (no FULL) reclaims space for PostgreSQL's internal reuse without blocking. (b) If the goal is to return disk space to the OS, schedule `VACUUM FULL` during a maintenance window with a customer notice, or use `pg_repack` extension which compacts tables online without an exclusive lock.

</details>

---

← Back to [4. SQL Fundamentals](4-sql-fundamentals.md) | Next → [6. SQLAlchemy 2.x](6-sqlalchemy.md)
