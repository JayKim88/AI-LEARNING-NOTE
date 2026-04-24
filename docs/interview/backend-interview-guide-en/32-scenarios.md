# 32. Scenario-based Questions

### Why This Section Matters

Scenario-based questions are the most realistic interview format. Instead of asking "what is MVCC?", they ask "your database is slow after a large import — what do you do?" The interviewer wants to see how you think under ambiguity: do you gather information before acting? Do you consider multiple hypotheses? Can you prioritize?

This section assembles the most common scenario patterns across the topics covered in this guide. Each scenario has a structured approach, not a single "right answer."

**What interviewers actually probe:**
- How do you respond to an ambiguous production incident?
- Can you work backward from symptoms to causes?
- Do you consider tradeoffs, or just pick the first solution?

---

## 32.1 Performance Incidents

### "Our API is suddenly slow. P99 latency went from 200ms to 2 seconds."

**Step 1: Narrow the scope**
- Is it all endpoints or one specific endpoint?
- Did it coincide with a deploy, a database migration, or a traffic spike?
- Which component is slow — database, LLM API, network, application code?

**Step 2: Form hypotheses before looking**
- If all endpoints slow: shared resource (database, Redis, network)
- If one endpoint slow: something specific to that route (heavy query, LLM call, new code)
- If coincided with deploy: new code is the suspect
- If coincided with traffic spike: capacity issue

**Step 3: Check with traces and metrics**
```bash
# Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

# Check connection pool saturation
SELECT count(*) FROM pg_stat_activity;
```

**Common root causes at AI startups:**
- N+1 query pattern introduced in new code
- Missing index on a growing table
- LLM API latency increase (check provider status page)
- Connection pool exhausted (100 concurrent requests, pool size 20)
- HNSW index not cached in RAM (after restart or large data load)

---

### "The database is slow after we imported 500,000 new records."

See §8.7 self-test #1. The pattern: bulk imports may leave HNSW indexes with suboptimal structure for new vectors. `REINDEX INDEX CONCURRENTLY` after a large import.

Also check:
- `AUTOVACUUM` was triggered and is now running — temporary performance hit
- Dead tuples from the import process consuming storage
- Table statistics outdated — `ANALYZE vocab_embeddings` to refresh planner stats

---

## 32.2 Data Integrity Incidents

### "Users are reporting duplicate charges in our payment system."

**Root cause candidates:**
1. Race condition in charge processing (see §18)
2. Retry without idempotency key
3. Event delivered twice by payment webhook (at-least-once delivery)

**Immediate investigation:**
```python
# Find duplicate charges
SELECT user_id, amount, COUNT(*) as count
FROM charges
GROUP BY user_id, amount, created_at::date
HAVING COUNT(*) > 1;
```

**Fix and prevention:**
- Webhook idempotency: `ON CONFLICT (idempotency_key) DO NOTHING`
- Payment processing: `SELECT FOR UPDATE` on user balance before charging
- Log all payment attempts with their idempotency key

---

### "A data migration broke and now some users have missing data."

**Triage:**
1. Stop the migration immediately if still running
2. Identify affected rows — scope of the damage
3. Determine: was data deleted or just not migrated?

**Recovery:**
- If data was deleted and no backup: restore from point-in-time recovery (if database supports it)
- If data was moved incorrectly: identify the pattern and write a compensating migration
- Always: test migrations on a production-like dataset in staging first

---

## 32.3 Architecture Decisions

### "We're getting 10x more users. How would you scale Nativ?"

**Framework: identify the bottleneck first**

```
Current architecture: 1 FastAPI instance + 1 PostgreSQL + Redis
                              ↓
Where is the bottleneck at 10x?
```

**Scale in order of need:**
1. **Read replicas** — most reads are vocab queries; add one read replica first
2. **Horizontal API scaling** — add 2-3 FastAPI instances behind a load balancer
3. **Connection pooling** — PgBouncer in front of PostgreSQL (connection exhaustion is a common early bottleneck)
4. **Caching** — cache popular vocabulary lookup results in Redis
5. **Async LLM calls** — at high load, LLM calls queue up; move to Celery workers

**What NOT to do first:** Rewrite to microservices, move to a different database, or adopt Kubernetes before simpler scaling options are exhausted.

---

### "Should we use a dedicated vector database instead of pgvector?"

