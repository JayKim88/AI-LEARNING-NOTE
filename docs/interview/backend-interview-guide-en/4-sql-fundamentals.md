# 4. SQL Fundamentals

### Why This Section Matters

SQL is the most durable skill in backend engineering. Frameworks come and go; the relational model has been the dominant data storage paradigm for 50 years and shows no sign of changing for structured data.

In interviews, SQL questions test two things: do you understand *how the database executes queries* (not just what syntax to write), and can you write correct queries under time pressure? The second is tested with live coding; the first with explanation questions.

The gap between "writes SQL that returns correct results" and "writes SQL that scales" is almost entirely about understanding indexes, joins, and query execution.

**What interviewers actually probe:**
- Write a query with a JOIN, a GROUP BY, and a HAVING — can you get it right under pressure?
- What's the difference between `WHERE` and `HAVING`? When does each apply?
- You have a slow query. Walk me through how you'd diagnose and fix it.
- What's an N+1 query problem and how do you detect it?

---

## 4.1 JOINs — Five Types, One Mental Model

All JOINs combine rows from two tables based on a condition. The difference is what happens when no match exists.

Think of two tables as two circles in a Venn diagram:

```
    Users          Orders
   ┌──────┐       ┌──────┐
   │  A   │       │  B   │
   │      │overlap│      │
   └──────┘       └──────┘
```

| JOIN Type | Returns | Use when |
|-----------|---------|---------|
| `INNER JOIN` | Only rows where both sides match (the overlap) | You only want records with data on both sides |
| `LEFT JOIN` | All left rows + matched right rows (NULLs for no match) | "Give me all users, and their orders if they have any" |
| `RIGHT JOIN` | All right rows + matched left rows | Rarely used — swap table order and use LEFT JOIN instead |
| `FULL OUTER JOIN` | All rows from both sides (NULLs where no match) | Finding records that exist in one table but not the other |
| `CROSS JOIN` | Every combination of every row (cartesian product) | Generating combinations; accidentally used when you forget a JOIN condition |

```sql
-- INNER: users who have placed orders
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
INNER JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name;

-- LEFT: all users, with order count (0 if none)
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name;

-- Finding users with NO orders (anti-join pattern)
SELECT u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;
```

**Common mistake:** Using `INNER JOIN` when you want `LEFT JOIN`, then wondering why some users are missing from the results.

---

## 4.2 Aggregations — GROUP BY, HAVING, and Window Functions

**GROUP BY + aggregate functions:**

```sql
-- Total revenue per product category, only for categories > $10,000
SELECT
    p.category,
    COUNT(oi.id)        AS item_count,
    SUM(oi.price)       AS total_revenue,
    AVG(oi.price)       AS avg_price
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.category
HAVING SUM(oi.price) > 10000          -- filter on aggregated value
ORDER BY total_revenue DESC;
```

**WHERE vs HAVING:**
- `WHERE` filters *before* grouping — on individual rows
- `HAVING` filters *after* grouping — on aggregated results

```sql
-- WHERE: only include items where price > 100 (row-level filter)
SELECT category, SUM(price) FROM order_items
WHERE price > 100
GROUP BY category;

-- HAVING: only include categories where total > 10000 (group-level filter)
SELECT category, SUM(price) FROM order_items
GROUP BY category
HAVING SUM(price) > 10000;
```

**Window functions** — aggregate over a set of rows without collapsing them:

```sql
-- Rank users by order count, partition by country
SELECT
    u.name,
    u.country,
    COUNT(o.id) AS order_count,
    RANK() OVER (PARTITION BY u.country ORDER BY COUNT(o.id) DESC) AS country_rank
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name, u.country;

-- Running total of revenue by date
SELECT
    created_at::date AS day,
    SUM(amount) AS daily_revenue,
    SUM(SUM(amount)) OVER (ORDER BY created_at::date) AS cumulative_revenue
FROM orders
GROUP BY day
ORDER BY day;
```

