---
title: "2026-03-25 Session Log"
date: 2026-03-25
description: "lingua-rag: A full production-readiness sprint — error monitoring, subscription UX, Paddle billing, PostHog analytics, legal pages, full i18n (10 languages), and multiple UX bug fixes"
tags: ["lingua-rag"]
---

## lingua-rag

> A long day of shipping: error alerting, subscription UX overhaul, Paddle billing, analytics, legal pages, and full internationalization across 10 languages — plus several tricky UX bugs squashed

---

### Session 1 (16:31) — Error Monitoring: ErrorBoundary + Slack Alerts

**Goal**: Make production failures visible and isolated.

#### Done

- **ErrorBoundary isolation** — Wrapped `PdfViewer` and `ChatPanel` each in their own `ErrorBoundary` component. If one panel crashes, the other keeps working instead of taking down the whole page.

- **Slack error alerts** — Built a lightweight Slack notification system into the backend:
  - `app/core/slack.py` — fire-and-forget async helper (never blocks the main request)
  - `config.py` — `SLACK_WEBHOOK_URL` setting (no-op when not set, so local dev is unaffected)
  - **Three alert triggers**: unhandled 500 errors in `main.py`, AI API retries exhausted in `chat_service.py`, and permanent OCR failures in `indexing_service.py`
  - Connected to a `#lingua-alerts` Slack channel and verified it works

#### Key Decisions

- **Skipped Sentry for now** — Sentry's Slack integration requires a paid Team plan. A direct Slack Incoming Webhook is free and took 30 minutes to set up.
- **Uptime monitoring deferred** — Low ROI until the first paying user. Will set up BetterStack after Paddle is live.
- **`SLACK_WEBHOOK_URL` is optional** — If it's not in the environment, all Slack calls are silently skipped. No risk to local development.

---

### Session 2 (23:01) — Subscription Policy + Modal UX Redesign

**Goal**: Finalize the 3-tier pricing model and build subscription-aware UI.

#### Done

- **Subscription policy document** — Wrote `docs/planning/subscription-policy.md` with the finalized Guest / Free / Plus tier limits:

  | Feature | Guest | Free | Plus |
  |---------|-------|------|------|
  | Chat messages/day | 10 | 30 | Unlimited |
  | Translations/day | 20 | 50 | Unlimited |
  | PDF uploads/day | 3 | 5 | 10 |
  | Max PDFs stored | — | 10 | 50 |
  | Max pages/PDF | 100 | 200 | 2000 |
  | Max file size | 10 MB | 10 MB | 150 MB |

- **LoginModal redesign** — Cleaner layout with logo, a Google OAuth button, and a contextual message explaining why login is being prompted.

- **SubscriptionModal redesign** — ChatPDF-style split layout: left panel with a gradient background and tagline, right panel with feature checkmarks, pricing, and a CTA button.

- **Plus button in header** — Added to the top-right area (left of the language selector). Behavior is role-aware:
  - Guest → opens LoginModal
  - Free user → opens SubscriptionModal
  - Plus user → hidden (no button shown)

- **Sidebar CTA update** — The "Free plan" upgrade link in the sidebar now opens the SubscriptionModal directly instead of routing to `/settings/billing`.

- **i18n keys** — Added `sub.*` and `shell.plusLoginHint` keys to all 10 locale files.

#### Key Decisions

- **Free tier: 30 chat/day, not 50** — 50 would remove too much conversion pressure. Language learners tend to be power users; 30 is enough to demonstrate value without giving away the product.
- **Flashcard feature removed from plans** — Not implemented and low priority. Removed from all plan descriptions.
- **Translation limit more lenient than chat** — Translations are a lighter-weight action (single word/phrase, no streaming), so the limit is higher.
- **Paddle fallback for local dev** — If `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` isn't set, the checkout button falls back to `/settings/billing` instead of crashing.

---

### Session 3 (23:01) — PostHog Analytics, Legal Pages, README, Paddle Billing

**Goal**: Complete the Day 3–5 sprint items — analytics, legal compliance, and billing integration.

