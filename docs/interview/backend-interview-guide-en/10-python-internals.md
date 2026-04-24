# 10. Python Internals

### Why This Section Matters

Python interviews at AI startups focus on practical internals: the GIL's effect on concurrency, how asyncio actually works, and what happens when you call a blocking function in an async context. These aren't theoretical — they cause real production bugs.

The questions also reveal whether you understand why FastAPI needs async, why your CPU-bound tasks need multiprocessing instead of threads, and how to avoid silently blocking the event loop.

**What interviewers actually probe:**
- What is the GIL and how does it affect threading vs multiprocessing?
- You call a blocking function inside `async def`. What goes wrong?
- How does `asyncio` work — what is the event loop actually doing?
- When would you use `asyncio.gather` vs `asyncio.create_task`?

---

## 10.1 The GIL — Global Interpreter Lock

The GIL is a mutex that allows only one thread to execute Python bytecode at a time. It exists because CPython's memory management (reference counting) is not thread-safe.

**What this means in practice:**

```python
import threading

# CPU-bound: GIL prevents true parallelism
def compute():
    result = 0
    for i in range(10_000_000):
        result += i
    return result

# Two threads — still runs on one CPU core at a time
t1 = threading.Thread(target=compute)
t2 = threading.Thread(target=compute)
t1.start(); t2.start()
t1.join(); t2.join()
# Wall time: ~2x single-threaded (GIL switching overhead)
```

**Threading IS useful for I/O-bound work:**

The GIL is released during I/O operations — when a thread is waiting for a network response or disk read, it releases the GIL and other threads can run. So threading works well for I/O-bound workloads where threads spend most time waiting.

```
Thread 1: [compute]→[wait for DB]→[compute]→[wait for DB]
Thread 2:           [compute]→[wait for DB]→[compute]
GIL:       [T1     ][T2 runs here][T1 again ][T2 again ]
```

**For true CPU parallelism: `multiprocessing`**

Each process has its own Python interpreter and its own GIL. True parallelism across CPU cores.

```python
from multiprocessing import Pool

def cpu_task(n):
    return sum(i * i for i in range(n))

with Pool(processes=4) as pool:
    results = pool.map(cpu_task, [10_000_000] * 4)  # runs on 4 cores in parallel
```

**Summary:**

| Workload | Solution | Why |
|---------|---------|-----|
| I/O-bound (DB, API calls) | `asyncio` or `threading` | GIL released during I/O |
| CPU-bound (ML inference, image processing) | `multiprocessing` | Separate GIL per process |
| Mixed | `asyncio` + `run_in_executor(ProcessPoolExecutor)` | Delegate CPU work to process pool |

---

## 10.2 asyncio — How the Event Loop Works

`asyncio` is cooperative multitasking — there's one thread, one event loop, and coroutines voluntarily yield control at `await` points.

```
Event loop:
  ┌─────────────────────────────────────────┐
  │  while True:                             │
  │    ready_callbacks = get_ready_tasks()   │
  │    for callback in ready_callbacks:      │
  │      callback.run_until_next_await()     │
  │    poll_io(timeout)  # wait for I/O      │
  └─────────────────────────────────────────┘
```

When a coroutine hits `await asyncio.sleep(1)` or `await db.execute(...)`, it registers a callback for when the awaited result is ready, then gives control back to the event loop. The event loop runs other ready coroutines, then checks if the I/O is complete and resumes the original.

**Key insight:** Only one coroutine runs at a time in asyncio. The concurrency comes from interleaving at `await` points — not true parallelism.

```python
import asyncio
import time

async def fetch(n):
    print(f"Starting {n}")
    await asyncio.sleep(1)       # yields to event loop here
    print(f"Done {n}")

async def main():
    # Concurrent: both start, both sleep simultaneously, total ~1s
    await asyncio.gather(fetch(1), fetch(2), fetch(3))

asyncio.run(main())
# Output: Starting 1, Starting 2, Starting 3, Done 1, Done 2, Done 3
# Total time: ~1s (not 3s)
```

---

## 10.3 Blocking the Event Loop — The Silent Bug

**The most important async pitfall:** calling a blocking (synchronous) function inside an `async def` function without offloading it.

```python
import time

# ❌ Blocks the event loop — all other requests stall
@app.get("/bad")
async def bad_endpoint():
    time.sleep(2)       # synchronous sleep — blocks the thread
    return {"status": "done"}

# ❌ Synchronous DB driver in async context
@app.get("/also-bad")
async def also_bad():
    result = requests.get("https://api.example.com")   # blocking HTTP call
    return result.json()
```

When `time.sleep(2)` runs, the entire event loop is frozen — no other request can be processed for 2 seconds.

**Fix: offload blocking work to a thread pool**

