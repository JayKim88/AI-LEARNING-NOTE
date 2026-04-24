# 20. Microservices vs Monolith

### Why This Section Matters

"Should we use microservices?" is one of the most misunderstood architecture questions in the industry. Too many teams adopt microservices prematurely, create distributed systems complexity without any of the scaling benefits, and then spend months debugging network failures where they once had function calls.

Interviewers at AI startups ask this to test engineering judgment: whether you understand when complexity is justified, and whether you can argue both sides honestly.

**What interviewers actually probe:**
- What are the actual tradeoffs of microservices vs a monolith?
- What is a "distributed monolith" and why is it worse than either?
- When does it make sense to extract a service?
- How does the "modular monolith" approach work?

---

## 20.1 The Monolith — What It Actually Is

A monolith is a single deployable unit containing all application code. "Monolith" is often used pejoratively, but well-designed monoliths are the right choice for most teams — especially early-stage.

**Monolith advantages:**
- Simple deployment: one service, one database, one codebase
- No network calls between components — function calls are free
- Easier local development: run one thing, debug one thing
- Transactions span the whole system — ACID across all operations
- Shared code (utilities, models, types) without duplication or versioning

**Monolith failure modes (when they become a problem):**
- A bug in the payment module crashes the entire app including the user profile page
- Scaling requires scaling the entire application — can't scale hot path independently
- Deployment of any feature requires deploying everything
- Team of 50 engineers all working in one repo — merge conflicts, slow CI

**The key insight:** Most of these problems become real at significant scale, not at startup scale. A well-organized monolith serves a team of 5-15 engineers very well.

---

## 20.2 Microservices — What You Actually Get

Microservices decompose an application into independently deployable services, each responsible for a bounded domain (users, payments, inventory) and communicating over the network.

**What microservices genuinely provide:**
- Independent scaling: scale the embedding service separately from the auth service
- Independent deployment: update payments without touching user profiles
- Technology heterogeneity: Python for ML, Go for high-throughput API, Node.js for realtime
- Fault isolation: a crash in the recommendation service doesn't take down checkout

**What microservices genuinely cost:**
- Every inter-service call is now a network call: latency, timeouts, partial failures
- Distributed transactions: a payment that spans 3 services can't use a database transaction — requires saga pattern or 2-phase commit
- Operational complexity: N services × (deployment + monitoring + scaling + versioning)
- Data consistency: each service owns its database — querying across services requires APIs, event sourcing, or data warehouses
- Local development: running the full system locally requires docker-compose with 10 services

```
Monolith:     call createOrder() → instant, in-memory, transactional

Microservices: POST /orders → Order Service (HTTP call, 5-50ms)
               → POST /inventory/reserve → Inventory Service (another call)
               → POST /payments/charge → Payment Service (another call)
               Any of these can fail independently. No distributed transaction.
```

---

## 20.3 The Distributed Monolith — The Worst of Both Worlds

A distributed monolith is a system split into multiple services that are tightly coupled — they can't be deployed independently because they depend on each other's implementation details.

**How it happens:**
- Services share a database (schema changes in one service break others)
- Services call each other synchronously in chains (a change in service A requires coordinated changes in B and C)
- Shared code libraries that version-lock all services together
- Services split by technical layer (a "database service", an "API service") rather than by domain

```
❌ Distributed monolith:
Order Service → direct SQL joins against User Service's tables
              → synchronous HTTP call to Inventory Service
              → Inventory Service also calls User Service

Deploy Order Service → must coordinate with Inventory + User
→ same deployment coupling as a monolith, but with network latency too
```

Distributed monoliths are worse than monoliths because you have all the operational complexity of microservices without any of the independence benefits.

---

## 20.4 The Modular Monolith — The Practical Middle Ground

A modular monolith maintains a single deployable unit but enforces strict internal module boundaries — modules can only communicate through defined interfaces, not direct function calls across module internals.

```
app/
  modules/
    auth/
      __init__.py      ← public API of the auth module
      service.py       ← internal, not importable from other modules
      models.py        ← internal
    vocab/
      __init__.py      ← public API
      service.py
    ai/
      __init__.py
      pipeline.py
```

The boundary is enforced by convention (or tooling like `dependency-cruiser` for TypeScript) — other modules can only import from `auth/__init__.py`, not from `auth/service.py` directly.

**Benefits:**
- When/if you need to split out a module, the interface is already clean
- Internal refactoring within a module doesn't break other modules
- Single deployment, no network overhead, shared ACID transactions

**When to split a module into a service:**
1. Different scaling requirements (embed 1000 items/sec vs serve 10 users/sec)
2. Different technology requirements (Python for ML, TypeScript for everything else)
3. Different team ownership with clear domain boundaries
4. Failure isolation is genuinely necessary (payment failures must not cascade)

---

## 20.5 Interview Answer Scripts

**Q: "Should Nativ use microservices?"**

> "No — not at Nativ's current stage. Microservices are a solution to scaling and team coordination problems that Nativ doesn't have yet. The operational cost is real: each service needs its own deployment, monitoring, logging, and scaling configuration. A distributed system introduces network failures, timeouts, and eventual consistency challenges that don't exist in a monolith. At Nativ's scale, a well-organized monolith — or a modular monolith — gives all the development speed benefits of a single codebase without the distributed systems tax. The one exception I'd consider: extracting the AI pipeline (embedding generation, LLM calls) as a separate worker service if it needs to scale differently from the web API or use a different technology. That's a targeted extraction based on a real technical need, not 'microservices as default.'"

**Q: "What's a distributed monolith and how do you avoid it?"**

