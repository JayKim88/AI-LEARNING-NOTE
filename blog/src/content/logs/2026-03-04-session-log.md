---
title: "2026-03-04 Session Log"
date: 2026-03-04
description: "lingua-rag: 4-round eval improvement + judge hallucination discovery / business-avengers: Fine-tuning completion — Layer 1–4 all done"
tags: ["lingua-rag", "eval", "llm-as-judge", "debugging", "monitoring", "business-avengers"]
---

## Topics Worked On Today

- [lingua-rag](#lingua-rag)
- [business-avengers](#business-avengers)

---

## lingua-rag

> User Feedback UI + MessageRepository bug fix + Monitoring enhancement + AI Product Engineer competency roadmap + P0-1 german_bold eval 4-round improvement

### Done

#### Critical Bug: Python Class Name Collision

After deploying the feedback feature, **all conversation history disappeared**. Root cause: `class MessageRepository:` was declared twice in `repositories.py`. Python silently replaces the first definition with the second.

The `create()`, `get_recent()`, and `get_all()` methods from the first class were gone — message saving and history loading both failed completely. Fixed by merging `update_feedback()` into the original class.

#### User Feedback UI (👍/👎)

Added thumbs up/down toggle buttons below each response. The goal is not just UX improvement — this is **infrastructure for correlating eval scores with real user satisfaction** over time.

#### Monitoring Enhancement

Started reading token usage from Claude API's `final_message.usage` and saving to DB.

- `output_tokens` → `messages.token_count`
- `rag_hit BOOLEAN` — whether RAG found a relevant chunk
- Structured log: `Token usage — unit=%s out=%d in=%d cache_read=%d cache_write=%d`

#### AI Product Engineer Competency Roadmap

Reflected on the work so far and mapped out what has been demonstrated as an AI Product Engineer and what's still missing.

| Phase | Task | Why It Matters |
|-------|------|----------------|
| P0-1 | german_bold eval improvement | Demonstrates "analyze failure patterns → iterate" story |
| P0-2 | Add semantic eval rules | Overcomes the limitation of format-compliance-only metrics |
| P1-1 | GitHub Actions CI | Auto-detect quality regressions on every deployment |
| P2 | Acquire real users | Without real data, even eval scores are meaningless |

#### P0-1: german_bold Eval — Round 4 Improvement

Improving the `german_bold_complete` rule (verifies that all German words are wrapped in `**bold**`) from a baseline of 40%.

| Round | Improvement | german_bold | Overall |
|-------|-------------|-------------|---------|
| Baseline | — | 40% | 90.0% |
| R1 | Morpheme suffixes, transcription notation, grammar terms, tip section examples | 50% | 90.0% |
| R2 | `ein/eine`, `haben`/`sein`, `bitte`, pronoun examples | 55.6% | 92.6% |
| R3 | Inflected forms in parentheses, `ge-`+stem+`-t` structure | 60.0% | 93.3% |
| R4 | `kommst`, `kein Hund`, `ich habe`, `geradeaus` examples | Not run\* | — |

\* R4 not run due to insufficient API credits.

**Key insight**: Concrete examples of "write it like this" are far more effective than abstract rule descriptions.

#### Judge Hallucination Discovered

While analyzing Round 3 eval results, an important issue surfaced.

The model correctly produced bold-formatted output — `**geradeaus** → straight ahead`, `**kein Hund** → no dog` — but the judge incorrectly flagged these as missing bold formatting.

**This was judge hallucination, not a model error.** Since the judge is also an LLM, it can produce incorrect results for the same input. This discovery became the justification for P0-2 (judge prompt improvement).

### Key Decisions

- **Judge hallucination confirmed**: In Round 3 eval, the model output was correct but the judge scored it wrong. Improving the judge prompt is required to increase eval system reliability
- **Feedback infrastructure complete**: 👍/👎 + token_count + rag_hit — foundation for measuring correlation between eval scores and real user satisfaction. Data collection can now begin

### Next

- [ ] Rerun P0-1 R4 eval after topping up API credits — target 70%+
- [ ] P0-2: Add semantic eval rules + prevent judge hallucination
- [ ] P1-1: GitHub Actions eval CI pipeline
- [ ] P2: Acquire real users — select channel + write beta post

---

## business-avengers

> Fine-tuning completion — Layer 1–4 all done across 13 phases and 23 agents (task prompts, agent definitions, knowledge base, quality rubrics)

### Done

The `business-avengers` plugin is an AI-powered product development pipeline spanning 13 phases (Ideation → Scale/Exit). Fine-tuning means strengthening each layer of quality control: task prompts, agent definitions, knowledge base depth, and evaluation rubrics. This session completed the final layer.

**Phase 5 Dev Guide — Step Expansions**
- feat(SKILL.md Phase 5): `backend-dev` 8→13 steps, `devops-engineer` 8→13 steps — 30-min Hello World gate, Test Pyramid (70/20/10), OWASP Top 10, tech debt register, DORA metrics targets, 3-tier monitoring

**CLAUDE.md Layer 6 — Output Verification (Conditional)**
- feat(CLAUDE.md): Added Layer 6 Output Verification — triggers on complex code / multi-part analysis / strategy; surfaces issues inline only with `⚠ Assumption:` / `📌 Skipped:` markers

**Agent Task Prompt Expansions (9 agents across 6 phases)**
- Phase 2 `ux-researcher`: 5→8 steps — Switching Trigger, Anti-Persona, Behavioral Signals
- Phase 6 `qa-lead`: 8→11 steps — Test Pyramid, Core Web Vitals numeric targets, 10-min smoke test
- Phase 7 `content-creator`: 7→10 steps — ICP keyword search, 3-pillar max, 90-day calendar ≥12 posts
- Phase 7 `pr-manager`: 7→9 steps — story angle "why this is news", actual journalist names, D-30→D+7 timeline
- Phase 9 `cs-manager`: 7→9 steps — 4 scenario types, SLA per support tier
- Phase 9 `data-analyst`: 8→10 steps — 3-tier KPI, named event tracking schema
- Phase 10 `content-creator` (Build in Public): 4→8 steps — audience value themes, milestone sharing plan
- Phase 10 `data-analyst`: 4→7 steps — organic vs. paid target, experiment hypothesis + threshold + kill criteria
- Phase 11 `business-analyst`: 6→9 steps — Bus Test 30-day scenario, ≤10h/week maintenance target
- Phase 12 `business-analyst`/FIRE: 5→8 steps — FIRE gap calculation, 3 exit scenario modeling, psychological readiness prep
- Phase 12 `legal-advisor`: 5→8 steps — 4-domain exit readiness checklist, 3 buyer negotiation strategies

**Quality Standards — All Remaining Agents**
- feat(agents): Quality Standards section added to all 12 remaining agent definitions (completing the full set of 23)

**Knowledge Base Injection Fixes**
- fix: Phase 2 `ux-researcher` — added `problem-validation-deep.md` injection
- fix: Phase 9 `legal-advisor` — added Quality Rubric injection + expanded task 8→11 steps
- fix: Phase 10 `data-analyst` — added `data-metrics-guide.md`
- feat(`problem-validation-deep.md`): Added Anti-Persona Definition as new §3
- feat(`phase-rubrics.md`): 4 consistency and completeness improvements

### Key Decisions

- **Templates review (Layer 5): deferred** — will revisit when actual output quality issues arise in real usage
- **E2E testing: deferred** — will run the full 13-phase pipeline with a real product idea as the first real test
- **Anti-Persona canonical location**: `problem-validation-deep.md` (not agent files)
- **Layer 6 CLAUDE.md**: inline flags only — no separate verification section to keep output clean

### Next

- [ ] Templates review (Layer 5): scan when actual output quality issues arise
- [ ] E2E pipeline test: run full 13-phase pipeline with a real product idea
- [ ] Phase 1 self-assessment block: align to new universal format