Window functions: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`, `LAG()`, `LEAD()`, `SUM() OVER`, `AVG() OVER`. The `PARTITION BY` clause defines the "group"; `ORDER BY` inside `OVER` defines the row order within the partition.

---

## 4.3 Subqueries and CTEs

**Subquery** — a query nested inside another query:

```sql
-- Users who have spent more than the average order value
SELECT name FROM users
WHERE id IN (
    SELECT user_id FROM orders
    WHERE amount > (SELECT AVG(amount) FROM orders)
);
```

**CTE (Common Table Expression)** — a named temporary result set. Same semantics as a subquery but readable:

```sql
WITH avg_order AS (
    SELECT AVG(amount) AS avg FROM orders
),
high_value_users AS (
    SELECT DISTINCT user_id
    FROM orders, avg_order
    WHERE orders.amount > avg_order.avg
)
SELECT u.name, u.email
FROM users u
JOIN high_value_users hvu ON hvu.user_id = u.id;
```

Use CTEs for:
- Breaking complex queries into readable steps
- Reusing the same subquery multiple times (avoid repeating it)
- Recursive queries (e.g., traversing tree structures)

```sql
-- Recursive CTE: org chart traversal
WITH RECURSIVE org_tree AS (
    -- Base case: start from the root
    SELECT id, name, manager_id, 0 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive case: find direct reports
    SELECT e.id, e.name, e.manager_id, ot.depth + 1
    FROM employees e
    JOIN org_tree ot ON ot.id = e.manager_id
)
SELECT * FROM org_tree ORDER BY depth, name;
```

---

## 4.4 Indexes — How They Work and When They Help

An index is a separate data structure (usually a B-tree) that the database maintains to speed up lookups. Without an index on `user_id`, finding a user by ID requires scanning every row — O(n). With an index, it's O(log n).

**The cost of indexes:** Every INSERT, UPDATE, and DELETE must also update all relevant indexes. Indexes are not free. Don't index every column; index columns you filter or join on frequently.

```sql
-- When an index helps
SELECT * FROM orders WHERE user_id = 123;         -- index on user_id: O(log n)
SELECT * FROM users WHERE email = 'a@b.com';       -- index on email: O(log n)
SELECT * FROM logs WHERE created_at > '2026-01-01'; -- index on created_at: range scan

-- When an index doesn't help
SELECT * FROM users WHERE LOWER(email) = 'a@b.com'; -- function wrapping breaks index
SELECT * FROM users WHERE email LIKE '%@gmail.com';  -- leading wildcard breaks index
SELECT * FROM orders WHERE status != 'pending';      -- low selectivity may skip index
```

**Composite indexes — order matters:**

```sql
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- ✅ Uses the index (leading column matches)
SELECT * FROM orders WHERE user_id = 123;
SELECT * FROM orders WHERE user_id = 123 AND status = 'paid';

-- ❌ Cannot use the index (skips leading column)
SELECT * FROM orders WHERE status = 'paid';
```

Rule: a composite index on `(a, b, c)` can be used for queries filtering on `a`, `a+b`, or `a+b+c` — but not `b` alone or `c` alone.

**EXPLAIN ANALYZE — reading a query plan:**

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 123;

-- Sample output:
-- Index Scan using idx_orders_user_id on orders  (cost=0.28..8.30 rows=5 ...)
--   Index Cond: (user_id = 123)
--   Actual rows: 5  Loops: 1
```

What to look for:
- `Seq Scan` on a large table = missing index
- `rows=1000` (estimated) vs `Actual rows=50000` = stale statistics → run `ANALYZE`
- `Hash Join` vs `Nested Loop` — Hash Join is better for large sets; Nested Loop is better when one side is small

---

## 4.5 Transactions and Isolation Levels

**A transaction** is a unit of work that either fully succeeds or fully fails — all-or-nothing.

The ACID properties guarantee this:
- **Atomicity** — all steps succeed or all roll back
- **Consistency** — data moves from one valid state to another
- **Isolation** — concurrent transactions don't see each other's intermediate states
- **Durability** — committed transactions survive crashes

**Isolation levels** control what a transaction can see about concurrent transactions' work:

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | PostgreSQL default? |
|-------|:----------:|:-------------------:|:------------:|:-------------------:|
| Read Uncommitted | ✅ possible | ✅ possible | ✅ possible | ❌ (not supported) |
| Read Committed | ✅ prevented | ✅ possible | ✅ possible | ✅ **Default** |
| Repeatable Read | ✅ prevented | ✅ prevented | ✅ possible* | ❌ |
| Serializable | ✅ prevented | ✅ prevented | ✅ prevented | ❌ |

