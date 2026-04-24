# 18. Concurrency & Race Conditions

### Why This Section Matters

Race conditions are production bugs that don't show up in tests, don't reproduce locally, and often manifest only under load. Understanding how they happen — and how to prevent them with database-level locking, atomic operations, and correct transaction design — is a mark of production experience.

At AI startups, race conditions often appear in exactly the places you'd expect: user limits (e.g., vocabulary count quotas), idempotent payment processing, and concurrent session management.

**What interviewers actually probe:**
- What is a race condition and can you give a concrete example?
- What's the difference between optimistic and pessimistic locking?
- How do you prevent double-charging in a payment system?
- When would you use `SELECT FOR UPDATE`?

---

## 18.1 What a Race Condition Is

A race condition occurs when the correctness of a program depends on the order or timing of concurrent operations — and that order isn't guaranteed.

**Classic example — double spend:**

```
User has balance: $100
Thread A reads balance: $100
Thread B reads balance: $100
Thread A: $100 - $80 = $20 → writes $20
Thread B: $100 - $80 = $20 → writes $20
Final balance: $20 (should have failed — not enough for both)
```

The bug: both threads read the same initial value before either writes back. The fix requires making the read + check + write atomic.

**In a web application (non-financial):**

```python
# ❌ Race condition — two requests can both see quota_used = 499 and both add a vocab item
async def add_vocab_item(user_id: str, item: VocabItemCreate, db: AsyncSession):
    user = await db.get(User, user_id)
    if user.vocab_count >= user.vocab_limit:
        raise HTTPException(429, "Vocabulary limit reached")
    # RACE: another request can pass this check simultaneously
    new_item = VocabItem(**item.model_dump(), user_id=user_id)
    db.add(new_item)
    user.vocab_count += 1
    await db.commit()
```

---

## 18.2 Optimistic vs Pessimistic Locking

Two strategies for preventing race conditions:

**Pessimistic locking** — lock the row before reading. No other transaction can read or write the locked row until you commit.

```python
# SELECT FOR UPDATE — locks the row for the duration of the transaction
async def add_vocab_item_safe(user_id: str, item: VocabItemCreate, db: AsyncSession):
    # Lock the user row — other transactions block until this one commits
    stmt = select(User).where(User.id == user_id).with_for_update()
    user = (await db.execute(stmt)).scalar_one()

    if user.vocab_count >= user.vocab_limit:
        raise HTTPException(429)

    new_item = VocabItem(**item.model_dump(), user_id=user_id)
    db.add(new_item)
    user.vocab_count += 1
    await db.commit()
    # Lock released here — concurrent request can now proceed (and will see updated count)
```

**`SELECT FOR UPDATE` variants:**
- `FOR UPDATE` — exclusive lock. Other `SELECT FOR UPDATE` queries block.
- `FOR UPDATE SKIP LOCKED` — skip rows that are already locked. Used for job queues.
- `FOR SHARE` — shared lock. Other readers don't block, but writers do.

**Optimistic locking** — don't lock upfront. Instead, check at write time that nothing changed since you read.

```python
# Version field approach — add `version: int` column to the model
async def update_user_optimistic(user_id: str, new_name: str, db: AsyncSession):
    user = await db.get(User, user_id)
    original_version = user.version

    user.name = new_name
    user.version += 1

    # UPDATE only if version hasn't changed — atomic check-and-update
    result = await db.execute(
        update(User)
        .where(User.id == user_id, User.version == original_version)
        .values(name=new_name, version=original_version + 1)
    )

    if result.rowcount == 0:
        raise ConflictError("Record was modified by another request — retry")

    await db.commit()
```

**When to use each:**

| | Pessimistic | Optimistic |
|---|---|---|
| Conflict rate | High — many concurrent writers | Low — conflicts are rare |
| Contention cost | High blocking under load | Retry cost only on actual conflict |
| Complexity | Simpler logic, risk of deadlock | Retry logic required |
| Best for | Payment processing, seat reservation | User profile updates, low-conflict edits |

---

## 18.3 Database-Level Atomic Operations

Some operations can be made atomic at the SQL level, avoiding the need for application-level locking.

```sql
-- ❌ Application-level: read → check → write (three round trips, race-prone)
SELECT vocab_count FROM users WHERE id = $1;
-- application checks if vocab_count < vocab_limit
UPDATE users SET vocab_count = vocab_count + 1 WHERE id = $1;

-- ✅ Single atomic UPDATE with CHECK
UPDATE users
SET vocab_count = vocab_count + 1
WHERE id = $1
  AND vocab_count < vocab_limit
RETURNING vocab_count, vocab_limit;
-- If 0 rows affected: limit was reached (or concurrent request won)
```

In SQLAlchemy:

