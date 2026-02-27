---
title: "Make Something Agents Want: 3 Conditions for Software to Survive in the Agent Era"
date: 2026-02-23
description: "YC's philosophy has shifted from \"Make something people want\" to **\"Make something agents want\"**. In an era where agents choose, recommend, and deploy, the value axis of software has fundamentally moved. YC Lightcone,..."
category: digests
tags: ["ai", "agent-economy", "software-strategy", "yc", "a16z", "harness", "vertical-saas"]
source: "https://www.linkedin.com/posts/gb-jeong_make-something-agents-want-yc%EC%9D%98-%EC%B2%A0%ED%95%99%EC%9D%B4-%EB%92%A4%EC%A7%91%ED%98%94%EC%8A%B5%EB%8B%88%EB%8B%A4-share-7431384260416196608-Y0AB"
draft: false
---

## Summary

YC's philosophy has shifted from "Make something people want" to **"Make something agents want"**. In an era where agents choose, recommend, and deploy, the value axis of software has fundamentally moved. YC Lightcone, a16z, and Lablup's Shin Jeong-gyu — three sources all pointing in the same direction — converge on **3 conditions** for surviving the agent era: (1) documentation that agents choose, (2) a harness rather than code, (3) an unreplicable domain.

The core message is **value migration**: code → documentation → harness → domain. The value of code itself converges to zero, and the true moat lies in domain knowledge and customer lock-in.

## Key Concepts

### 1. Agent-Chosen Documentation

- **What**: When an agent (LLM) selects a tool or service, documentation quality is the decisive criterion
- **Why**: Agents understand the world through APIs and documentation, not landing pages
- **Impact**: A 5% difference in documentation quality → several times the difference in customer count

| Winner | Loser | Difference |
|--------|-------|------------|
| **Supabase** | Competing DBs | "Best documentation" — mentioned by YC Lightcone |
| **Resend** | SendGrid (10,000+ employees) | Built LLM.txt, agent-friendly documentation → ChatGPT inbound Top 3 |
| **Mintlify** | — | A tool that converts all developers' documentation into agent-friendly format |

- **New formula**: SEO era = Google brings customers → **Agent era = documentation brings customers**
- **Actionable insight**: LLM.txt, structured API documentation, code-snippet-first documentation design

### 2. Harness, Not Code

- **What**: A context + workflow system that makes agents work automatically
- **Why**: Code is churned out by agents and models get swapped out, but harness accumulates organizational know-how
- **Impact**: "The value of code converges to zero, but the harness that produces it is the new definition of software" — Shin Jeong-gyu

**Lablup case (40 days, 1 million lines):**

| Component | Role |
|-----------|------|
| `CLAUDE.md` | Context definition (SOUL Document) |
| `PROGRESS.md` | Progress tracking |
| `PLAN.md` | Plan management |
| Cron (every 15 min) | Issue analysis → code generation → PR → merge automation |
| Sub-agents (up to 50) | Parallel processing, humans review only |

**Non-technical roles case:**

| Role | Outcome |
|------|---------|
| CFO | 30 minutes of learning → 2-hour task reduced to 3 minutes |
| Content manager | 250 documents converted in 1 week + news crawling automation harness built |

- **Key distinction**: They didn't learn to code — they **built a harness**

### 3. Unreplicable Domain

- **What**: Documentation and harness will eventually be caught up to → the final moat is domain knowledge
- **Why**: 10 years of edge cases + customer lock-in that general-purpose AI cannot replicate all at once
- **Impact**: a16z data — Vertical SaaS beats Finance/ERP/Marketing/Productivity across the board

**"Install the waterwheel where the water falls hardest"** — Shin Jeong-gyu

| Domain | Why It Cannot Be Replicated |
|--------|----------------------------|
| Construction settlement logic | Complex subcontracting structure, conventions, exception handling |
| Medical insurance claims | Regulations, code systems, review criteria |
| Logistics dispatch optimization | Real-time variables, driver patterns, regional characteristics |