```python
import asyncio

# ✅ Run blocking code in a thread pool — event loop stays free
@app.get("/good")
async def good_endpoint():
    result = await asyncio.get_event_loop().run_in_executor(
        None,           # uses default ThreadPoolExecutor
        blocking_function,
        arg1, arg2,
    )
    return result

# FastAPI shorthand: define the route as sync def
# FastAPI automatically runs sync endpoints in a thread pool
@app.get("/also-good")
def sync_endpoint():
    time.sleep(2)       # FastAPI runs this in a thread pool automatically
    return {"status": "done"}
```

**FastAPI's rule:** `async def` routes run on the event loop — never call blocking code. `def` (sync) routes are automatically moved to a thread pool — blocking is safe there.

---

## 10.4 `asyncio.gather` vs `asyncio.create_task`

Both run coroutines concurrently. The difference is control.

**`asyncio.gather`** — runs all coroutines concurrently and waits for all to finish:

```python
# Fetch 3 APIs concurrently — waits for all, returns all results
results = await asyncio.gather(
    fetch_user(user_id),
    fetch_orders(user_id),
    fetch_preferences(user_id),
)
user, orders, prefs = results

# With error handling — return_exceptions=True prevents one failure from canceling all
results = await asyncio.gather(
    fetch_user(user_id),
    fetch_external_api(),       # might fail
    return_exceptions=True,
)
for r in results:
    if isinstance(r, Exception):
        logger.error(f"Task failed: {r}")
```

**`asyncio.create_task`** — schedules a coroutine but doesn't wait:

```python
# Fire and forget — task runs in the background
async def log_event(event: str):
    await redis.lpush("events", event)

@app.post("/action")
async def handle_action(data: ActionData):
    asyncio.create_task(log_event(f"action:{data.type}"))  # background, don't await
    return {"status": "accepted"}
```

**Use `gather` when** you need all results before proceeding. **Use `create_task` when** you want to fire a background task without waiting for it.

**Warning:** An unawaited `create_task` that raises an exception logs a warning but doesn't propagate to the caller. Always attach error handling or use structured background tasks (FastAPI's `BackgroundTasks`).

---

## 10.5 Python Memory Model — References and Garbage Collection

Python uses **reference counting** for memory management. Every object has a count of how many references point to it. When the count reaches 0, the object is freed.

```python
x = [1, 2, 3]   # list ref count = 1
y = x            # ref count = 2
del x            # ref count = 1
del y            # ref count = 0 → freed
```

**Cyclic garbage collector:** Reference counting can't handle circular references (`a → b → a`). Python runs a cyclic GC periodically to detect and break cycles.

```python
# Circular reference — neither gets freed by ref counting alone
a = {}
b = {"ref": a}
a["ref"] = b
del a, b
# GC cycle detector cleans this up
```

**Practical implications:**
- Large objects not referenced anywhere get freed immediately — no GC pause for most code
- Memory leaks in Python usually mean unintentional references held in long-lived data structures (global dicts, class variables, callback registries)
- `gc.collect()` to force a GC cycle; `tracemalloc` to diagnose memory growth

---

## 10.6 Interview Answer Scripts

**Q: "What is the GIL and when does it matter?"**

> "The GIL is a mutex in CPython that allows only one thread to execute Python bytecode at a time. It's needed because Python's reference counting memory management isn't thread-safe. The practical effect: Python threads can't achieve CPU parallelism — two threads on a 4-core machine don't run on 2 cores simultaneously. For CPU-bound tasks, use multiprocessing — each process has its own interpreter and GIL. For I/O-bound work, threading or asyncio both work fine because the GIL is released during I/O operations, letting other threads run while one is waiting for a network response. In FastAPI, the event loop is single-threaded and the GIL isn't a bottleneck because async handlers spend most time at await points."

**Q: "What happens if you call `time.sleep(5)` inside an async FastAPI endpoint?"**

> "The entire event loop freezes for 5 seconds. AsyncIO is cooperative multitasking — the event loop runs until a coroutine yields control at an `await` point. `time.sleep()` is synchronous — it blocks the thread without yielding. During those 5 seconds, no other request can be processed: no database callbacks, no other endpoints, nothing. The fix is `await asyncio.sleep(5)` which yields to the event loop, letting other coroutines run while waiting. For blocking third-party code you can't change, use `await asyncio.get_event_loop().run_in_executor(None, blocking_function)` — this runs the blocking function in a thread pool, so the event loop thread stays free. FastAPI also helps: sync `def` routes are automatically moved to a thread pool, so blocking code in `def` endpoints is safe."

**Q: "How does asyncio achieve concurrency without multiple threads?"**

> "It's cooperative multitasking. There's one thread, one event loop, and coroutines voluntarily yield control when they hit an `await`. The event loop is a loop: run ready tasks until they yield, then poll for I/O completion, then resume tasks whose awaited I/O finished. When you do `await asyncio.sleep(1)`, you register a timer callback and give control back. When you do `await db.execute(...)`, the async driver registers an I/O callback and yields. The event loop runs other coroutines in the meantime. When the timer fires or the I/O completes, those coroutines are put back on the ready queue. The key difference from threading: no OS context switching overhead, no locks needed for shared state within a coroutine, but you must never block — blocking in one coroutine blocks everything."

