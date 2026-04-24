# 15. Node.js Backend

### Why This Section Matters

Node.js is the runtime behind Next.js API routes, Express, and most JavaScript backend services. Interviewers at AI startups probe Node.js to verify you understand its concurrency model (the event loop, libuv), when it's a good fit vs a poor one, and how to avoid the common pitfalls — blocking the event loop, memory leaks, and unhandled Promise rejections.

**What interviewers actually probe:**
- How does Node.js handle concurrency if it's single-threaded?
- What is `libuv` and what does it do?
- When would you use Worker Threads vs child processes?
- What happens with unhandled Promise rejections?

---

## 15.1 The Node.js Architecture — Event Loop + libuv

Node.js is single-threaded at the JavaScript level, but it uses a native library called **libuv** to handle I/O operations with a thread pool. This is how Node.js achieves non-blocking I/O without multiple JavaScript threads.

```
┌──────────────────────────────────────────────┐
│  JavaScript code (single thread)              │
│  ┌───────────────────────────────────────┐   │
│  │  Event Loop (V8 + Node.js bindings)   │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────┬───────────────────┘
                           │ delegates I/O to
                           ▼
┌──────────────────────────────────────────────┐
│  libuv (C library)                           │
│  ┌──────────────────────────────────────┐    │
│  │  Thread Pool (4 threads by default)  │    │  ← file I/O, DNS, crypto
│  └──────────────────────────────────────┘    │
│  Async OS APIs (epoll/kqueue)                │  ← network I/O (no thread needed)
└──────────────────────────────────────────────┘
```

**The distinction matters:**
- **Network I/O** (TCP, HTTP requests): handled by OS-level async APIs — no thread needed. Nearly free from Node's perspective.
- **File I/O, DNS, crypto**: handled by libuv's thread pool (4 threads by default). These consume actual threads.

This is why Node.js is excellent for I/O-bound workloads (API gateways, chat servers, realtime apps) but poor for CPU-bound workloads (image processing, ML inference) — CPU work blocks the JavaScript thread.

---

## 15.2 Event Loop Phases in Node.js

Node.js's event loop has distinct phases. Understanding the order matters for reasoning about `setTimeout`, `setImmediate`, and `process.nextTick`.

```
┌────────────────────────────────────────────────────────┐
│  timers          → setTimeout, setInterval callbacks   │
│  pending I/O     → I/O error callbacks                 │
│  idle/prepare    → internal use                        │
│  poll            → retrieve I/O events (blocks if none) │
│  check           → setImmediate callbacks               │
│  close callbacks → closed socket callbacks             │
└────────────────────────────────────────────────────────┘
```

**`process.nextTick` vs `setImmediate` vs `setTimeout(0)`:**

```javascript
setImmediate(() => console.log("setImmediate"));         // runs after poll phase (check)
setTimeout(() => console.log("setTimeout 0"), 0);        // runs in timers phase
process.nextTick(() => console.log("nextTick"));          // runs before next phase (highest priority)

// Output: nextTick → setTimeout 0 or setImmediate (order depends on event loop timing)
//         but nextTick always runs first
```

`process.nextTick` callbacks run at the end of the *current* operation, before the event loop continues to the next phase. Use it sparingly — overuse can starve I/O.

---

## 15.3 Worker Threads vs Child Processes

Node.js has two mechanisms for running code outside the main thread:

**Worker Threads** (`worker_threads` module):
- Runs JavaScript in a separate thread within the same process
- Shares memory via `SharedArrayBuffer`
- Lower overhead than spawning a process
- Best for: CPU-bound JavaScript computation (image resizing, JSON parsing of large payloads, ML inference with pure JS)

```javascript
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");

if (isMainThread) {
    const worker = new Worker(__filename, { workerData: { n: 1_000_000 } });
    worker.on("message", result => console.log("Result:", result));
} else {
    // This runs in the worker thread
    const sum = Array.from({ length: workerData.n }, (_, i) => i).reduce((a, b) => a + b, 0);
    parentPort.postMessage(sum);
}
```

**Child Processes** (`child_process` module):
- Spawns a completely separate OS process
- Separate memory space — communication via IPC or stdin/stdout
- Higher overhead but full process isolation
- Best for: running non-JavaScript binaries (Python scripts, shell commands), isolation from crashes

```javascript
const { execFile } = require("child_process");

execFile("python3", ["inference.py", "--input", inputPath], (error, stdout, stderr) => {
    if (error) throw error;
    console.log(JSON.parse(stdout));
});
```

