# 19. Message Queues & Async Jobs

### Why This Section Matters

Async job processing separates long-running work from the request/response cycle. Without it, PDF processing, email sending, and AI inference block HTTP connections, exhaust worker threads, and create poor user experience. Understanding when and how to use message queues is a production-readiness signal.

Interviewers probe whether you understand the difference between fire-and-forget, durable queuing, and fan-out — and what the failure modes of each are.

**What interviewers actually probe:**
- When would you use a message queue vs a background task?
- What is "at-least-once delivery" and why does it require idempotent consumers?
- How does Celery work with Redis or RabbitMQ?
- What happens if a worker crashes mid-task?

---

## 19.1 The Problem Message Queues Solve

HTTP request handlers need to complete quickly — typically under a few seconds. Some operations take longer: generating AI embeddings for a 50-page PDF, sending batch emails, processing a payment webhook, or training a recommendation model.

Without a queue:
```
Client → HTTP request → [50-second PDF processing] → HTTP response
         Client times out at 30s, user sees an error
         Server wasted the work, client retries, double processing
```

With a queue:
```
Client → HTTP request → [enqueue job] → HTTP response: "Job queued, id: abc123"
                              ↓
                    Worker picks up job → [50-second processing] → writes result
Client polls GET /jobs/abc123 → "status: processing" → "status: complete"
```

---

## 19.2 Delivery Guarantees

Message queues offer different delivery guarantees, each with different tradeoffs:

**At-most-once delivery:**
- Message delivered 0 or 1 times. If delivery fails, message is dropped.
- No retries. Fast.
- Use for: metrics, analytics events where occasional loss is acceptable.

**At-least-once delivery:**
- Message delivered 1 or more times. On failure, the broker retries.
- Duplicate delivery is possible — consumers must be idempotent.
- This is the standard. Most queues (Celery, SQS, RabbitMQ) default to at-least-once.

**Exactly-once delivery:**
- Message delivered exactly once — never lost, never duplicated.
- Extremely hard to implement correctly (requires distributed transactions).
- Kafka has an "exactly-once semantics" mode; most other systems don't.
- Use for: financial transactions (though idempotent at-least-once is often sufficient).

**Practical implication of at-least-once:**
```python
# ❌ Not idempotent — charging twice if the job is delivered twice
def charge_user(user_id: str, amount: float, payment_intent_id: str):
    stripe.PaymentIntent.confirm(payment_intent_id)
    db.create_charge(user_id=user_id, amount=amount)

# ✅ Idempotent — database constraint prevents duplicate charge
def charge_user(user_id: str, amount: float, payment_intent_id: str):
    # payment_intent_id is unique — second run hits the constraint and skips
    try:
        db.create_charge(
            user_id=user_id,
            amount=amount,
            payment_intent_id=payment_intent_id  # UNIQUE constraint
        )
    except IntegrityError:
        return  # already charged — idempotent no-op
```

---

## 19.3 Celery — Python's Standard Task Queue

Celery is a distributed task queue. Workers pick up tasks from a broker (Redis or RabbitMQ) and execute them asynchronously.

```
FastAPI App → [publish task to Redis] → Redis (broker)
                                              ↓
                                    Celery Worker 1
                                    Celery Worker 2
                                    Celery Worker 3
```

**Setup:**

```python
# celery_app.py
from celery import Celery

celery = Celery(
    "nativ",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/1",   # stores task results
)

celery.conf.task_serializer = "json"
celery.conf.result_serializer = "json"
celery.conf.accept_content = ["json"]
```

**Defining and calling tasks:**

```python
# tasks/embedding.py
from celery_app import celery
from sqlalchemy.orm import Session
from openai import OpenAI

@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,   # retry after 60s
    acks_late=True,           # acknowledge only after task completes (see below)
)
def generate_embeddings(self, vocab_item_id: str):
    try:
        client = OpenAI()
        with Session(engine) as db:
            item = db.get(VocabItem, vocab_item_id)
            response = client.embeddings.create(
                input=item.word,
                model="text-embedding-3-small"
            )
            item.embedding = response.data[0].embedding
            db.commit()
    except Exception as exc:
        raise self.retry(exc=exc)

# In FastAPI route — fire and forget
@app.post("/vocab/{item_id}/embed")
async def trigger_embedding(item_id: str):
    generate_embeddings.delay(item_id)  # enqueue — returns immediately
    return {"status": "embedding queued"}
```

**`acks_late=True`** — critical for reliability. By default, Celery acknowledges (removes) the task from the queue when a worker picks it up, not when it completes. If the worker crashes mid-task, the task is lost. `acks_late=True` delays acknowledgment until the task function returns successfully. If the worker crashes, the task stays in the queue and another worker picks it up.