**Replicable vs. Unreplicable:**

| Replicable (caught up quickly) | Unreplicable (true moat) |
|-------------------------------|--------------------------|
| Tool proficiency | Knowledge of customer failure patterns |
| Prompting techniques (spreads within a week) | Memory of problems solved together over years |
| Agent-friendly documentation (Mintlify arrives) | Knowing what that organization will never be able to do |
| Harness patterns | Edge cases accumulated over 10 years |

## Practical Applications

### Use Case 1: Agent-Friendly Documentation Design
- Add **LLM.txt** to API documentation (reference the Resend case)
- Place code snippets at the top of documentation
- Design structured metadata for easy agent parsing
- Evaluate adopting tools like Mintlify

### Use Case 2: Building an Organizational Harness
- Introduce a SOUL Document system based on CLAUDE.md / PROGRESS.md / PLAN.md
- Build a GitHub Issue → PR → Merge automation pipeline
- Train non-technical roles to build harnesses (not coding education — harness education)

### Use Case 3: Evaluating Domain Moat
- Measure the "IT-to-domain gap" of your own service
- Catalog unreplicable domain assets (edge cases, customer relationships, regulatory knowledge)
- Explore Vertical SaaS opportunities: construction, healthcare, logistics, and other high-gap areas

## Value Migration Framework

```
Code
  ↓ Agents can generate it → value converges to zero
Documentation
  ↓ Democratized by tools like Mintlify → caught up to
Harness
  ↓ Once patterns spread → caught up to
Domain Knowledge
  → 10 years of accumulation + customer lock-in = true moat
```

**Survival conditions checklist:**
1. Do you have documentation that agents choose?
2. Are you accumulating a harness rather than just code?
3. Do you have an unreplicable domain moat?

## Limitations & Gotchas

- Documentation quality alone cannot serve as a long-term moat (tools like Mintlify level the playing field)
- Harness patterns will eventually spread — the differentiation window is limited
- The "agent era" does not apply equally to all B2B SaaS — the impact is felt first in developer tooling where agent penetration is highest
- Even Vertical SaaS moats are not permanent — domain-specific LLMs may emerge and narrow the gap

## References

- [Original post - GB Jeong LinkedIn Post](https://www.linkedin.com/posts/gb-jeong_make-something-agents-want-yc%EC%9D%98-%EC%B2%A0%ED%95%99%EC%9D%B4-%EB%92%A4%EC%A7%91%ED%98%94%EC%8A%B5%EB%8B%88%EB%8B%A4-share-7431384260416196608-Y0AB)
- [YC Lightcone video](https://lnkd.in/gRzR5Tyx)
- [a16z Vertical SaaS data](https://lnkd.in/g2CWbdrq)
- [Related - Noh Jeong-seok](https://lnkd.in/ggUTB56j)
- Lablup / Shin Jeong-gyu — SOUL Document, Claude Code usage case
- Resend — LLM.txt, agent-friendly documentation
- Mintlify — agent-friendly documentation conversion tool
- Agent Mail — email service dedicated to agents

## Next Steps

- [ ] Research LLM.txt spec and evaluate applying it to current projects
- [ ] Experiment with the SOUL Document system (CLAUDE.md / PROGRESS.md / PLAN.md)
- [ ] Evaluate current project's agent-friendliness (documentation structure, API design)
- [ ] Research Vertical SaaS opportunity areas (based on a16z data)
- [ ] Evaluate Mintlify adoption or establish internal agent-friendly documentation guidelines

---

**Notes**:
The core of this post is "value migration." The framework that value moves along the path of code → documentation → harness → domain is an extremely practical strategic guide for anyone currently building AI agent tools. In particular, the harness concept connects directly to Claude Code's CLAUDE.md-based workflow, and is useful for distinguishing what is already being practiced from what needs to be strengthened.
