---
title: "2026-02-27 Session Log"
date: 2026-02-27
description: "wrap-up: wrap-to-blog skill + ActivityCalendar, blog-logs-activity: added Logs collection, lingua-rag: Google OAuth + Supabase migration + history UI, competitive-agents: ran full launch-kit plugin competitive pipeline (2 rounds) — selected Fuse A+B and deployed v1.1.0"
tags: ["wrap-up", "blog-logs-activity", "lingua-rag", "competitive-agents"]
---

## Topics Worked On Today

- [wrap-up](#wrap-up)
- [blog-logs-activity](#blog-logs-activity)
- [lingua-rag](#lingua-rag)
- [competitive-agents](#competitive-agents)

---

## wrap-up

> Implemented wrap-to-blog skill + expanded blog ActivityCalendar to all collections

### Done

- feat: implemented `wrap-to-blog` skill (`plugins/wrap-up/skills/wrap-to-blog/SKILL.md`) — automatically saves session records to blog logs collection after wrap-up completes
- feat: added `blog_log` section to `config.yaml` (enabled flag, blog_dir, collection)
- feat: added Step 6 to `SKILL.md` — prompts whether to generate blog log after checking `blog_log.enabled`
- feat: added blog `logs` collection schema (`src/content/config.ts`)
- feat: added logs list/detail pages to blog (`src/pages/logs/index.astro`, `[...slug].astro`)
- feat: implemented `ActivityCalendar` component — GitHub grass style, 52 weeks×7 days, pure CSS Grid
- feat: added Activity section to blog home + added Logs nav item to Header
- feat: expanded `ActivityCalendar` to support digests/learnings/logs combined
- feat: added `ActivityEntry` type + `getAllByDateMap()` to `posts.ts` — unified date map across 3 collections
- feat: rendered each post title as a clickable link in tooltip, tooltip stays on mouse move with 150ms hover delay
- chore: registered `wrap-to-blog` symlink (`~/.claude/skills/wrap-to-blog`)
- feat: added Session Management rules to `CLAUDE.md` — suggest wrap-up on topic switch

### Key Decisions

- **wrap-to-blog as a separate skill**: can be auto-invoked from Step 6 or run independently as `/wrap-to-blog`
- **ActivityCalendar unified dateMap**: expanded from logs-only → unified across 3 collections, abstracted as `ActivityEntry { title, url }` type
- **Tooltip hover delay approach**: implemented with `pointer-events: auto` + mouseenter/mouseleave + 150ms timeout to allow clicking links inside tooltip
- **config.yaml reused**: was marked as "unnecessary file" in a previous session, but now has a purpose with the `blog_log` section — kept

### Next

- [ ] Commit project changes (wrap-to-blog skill + blog changes)
- [ ] Test actual wrap-up → wrap-to-blog end-to-end flow
- [ ] Verify ActivityCalendar behavior after blog GitHub Pages deployment
- [ ] Update plugin.json version

---

## blog-logs-activity

> Added Logs collection + GitHub-style ActivityCalendar to AI Learning Blog

### Done

- feat(blog/content): added `logs` collection — defined `logSchema` (title, date, description, tags), registered in `config.ts`
- feat(blog/pages): `logs/index.astro` — log list page in reverse chronological order
- feat(blog/pages): `logs/[...slug].astro` — individual log detail page
- feat(blog/components): `ActivityCalendar.astro` — GitHub-style annual contribution heatmap (month labels, day labels, 4 intensity levels, tooltip, year selector, date click drill-down, Show more pagination)
- feat(blog/utils): added `getAllLogs()`, `getLogsByDateMap()`, `getAllByDateMap()` to `posts.ts`
- feat(blog/pages): integrated Activity section into `index.astro` home
- feat(blog/components): added "Logs" navigation item to `Header.astro`
- chore(blog/content): added 4 sample logs (2026-02-23 ~ 2026-02-27)

### Key Decisions

- `getAllByDateMap()` aggregates logs + digests + learnings by date into a single calendar
- Calendar rendering uses client-side JS (data-cal JSON payload) — compatible with Astro SSG
- Uses UTC date arithmetic (`T12:00:00Z`) — prevents date shift from KST timezone offset (+9)
- Future dates rendered transparently (not clickable), full year rendered through December 31st
- Year selector supports multi-year switching; defaults to current year

### Next

- [ ] Dark mode support — current cell colors are fixed GitHub green (need to replace with CSS variables)
- [ ] Add tag filtering to Logs list page
- [ ] Consider search functionality (e.g. Pagefind)
- [ ] Keep adding log entries to fill the calendar
- [ ] Verify behavior on GitHub Pages after deploying changes

---

## lingua-rag

> History UI, Supabase DB migration, and Google OAuth auth implementation across 3 sessions

### Done

**History UI + Cold Start Handling**
- feat(backend): added `message_count` LEFT JOIN to `list_by_session` query
- feat(frontend): added `/api/conversations`, `/api/conversations/[id]/messages`, `/api/health` proxy routes
- feat(frontend): `useChat` — auto-loads DB history on unit switch
- feat(frontend): `useBackendHealth` hook — detects backend warm-up (3s polling, max 20 attempts)
- feat(frontend): cold start banner — "Server is starting" amber banner at top

**Supabase DB Migration (Render PostgreSQL → Supabase)**
- chore(db): migrated Render PostgreSQL → Supabase (PostgreSQL 17.6, Singapore)
- feat(db): `schema.sql` — added `CREATE EXTENSION IF NOT EXISTS vector` (v0.2 RAG preparation)
- fix(backend): `connection.py` — `sslmode=require` DSN parsing + automatic asyncpg `ssl='require'` configuration
- fix(deploy): resolved Render deployment failure (`OSError: Network is unreachable`) → switched to Session Mode Pooler URL

**Google OAuth + JWT ES256**
- feat(auth): implemented Google OAuth — Supabase Auth + `@supabase/ssr`, middleware route protection
- feat(auth): `deps/auth.py` — ES256 token verification via PyJWT JWKS client (`cryptography` + `certifi`)
- feat(db): dropped `sessions` table, replaced with `conversations.user_id` (auth.users.id)
- feat(frontend): added `lib/supabase/{client,server}.ts`, `middleware.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts`
- feat(frontend): 3 API proxies — switched from `lingua_session` cookie to `Authorization: Bearer` header
- feat(frontend): sidebar bottom user card — initial avatar + name display, click shows popover (email + logout)
- fix(auth): Supabase new project JWT ES256 — switched to JWKS endpoint + `PyJWKClient`
- fix(auth): macOS Python 3.13 SSL — explicitly injected `certifi` CA bundle into JWKS client
- fix(deploy): `middleware.ts` Next.js 15 type error + missing `setup/page.tsx` commit → resolved 404

### Key Decisions

- **Chose Supabase Auth**: integrates DB + Auth on the same platform — no additional service needed
- **JWKS/ES256**: new Supabase projects use ES256 instead of HS256. Removed `SUPABASE_JWT_SECRET`, configured JWKS via `SUPABASE_URL`
- **Explicit certifi injection**: macOS Python.org install doesn't include system CA → use `certifi.where()` explicitly. Same behavior on Render (Linux)
- **Session Mode Pooler**: Supabase direct connection is IPv6-only → use Session Pooler (5432) compatible with both Render and macOS
- **Removed session cookie entirely**: `lingua_session` httponly cookie → JWT Bearer. Simultaneously resolved OQ-1 (expiry) and OQ-6 (multi-device)

### Next

- [ ] Production E2E verification — confirm Render redeployment, Google login → chat → multi-device history sharing
- [ ] Start v0.2 RAG — select embedding model (ADR-003), PDF parsing, pgvector vector search

---

## competitive-agents

> Ran full launch-kit plugin competitive pipeline (2 rounds) — used planning-interview outputs as mission context, selected Fuse A+B, deployed v1.1.0

### Done

- feat(competitive-agents): completed full launch-kit plugin pipeline (2 rounds × 2 agents)
  - Phase 1: Alpha(Pragmatist) + Beta(Architect) v1 generated in parallel
  - Phase 2: Cross-review Round 1 — Alpha 81/100, Beta 88/100
  - Phase 3: Improve Round 1 — v1→v2 (Alpha 89/100, Beta 97/100)
  - Phase 4: Cross-review Round 2 — v2 evaluation complete
  - Phase 5: Improve Round 2 — v2→v3
  - Phase 6: Judge evaluation (Opus) — Alpha wins 88.5/100 vs Beta 82.0/100
- feat(launch-kit): selected Fuse A+B → generated fused v1.1.0
  - Alpha structure (correct file format, symlink-aware template paths) + Beta features integrated
  - Integrated Beta features: notes_partial 3-tier routing, Korean slug handling, email preview text rules, CLAUDE.md developer guide
- chore(launch-kit): copied fused v1.1.0 → `plugins/launch-kit/` + `npm run link` complete
- chore(competitive-agents): handled large temp output files (51–87KB) via Python parsing to extract v2/v3 files

### Key Decisions

- **Why Beta v3 was overtaken**: Beta (97/100 at v2) wrapped all files in ` ```markdown``` ` code fences in the v3 improver → YAML frontmatter unparseable → Convention Compliance dropped 15→7.5 → Alpha took the win
- **Chose Fuse approach**: combined Alpha's correct file format + Beta's functional superiority. Margin was small (6.5 points) and Beta features represent genuine UX improvements, making Fuse superior to Use Winner
- **notes_partial 3-tier routing**: fully extracted (skip) / partially extracted (targeted follow-up only) / not extracted (full question)
- **Korean product name slugs**: `contains_non_ascii()` detection → explicitly requests Latin slug, includes empty slug fallback

### Next

- [ ] Real-world test of launch-kit v1.1.0 — notes_partial 3-tier routing, Korean slugs, email preview text
- [ ] competitive-agents: add "do not wrap entire file content in code fences" warning to improver prompt
- [ ] Verify competitive-agents Step 11.5 behavior (select generate_docs = Yes) — not tested this session (selected No)
