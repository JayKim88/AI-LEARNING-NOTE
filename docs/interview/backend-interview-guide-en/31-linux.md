# 31. Linux / Process Basics

### Why This Section Matters

Linux is the operating system running every production server and container you'll deploy to. You don't need to be a sysadmin, but you need to be comfortable enough to debug a running process, read logs, check resource usage, and diagnose environment issues from a terminal.

At AI startups, this often comes up in debugging sessions — "the container is OOM-killed, how do you investigate?" or "your worker process is consuming 100% CPU, what do you do?"

**What interviewers actually probe:**
- How do you find what's using disk or memory on a server?
- What is a process, a thread, and a file descriptor?
- How do you send signals to processes?
- What does `grep`, `awk`, `curl` do and when do you use them?

---

## 31.1 Essential Commands

**Process management:**
```bash
ps aux                    # list all running processes
ps aux | grep python      # filter for python processes
top                       # real-time process monitor (q to quit)
htop                      # better top — color, tree view
kill -9 <pid>             # force kill a process (SIGKILL)
kill -15 <pid>            # graceful stop (SIGTERM — process can clean up)
pkill -f "uvicorn"        # kill by name pattern
```

**Resource usage:**
```bash
free -h                   # memory usage (human-readable)
df -h                     # disk space by filesystem
du -sh /app               # disk usage of a directory
lsof -p <pid>             # open files for a process
lsof -i :8000             # what's listening on port 8000
ss -tlnp                  # open TCP sockets (modern netstat)
```

**Log viewing:**
```bash
tail -f /var/log/app.log          # follow a log file in real time
tail -n 100 /var/log/app.log      # last 100 lines
journalctl -u myservice -f        # systemd service logs
docker logs -f container_name     # Docker container logs
```

**Text processing:**
```bash
grep "ERROR" app.log               # filter lines containing ERROR
grep -i "error" app.log            # case-insensitive
grep -n "error" app.log            # with line numbers
grep -r "def get_user" .           # search recursively in files
grep -v "DEBUG" app.log            # exclude lines matching

cat access.log | grep "500" | wc -l           # count 500 errors
cat access.log | awk '{print $9}' | sort | uniq -c  # count by status code
```

---

## 31.2 Processes, Threads, and File Descriptors

**Process** — an independent running program with its own memory space, process ID (PID), and resources. When you start a FastAPI app with uvicorn, that's a process.

**Thread** — a unit of execution within a process. Threads share memory with other threads in the same process. FastAPI's sync `def` routes run in a thread pool inside the same uvicorn process.

**File descriptor (fd)** — a number that represents an open file, socket, or pipe. Everything in Linux is a file: network connections, actual files, stdin/stdout. Each fd costs one from the process's limit.

```bash
# Check process file descriptor limit
ulimit -n             # soft limit (default often 1024)
ulimit -Hn            # hard limit

# See how many fds a process has open
ls /proc/<pid>/fd | wc -l

# "Too many open files" error = process hit its fd limit
# Fix: raise the limit in /etc/security/limits.conf or container config
```

**Why this matters:** FastAPI with PostgreSQL needs 1 fd per database connection. If you have a connection pool of 20 and the fd limit is 1024, that leaves only 1004 for everything else — on a busy server with concurrent requests, this can run out.

---

## 31.3 Signals

Linux uses signals to communicate with processes. Common signals:

| Signal | Number | Meaning | Default behavior |
|--------|--------|---------|-----------------|
| SIGTERM | 15 | Graceful shutdown request | Process exits (if it handles it) |
| SIGKILL | 9 | Forced kill | Process dies immediately — cannot be caught |
| SIGINT | 2 | Ctrl+C | Process exits |
| SIGHUP | 1 | Reload configuration | Process re-reads config |
| SIGUSR1 | 10 | User-defined | Depends on application |

**Graceful shutdown in FastAPI:**
```python
import signal
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await startup_tasks()
    yield
    # Shutdown — runs on SIGTERM
    await shutdown_tasks()   # close DB connections, flush queues
    print("Graceful shutdown complete")

app = FastAPI(lifespan=lifespan)
```

When Docker stops a container (`docker stop`), it sends SIGTERM. If the process doesn't exit within 10 seconds, Docker sends SIGKILL. FastAPI handles SIGTERM via uvicorn's built-in signal handling — it waits for in-flight requests to complete before exiting.

---

## 31.4 Environment Variables

