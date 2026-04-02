---
title: "2026-04-02 Session Log"
date: 2026-04-02
description: "Performance optimization for PDF loading and chat response, CJK markdown rendering fixes, Chrome TTS bug fix, production bug fixes (Vercel 4.5MB bypass, CORS, OCR auth), and architecture documentation."
tags: ["nativ", "performance", "bugfix", "docs", "security"]
---

## nativ

Four sessions on the same day — touching performance, rendering bugs, production incidents, and architecture documentation.

---

### Session 1 — 11:21 · Chrome TTS Bug Fix

> Chrome's `speechSynthesis` silently drops the first `speak()` call on a cold tab (tab that hasn't played audio yet), and `cancel()` is async — calling `speak()` right after doesn't work.

**What I did**

- Diagnosed the cold-tab bug via console monkey-patching on `about:blank`
- Built `chromeSafeSpeak()` helper in `useTTS.ts`:
  - **Cold tab**: plays a silent primer utterance (volume 0.01) first — Chrome drops the primer and plays the real one
  - **Already speaking**: waits 100ms after `cancel()` before calling `speak()`
- Removed all direct `cancel()` calls before `speak()` across 5 files: `useTTS`, `SelectionPopup`, `VocabularyNotebook`, `ShellModals`, `PronunciationModal`
- Removed duplicate `doSpeak` in `SelectionPopup` — now reuses `speakWithOptions` prop from parent

**Key insight**: This is a browser-level regression, not a code bug. The silent primer trick exploits Chrome's behavior: it drops the primer, which "warms up" the audio context, so the real utterance plays correctly.

---

### Session 2 — 14:35 · Performance Optimization + CJK Markdown Fixes

> The deployed site was noticeably slow: PDF entry took too long and chat responses had a high time-to-first-token. Also, bold text was rendering broken for Korean/Japanese/Chinese.

**Performance fixes**

- **pgvector index** (`migrations/019_vector_index.sql`): Vector similarity search was doing a full table scan on `document_chunks`. Added an `ivfflat` index (`lists=30` to stay within Supabase free tier's 32MB `maintenance_work_mem` limit). Expected improvement: 500–2000ms → 50–100ms per query.

- **RAG outside the per-user lock** (`chat.py`, `guest.py`): Embedding generation and vector search are read-only — they don't need to be serialized with message persistence. Moved them before `async with user_lock:`. Saves ~800ms of unnecessary lock wait time.

- **Local pdf.js worker**: The PDF rendering worker was fetched from `unpkg.com` CDN on every load. Copied it to `public/pdf.worker.min.mjs` and added a `postinstall` script to keep it in sync.

- **Single `/init` API call**: PDF entry was making 3–4 separate requests (`/annotations`, `/vocabulary`, `/language`, `/last-page`). The backend already had a `/init` endpoint that returns all of these in one `asyncio.gather()`. Wired the frontend to use it — 3 network round-trips removed.

- **DB pool pre-warm**: Changed `min_size=0` to `min_size=1` so the first request after a cold Koyeb start doesn't wait for a new connection.

- **Page render window ±3 → ±1**: Reduced the number of PDF pages kept in the DOM from 7 to 3. Less memory, faster re-renders.

**Regression and fix**

The `/init` consolidation broke last-page restore. The bug: page restore ran before `/init` fetch completed, reading `initLastPageRef.current = 1` (default). Fix: replaced the ref with `useState(null)` so the restore effect waits for the init response before running.

**CJK markdown rendering fix**

CommonMark's bold delimiter rules break when closing `**` is preceded by punctuation (e.g. `"`) and followed immediately by a CJK character. Example: `**"Akkusativ"**의` never renders as bold.

First attempt: insert a zero-width space between `**` and the CJK character. Failed — CommonMark doesn't treat ZWS as whitespace or punctuation.

Final fix: move edge punctuation outside the delimiter using Unicode property escapes (`\p{P}`, `\p{Script=Han}`, etc.):
- `**"text"**한` → `**"text**"한` (trailing punct moved out, parser now closes bold correctly)

Also removed `splitAtKorean()` — a function that was splitting lines at the first CJK character and rendering the CJK portion in `text-ink-muted` (gray). This only applied to Korean/Japanese/Chinese, not Russian/Arabic/etc., creating an inconsistent visual experience. Removed it; the existing `splitAtArrow()` (splits at `→`) already handles the "learning word / translation" dimming use case.

---

### Session 3 — 17:23 · Production Bug Fixes + Docs

> Multiple production issues discovered: OCR failing on Koyeb, JPEG 2000 PDFs causing infinite loops, PDF downloads relaying through Vercel (slow), DB connection exhaustion.

**What I fixed**

- **OCR auth on Koyeb**: `GOOGLE_APPLICATION_CREDENTIALS` doesn't work in containers without a file path. Added `GOOGLE_CREDENTIALS_JSON` env var support — writes the JSON to a temp file at startup.

- **JPEG 2000 PDFs**: Scanned PDFs with JPEG 2000 images caused an infinite `JpxError` loop in the browser. Added OpenJPEG WASM support and allowed `unpkg.com` font loading in CSP.

- **PDF download speed**: File downloads were going `browser → Vercel → backend → Supabase Storage` (3 hops). Changed to return a signed Supabase URL and have the browser download directly from storage. Load time: ~7s → ~1–2s.

- **DB connection exhaustion**: Supabase's connection pool (`pool_size=20`) is shared with its own internal services (Dashboard, Auth, Realtime). The app was consuming up to 10 connections, leaving too little for Supabase internals. Reduced `max_size` from 10 to 5.

**Architecture docs created**

- `docs/architecture/system-overview.md` — full system diagram, 3 core data flows (PDF upload, chat RAG, guest→login transfer)
- `docs/planning/code-review-checklist.md` — 3-level checklist: Architecture → Features → Code Quality (L1 Architecture complete with findings)

---

### Session 4 — 22:56 · Code Review + Dead Code Removal

> After the `/init` consolidation from Session 2, several backend endpoints and frontend fetch functions became dead code. Cleaned them up and fixed related bugs.

**Removed dead code**

Three backend endpoints were no longer called by anything:
- `GET /pdfs/{id}/language` — now covered by `/init`
- `GET /pdfs/{id}/last-page` — now covered by `/init`
- `POST /pdfs/sync` — no frontend caller found

Also removed: `PdfSyncItem`/`PdfSyncRequest` schemas, `_download_from_storage` dead helper, and frontend route handlers + `fetchPdfLanguage`/`fetchLastPage` functions.

**Bug fixes in `pdfs.py`**

- `fitz.open()` document handle leak — wrapped with `with fitz.open() as doc`
- `update_last_page` was returning the raw input value instead of the clamped value (`max(1, page)`)
- 7 error responses inconsistently structured — unified to `{"detail": "...", "code": "..."}`
- `get_pdf_init` was running `asyncio.gather()` before checking if the PDF exists — moved the 404 check before the gather

**Tests added**: 8 new tests covering last_page clamping, 404 response shape, init query optimization, and blob upload validation.

---

### What's Next

- [ ] Pass `/init` messages to `useChat` to skip the duplicate `/messages` fetch
- [ ] Evaluate adding `@tailwindcss/typography` (currently `prose` class has no actual styles)
- [ ] Bundle font/cmap files locally (currently still loaded from unpkg CDN)
- [ ] DB connection pool: evaluate Transaction pooler (port 6543) vs session pooler
- [ ] Extract shared RAG logic from `guest.py` / `chat.py` into a single service
- [ ] Migrate `ChatContext` monolith to Zustand