```python
from sqlalchemy import update, case

async def increment_vocab_count(user_id: str, db: AsyncSession) -> bool:
    result = await db.execute(
        update(User)
        .where(User.id == user_id, User.vocab_count < User.vocab_limit)
        .values(vocab_count=User.vocab_count + 1)
        .returning(User.vocab_count)
    )
    await db.commit()
    return result.scalar_one_or_none() is not None  # False if limit was hit
```

This is a single round trip to the database, atomic at the database level, and race-free.

---

## 18.4 Distributed Locks with Redis

When you need cross-process coordination that the database isn't the right tool for:

```python
async def process_webhook(event_id: str, redis: Redis, db: AsyncSession):
    lock_key = f"webhook:processing:{event_id}"

    # Acquire lock with NX (only if not exists) and EX (expiry — prevent deadlock)
    acquired = await redis.set(lock_key, "1", nx=True, ex=30)

    if not acquired:
        # Another instance is processing this event — skip (idempotent)
        return {"status": "already_processing"}

    try:
        await handle_webhook(event_id, db)
        await db.commit()
    finally:
        await redis.delete(lock_key)   # release lock even on error
```

**Redlock — distributed lock across multiple Redis instances:**
For high-availability scenarios, the Redlock algorithm acquires the lock from a majority (N/2 + 1) of N independent Redis instances. If a single Redis node fails, the lock is still valid if the majority granted it.

**Caveat with Redis locks:** Redis locks are not perfectly safe — if a process acquires a lock, then pauses (GC pause, VM migration), the lock may expire while the process is still "holding" it. Another process acquires the lock. Both processes now believe they hold the lock. This is acceptable for advisory locks (best-effort deduplication), but not for hard safety invariants. For those, use database transactions with `SELECT FOR UPDATE`.

---

## 18.5 Common Concurrency Patterns

**Idempotent operations with unique constraints:**

```sql
-- Database enforces uniqueness — concurrent inserts, only one succeeds
CREATE UNIQUE INDEX ON payments(idempotency_key);

INSERT INTO payments (idempotency_key, amount, user_id)
VALUES ($1, $2, $3)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING *;
-- Returns the row if inserted, empty if idempotency_key already existed
```

**Check-then-act pattern — always do it at the DB level:**

```python
# ❌ Check then act in application — race between check and act
if not await email_exists(email, db):
    await create_user(email, db)

# ✅ Let the database enforce uniqueness
try:
    user = User(email=email)
    db.add(user)
    await db.commit()
except IntegrityError:
    raise HTTPException(409, "Email already registered")
```

---

## 18.6 Interview Answer Scripts

**Q: "What is a race condition and how do you prevent it in a web API?"**

> "A race condition happens when two concurrent requests depend on reading and then modifying the same data, and their reads happen before either write completes. The classic example is a quota check: request A reads 'vocab count = 499', request B reads 'vocab count = 499', both check against the limit of 500 and pass, both insert a new vocab item, and now the count is 501 — over the limit. Prevention depends on the conflict rate. For frequent conflicts, pessimistic locking: `SELECT FOR UPDATE` locks the row before reading, so request B blocks until request A commits and sees the updated count. For rare conflicts, optimistic locking: include a version field, and the UPDATE only succeeds if the version matches what you read — if not, you retry. For some cases, you can move the logic entirely into an atomic SQL UPDATE with a WHERE clause that checks the constraint — no application-level lock needed, one round trip."

**Q: "What's the difference between `SELECT FOR UPDATE` and a transaction?"**

> "A regular transaction provides atomicity and isolation, but it doesn't prevent concurrent reads. Two transactions can both read the same row simultaneously — the isolation level determines whether they see each other's uncommitted data, but under READ COMMITTED (the PostgreSQL default), both transactions read the committed state at the start of each statement. `SELECT FOR UPDATE` adds an explicit row-level lock: the row is locked until the transaction commits, and any other `SELECT FOR UPDATE` for the same row blocks. It's a mechanism within a transaction, not a replacement. A transaction wrapping `SELECT FOR UPDATE` gives you: atomic execution + protection against concurrent modification of the locked rows. You still need the transaction — without it, the lock is released immediately after the SELECT."

**Q: "How do you make a payment API idempotent?"**

> "Idempotency means calling the API multiple times with the same input has the same effect as calling it once. For payments, the pattern is: require the client to send an `Idempotency-Key` header with a unique UUID per payment attempt. The server stores the key and response after the first successful processing. On subsequent requests with the same key, return the stored response without reprocessing. The storage is typically a database table with a unique constraint on `idempotency_key`. The concurrent safety comes from database uniqueness: two simultaneous requests with the same key will both try to INSERT, exactly one will succeed, and the other will hit the unique constraint and wait or retry. The key must be scoped to a user: `(user_id, idempotency_key)` as the unique pair, so keys don't collide across users."