**When to use what:**

| Scenario | Solution |
|----------|---------|
| Heavy JSON parsing of multi-MB payload | Worker Thread |
| Running a Python ML model | Child Process or external service |
| Parallel CPU-bound JS computations | Worker Thread Pool |
| Executing shell commands or binaries | Child Process |
| CPU-bound with native addons | Worker Thread or native async |

---

## 15.4 Unhandled Promise Rejections

In older Node.js versions (< 15), unhandled Promise rejections logged a warning but let the process continue. In Node.js 15+, unhandled rejections crash the process with exit code 1.

```javascript
// ❌ Silent failure — rejection is unhandled
async function fetchData() {
    throw new Error("Network error");
}

fetchData();  // No .catch(), no try/catch — process crashes in Node 15+

// ✅ Always handle rejections
fetchData().catch(err => console.error("Fetch failed:", err));

// Or via process event (last resort — prefer handling at source)
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection:", reason);
    // Optionally: graceful shutdown
    process.exit(1);
});
```

**In Express/Next.js:** async route handlers that throw don't automatically call `next(error)` unless you wrap them. Use a wrapper:

```javascript
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

app.get("/users", asyncHandler(async (req, res) => {
    const users = await db.query("SELECT * FROM users");  // can throw
    res.json(users);
}));
```

---

## 15.5 Streams — Memory-Efficient Data Processing

Node.js streams process data in chunks instead of loading everything into memory. Critical when dealing with large files, HTTP responses, or database result sets.

```javascript
const fs = require("fs");
const { Transform } = require("stream");

// ❌ Loads entire file into memory
const data = fs.readFileSync("large-file.json");
JSON.parse(data);   // 500MB file = 500MB + parsed object in memory

// ✅ Stream-based processing
const readStream = fs.createReadStream("large-file.csv");
const writeStream = fs.createWriteStream("output.csv");

const transform = new Transform({
    transform(chunk, encoding, callback) {
        // Process chunk-by-chunk
        const processed = chunk.toString().toUpperCase();
        callback(null, processed);
    }
});

readStream
    .pipe(transform)
    .pipe(writeStream)
    .on("finish", () => console.log("Done"));
```

**Backpressure:** If the writer is slower than the reader, data queues up in memory. The `.pipe()` method handles backpressure automatically — it pauses the readable stream when the writable stream's buffer is full.

> **Nativ connection:** When streaming LLM responses (SSE), Node.js/Next.js uses a `ReadableStream` internally. Understanding streams is why SSE doesn't buffer the entire LLM response before sending — it pipes chunks to the HTTP response as they arrive from the OpenAI API.

---

## 15.6 Interview Answer Scripts

**Q: "How does Node.js handle concurrency if JavaScript is single-threaded?"**

> "Node.js is single-threaded at the JavaScript level — only one piece of JS runs at a time. But the runtime delegates I/O to the OS and to libuv's thread pool. When your code does `await fetch(url)`, Node hands the network request to the OS-level async I/O APIs (epoll on Linux, kqueue on macOS). The OS notifies Node when data arrives, and Node puts the callback on the event loop queue to resume. No thread is occupied during the wait. This is why Node handles thousands of concurrent connections efficiently — most connections are in the waiting state, and waiting is essentially free. The event loop processes callbacks only when work is ready, so high concurrency translates to a long queue of fast callbacks, not thousands of blocked threads."

**Q: "When would you use Worker Threads vs a Child Process?"**

> "Worker Threads are for CPU-bound JavaScript work — resizing images, parsing large JSON, running WASM modules. They run in a separate thread within the same process, share memory via SharedArrayBuffer, and have lower overhead than spawning a new process. Child processes are for running external binaries or requiring full process isolation. If I need to run a Python inference script, I spawn a child process — it gets its own memory space and can't corrupt the main Node process. In practice, for an AI startup, I'd use a child process (or a microservice) for anything involving Python ML code, and Worker Threads only for computation I can express in JavaScript."

**Q: "What changed with unhandled Promise rejections in Node 15?"**

> "Before Node 15, an unhandled Promise rejection triggered a deprecation warning but let the process continue — so bugs could silently swallow errors and keep serving traffic. Node 15 changed this: unhandled rejections crash the process with exit code 1. This is correct behavior — a silently failing async operation is worse than a crash because it makes debugging nearly impossible. The practical implication: every async function call must either be awaited inside a try/catch, have a `.catch()` handler, or be inside a framework that catches errors (like FastAPI in Python, or Express with an asyncHandler wrapper in Node). A `process.on('unhandledRejection')` handler is a last resort for logging, not a substitute for proper error handling."

