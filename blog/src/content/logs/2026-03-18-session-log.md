---
title: "2026-03-18 Session Log"
date: 2026-03-18
description: "LinguaRAG: text annotation UX, prompt v3.0, page reference buttons, auto-greeting, Haiku Vision OCR, local storage, Supabase egress fix, sidebar sort, guest mode fixes"
tags: ["lingua-rag"]
---

## lingua-rag

> 10+ bug fixes for the PDF text annotation system — width handling, contentEditable interactions, toolbar behavior, and zoom scaling

### What I Did

- **Fixed width mode** — removed the auto-width probe measurement that caused inconsistent Korean text wrapping. Both view and edit mode now use the same `style.width`, and users resize via a drag handle
- **Create-on-save** — eliminated unnecessary API calls: clicking the PDF no longer creates an annotation immediately. A temp annotation lives in state until the user types content and saves. Empty annotations = 0 API calls
- **Style corruption guard** — one annotation had 78MB of corrupted JSONB style data that crashed the app with `RangeError: Too many properties`. Added type-validated parsing in `useMemo` to prevent this
- **Resize handle fixes** — matched CSS `min-w-[3em]` with JS `fontSize * scale * 3` to prevent visual/calculation mismatch; used `boxRef.offsetWidth` instead of `style.width` to prevent jump on first drag
- **Toolbar interactions** — `preventDefault` on `mouseDown` for non-INPUT elements prevents contentEditable from losing focus, while still allowing range inputs (like opacity sliders) to work
- **Font size scales with zoom** — `fontSize * scale` passed through `TextAnnotationLayer` → `TextAnnotation` so annotations look correct at any zoom level
- **Line break preservation** — switched from `textContent` to `innerText` because `textContent` doesn't preserve `<br>` tags, causing line breaks to disappear on save

### Key Decisions

- **Fixed width + drag handle over auto-width** — probe measurement behaved differently across languages (Korean wraps at character level, English at word level). Fixed width is predictable regardless of content
- **Create-on-save over create-on-click** — the previous approach created a DB record on every click and deleted it if the user didn't type anything, generating unnecessary API traffic

---

## Supabase Crisis & Local Development Setup

> Supabase free plan resources exhausted — migrated to local PostgreSQL and local file storage for development

### The Problem

Supabase Nano instance (0.5GB RAM) hit both Disk IO budget exhaustion and Egress limit (5.2GB/5GB). The IO budget was consumed by app queries combined with Supabase's own internal services (mgmt-api, postgres_exporter). Egress breakdown: Shared Pooler (DB) 564MB/day + Storage (PDF downloads) 218MB/day.

### What I Did

- **Local PostgreSQL** — created `linguarag` database with pgvector extension, ran all 13 migrations, set up `pdf_files` + `pdf_annotations` tables
- **DB connection pool tuning** — reduced `max_size` from 10 to 3, timeout from 30s to 10s, idle lifetime from 300s to 60s (appropriate for single-developer usage)
- **Direct connection** — used port 5432 instead of Supabase's Transaction Pooler (6543) because asyncpg's `RESET ALL` on connection release is incompatible with PgBouncer transaction mode
- **Local file storage** — `STORAGE_MODE=local` env var switches PDF storage from Supabase to `./storage/pdfs/` on disk (covered in detail in the Local Storage Mode section below)
- **Vercel paused** — stopped the production deployment via Vercel REST API to prevent any external access from generating egress

### Result

Development now runs with **zero Supabase requests** — local PostgreSQL for DB, local filesystem for PDF storage, guest mode for auth.

---

## Prompt v3.0 & Chat UX

> Complete prompt rewrite with 5 question types, page context toggle, quick action buttons, and search-type detection

### What I Did

- **Prompt v3.0** — rewrote the entire system prompt to handle 5 question types: explanation, summary, search, quiz, and general. Claude now cites page numbers naturally from RAG chunks tagged with `[Page N]`
- **Page context toggle** — replaced regex-based `PAGE_TRIGGER` with an explicit toggle in InputBar (`📌 p.N` / `📚 전체`). Users now explicitly choose whether to ask about the current page or the full PDF
- **Quick action buttons** — 4 always-visible buttons (페이지 요약 / 주요 표현 / 쉽게 풀이 / 연습 문제) + conversation summary button above the input bar
- **Search-type bypass** — queries like "어디에 있나요?" or "몇 페이지" trigger full-PDF RAG even when page mode is on, because location questions need the whole document

### Key Decisions

- **Page context in system prompt, not user message** — Claude treats it as reference material rather than user input, producing better responses
- **Explicit toggle over regex** — eliminates confusion when users got answers from other chapters while reading a specific page

---

## Page Reference Buttons

> Clickable page navigation from chat responses — click `p.12` in Claude's answer to jump to that page in the PDF viewer

### What I Did

