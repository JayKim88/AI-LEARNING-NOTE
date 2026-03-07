---
title: "2026-03-07 Session Log"
date: 2026-03-07
description: "indie-maker: pipeline review + structure standardization + new skill; my-timeline: full Next.js MVP build; indie-maker-web: SaaS app + MCP server; jd-lens: UX/design/backend sprint"
tags: ["indie-maker", "my-timeline", "indie-maker-web", "jd-lens"]
---

## Topics

- [indie-maker — Pipeline Review + Structure Standardization](#indie-maker)
- [my-timeline — Full MVP Build](#my-timeline)
- [indie-maker-web — SaaS App + MCP Server](#indie-maker-web)
- [jd-lens — UX / Design / Backend Sprint](#jd-lens)

---

## indie-maker

> Pipeline review (17 issues found and fixed), docs/ output structure standardized, 12th skill (indie-monetize) added, launch channel playbooks expanded.

Two sessions today, both focused on hardening the indie-maker framework — a Claude Code CLI system with 12 specialized skills that guide a solo maker from market research through Kill/Go decision.

---

### Session 1 — Full Pipeline Review

The goal: simulate a real product sprint end-to-end, find every point where a founder would get blocked, confused, or produce bad output, and fix it before the next real sprint runs.

I traced the full skill chain from `indie-planner` → `indie-ux` → `indie-designer` → `indie-backend` → `indie-launcher` → `indie-analyst` → `indie-growth` using GitMessage (a VS Code extension that auto-generates commit messages) as the fixture product. **17 issues found. All 17 fixed.** 3 more surfaced during the test run itself.

The triage question: *"Would a real founder building a real product get stuck here?"* Yes = P0. Confusion or bad output = P1. Friction but not blocking = P2.

---

### Key fixes

**1. No cross-sprint feedback loop (indie-planner)**

The skill started fresh every time. If a previous sprint failed, `indie-planner` had no idea — it would ask the same questions with no awareness of what went wrong before. Added a step at the very start that Globs for `lessons.md` from a prior sprint and summarizes the key principles before the first interview question. Past failures now inform the next attempt.

**2. No pivot path when demand fails (indie-planner)**

When demand validation returned a red signal, the skill offered two options: continue anyway, or re-run research. A founder staring at a red signal needs a real decision framework, not a coin flip. Replaced with a 3-way pivot: change the idea, change the target market, or kill it — each with a clear next action.

**3. Kill Criteria had no benchmarks (indie-planner)**

The interview asked "what numbers would make you stop?" with no reference points. A first-time founder has no idea if 10 paying customers in 29 days is realistic or not. Added a benchmark table (PH upvotes, paying customers, MRR at Kill/Watch/Go thresholds) from the sprint playbook, labeled as reference points rather than rules.

**4. indie-backend only handled 1 of 19 request types (indie-backend)**

The skill classified incoming questions into 19 types but only had a full algorithm for DB schema design. Everything else — RLS policies, auth flows, Stripe webhooks, Edge Functions — fell through to a generic handler. Added explicit routing for all 19 request types, so the skill jumps directly to the relevant algorithm for whatever the user is asking.

**5. Plan B trigger logic was AND instead of OR (indie-launcher)**

The Plan B fallback required all failure conditions to be true at the same time. But PH upvotes and signup count are independent signals — either one failing means something is wrong. Changed to OR. If any trigger condition is met, Plan B activates.

**6. No "Watch" verdict (indie-analyst)**

The skill could only say Kill or Go at D29. Sometimes the signal is genuinely ambiguous — not bad enough to kill, not clear enough to commit. Added a Watch verdict: a 14-day extension to D43 with specific re-evaluation criteria. The verdict is saved to `kill-go-report.md` so the next run auto-detects it and skips the normal D29 interview.

**7. MRR-based experiment routing missing (indie-growth)**

The growth skill showed the same experiment list regardless of how the product was actually doing. Added a Step 3.5 verdict (red/yellow/green) based on MRR that routes to the correct experiment set. If MRR is red, you get acquisition experiments. If retention is the bottleneck, you get onboarding experiments. The routing is now explicit instead of implicit.

**8. No monitoring gate before launch (indie-infra)**

The infra skill walked through deployment steps and signed off without verifying that monitoring was actually working. Added a gate: Sentry, UptimeRobot, and Analytics must each be confirmed with a real test event before the skill marks the deployment complete.

**9. Build skills silently absorbed scope changes (all build skills)**

When a user asked for something that implied a PRD change, the skill just did it. Over time this caused `prd-lean.md` to diverge from what was actually being built. Added a Scope Change Protocol: when a request implies a scope change, the skill surfaces it explicitly and prompts the user to update `prd-lean.md` themselves. The skill never edits the product document — the user always owns it.

---

### 3 issues found during the test run

Running a real product through the system surfaced problems the static review missed.

**Watch verdict had no exit definition.** The Watch verdict existed but didn't say when it ended or what would trigger re-evaluation. Added D43 as the standard watch endpoint with explicit criteria, saved to `kill-go-report.md` so the next analyst run auto-detects and continues from there.

**Non-SaaS stack mismatch in indie-backend.** The backend skill assumes Supabase + Next.js by default. The GitMessage fixture triggered it — which would have applied web SaaS patterns to a VS Code extension. Wrong runtime, wrong APIs, wrong everything. Added product type detection at Step 0 with an explicit mismatch warning for extensions, CLIs, mobile apps, and desktop apps.

**Document drift between prd-lean.md and build skills.** Related to fix #9, but the test revealed that drift had already happened in the fixture. The Scope Change Protocol addresses this going forward.

---

### What was decided

| Decision | Rationale |
|---|---|
| Watch period: D29 → D43 (14 days) | Long enough for a real signal, short enough to avoid prolonged indecision |
| Build skills flag scope changes; never edit prd-lean.md | User always owns the planning document |
| All pseudocode in English | Trigger phrases and opening messages stay bilingual — they're for the user, not the algorithm |
| Test fixture naming: `{projectName}_{YYYY-MM-DD}` | Enables multi-run tracking and easy sorting |

One open issue: the VS Code Extension fixture never triggered DB schema questions, so `indie-backend`'s routing dispatch (fix #4) was never exercised. Needs a second run with a standard web SaaS fixture.

---

### Session 2 — Structure Standardization + New Skill

After the pipeline review, a structural problem became obvious: skill files disagreed on where outputs should live. Some used `**/idea-canvas.md` (a wildcard Glob that matches any file anywhere in the tree). Some used `./research/`. None agreed. This session locked down a single standard and added a new skill.

**Output directory standard — `docs/{skill-name}/`**

Every skill now writes its output to a predictable path:

```
{project}/
├── docs/
│   ├── indie-market-researcher/   ← market-analysis.md, competitive-analysis.md, etc.
│   ├── indie-planner/             ← idea-canvas.md, prd-lean.md
│   ├── indie-ux/                  ← ux-flow.md, wireframes.md
│   ├── indie-designer/            ← design-brief.md, landing-copy.md
│   ├── indie-monetize/            ← pricing-strategy.md
│   ├── indie-launcher/            ← launch-plan.md, bip-posts.md, launch-metrics.md
│   ├── indie-analyst/             ← kill-go-report.md
│   ├── indie-growth/              ← growth-experiments.md, channel-strategy.md
│   └── indie-retro/               ← retrospective.md, lessons.md
└── src/                           ← product code
```

Every Glob is now an explicit path like `./docs/indie-planner/idea-canvas.md`. Wildcard patterns are gone. This eliminates false matches when a project has nested folders or multiple markdown files with the same name.

**indie-monetize — 12th skill**

Added Finn, a Monetization Strategist. Runs in two phases: Phase 2-3 for pricing design before the build, and Phase 7 for a post-launch pricing audit. Output: `docs/indie-monetize/pricing-strategy.md`.

**indie-launcher — Community channel deep dive**

Added Step 3b with standalone playbooks for Reddit, HN, and Discord/Slack. Reddit: how to find the right subreddit and write a post that doesn't read as an ad. HN: Show HN vs Ask HN decision tree and what specifically makes HN submissions fail. Discord/Slack: community warm-up before posting, DM-first approach for niche communities. Also fixed a stale BetaList claim (~800 subscribers) — now labeled `[ESTIMATE]`.

**knowledge/automate-guide.md**: Added post-launch automation patterns — Resend email drip, Stripe webhook handling, `pg_cron` metrics aggregation in Supabase.

**indie-sprint-playbook.md**: Deleted. Everything it covered now lives in `CLAUDE.md`'s Sprint Map and Skill Reference sections. It was a duplicate drifting out of sync.

---

### Next

- [ ] Run second pipeline test with a standard web SaaS fixture to verify indie-backend routing dispatch (P0-3)
- [ ] Review indie-monetize SKILL.md for completeness (Finn persona, pricing-strategy.md template)
- [ ] Review indie-launcher Step 3b Discord/Slack playbook content
- [ ] Commit all changes with conventional commit messages
- [ ] Update test-sprint/README.md after next test run

---

## my-timeline

> Full Next.js MVP build — design system, all core components, bug fixes (form state, infinite loop, dialog behavior), and project relocation into indie-maker monorepo.

my-timeline is an app for visualizing your career and life as a timeline. Today was the day the planning phase ended and actual code got built from scratch — all the way through. Stack: Next.js 16 + Tailwind v4 + shadcn/ui Nova preset (Base UI). From the landing page to the Zustand store, SVG Gantt chart, CSV import, and PDF/PNG/HTML export, the entire core feature set was completed in one session.

---

### Why No-Login

The biggest decision from the planning phase (planning-interview, indie-ux, indie-designer) was **No-Login / Privacy-First architecture**. Career and life data is sensitive. Storing it on a server means auth, encryption, GDPR — operational complexity that explodes for a solo product. So all data lives in LocalStorage only, device migration is handled via CSV export, and sharing is done via URL hash (base64). Auth code, Supabase, and all server routes were removed entirely. The screen count dropped from 7 to 1 app page + 3 modals.

---

### How the build went

**Infrastructure**: `globals.css` defines oklch-based category color tokens using `@theme inline`. The Stone+Amber palette and Pretendard Variable font are loaded via CDN.

**Data layer**: `types/timeline.ts` defines CATEGORIES, CATEGORY_COLOR, TimelineEntry, Profile, and date helpers. `lib/storage.ts` handles LocalStorage CRUD and URL hash encode/decode. The Zustand store (`timeline-store.ts`) provides CRUD actions and derived selectors.

**UI components**: Built in order — landing page (Header/Hero/Features/FAQ/Footer), the app entry flow (blank-slate → profile-header → entry-card), SVG Gantt chart, CSV import modal (react-dropzone + papaparse), and export modal (PDF/PNG/HTML + progress bar).

---

### Where Base UI caused friction

The Nova preset uses `@base-ui/react`, not Radix. The API differences are subtle but breaking.

| Radix | Base UI |
|---|---|
| `asChild` prop | `render` prop |
| `onInteractOutside` | `disablePointerDismissal` |
| no `nativeButton` | `nativeButton={false}` when rendering as Link |

The Nova registry also doesn't ship a `form.tsx` component. The react-hook-form `FormProvider` pattern had to be built from scratch.

---

### Bug fixes

**1. `useFormContext()` null crash**

**Symptom**: App crashed on form render with `useFormContext() must be used within a FormProvider`.

**Root cause**: The `Form` component wasn't injecting the react-hook-form context before it was consumed downstream.

**Fix**: Replaced `Form` with `FormProvider`, which properly injects context for all child components.

---

**2. Field values lost on category tab switch**

**Symptom**: Typing values into the Work tab, switching to Education, then switching back — the Work fields were empty.

**Root cause**: Each tab switch triggered react-hook-form's reset with default values, wiping whatever had been typed.

**Fix**: Added a `useRef` cache keyed by category. On tab leave, field values are saved to the ref. On tab return, they're restored. On dialog close, the cache is cleared.

---

**3. Dialog closing on outside click**

**Symptom**: Accidentally clicking outside the form during a long entry discarded all input.

**Root cause**: Default dialog behavior dismisses on pointer events outside the overlay.

**Fix**: Set `disablePointerDismissal={true}` (Base UI equivalent of Radix's `onInteractOutside`). The dialog now only closes via an explicit action, which triggers `handleClose` to reset the form and clear the tab cache.

---

**4. Infinite re-render**

**Symptom**: The app locked up in an infinite render loop after any state change.

**Root cause**: `selectSortedEntries` and `selectYearRange` returned a new array reference on every call. React saw a new value every render and re-rendered endlessly.

**Fix**: Applied `useShallow` to both selectors, switching from reference equality to shallow comparison.

---

### Key Decisions

| Decision | Rationale |
|---|---|
| No-Login / LocalStorage | Eliminates server costs; career data is sensitive; auth is overengineering for a solo product |
| form.tsx built from scratch | Nova registry doesn't ship it — faster to write than to wait |
| Per-tab `useRef` cache | Minimal intervention — doesn't touch react-hook-form internals, only patches the UX |
| `useShallow` for derived selectors | Any selector returning an array always produces a new reference — shallow comparison is required |

---

### Next

- [ ] Implement URL hash shared view — `/#[hash]` read-only route
- [ ] Validate URL hash length — test with ~20-30 entries against browser limit
- [ ] Set Kill Criteria numbers in `docs/indie-planner/prd-lean.md`
- [ ] QA pass — blank slate → add entries → chart → export → CSV import
- [ ] Run `/indie-infra` — Vercel deployment, custom domain, launch checklist

---

## indie-maker-web

> Converted indie-maker CLI framework into a SaaS web service and built the full MCP server pipeline connecting Claude Code skills to the web app.

The indie-maker system was originally a CLI skill framework that ran entirely inside Claude Code. Today it was extended into a web service — a SaaS app where you can track sprint progress, log metrics, and store output documents from the browser, plus an MCP server so Claude Code skills can push data into that app automatically.

---

### Why connect skills to a web app

Skills run entirely inside Claude Code. They produce analysis, documents, and recommendations — but all of it disappears after the session ends unless manually saved somewhere. The web app gives those outputs a persistent home: sprint status, KPI history, and generated documents are stored in Supabase and visible at any time from the browser. The MCP server is the bridge — it lets skills write to the web app without the user doing anything manually.

---

### Web app

Built in `indie-maker-web/` using Next.js 14 App Router + Supabase + shadcn/ui. DB schema: four tables — `projects`, `documents`, `task_completions`, `metrics`. RLS on all. Authentication via GitHub OAuth.

Key pages:
- `/dashboard` — project list
- `/projects/new` — new project form
- `/today` — D1–D29 task checklist with completion persistence
- `/timeline` — D1–D29 grid with phase colors and completion rate
- `/documents` — markdown upload, view, and preview
- `/metrics` — KPI tracker + Kill/Go gauge (recharts)

Notable issues hit during the build: `useOptimistic` crash on React 19 → replaced with `useState`; Supabase type inference errors → explicit `as Type` casts; login SSR error → `force-dynamic`.

---

### MCP server

When a skill finishes analysis, results need to flow into the web app automatically. A stdio-based MCP server (`mcp-server/src/index.ts`) was built and registered globally in `~/.claude/settings.json`.

Tools exposed:
- `im_get_status` — query current phase and completion rate
- `im_complete_task` — record a task as done
- `im_upload_document` — save a skill output document
- `im_log_metric` — record a KPI value

The first approach passed UUIDs directly — you'd pass the project ID on every call. That meant memorizing a UUID across sessions. Instead, a `.indie-maker` file at the project root stores the project name, and the MCP server resolves it to a UUID via ilike search on each call. Multi-project sessions work naturally: whichever `.indie-maker` file is in the current working directory determines which project gets the data.

Six skill files (planner, researcher, ux, designer, launcher, analyst) were updated with MCP auto-call instructions — when a skill produces output, it writes to the web app via MCP as well.

---

### Key Decisions

| Decision | Rationale |
|---|---|
| MCP transport: stdio | Claude Code CLI standard |
| `.indie-maker` file for project identity | No manual UUID entry; multi-project sessions supported naturally |
| Skills stay in Claude Code | Web app manages outputs only — skills don't move |
| VSCode Extension unsupported | `settings.json` MCP only loads in Claude Code CLI |

---

### Next

- [ ] Create `.indie-maker` in jd-analyzer root; test end-to-end from CLI
- [ ] Validate multi-project isolation with a second project
- [ ] Build landing page (`/` root)
- [ ] Integrate Stripe Checkout (Free/Pro/Lifetime)
- [ ] Deploy to Vercel (production)
- [ ] Commit MCP server changes

---

## jd-lens

> Demand validation + Chrome Extension approach confirmed. UX flow, wireframes, design system, DB schema, and API design completed in one sprint.

JD Lens is a tool that extracts required skills from job descriptions and — as you accumulate more JDs — shows which skills appear how often. Today covered everything from demand validation to UX, design, and backend in about five hours.

---

### Demand validation

indie-market-researcher returned demand 7/10, WTP 6/10. Verdict: validated. The key signal: **no multi-JD aggregation tool exists**. Tools that analyze a single JD are out there, but nothing that stacks 100 JDs and tells you "React appears in 73% of them." That gap is what JD Lens fills.

The approach is Chrome Extension MV3 with client-side DOM parsing — one click to save a JD without copy-paste. OCR for image-based JDs is deferred to V2. Kill criteria: 1 paid conversion by D29. Activation event: skill frequency view after 3 JDs. Pricing: freemium ($9/mo KR, $15/mo global).

---

### Design sprint

**UX (indie-ux / Kai)**: Mental model mapped to LinkedIn + Notion + GitHub. Left sidebar navigation, 7 screens. Output: `ux-flow.md` + `wireframes.md`.

**Design (indie-designer / Vera)**: Single primary color — blue-600 (#2563EB, 5.2:1 WCAG AA), Inter font. Brand direction is "clarity" — no accent color to keep focus. Output: `design-brief.md` + `landing-copy.md`.

**Backend (indie-backend / Axel)**: Four tables — `profiles`, `subscriptions`, `jd_entries`, `jd_skills`. RLS on all. APIs: `POST /api/jds`, `GET /api/jds`, `GET /api/skills`. JD parsing runs via Claude Haiku as fire-and-forget — no user-facing latency. Failures leave `is_parsed=false` for a V2 retry queue. Extension auth uses `chrome.storage.local` to hold a Supabase JWT, which the popup uses to call the API directly.

---

### Why jd_skills is a separate table, not JSONB

JD parse results could have been stored as a JSONB column on `jd_entries`. But the core feature — "which skills appear how often across all your JDs" — requires `GROUP BY skill_name`. That query is expensive and slow against JSONB. Separating `jd_skills` into its own table, with one row per skill per JD, makes the aggregation a simple `GROUP BY` with no overhead.

---

### Key Decisions

| Decision | Rationale |
|---|---|
| `jd_entries` + `jd_skills` separate tables | `GROUP BY skill_name` aggregation requires normalized rows, not JSONB |
| Claude Haiku for parsing | Fastest and cheapest; Opus/Sonnet is overkill for JD text extraction |
| Fire-and-forget background parsing | No save latency; failures tracked via `is_parsed=false` for V2 retry |
| Single primary color (blue-600) | "Clarity" brand — no accent keeps the focus |
| Free tier = 5 JDs | Activation event (3 JDs) happens inside the free tier — value before paywall |

---

### Next

- [ ] Design smoke test — track paid conversion from first 5 free JDs over 2 weeks
- [ ] Clean up empty `research/` folder in project root
- [ ] `/indie-frontend` — Chrome Extension MV3 content script + popup
- [ ] `/indie-frontend` — Next.js dashboard (skill bar chart) + `/jds` page
- [ ] Supabase project setup + migration files
- [ ] Stripe product/price + webhook
- [ ] `/indie-infra` — Vercel deployment + domain
