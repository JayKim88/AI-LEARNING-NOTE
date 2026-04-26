# Backend Concepts — Full-Stack Learning Roadmap

A structured study plan for full-stack interview preparation, organized by priority.
All documents are in `backend-interview-guide-en/` unless otherwise noted.

---

## Phase 1 — Database (Highest Priority)

Interview frequency: **very high**. Almost every backend interview touches SQL or data modeling.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 1 | SQL Queries Deep Dive | [`4-sql-fundamentals.md`](backend-interview-guide-en/4-sql-fundamentals.md) | INNER/LEFT/RIGHT JOIN, subqueries, window functions (ROW_NUMBER, RANK, PARTITION BY) |
| 2 | Index Mechanics + Query Optimization | [`4-sql-fundamentals.md`](backend-interview-guide-en/4-sql-fundamentals.md) | B-tree structure, composite index column order, EXPLAIN ANALYZE, covering index |
| 3 | Transactions + ACID + Isolation Levels | [`4-sql-fundamentals.md`](backend-interview-guide-en/4-sql-fundamentals.md) | Atomicity, dirty read, phantom read, READ COMMITTED vs REPEATABLE READ, MVCC |
| 4 | N+1 Problem + Solutions | [`4-sql-fundamentals.md`](backend-interview-guide-en/4-sql-fundamentals.md) | Detection, eager loading, DataLoader pattern, ORM-level fixes |

---

## Phase 2 — API Design

Interview frequency: **high**. Tests engineering maturity and production experience.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 5 | REST Principles + HTTP Status Codes | [`2-rest-api-design.md`](backend-interview-guide-en/2-rest-api-design.md) | Stateless, resource-oriented, 200/201/400/401/403/404/409/500 semantics |
| 6 | Pagination (Offset vs Cursor) | [`2-rest-api-design.md`](backend-interview-guide-en/2-rest-api-design.md) | Offset drift problem, cursor stability, keyset pagination |
| 7 | Idempotency + Rate Limiting | [`2-rest-api-design.md`](backend-interview-guide-en/2-rest-api-design.md) | Idempotency keys, token bucket vs sliding window, 429 Too Many Requests |

---

## Phase 3 — Authentication & Authorization

Interview frequency: **high**. Security mistakes are uniquely dangerous — interviewers probe this carefully.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 8 | OAuth 2.0 Flow + PKCE | [`3-auth.md`](backend-interview-guide-en/3-auth.md) | Authorization Code flow, PKCE for SPAs, access token vs refresh token, token rotation |
| 9 | RBAC Design | [`3-auth.md`](backend-interview-guide-en/3-auth.md) | Role vs permission, role hierarchy, attribute-based access control (ABAC) |

---

## Phase 4 — Caching

Interview frequency: **medium-high**. Shows understanding of performance tradeoffs.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 10 | Cache Strategies (3 patterns) | [`9-redis.md`](backend-interview-guide-en/9-redis.md) | Cache-Aside (lazy loading), Write-Through, Write-Back; when to use each |
| 11 | Redis Basics + Cache Invalidation | [`9-redis.md`](backend-interview-guide-en/9-redis.md) | String/Hash/Set/Sorted Set, TTL, cache stampede, tag-based invalidation |

---

## Phase 5 — Concurrency

Interview frequency: **medium**. Production experience signal — these bugs don't appear in tests.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 12 | Race Conditions + Optimistic/Pessimistic Locking | [`18-concurrency.md`](backend-interview-guide-en/18-concurrency.md) | Lost update problem, SELECT FOR UPDATE, version column, compare-and-swap |
| 13 | Job Queue Patterns | [`19-message-queues.md`](backend-interview-guide-en/19-message-queues.md) | Why queues exist, at-least-once vs exactly-once delivery, dead letter queues, retry backoff |

---

## Phase 6 — Security

Interview frequency: **medium**. Tests whether you write secure code by default.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 14 | SQL Injection + Input Validation | [`27-security.md`](backend-interview-guide-en/27-security.md) | Parameterized queries, ORM safety, server-side validation, OWASP Top 10 |
| 15 | Secrets Management | [`27-security.md`](backend-interview-guide-en/27-security.md) | Environment variables, secret rotation, never commit credentials, Vault basics |

---

## Phase 7 — System Design

Interview frequency: **medium** (higher for senior roles). Architecture thinking signal.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 16 | Monolith vs Microservices | [`20-microservices.md`](backend-interview-guide-en/20-microservices.md) | When to split, distributed systems complexity, service boundaries, strangler fig pattern |
| 17 | Message Queues (Kafka, RabbitMQ) | [`19-message-queues.md`](backend-interview-guide-en/19-message-queues.md) | Pub/sub vs point-to-point, consumer groups, offset management, ordering guarantees |
| 18 | Horizontal/Vertical Scaling + Load Balancing | [`21-system-design.md`](backend-interview-guide-en/21-system-design.md) | Stateless servers, sticky sessions, round robin vs least connections, CDN |
| 19 | CAP Theorem | [`34-cap-theorem.md`](backend-interview-guide-en/34-cap-theorem.md) | CP vs AP, eventual consistency, PACELC, real-world database classification |

---

## Phase 8 — Observability

Interview frequency: **low-medium**. Strong signal for production experience.

| # | Topic | Document | Key Concepts |
|---|-------|----------|--------------|
| 20 | Structured Logging + Metrics + Distributed Tracing | [`29-observability.md`](backend-interview-guide-en/29-observability.md) | Log levels, structured JSON logs, p50/p95/p99 latency, trace context propagation |

---

## Study Order Recommendation

```
Week 1-2:  Phase 1 (SQL) — highest ROI, most frequently tested
Week 3:    Phase 2 (API Design) + Phase 3 (Auth)
Week 4:    Phase 4 (Caching) + Phase 5 (Concurrency)
Week 5:    Phase 6 (Security) + Phase 7 (System Design)
Week 6:    Phase 8 (Observability) + review weak areas
Ongoing:   1 algorithm problem per day (coding test bottleneck)
```

---

## Coverage vs Jay's Existing Experience

| Area | Nativ Evidence | Study Priority |
|------|---------------|----------------|
| SQL / DB design | 23 migrations, pgvector schema | Index + transaction depth |
| REST API | FastAPI endpoints | Status code semantics, idempotency |
| Auth | 5-layer guest→login, JWT | OAuth 2.0 flow, RBAC |
| Caching | Prompt caching (75% cost reduction) | Redis patterns, invalidation |
| Testing | 163 integration tests | Already strong |
| Concurrency | — | Race conditions, locking |
| Security | — | SQL injection, secrets |
| System design | Docker + CI/CD + Koyeb | CAP, scaling, queues |
| Observability | — | Structured logging, metrics |
