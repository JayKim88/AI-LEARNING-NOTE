---
title: "2026-03-05 Session Log"
date: 2026-03-05
description: "indie-maker: added 4 missing agents, fixed I/O connections, built ideation flows, separated into standalone repo"
tags: ["indie-maker", "claude-code", "ai-agents"]
---

## indie-maker

> Completed the full 29-day sprint agent system and separated indie-maker into its own repository.

### Background

indie-maker is a sprint system that takes an idea from zero to a validated MVP in 29 days. It runs as a set of Claude Code skills — you type `/indie-planner` or `/indie-analyst` and a specialized agent walks you through that phase conversationally.

Before today, the system had 6 agents. A full process review revealed 4 gaps in the coverage.

---

### Filling the Gaps: 4 New Agents

**Phase 1.5 — indie-ux (Kai, UX Architect)**

There was nothing between planning ("what to build") and visual design ("colors and components"). The middle layer — "what screens exist and how they connect" — was missing.

Kai produces:
- Full user flow diagrams (every screen, every branch)
- Lo-fi text wireframes for 3–5 key screens
- Error / empty state / loading state specs

Reviews against Nielsen's 10 usability heuristics and applies cognitive load reduction principles throughout.

---

**Phase 5 — indie-launcher (Leo, Launch Strategist)**

D7–D13 was a manual gap. The existing `/launch-kit` generates marketing copy, but copy and launch strategy are different things. Copy is what you say. Strategy is when, where, and how you go public.

Leo handles:
- Product Hunt submission strategy (timing, tagline, first comment)
- Pre-seeding — collecting upvote commitments before launch day
- Multi-channel stacking: BetaList, Show HN, AI directories, newsletters simultaneously
- 7-day Build-in-Public content calendar (Twitter/LinkedIn drafts ready to post)
- **Launch Failure Plan B**: if upvotes fall below 50, here are 4 concrete options

---

**Phase 8+ — indie-growth (Gio, Growth Strategist)**

After the D29 Kill/Go gate returns "Go," there was no agent to handle what comes next. The previous setup had a single line pointing to `/business-avengers`, which breaks context continuity.

Gio's core principle: **retention before acquisition.** If Day-7 return rate is below 25%, don't spend energy bringing in new users — fix the product first. New users who leave immediately don't compound.

After retention is healthy: test 3 channels from a pool of 19, then commit to 1.

---

**Phase 9 — indie-retro (Sage, Retrospective Lead)**

A Kill verdict previously ended with a 3-line checklist. Kill isn't failure — it's data. But data only compounds if it's captured and carried into the next sprint.

Sage runs a 30-minute structured retrospective:
- Failure autopsy across 4 lenses: Product / Market / Execution / Timing
- Root cause vs. symptom: "not enough users" is a symptom, not a cause
- Full audit of every assumption made on D1 against what actually happened
- 3 next-sprint principles — specific behaviors, not abstract lessons

---

### Fixing 3 Broken I/O Connections

Adding new agents exposed gaps in the existing document flow.

**Gap 1**: indie-analyst delivered Kill/Go analysis as conversation only — no file saved. indie-growth and indie-retro both need to read those metrics, but there was nothing to read.
→ Fixed: indie-analyst now saves `kill-go-report.md` immediately after the verdict (both Go and Kill paths).

**Gap 2**: indie-retro writes `lessons.md`, but indie-market-researcher never read it at the start of the next sprint. Previous failures could repeat unnoticed.
→ Fixed: indie-market-researcher now Globs `lessons.md` at startup and factors previous learnings into market analysis.

**Gap 3**: indie-backend didn't read `design-brief.md`. DB table names and API endpoint names could be generated with no awareness of the product's brand naming.
→ Fixed: `design-brief.md` added to indie-backend's context load.

---

### Adding Ideation Flows

The system previously assumed you already had an idea when you started. Two explicit paths now exist:

**Path A (Research → Planning)**: No idea yet
1. Run `/indie-market-researcher` → desire-based market analysis → 3 concrete product idea candidates (each with target user, differentiation angle, estimated ARPU, feasibility score)
2. Pick one → run `/indie-planner`

**Path B (Planning → Validate → Planning)**: Have an idea already
1. Start `/indie-planner` → after Q2 (personal experience check), prompted: "Have you validated demand for this?"
2. If not: run `/indie-market-researcher --validate "your idea"` (~5–8 min)
3. Returns: Google Trends trajectory + community discussion signals + willingness to pay + best acquisition channel → saves `research/demand-validation.md`
4. indie-planner reads that file and continues with demand context loaded

Validation verdicts:
- 🟢 Validated — proceed
- 🟡 Weak Signal — run this specific test first, come back with results
- 🔴 No Signal — reconsider the angle or start over with `/indie-market-researcher` discovery mode

---

### Separated into Standalone Repo

With 11 agents, 13 knowledge documents, and a full sprint playbook, indie-maker had grown beyond a plugin. Extracted from the `claude-ai-engineering` monorepo into its own repository.

- New location: `~/Documents/Projects/indie-maker/`
- GitHub: https://github.com/JayKim88/indie-maker
- All skill versions reset to v1.0.0
- CLAUDE.md rewritten: full agent table, both sprint paths, complete document flow diagram
- All 11 symlinks updated: `~/.claude/skills/[skill]` → new repo path
- Removed `plugins/indie-maker/` and `docs/indie-sprint-playbook.md` from the monorepo

---

### Final Agent Map

| Agent | Phase | Role |
|-------|-------|------|
| indie-market-researcher (Max) | D-1 (optional) | Market research + idea candidates + demand validation |
| indie-planner (Reid) | D1 morning | Idea validation + PRD + Kill criteria |
| indie-ux (Kai) | D1 afternoon | User flows + wireframes |
| indie-designer (Vera) | D2 | Brand + landing design |
| indie-frontend (Rex) | D3–D6 | Next.js + UI implementation |
| indie-backend (Axel) | D3–D6 | Supabase + API + payments |
| indie-infra (Sam) | D3–D14 | Vercel deployment + QA |
| indie-launcher (Leo) | D7–D13 | Product Hunt + community launch strategy |
| indie-analyst (Nova) | D15–D29 | Kill/Go analysis |
| indie-growth (Gio) | D30+ (Go) | Growth experiments |
| indie-retro (Sage) | D29 (Kill) | Structured retrospective |

---

### Next

- [ ] indie-retro: optional additions — competitive intelligence extraction, cross-sprint assumption pattern tracking
- [ ] indie-analyst: evaluate `knowledge/market-intelligence-guide.md` connection to pre-launch stage analysis
- [ ] indie-planner: evaluate `knowledge/founding-pm-guide.md` depth upgrade
- [ ] GitHub: add README.md to indie-maker repo for public discoverability
