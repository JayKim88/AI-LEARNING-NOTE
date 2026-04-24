# 29. Observability & Debugging

### Why This Section Matters

You can't fix what you can't see. Production bugs behave differently from local bugs — they happen under load, with real data, in environments you can't `pdb` into. Observability is the discipline of making your system inspectable from the outside through logs, metrics, and traces.

Interviewers at AI startups care about this because AI products have unique observability needs: LLM call latency, token costs, prompt regressions, and retrieval quality — none of which a standard APM tool covers out of the box.

**What interviewers actually probe:**
- What's the difference between logging, metrics, and tracing?
- How do you debug a production performance issue?
- What would you instrument in an AI pipeline?
- What is structured logging and why does it matter?

---

## 29.1 The Three Pillars of Observability

**Logs** — discrete records of events with context:
```python
import structlog

logger = structlog.get_logger()

logger.info("vocab_item_created",
    user_id=user.id,
    word=item.word,
    language=item.language,
    duration_ms=elapsed * 1000,
)
```

**Metrics** — numerical measurements over time:
```python
# Prometheus-style metrics
from prometheus_client import Counter, Histogram, Gauge

requests_total = Counter("api_requests_total", "Total requests", ["endpoint", "status"])
request_duration = Histogram("api_request_duration_seconds", "Request duration", ["endpoint"])
active_llm_calls = Gauge("llm_calls_active", "Active LLM calls")

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    requests_total.labels(endpoint=request.url.path, status=response.status_code).inc()
    request_duration.labels(endpoint=request.url.path).observe(duration)
    return response
```

**Traces** — end-to-end request journey across services and operations:
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

tracer = trace.get_tracer(__name__)

async def generate_vocab_explanation(word: str, user_id: str) -> str:
    with tracer.start_as_current_span("generate_explanation") as span:
        span.set_attribute("word", word)
        span.set_attribute("user_id", user_id)

        with tracer.start_as_current_span("retrieval"):
            chunks = await retrieve_context(word, user_id)

        with tracer.start_as_current_span("llm_call"):
            answer = await call_llm(word, chunks)

        span.set_attribute("chunks_retrieved", len(chunks))
        return answer
```

---

## 29.2 Structured Logging

Plain text logs are hard to search. Structured logging (JSON) enables filtering, aggregation, and alerting on specific fields.

```python
# ❌ Unstructured — hard to search by user_id or parse duration
logger.info(f"User {user_id} created vocab item {word} in {duration:.2f}s")

# ✅ Structured — searchable by any field in your log aggregator
logger.info("vocab_item_created", extra={
    "user_id": user_id,
    "word": word,
    "duration_ms": duration * 1000,
    "language": language,
})
```

**With `structlog`:**
```python
import structlog

logger = structlog.get_logger()

# Bind context that follows all subsequent log calls
bound_logger = logger.bind(user_id=user_id, request_id=request.headers.get("X-Request-ID"))

bound_logger.info("request_started", endpoint=request.url.path)
# ... later in the same request context:
bound_logger.info("db_query_completed", table="vocab_items", duration_ms=12)
bound_logger.error("llm_call_failed", error=str(e), retries_remaining=2)
```

**What to include in every log:**
- `timestamp` — when it happened
- `level` — debug/info/warning/error
- `service` — which service
- `trace_id` / `request_id` — correlate all logs from one request
- `user_id` — who triggered it (where applicable)
- `duration_ms` — how long operations take

---

## 29.3 Key Metrics to Monitor

**Application metrics:**
- Request rate (requests/second)
- Error rate (5xx / total)
- P50, P95, P99 latency — median, 95th percentile, 99th percentile

**AI pipeline metrics:**
- LLM API call latency (P50/P95/P99)
- LLM tokens per request (input and output)
- LLM cost per request
- Retrieval latency
- Cache hit rate (prompt cache, response cache)

**Business metrics:**
- Daily active users
- Vocabulary items created per day
- Review session completion rate

**The "USE" method for system resources:**
- **U**tilization — percentage of time busy
- **S**aturation — how much work is queued
- **E**rrors — error rate

**The "RED" method for services:**
- **R**ate — requests per second
- **E**rrors — failed requests per second
- **D**uration — latency distribution

---

## 29.4 Debugging Production Performance Issues

**Systematic approach:**

```
1. Define the symptom precisely
   "P99 latency increased from 200ms to 800ms at 14:30 on Tuesday"

2. Identify the time window and deployment correlation
   "Was there a deploy? Did traffic increase? Did the DB load change?"

