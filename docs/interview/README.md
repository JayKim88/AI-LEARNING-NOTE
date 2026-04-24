# Backend Interview Guide — English Edition

> **Target:** AI startup Fullstack / Applied AI Engineer interviews
> **Stack:** FastAPI · Python · PostgreSQL/pgvector · SQLAlchemy · Next.js · TypeScript · OpenAI/Claude · LangChain/LangGraph
> **Philosophy:** Understand deeply, not memorize blindly. Every concept here has a *reason*.

---

## Writing Conventions

Every section in this guide follows the same structure and quality bar. This section defines that bar — both for consistency and so the document remains useful as a study tool, not just a reference.

### Section Structure (required, in this order)

```
# {N}. {Topic Title}

### Why This Section Matters
  - What goes wrong when you don't know this
  - What the interviewer is actually probing for
  - 2–3 concrete "what interviewers actually ask" bullets

---

## {N}.1  {Subsection Title}
## {N}.2  ...
...
## {N}.{n-2}  Interview Answer Scripts
## {N}.{n-1}  Self-Tests
```

The last two subsections are always **Interview Answer Scripts** and **Self-Tests**, in that order.

---

### Writing Rules

**1. First principles before tables.**
Every concept must be explained in plain prose before a table or list appears. The reader should understand *why* the thing works before seeing *what* it is.

Good: "Idempotent means calling it multiple times has the same *effect* as calling it once..."
Bad: Starting directly with a table of HTTP methods.

**2. Every "what" must have a "why".**
After stating a fact, add the consequence. Not just "401 means unauthenticated" but "...which means monitoring tools that only check status codes will treat a real auth failure as success if you return 200."

**3. "Common confusion" notes where real mistakes happen.**
Any concept that developers frequently get wrong in production deserves an explicit callout block. Use bold or a standalone paragraph starting with **"Common confusion:"** or **"Common mistake:"**.

**4. Code examples must be runnable and minimal.**
- Include real imports. No placeholder pseudocode.
- Every example must have a comment explaining the non-obvious line.
- Prefer FastAPI / Python examples for backend concepts; TypeScript for frontend concepts.

**5. Diagrams are required for any multi-party flow.**
If a concept involves more than two parties exchanging messages (CORS preflight, OAuth, TLS handshake, SSE stream), include a Mermaid diagram. ASCII art is acceptable as fallback, but Mermaid is preferred.

```
Use sequenceDiagram for request/response flows.
Use flowchart TD for data pipelines and decision trees.
Use stateDiagram-v2 for state machines.
```

**6. Interview scripts must sound human.**
- Write them as spoken English, not bullet points.
- Each script must include: the core answer + one tradeoff or edge case + one real-world or Nativ example where applicable.
- Minimum 4 scripts per section. Add one for every major subsection concept.

**7. Self-tests must test judgment, not recall.**
- Avoid questions where the answer is "look it up in the table above."
- Good question types: "Which would you choose and why?", "What goes wrong if...?", "Your colleague did X — what's the bug?", "Walk me through what happens when..."
- Exactly 5 self-test questions per section.
- Answers go inside `<details><summary>Answers</summary>` toggles.
- Answers must explain *why*, not just state the correct answer.

**8. Nativ connection where relevant.**
If the concept maps to something built in Nativ (hybrid RAG, prompt caching, SSE streaming, pgvector), include a short callout:
> **Nativ connection:** Prompt caching uses `Cache-Control` semantics at the LLM API layer — same mental model.

This transforms abstract knowledge into a concrete story for interviews.

**9. Length target.**
Each section should be long enough to be self-contained (no need to Google during study), but not a textbook. Rough targets:
- Core concept + explanation: 1–3 paragraphs per subsection
- Tables: 5–15 rows
- Code examples: 10–30 lines
- Total section length: 350–600 lines

**10. Navigation footer.**
Every section ends with:
```
← Back to [Index](../README.md) | Next → [N+1. Topic](N+1-filename.md)
```

**11. Calibrate depth to AI startup interviews, not FAANG.**

Every concept should be deep enough to answer a follow-up question, but not deeper than what an AI startup interviewer would realistically probe. When in doubt, ask: *"Would a senior engineer at Notion, Linear, or PostHog ask this in a backend screen?"*

**Cut these — they belong in FAANG / network-engineer / SRE interviews, not here:**

| Category | Examples to cut |
|----------|----------------|
| Protocol field internals | TCP sequence numbers, TLS `ClientHello` field structure, cipher suite negotiation details |
| OS-level tuning | `net.ipv4.tcp_tw_reuse`, `SO_REUSEADDR`, kernel socket buffers |
| Infra/ops-only knowledge | DNS record types beyond A and CNAME (MX, TXT, SPF, DKIM), CNAME-at-apex constraints |
| Crypto primitives | ECDHE key exchange math, MAC construction, cipher suite naming |
| Protocol version minutiae | HPACK vs QPACK internals, QUIC stream ID encoding |

