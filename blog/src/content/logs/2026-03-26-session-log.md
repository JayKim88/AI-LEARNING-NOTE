---
title: "2026-03-26 Session Log"
date: 2026-03-26
description: "LinguaRAG: chat rendering fixes, ghost PDF elimination, IndexedDB user-scoping, Turbopack CPU diagnosis, tier-based limit enforcement"
tags: ["lingua-rag"]
---

## LinguaRAG

## Session 1 — Chat Rendering & Ghost PDF Entries

> Fix invisible messages after PDF upload, eliminate ghost sidebar entries from unscoped storage keys, and improve code quality across useChat/usePdfLibrary/PdfViewer

### What Was Done

**Chat rendering — invisible messages bug:**
The chat panel used a `scrollReady` state with `opacity-0`/`opacity-100` to prevent a scroll-position flash when loading message history. This created a race condition: when `isLoadingHistory` toggled true→false at certain timings, `scrollReady` got stuck at `false`, leaving messages permanently invisible despite being in the DOM.

Fix: replaced the entire `scrollReady`/`prevLoadingRef`/`requestAnimationFrame` pattern with two simpler effects — `useLayoutEffect` for instant scroll-to-bottom after history load (runs before paint, no flash), and `useEffect` for smooth scrolling on subsequent messages.

Additionally, `prevPdfIdRef` was initialized with the current `pdfId` value, meaning the first mount was never treated as a "PDF switch." This caused `historyLoadedRef` to stay `false` when `serverPdfId` was null (new uploads), blocking the auto-greeting. Changed initialization to `null` so every first mount correctly enters the full PDF switch path.

**Ghost PDF entries — the root cause chain:**
After another session introduced user-scoped localStorage keys (`lingua-pdf-library:{userId}`), PdfViewer's `handleFileChange` was still reading from the unscoped `LIBRARY_CURRENT_KEY` (`"lingua-pdf-current"`). This returned a stale chatId from a previous session, the library lookup failed, and `upsertLibraryMeta` created a brand new entry using the File object's original filename — producing "ghost" entries like `fr_sample.pdf` appearing in the sidebar whenever any PDF was clicked.

The fix removed `LIBRARY_CURRENT_KEY` from PdfViewer entirely (5 references). Since PdfViewer is always rendered by a parent that provides `openFile` and `chatIdProp`, there's no need for standalone localStorage-based restoration. The ~30 LOC standalone restore path was deleted.

**Name-based matching removed:**
Multiple code paths used `library.find(m => m.name === f.name)` as a fallback identifier. This is fundamentally broken — filenames aren't unique (same file uploaded multiple times, renames create mismatches). All matching now uses `chatId` or `pdfServerId`. The `migratePdfKey` (IndexedDB name-based lookup) was demoted to last-resort after server download, preventing wrong-file matching.

**IndexedDB user-scoped keys:**
IndexedDB `pdf-files` store previously used bare `chatId` as keys, meaning all accounts on the same browser shared a single key space. Introduced `{userId}:{chatId}` prefix (guests use `guest:{chatId}`). `loadPdfFromLibrary` transparently migrates legacy unscoped keys on read. A GC function runs once after server sync, removing orphaned entries for the current user's prefix while leaving other users' cached files untouched.

**Other fixes:**

- `selectPdf` re-reads `pdfServerId` from storage after async IndexedDB operations (prevents stale value from upload race condition)
- `activeChatIdRef` changed from `useEffect` to render-time assignment (eliminates effect-cycle delay)
- `getPageNumber` moved to ref pattern, removed from `processMessage` deps (prevents cascade re-creation of sendMessage→sendGreeting→auto-greeting effect)
- `fetchHistory()` helper extracted in useChat (30 lines of duplication removed)
- Greeting recovery safety net removed (25 LOC, no longer needed)
- Guest→login transfer now waits for ALL pending uploads, not just the active PDF
- Broken className in page.tsx resize handle fixed (missing ternary)
- Root `package-lock.json` deleted (caused Turbopack to watch backend files → 460% CPU loop)

### Key Decisions

- **IndexedDB is a cache, not source of truth.** localStorage library is authoritative. Missing files can always be re-downloaded from the server. This simplifies the mental model — no bidirectional sync needed, just periodic GC.
- **Key prefix over separate IDB stores.** `{userId}:{chatId}` mirrors the localStorage scoping pattern and avoids IDB version management complexity.
- **Parent is the single source of truth for PDF identity.** PdfViewer should never independently resolve chatId via localStorage. `chatIdProp` from the page component is always used.