---

## 19.4 Task Lifecycle and What Happens on Failure

```
Task states: PENDING → STARTED → SUCCESS
                              ↘ FAILURE → RETRY → STARTED → ...
                                                 ↘ FAILURE (max retries) → FAILED
```

**Dead letter queues (DLQ):** Tasks that exhaust all retries should go to a DLQ — a separate queue for failed messages. This lets you inspect, fix, and requeue them later rather than silently dropping them.

```python
@celery.task(
    max_retries=3,
    acks_late=True,
    reject_on_worker_lost=True,  # re-queue if worker dies unexpectedly
)
def process_pdf(pdf_id: str):
    # If this fails 3 times, Celery moves it to the failure state
    # Wire up a on_failure handler to send to DLQ
    ...

@process_pdf.on_failure.connect
def handle_failure(exc, task_id, args, kwargs, einfo):
    dead_letter_queue.publish({"task": "process_pdf", "args": args, "error": str(exc)})
```

---

## 19.5 Redis Streams — Lightweight Message Queue Without Celery

For simpler use cases, Redis Streams (`XADD`/`XREAD`) provide durable, consumer-group-aware messaging without the overhead of Celery.

```python
import redis.asyncio as redis

r = redis.Redis()

# Producer — add event to stream
await r.xadd("vocab:events", {
    "type": "item_created",
    "item_id": str(item.id),
    "user_id": str(user.id),
})

# Consumer — read from stream with consumer group
await r.xgroup_create("vocab:events", "embedding-workers", id="0", mkstream=True)

messages = await r.xreadgroup(
    groupname="embedding-workers",
    consumername="worker-1",
    streams={"vocab:events": ">"},   # ">" = undelivered messages
    count=10,
    block=5000,  # wait up to 5s for messages
)

for stream, entries in messages:
    for entry_id, fields in entries:
        await process_event(fields)
        await r.xack("vocab:events", "embedding-workers", entry_id)  # acknowledge
```

**Redis Streams vs Celery:**

| | Redis Streams | Celery |
|---|---|---|
| Dependency | Redis only | Redis/RabbitMQ + Celery workers |
| Retry logic | Manual | Built-in (`max_retries`, `retry`) |
| Task visibility | Manual (inspect stream) | Flower UI, result backend |
| Best for | Simple event processing, fan-out | Complex task workflows, retries |

---

## 19.6 Interview Answer Scripts

**Q: "When would you use a message queue instead of FastAPI's `BackgroundTasks`?"**

> "`BackgroundTasks` is in-process — it runs in the same process as the web server, after the response is sent. There's no persistence: if the server restarts, the task is lost. There's no retry mechanism. There's no way to scale workers independently. It's fine for fast, non-critical tasks — sending an analytics event, updating a cache after a user action. A message queue like Celery with Redis is necessary when the task is durable (must complete even if the server restarts), long-running (minutes, not seconds), needs retries on failure, or should scale independently from the web server. For Nativ, if I were processing uploaded documents for RAG indexing, that's a Celery task — it can take 30+ seconds, must complete even if the web process restarts, and needs retry logic if the OpenAI API is briefly unavailable."

**Q: "What is at-least-once delivery and why does it require idempotent consumers?"**

> "At-least-once delivery means the broker guarantees the message will be delivered, but it might be delivered more than once — due to network retries, worker crashes after processing but before acknowledgment, or broker failover. The consumer can't distinguish a legitimate second delivery from a duplicate. If the consumer's action has side effects — charging a credit card, sending an email, inserting a row — duplicates cause real problems. Idempotent means the operation produces the same result whether called once or ten times. The standard implementation: include an idempotency key in the message (a unique ID), and the consumer records it in the database on first success. On subsequent deliveries, it detects the key already exists and skips processing. Database unique constraints are the reliable enforcement mechanism."

**Q: "What does `acks_late=True` do in Celery and why is it important?"**

> "By default, Celery acknowledges the message — removes it from the broker queue — when a worker picks it up, not when it finishes. If the worker crashes halfway through, the task is permanently lost: the broker thinks it's been processed. `acks_late=True` changes this: the acknowledgment is sent only after the task function returns successfully. If the worker crashes, the broker still has the message and another worker picks it up. The tradeoff is that on crash-and-restart, you might process the same task twice — so your task must be idempotent. For anything where losing a task is worse than processing it twice (generating embeddings, sending critical notifications), `acks_late=True` is the correct setting."

**Q: "How would you design a background embedding pipeline for a RAG system?"**