**Q: "What is backpressure in Node.js streams and why does it matter?"**

> "Backpressure is when a writable stream can't keep up with a readable stream — the data producer is faster than the consumer. Without handling it, unprocessed data accumulates in memory buffers, which can cause out-of-memory crashes or extreme latency. Node.js's `.pipe()` handles backpressure automatically — when the writable stream's internal buffer is full, it signals the readable to pause. The readable stops emitting data until the writable drains. This is relevant when streaming AI responses: if a client's network is slow and can't consume the LLM output fast enough, backpressure prevents the server from buffering the entire response in memory."

---

## 15.7 Self-Tests

Try answering these before looking at the answers.

1. You have a Node.js service that serves 10,000 concurrent WebSocket connections. Each connection handler is pure async I/O (no computation). Will the event loop be a bottleneck? What would change that answer?
2. Your background job reads a 2GB CSV file, processes each row, and inserts it into a database. You load the entire file with `fs.readFileSync`. What's the problem and how do you fix it?
3. A route handler fires an async function without awaiting it: `asyncJob(); res.json({status: "ok"})`. The async job throws. What happens in Node 15+?
4. You increase libuv's thread pool size to 16 with `UV_THREADPOOL_SIZE=16`. For which operations does this improve throughput, and for which does it have no effect?
5. `process.nextTick(() => A())` vs `setImmediate(() => B())`. Which runs first and when would you choose one over the other?

<details>
<summary>Answers</summary>

1. No — 10,000 pure async I/O connections are not a bottleneck on the event loop. Each connection spends most of its time waiting for I/O (data from the client, responses from the database). The event loop only processes callbacks when I/O completes, and each callback is brief. What changes the answer: if any handler does CPU-bound work (JSON parsing of large payloads, image processing, ML inference) synchronously, that work blocks the event loop and all 10,000 connections stall. Also: the OS and libuv have limits on file descriptors and thread pool size — at 10,000 connections you're likely hitting OS-level limits, not the event loop.

2. Problem: `fs.readFileSync("2GB_file.csv")` loads the entire 2GB into memory as a Buffer, then your processing logic holds the parsed rows in memory too. For a 2GB file, peak memory usage is several times that. Fix: use `fs.createReadStream()` piped through a CSV parser that emits rows one at a time. Insert each row as it's emitted, or batch in groups of 1000. Peak memory stays constant regardless of file size — only the current chunk is in memory.

3. In Node 15+, the unhandled Promise rejection crashes the process. `asyncJob()` returns a Promise. Since it's not awaited and has no `.catch()`, the rejection is unhandled. When the event loop processes it, Node triggers the `unhandledRejection` event — and by default exits with code 1. The client got `{status: "ok"}` (since `res.json()` ran before the job threw), but the server crashed. Fix: either `await asyncJob()` inside the handler, or add `.catch(err => logger.error(err))` to the fire-and-forget call.

4. `UV_THREADPOOL_SIZE=16` increases the threads for operations handled by libuv's thread pool: **file I/O** (fs module), **DNS resolution**, **crypto** (bcrypt, sha256), and custom C++ addons that use the thread pool. It has **no effect** on network I/O — TCP/HTTP/WebSocket are handled by OS async APIs (epoll/kqueue/IOCP), not the thread pool. So if your bottleneck is `fs.readFile` or `bcrypt.hash`, increasing the thread pool helps. If it's `fetch`/`http.get`, it has no effect.

5. `process.nextTick(A)` runs first — before the event loop moves to the next phase. `setImmediate(B)` runs after the current event loop phase (specifically in the "check" phase after poll). **When to use nextTick:** when you need a callback to run before any I/O or timers — for example, emitting an event after a constructor finishes but within the same stack frame (deferred but before any I/O callbacks). **When to use setImmediate:** when you want to defer work to the next iteration of the event loop, after pending I/O. Caution: if you call `process.nextTick` recursively, you starve the event loop — I/O callbacks never get to run. `setImmediate` doesn't have this problem.

</details>

---

← Back to [14. TypeScript Advanced](14-typescript.md) | Next → [16. Next.js App Router](16-nextjs.md)
