# 33. Action Plan

### How to Use This Guide

You've now read (or are about to read) 32 sections covering every technical domain that comes up in AI startup backend interviews. The question isn't "did I cover everything" — it's "am I converting this knowledge into interview performance."

This section is the bridge from knowing to doing.

---

## 33.1 The 80/20 of What Interviewers Actually Test

Not all 32 sections are equally likely to appear. Based on AI startup interview patterns, here's where to spend your time:

**Highest priority — comes up in almost every interview:**

| Section | Why it's high priority |
|---------|----------------------|
| §8 pgvector | Nativ is your portfolio story — you need to own this |
| §22 LLM API Patterns | Core to "AI engineer" positioning |
| §23 RAG Systems | "Walk me through your RAG system" is the most common question |
| §11 FastAPI | The framework you use daily — every question connects here |
| §3 Authentication | Auth bugs are expensive — interviewers probe this |
| §21 System Design | Every interview has a design component |
| §27 Security | OWASP basics are table stakes |

**High priority — comes up frequently:**

| Section | Notes |
|---------|-------|
| §4 SQL Fundamentals | N+1, indexes, CTEs |
| §5 PostgreSQL | MVCC, EXPLAIN, connection pooling |
| §9 Redis | Caching, rate limiting |
| §10 Python Internals | Async/await, GIL |
| §18 Concurrency | Race conditions, SELECT FOR UPDATE |
| §28 Testing | "How do you test async FastAPI?" |

**Medium priority — prepare for take-home or deeper technical rounds:**

- §24 LangChain/LangGraph (for agent roles)
- §17 Streaming (for real-time AI roles)
- §16 Next.js (for fullstack roles)
- §13-14 JavaScript/TypeScript (for frontend-heavy roles)

**Lower priority — know the concepts, don't memorize:**

- §25-26 Data Structures / Algorithms (light prep is enough for AI startups)
- §30-31 DevOps / Linux (know the basics; deep expertise not expected for product engineers)

---

## 33.2 Weekly Study Plan — 4 Weeks to Interview-Ready

### Week 1 — Foundation (Portfolio + Core Backend)

**Goal:** Be able to explain Nativ's architecture fluently and answer every question in §8 and §22-23.

| Day | Focus |
|-----|-------|
| Mon | §8 pgvector — read + answer all self-tests out loud |
| Tue | §23 RAG Systems — deep read, build explanation script |
| Wed | §22 LLM API Patterns — prompt caching, tool use, structured output |
| Thu | §11 FastAPI — Depends, yield, BackgroundTasks, middleware |
| Fri | §3 Authentication — JWT attacks, OAuth, PKCE |
| Sat | Practice: "Tell me about the Nativ architecture" — record yourself, refine |
| Sun | §9 Redis — cache stampede, rate limiting, session store |

### Week 2 — Database + Python Internals

