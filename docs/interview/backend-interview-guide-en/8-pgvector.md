# 8. pgvector

### Why This Section Matters

pgvector is Nativ's core differentiator — you built a production RAG system on it. Most candidates at AI startup interviews have heard of vector databases but haven't actually used one. You have.

The questions in this section are your opportunity to turn a technical choice into a story: why pgvector over Pinecone, what HNSW index parameters mean in practice, how hybrid search works, and what the real performance tradeoffs are.

**What interviewers actually probe:**
- Why did you choose pgvector over a dedicated vector database?
- What's the difference between HNSW and IVFFlat?
- How does hybrid search work — what problem does it solve that pure vector search doesn't?
- What are the limitations of pgvector at scale?

---

## 8.1 What pgvector Is and Why It Exists

A vector database stores high-dimensional numerical vectors (embeddings) and lets you find the nearest neighbors to a query vector — this is the retrieval step in RAG.

pgvector is a PostgreSQL extension that adds a `vector` column type and approximate nearest neighbor (ANN) search directly inside PostgreSQL. Instead of running a separate vector database service (Pinecone, Weaviate, Qdrant), you store vectors alongside your relational data in the same database.

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table with a vector column
CREATE TABLE vocab_embeddings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    word TEXT NOT NULL,
    embedding vector(1536),          -- OpenAI text-embedding-3-small dimension
    language TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8.2 Index Types — HNSW vs IVFFlat

Without an index, vector search does an exact nearest neighbor scan — O(n) with n rows. For production use, you need an Approximate Nearest Neighbor (ANN) index.

**HNSW (Hierarchical Navigable Small World)**

A graph-based structure that builds a multi-layer network of connections. Search starts at the top layer (sparse, long-range connections) and drills down to denser layers as it gets closer to the query.

```sql
CREATE INDEX ON vocab_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Parameters:
- `m` — number of connections per node. Higher = better recall, larger index. Default 16 is good; 32–64 for high recall requirements.
- `ef_construction` — search width during index build. Higher = better index quality, slower build. Default 64; 100–200 for production.
- At query time: `SET hnsw.ef_search = 100` — higher = better recall, slower query. Default 40.

**IVFFlat (Inverted File with Flat Quantization)**

Clusters vectors into `lists` groups at build time using k-means. Search checks the `probes` nearest clusters and does exact search within them.

```sql
-- Must have data before building (k-means needs data to cluster)
CREATE INDEX ON vocab_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- At query time: increase probes for better recall at cost of speed
SET ivfflat.probes = 10;
```

Parameters:
- `lists` — number of clusters. Rule of thumb: `rows / 1000` for up to 1M rows, `sqrt(rows)` for larger.
- `probes` — how many clusters to search. Default 1 (fast, lower recall); 10 is a good production balance.

**Comparison:**

| | HNSW | IVFFlat |
|-|------|---------|
| Query speed | ✅ Faster | Slower |
| Recall | ✅ Higher (at same speed) | Lower (tunable with probes) |
| Build time | Slower | ✅ Faster |
| Memory usage | ✅ Smaller at query time | More memory for index |
| Build requires data | No | ✅ Yes (needs data for k-means) |
| Best for | Production, latency-sensitive | Batch pipelines, prototyping |

**Nativ uses HNSW** — retrieval latency matters for user-facing queries, and the index is built once and queried frequently.

---

## 8.3 Distance Metrics

pgvector supports three distance operators:

| Operator | Metric | Use when |
|----------|--------|---------|
| `<->` | L2 (Euclidean) | Embeddings not normalized; geometric distance |
| `<=>` | Cosine similarity | Text embeddings — angle between vectors (most common) |
| `<#>` | Inner product (negative) | Normalized vectors where cosine = inner product |

For OpenAI and most text embeddings, **cosine similarity** (`<=>`) is correct — you care about the angle between vectors (semantic direction), not the magnitude.

