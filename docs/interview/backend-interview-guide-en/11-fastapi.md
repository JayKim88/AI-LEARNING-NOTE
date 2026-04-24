# 11. FastAPI Advanced

### Why This Section Matters

FastAPI is Nativ's backend framework — every answer about Nativ's architecture connects here. Beyond syntax, interviewers probe whether you understand *why* FastAPI's design decisions work: why `Depends` guarantees cleanup, why `async def` matters, and when to use `BackgroundTasks` vs Celery.

**What interviewers actually probe:**
- How does `Depends` with `yield` guarantee teardown?
- When would you use `BackgroundTasks` vs a message queue like Celery?
- How does FastAPI handle validation, and what happens when a request fails validation?
- What's the difference between middleware and a dependency?

---

## 11.1 Dependency Injection — `Depends` and `yield`

FastAPI's `Depends` system handles setup and teardown for shared resources: database sessions, Redis connections, authenticated users.

**Without `yield` — no teardown guarantee:**

```python
# ❌ If the route raises, the session is never closed
def get_db():
    return SessionLocal()

@app.get("/users")
async def get_users(db = Depends(get_db)):
    raise ValueError("something broke")
    # db is never closed — connection leaked
```

**With `yield` — teardown always runs:**

```python
# ✅ Finally block runs even if the route raises
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session           # route handler gets the session here
            await session.commit()  # only reached if no exception
        except Exception:
            await session.rollback()
            raise
        # session.close() called by context manager

@app.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

FastAPI wraps the route call in a generator context — everything before `yield` runs before the handler, everything after runs after (always, like a `finally` block).

**Dependency chaining:**

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = verify_jwt(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401)
    return user

# Route depends on get_current_user, which depends on get_db and oauth2_scheme
@app.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    return user
```

FastAPI resolves the dependency graph automatically, shares dependencies across the request when `use_cache=True` (default), and ensures all `yield` dependencies are cleaned up in reverse order.

---

## 11.2 Request Validation — Pydantic Integration

FastAPI uses Pydantic to validate request bodies, query params, path params, and headers automatically. Invalid input returns a `422 Unprocessable Entity` with a structured error response.

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal

class CreateVocabItem(BaseModel):
    word: str = Field(min_length=1, max_length=100)
    language: Literal["de", "fr", "es", "ja"] = Field(description="ISO 639-1 code")
    difficulty: int = Field(ge=1, le=5)

    @field_validator("word")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