```bash
# Set for current session
export API_KEY="sk-abc123"
echo $API_KEY

# Set for a single command
API_KEY="sk-abc123" python script.py

# View all environment variables
env
env | grep API

# In a Dockerfile or docker-compose.yml
ENV API_KEY=sk-abc123    # baked into image (don't use for secrets)
# vs
# environment: - API_KEY=${API_KEY}  # injected at runtime from host
```

**Never bake secrets into Docker images.** Use environment injection (`-e`, docker-compose `environment:`, or a secrets manager) at runtime. Images are often pushed to registries and could be pulled by anyone with registry access.

---

## 31.5 curl — Testing HTTP from the Terminal

```bash
# Basic GET
curl https://api.nativ.io/health

# POST with JSON body
curl -X POST https://api.nativ.io/vocab \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"word": "Wanderlust", "language": "de", "difficulty": 3}'

# Verbose output — shows request and response headers
curl -v https://api.nativ.io/health

# Follow redirects
curl -L https://short.url/abc

# Show only response status code
curl -o /dev/null -s -w "%{http_code}" https://api.nativ.io/health

# Test SSE streaming
curl -N -H "Accept: text/event-stream" https://api.nativ.io/stream
```

---

## 31.6 Finding and Diagnosing Problems

**"Out of memory" crash:**
```bash
dmesg | grep -i "oom"           # kernel OOM killer messages
dmesg | grep -i "killed"        # what process was killed
free -h                          # current memory state
# In Docker: set memory limits in docker-compose.yml
# mem_limit: 512m
```

**"Port already in use":**
```bash
ss -tlnp | grep :8000           # what's using port 8000
lsof -i :8000                   # process and PID
kill -9 <pid>                   # kill it (or change your app's port)
```

**Disk full:**
```bash
df -h                            # which filesystem is full
du -sh /* 2>/dev/null | sort -rh | head -10   # top 10 largest directories
# Common culprits: Docker images/containers, logs, ML model files
docker system prune              # remove unused Docker resources
```

**Process consuming 100% CPU:**
```bash
top                              # identify the PID
# Press 1 in top to see per-CPU breakdown
# Press c to see full command line

strace -p <pid>                  # trace system calls (low-level)
py-spy top --pid <pid>           # Python-specific profiler (for Python processes)
```

---

## 31.7 Interview Answer Scripts

**Q: "A container is being OOM-killed repeatedly. How do you investigate?"**

> "First, confirm it's OOM-killed: check `dmesg | grep -i oom` in the container host or look for container exit code 137 (SIGKILL from OOM killer). Then look at the memory growth pattern: if available, check memory metrics over time — is it gradual (memory leak) or spike-and-crash (single operation uses too much)? For a memory leak: attach a profiler before the crash. In Python, `tracemalloc.start()` at startup and `tracemalloc.take_snapshot()` at intervals lets you see what objects are growing. For a spike: check if there's a specific request type (large file upload, batch operation) that triggers it. Short-term fix: increase the container's memory limit if there's headroom. Medium-term: identify the leak or the large allocation and fix it."

**Q: "How do you check what's listening on a port?"**

> "`ss -tlnp | grep :8000` — the modern replacement for `netstat`. Shows TCP sockets in listen state, with the process name and PID. `lsof -i :8000` also works and shows the process name. The typical use case: you start a development server and get 'port already in use' — these commands tell you what to kill. In Docker: ports are mapped from the host, so you'd also check if a previous container is still running with that port mapped — `docker ps` or `docker ps -a` to see stopped containers."

**Q: "How do you find the largest files eating disk space on a server?"**

> "Two-step approach. First, find which filesystem is full: `df -h` — shows usage per mounted filesystem. When you identify the full one (usually `/` or `/var`), drill into it: `du -sh /* 2>/dev/null | sort -rh | head -20` — shows the 20 largest top-level directories in human-readable form. Then recurse into the largest: `du -sh /var/log/* | sort -rh | head -10`. Common culprits on application servers: log files (`/var/log/`, application logs), Docker images and build cache (`docker system df` shows Docker's disk usage; `docker system prune` reclaims unused resources), ML model files, and database data directories. On a Python server: `__pycache__` directories and pip cache (`~/.cache/pip`) can accumulate. Fix those, then address the root cause: log rotation policy, Docker cleanup in CI, model file lifecycle."

**Q: "What's the difference between SIGTERM and SIGKILL, and why does it matter for containerized applications?"**