3. Narrow the scope
   "Is it all endpoints or one specific endpoint?"
   "Is it database queries, LLM calls, or application code?"

4. Use traces to find the slow span
   "Which part of the request took 600ms of the 800ms?"

5. Formulate and test a hypothesis
   "Hypothesis: the HNSW index isn't cached — pg_prewarm needed"
   "Test: check pg_stat_user_indexes.idx_blks_hit vs idx_blks_read"

6. Fix and verify
   "Applied fix, P99 returned to 180ms"
```

**Common FastAPI/PostgreSQL performance issues:**

```python
# Check for slow queries — queries taking > 100ms
await db.execute(text("""
    SELECT query, mean_exec_time, calls
    FROM pg_stat_statements
    WHERE mean_exec_time > 100
    ORDER BY mean_exec_time DESC
    LIMIT 10;
"""))

# Check for index usage
await db.execute(text("""
    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0  -- unused indexes
"""))
```

---

## 29.5 AI-Specific Observability

LLM applications have unique failure modes that standard APM misses:

**Prompt regression tracking:**
```python
# Log every LLM call with enough detail to reproduce it
logger.info("llm_call", extra={
    "model": model,
    "prompt_hash": hashlib.md5(prompt.encode()).hexdigest(),  # detect prompt changes
    "input_tokens": usage.input_tokens,
    "output_tokens": usage.output_tokens,
    "latency_ms": duration * 1000,
    "cache_hit": usage.cache_read_input_tokens > 0,
    "user_id": user_id,
})
```

**Tracking quality degradation:**
```python
# Sample a percentage of responses and evaluate faithfulness
async def log_rag_response(question: str, answer: str, contexts: list[str]):
    if random.random() < 0.05:  # sample 5%
        score = await evaluate_faithfulness(question, answer, contexts)
        logger.info("rag_quality_sample", extra={
            "faithfulness_score": score,
            "question_length": len(question),
        })
        # Alert if rolling average drops below threshold