**Q: "What is a Python generator and how is it different from a regular function?"**

> "A generator is a function that uses `yield` to return values one at a time, suspending its state between yields. Unlike a regular function that runs to completion and returns once, a generator produces a lazy sequence — it only computes the next value when asked. The practical uses: memory-efficient iteration over large datasets (yield one row at a time instead of loading all rows into memory), infinite sequences (generate values on demand), and coroutines (async def is built on top of generators). In the context of streaming: FastAPI's `StreamingResponse` takes a generator — the generator yields chunks, FastAPI sends each chunk to the client, and the generator is called again for the next chunk. This is why LLM streaming with `StreamingResponse` is memory-efficient even for long responses: only one token chunk is in memory at a time, not the full response."

> **Nativ connection:** Nativ uses Python generators for both streaming LLM output (yield one SSE chunk per token from Claude's response iterator) and for Alembic migration operations (generators can simplify complex migration step sequences). The asyncio event loop's coroutine machinery is also generator-based under the hood.

---

## 10.7 Self-Tests

Try answering these before looking at the answers.

1. You have a FastAPI endpoint that calls an AI inference function that takes 500ms of pure CPU computation. Should you define it as `async def` or `def`? Why?
2. `asyncio.gather(task1(), task2(), task3())` — task2 raises an exception. What happens to task1 and task3 by default?
3. A colleague writes a Redis cache with `async def get_cached()` that calls `json.loads(data)` to parse a large JSON string. Is there a blocking issue? Why or why not?
4. You see memory growing slowly in a long-running FastAPI process. What's your debugging approach?
5. What's the difference between `asyncio.sleep(0)` and not awaiting anything?

<details>
<summary>Answers</summary>

1. `def` (synchronous). FastAPI automatically runs `def` endpoints in a thread pool, so the 500ms CPU computation runs on a worker thread and doesn't block the event loop. If you define it as `async def`, the 500ms CPU work blocks the event loop — all other requests queue up. Using `async def` with `run_in_executor` would also work but is more verbose. The rule: use `async def` when you're doing I/O with an async library (asyncpg, httpx, redis-py async). Use `def` when you have blocking or CPU-bound code. If you need both async I/O AND CPU work, use `async def` with `run_in_executor(ProcessPoolExecutor, ...)` for the CPU part.

2. By default, `asyncio.gather()` cancels all other tasks when one raises an exception, and re-raises the exception to the caller. Task1 and task3 receive cancellation. To change this behavior: `asyncio.gather(task1(), task2(), task3(), return_exceptions=True)` — all tasks run to completion, and exceptions are returned as values in the result list instead of being raised. You then check each result: `if isinstance(result, Exception): handle_error()`. Use `return_exceptions=True` when partial failure is acceptable and you want all results.

3. **Not a blocking issue.** `json.loads()` is CPU work (parsing), not I/O. It runs synchronously on the Python thread. For small JSON (< few KB), this completes in microseconds — negligible. For very large JSON (MB+), it could block the event loop for a measurable time. The threshold where it becomes a concern: roughly above 10–100ms of CPU time. For typical API responses, `json.loads` is fine in async code. If parsing a multi-MB payload, consider `run_in_executor` or using a faster JSON library like `orjson` which parses faster.

4. Memory debugging approach: (a) `tracemalloc` — Python's built-in memory profiler. Call `tracemalloc.start()` at process start, then periodically `tracemalloc.take_snapshot()` and compare snapshots to see what's growing. (b) Look for common leak patterns: unbounded in-memory caches (global dicts that grow), event listeners or callbacks never deregistered, long-lived objects holding references to large data (closures capturing large objects). (c) `objgraph` library — `objgraph.show_growth()` shows which object types are growing. (d) Check for circular references with `gc.garbage` after `gc.collect()`. In FastAPI, common sources: middleware holding request context, background tasks never completing, SQLAlchemy identity maps not being cleared.

5. `asyncio.sleep(0)` explicitly yields to the event loop — it says "I'm done for this step, let other coroutines run, then resume me." It's useful in long-running loops to prevent monopolizing the event loop: `for item in large_list: await process(item); await asyncio.sleep(0)`. Not awaiting anything means the coroutine runs to the next natural `await` point without yielding. If there are no `await` points in a tight loop, the coroutine monopolizes the event loop — all other requests are starved. `asyncio.sleep(0)` is the explicit "yield to scheduler" pattern.

</details>

---

← Back to [9. Redis & Caching](9-redis.md) | Next → [11. FastAPI Advanced](11-fastapi.md)
