---
title: "2026-03-02 Session Log"
date: 2026-03-02
description: "business-avengers: Sprint 2–4 complete — 8 extended KB files + 9 agents upgraded / lingua-rag: PDF viewer modal·hover UX + summary save (Supabase) + SSE empty response bug fix / blog: Plugins Showcase section added"
tags: ["business-avengers", "lingua-rag", "blog"]
---

## Topics Worked On Today

- [business-avengers](#business-avengers)
- [lingua-rag](#lingua-rag)
- [blog-plugins-showcase](#blog-plugins-showcase)

---

## business-avengers

> Sprint 2–4 complete — 8 extended KB files created + 9 agents upgraded with Quality Standards + SKILL.md 8 steps enhanced for expert-grade pipeline output

### Done

**Sprint 2 — Phase 0 (Ideation) + Phase 8 (Monetization)**
- feat(agents): `product-manager.md` — added Quality Standards: Shape Up Appetite (1 person / 6 weeks), feature justification gate ("Without this, X% would churn"), "Will NOT Build" mandatory list (≥3 items), RICE Confidence <50% → Uncertain Priority section
- feat(agents): `cfo.md` — added Quality Standards: Unit Economics thresholds (LTV:CAC >3:1, CAC Payback <12mo, GM ≥70%, NRR ≥100%), 3-Scenario mandate (Best ×1.5 / Base / Worst ×0.5), Goldilocks 3-tier pricing, Burn Multiple red flags
- feat(SKILL.md): Step 4 (Phase 0) — added `problem-validation-deep.md` + `phase-rubrics.md` refs, expanded 4→11 steps (Mom Test interview rules, JTBD job statement format, Assumption Register, Why Now)
- feat(SKILL.md): Step 12 (Phase 8) — added `saas-metrics-bible.md` + `phase-rubrics.md` refs, Goldilocks/annual pricing steps added

**Sprint 3 — Phase 7 (GTM/Launch) + Phase 10 (Growth)**
- feat(knowledge/extended): `gtm-advanced.md` — Geoffrey Moore Technology Adoption Lifecycle + Chasm crossing strategy, First 1,000 Users 3-phase playbook, Product Hunt launch playbook (D-30 prep → D-Day execution → post-launch), Indie Hacker distribution (Reddit/HN/Twitter Build in Public), D-30→D+7 launch timeline template
- feat(knowledge/extended): `growth-engineering.md` — Sean Ellis PMF 40% test, NSM selection framework, Andrew Chen 4 Growth Loop types (Viral/SEO/Paid/PLG), Activation Engineering (Aha Moment identification via D30 retention correlation), ICE/RICE/BRASS prioritization scoring
- feat(agents): `marketing-strategist.md` — added Quality Standards: ICP specificity gate, First 100 Users concrete path, max 2 channels for 90 days, pre-launch warm-up ≥2 weeks mandatory
- feat(agents): `growth-hacker.md` — added Quality Standards: PMF signal required before scaling, NSM Non-Negotiable, Growth Loop identification, Aha Moment definition, ≥3 ICE-scored experiments, AARRR all 5 stages mandatory
- feat(SKILL.md): Step 11 (Phase 7) — expanded 7→12 steps with ICP/First100/Pre-launch/Repeated Launch
- feat(SKILL.md): Step 14 (Phase 10) — added PMF/NSM/Loop/ICE steps

**Sprint 4 — Phase 3 (Design) + Phase 4 (Tech) + Phase 11 (Automation) + Phase 12 (Scale/Exit)**
- feat(knowledge/extended): `design-advanced.md` — Nielsen's 10 Usability Heuristics, Conversion Design (CTA hierarchy, trust signal hierarchy), Empty/Error/Loading state requirements, Friction Audit (5 categories), Mobile-first standards
- feat(knowledge/extended): `tech-architecture-advanced.md` — "Choose Boring Technology" 40h rule, MVA monolith evolution path, AWS Well-Architected 5 Pillars, OWASP Top 10 checklist + fixes, ADR format, scalability triggers
- feat(knowledge/extended): `automation-scale.md` — Automation ROI formula + priority score, Bus Test 10-question (target ≥8/10), 3-Tier monitoring (Uptime + Sentry + Business metrics), Autonomous Org 3-Layer
- feat(knowledge/extended): `exit-strategy.md` — Acquire.com/Quiet Light SaaS multiples table, multiple drivers/killers, FIRE formula, acquisition due diligence checklist, Scale vs. Sell decision framework
- feat(agents): `design-lead.md` — Design System 9-element gate, Nielsen heuristics #1/#3/#5/#8/#9 mandatory, CTA hierarchy rules
- feat(agents): `tech-lead.md` — Boring Tech 40h justification, 5 required ADRs, OWASP Top 10 mandatory, 10× sizing rule, no-code assessment per feature
- feat(agents): `devops-engineer.md` — Automation ROI gate (payback <8 weeks), Bus Test ≥8/10, 3-Tier monitoring mandate, failure notification required
- feat(agents): `revenue-strategist.md` — benchmarked valuation (Acquire.com multiples), Scale vs. Sell explicit decision, multiple improvement roadmap, FIRE number
- feat(SKILL.md): Step 7, 8, 15, 16 — all expanded with extended KB refs + quality gates

### Key Decisions

- **KB language**: all `knowledge/extended/` files in English — 1.5–2× token savings; consistent with agent instruction language
- **Self-Assessment block standardized**: every enhanced agent outputs a Quality Check header (Depth/Evidence/Specificity 1–3 + unmet criteria) before saving output
- **Quality Standards placement**: between `## Expert Frameworks` and `## Communication` in each agent — minimal structural disruption
- **Tier 3 conditional loading**: extended KB files only read when referenced in SKILL.md Task prompt — prevents context pollution

### Next

- [ ] E2E test: run a real idea through the full pipeline — compare Self-Assessment scores across all phases
- [ ] Phase 2 (PRD) SKILL.md Step 6 enhancement
- [ ] Phase 5 (Dev Guide) SKILL.md Step 9 enhancement
- [ ] Phase 6 (QA) SKILL.md Step 10 — Test Pyramid + Core Web Vitals
- [ ] Phase 9 (Operations) SKILL.md Step 13 — North Star Metric + AARRR tools
- [ ] Add Quality Standards to remaining agents (ui-designer, ux-researcher, coo, cto, cmo, cpo, frontend-dev, backend-dev, qa-lead, cs-manager, etc.)

---

## lingua-rag

> Full PDF viewer UX overhaul (optional panel + file management modal + hover popup) + summary save migrated to Supabase + SSE empty response / login 500 bug fix

### Done

**PDF Viewer Improvements (Session 23:54)**
- feat(pdf): PDF search panel → absolute overlay (hover + Cmd+F, 150ms leave delay)
- feat(pdf): "View PDF" button → centered modal (file upload + recent file list + delete), `showPdf` localStorage persisted
- feat(pdf): `lib/pdfLibrary.ts` new — IDB/localStorage helper extracted (resolves SSR error)
- feat(pdf): `PdfViewer.tsx` hover popup — 3 buttons injected on hover over German span (audio / copy / chat)
- feat(pdf): `extractSentenceText` — span-level sentence boundary detection (Korean/symbol boundary heuristics, 2-line sentence merging)
- fix(pdf): chat panel disappearing when PDF opens — `flex-1`(flex-basis:0) → `shrink-0 + style.width`
- fix(pdf): recent file delete button always visible in modal (removed `opacity-0 group-hover:opacity-100`)

**Summary Feature + Supabase Migration (Session 23:56)**
- feat(summary): `InputBar.tsx` — added "Summarize" button (disabled during streaming, hidden when summary open)
- feat(summary): `ChatPanel.tsx` — completed summary overlay (list view + detail view + delete), German text action buttons enabled
- feat(db): `schema.sql` — `summaries` table + indexes (`user_id`, `unit_id`, `saved_at DESC`)
- feat(backend): `SummaryRepository` (list/create/delete), `routers/summaries.py`, registered router in `main.py`
- feat(frontend): `lib/summaries.ts` localStorage → Supabase API migration, new Next.js proxy route
- feat(rag): added `RAG_ENABLED: bool = False` flag + conditional gating in `chat.py`
- fix(backend): missing `settings` import in `chat.py` → `NameError` caused completely empty chat responses
- fix(sse): `Connection: keep-alive` → `Connection: close` + removed ReadableStream wrapper (root fix for empty response bug)
- fix(auth): `middleware.ts` — `new URL("/login", request.url)` clean redirect (removes 500 error + `__nextDefaultLocale=`)

### Key Decisions

- **`shrink-0` vs `flex-1`**: `flex-1`(flex-basis:0) overrides inline `width` when PDF is shown → use `shrink-0 + style.width` when PDF panel is active
- **`lib/pdfLibrary.ts` extracted**: `page.tsx` static import → `react-pdf` SSR load error. Extracted IDB/localStorage helpers as pure TS, `PdfViewer` remains `dynamic(..., { ssr: false })`
- **RAG_ENABLED=False**: Vision(page_image) already provides direct textbook context. No benefit from RAG given added latency/cost. Flag allows re-enabling
- **summaries localStorage → Supabase**: migrated to server storage for per-unit filtering, multi-device sync, and data persistence
- **Connection: close**: explicitly signals undici to close connection after FastAPI streaming ends → simultaneously resolves `UND_ERR_SOCKET` warning and empty response

### Next

- [ ] Verify `UND_ERR_SOCKET` does not recur after `Connection: close` is applied in production (backend redeploy)
- [ ] Apply Prompt Caching — reduce cost/latency by caching system prompt
- [ ] Handle hover popup edge positioning (span near page top → popup goes above viewport)
- [ ] Plan v0.3 kickoff (LLM-as-judge format validation)

---

## blog-plugins-showcase

> Added Plugins Showcase section to blog — sync script, category grouping, Mermaid lightbox

### Done

- feat(blog/scripts): wrote `sync-plugins.ts` — reads README.md from `claude-ai-engineering/plugins/`, generates frontmatter and saves to `src/content/plugins/`. Extracts: title (H1), description (bold line or first paragraph), agentCount (N-agent pattern), category (plugin name mapping), tags (keyword heuristics), lastUpdated (file mtime)
- feat(blog/content): added `pluginSchema` + `plugins` collection to `config.ts` (`title`, `description`, `category`, `agentCount`, `tags`, `lastUpdated`)
- feat(blog/pages): `pages/plugins/index.astro` — portfolio intro section (22 plugins, total agent count), category grouping (5 sections), agent count badge, `<div>` + overlay `<a>` card pattern
- feat(blog/pages): `pages/plugins/[...slug].astro` — reuses PostLayout (Mermaid, TOC, reading time supported automatically)
- feat(blog/components): added "Plugins" navigation item to `Header.astro`
- feat(blog/layouts): added Mermaid lightbox to `PostLayout.astro` — click to enlarge modal, SVG viewBox preserved with width/height removed for fill, close by clicking overlay
- chore(blog): added `"sync-plugins": "tsx scripts/sync-plugins.ts"` script to `package.json`
- fix(blog/pages): nested anchor bug — TagBadge(`<a>`) inside card wrapper(`<a>`) → replaced with `<div>` + `card-overlay` pattern
- fix(blog/layouts): Mermaid lightbox modal smaller than original — removed SVG fixed width/height, applied `width: min(92vw, 1100px)`
- fix(blog/pages): Astro nested ternary + double-nested `.map()` pattern dropping inner children → pre-compute sections in frontmatter JS block, use single-level `.map()`

### Key Decisions

- Sync script output committed to git — no external path access needed at build time, compatible with GitHub Pages CI
- `lastUpdated` uses `fs.statSync().mtime` — reflects actual README modification date, not script run date
- Category pre-computation handled in Astro frontmatter JS block — avoids Astro JSX nested rendering bug
- PostLayout reused as-is for plugin detail pages — Mermaid, TOC and other features work for free

### Next

- [ ] Deploy changes and verify plugins section works on GitHub Pages
- [ ] Consider adding plugin count to home page stats
- [ ] Some plugins have no extracted agentCount (no explicit "N-agent" pattern) — manually fill or improve extraction logic
- [ ] Fix Mermaid lightbox background color in dark mode (currently hardcoded white)