#### Done

**Analytics (PostHog)**
- Added `track()` calls for the four most important user events:
  - `pdf_uploaded` — in `usePdfLibrary.ts`
  - `chat_message_sent` — in `useChat.ts`
  - `vocabulary_saved` — in `annotations.ts`
  - `guest_to_login` — conversion tracking in the login flow
- Fixed CSP (Content Security Policy) to allow PostHog: added `us-assets.i.posthog.com` to `script-src` and both PostHog domains to `connect-src` in `next.config.ts`.

**Legal Pages**
- `/privacy` — GDPR rights section, OpenAI data transfer disclosure, TLS/RLS/JWT security details, data retention policy.
- `/terms` — IP rights, list of 8 prohibited activities, AS IS warranty disclaimer (in all-caps per legal standard), limitation of liability, governing law.
- Both pages are custom-built (not Notion-embedded) for better brand trust and because Paddle's verification requires an accessible URL path.

**README Overhaul**
- Updated provider references: Render → Koyeb, Anthropic → OpenAI
- Corrected the architecture diagram
- Updated the test count

**Paddle Billing Integration**
- Switched from Stripe to Paddle — Stripe doesn't support Korean merchants. Paddle's Merchant of Record (MoR) model lets Korean individuals accept global payments without entity setup.
- Backend: `billing.py` router with `/portal` and `/webhook` endpoints. Webhook uses HMAC-SHA256 signature verification.
- Frontend: `lib/billing.ts` with `startCheckout()` and `openPortal()` using the official `@paddle/paddle-js` SDK.
- `/settings/billing` page for subscription management.
- Full account setup: domain verification, ToS acceptance, product + price creation, webhook registration, env vars deployed to both Koyeb and Vercel.
- **End-to-end test**: simulated a `subscription.created` webhook → confirmed `subscriptions.tier = plus` in the database. ✅

#### Key Decisions

- **Stripe → Paddle**: The core reason was Korean merchant support. Paddle's MoR model also handles VAT/GST collection globally, which simplifies compliance.
- **Client-side checkout only**: No backend `/checkout` route needed. `paddle.Checkout.open()` runs entirely in the browser; the backend only needs to handle webhook events and portal redirects.
- **Reused existing Stripe columns**: The `stripe_customer_id` and `stripe_subscription_id` columns were repurposed for Paddle IDs. No migration needed since no real Stripe data was ever written.

#### Issues Fixed

- **Vercel build error**: The billing page used `useSearchParams()` without wrapping it in a `<Suspense>` boundary. Adding `force-dynamic` alone wasn't enough — had to extract a `<SearchParamsHandler>` component and wrap it in `<Suspense>`.
- **Paddle webhook 400**: The `PADDLE_WEBHOOK_SECRET` in Koyeb's environment variables was wrong, causing HMAC verification to fail. Re-entered the correct secret and redeployed.

---

### Session 4 (23:03) — Full i18n Coverage + UX Bug Fixes

**Goal**: Complete internationalization across all frontend components, and fix several UX regressions.

#### i18n Completion

The entire frontend UI is now fully internationalized across **10 languages**: Korean, English, German, French, Spanish, Italian, Portuguese, Russian, Japanese, Chinese.

**15 components covered** (final session):
`PdfViewer`, `PageViewer`, `SidebarTree`, `AppHeader`, `AccountGuideModal`, `LoginModal`, `SubscriptionModal`, `NoteSlidePanel`, `VocabularyNotebook`, `ShellLayout`, `TextAnnotation`, `TextAnnotationToolbar`, `LandingContent`, `PronunciationModal` + `ChatPanel`/`InputBar` (earlier sessions)

**Key groups of translation keys added** (~100+ new keys across all locale files):
- `account.*` — account guide modal
- `login.*` — login modal
- `note.*`, `vocab.*` — note panel and vocabulary notebook
- `tree.*` — sidebar folder/document tree
- `header.*`, `shell.*` — app header and sidebar labels
- `sub.*` — subscription modal (feature list, pricing, CTA copy)
- `annot.*` — text annotation toolbar
- `landing.*` — landing page copy (hero, pricing cards, footer)
- `pdf.*` — PDF viewer toolbar
- `pron.*` — pronunciation practice modal
- `shell.chats`, `shell.folders` — sidebar section headers