- **Pattern detection in markdown** — regex matches `p.12`, `Page 12`, `Seite 12`, `페이지 12` patterns and replaces them with clickable blue buttons
- **Recursive parsing** — `withPageRefs()` traverses into `<strong>`, `<em>`, and other inline elements so `**p.35**` also gets converted (initial version missed these because ReactMarkdown wraps them in elements)
- **RAG source badges** — the collapsible "Referenced N sections" area now has clickable page badges that also navigate the PDF
- **Wiring** — `onPageClick` callback chain: `MessageList` → `ChatPanel` → `ChatPage` → `PdfViewer.scrollToPage()` (newly exposed in `PdfViewerHandle`)

---

## Auto-Greeting on PDF Upload

> When a PDF finishes indexing, the AI automatically introduces the textbook — no user action needed

### What I Did

- **Greeting trigger** — `useChat` effect fires when `indexStatus` becomes `ready`, `partial`, or `ocr_indexing` and chat history is empty
- **AI-first UX** — the greeting user message is hidden (`isGreeting: true`); only the assistant response appears, making it look like the AI speaks first (similar to ChatPDF)
- **First 5 chunks by page order** — instead of vector search (which often returned 0 results because a generic "introduce this textbook" query has low cosine similarity to specific content), the backend fetches the first 5 chunks sorted by page number. This guarantees the greeting always has content
- **`greeting` flag in API** — both `chat.py` and `guest.py` support `greeting: true` in the request body, which switches from vector search to page-order fetch

### Learnings

- Vector search with a generic prompt like "Introduce this PDF textbook" against specific textbook content can return 0 results because `max_distance = 0.7` filters everything out. Page-order fetch is the right approach for greeting where you need a representative sample, not a semantic match

---

## Haiku Vision OCR — Two-Phase Pipeline

> Scanned PDFs (image-only) now get OCR'd using Claude Haiku Vision instead of Tesseract, with a progressive two-phase approach

### The Problem

Tesseract OCR requires per-language packs and produces garbage when the wrong language is used. A Chinese textbook OCR'd with `eng` language pack produced output like `AAAI - AQ BzorS wo}` — completely unusable. Multi-language mode (`eng+kor+chi_sim`) was too slow (70+ seconds for 77 pages) and caused Tesseract to hang.

### What I Built

**Phase 1 (fast greeting):**

1. PyMuPDF extracts text — pages with < 50 characters are flagged for OCR
2. Flagged pages are rendered as PNG at 150 DPI
3. First 10 pages → single Haiku Vision API call → text extraction
4. Chunk + embed + store → status `ocr_indexing` → greeting fires (~15 seconds)

**Phase 2 (background completion):**

1. Remaining pages → parallel Haiku Vision calls (max 3 concurrent via `asyncio.Semaphore`)
2. Chunk + embed + append to existing chunks → status `ready`
3. Full RAG search now available (~60 seconds total)

### Rate Limit Battle

- **16 concurrent calls** → immediate 429 + 529 cascade, 0 pages extracted
- **3 concurrent (Semaphore)** → still hit 529 on overloaded Haiku
- **Added app-level retry** — 3 attempts with exponential backoff (429: 5/10/15s, 5xx: 2/4/8s) on top of Anthropic SDK's built-in 2 retries

### New `ocr_indexing` Status

Needed a new status because `partial` already meant "some embeddings permanently failed" (a final state). `ocr_indexing` means "Phase 1 done, Phase 2 in progress" — the UI shows amber "분석 중..." and polling continues until `ready`.

### Cost Analysis

| Approach           | 77 pages | Speed | CJK Support         |
| ------------------ | -------- | ----- | ------------------- |
| Tesseract (eng)    | Free     | ~17s  | No                  |
| Tesseract (multi)  | Free     | ~70s+ | Unreliable          |
| Haiku Vision       | ~$0.13   | ~60s  | Yes (all languages) |
| Google Document AI | ~$0.08   | ~3s   | Yes                 |

Haiku Vision is the pragmatic choice for now — same API as chat, no new service integration. Google Document AI is the future upgrade path when scale justifies it.

---

## Performance Optimizations

> Text annotation rendering, highlight overlay, and React memo improvements

### What I Did

- **TextAnnotationProvider extraction** — moved `textAnnotations` state from PdfViewer (3000+ lines) into a React Context so annotation changes don't trigger full PdfViewer re-renders
- **Per-page change tracking** — `buildPageKey()` creates a stable hash per page; highlight overlay only re-processes pages whose key changed
- **Visible-page scoping** — highlight processing limited to ±3 pages of current view
- **TextOffsetMap with binary search** — replaced repeated TreeWalker traversals (O(N×M)) with a pre-built offset map using binary search (O(M + N×logM))
- **React.memo everywhere** — SidebarPdfItem, SidebarTree, ChatPanel with custom comparisons; ChatContext value wrapped in useMemo (dev re-renders: x32 → x3)

---

## Local Storage Mode

> Eliminate Supabase egress during development

