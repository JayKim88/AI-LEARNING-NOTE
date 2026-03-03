---
title: "Python asynccontextmanager & FastAPI Lifespan Pattern"
date: 2026-03-03
description: "How @asynccontextmanager and yield divide startup/shutdown in FastAPI lifespan, and how dunder methods __aenter__/__aexit__ work as Python's context manager protocol."
category: learnings
tags: ["python", "fastapi", "asynccontextmanager", "lifespan", "uvicorn", "dunder-methods", "context-manager"]
lang: en
draft: false
---

## Key Concepts

### `@asynccontextmanager`

A decorator from `contextlib` that turns an `async def` function containing `yield` into an async context manager — without manually writing a class with `__aenter__`/`__aexit__`.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Code before yield = __aenter__ (runs on entry)
    await init_db_pool()

    yield  # Pause here; the "with block" runs

    # Code after yield = __aexit__ (runs on exit)
    await close_db_pool()
```

### `yield` in a context manager

`yield` means **"pause and hand control to the caller."**

- Everything **before** `yield` → runs when entering the `async with` block
- The `yield` point → pauses while the block body executes (can be seconds, hours, or indefinitely)
- Everything **after** `yield` → runs when the `with` block exits (normally or via exception)

```
async with lifespan(app):   ← __aenter__: code before yield runs
    await server.serve()    ← yield point: app serves traffic here (indefinitely)
                            ← __aexit__:  code after yield runs on SIGTERM
```

### `__aenter__` and `__aexit__`

Python's **dunder (double-underscore) methods** for the async context manager protocol. Any class implementing these two can be used with `async with`.

```python
class MyContextManager:
    async def __aenter__(self):         # Called on `async with` entry
        print("start")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):  # Called on exit
        print("end")

async with MyContextManager() as m:
    print("using")
# Output: start → using → end
```

`@asynccontextmanager` auto-generates this class from a `yield`-based function — saving boilerplate.

### uvicorn

An **ASGI server** — the process that actually binds a TCP port and receives HTTP requests, passing them to the FastAPI app.

```
Browser / Client
      ↓ HTTP request
   [uvicorn]          ← Opens port (e.g., 8000), manages TCP connections
      ↓
  [FastAPI app]       ← Routes, middleware, dependency injection
      ↓
  [Business logic]    ← Handlers, DB queries, Claude API calls
```

On Render: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
Render performs a TCP port scan — if the port is not bound within the timeout, it kills the process.

---

## New Learnings

### Before

- Confused `yield` in context managers with generators — thought it just "returns" a value.
- Assumed `__aenter__`/`__aexit__` were optional or just naming conventions.
- Unclear why Render was killing the process with "no open ports detected."

### After

- `yield` in `@asynccontextmanager` is a **suspension point**, not a return. The function is frozen at `yield` while the `with` block runs — which in FastAPI's case is the entire lifetime of the running server.
- `__aenter__` and `__aexit__` are part of Python's **protocol system** (like `__len__`, `__iter__`). Python calls them automatically at `async with` entry/exit. `@asynccontextmanager` generates them from the function.
- The Render failure happened because `asyncpg.create_pool(min_size=1)` attempted an immediate DB connection **before `yield`** (before uvicorn bound the port). If Supabase was slow, the exception propagated and `yield` was never reached → port never opened → Render killed the process.

---

## Practical Examples

### FastAPI lifespan pattern

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: runs before port binding
    await init_db_pool()
    try:
        await run_orphan_cleanup()   # wrap non-critical startup tasks
    except Exception as exc:
        logger.warning("Skipped: %s", exc)   # don't let this block the server

    yield   # Port is bound HERE. Server accepts requests.

    # Shutdown: runs when SIGTERM received
    await close_db_pool()

app = FastAPI(lifespan=lifespan)
```

### asyncpg pool: eager vs lazy connections

```python
# BAD for Render/Supabase cold-start:
_pool = await asyncpg.create_pool(min_size=1, ...)
# ↑ Immediately tries to establish 1 connection.
#   If DB is slow → create_pool hangs/raises → lifespan never yields

# GOOD:
_pool = await asyncpg.create_pool(min_size=0, ...)
# ↑ Pool is created instantly. Connections are made lazily on first acquire().
#   Startup always completes; DB errors surface per-request instead.
```

### `yield value` — passing state to the with block

```python
@asynccontextmanager
async def lifespan(app):
    pool = await asyncpg.create_pool(...)
    yield {"db": pool}          # value passed to `as`
    await pool.close()

async with lifespan(app) as state:
    conn = state["db"]          # access pool inside the block
```

---

## Common Misconceptions

**"The app is running while inside `__aenter__`"**
Wrong. The port is not bound until **after** `yield`. While `__aenter__` code is executing (before `yield`), uvicorn has not started accepting connections. Exceptions here prevent the port from ever opening.

**"`app` in `lifespan(app)` is the context manager"**
Wrong. `lifespan` (decorated with `@asynccontextmanager`) is the context manager factory. `app` is just an argument passed to it. `lifespan(app)` is the call that creates the context manager object.

**"`__aenter__`/`__aexit__` are optional naming conventions"**
Wrong. They are part of Python's **data model** — Python calls them automatically. Any class missing `__aenter__` will raise `AttributeError` when used in `async with`. They are required, not optional.

---

## References

- [backend/app/main.py](../lingua-rag/backend/app/main.py) — FastAPI lifespan with orphan cleanup + try/except
- [backend/app/db/connection.py](../lingua-rag/backend/app/db/connection.py) — asyncpg pool with `min_size=0`
- Python docs: `contextlib.asynccontextmanager`
- Python data model: `__aenter__` / `__aexit__`

---

## Next Steps

- Explore `contextlib.AsyncExitStack` for composing multiple async context managers
- Look at how Starlette internally calls `async with lifespan(app)` in its server lifecycle
- Try `yield {"state": value}` pattern to pass startup resources to request handlers via `app.state`
