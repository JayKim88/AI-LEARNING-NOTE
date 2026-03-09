---
title: "2026-03-09 Session Log"
date: 2026-03-09
description: "indie-maker-pipeline-review: Domain Anchors + gap analysis + English translation across 14 skills. devjob-ai-planning: MODULE 1+2 deep-dive — partner concept expansion, FastAPI hybrid architecture decision, and product philosophy reframe from 'tool' to 'partner'."
tags: ["indie-maker-pipeline-review", "devjob-ai-planning"]
---

## indie-maker-pipeline-review

Today was about making the indie-maker skill system more "senior" — not in terms of complexity, but in terms of reliability.

### The Problem: Knowing a Framework vs. Actually Using One

Claude knows JTBD. It knows Van Westendorp. It knows OWASP Top 10. But if a skill file just says "do UX research," that knowledge doesn't activate consistently. There's a real difference between *mentioning* a framework (weak) and *embedding it as a generation rule* (strong).

That's the idea behind **Domain Anchors**. The format is simple:

```
keyword → 1-line rule for when and how to apply it
```

For example:
- `JTBD → All UX research starts with "When I... I want to... So I can..." format`
- `OWASP Top 10 → Never propose an API without input validation, RLS policy, and rate limiting`
- `Van Westendorp → When pricing is uncertain, propose 4-question WTP interview first`

It's not about injecting frameworks — it's about setting a trigger so Claude pulls what it already knows at the right moment.

### Planting Anchors Across 14 Skills

Added Domain Anchors sections to all 14 skills, from indie-market-researcher to indie-retro. Around 6-7 anchors per skill, roughly 93 total.

Each anchor specifies *when it fires*, not just what it is. For instance, indie-launcher's `Launch Stacking` anchor reads: "Single-channel launches are prohibited. Sequence: BetaList (D-7) → PH (D14) → Show HN (D15)." The goal was to close the gap between knowing and doing.

### Finding the Gaps with Senior JD Analysis

After planting the anchors, one question remained: *are these skills actually producing senior-level output?*

Created 14 JD analysis documents in `docs/senior-requirements/` — one per skill — synthesizing real senior job descriptions from major platforms. Each document covers Hard Skills, Senior Differentiators, and confirmed trend keywords. Then compared these against the existing anchors and classified gaps as Critical / High / Low.

Applied Critical gaps first, then all 15 High gaps. For example: added a "No Ambiguous Verdict Rule" to indie-analyst (Kill or Go, no undecided), and "Copy-to-Revenue Tracing" to indie-copy (every piece of copy should trace back to a business result).

### Finally: Translating Everything to English

Translated all 26 skill/knowledge files to English. The reason is simple — Korean UTF-8 uses 1.5-2.5x more tokens than equivalent English text. Technical framework names are natively English, so they pattern-match more precisely in an English context.

One rule: Korean trigger phrases ("아키텍처 잡아줘", "분석해줘") stay Korean, because those are what users actually type. System instructions and interaction language are now separated.

As it turned out, 12 of the knowledge/ files were already in English. Only the 14 SKILL.md files and one section of analytics-guide.md needed translation.

### Next

- [ ] Run pipeline test with a standard SaaS fixture to verify Domain Anchors activate correctly in generated output
- [ ] Commit all changes (Domain Anchors + gap fills + English translation) with conventional commit messages
- [ ] Review indie-monetize SKILL.md completeness (Finn persona, pricing-strategy.md template)
- [ ] Run second pipeline test with standard web SaaS fixture (verify indie-backend P0-3 routing)

---

## devjob-ai-planning

Today's work on DevJob AI — an AI service for developers targeting overseas jobs — came down to a single reframe: from "tool" to "partner." That one shift changed every product decision that followed.

### Why "Partner"?

The most important work today wasn't code. It was perspective.

An Origin Story section was added to the idea doc. Architecture major → Economics major transfer, job hunting for overseas sales, pivoting to engineering, preparing to move to Germany — all of it done alone. No career coach, no alumni network, no mentor. Looking back, it wasn't just inconvenient. It was lonely.