```sql
-- Find 5 most similar vocabulary items to a query embedding
SELECT word, language, 1 - (embedding <=> $1::vector) AS similarity
FROM vocab_embeddings
WHERE user_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

---

## 8.4 Hybrid Search — Solving Pure Vector Search's Weaknesses

Pure vector search (semantic search) has a well-known failure mode: **exact matches lose to semantic matches**.

If a user asks for "Bundesliga", the vector search finds semantically similar words ("football", "soccer", "match") — but the exact word "Bundesliga" might be ranked lower than these generic terms. Proper nouns, codes, and abbreviations are systematically under-retrieved by semantic search.

**Hybrid search** combines vector (semantic) search with keyword (BM25/full-text) search. The results from both are merged using a ranking algorithm.

**Reciprocal Rank Fusion (RRF):**

RRF merges ranked lists from multiple retrieval methods. Each result's score is `1 / (k + rank)` where `k` is a smoothing constant (usually 60). Items appearing high in multiple lists get boosted.

```sql
WITH semantic AS (
    -- Vector search: top 20 by cosine similarity
    SELECT id, word, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
    FROM vocab_embeddings
    WHERE user_id = $3
    ORDER BY embedding <=> $1::vector
    LIMIT 20
),
keyword AS (
    -- Full-text search: top 20 by BM25
    SELECT id, word, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, query) DESC) AS rank
    FROM vocab_embeddings,
         to_tsquery('english', $2) query
    WHERE user_id = $3
      AND search_vector @@ query
    ORDER BY ts_rank(search_vector, query) DESC
    LIMIT 20
),
rrf AS (
    -- Merge with Reciprocal Rank Fusion
    SELECT
        COALESCE(s.id, k.id) AS id,
        COALESCE(s.word, k.word) AS word,
        COALESCE(1.0 / (60 + s.rank), 0) +
        COALESCE(1.0 / (60 + k.rank), 0) AS rrf_score
    FROM semantic s
    FULL OUTER JOIN keyword k USING (id)
)
SELECT id, word FROM rrf
ORDER BY rrf_score DESC
LIMIT 5;
```

**Nativ uses weighted RRF** — a small alpha weight on the keyword score to boost exact matches without fully overriding semantic ranking.

**Nativ connection:** This is the retrieval core of Nativ. The hybrid search is why Nativ correctly retrieves "Bundesliga" when users ask about German football vocabulary — the keyword component catches the exact token while the semantic component provides relevant context.

---

## 8.5 pgvector Limitations and When to Use a Dedicated Vector DB

pgvector is excellent for most production workloads, but has real limitations:

| Limitation | Impact | Mitigation |
|------------|--------|-----------|
| Single-node scaling | All vectors must fit on one PostgreSQL instance | Partition by user_id; or move to dedicated VDB at >100M vectors |
| HNSW index load into RAM | Large indexes slow queries if not cached | Provision enough RAM; use `pg_prewarm` to warm cache |
| No built-in reranking | Two-stage retrieval (retrieve → rerank) requires app-side code | Implement reranker in Python (Cohere, cross-encoder models) |
| Filtering before ANN | `WHERE user_id = X` before ANN search reduces effective index | Pre-filter then search, or use pgvector's filtered search |

**When to consider a dedicated vector database (Pinecone, Qdrant, Weaviate):**
- >50M vectors per table (pgvector HNSW index becomes very large)
- Need for sub-10ms retrieval at P99
- Multi-region replication of the vector store
- Metadata filtering at massive scale

**Nativ's rationale for pgvector:** At Nativ's current scale, the operational simplicity of one database (PostgreSQL + Supabase) outweighs the marginal performance benefit of a separate vector database. Vocabulary data is user-scoped, so partitioning by user keeps individual indexes small. At 10M+ vectors we'd revisit.

---

## 8.6 Interview Answer Scripts

**Q: "Why did you choose pgvector over Pinecone for Nativ?"**

> "Three reasons. First, operational simplicity — Nativ already uses PostgreSQL on Supabase, and pgvector runs as an extension inside the same database. One fewer service to manage, monitor, and pay for. Second, our data is relational — vocabulary items have foreign keys to users and sessions, and we often join vector search results with relational data in the same query. A dedicated vector database would require a separate join in application code. Third, at Nativ's scale, pgvector's performance is entirely sufficient. The HNSW index handles our retrieval latency well, and the total vector count is manageable on a single node. I'd revisit at >10 million vectors or if we needed sub-millisecond P99 retrieval."

**Q: "What's the difference between HNSW and IVFFlat and which would you use in production?"**

> "Both are approximate nearest neighbor indexes — they trade some recall accuracy for much faster search than exact scan. HNSW builds a graph structure where each vector connects to its neighbors across multiple layers. It's faster at query time, has better recall at comparable speeds, and doesn't require training data to build. IVFFlat clusters vectors at build time and searches only the nearest clusters — faster to build, but you need existing data for the k-means step, and recall depends on the `probes` setting. For a production API where query latency matters, I use HNSW. IVFFlat is useful when you're rebuilding the index frequently or need fast initial indexing on a large dataset. In Nativ, HNSW with `m=16, ef_construction=64` gives good recall with acceptable build time."

**Q: "What problem does hybrid search solve and how does RRF work?"**

> "Pure semantic search ranks by vector similarity — it finds conceptually related content. But it systematically underperforms on exact matches: proper nouns, abbreviations, codes, and uncommon terms get pulled down by generic synonyms. Hybrid search combines a semantic retrieval pass with a keyword retrieval pass and merges the ranked lists. Reciprocal Rank Fusion is the standard merging algorithm: each result gets a score of `1 / (60 + rank)` from each retrieval method, and scores are summed. Items appearing high in both lists get the highest combined score. The 60 constant smooths out the difference between rank 1 and rank 2 — without it, rank 1 would be worth twice rank 2. In Nativ, this means 'Bundesliga' gets a strong keyword signal even if it's not the closest semantic vector to 'German football vocabulary'."

**Q: "How does hybrid search work and why is it better than pure vector search?"**

> "Pure vector search finds semantically similar results, but it can miss exact matches. If a user searches for 'Wanderlust' and the word 'Wanderlust' is in the database, a semantic query might rank it lower than loosely-related travel vocabulary if the embedding space happens to cluster them far apart. Keyword search catches the exact token but has no semantic understanding — 'travel desire' won't match 'Wanderlust'. Hybrid search combines both signals with Reciprocal Rank Fusion: run vector search, run full-text search, take the top results from each, and merge by 1/(rank + k). A document ranked 3rd in vector and 5th in keyword gets combined rank 1/8 + 1/10 = 0.225. The result: exact matches bubble up via the keyword component, semantically related results appear via the vector component. In Nativ, this is critical for vocabulary retrieval — users often search for exact words, and pure vector search was inconsistent on proper nouns and compound words."

---

## 8.7 Self-Tests

Try answering these before looking at the answers.

1. A user's vocabulary table has 50,000 rows with an HNSW index. Queries return in 5ms. After a bulk import of 500,000 new rows, queries now take 800ms. What's the most likely cause and how do you fix it?
2. You run `SELECT ... ORDER BY embedding <=> $1 LIMIT 5 WHERE user_id = $2`. The query plan shows the HNSW index is not being used — it falls back to a sequential scan. Why might this happen?
3. Your hybrid search is returning "football" and "soccer" at the top for a query about "Bundesliga" but the exact word "Bundesliga" is in the database. What's wrong and how do you fix it?
4. A new engineer on your team asks why you use cosine similarity (`<=>`) instead of Euclidean distance (`<->`) for text embeddings. What do you tell them?
5. You need to delete all embeddings for a user who deleted their account. You have 50,000 embeddings per user. What's the most efficient approach in pgvector?

<details>
<summary>Answers</summary>

1. The HNSW index is built with a fixed `ef_construction` parameter and covers only the data present at build time. After a large bulk import, the new vectors are appended to the table but the index quality degrades — the index structure wasn't built with these vectors in mind, so the graph connections to new nodes are suboptimal. This causes slower traversal. Fix: rebuild the index with `REINDEX INDEX CONCURRENTLY idx_name` after the bulk import. For ongoing inserts, HNSW handles incremental inserts, but very large bulk loads benefit from a full rebuild.

2. Several possible causes: (a) **Filtering reduces selectivity too much** — if `user_id = $2` matches a small fraction of rows, PostgreSQL's planner may estimate that fetching from the HNSW index + filter is more expensive than a sequential scan + filter. pgvector's ANN indexes work best when pre-filtering is done by the index (partitioned per user) rather than post-filtering. (b) **`enable_indexscan` is off** or `hnsw.ef_search` is set very low. (c) **The index was just created on an empty or near-empty table** — ANN indexes have minimum data thresholds. Check with `EXPLAIN (ANALYZE, BUFFERS)` and look for "Index Scan" vs "Seq Scan" with the actual costs.

3. The pure semantic search is dominating the results — "Bundesliga" has a lower cosine similarity to the query vector than generic football terms. The keyword (full-text) component should catch the exact token, but if the RRF weight is wrong or the full-text index doesn't include the term, the keyword signal is missing or too weak. Check: (a) Does the `search_vector` column have "Bundesliga" indexed? (`SELECT to_tsvector('german', 'Bundesliga')` — German language tokenizer handles compound words better than English). (b) Is the keyword component getting any results? Run the keyword query alone and see if "Bundesliga" appears. (c) Tune the alpha weight to give more weight to exact keyword matches for terms that appear to be proper nouns.

4. Text embeddings from models like OpenAI's encode semantic meaning as direction, not magnitude. Two texts with identical meaning but different lengths get vectors pointing in the same direction but with different magnitudes. Cosine similarity measures the angle between vectors — magnitude doesn't matter. Euclidean distance measures the geometric distance — magnitude matters. Using L2 distance on un-normalized text embeddings would penalize longer texts simply for being longer, not for being semantically different. Cosine similarity (or inner product on normalized vectors) is the semantically correct metric for text. If you normalize embeddings to unit length first, cosine similarity and inner product become equivalent.

5. Most efficient: a single bulk DELETE with the partition key. ```sql DELETE FROM vocab_embeddings WHERE user_id = $1;``` PostgreSQL will use the index on `user_id` if it exists (B-tree on `user_id`), executing a single statement that removes all rows in one transaction. For 50,000 rows this is fast. If the table is partitioned by `user_id`, the entire partition can be detached and dropped — instantaneous. Do NOT loop and delete one by one (50,000 separate statements). Do NOT load all embeddings into Python and call `db.delete()` per object — that's 50,000 ORM operations plus all the associated Python overhead.

</details>

---

← Back to [7. Alembic](7-alembic.md) | Next → [9. Redis & Caching](9-redis.md)