> "The pattern: decouple the user-facing write from the slow embedding work. When a user adds a vocabulary item, insert the item into the database immediately and return success — the item exists, but `embedding_status = 'pending'`. Enqueue a Celery task `generate_embedding(item_id)`. The worker picks up the task, calls the embedding API, stores the vector in pgvector, and sets `embedding_status = 'complete'`. The user can use the item immediately for browsing; semantic search becomes available once embedding is done. Handle failures: if the OpenAI API is down, the task fails and retries with exponential backoff. Set `acks_late=True` on the worker — if it crashes mid-embedding, the task is retried. Track `embedding_status` in the UI so users see 'indexing...' rather than a silent failure. This design keeps the write path fast and the embedding path reliable."

> **Nativ connection:** Nativ uses this pattern for vocabulary embedding. Items are stored synchronously; the embedding job runs asynchronously. The vocabulary limit check happens synchronously (with SELECT FOR UPDATE as in §18) to prevent quota races, while the expensive OpenAI API call is off the critical path.

---

## 19.7 Self-Tests

Try answering these before looking at the answers.

1. Your Celery task sends an email. `acks_late=True` is set. The worker sends the email successfully, then crashes before acknowledging. The broker redelivers the task. What happens and how do you prevent the duplicate?
2. You want to fan out a "new vocab item" event to 3 different downstream services: the embedding service, the notification service, and the analytics service. How would you design this with a message queue?
3. Your Celery task has `max_retries=3` and `default_retry_delay=60`. The underlying API is down for 10 minutes. What happens and what would you change?
4. You're inspecting failed Celery tasks and realize all failures are for the same user ID. The task is trying to fetch the user from the database, but the user was deleted. Retrying will never succeed. What's the pattern to handle this?
5. A Redis Stream consumer crashes after processing a message but before calling `XACK`. What happens to the message?

<details>
<summary>Answers</summary>

1. The email is sent twice. `acks_late=True` protects against task loss but not against duplicate side effects. Fix: make the email-sending operation idempotent. Option 1: store a sent-notification record in the database with a unique constraint on `(user_id, notification_type, task_id)` — the second send attempt hits the constraint and returns early. Option 2: use an email provider that accepts an idempotency key (SendGrid has this). Option 3: for user-visible notifications, use a database flag (`email_sent_at`) and check before sending. The right approach depends on how critical avoiding duplicates is — for low-stakes emails, `acks_late` without idempotency is often acceptable.

2. Use a **fan-out** pattern: publish the event once to a topic/exchange, and each service subscribes independently. With RabbitMQ: use a fanout exchange — the producer publishes once, and each consumer (embedding, notification, analytics) has its own queue bound to the exchange. Each consumer receives every message independently. With Redis Streams: a single stream, three consumer groups. Each group tracks its own position — `XREADGROUP` with `>` (undelivered to this group). A message is only acknowledged per group, so all three services must acknowledge independently. With a simple Redis pub/sub: fire-and-forget fan-out (no durability — if a service is down when the message is published, it misses it). Use consumer groups for durability.

3. With `max_retries=3` and `delay=60s`, the task retries at T+60s, T+120s, T+180s. After 3 failures (at T+180s), it enters the FAILURE state permanently. A 10-minute outage means the task exhausts retries and is lost. Fix: use exponential backoff — `retry(exc=exc, countdown=2**self.request.retries * 60)` — retry at 60s, 120s, 240s, giving more time for the API to recover. Also consider longer `max_retries` or a celery beat task that re-queues items from the DLQ after a longer cooldown.

4. Use **non-retryable error handling**. Not all failures should be retried — a missing user is a permanent failure, not a transient one. Pattern: wrap the task in try/except, catch specific exceptions that indicate permanent failure (UserNotFound, ResourceDeleted), and do not call `self.retry()` — let the task fail immediately with a meaningful error. Log the failure with context. This prevents wasting retries on hopeless tasks and fills the retry queue with recoverable failures only. Add a check at the top: `if not db.get(User, user_id): logger.warning("User deleted, skipping task"); return`.

5. The message remains in a "pending entries list" (PEL) for the consumer group — it was delivered but not acknowledged. When the consumer restarts, it can recover by reading pending messages: `XREADGROUP ... streams {"vocab:events": "0"}` (not ">") returns all unacknowledged messages for this consumer. The consumer processes and acknowledges them before switching to `">"` for new messages. This is Redis Streams' durability mechanism — messages aren't deleted from the PEL until explicitly acknowledged. You can also use `XPENDING` to inspect pending messages and `XCLAIM` to reassign stuck messages to a different consumer (useful if the original consumer is dead and won't restart).

</details>

---

← Back to [18. Concurrency & Race Conditions](18-concurrency.md) | Next → [20. Microservices vs Monolith](20-microservices.md)