*PostgreSQL's Repeatable Read actually prevents phantom reads too via MVCC snapshot — a PostgreSQL-specific behavior.

**The anomalies explained:**

- **Dirty read:** T1 reads T2's uncommitted change. T2 rolls back. T1 has invalid data.
- **Non-repeatable read:** T1 reads a row, T2 updates it, T1 reads it again — different values.
- **Phantom read:** T1 queries a set of rows, T2 inserts a matching row, T1 re-queries — different count.

**Practical note:** Most applications use the default `Read Committed`. Only use `Serializable` when you need full ACID guarantees (financial transfers, inventory). Higher isolation = more locking = less concurrency.

---

## 4.6 N+1 Query Problem

N+1 is one of the most common performance bugs in ORMs. It happens when code issues one query to fetch a list, then one query per item to fetch related data.

```python
# ❌ N+1: 1 query for posts + N queries for authors
posts = session.execute(select(Post)).scalars().all()
for post in posts:
    print(post.author.name)   # triggers a SELECT per post
    # 100 posts = 101 queries
```

**Detection:** Enable SQLAlchemy query logging and count queries. In production, use an APM tool (Datadog, Sentry) that shows query counts per request.

**Fix 1 — eager loading with `selectinload` (separate IN query, best for large sets):**

```python
from sqlalchemy.orm import selectinload

posts = session.execute(
    select(Post).options(selectinload(Post.author))
).scalars().all()
# 2 queries total: SELECT * FROM posts; SELECT * FROM users WHERE id IN (...)
```

**Fix 2 — `joinedload` (single JOIN query, best for small related sets):**

```python
from sqlalchemy.orm import joinedload

posts = session.execute(
    select(Post).options(joinedload(Post.author))
).scalars().all()
# 1 query: SELECT posts.*, users.* FROM posts JOIN users ON ...
```

**When to use which:**
- `selectinload` — one-to-many relationships (post has many comments); avoids row multiplication from the JOIN
- `joinedload` — many-to-one relationships (post has one author); single query is efficient

---

## 4.7 Interview Answer Scripts

**Q: "What's the difference between WHERE and HAVING?"**

> "WHERE filters rows before grouping happens — it operates on individual rows. HAVING filters after grouping — it operates on aggregated results. Practically: if you want to exclude low-price items before calculating the average, use WHERE. If you want to exclude categories where the total revenue is under a threshold, use HAVING — because that total doesn't exist until after GROUP BY runs. You can use both in the same query: WHERE narrows the input rows, GROUP BY aggregates them, HAVING filters the groups."

**Q: "What's an N+1 problem and how do you detect it in production?"**

> "N+1 happens when you fetch a list of N items and then make one additional query per item to load related data — 1 query for the list plus N queries for details, totaling N+1. It's usually introduced silently by ORM lazy loading. In development, I enable query logging and count queries per request. In production, APM tools like Datadog or Sentry's performance monitoring show query counts and slow queries per endpoint. The fix is eager loading — in SQLAlchemy, `selectinload` for one-to-many (fetches related items in a separate IN query) or `joinedload` for many-to-one (single JOIN). I prefer `selectinload` for one-to-many because JOIN can multiply rows when each parent has multiple children."

**Q: "You have a slow query on a large table. Walk me through your diagnosis."**

> "First, `EXPLAIN ANALYZE` — look at whether the query is doing a sequential scan where an index scan should be possible, and compare estimated vs actual row counts. If estimated rows are way off, the statistics are stale and `ANALYZE` or `VACUUM ANALYZE` will fix the planner's decisions. Second, check for index-defeating patterns: functions on indexed columns like `LOWER(email)`, leading wildcards in LIKE, or low-selectivity conditions the planner decides to ignore. Third, check if the query is doing a large sort or hash operation in memory — if it spills to disk, tune `work_mem`. Fourth, look at the join strategy — a hash join on a small inner table is usually faster than a nested loop on a large one. Once I have a theory, I test with a modified query or index and compare `EXPLAIN ANALYZE` output before and after."

**Q: "When would you use a window function instead of GROUP BY?"**

> "GROUP BY collapses rows — you get one output row per group. Window functions compute an aggregate but keep all the original rows. The canonical case: ranking. If I want to rank users by order count, GROUP BY gives me the grouped totals, but I lose the individual row context. With `RANK() OVER (ORDER BY order_count DESC)`, each user row keeps all its columns and gets a rank added. Another case: running totals. `SUM(revenue) OVER (ORDER BY date)` gives me a cumulative sum without collapsing to one row per date. The rule of thumb: if you need the aggregate result *alongside* each original row, use a window function."

