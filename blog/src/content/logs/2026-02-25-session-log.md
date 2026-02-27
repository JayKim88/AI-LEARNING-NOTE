---
title: "2026-02-25 Session Log"
date: 2026-02-25
description: "lingua-rag planning + F1 implementation (competitive-agents), planning-interview v2.0 integration, business-avengers v2.1 audit, truth-checker idea, plugin-tester design..."
tags: ["lingua-rag", "business-avengers", "planning-interview", "plugin-tester", "competitive-agents", "lingua-rag-planning-docs", "truth-checker"]
---

## Topics Worked On Today

- [lingua-rag (01:34)](#lingua-rag-0134)
- [business-avengers (14:51)](#business-avengers-1451)
- [lingua-rag (14:52)](#lingua-rag-1452)
- [planning-interview (15:06)](#planning-interview-1506)
- [planning-interview (15:19)](#planning-interview-1519)
- [plugin-tester (17:16)](#plugin-tester-1716)
- [lingua-rag (17:16)](#lingua-rag-1716)
- [competitive-agents (17:16)](#competitive-agents-1716)
- [lingua-rag-planning-docs (18:15)](#lingua-rag-planning-docs-1815)
- [planning-interview (18:15)](#planning-interview-1815)
- [truth-checker (20:30)](#truth-checker-2030)

---

## lingua-rag (01:34)

> Completed planning for LinguaRAG, the AI Product Engineer killer project — Lean Canvas → Product Brief (Startup mode) → reflected Dokdok A1 structure

### Done

- docs: created `projects/lingua-rag/lean-canvas-lingua-rag-20260225.md` (planning-interview Solo mode)
  - Key insight: user value = pattern-based repetitive listening/speaking practice (not simple Q&A)
  - North Star Metric: number of practice sentence set repetition completions
- docs: created `projects/lingua-rag/product-brief-lingua-rag-v01-20260225.md` (Startup mode)
  - Scope: v0.1 (Week 1-4) — German Q&A without PDF + unit dashboard + level mapping
  - Feature list: F1~F8 (Must/Should/Could), API design, DB schema, 3 beta tester survey hypotheses
- refactor(product-brief): full replacement from Netzwerk A1 → Dokdok A1 structure — 56 units / 8 Bands, reflecting Jay's actual progress (A1-1~A1-20 completed)
- refactor: updated v0.2 section to focus on Dokdok PDF integration (copyright handling: user upload → delete after processing)

### Key Decisions

- **Adopted Dokdok unit structure as v0.1 baseline**: progressive strategy — v0.1 hardcoded → v0.2 replaced with actual PDF
- **Introduced unit type classification**: grammar/vocabulary/conversation/practice — optimize system prompts by type
- **Expanded v0.1 scope**: Streaming Q&A only → includes unit navigation + level mapping. Week 1-2 Q&A first, Week 3-4 dashboard
- **Copyright strategy**: user uploads their own purchased PDF, no permanent server storage

### Next

- [ ] Write detailed feature spec for F1 (Claude Streaming Q&A) with spec-interview → commission implementation to competitive-agents
- [ ] Resolve Open Questions (before starting v0.1 development)
- [ ] Create GitHub repo `lingua-rag` and make initial commit

---

## business-avengers (14:51)

> Completed remaining 37 v2.1 audit items + added Phase 0 idea document input feature

### Done

- feat: completed all remaining v2.1 audit items
  - I2: added GTM strategy context to Phase 9 CS Manager
  - I3: separated sprint_context variables for frontend/backend in Phase 5 (`sprint_context_frontend`, `sprint_context_backend`)
  - I5: included sprint_goal in Phase 11 sprint_context
  - I7: integrated sprint-review.md template-based review generation into Step 20 (Sprint Completion)
  - I8: fixed undefined `workflow` variable bug in RESUME mode
  - I10: added explicit phase execution loop mapping (Phase 0→Step 4, ..., Phase 12→Step 16)
  - I11: added completion routing (Sprint→Step 20, Orchestra→Step 21)
  - M1-M9+UX4: synced org-structure.yaml and minor cleanup
- feat: added Phase 0 idea document input feature
  - CPO first asks "Do you have an existing document?" branching question
  - If file path provided: loads via Glob+Read / if text pasted: uses as-is
  - If file not found: text fallback + guidance message

### Key Decisions

- **Document input method**: adopted natural branching within Phase 0 CPO conversation instead of `--from-doc` command flag (UX-first)
- **File path detection**: contains `/` or `\` AND extension check (`.md`, `.txt`, `.pdf`, `.docx`)

### Next

- [ ] E2E full flow test in a new session (Phase 0→1→2)
  - [ ] Verify document input branching (both file path / text paste paths)
  - [ ] Run 3 parallel Phase 1 agents and verify output

---

## lingua-rag (14:52)

> Completed full F1 Competitive Agents pipeline — Alpha vs Beta 2-round competition followed by Fuse, initial push to lingua-rag repo

### Done

- feat: completed F1 spec-interview → created `projects/lingua-rag/docs/f1-streaming-qa-spec.md`
- feat: ran full 7-phase Competitive Agents pipeline
  - Phase 1: Alpha (Pragmatist) v1, Beta (Architect) v1 generated in parallel
  - Phase 2~5: 2 rounds of cross-review + improvements — Alpha 82.5/100, Beta 82.5/100 (tied)
  - Phase 6: Judge — Alpha **74.0** / Beta **67.0** (Alpha wins; decisive difference: Beta lacks frontend)
  - Phase 7: selected "Fuse A + B" → created `tempo/competitive-agents/lingua-rag-f1/fused/`
- feat: Fused implementation (39 files)
  - Beta backend layered architecture + Alpha frontend adopted
  - `backend/app/routers/chat.py`: moved history fetch + user persist inside `session_lock`, LRU 1,000-entry cap
  - `frontend/hooks/useChat.ts`: added truncated event handling + warning UI
- feat: cloned GitHub repo `lingua-rag` → copied 40 fused files → pushed
- docs: wrote `README.md` (tech stack, local dev guide, API endpoints, design decisions)

### Key Decisions

- **Fuse strategy**: Alpha won but Beta's layered architecture quality was superior → backend from Beta, frontend from Alpha
- **asyncio.Lock scope**: both history fetch and user message persist inside lock — prevents race condition (Critical issue from cross-review)
- **--workers 1 fixed**: asyncio.Lock is only valid within a single process

### Next

- [ ] Set up local dev environment and verify operation (backend + frontend connection test)
- [ ] Deploy backend to Railway + deploy frontend to Vercel
- [ ] Write beta tester recruitment post (Naver Cafe "German Study" + Reddit r/German)

---

## planning-interview (15:06)

> Implemented planning-interview v2.0 integrated planning plugin — 4-Phase single flow + added Context Import step

### Done

- feat: finalized planning-interview + spec-interview integration design — Mode only determines interview depth, document selection is a separate step
- feat(planning-interview): full rewrite of SKILL.md v2.0
  - Phase 1: PRD (Lean Canvas / Product Brief / Full PRD)
  - Phase 2: User Journey Map (new)
  - Phase 3: Technical Specification (ported from spec-interview)
  - Phase 4: Wireframe Specification (new)
  - Mode×Phase question count matrix: Solo(4/3/4/3), Startup(6/5/6/4), Team(9/7/9/6)
  - Session state v2.0: phases_selected, phase_state[1-4], shared_context
  - Cross-phase context: Phase 1 answers referenced in Phases 2-4
- feat(planning-interview): created 3 new templates — user-journey-map.md, tech-spec.md, wireframe-spec.md
- chore: updated 3 existing templates to v2.0 (lean-canvas, product-brief, full-prd)
- chore: updated plugin.json v1.0.0 → v2.0.0
- fix: re-ran link-local.sh to reconnect symlinks (replaced file copies with symbolic links)
- feat(planning-interview): added Step 2.5 Context Import
  - Auto-detects when trigger contains content (~50+ words), extracts without asking questions
  - Extracted items: problem, solution, users, features, tech_stack → connected to interview question skip logic
  - Expected question reduction: 6Q → 2-3Q (Solo/Startup), 9Q → 4-5Q (Team)

### Key Decisions

- **Document removal judgment** (over-engineering): SDD → absorbed into Tech Spec Architecture section, standalone IA file → absorbed into Wireframe Spec
- **Context Import UX**: skip questions when trigger contains content, only ask upfront when trigger is short

### Next

- [ ] Audit all AskUserQuestion freeform question options for minimum 2-option requirement
- [ ] E2E test in a new session (verify Context Import behavior)

---

## planning-interview (15:19)

> Audited and fixed AskUserQuestion constraints — clarified freeform question handling, fixed Step 5 option count overflow bug

### Done

- fix(planning-interview): fixed Step 5 Document Selection option count overflow — 5 options → 4 options (complies with AskUserQuestion max 4 constraint)
- fix(planning-interview): added Interview Question Convention section
  - Clarified that `allow_freeform=true` notation in Steps 7–14 interview questions is pseudo-code
  - Added rule: actual AskUserQuestion tool calls prohibited, handle as plain text output
  - Clarified two question types (structured choice vs freeform response) in a table

### Key Decisions

- **Freeform question handling strategy**: declared rules in a single Convention section instead of modifying 60+ individual question blocks — prioritizes maintainability

### Next

- [ ] Run `/planning-interview` E2E validation in a new session

---

## plugin-tester (17:16)

> Refined plugin-tester plugin idea — designed 5-agent architecture and wrote design document

### Done

- docs: analyzed limits of deterministic testing for LLM-driven plugins — defined two layers: "document consistency verification" and "execution verification"
- docs: finalized verification scope — SKILL.md, agent files, README.md, plugin.json + cross-validation items
- docs: designed 5-agent architecture
  - doc-collector (haiku) → static-linter (sonnet) → behavior-reviewer (sonnet) → scenario-runner (sonnet) → test-reporter (haiku)
  - Phase 1 (serial) → Phase 2 (parallel) → Phase 3 (simulation) → Phase 4 (report)
- docs: designed scoring system — 10-point checklist-based, PASS / WARN / FAIL grades
- docs: completed `docs/plugin-tester-design.md`

### Key Decisions

- **v1.0 scope reduction**: start with static-linter + behavior-reviewer only — highest reliability, lowest cost. scenario-runner added in v1.1
- **Checklist-based scoring**: explicit criteria scoring instead of LLM subjective judgment → ensures reproducibility

### Next

- [ ] Begin actual plugin-tester plugin implementation
- [ ] Write v1.0 agent files (static-linter, behavior-reviewer)
- [ ] Write execution algorithm in `skills/plugin-tester/SKILL.md`
- [ ] Run pilot test against existing plugins

---

## lingua-rag (17:16)

> Added Mermaid diagrams to lingua-rag repo README + moved to docs/, verified competitive-agents SKILL.md Step 11.5 improvement

### Done

- docs: added 3 Mermaid diagrams to README.md
  - System architecture (graph TB): browser → Vercel → Railway → DB → Claude full stack
  - SSE chat flow (sequenceDiagram): complete streaming flow
  - DB schema (erDiagram): sessions ↔ conversations ↔ messages relationship diagram
- docs: moved 3 files from `projects/lingua-rag/docs/` to lingua-rag repo `/docs/` and pushed
  - `decisions.md` (ADR-001~004), `f1-streaming-qa-spec.md`, `dev-log.md`
- chore: confirmed competitive-agents SKILL.md Step 11.5 improvements applied (4 edits verified via grep)

### Next

- [ ] Record first dev session in dev-log.md (write when starting local environment setup)

---

## competitive-agents (17:16)

> Added competitive-agents SKILL.md Step 11.5 — auto-generates project docs (ADR, dev-log, spec) in pipeline final output

### Done

- feat: added "Project Docs" question to Step 1 (presented alongside number of rounds)
  - "Yes — generate docs/ (Recommended)": generates decisions.md, dev-log.md, spec.md in `final/docs/`
  - "No — skip docs": skip for quick experiments or plugin-only cases
- feat: added new Step 11.5 (between Step 11 Execute Decision and Step 12 Completion Summary)
  - `final/docs/decisions.md`: auto-extracts 3~6 ADRs from judge-report Strengths to Preserve + per-criterion scores + mission
  - `final/docs/dev-log.md`: empty dev log template
  - `final/docs/spec.md`: copied only when spec file is provided
  - Claude generates inline without subagents (mission and judge-report already in context)
- docs: updated Step 12 completion summary + Quick Reference output tree

### Key Decisions

- **Adopted inline generation**: judge-report and mission already in memory, so generate directly without separate agents. Faster with no context loss
- **ADR source = judge-report**: "Strengths to Preserve", "Why Winner", per-criterion analysis naturally captures architecture decisions
- **Opt-in approach**: recommended by default but selectable → accommodates quick experiment cases
- **Trigger**: LinguaRAG F1 fused output had no decisions.md, requiring manual writing during repo migration → automated

### Next

- [ ] Verify Step 11.5 behavior after competitive-agents run (select generate_docs = Yes)
  - [ ] Confirm decisions.md ADR quality
  - [ ] Confirm dev-log.md template format
  - [ ] Confirm spec.md copy behavior when spec file is provided
- [ ] Standardize decisions.md ADR format

---

## lingua-rag-planning-docs (18:15)

> planning-interview v2.0 E2E test — generated 4 planning documents for LinguaRAG (PRD, User Journey Map, Tech Spec, Wireframe Spec)

### Done

- docs(lingua-rag): generated 4 planning documents using planning-interview v2.0 Startup mode
  - `projects/lingua-rag/prd.md` — Product Brief (imported existing Product Brief → added only 1 GTM question)
  - `projects/lingua-rag/user-journey-map.md` — 3 Journeys (first visit/onboarding, regular Q&A, unit switching), 6-step onboarding ~2 min, retention loop
  - `projects/lingua-rag/tech-spec.md` — architecture (Next.js 15 + FastAPI + PostgreSQL + Railway/Vercel), 6 FRs, 3-Phase implementation plan, NFR
  - `projects/lingua-rag/wireframe-spec.md` — 4 screen ASCII layouts, responsive/accessibility

### Key Decisions

- **Unit panel UI**: tree structure (textbook > Band > unit expand/collapse) — better unit context visibility than dropdown
- **Input field character counter**: real-time display at bottom-right ("48/500") — more predictable than showing only on overflow
- **v0.1 Auth strategy**: none (single user private) → plan to add NextAuth.js email Magic Link in v0.3
- **Context window**: sliding window of last 10 messages — consider summary compression in v0.2

### Next

- [ ] Start Phase 1 implementation based on tech-spec.md (FastAPI POST /api/chat SSE)
- [ ] Implement chat UI based on wireframe-spec.md (Next.js 15)

---

## planning-interview (18:15)

> Completed full planning-interview E2E validation — successfully generated 4 documents after importing LinguaRAG Product Brief

### Done

- test(planning-interview): validated full E2E flow (Startup Mode, 4-Phase, existing document import path)
  - Step 2.5 Context Import: selected "has existing document" → LinguaRAG Product Brief import working correctly ✅
  - shouldSkipQuestion: 5 of 6 Phase 1 questions auto-skipped (pre-filled), only 1 GTM question asked ✅
  - Phase 2 interview: plain text questions output correctly (AskUserQuestion not called), 2 questions ✅
  - Phase 3/4 interview: skip logic + remaining questions handled correctly ✅
- feat(lingua-rag): completed 4 planning documents via planning-interview

### Key Decisions

- **Phase 4 unit panel**: adopted tree structure — easier to grasp unit context than dropdown
- **Input counter**: always show real-time "48/500" at bottom-right

### Next

- [ ] Consider SKILL.md improvements based on real-world planning-interview test feedback
  - Clarity of handoff messages between phases
  - Improve naturalness of user notification text when shouldSkipQuestion skips

---

## truth-checker (20:30)

> Derived Truth Checker false content analysis service idea and wrote comprehensive document — Korean-specialized fact-checking service

### Done

- feat: derived Truth Checker service idea
  - Referenced and analyzed Goorm DeepDive, confirmed AI Hub clickbait article detection dataset (71,338 entries)
  - Matched user's tech stack (React, Claude API, Recharts, Supabase)
- docs: wrote comprehensive idea document (`truth-checker-service-idea.md`, 30+ sections)
  - Problem: misinformation flood, lack of fact-checking tools, market size
  - Solution: 5-step verification pipeline
  - Core Features: input (URL/text/image), claim extraction (Claude API), source credibility analysis (A-D grades), clickbait detection (AI Hub data), similar misinformation search, credibility score (0-100), visualization dashboard
  - Business Model: Freemium ($0/$10/$30), B2B ($500-2k)

### Key Decisions

- **Service name**: Truth Checker
- **MVP duration**: 4 weeks (Week 1: claim extraction + source verification, Week 2: Fact Checking engine, Week 3: visualization, Week 4: AI Hub data integration)
- **Core differentiation**: Korean-specialized + supports all content types (URL/text/image) + fast verification (10-30 sec vs SNU FactCheck's days)
- **Credibility score formula**: source (30%) + cross-validation (40%) + logic (30%) = 100 points
- **Final tech stack**: React 18+TypeScript+Vite, Recharts+React Flow, Node.js+Supabase, Claude API+KoBERT fine-tuned

### Next

- [ ] Apply for AI Hub clickbait article dataset download
- [ ] Initialize React project
- [ ] Start MVP Week 1 development (URL input form, Cheerio crawling, Claude API claim extraction)
- [ ] Detail MVP spec (consider using planning-interview skill)