**Decision framework:**
- Current scale: How many vectors? Current query latency?
- Pain points: Is pgvector actually the bottleneck, or is it perceived?
- Operational cost: One database vs two services

**Nativ-specific answer:**
- Vocabulary is user-scoped → natural partitioning keeps per-user indexes small
- Data is relational → cross-joining with user tables is a JOIN, not an API call
- Scale: at <10M vectors, pgvector with HNSW is sufficient
- Revisit if: P99 retrieval > 50ms, single table > 50M vectors

---

## 32.4 Design Questions

### "Design the vocabulary review scheduling system for Nativ."

**Clarify the requirements first:**
- How many reviews per user per day? (10-50 items)
- What spaced repetition algorithm? (SM-2 or Leitner box)
- Does it need to be real-time or can it be precomputed?

**Core data model:**
```sql
CREATE TABLE review_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    vocab_item_id UUID REFERENCES vocab_items(id),
    next_review_at TIMESTAMPTZ NOT NULL,
    interval_days FLOAT NOT NULL DEFAULT 1,
    ease_factor FLOAT NOT NULL DEFAULT 2.5,
    repetitions INT NOT NULL DEFAULT 0,
    UNIQUE (user_id, vocab_item_id)
);

CREATE INDEX ON review_schedule (user_id, next_review_at);
```

**Query — items due for review:**
```sql
SELECT vi.*, rs.interval_days, rs.ease_factor
FROM review_schedule rs
JOIN vocab_items vi ON vi.id = rs.vocab_item_id
WHERE rs.user_id = $1
  AND rs.next_review_at <= NOW()
ORDER BY rs.next_review_at ASC
LIMIT 20;
```

**SM-2 scheduling update:**
```python
def calculate_next_review(ease: float, interval: float, quality: int) -> tuple[float, float]:
    # quality: 0-2 = forgot, 3-5 = remembered (with varying ease)
    if quality < 3:
        return 1.0, max(1.3, ease - 0.2)  # reset interval, reduce ease
    new_interval = interval * ease
    new_ease = ease + 0.1 - (5 - quality) * 0.08
    return max(1.0, new_interval), max(1.3, new_ease)
```

---

### "How would you add multi-language support to the RAG system?"

**Challenges:**
1. English embedding models perform poorly on German, Japanese text
2. Search query and document may be in different languages
3. Vocabulary items have a language property — should search be language-scoped?

**Solutions:**
1. Use a multilingual embedding model (Cohere `embed-multilingual-v3`)
2. Store `language` as metadata on each embedding — filter by language at search time
3. For cross-language search: translate query to document language OR use multilingual embeddings that map semantically equivalent phrases to similar vectors

---

## 32.5 Production Emergencies

### "Our LLM costs tripled overnight."

See §29.7 self-test #5. Investigation checklist:
1. Input token count per request — did system prompt grow?
2. Prompt caching — is cache hit rate normal?
3. Request count — actual traffic spike?
4. Model changes — did anything switch from cheap to expensive model?
5. Output tokens — are responses unexpectedly long?

---

### "Users are seeing each other's vocabulary items."

**Critical — data leak. Response is immediate:**

1. **Investigate before deploying a fix** — understand the scope
   - Is it all users or specific users?
   - Is it read-only (they can see but not modify) or write access too?
   - When did it start?

2. **Root cause pattern:**
```python
# Missing WHERE clause — most common cause
items = await db.execute(select(VocabItem))  # ❌ No user filter
items = await db.execute(select(VocabItem).where(VocabItem.user_id == user.id))  # ✅
```

3. **Temporary mitigation:** Disable the affected endpoint, deploy a fix, re-enable

4. **Post-incident:** Audit all data access endpoints for missing user_id filters, add automated authorization tests

---

## 32.6 Behavioral Scenarios

### "Tell me about a time you fixed a production bug under pressure."

**Structure:** Situation → Action → Result (STAR), but focused on technical decision-making.

