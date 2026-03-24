---
title: "2026-03-24 Session Log"
date: 2026-03-24
description: "LinguaRAG: Full sprint day — LLM provider migration, production hardening, subscription infrastructure, deployment"
tags: ["lingua-rag"]
---

## ## LinguaRAG

A marathon 8-session day on LinguaRAG — migrating from Anthropic to OpenAI, deploying to production, and building the subscription infrastructure from scratch.

---

## LLM Provider Migration: Anthropic → OpenAI

The biggest change of the day. Migrated the entire LLM stack from Anthropic (Claude) to OpenAI (GPT-4.1 family).

### What Changed

- **Chat**: Claude Haiku/Sonnet → GPT-4.1-nano (free tier) / GPT-4.1-mini (Plus tier)
- **Translation, Summarization, Reranking**: All switched from Anthropic SDK to OpenAI SDK
- New `chat_service.py` module with OpenAI streaming, retry logic, and tier-based model selection

### Why

- **91% cost reduction**: Monthly estimate dropped from ~$74 to ~$6.90
- **Provider simplification**: One SDK to maintain instead of two
- **GPT-4.1-nano is practically free**: $0.10/M input tokens — viable for guest users

### Quality Verification

- Ran blind test across 21 CJK tutoring queries — all passed
- GPT models needed explicit prompt engineering for language matching and page citations (Prompt v4.1)
- Added "CRITICAL RULE: detect user's language" since GPT doesn't match language as naturally as Claude

---

## Production Deployment

### Backend: Render → Koyeb

- Render free tier expired. Migrated to **Koyeb** (free tier, 512MB RAM, always-on)
- Dockerfile config, environment variables, health check, CORS setup
- Backend live at `final-rosemarie-jsoft-d7ea39ed.koyeb.app`

### Frontend: Vercel

- Reconnected Git Integration for automatic deploys
- Frontend live at `lingua-rag.vercel.app`
- Fixed `STORAGE_MODE=supabase` (was still pointing to local storage mode)

---

## Production Hardening

### Security

- **CSP (Content Security Policy)**: 14 directives covering Supabase, Google One Tap, pdfjs, unpkg, Sentry
- **Security headers middleware**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- **Rate limiting** (slowapi): Global 120/min, chat 30/min, guest chat 20/min, translate 60/min
- **GDPR deletion API**: `DELETE /api/account` — transactional deletion across 10 tables + Supabase Storage

### Upload Limits

- Guest: 100 pages, 10MB, 3 uploads/day
- Free: 200 pages, 10MB
- Plus: 2,000 pages, 150MB, unlimited uploads
- Limits served via `/api/health` — frontend reads dynamically (no hardcoding)

### Error Handling

- Unified error shape: `{ detail, code, field? }`
- Upload-specific codes: `FILE_TOO_LARGE`, `TOO_MANY_PAGES`, `INVALID_PDF`, `INVALID_FILE_TYPE`
- Plus plan limit info included in error responses for upsell
- Empty text annotation prevention (Pydantic field_validator)

### Observability

- **Sentry**: frontend (`@sentry/nextjs`) + backend (`sentry-sdk[fastapi]`)
- **Structured logging**: JSON format in production with `request_id` middleware
- **Cost alerts**: Daily $1 threshold warning in logs
- **SEO**: metadata template, OG/Twitter cards, robots.ts, sitemap.ts

---

## Subscription Infrastructure

### 3-Tier Plan (Finalized)

| Feature      | Guest | Free | Plus      |
| ------------ | ----- | ---- | --------- |
| AI Model     | nano  | nano | mini      |
| Messages/day | 10    | 30   | Unlimited |
| Pages/PDF    | 100   | 200  | 2,000     |
| File size    | 10MB  | 10MB | 150MB     |
| Price        | $0    | $0   | ₩9,900/mo |

Positioned 33% cheaper than ChatPDF Plus (₩14,900/mo) with language learning tools as differentiator.

### Database

- `subscriptions` table with tier, status, Stripe IDs, period dates
- Row-Level Security policies
- `SubscriptionRepository` with tier lookup, daily message counting
- Chat endpoint reads tier from DB for model selection and message limits

---

## Google Document AI OCR Integration

- Integrated Google Document AI as alternative to Claude Haiku Vision OCR
- Online processing limit: 15 pages per request (image-based PDFs)
- Automatic chunk splitting for larger documents
- Successfully indexed 77-page Chinese textbook

### Unified 2-Phase Indexing

- **Phase 1**: First N pages → immediately available for greeting/chat
- **Phase 2**: Remaining pages → background indexing
- Works across all OCR modes (Haiku Vision, Google DocAI, RapidOCR)
- Previously, text-based PDFs put ALL pages in Phase 1 — now limited to 15

---

## Guest → Login Flow Fixes

Several bugs in the guest-to-authenticated-user transition:

1. **Atomic claim**: PDF + conversation transfer now in single DB transaction (was separate, could orphan conversations)
2. **Storage fallback**: Serve endpoints fall back to guest path during background storage move
3. **Stale entry cleanup**: Remove localStorage entries whose server ID no longer exists
4. **Greeting race condition**: Dual useEffect (main + guest history) caused greeting to not display — unified into single effect

Added 12 integration tests for claim flow atomicity and edge cases.

---

## Hydration Fixes

Three SSR/client mismatch issues resolved:

1. **useAuth**: Removed `typeof window` from module-level check — always start null, set in useEffect
2. **useResizePanel / useMultiSplit**: Moved localStorage reads from useState initializer to useEffect
3. **AppHeader**: Added isLoading prop to render placeholder during auth loading

**Pattern established**: Always `useState(default)` + `useEffect(restore from localStorage)` — never read localStorage in the initializer.

---

## CI Pipeline Fixes

- **Backend lint**: Fixed 50 ruff errors (line length, import order, unused imports, f-strings)
- **Backend tests**: 9 failures → all passing (reflected pageMode removal, guest sentinel auth changes)
- **Frontend lint**: Migrated from `next lint` to `eslint .` (Next.js 16 removed the lint subcommand)

---

## Sprint Schedule

Created an 8-day sprint plan (03-24 → 03-31) with 3 parallel workstreams:

- **Stream A**: Backend (Python) — `backend/` directory
- **Stream B**: Frontend (TypeScript) — `frontend/` directory
- **Stream C**: Infra/Docs/External — root + docs + external services

Day 1-4 completed today. Remaining: flashcard generation, Stripe integration, E2E tests, design system, blog post.

---

## Key Numbers

| Metric                     | Before | After |
| -------------------------- | ------ | ----- |
| LLM monthly cost (est.)    | $74    | $6.90 |
| Test count                 | 84     | 96    |
| Lint errors                | 50     | 0     |
| CI steps passing           | 2/5    | 5/5   |
| Completed todo items today | 0      | ~25   |