```

**LangSmith integration:**
```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
# All LangChain/LangGraph calls automatically traced
# View in LangSmith: inputs, outputs, token counts, latency per node
```

---

## 29.6 Interview Answer Scripts

**Q: "What's the difference between logging, metrics, and tracing?"**

> "They answer different questions about your system. Logs are a timestamped record of events — they answer 'what happened?' A log line that says 'VocabItem created by user 123 in 45ms' is a fact about a specific event. Metrics are aggregated measurements over time — they answer 'how is the system performing right now?' A metric like 'P99 latency is 250ms' aggregates thousands of events into a number that you can alert on and graph. Traces are end-to-end request journeys — they answer 'where did this specific request spend its time?' A trace shows that 200ms was in the database query, 50ms in the LLM call, and 5ms in application code. Together, metrics tell you something is wrong, traces tell you where, and logs tell you what happened in detail."

**Q: "How would you debug a sudden P99 latency spike in production?"**

> "Start by narrowing scope. First question: is it all endpoints or one? Check metrics grouped by endpoint. If it's one endpoint, look at what changed — was there a deploy, a schema migration, or a data growth event? Next, look at traces for slow requests — which span is taking the most time: database, LLM API, application logic? If it's database, look at `pg_stat_statements` for slow queries and check whether an index is being used or bypassed. If it's LLM, check whether the external API's own latency increased (check their status page) and whether your prompt length grew. I'd also check resource utilization: CPU, memory, connection pool saturation. The goal is forming a hypothesis before touching anything: 'P99 spiked when connection pool was exhausted due to slow queries holding connections longer.' Fix, deploy, verify."

**Q: "What would you add to Nativ's observability if you were going to production with 10,000 users?"**

> "Four areas. First, structured logging on every API request with user_id, request_id, and duration_ms — so I can correlate a user's support ticket with the exact request in logs. Second, metrics for the LLM pipeline: latency, token counts, cost per request, cache hit rate — I want to see when a prompt change doubles my cost or triples my latency. Third, error alerting on 5xx rate, LLM API failures, and database connection pool saturation — pages me before users report it. Fourth, periodic RAG quality evaluation against a golden dataset — a prompt change that looks harmless might tank faithfulness. LangSmith handles the LLM call tracing. Everything else I'd wire to Datadog or Grafana + Prometheus."

**Q: "How do you add distributed tracing to a FastAPI application?"**

> "Use OpenTelemetry — the vendor-neutral standard. The setup: `pip install opentelemetry-sdk opentelemetry-instrumentation-fastapi opentelemetry-instrumentation-sqlalchemy`. Configure a tracer provider with your backend (Jaeger, Tempo, Datadog): `TracerProvider(exporter=OTLPExporter(endpoint=...))`. Auto-instrument FastAPI and SQLAlchemy: `FastAPIInstrumentor.instrument_app(app)` and `SQLAlchemyInstrumentor().instrument(engine=engine)`. This automatically creates spans for every HTTP request and every SQL query, with parent-child relationships — you see a trace like: `/vocab/search` → `SELECT from vocab_items` (45ms) → `embed query` (80ms) → `SELECT from vocab_embeddings ORDER BY embedding` (20ms). For custom spans, use the context manager: `with tracer.start_as_current_span('generate_explanation') as span: span.set_attribute('model', model_name)`. The resulting traces answer 'where did this request spend its 300ms?' without adding `print` statements everywhere."

---

## 29.7 Self-Tests

Try answering these before looking at the answers.

1. Your API returns 200 for all requests, but users are reporting incorrect data. Which observability signal (logs, metrics, or traces) would help most and why?
2. You have metrics showing P99 latency is 2 seconds. You have no traces. What do you do next?
3. A log line reads: `"error": "connection refused at localhost:5432"`. What's wrong and how do you investigate?
4. You're logging user IDs, email addresses, and request bodies in your API logs. What's the security and compliance risk?
5. Your LLM cost doubled overnight with no change in user count. What do you investigate?

<details>
<summary>Answers</summary>

1. **Logs** — they contain the most detail about what actually happened in the request. Metrics tell you whether error rate went up (but 200s don't look like errors to metrics). Traces show where time was spent (latency). Logs with structured fields — user_id, the actual response data, the DB query results — can reveal why the response data was wrong. Example: a log showing `user_id=123, vocab_count_returned=0` when the user has 500 items would point to a missing filter or a wrong user_id in the query. After identifying the pattern in logs, traces would help you understand the execution path that produced the wrong data.

2. Add tracing. Without traces, you know something is slow but not where. Immediate steps: (a) Add OpenTelemetry spans to the slow endpoint's key operations (DB query, LLM call, external API calls). (b) As an emergency measure, add timing logs at each major step: `logger.info("db_query_start"); ... logger.info("db_query_end", duration_ms=elapsed)`. This creates a poor man's trace from logs. (c) Check existing metrics at a more granular level — does database query latency correlate with the P99 spike? Does it happen only for certain users or all users? The goal is narrowing "2 second latency" to "DB query takes 1.8 seconds for users with >1000 vocab items."

3. The application can't connect to PostgreSQL at `localhost:5432`. This means the database process isn't running, it's on a different port, or the connection refused at the network level. Investigation steps: (a) On the server: `pg_isready -h localhost -p 5432` — is Postgres running? (b) `ss -tlnp | grep 5432` — what's listening on that port? (c) If running: check `pg_hba.conf` for authentication config, check whether the database URL in the app config points to the right host (maybe a misconfigured environment variable pointing to `localhost` in a containerized environment that should use a service name like `db` or an RDS hostname).

4. **Security risks**: GDPR and similar regulations require that personal data (email, name, any PII) is stored and processed lawfully. Storing emails in logs may require: data residency compliance (logs can't leave certain regions), log retention limits (logs with PII can't be kept longer than necessary), and access controls on log systems. **GDPR specifically**: logging personal data without a lawful basis or without disclosing it in the privacy policy is a compliance violation. **Practical risk**: logs are often shipped to third-party services (Datadog, Papertrail) with broader access than the database. Fix: redact PII from logs — log user IDs (opaque references) not emails; if you must log emails, ensure your log aggregator is compliant and document the retention policy.

5. Token cost doubled with the same number of users — means tokens per request roughly doubled. Investigate: (a) **Prompt changes** — did anyone change the system prompt? Check git blame on prompt files or look at `prompt_hash` in logs. A system prompt that grew from 1,000 to 2,000 tokens doubles input cost. (b) **Context window growth** — did the RAG retrieval start returning more or larger chunks? Check average `chunks_retrieved` and `input_tokens` per LLM call in logs. (c) **Prompt caching stopped working** — if the cache TTL expired and cache writes are now the majority (which cost the same as uncached), or if a prompt change made the cache prefix non-matching. Check `cache_hit_rate` metric. (d) **Model change** — was the model accidentally changed from a cheaper to a more expensive tier?

</details>

---

← Back to [28. Testing](28-testing.md) | Next → [30. DevOps Essentials](30-devops.md)
