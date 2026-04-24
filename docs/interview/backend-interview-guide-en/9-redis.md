# 9. Redis & Caching

### Why This Section Matters

Redis shows up in almost every backend system: caching, session storage, rate limiting, distributed locks, pub/sub, queues. Interviewers use Redis questions to test whether you understand the tradeoffs of caching (what to cache, when to invalidate, what happens when the cache is wrong) and whether you know common distributed patterns.

**What interviewers actually probe:**
- What's a cache stampede and how do you prevent it?
- When would you use Redis vs in-memory cache vs the database directly?
- How do you implement a distributed rate limiter in Redis?
- What are the tradeoffs of Redis as a session store?

---

## 9.1 Redis Data Structures and Their Use Cases

Redis is not just a key-value store — its data structures are what make it versatile.

| Structure | Commands | Use case |
|-----------|---------|---------|
| String | `GET`, `SET`, `INCR`, `SETEX` | Simple cache values, counters, feature flags |
| Hash | `HGET`, `HSET`, `HMGET` | User session data, object fields |
| List | `LPUSH`, `RPOP`, `LRANGE` | Queues (FIFO with RPUSH/LPOP), recent activity |
| Set | `SADD`, `SISMEMBER`, `SUNION` | Tag systems, online users, deduplication |
| Sorted Set | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE` | Leaderboards, rate limiting, priority queues |
| Stream | `XADD`, `XREAD` | Event log, message queue with consumer groups |

---

## 9.2 Caching Patterns — Read-Through, Write-Through, Write-Behind

**Cache-aside (most common):** Application code manages the cache manually.

```python
async def get_user(user_id: str, db: AsyncSession, redis: Redis) -> User:
    cached = await redis.get(f"user:{user_id}")
    if cached:
        return UserSchema.model_validate_json(cached)

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)

    await redis.setex(f"user:{user_id}", 300, user.model_dump_json())  # TTL 5min
    return user
```

**Write-through:** Write to cache and database simultaneously. Cache is always consistent with the database. Adds write latency (two writes per update).

**Write-behind (write-back):** Write to cache, then asynchronously flush to database. Very low write latency, but risk of data loss if Redis crashes before flush. Used for high-frequency, loss-tolerant writes (view counts, activity logs).

**Cache invalidation — the hard part:**

Three strategies:
1. **TTL-based:** Set an expiry and accept eventual consistency. Simple; cache may serve stale data for up to TTL seconds.
2. **Event-driven:** Invalidate (delete) the cache key when the underlying data changes. Consistent, but adds complexity — every write must also invalidate.
3. **Cache-busting keys:** Include a version in the key (`user:123:v2`). Old version is naturally evicted; new data gets a fresh key. Works well with immutable data.

```python
# Event-driven invalidation
async def update_user(user_id: str, data: UserUpdate, db: AsyncSession, redis: Redis):
    user = await db.get(User, user_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await db.commit()
    await redis.delete(f"user:{user_id}")   # invalidate cache after write
```

---

## 9.3 Cache Stampede (Thundering Herd)

A cache stampede happens when a popular cached key expires and many requests simultaneously find a cache miss, all racing to query the database and repopulate the cache.

```
T=0: 1000 requests/sec hit cache key "popular_list"
T=1: TTL expires → cache miss
T=1: All 1000 in-flight requests simultaneously hit the DB
     → DB overwhelmed, timeouts, cascading failure
```

**Prevention — probabilistic early expiration (jitter):**

```python
import random

async def get_with_jitter(redis, key, ttl_base=300):
    cached = await redis.get(key)
    if cached:
        remaining_ttl = await redis.ttl(key)
        # Randomly recompute early to avoid cliff edge expiration
        if remaining_ttl < ttl_base * 0.1 and random.random() < 0.1:
            return None  # force recompute for 10% of requests near expiry
        return cached
    return None
```

**Prevention — mutex lock (single-flight):**

```python
async def get_or_compute(redis, db, key: str):
    cached = await redis.get(key)
    if cached:
        return cached

    lock_key = f"lock:{key}"
    acquired = await redis.set(lock_key, "1", nx=True, ex=10)  # NX = only if not exists
    if acquired:
        try:
            value = await expensive_db_query(db)
            await redis.setex(key, 300, value)
            return value
        finally:
            await redis.delete(lock_key)
    else:
        # Another process is computing — wait briefly and retry
        await asyncio.sleep(0.1)
        return await redis.get(key)   # should be populated now
```

---

## 9.4 Distributed Rate Limiting

A sliding window rate limiter using Redis Sorted Sets — counts requests per user in the last N seconds:

```python
import time

async def is_rate_limited(redis: Redis, user_id: str, limit: int, window: int) -> bool:
    key = f"rate:{user_id}"
    now = time.time()
    window_start = now - window

    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, window_start)    # remove old requests
    pipe.zadd(key, {str(now): now})                 # add current request
    pipe.zcard(key)                                 # count requests in window
    pipe.expire(key, window)                        # reset expiry

    results = await pipe.execute()
    request_count = results[2]
    return request_count > limit