> "A distributed monolith is a system that's been split into multiple deployed services but remains tightly coupled — you can't change or deploy one service without coordinating with others. It happens when services share a database, when service-to-service calls form long synchronous chains, or when services are split by technical layer (a 'data service', an 'API service') rather than by domain. You get all the operational complexity of microservices with none of the independence. To avoid it: split by domain ownership (users, payments, catalog), not by technical layer. Each service owns its data — no direct cross-service database access. Services communicate through versioned APIs or events, not shared internal state. Before splitting any service, verify you can actually deploy it independently."

**Q: "When would you extract a component into a separate service?"**

> "Three genuine reasons. First, scaling asymmetry: if your ML inference endpoint gets 100x the traffic of your auth service, you should scale them independently — running the whole monolith on big GPU instances for ML is wasteful. Second, technology mismatch: the ML pipeline is Python, the web API is TypeScript — they can coexist in a monolith, but the tooling is painful. A Python microservice for inference is cleaner. Third, fault isolation: if a crash in the recommendation engine should never affect checkout, you need process separation. Notice what's not on this list: 'best practices say microservices', 'it'll be easier to scale later', 'each team should own a service'. These are architectural folklore, not reasons. Extract when you have the specific problem, not before."

**Q: "How do two microservices communicate — synchronously vs asynchronously — and when do you choose each?"**

> "Synchronous communication (HTTP/gRPC) means the caller waits for the response. Use it when you need the result to proceed — a user registration flow that must validate an email in real time, or a price lookup that must be current before displaying a total. The failure mode: if Service B is slow or down, Service A waits and propagates the latency or failure. Asynchronous communication (message queue, events) means Service A publishes an event and moves on; Service B processes it when it can. Use it when the result isn't needed immediately — sending a welcome email after registration, generating a report in the background, or processing a payment confirmation. The failure mode is different: if Service B is down, messages queue up and are processed when it recovers. Events are also better for fan-out (one event, many consumers) and for audit trails. For Nativ, if I extracted the embedding pipeline as a service, I'd use async: the user adds a vocabulary item synchronously (immediate response), and embedding happens asynchronously via a queue."

---

## 20.6 Self-Tests

Try answering these before looking at the answers.

1. You're building a new feature that requires reading data from three different microservices. In a monolith, this is a single SQL query. How does the approach change and what are the tradeoffs?
2. Your team decides to split the payments module into a separate service. What questions do you need to answer before you start?
3. Two microservices share a PostgreSQL database for convenience. What problems does this create?
4. You need to implement a feature where creating a user (User Service) and creating their initial subscription (Subscription Service) must either both succeed or both fail. How do you handle this without a distributed transaction?
5. An engineer argues that starting with microservices gives you flexibility for the future. What's the counterargument?

<details>
<summary>Answers</summary>

1. Instead of a single SQL JOIN, you have three sequential API calls (or parallel with `Promise.all`/`asyncio.gather`). Tradeoffs: (a) Network latency — three HTTP round trips vs one database round trip; if any service is slow, the whole operation is slow. (b) Partial failure — any service can fail independently; you need to handle 503s, timeouts, circuit breakers. (c) No JOIN — you can't filter or sort across service boundaries at the database level; you fetch more data than you need and filter in application code. (d) Eventual consistency — data from the three services might be at different points in time. The data warehouse pattern (sync all services into a single read database) solves the query problem for analytics, but not for transactional reads.

2. Key questions: (a) **What is the API contract?** Define the interface before splitting — what endpoints, what request/response shapes, what error codes. (b) **Who owns the data?** The Payments service needs its own database — identify which tables move, which stay, which need to be duplicated. (c) **How do existing callers change?** Every in-process function call becomes an HTTP call — audit all callers and plan the migration. (d) **How do you handle the transaction boundary?** Payments likely interact with orders, users, notifications — those cross-service interactions need saga patterns or event sourcing. (e) **Deployment and rollback plan?** How do you run old and new simultaneously during migration? (f) **Monitoring and alerting?** The service needs its own logs, metrics, and alerts from day one.

3. Several problems: (a) **Schema coupling** — both services know each other's table structure. A schema change in service A can break service B's queries. (b) **No independent deployment** — you can't evolve the data model of one service without risk to the other. (c) **Loss of service boundaries** — service A can directly query service B's data rather than going through the API, leading to implicit dependencies. (d) **Shared load** — a slow query from service A can starve service B. These are the hallmarks of a distributed monolith. Fix: each service owns its own schema (separate database or at least separate schema within Postgres), and cross-service data access goes through APIs.

4. Use the **Saga pattern** with compensating transactions. A saga is a sequence of local transactions where each step publishes an event. If any step fails, compensating transactions undo prior steps. For user + subscription: (a) Create user (local transaction, publish `UserCreated` event). (b) Subscription service listens for `UserCreated`, creates initial subscription. (c) If subscription creation fails, publish `SubscriptionFailed` event. (d) User service listens for `SubscriptionFailed`, deletes the user (compensating transaction). Alternatively, use the **transactional outbox pattern**: write both the user record and a "pending subscription task" to the User Service database in one transaction. A background job reads the pending task and calls the Subscription Service, retrying until it succeeds.

5. The counterargument: premature microservices don't give you flexibility — they give you constraints. You're making service boundary decisions before you fully understand the domain, and wrong boundaries are expensive to fix. In a monolith, moving code between modules is a refactor. In microservices, moving behavior between services requires changing API contracts, data ownership, and deployment configurations. Martin Fowler's observation: "Almost all the microservices success stories I've seen started with a monolith that became too big and was broken up." The reverse path — building microservices and merging — is much harder. Start with a monolith (or modular monolith), understand your domain, then extract services where there's a genuine technical justification.

</details>

---

← Back to [19. Message Queues & Async Jobs](19-message-queues.md) | Next → [21. System Design Patterns](21-system-design.md)