**Key elements interviewers want to see:**
- You gathered information before acting (didn't blindly try fixes)
- You communicated status during the incident
- You understood the root cause, not just the symptom
- You added something to prevent recurrence (test, monitoring, documentation)

**Template for Nativ:**
> "During a Nativ load test, I noticed that P95 latency was 800ms but the database queries were showing under 50ms. I traced through the request and found the bottleneck was in the retrieval step — the pgvector HNSW index wasn't being used for queries filtered by user_id. PostgreSQL was doing a sequential scan because the filter reduced the result set too much for the planner to prefer the index. I added a partial index on (user_id, embedding) and the query plan changed to use it. P95 dropped to 120ms. I also added an explain-analyze check to the CI pipeline for the most common query patterns."

---

## 32.7 Self-Tests

These are open-ended — discuss with a study partner or answer out loud and record yourself.

1. Nativ's embedding generation starts failing. The error is `openai.RateLimitError`. Users are still able to access existing vocabulary but new items can't be embedded. How do you handle this gracefully?
2. A security researcher reports that they can access another user's vocabulary items by guessing UUIDs. How do you respond?
3. You need to add a new required field `category` to the `vocab_items` table. There are 2 million existing rows. Describe your migration strategy step by step.
4. Your team wants to A/B test two different LLM prompts for vocabulary explanations. How would you instrument this?
5. Nativ's daily active users doubled in a week due to a viral tweet. The API is returning 503 errors under load. What do you do in the next 30 minutes vs the next 48 hours?

<details>
<summary>Answers</summary>

1. **Graceful degradation**: Don't fail the whole vocab creation request just because embedding fails. Decouple the two operations: (a) Create the vocab item in the database immediately, returning success to the user. (b) Enqueue an embedding job. (c) On rate limit error, implement exponential backoff with jitter: wait 1s, 2s, 4s... up to a cap, then put the job back in the queue with a delay. (d) Expose a `embedding_status` field on vocab items: "pending", "complete", "failed". (e) Alert when the retry queue depth grows beyond a threshold. This way users can still add vocabulary — they just can't use semantic search for the new items until embedding catches up.

2. **Security incident response**: (a) First, verify the claim — attempt to reproduce with a test account. (b) If confirmed: treat as a P0 security incident. Immediately audit how many items were accessed across users — check access logs for UUID patterns from unexpected user IDs. (c) Check the authorization logic in the affected endpoint — most likely a missing `WHERE user_id = current_user.id` check. (d) Deploy a fix immediately. (e) Notify affected users per your privacy policy. (f) Post-mortem: add authorization tests, consider UUIDs as-needed (they slow enumeration but aren't a security control). Document the incident and lessons learned.

3. **Zero-downtime 3-step migration**: Step 1: Add `category` as nullable column (`ALTER TABLE vocab_items ADD COLUMN category VARCHAR(50)`). Deploy. No lock, no downtime. Step 2: Backfill existing rows in batches — don't do `UPDATE vocab_items SET category = 'general'` as a single transaction on 2M rows (long lock). Instead: `UPDATE vocab_items SET category = 'general' WHERE id IN (SELECT id FROM vocab_items WHERE category IS NULL LIMIT 10000)` in a loop. Run outside migration, repeat until no more nulls. Step 3: After all rows have a value, add NOT NULL constraint: `ALTER TABLE vocab_items ALTER COLUMN category SET NOT NULL`. In PostgreSQL 12+, this is metadata-only if no nulls exist — fast, no rewrite.

4. **A/B instrumentation**: (a) Add a `prompt_variant` field to the LLM request log (e.g., "control" or "treatment"). (b) Route users to variants: use user_id hash modulo 2 for deterministic, consistent assignment (same user always sees the same variant). (c) Define success metrics: user engagement with the explanation (did they tap "helpful"?), session continuation rate, review retention. (d) Log variant with each metric event. (e) After 1-2 weeks and sufficient statistical power, compare metrics between variants. Use feature flags (not hardcoded conditions) so you can turn variants on/off without a deploy.

5. **Next 30 minutes** (stop the bleeding): (a) Identify the bottleneck — is it CPU, memory, database connections, or external API limits? Check metrics. (b) Scale horizontally if possible — add more API instances on Render/Railway with one click. (c) Enable rate limiting if not already in place — protect the database from being overwhelmed. (d) Check if any specific endpoint is causing disproportionate load (often `/search` or LLM calls) — temporarily rate-limit or cache it. (e) Communicate status on a status page. **Next 48 hours** (address root cause): (a) Add read replica if database is the bottleneck. (b) Configure PgBouncer connection pooling. (c) Add Redis caching for hot vocabulary queries. (d) Set up auto-scaling based on CPU/request metrics. (e) Run a load test to find the new capacity ceiling and monitor proactively.

</details>

---

← Back to [31. Linux / Process Basics](31-linux.md) | Next → [33. Action Plan](33-action-plan.md)
