---
title: "2026-04-11 Dev Log"
date: 2026-04-11
description: "TTS language fallback, PDF viewer bug fixes, backend free-tier scaling, OCR pipeline improvements, greeting latency reduction"
tags: ["nativ", "frontend", "backend", "performance", "bugfix"]
---

## nativ — Session 1: TTS & PDF Viewer Fixes

> TTS UI language fallback, learning language modal re-entry logic, PDF page jump fix, toolbar visibility

### What I did

- **feat(tts):** When no learning language is selected, TTS now falls back to the UI language (`useUIStore.language`) instead of staying silent. Sound and pronunciation buttons work immediately after uploading a PDF, even before setting a learning language.
- **fix(tts):** `useTTSStore.speak()` uses `effectiveLang = learningLang ?? useUIStore.getState().language ?? "en-US"`. The pre-selected voice cache is only used when `learningLang` is explicitly set.
- **fix(tts):** All three `PronunciationModal` call sites (PdfViewer, ChatPanel, NoteViewer) updated: `lang={learningLang ?? uiLanguage ?? "en-US"}` instead of a hardcoded `"en-US"` fallback.
- **fix(pdf-viewer):** The learning language modal now only appears on **re-entry** (when `lastChatAt` is set), not on first PDF upload. Applied to both logged-in and guest paths.
- **fix(pdf-viewer):** Added a `pdfReady` guard to the page-restore effect. Previously, when `pdfServerId` arrived asynchronously after upload, the restore effect re-ran and jumped the user back to page 1 — even if they had already navigated elsewhere during indexing.
- **fix(pdf-viewer):** `/init` response with `data.language = null` no longer resets `learningLang` if the user already selected one (e.g. before `pdfServerId` arrived). Same guard applied to the guest language effect.
- **fix(pdf-toolbar):** T (text annotation) and side-note buttons are now always visible when the PDF is loaded, regardless of whether `pdfServerId` has arrived. Removed the conditional rendering that caused them to appear with a delay after upload.
- **fix(ui):** `SummarySaveModal` textarea focus ring changed from green (`focus:ring-green-300`) to the theme accent color (`focus:ring-accent`).

### Key decisions

- **UI language as TTS fallback (not silent):** Both stores use the same BCP-47 format, and `useUIStore` does not import `useTTSStore`, so there's no circular dependency risk.
- **`lastChatAt` as re-entry signal:** `null` means first visit (no modal), set means the user has been here before (show modal if language not configured). Avoids adding a separate "visited" flag to the schema.
- **Greeting bug needs a redesign:** Root cause is `historyLoadedRef=true` firing before `serverPdfId` arrives. A `greeted` DB column alone doesn't fix the timing race — needs rethinking. Reverted all changes related to this approach.

### Bugs identified (not yet fixed)

- **Greeting disappears after mid-stream refresh (guest mode):** Two failure modes — (1) `serverPdfId=null` on mount immediately sets `historyLoadedRef=true`, so the auto-greeting fires before history is checked; (2) an auth state flip (`wasGuest !== isGuest`) triggers an early return with no history fetch and no `historyLoadedRef=true`, leaving the chat empty.

---

## nativ — Session 2: OCR Pipeline & RAG Improvements

> OCR text extraction fallback fix, Phase 1 page limit reduction, RAG parallelisation, greeting `<q>` button page context fix

### What I did

- **fix(ocr):** `_extract_page_text()` now has a proper fallback chain: paragraphs → lines → tokens. This fixes structured/checkbox pages that were missing a top-level `layout.text_anchor`, causing them to silently return empty text during indexing.
- **perf(indexing):** Reduced Phase 1 OCR from 15 pages → 7 (`_PHASE1_OCR_PAGES`). Greeting fires ~8 seconds sooner on image-based PDFs. The remaining pages are still indexed in background Phase 2.
- **perf(rag):** `embed(message)` and `get_chunks_by_page()` now run in parallel via `asyncio.gather` inside `_unified_rag`. Saves ~100ms per chat request. The embedding call is OpenAI I/O and doesn't consume an extra DB connection.
- **fix(chat):** Greeting `<q>` suggestion buttons now send with `skipPageContext=true` — prevents cover page (p.1) chunks from being injected as RAG context for whole-document questions.
- **fix(i18n):** Korean quick-action messages changed from informal (`~해줘`) to polite honorific form (`~해 주세요`).

### Key decisions

- **`_PHASE1_OCR_PAGES = 7` is a separate constant from `_DOCAI_PAGE_LIMIT = 15`:** The DocAI API limit and the "how many pages before the greeting" question are different concerns. Validated with a 301-page Chinese PDF — title and structure were correctly recognized from 7 pages.
- **`skipPageContext` on greeting suggestions:** All 3 AI-generated questions target the whole book, not the current page. Sending without `page_number` routes to full-PDF vector search, which is correct in every case.

---

## nativ — Session 3: Backend Free-Tier Scaling

> DB connection pool sizing, single-query tier check, retry jitter, embed semaphore, guest rate-limit cleanup

### What I did

- **perf(db):** Increased asyncpg `max_size` from 5 → 15 in `connection.py`. Supports ~50 concurrent users within Supabase Free's 20-connection cap (leaving headroom for internal connections). The old limit caused pool exhaustion 500 errors at ~6 concurrent users.
- **perf(chat):** Replaced two separate DB calls (`get_tier()` + `get_daily_message_count()`) with a single `get_tier_and_daily_count()` round-trip. Saves one query on every logged-in chat request.
- **perf(chat):** Added `random.uniform(0, 0.5)` jitter to the OpenAI 429 retry backoff in `chat_service.py`. Prevents thundering-herd re-collisions when multiple users hit rate limits simultaneously.
- **perf(indexing):** Added a module-level `_EMBED_SEMAPHORE = asyncio.Semaphore(3)` in `indexing_service.py`. Caps concurrent `embed_batch()` calls across all active indexing jobs, preventing 429 spikes when multiple image PDFs are uploaded at the same time.
- **fix(guest):** `_cleanup_tracker()` is now called on each `_record_upload/chat/translation()` call. Automatically prunes previous-day keys from the in-memory rate-limit dicts. No scheduler needed.
- **test:** Updated `test_chat_streaming.py` mocks to match the new `get_tier_and_daily_count` tuple return signature.
- **test:** Fixed `test_billing_webhook.py` SQL assertions — `status = 'active'` → `status IN ('active', 'past_due', 'trialing')` to match the actual query.
- **docs:** Updated `system-architecture.md`, `auth-security.md`, `chat-streaming.md`, `pdf-upload-indexing.md`, `subscription-billing.md` (EN + KO) to reflect all changes.

### Key decisions

- **`max_size=15`, not higher:** Supabase Free has a hard 20-connection limit shared with internal services. 15 leaves safe headroom. The remaining bottleneck is the single Koyeb vCPU, not DB connections.
- **Guest tracker cleanup at record-time:** Zero infrastructure overhead, runs exactly when needed. The minor per-request cost is acceptable vs. running a background scheduler.
- **`_EMBED_SEMAPHORE(3)` at module level:** A single semaphore shared across all concurrent indexing jobs is the correct scope. Per-request semaphores would have no effect.
- **`/health` endpoint — no caching added:** Polling stops on the first success, so there's at most 1 DB query per page load when the server is warm. A 30s cache would add complexity for no real gain at current scale.