@app.post("/vocab", status_code=201)
async def create_vocab(
    item: CreateVocabItem,                           # body — validated via Pydantic
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ...
```

**What FastAPI validates automatically:**
- Request body: JSON parsed and validated against the Pydantic model
- Path parameters: `@app.get("/users/{user_id}")` — `user_id` is validated and type-converted
- Query parameters: `?limit=20` — type-converted and validated
- Headers: `Header(alias="X-API-Key")` — validated presence and format

**422 response structure:**

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "word"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

---

## 11.3 `async def` vs `def` — FastAPI's Threading Model

FastAPI runs on `uvicorn` (an ASGI server), which runs an asyncio event loop.

- **`async def` routes** — run directly on the event loop thread. Never call blocking code.
- **`def` routes** — FastAPI automatically runs them in a thread pool (`anyio` worker threads). Blocking code is safe.

```python
import time
import asyncio

# ❌ Blocks the event loop — freezes all other requests
@app.get("/blocking-async")
async def blocking():
    time.sleep(2)                    # synchronous sleep in async context
    return {"status": "done"}

# ✅ FastAPI runs this in a thread pool — event loop stays free
@app.get("/blocking-sync")
def sync_blocking():
    time.sleep(2)                    # fine here
    return {"status": "done"}

# ✅ Explicitly offload blocking work
@app.get("/cpu-heavy")
async def cpu_heavy():
    result = await asyncio.get_event_loop().run_in_executor(
        None, heavy_computation, input_data
    )
    return {"result": result}
```

---

## 11.4 BackgroundTasks vs Celery

FastAPI has a built-in `BackgroundTasks` for fire-and-forget work after a response is sent.

```python
from fastapi import BackgroundTasks

def send_welcome_email(email: str):     # runs after response is returned
    # send email via SMTP or API
    ...

@app.post("/users", status_code=201)
async def create_user(
    data: CreateUser,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    user = User(**data.model_dump())
    db.add(user)
    await db.commit()

    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

**When `BackgroundTasks` is enough:**
- The task is fast (< a few seconds)
- The task can be lost if the process restarts (non-critical: email send, analytics event)
- You don't need retry logic

**When you need Celery (or a message queue):**
- The task can take minutes (video processing, large ML batch)
- The task must be retried on failure (payment webhook, critical notification)
- The task must survive process restarts
- You need to scale workers independently from the web process
- You need visibility into task status (running, completed, failed)

```
BackgroundTasks: "send analytics event after user signup"
Celery:          "process uploaded PDF for RAG indexing — must succeed, may take 60s"
```

---

## 11.5 Middleware vs Dependency

Both run on every request, but at different layers.

**Middleware** wraps the entire ASGI app — runs before routing, sees raw request/response:

```python
import time
from starlette.middleware.base import BaseHTTPMiddleware

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        response.headers["X-Process-Time"] = str(duration)
        return response

app.add_middleware(RequestTimingMiddleware)
```

**Dependency** runs inside routing — has access to path params, Pydantic-validated data, and other dependencies:

```python
# Dependency: has access to validated user_id, other deps
async def verify_ownership(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VocabItem:
    item = await db.get(VocabItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(403)
    return item
```

**When to use each:**

| Use middleware for | Use dependency for |
|-------------------|--------------------|
| Request logging, timing | Authentication, authorization |
| Rate limiting (all routes) | Per-route ownership checks |
| CORS, compression | Database session management |
| Adding response headers globally | Request-level caching |

---

## 11.6 Interview Answer Scripts

**Q: "How does FastAPI's `Depends` with `yield` guarantee cleanup?"**

> "FastAPI's dependency injection wraps the route handler call in a generator context — similar to a context manager. When a dependency uses `yield`, everything before the yield is setup (runs before the handler), and everything after is teardown (runs after the handler returns, or raises). The teardown is guaranteed — FastAPI ensures it runs even if the handler throws an exception, equivalent to a try/finally block. This is how database session cleanup works: the session is created before the handler, yielded to it, and committed or rolled back after. Without yield, you'd have to put try/finally in every route handler — yield centralizes that in the dependency."

**Q: "When would you use `BackgroundTasks` vs Celery?"**

> "BackgroundTasks is in-process — the task runs in the same process as the web server, after the response is sent. It's appropriate for fast, non-critical tasks: sending an analytics event, updating a cache, logging. If the server restarts, the task is lost, and there's no retry mechanism. Celery uses an external message broker (Redis or RabbitMQ) — tasks are durable, survive restarts, can be retried, and workers scale independently. I'd use BackgroundTasks for a welcome email — if it's lost once in a blue moon, that's acceptable. I'd use Celery for processing an uploaded PDF for RAG indexing — that must complete and can take 30 seconds."

**Q: "What's the difference between FastAPI middleware and a dependency?"**

> "Middleware runs at the ASGI level — it wraps every request before routing, sees the raw request and response, and can't access path parameters or validated data. It's the right place for cross-cutting concerns: request logging, timing, global rate limiting, response header injection. Dependencies run inside routing — they have access to path params, the validated request body, and other dependencies through the injection system. They're the right place for auth checks, per-route ownership validation, and database sessions. The practical test: if something needs parsed path params or a DB session, it's a dependency. If it needs to intercept the raw request before FastAPI processes it, it's middleware."

**Q: "How do you handle a route where some users can access the resource and others can't?"**

> "Use a dependency that performs the authorization check and returns the resource if authorized, or raises `HTTPException(403)`. Pattern: `async def verify_vocab_ownership(item_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> VocabItem`. The dependency fetches the item, checks `item.user_id == current_user.id`, raises 403 if not, returns the item if yes. Route handlers then receive the pre-validated item directly: `async def update_vocab(item: VocabItem = Depends(verify_vocab_ownership), data: UpdateSchema)`. This pattern keeps authorization logic in one place — if the ownership check logic changes, you change one dependency, not every route. It also makes authorization explicit and testable: you can unit-test the dependency with a mock DB and a user object."

> **Nativ connection:** FastAPI's dependency injection system is the backbone of Nativ's auth architecture — `get_current_user` decodes the JWT and returns the user object; ownership verification dependencies are reused across vocab, review, and session endpoints. The `yield`-based `get_db` ensures every request gets a clean session that's rolled back on error.

---

## 11.7 Self-Tests

Try answering these before looking at the answers.

1. A dependency raises an `HTTPException(403)` inside a `yield` dependency. Does the teardown code after `yield` still run?
2. You have a dependency `get_current_user` used in 5 routes. Each route also uses `get_db`. How many DB connections does FastAPI open per request that uses both?
3. Your background task updates a database record. The task runs after the response is returned. Is the request's DB session still available inside the background task?
4. A middleware logs every request. A dependency raises `HTTPException(404)` on a missing resource. Does the middleware see the 404 response?
5. You want to rate-limit a specific endpoint (not all endpoints). Would you use middleware or a dependency?

<details>
<summary>Answers</summary>

1. Yes — the teardown after `yield` always runs, even when an exception is raised inside the dependency itself or in the handler. FastAPI uses a generator-based mechanism equivalent to `try/finally`. If the dependency raises before `yield`, teardown doesn't run (there's nothing to clean up). If it raises after `yield` (in the teardown code), that exception is logged and the request handling continues normally. This is the correct and documented behavior: yield dependencies always clean up.

2. One DB connection per request — because FastAPI caches dependencies by default (`use_cache=True`). If `get_db` is called as a dependency by both the route and by `get_current_user`, FastAPI recognizes it's the same dependency instance and calls it only once per request, sharing the same session object. If you need separate sessions, set `use_cache=False` in one of the `Depends()` calls.

3. No — the DB session from the request's `get_db` dependency is closed when the request finishes (after the response is sent). Background tasks run after the response, after teardown. If the background task needs a DB session, it must create its own. Pattern: inject the database URL or a session factory into the background task and create a new session: `async with AsyncSessionLocal() as db: ...` inside the task function.

4. Yes — middleware sees the final response, including error responses generated by dependencies. The flow is: Middleware receives request → passes to call_next → FastAPI routing + dependency resolution + handler runs → generates response (including 404 from exception handlers) → response returns through call_next to the middleware → middleware can read/modify it. This is why middleware is the right place for access logging — it always sees the final status code.

5. **Dependency.** Rate limiting a specific endpoint needs to run only for that endpoint's routes, not globally. Middleware applies to all routes (or requires path matching logic in the middleware itself — messy). A dependency is cleanly scoped to the routes that include it: `@app.get("/expensive-endpoint", dependencies=[Depends(rate_limit_this_endpoint)])`. You can also reuse it across specific groups of routes via `APIRouter` with a shared dependency.

</details>

---

← Back to [10. Python Internals](10-python-internals.md) | Next → [12. Pydantic v2](12-pydantic.md)