# Usage in FastAPI middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    user_id = get_user_id_from_request(request)
    if await is_rate_limited(redis, user_id, limit=100, window=60):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"},
            headers={"Retry-After": "60"},
        )
    return await call_next(request)
```

Using a pipeline (`pipe.execute()`) sends all commands in one round trip — crucial for rate limiting where every millisecond counts.

---

## 9.5 Redis as Session Store

Storing sessions in Redis instead of the database has real advantages:

- **Fast reads:** Redis O(1) vs database index lookup
- **Automatic expiry:** TTL-based session expiration with no cleanup job
- **Horizontal scaling:** All app instances share the same session store

```python
import secrets
from fastapi import Cookie

async def create_session(user_id: str, redis: Redis) -> str:
    session_id = secrets.token_urlsafe(32)
    await redis.setex(
        f"session:{session_id}",
        86400,                              # 24 hour TTL
        json.dumps({"user_id": user_id}),
    )
    return session_id

async def get_session(session_id: str = Cookie(None), redis: Redis = Depends(get_redis)):
    if not session_id:
        raise HTTPException(401)
    data = await redis.get(f"session:{session_id}")
    if not data:
        raise HTTPException(401, "Session expired")
    return json.loads(data)
```

**Tradeoff vs JWT:** Redis sessions are revocable (delete the key = immediate logout) and can store server-side state. JWTs are stateless (no DB lookup) but can't be revoked before expiry without a blocklist. Choose Redis sessions when revocation matters; JWTs when statelessness and horizontal scaling without a shared store matters.

---

## 9.6 Interview Answer Scripts

**Q: "What's a cache stampede and how do you prevent it?"**

> "A cache stampede — also called thundering herd — happens when a popular cache key expires and many concurrent requests all find a miss simultaneously, all racing to recompute the value and write it back to the cache. If the recomputation is expensive, the database gets hit by hundreds of requests at once. Prevention comes in two forms. The simpler one is probabilistic early expiration: as the TTL approaches zero, a small percentage of requests proactively recompute the cache, spreading the load before the key expires. The more reliable one is a mutex lock: the first request to see a cache miss acquires a Redis lock with `SET NX`, does the computation, and populates the cache. Other requests that see the miss find the lock already held and either wait briefly or return a slightly stale response. The lock must have an expiry to prevent deadlock if the holder crashes."

**Q: "When would you use Redis for rate limiting instead of just a database counter?"**

> "Rate limiting needs to be fast — it's on the hot path of every request. A database counter means a SQL query per request, and under load that becomes a bottleneck. Redis serves in-memory at microsecond latency, and it has atomic operations like `INCR` and sorted set commands that are perfect for rate limiting. The sliding window pattern uses a sorted set: add the current timestamp, remove entries older than the window, count what's left. All three operations run in a single pipeline — one network round trip. A database would need either a row per request (expensive) or a counter with manual window management (complex and still slower). The downside of Redis: it's not durable by default — a crash can lose rate limiting state. That's usually acceptable for rate limiting, but not for financial counters."

**Q: "What are the tradeoffs of Redis sessions vs JWTs?"**

> "The core tradeoff is revocation vs statelessness. Redis sessions are server-side: you can invalidate a session instantly by deleting the key — useful for logout, account bans, or security responses. The cost is that every request requires a Redis lookup. JWTs are stateless: verification is a cryptographic operation with no network call — faster and naturally horizontally scalable. But a JWT is valid until it expires; you can't revoke it without maintaining a blocklist (which re-adds the server-side state). My rule: use JWTs when the access window is short (15 minutes) and you can tolerate the expiry window for revocation. Use Redis sessions when you need instant revocation — admin panels, financial services, anything where a compromised account must be locked out immediately."

**Q: "How would you cache the results of a slow database query in Redis?"**

> "Cache-aside pattern — the application manages the cache explicitly. On a request: check Redis first with `GET cache:{key}`. If hit, deserialize and return. If miss, query the database, serialize the result, store in Redis with a TTL (`SET cache:{key} {value} EX 300`), and return. The serialization format matters: JSON for simple structures, msgpack for binary efficiency. Key design is important: make cache keys deterministic and specific enough to avoid collisions. For Nativ's vocabulary search, the cache key is a hash of `(user_id, query, filters)` — two users with the same query get separate cache entries because vocabulary is user-scoped. The TTL is the critical dial: too short and the cache doesn't help; too long and users see stale data. For Nativ vocabulary, 5 minutes is reasonable — items don't change that often. For user session counts or rate limiting, TTL must match the business window."

> **Nativ connection:** Redis provides Nativ's rate limiting (per-user API call limits), session caching, and optionally vocabulary query caching. The distributed lock pattern from §18 is also Redis-backed in Nativ's webhook processing.

---

## 9.7 Self-Tests

Try answering these before looking at the answers.

1. You cache a user's profile with a 5-minute TTL. The user updates their email. What cache strategy prevents them from seeing their old email for up to 5 minutes?
2. Your rate limiter uses `INCR` on a key with a 60-second expiry. Two requests arrive within 1ms of each other. Is there a race condition? Why or why not?
3. You're storing user sessions in Redis with a 24-hour TTL. A user logs in from 5 devices. When they click "Log out all devices," how does your implementation handle this?
4. Redis runs out of memory. Your `maxmemory-policy` is `allkeys-lru`. What happens to your rate limiting counters?
5. You store a JSON object in Redis as a string (`SET user:123 "{...json...}"`). A colleague suggests using a Hash (`HSET user:123 name "Alice" email "..."`) instead. What are the tradeoffs?

<details>
<summary>Answers</summary>

1. **Event-driven invalidation** — delete the cache key immediately when the update happens. In the update handler: `await redis.delete(f"user:{user_id}")` after committing the DB change. The next request finds a cache miss, queries the DB (which has the new email), and repopulates the cache. TTL-based expiry alone would serve the old email for up to 5 minutes. Alternatively, write-through: update the cache at the same time as the DB — consistent but requires coordinating two writes. Delete-on-write is simpler and safe.

2. **No race condition.** Redis is single-threaded for command execution — commands are processed serially. `INCR` is an atomic operation in Redis. Even with concurrent connections, two `INCR` commands are executed one after the other, and each correctly increments the counter. This is one of Redis's core strengths for counters and rate limiting. The race condition concern would apply with a read-modify-write pattern in application code (`GET → increment in Python → SET`) — that's not atomic. `INCR` is.

3. You need a way to enumerate and revoke all sessions for a user. Options: (a) **Session set per user** — maintain a Redis set `sessions:{user_id}` that stores all session IDs. On logout-all, iterate and delete each session key, then delete the set. (b) **User generation counter** — store a `generation:{user_id}` counter in Redis. Each session token includes the generation at creation time. On each request, verify the session's generation matches current. On logout-all, increment the generation — all old tokens instantly invalid. Option (b) is more scalable (one counter vs N set entries) but requires storing the generation in the JWT/session token.

4. With `allkeys-lru`, Redis evicts the least recently used keys across all keys when memory is full. Your rate limiting counters may be evicted if they haven't been accessed recently (e.g., inactive users). This means an inactive user's counter resets — they could make requests that should have been blocked if the counter was retained. For rate limiting, this is usually acceptable (the worst case is a user gets an extra window of requests after inactivity). If exact enforcement matters, use `volatile-lru` (only evict keys with TTLs set) and ensure your rate limit keys always have TTLs. Critical data (session tokens, auth state) should never share a Redis instance with ephemeral cache data for this reason.

5. **String (JSON):** Single GET/SET operation, simple implementation. To update one field (e.g., name), you must GET the full JSON, parse it, modify, re-serialize, SET it back — two operations, potential race condition without locking. Network payload is the full JSON even when you only need one field.  **Hash:** `HGET user:123 name` fetches only the needed field. `HSET user:123 name "Bob"` updates atomically without reading the whole object. More memory-efficient for objects with many fields (Redis optimizes small hashes). Downside: doesn't support nested objects natively; nested JSON must be flattened or stored as a string field. Choose Hash when you frequently update individual fields; choose String (JSON) when you always read and write the full object.

</details>

---

← Back to [8. pgvector](8-pgvector.md) | Next → [10. Python Internals](10-python-internals.md)