> "SIGTERM (signal 15) is a polite shutdown request — the process receives it, can run cleanup code, close connections, flush buffers, and then exit. The process can catch and handle SIGTERM with a signal handler. SIGKILL (signal 9) is unconditional termination by the kernel — the process has no chance to clean up. This matters enormously in containers: when Docker stops a container (`docker stop` or Kubernetes terminates a pod), it sends SIGTERM first and waits 30 seconds (configurable) for the process to exit. If it doesn't, SIGKILL is sent. For a FastAPI app, SIGTERM triggers uvicorn's graceful shutdown — it stops accepting new requests and waits for in-flight requests to complete before exiting. If you ignore SIGTERM (or your PID 1 in Docker doesn't forward it to the child process — a common Dockerfile bug), requests are cut off mid-flight. The fix: ensure your CMD in Dockerfile runs the app as PID 1 (use `exec` form: `CMD [\"uvicorn\", \"app.main:app\"]`, not shell form with a wrapper script unless the script explicitly forwards signals with `exec`)."

---

## 31.8 Self-Tests

Try answering these before looking at the answers.

1. You SSH into a server where your FastAPI app should be running on port 8000, but `curl localhost:8000` times out. What do you check?
2. Your app is throwing `OSError: [Errno 24] Too many open files`. What is this, what causes it, and how do you fix it?
3. You want to count how many times `"ERROR"` appears in a 500MB log file without loading the whole file into memory. Write the command.
4. Your Python worker process is consuming 100% CPU for the past 10 minutes. What do you do?
5. You run `kill 1234` and the process doesn't die. What signal was sent and what do you do next?

<details>
<summary>Answers</summary>

1. Check in order: (a) Is the process running? `ps aux | grep uvicorn`. (b) Is it listening on port 8000? `ss -tlnp | grep :8000`. (c) Is there a firewall blocking it? `curl localhost:8000` tests local access — a timeout suggests the process isn't listening (vs a connection refused). `sudo iptables -L` or `ufw status` for firewall rules. (d) Is it listening on `127.0.0.1` (localhost only) vs `0.0.0.0` (all interfaces)? If you're connecting from outside, `0.0.0.0` is required. In Docker, check that the port is mapped: `docker ps` should show `0.0.0.0:8000->8000/tcp`. (e) Check logs: `journalctl -u myservice -n 50` or application logs for startup errors.

2. This is a file descriptor limit exhaustion. Each open file, socket, and pipe uses one file descriptor. The process has hit its `ulimit -n` limit (often 1024 by default). Causes: connection pool larger than the limit allows, file handles not being closed (resource leak), or the server handling too many concurrent requests. Fix: (a) Raise the per-process limit: `ulimit -n 65536` in the shell before starting the process, or set it in `/etc/security/limits.conf` for permanent change. (b) In Docker: set `ulimits` in `docker-compose.yml`: `ulimits: nofile: soft: 65536, hard: 65536`. (c) Fix the root cause: ensure database connections are properly closed, use connection pooling, and verify there are no file handle leaks.

3. `grep -c "ERROR" app.log` — the `-c` flag counts matching lines without loading the whole file into memory (it streams through the file). Output: just the count. If you need the count of occurrences (a single line can have multiple "ERROR"): `grep -o "ERROR" app.log | wc -l`. For large files, both `grep` and `wc` stream — memory usage is proportional to the longest line, not the file size.

4. First, don't kill it yet — gather information. (a) `py-spy top --pid <pid>` (if available) — shows which Python function is consuming CPU in real time. (b) `strace -p <pid>` — shows system calls; if it's in a tight loop you'll see rapid repeated calls. (c) Check if it's expected CPU work (ML inference, large data processing) or a runaway loop. (d) Send SIGUSR1 if the application handles it for a state dump, or use `kill -3 <pid>` for a Java thread dump equivalent. If it's a bug (infinite loop), you need the stack trace before killing it — `py-spy dump --pid <pid>` dumps the current call stack without stopping the process.

5. `kill <pid>` without a signal number sends SIGTERM (signal 15) — a polite request to terminate. The process can catch and ignore SIGTERM if it has a custom signal handler that doesn't exit. Next step: `kill -9 <pid>` sends SIGKILL, which cannot be caught or ignored — the kernel terminates the process immediately, without giving it a chance to clean up. SIGKILL is the last resort: use it only if SIGTERM doesn't work within a reasonable time (e.g., 10-15 seconds), because abrupt termination can leave resources in a dirty state (unclosed database connections, incomplete writes).

</details>

---

← Back to [30. DevOps Essentials](30-devops.md) | Next → [32. Scenario-based Questions](32-scenarios.md)
