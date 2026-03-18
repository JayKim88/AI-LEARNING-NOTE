---
title: "2026-02-26 Session Log"
date: 2026-02-26
description: "debate-plugin: 5-layer AI quality system + debate v2 multi-round engine, prism-debate rename + agent expansion, competitive-agents: planning-interview integration, lingua-rag: local env to production deploy"
tags: ["debate-plugin", "competitive-agents", "lingua-rag"]
---

## Topics Worked On Today

- [lingua-rag: First Production Deploy](#lingua-rag-first-production-deploy)
- [debate-plugin (17:44)](#debate-plugin-1744)
- [debate-plugin (20:06)](#debate-plugin-2006)
- [competitive-agents (20:40)](#competitive-agents-2040)

---

## LinguaRAG: First Production Deploy

> Full pipeline from local environment setup to Render + Vercel production deployment

### What I Did

- **Local environment** — set up PostgreSQL@17, Python venv, npm install, `.env` configuration
- **German TTS** — Web Speech API integration: click bold text in chat to hear pronunciation, with volume slider. Uses browser built-in `speechSynthesis` with `de-DE` locale at rate 0.85
- **Render backend deploy** — Docker-based FastAPI deployment on Render free tier (Singapore region). Created Render PostgreSQL and initialized `schema.sql`
- **Vercel frontend deploy** — Next.js frontend on Vercel, connected to Render backend via `BACKEND_URL` env var. Next.js API routes proxy all backend calls (simplifies CORS and cookie handling)
- **Security upgrade** — Next.js 15.1.4 → 15.5.12 to fix CVE-2025-66478 (was blocking Vercel deployment)

### Key Decisions

- **Railway → Render migration** — Railway dropped their free tier; Render free tier has trade-offs (50s cold start, 90-day DB limit) but works for development stage
- **Next.js API Route proxy pattern** — browser → Vercel `/api/chat` → Render backend. Eliminates CORS configuration and simplifies cookie/auth token passing

### Learnings

- Render web service names are globally unique — `linguarag-backend` was already taken but eventually resolved
- Claude Max subscription API credits are separate from Anthropic API credits — had to purchase $5 API credits separately for the backend

---

## debate-plugin (17:44)

> Implemented 5-layer AI quality system + renamed think-deep → debate v2 + designed and implemented multi-round tiki-taka debate engine

### Done

- feat: designed and implemented 5-layer AI quality system
  - Layer 3 (Output Quality): added Claim Labeling rules to `~/.claude/CLAUDE.md` ([FACT]/[ESTIMATE]/[OPINION]/[UNCERTAIN])
  - Layer 5 (Usage Quality): added Question Routing table to `~/.claude/CLAUDE.md` (technical/values-based/prediction classification)
  - Layer 1 (Input Quality): created `~/.claude/context/` infrastructure (values.md, constraints.md, decision-log.md)
  - Layer 2 (Process Quality): implemented as debate plugin
  - Layer 4 (Validation Quality): implemented as decision-log.md template
- feat(debate): renamed `think-deep` → `debate` plugin (v2.0.0)
- feat(debate): implemented v2 multi-round debate engine — Mode 0 (quick verdict) / Mode 1 (autonomous debate) / Mode 2 (participatory debate)
- feat(debate): added automatic context detection — extracts decision topic from recent conversation even with just "debate" as input
- feat(debate): added Round N Behavior to 4 agents — position tracking ([MAINTAINED/PARTIALLY_CONCEDED/SHIFTED]), cross-rebuttal rules
- feat(debate): selectively adopted llm-council concepts — adopted cross-rebuttal, position tracking, convergence detection; did not adopt anonymization
- chore: created personalized context files in `~/.claude/context/` (values.md, constraints.md, decision-log.md)

### Key Decisions

- **debate vs separate re-verification tool**: Layer 3 always-on claim labeling covers everyday answer reliability, debate Mode 0 covers focused re-verification → no need for a separate tool
- **Anonymization not adopted**: llm-council anonymization is for preventing multi-LLM prestige bias — in single Claude model, role names are needed for tiki-taka structure
- **Claude Max = no additional API cost**: Task() calls are included in subscription, no round limits needed

### Next

- [ ] Test an actual decision with debate Mode 0 (e.g. tech stack choice, career decision)
- [ ] Record first real entry in decision-log.md
- [ ] Consider adding "verify" mode: shortcut to post-hoc verify a specific Claude answer via debate agents
- [ ] Strengthen Layer 1: actively use and update `~/.claude/context/` files

---

## debate-plugin (20:06)

> Renamed debate → prism-debate + added 2 new agents (Alternative, Pre-Mortem) + Worldview characterization + README v2 (Mermaid + How It Works)

### Done

- feat(prism-debate): renamed `debate` → `prism-debate` (v3.0.0) — `plugins/debate/` → `plugins/prism-debate/`, triggers `prism`/`prism-debate`/`/prism`
- feat(prism-debate): created 2 new agents
  - `agents/alternative.md` — "The Inventor" (REFRAME): proposes 2-3 concrete alternatives outside the proposition, based on De Bono Green Hat
  - `agents/pre-mortem.md` — "The Oracle" (FUTURE FAILURE): assumes failure as a given and traces back, 5 Whys causal chain. Based on Gary Klein PreMortem
- feat(prism-debate): Worldview characterization for all agents (Moltbook insight)
  - Optimist → "The Builder" / Critic → "The Skeptic" / Pragmatist → "The Operator" / Synthesizer → "The Judge"
- feat(prism-debate): added Core/Extended agent selection logic to SKILL.md — Core 3 (Optimist+Critic+Pragmatist) / Extended 5 (+Alternative+Pre-Mortem)
- docs(prism-debate): full README v2 overhaul — 2 Mermaid diagrams, How It Works, Context Integration, Output Reference sections
- docs(prism-debate): full CLAUDE.md update (v3.0.0 architecture, agent table, validation checklist)

### Key Decisions

- **Name prism-debate**: combines "prism" (purpose: multi-angle analysis) + "debate" (mechanism: cross-rebuttal) to convey both why and how
- **De Bono Six Hats mapping**: Yellow(Optimist) + Black(Critic) + White(Pragmatist) + Green(Alternative) + separate Oracle(Pre-Mortem)
- **Moltbook insight**: Worldview is more consistent and predictable than Stance (FOR/AGAINST) for characterizing agents
- **Alternative added first**: binary blind spot (A vs not-A) is the most universal blind spot → first extended agent
- **Pre-Mortem differs from Critic**: Critic identifies risks in forward direction, Pre-Mortem assumes failure and traces back → justifies separate agent
- **2-tier structure**: Core 3 (always) + Extended 2 (optional) — balances minimizing complexity vs analysis depth

### Next

- [ ] Test an actual decision with prism-debate Mode 0 Core (e.g. tech stack, career decision)
- [ ] Test prism-debate Extended mode — confirm Alternative + Pre-Mortem work in practice
- [ ] Record first real entry in decision-log.md
- [ ] Design future agents: Gut Check (Red Hat / intuition & values) + Red Team (adversarial attack simulation)
- [ ] Strengthen Layer 1: actively use `~/.claude/context/` files during actual debates

---

## competitive-agents (20:40)

> Connected planning-interview outputs as competitive-agents input + removed dev-log.md + removed frontmatter version field

### Done

- feat(competitive-agents): added "Use planning-interview outputs" option to Step 1 — takes directory path and reads prd.md, user-journey-map.md, tech-spec.md, wireframe-spec.md to aggregate as mission context
- feat(competitive-agents): added planning-interview docs copy logic to Step 11.5 — when `planning_docs_path` is set, copies files as-is to `final/docs/`
- chore(competitive-agents): removed `dev-log.md` generation from Step 11.5 — low practical value as an empty template
- fix(competitive-agents): removed `version` field from SKILL.md frontmatter — unsupported attribute in skill files (resolves IDE warnings)
- docs(competitive-agents): updated Step 12 completion summary and Quick Reference output tree to reflect planning-interview docs

### Key Decisions

- **planning-interview → competitive-agents connection**: planning-interview generates 4 docs (prd/user-journey/tech-spec/wireframe), using them directly as mission context is the natural workflow
- **dev-log.md removed**: empty templates have low generation value and users are better off creating their own. decisions.md (ADR) alone is sufficient for project history
- **version field removed**: confirmed as unsupported attribute in Claude Code skill files → removed entirely

### Next

- [ ] Verify Step 11.5 behavior after competitive-agents run (select generate_docs = Yes)
  - [ ] Confirm decisions.md ADR quality — test that it extracts correctly from judge report
  - [ ] Confirm spec.md copy behavior when spec file is provided
- [ ] Test full planning-interview → competitive-agents flow — generate 4 docs with planning-interview → select "Use planning-interview outputs" in competitive-agents → verify final/docs/