**Q: "How would you implement a per-user concurrent request limit for LLM generation?"**

> "This is a rate-limiting problem that needs cross-process coordination — a database lock per request would add too much latency, so Redis is the right tool. Pattern: a Redis counter per user tracking active generation requests. When a request starts: `INCR concurrent:{user_id}` and check if the result exceeds the limit (e.g., 3). If it does, reject with 429 immediately. In a try/finally block, `DECR concurrent:{user_id}` when the request completes — whether it succeeded or failed. Set a TTL on the key as a safety net in case a server crash causes a leaked counter. The Redis `INCR` is atomic — no race condition. In Nativ, I use this for the vocabulary explanation generation endpoint: users can have at most 2 concurrent LLM calls, preventing one session from monopolizing the API quota. The counter key resets via TTL if a worker dies mid-request."

> **Nativ connection:** The vocabulary quota enforcement in Nativ (max N items per user plan) is exactly this pattern — the atomic SQL UPDATE with WHERE clause prevents race conditions where two simultaneous requests both see `vocab_count < limit` and both insert an item.

---

## 18.7 Self-Tests

Try answering these before looking at the answers.

1. You use `SELECT FOR UPDATE` on a user row and a vocab items row in two different transactions, but in opposite order. What can go wrong?
2. Your API has a Redis lock with a 10-second TTL. A request acquires the lock, then a CPU-heavy operation takes 15 seconds. What happens?
3. You want to limit each user to 3 concurrent AI generation requests. How would you implement this without a database lock on every request?
4. Two users try to book the last available seat simultaneously. Your system uses optimistic locking with a version field. Walk through what happens.
5. A colleague suggests using `READ UNCOMMITTED` isolation to speed up reporting queries. What's the risk?

<details>
<summary>Answers</summary>

1. **Deadlock.** Transaction A locks user row, then waits for vocab row. Transaction B locks vocab row, then waits for user row. Each waits for the other — neither can proceed. PostgreSQL detects the deadlock, chooses one transaction as the victim, rolls it back, and lets the other proceed. The rolled-back transaction throws a `DeadlockDetected` error. Fix: always acquire locks in the same order across all code paths. If you lock user before vocab in one place, lock them in the same order everywhere. PostgreSQL's deadlock detection handles it when it happens, but it's better to prevent it.

2. The lock expires after 10 seconds. Another process (or the same process on retry) acquires the lock at second 10. At second 15, the original process finishes, deletes the lock key, and returns success. But now the second process also holds the lock and is doing the same work. Both processes completed the operation concurrently — exactly the race condition you were trying to prevent. Fix: use a lock token (the SET value should be a UUID, not "1"), and only delete the lock if you own it: `if redis.get(lock_key) == my_token: redis.delete(lock_key)`. This prevents the original from deleting the second process's lock. The underlying issue — work duration exceeds TTL — should be fixed by either extending the TTL to be safely longer than the maximum work duration, or using lock extension (refreshing TTL while the work is in progress).

3. Use a Redis counter per user. On request start: `INCR rate:{user_id}:concurrent`, with `EXPIRE rate:{user_id}:concurrent 60`. If the counter exceeds 3, reject with 429. On request end (in a try/finally): `DECR`. The atomicity of Redis `INCR` prevents race conditions. A database approach would require a `SELECT FOR UPDATE` on a user concurrency row per request — higher latency, worse for this use case. Be careful about the finally block: if the server crashes mid-request, the counter is stuck until the TTL expires. The TTL is a safety net.

4. User A reads seat row (version=1). User B reads seat row (version=1). User A's UPDATE runs: `WHERE version=1 AND seat_available=true SET version=2, available=false` — succeeds (1 row affected). User B's UPDATE runs: `WHERE version=1 AND seat_available=true` — fails (0 rows affected, version is now 2). User B receives a conflict error. User B retries: reads the row again (version=2, available=false), confirms the seat is gone, and returns "no seats available." Optimistic locking works well here because double-booking is rare and the retry is fast — just a re-read.

5. `READ UNCOMMITTED` allows **dirty reads** — reading uncommitted data from other transactions. If transaction A is updating rows and hasn't committed yet, a `READ UNCOMMITTED` query sees those partially-updated rows. If A then rolls back, the reporting query already read data that "never existed." This can produce incorrect totals, negative inventory counts, and logically inconsistent results. PostgreSQL doesn't actually implement `READ UNCOMMITTED` — it treats it as `READ COMMITTED` for safety. For fast reporting queries, use `READ COMMITTED` (the default) or consider a read replica with slightly stale but consistent data.

</details>

---

← Back to [17. Streaming (SSE / WebSocket)](17-streaming.md) | Next → [19. Message Queues & Async Jobs](19-message-queues.md)