---

## 4.8 Self-Tests

Try answering these before looking at the answers.

1. Write a query that returns the top 3 customers by total spend, but only customers who have placed more than 5 orders.
2. You add an index on `orders.user_id`. A query `SELECT * FROM orders WHERE user_id = 123 AND status = 'pending'` is still doing a sequential scan. What are two possible reasons?
3. Two transactions run concurrently at `Read Committed` isolation. T1 reads a balance (100), T2 reads the same balance (100), both add 50 and write back. The final balance is 150, not 200. What anomaly is this and how do you fix it?
4. Your query `SELECT name FROM users WHERE email LIKE '%@gmail.com'` is slow on a 5M-row table. You have an index on `email`. Why doesn't the index help, and what's one alternative approach?
5. Explain why `FULL OUTER JOIN` is rarely used in practice, and give one scenario where it's the right choice.

<details>
<summary>Answers</summary>

1. ```sql
   SELECT
       u.name,
       COUNT(o.id) AS order_count,
       SUM(o.amount) AS total_spend
   FROM users u
   JOIN orders o ON o.user_id = u.id
   GROUP BY u.id, u.name
   HAVING COUNT(o.id) > 5
   ORDER BY total_spend DESC
   LIMIT 3;
   ```
   Key points: `INNER JOIN` (only customers with orders), `GROUP BY` on `u.id` (not just `u.name`, in case names aren't unique), `HAVING` for the count filter (post-aggregation), `ORDER BY total_spend` with `LIMIT 3`.

2. Two reasons: (a) **Low selectivity** — if `user_id = 123` matches a large fraction of the table (e.g. user 123 has 80% of all orders), the planner decides a sequential scan is cheaper than an index scan + heap fetches. Fix: the query pattern may need redesign, or the data distribution is unusual. (b) **Missing composite index** — there's an index on `user_id` alone, but if a composite index on `(user_id, status)` exists, the query can be answered entirely from the index. Without `status` in the index, the planner may still prefer a seq scan to avoid many random heap lookups. Check with `EXPLAIN ANALYZE` which path was chosen and why.

3. **Lost update** anomaly (also called a write-write conflict). Both transactions read the same value before either writes. Both compute `100 + 50 = 150`. Both write 150. The second write overwrites the first — T1's update is lost. Fixes: (a) Use `UPDATE orders SET balance = balance + 50 WHERE id = 1` — the increment is atomic in SQL; no read-modify-write in application code. (b) `SELECT ... FOR UPDATE` — locks the row on read, so T2 waits for T1 to commit before it reads. (c) Optimistic locking — add a `version` column; include `WHERE version = 5` in the UPDATE and fail if version changed.

4. A leading wildcard (`LIKE '%@gmail.com'`) means the database doesn't know what the string starts with — it can't use a B-tree index, which is sorted by prefix. The index would only help with a trailing wildcard (`LIKE 'alice%'`). Alternatives: (a) Store the domain separately as a column and index it — `WHERE domain = 'gmail.com'`. (b) Use a trigram index (`pg_trgm` extension) which supports substring and leading-wildcard searches: `CREATE INDEX idx_users_email_trgm ON users USING gin(email gin_trgm_ops)`. (c) For email domain filtering specifically, store a computed column `email_domain = split_part(email, '@', 2)` and index that.

5. `FULL OUTER JOIN` returns all rows from both sides, with NULLs where no match exists. It's rarely used because: most queries have a clear "primary" table (use LEFT JOIN), and FULL OUTER JOIN results are often hard to reason about with NULLs on both sides. The right use case: **reconciliation** — comparing two datasets to find what's in one but not the other. Example: comparing expected payments in a `billing` table with actual payments in a `transactions` table. A FULL OUTER JOIN shows matched pairs, entries in billing with no transaction (pending), and transactions with no billing entry (unexpected). `WHERE billing.id IS NULL OR transactions.id IS NULL` isolates the discrepancies.

</details>

---

← Back to [3. Authentication & Authorization](3-auth.md) | Next → [5. PostgreSQL Deep Dive](5-postgresql.md)