### The Problem

Supabase free plan egress hit 5.2GB/5GB. Breakdown: Shared Pooler (DB queries) 564MB/day + Storage (PDF downloads) 218MB/day. Already switched to local PostgreSQL for DB, but Storage was still hitting Supabase.

### What I Did

- **`STORAGE_MODE` env var** — `"local"` saves PDFs to `./storage/pdfs/` on disk; `"supabase"` uses Supabase Storage (for production)
- **Same API surface** — `storage_upload()`, `storage_download()`, `storage_delete()`, `storage_signed_url()` work identically in both modes
- **Vercel paused** — used Vercel REST API (`POST /v1/projects/{id}/pause`) to stop the production deployment entirely

### Result

Development now makes **zero Supabase requests** — DB is local PostgreSQL, Storage is local filesystem, Auth is guest mode only.

---

## Sidebar Sort by Last Chat

> PDFs in the sidebar now sort by most recently chatted, not just when they were added

### What I Did

- **Server-side query** — `conversations.updated_at` joined via `LEFT JOIN LATERAL` in the `list_by_user` query; `last_chat_at` returned in `GET /api/pdfs` response
- **Immediate client-side re-sort** — `notifyChatSent()` updates `lastChatAt` in localStorage and re-sorts the library state instantly, so the PDF you just chatted with jumps to the top
- **Server sync** — polling/sync persists `lastChatAt` using `Math.max(local, server)` to prevent order jumping on refresh
- **Guest mode** — separate `updateSessionLastChatAt()` for sessionStorage to avoid cross-contamination between guest and logged-in data

---

## Guest Mode Fixes

> Several bugs in guest mode that caused UI glitches and data contamination

### What I Did

- **Sidebar showing all PDFs** — `notifyChatSent()` was reading from `localStorage` (logged-in data) in guest mode, replacing the session-only PDF list with all of the user's PDFs. Fixed with an `isGuest` guard
- **Greeting prompt visible in history** — guest message load path was missing the `GREETING_REQUEST_RE` check, causing the raw greeting prompt text to show as a user message bubble
- **Language-aware greeting** — `appLanguage` prop threaded through `ChatPage` → `ChatPanel` → `useChat`. The greeting prompt includes `Respond in ${langName}` based on the app's language setting, since there's no user message to auto-detect language from

---

## Google One Tap & Upload Modal

> New login flow and PDF upload experience

### What I Did

- **Google One Tap login** — integrated Google Sign-In for Websites (GSI) with Supabase Auth using `signInWithIdToken`. The nonce is SHA-256 hex-encoded because GoTrue expects the hash, not the raw value. A module-level flag prevents double initialization in React StrictMode
- **PDF upload modal** — replaced the OS file dialog with a custom `PdfUploadModal` featuring a drag-and-drop zone and file picker button

### Learnings

- Google One Tap throws `AbortError: signal is aborted without reason` in dev console when the user dismisses the prompt — this is internal to Google GSI, harmless, and only shows in development
- The OAuth client needs both `http://localhost:3000` and the production domain registered in Google Cloud Console under Authorized JavaScript origins

---

## PageViewer & Tiptap Fixes

> The page viewer (note/summary viewer) had several interaction bugs with tiptap v3

### What I Did

- **Toolbar buttons not working** — tiptap v3's `useEditor` hook returns stale instances across renders. Fixed by using `editorRef.current` for all `onAction` callbacks instead of the hook's return value
- **Header UX** — title uses `text-2xl font-bold`, dates arranged vertically, consistent height between view/edit modes using invisible `border-b-2 border-transparent`
- **IME composition fix** — Korean IME with cmd+enter was submitting before composition finished. Added `e.nativeEvent.isComposing` check + `setTimeout(0)` delay
- **Tiptap heading styles** — added h1/h2/h3/p CSS styles to `.tiptap-content` in globals.css

---

## Other Changes

- **RAG search limit 3→5** — more chunks for better coverage
- **Translation prompt v2** — language code→name mapping (`ko`→`Korean`), `CRITICAL: ALL output must be in {tgt_name}` enforcement, misspelled word best-guess instead of error message
- **Pronunciation chip fix** — `✓`/`○` icon wrapped in `w-4` fixed-width span to prevent line reflow on state change
- **Quiz prototype** — built flashcard/multiple-choice/typing modes with swipe and card stack animations, then reverted (needs ChatPDF-style dashboard + SRS integration before reimplementation)
- **Language button moved** — language selector moved from user menu dropdown to the header bar, visible for both guest and logged-in users
- **Highlight rendering fixes** — zoom reapply, text layer guard, race condition with stale flag, single fetch cycle with `Promise.all`

---

## What's Next

- Google Document AI evaluation for faster/cheaper OCR
- Conversations.updated_at sidebar sort refinement
- Flashcard redesign with SRS integration
- Prompt v3.0 end-to-end testing
- Vercel unpause + production deployment