**Hydration fix** — The language `useState` in `ChatContext` was initialized from `localStorage` directly, which caused a server/client mismatch (SSR returns `undefined`, client returns the saved value). Fixed by initializing to `"ko-KR"` (a safe SSR default) and syncing to localStorage in a `useEffect`.

#### Bug Fixes

**Language selector showing Korean names**
- Root cause: The PDF viewer's language selector was using `lang.label` (Korean name, e.g., "중국어") instead of `lang.name` (native name, e.g., "中文").
- Fix: Changed `lang.label` → `lang.name` in both the toolbar dropdown and the bottom bar display.

**Vocabulary input showing Korean language name**
- Root cause: `NoteSlidePanel` used `LANG_KO` (a map of language codes → Korean labels) for the word input placeholder.
- Fix: Switched to `LANG_NATIVE` (native names like 中文, Deutsch, Français).

**Language modal appearing twice on PDF upload**
- Root cause: When a new PDF's server ID arrives, the app fetches its language setting. If no language is set yet, it opens the language selection modal. But the `showLangModalRef` guard (which prevents reopening while the modal is open) resets to `false` when the modal is closed — so the effect would trigger again and reopen it.
- Fix: Added `&& !learningLang` as an additional guard. If the user has already selected a language (i.e., `learningLang` is non-null), the modal won't open again even if the server-side language comes back null.

**"Loading previous conversation" spinner showing on new uploads**
- Root cause: `isLoadingHistory` in `useChat.ts` was initialized as `useState(true)`. React renders with this `true` value before any effects run — so on every mount (including fresh uploads with no history), the loading spinner would briefly flash.
- Fix: Changed the initial state to `useState(false)`. Every code path that actually needs to show loading now explicitly calls `setIsLoadingHistory(true)` before fetching.

**"Analyzing PDF" spinner not vertically centered**
- Root cause: The empty state div had `h-full` but was inside a wrapper (`max-w-3xl mx-auto`) with no explicit height, so `h-full` had nothing to fill.
- Fix: Restructured the scroll container to use `flex flex-col`, and gave the empty state `flex-1` directly inside it (instead of nested inside the max-width wrapper). This lets it fill the available vertical space correctly.

**PDF first page covered by floating header overlay**
- Root cause: The PDF viewer has a floating title/view-mode bar (`h-11` = 44px) overlaid at the top. The scroll area only had `pt-4` (16px) of top padding, so the first page was partially hidden.
- Fix: Changed scroll area padding from `pt-4` to `pt-14` (56px), giving 12px of breathing room below the 44px header.

#### Backend: Upload Limit Enforcement

Also landed in this session (committed separately as `bdc8c55`):

- `config.py` — Corrected guest/free limit constants that were set too high during development (`GUEST_MAX_PAGES` was 10,000, should be 100; file size was 300MB, should be 10MB)
- `repositories.py` — Added `PdfFileRepository.count_total()` and `count_today()` queries
- `pdfs.py` — Resolves the user's subscription tier on upload; enforces total PDF count and daily upload limits for free users
- `guest.py` — `GUEST_DAILY_MESSAGES` cap now enforced on the guest chat endpoint
- `usePdfLibrary.ts` — Handles `PDF_LIMIT_REACHED` and `DAILY_UPLOAD_LIMIT` error codes from the backend
- `apiError.ts` — New utility that extracts structured error codes from 403/429 backend responses

### Next

- [ ] End-to-end Paddle checkout test — overlay → test card → Plus tier upgrade confirmed
- [ ] Backend enforcement — translation daily limit (guest 20, free 50)
- [ ] Backend enforcement — annotation/vocab/memo/folder count limits
- [ ] `conversation.updated_at` not bumped on message creation (breaks "recent conversations" sort)
- [ ] Uptime monitoring (BetterStack) — defer until first paying user