| Day | Focus |
|-----|-------|
| Mon | §4 SQL Fundamentals — EXPLAIN ANALYZE, N+1, window functions |
| Tue | §5 PostgreSQL — MVCC, VACUUM, index types |
| Wed | §6 SQLAlchemy + §7 Alembic — ORM patterns, zero-downtime migrations |
| Thu | §10 Python Internals — event loop, GIL, asyncio |
| Fri | §18 Concurrency — SELECT FOR UPDATE, optimistic locking |
| Sat | Mock interview: system design question (design Nativ's backend) |
| Sun | §12 Pydantic v2 — validators, model_dump, from_attributes |

### Week 3 — Full Stack + Architecture

| Day | Focus |
|-----|-------|
| Mon | §13-14 JavaScript/TypeScript — closures, this, discriminated unions |
| Tue | §16 Next.js App Router — RSC, Server Actions, caching |
| Wed | §17 Streaming — SSE implementation, LLM streaming |
| Thu | §19-20 Message Queues + Microservices |
| Fri | §21 System Design — read + answer 5 self-tests |
| Sat | Mock system design: "Design a document QA system" |
| Sun | §27 Security — OWASP top 5, SQL injection, auth failures |

### Week 4 — Consolidation + Interview Polish

| Day | Focus |
|-----|-------|
| Mon | §28 Testing + §29 Observability — both important for senior engineers |
| Tue | §32 Scenarios — talk through 3 scenarios out loud |
| Wed | Revisit highest-priority sections, read your own interview answer scripts |
| Thu | Mock technical screen (45 min) with a study partner |
| Fri | Light review — don't cram. Confidence maintenance. |
| Sat | Final prep: rehearse Nativ story, review open questions |
| Sun | Rest |

---

## 33.3 The Nativ Story — Your Core Interview Asset

Every technical interview at an AI startup should eventually connect to Nativ. This is your worked example, your proof of experience. Prepare 3-minute and 8-minute versions.

**3-minute version (screening call):**
> "Nativ is an AI-powered language tutor. The core feature is vocabulary learning with a RAG system: users add vocabulary items, those items are embedded and stored in pgvector, and when users practice, the system retrieves relevant context via hybrid search — combining semantic vector search with keyword search using Reciprocal Rank Fusion. The LLM generates personalized explanations grounded in the user's own vocabulary history. The backend is FastAPI + PostgreSQL/pgvector, with Anthropic's API for generation. I use prompt caching on the static system prompt, which reduced per-request LLM costs by ~90%."

**Technical deep dive questions you should be able to answer fluently:**
- Why hybrid search over pure vector search?
- Why pgvector over Pinecone?
- How does prompt caching work in Nativ?
- How did you handle the N+1 problem in vocabulary queries?
- Walk me through a user's request from API entry to LLM response.
- How would you scale Nativ to 100,000 users?
- What would you add to the test suite?

---

## 33.4 Interview Frameworks

**For system design questions:**
```
1. Clarify requirements (2 min)
   - Scale: DAU, requests/sec, data size
   - Functional: core features
   - Non-functional: latency, consistency, availability

2. High-level architecture (3 min)
   - Draw the main components and connections
   - State your assumptions

3. Deep dive on the interesting parts (15 min)
   - Data model
   - Key algorithms and data structures
   - Bottlenecks and how to address them

4. Tradeoffs and alternatives (5 min)
   - What would you do differently at 10x scale?
   - What's the first thing to break?
```

**For debugging/scenario questions:**
```
1. Clarify: "Just to make sure I understand — the symptom is X?"
2. Gather info before acting: "What changed? What do the metrics show?"
3. Narrow scope: "Is it all users or specific users? All endpoints or one?"
4. Form hypothesis: "My first hypothesis is..."
5. Test the hypothesis: "I'd check X by doing Y."
6. Fix and verify: "After fixing X, I'd verify by Z."
```

**For behavioral questions:**
```
STAR structure:
- Situation: context, constraints
- Task: what you needed to accomplish
- Action: what you specifically did (emphasize your thinking)
- Result: measurable outcome

End with: "What I learned from this was..."
```

---

## 33.5 What to Do the Day Before

- Read your interview answer scripts for the 5 sections most relevant to the role
- Review your Nativ architecture — draw it from memory
- Sleep. Seriously. Cognitive performance degrades more from one bad night of sleep than from missing a day of study.

---

## 33.6 What to Do If You Don't Know the Answer

In order of preference:

1. **Say what you do know** — "I haven't used X directly, but based on how Y works, I'd expect..."
2. **Ask to think out loud** — "Can I take 30 seconds to think through this?"
3. **Work from first principles** — "I'd start by... because..." (even if wrong, shows reasoning)
4. **Acknowledge and redirect** — "I'm not certain on the specific implementation, but I do have experience with the underlying concept from..."

Never bluff. Interviewers know their subject — bluffing is worse than saying "I don't know."

---

## 33.7 Final Checklist

Before each interview:

- [ ] Can you explain the Nativ architecture in 3 minutes?
- [ ] Can you answer "why pgvector over Pinecone" without hesitation?
- [ ] Do you know what HNSW is and what `m` and `ef_construction` mean?
- [ ] Can you explain prompt caching and why it reduced costs by 90%?
- [ ] Do you know the difference between `SELECT FOR UPDATE` and a regular transaction?
- [ ] Can you explain what happens when you call `time.sleep(5)` in an async FastAPI handler?
- [ ] Do you have a prepared answer for "tell me about a time you fixed a production bug"?
- [ ] Do you know what questions to ask them? (Team structure, deploy process, tech stack challenges)

---

Good luck. The work is done. Trust the preparation.

---

← Back to [32. Scenario-based Questions](32-scenarios.md) | Back to [Index](../README.md)