**Keep these — they come up at the target companies:**

- The *concept* and *tradeoff* of the thing (e.g., "forward secrecy means past sessions are safe even if the key leaks")
- One concrete failure mode or production consequence
- The answer a senior engineer would give in 45 seconds, not a textbook chapter

---

### Quality Checklist (self-review before marking ✅)

Before marking a section complete, verify:

- [ ] "Why This Section Matters" names at least one concrete failure mode
- [ ] Every table is preceded by a prose explanation
- [ ] Every multi-party flow has a diagram
- [ ] "Common confusion" note exists for the most misunderstood concept
- [ ] At least one code example with real imports and inline comments
- [ ] ≥ 4 interview scripts, each with tradeoff + example
- [ ] Exactly 5 self-tests, all judgment-based (not lookup-based)
- [ ] Nativ connection noted where relevant
- [ ] Navigation footer present

---

## Sections

| # | Topic | Status |
|---|-------|--------|
| 1 | [HTTP & Networking](backend-interview-guide-en/1-http-networking.md) | ✅ |
| 2 | [REST API Design](backend-interview-guide-en/2-rest-api-design.md) | ✅ |
| 3 | [Authentication & Authorization](backend-interview-guide-en/3-auth.md) | ✅ |
| 4 | [SQL Fundamentals](backend-interview-guide-en/4-sql-fundamentals.md) | ✅ |
| 5 | [PostgreSQL Deep Dive](backend-interview-guide-en/5-postgresql.md) | ✅ |
| 6 | [SQLAlchemy 2.x](backend-interview-guide-en/6-sqlalchemy.md) | ✅ |
| 7 | [Alembic](backend-interview-guide-en/7-alembic.md) | ✅ |
| 8 | [pgvector](backend-interview-guide-en/8-pgvector.md) | ✅ |
| 9 | [Redis & Caching](backend-interview-guide-en/9-redis.md) | ✅ |
| 10 | [Python Internals](backend-interview-guide-en/10-python-internals.md) | ✅ |
| 11 | [FastAPI Advanced](backend-interview-guide-en/11-fastapi.md) | ✅ |
| 12 | [Pydantic v2](backend-interview-guide-en/12-pydantic.md) | ✅ |
| 13 | [JavaScript Core](backend-interview-guide-en/13-javascript.md) | ✅ |
| 14 | [TypeScript Advanced](backend-interview-guide-en/14-typescript.md) | ✅ |
| 15 | [Node.js Backend](backend-interview-guide-en/15-nodejs.md) | ✅ |
| 16 | [Next.js App Router](backend-interview-guide-en/16-nextjs.md) | ✅ |
| 17 | [Streaming (SSE / WebSocket)](backend-interview-guide-en/17-streaming.md) | ✅ |
| 18 | [Concurrency & Race Conditions](backend-interview-guide-en/18-concurrency.md) | ✅ |
| 19 | [Message Queues & Async Jobs](backend-interview-guide-en/19-message-queues.md) | ✅ |
| 20 | [Microservices vs Monolith](backend-interview-guide-en/20-microservices.md) | ✅ |
| 21 | [System Design Patterns](backend-interview-guide-en/21-system-design.md) | ✅ |
| 22 | [LLM API Patterns](backend-interview-guide-en/22-llm-api.md) | ✅ |
| 23 | [RAG Systems Deep Dive](backend-interview-guide-en/23-rag.md) | ✅ |
| 24 | [LangChain / LangGraph](backend-interview-guide-en/24-langchain.md) | ✅ |
| 25 | [Data Structures Quick Reference](backend-interview-guide-en/25-data-structures.md) | ✅ |
| 26 | [Algorithm Patterns (Easy–Medium)](backend-interview-guide-en/26-algorithms.md) | ✅ |
| 27 | [Security (OWASP)](backend-interview-guide-en/27-security.md) | ✅ |
| 28 | [Testing](backend-interview-guide-en/28-testing.md) | ✅ |
| 29 | [Observability & Debugging](backend-interview-guide-en/29-observability.md) | ✅ |
| 30 | [DevOps Essentials](backend-interview-guide-en/30-devops.md) | ✅ |
| 31 | [Linux / Process Basics](backend-interview-guide-en/31-linux.md) | ✅ |
| 32 | [Scenario-based Questions](backend-interview-guide-en/32-scenarios.md) | ✅ |
| 33 | [Action Plan](backend-interview-guide-en/33-action-plan.md) | ✅ |