---

## Session 2 — Turbopack CPU Spike & Dev Environment

> Diagnose Next.js 16 Turbopack CPU spikes, ConnectTimeoutError on auth callback, Sentry dev exclusion, and subscription config consistency

### What Was Done

Diagnosed that Next.js 16 makes Turbopack the mandatory default bundler (`--no-turbopack` flag doesn't exist). JIT compilation of 6+ API routes on first login causes CPU spikes that saturate the Node.js event loop, leading to undici TCP connect timeouts when calling Supabase during `/auth/callback`.

Excluded Sentry from dev mode with a two-layer guard: both `withSentryConfig` in `next.config.ts` and `register()` in `instrumentation.ts` must be independently guarded. Health check timeout was split (dev 10s / prod 5s) with a warming banner shown only after 2+ failures.

Fixed subscription config inconsistencies: guest `daily_translations` hardcoded to `-1` (guests can't access translate endpoint), billing page features made dynamic from `planLimits` context instead of hardcoded values. Added i18n interpolation for daily limit messages across all 10 locales.

### Key Decisions

- **Turbopack CPU spikes accepted as environmental limitation** — no workaround available in Next.js 16. Sentry exclusion and health check tolerance reduce impact.
- **Two-layer Sentry guard required** — the instrumentation hook runs regardless of config wrapping.

---

## Session 3 — Code Review & UI Fixes

> Code review of all session changes, IndexedDB transaction safety analysis, UI overlap and key fixes

### What Was Done

Full code review of the day's useChat, usePdfLibrary, ChatPanel, and PdfViewer changes. Identified one remaining issue: `loadPdfFromLibrary` nests a second `store.get()` inside the `onsuccess` callback of a readonly transaction. While this works in most browsers, the IDB spec allows auto-commit between event loop tasks, risking `TransactionInactiveError` on slow devices. The fix (issuing both get requests simultaneously in the same transaction) was designed but deferred.

UI fixes: `SubscriptionModal` had duplicate React keys (`"Unlimited"` appeared in both `featureBold1` and `featureBold2`), fixed by using array index. Floating header buttons (Plus badge, language selector) overlapped chat content — added a gradient background (`bg-linear-to-b from-surface via-surface/80 to-transparent`). Chat messages hidden behind the floating header — added `pt-14` (56px) padding to the scroll container.

---

## Session 4 — Tier-Based Limit Enforcement

> Implement subscription-tier limits across all features with proper UX differentiation between guest and free users

### What Was Done

**Limit enforcement across all features:**
Added 403 error handling for annotations, vocabulary, memos, and translations. Each feature now checks against tier-specific limits (guest/free/plus) and returns structured error codes (`GUEST_ANNOTATION_LIMIT`, `ANNOTATION_LIMIT`, etc.) with the current limit number and next-tier benefit.

Guest daily translation limiting was added with IP-based counting in the backend, with cache bypass (L1/L2 cache hits don't count toward quota since they incur no AI API cost). In-memory upload counters replaced DB `count_today` queries to prevent the delete-and-reupload circumvention.

**UX differentiation:**
Guest limit errors show `LoginModal` with positive messaging ("Sign in to save up to N"), while free-tier limits show `SubscriptionModal` with upgrade path. The SubscriptionModal's "Start Plus" button triggers Google OAuth directly for guests (no intermediate login modal). SelectionPopup closes before showing the limit modal on translation 429 to avoid UI stacking.

**Daily reset unification:**
All daily counters (uploads, messages, translations) were unified to UTC midnight reset, removing the previous per-timezone `_RESET_HOUR=9` approach. Frontend converts the `resets_at` UTC timestamp to local time for display (KST shows "오전 9:00").

### Key Decisions

- **In-memory counters over DB queries** — `count_today` SQL was defeated by hard-delete loops. In-memory tracker persists through deletion but resets on server restart. Acceptable for current single-instance deployment.
- **UTC midnight for all resets** — simpler than per-user timezone calculation. Frontend handles display conversion.
- **Separate error codes for guest vs free** — enables different modal flows without frontend logic to determine user tier.
- **`free_limit` field in guest error responses** — backend includes next-tier limit so frontend can display "sign in for up to N" without hardcoding numbers.