That sentence changed the product's reason for existing.

> "JD analysis and resume generation are just tools. The point is creating the experience of not being alone."

A tool analyzes, generates, and stops. A partner stays. That distinction became the lens for re-examining all of MODULE 1+2.

### MODULE 1 Rewritten Through the Partner Lens

**The old MODULE 1's problem:** It stopped at identifying the gap. "You're missing AWS experience" — and then the user was on their own.

**Feature 1-4 (Preparation Coach & Readiness Assessment)** was added to fill that void.

```
Old flow:
  JD analysis → gap check → (user prepares alone) → resume generation

New partner flow:
  JD analysis → gap check → auto-generate prep roadmap → track progress
             → submit artifacts & AI evaluation → Readiness Signal → resume generation
```

The Readiness Signal is the key piece. "Am I ready to apply?" shouldn't be left to the user to judge alone. The partner judges first — 🟢 Apply now / 🟡 1-2 more weeks / 🔴 More prep needed.

**Feature 1-3 (Multi-JD Analysis)** was also added, with two views:
- **View A (Market Intelligence)**: Feed in 3-10 JDs, get common requirement patterns. Python 90%, AWS 70%, 5+ years 60% — that becomes the prep priority list.
- **View B (Personalized Ranking)**: "I found 5 decent JDs on LinkedIn — where should I apply first?" → ranked by profile match score.

### MODULE 2 Redesigned as Before / During / After

MODULE 2 was only about "generating" a resume. A partner doesn't stop at generation.

**Before — Feature 2-1 (Resume Quality Diagnosis)** was strengthened. Parse the PDF and catch problems *before* applying overseas:
- Missing action verbs ("담당했습니다" → replace with "Led", "Reduced")
- Under-quantified bullet points
- Korean format warnings (photo, date of birth → remove for overseas applications)
- ATS friendliness check (tables/images → ATS parsing failure risk)

This is a Korea-specific differentiator. Teal and Rezi don't address this.

**During — Feature 2-2 (ATS Optimization)** was added. While generating, simultaneously check:
- JD keywords appear naturally throughout
- No ATS-blocking elements (tables, images, headers/footers)
- Estimated ATS pass rate score ("Estimated ATS pass rate: 78%")

**After — Features 2-4 (Consistency Review) and 2-5 (Version Management)** were added.
- 2-4: If the resume and cover letter send different messages, the partner catches it. ("Resume headline: Backend Engineer / Cover letter: Full-stack → positioning mismatch ⚠️")
- 2-5: Every application result accumulates. Common traits of resumes that passed screening, patterns of rejections — quality improves over time.

### When Is FastAPI Actually Needed?

MVP uses only Next.js API Routes. Single JD analysis completes in under 10 seconds — no Vercel timeout issues.

FastAPI becomes clearly necessary at D7+:
- **PDF parsing**: pdfplumber is decisively better than JavaScript alternatives
- **Batch multi-JD processing**: 10 JDs in parallel → likely to exceed Vercel's 60-second timeout
- **RAGAS/LangChain**: Python only
- **Voice pipeline**: Whisper + VAD, Python ecosystem

The plan doesn't change for FastAPI. FastAPI gets added when the plan demands it.

### Decisions Locked In Today

| Decision | Detail |
|----------|--------|
| MVP architecture | Next.js API Routes only → FastAPI (Railway) at D7+ |
| MVP scope | MODULE 1+2 (+ P0.5 Partner Layer) |
| MODULE 3-5 | Roadmap — excluded from MVP |
| P0.5 added | Feature 1-4 Readiness Coach (D11-D14) — bridges analysis → coaching |
| Partner principle | Every feature must have an "After" loop — nothing ends at generation |

### Next

- [ ] Sync prd-lean.md with latest decisions (1-3, 1-4, 2-4/2-5, FastAPI architecture, P0.5 scope)
- [ ] Decide MODULE 3 direction (partner lens — 3-1 connects to 1-4c evaluation loop, 3-2 needs to shift from checklist → active assessment)
- [ ] Start `/indie-ux` (after finalizing planning docs)
