---
title: "2026-03-19 Session Log"
date: 2026-03-19
description: "LinguaRAG: full-stack refactoring (API proxy, backend split, repository pattern), guest auth optimization, OCR A/B tests (RapidOCR + BGE-M3 rejected), Google Document AI integration, frontend review"
tags: ["lingua-rag"]
---

## lingua-rag

> Eliminated redundant Supabase calls for guests, consolidated 20 API routes into a shared proxy pattern, split a monolithic backend module, and unified the repository instantiation pattern

### API Proxy Migration

The frontend had 20 API route files that all repeated the same pattern: get Supabase session, build headers, fetch from backend, handle errors. I extracted this into two shared utilities in `api-proxy.ts`:

- **`getSession()`** — reads the Supabase cookie server-side and returns the access token (or null for guests/super-mode)
- **`proxyToBackend()`** — forwards the request to the FastAPI backend with auth headers, content-type passthrough, and error handling

This removed ~600 lines of duplicated boilerplate. Each API route is now 5-10 lines instead of 30-40.

### Guest Auth Skip

Supabase's official Next.js guide calls `getUser()` on every request in middleware. But for guests (no auth cookie), this makes two unnecessary network calls per page load. I added a cookie existence check — if no `sb-*-auth-token` cookie exists, skip the Supabase call entirely.

The tricky part: Supabase splits large auth cookies into chunks (`.0`, `.1`, etc.), so the check uses `startsWith("sb-") && includes("-auth-token")` to catch all variants. The `onAuthStateChange` listener still stays registered for detecting Google One Tap logins.

### Backend Module Split

`pdfs.py` was handling three unrelated concerns: file management, text annotations, and vocabulary entries. Split it into three routers:

| Module               | LOC | Responsibility                                   |
| -------------------- | --- | ------------------------------------------------ |
| `pdfs.py`            | 370 | PDF upload, download, delete, metadata, indexing |
| `pdf_annotations.py` | 95  | Text highlights and notes on PDF pages           |
| `pdf_vocabulary.py`  | 150 | Vocabulary entries saved from PDF selections     |

All three keep the same `/api/pdfs/` URL prefix, so zero frontend changes were needed.

### Repository Pattern Unification

Some backend modules created repository instances at module level (singletons), while others created them per-request. Unified everything to per-request instantiation — repositories are stateless (they use the connection pool for each query), so there's no performance cost, but you gain consistency, testability, and no shared-state risk across concurrent requests.

### Other Refactoring

- **SSE helpers** — extracted `sse()` and `sse_done()` from duplicated definitions in `chat.py` and `guest.py` into `core/sse.py`
- **SessionLockManager** — extracted duplicated `OrderedDict` + mutex logic into `core/locking.py` with configurable LRU eviction
- **Frontend storage utils** — `getStorageItem`, `setStorageItem` with try-catch wrappers, replacing raw `localStorage` calls across 6 files
- **Frontend format utils** — consolidated `formatFileSize`, `formatRelativeTime`, `formatDateLabel` from three different components

---

## OCR & Embedding A/B Tests

> Tested two open-source alternatives to replace paid services — both rejected for failing on the core use case: cross-language search

### RapidOCR vs Haiku Vision (OCR)

**Hypothesis**: RapidOCR with Korean PaddleOCR v5 model could replace Haiku Vision ($0.13/77 pages) for free.

**Result**: Text extraction ratio reached 61% (up from 22% with default model), but Chinese characters like 句 were consistently dropped in mixed CJK documents. Since the app serves Korean users studying foreign language textbooks (Chinese, Japanese, German), dropping non-Korean CJK characters is a deal-breaker. **Rejected.**

### BGE-M3 vs OpenAI text-embedding-3-small (Embeddings)

**Hypothesis**: BGE-M3 (MIT license, free, 1024-dim) could match OpenAI embeddings for multilingual semantic search.

**Result**: Same-language overlap was strong (English: 68%), but cross-language overlap collapsed — German: 32%, Chinese: 24%, overall: 41% (threshold was 60%). The app's primary search pattern is exactly cross-language: a Korean user asking questions about German/Chinese text. **Rejected.**

### Decision

Both alternatives were kept in the codebase behind environment variable switches (`OCR_MODE`, `EMBEDDING_MODE`) for future re-evaluation when better models emerge. The paid stack (Haiku Vision + OpenAI embeddings) stays as default.

---

## Google Document AI Integration

> Implemented as a third OCR option — faster and cheaper than Haiku Vision, but couldn't A/B test due to GCP billing issues

Google Document AI processes an entire PDF in a single API call (no page-by-page rendering needed), extracts text via layout text anchors, and supports 200+ languages. Cost is ~$0.0015/page ($0.12 for 77 pages vs $0.13 for Haiku Vision) and processes 77 pages in ~3 seconds vs ~60 seconds.

The integration is complete (`OCR_MODE=google_docai`), but the actual A/B test is blocked: the GCP billing account was closed, and creating a new one keeps failing on the payment step. Deferred until billing is resolved.

---

## Indexing Bug Fixes

> Six bugs found during code review of the indexing pipeline

| Bug              | Fix                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dead code        | Removed unused `_extract_pages` function and `all_text_pages` variable                                                               |
| Status flash     | Text PDFs briefly showed `ocr_indexing` before `ready` — added condition to check if OCR pages actually exist beyond the first batch |
| OCR parsing      | Regex replaced brittle `startswith("=== Page ")` with flexible pattern matching (`===Page 1===`, `--- Page 1 ---`, case-insensitive) |
| Text truncation  | `max_tokens` 4096 was too small for dense OCR pages — increased to 8192                                                              |
| Duplicate chunks | Phase 2 `chunk_index` started at 0 instead of using Phase 1's count as offset                                                        |
| Empty pages      | `_chunk_page` now returns `[]` for whitespace-only text instead of creating empty chunks                                             |

---

## Frontend Review (Rex Analysis)

> Comprehensive frontend audit covering architecture, code quality, and performance

### Strengths

- **Auth pattern is excellent** — Supabase SSR middleware with cookie-first guest bypass, proper `getUser()` (not `getSession()`) for JWT validation
- **TypeScript strict mode** — only 3 `any` usages, all with eslint-disable comments and clear justification
- **Clean useEffect patterns** — every event listener has cleanup, dependency arrays are accurate
- **Zero console.log** in production code

### Key Issues Found

| Issue                           | Severity | Detail                                                                                                   |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| PdfViewer monolith              | Critical | 2,832 lines — text selection, annotations, highlights, pinyin, keyboard shortcuts all in one file        |
| ChatContext God Object          | Critical | 7+ hooks composed into one Context — tree clicks cause cascading re-renders in unrelated chat components |
| Heavy components not code-split | High     | PdfViewer, NoteSlidePanel (1,315 LOC), Tiptap editor always in the bundle even when not visible          |
| No route-level error boundaries | Medium   | Only root `error.tsx` exists — a chat error takes down the entire app                                    |
| No form validation framework    | Medium   | Manual validation only, no Zod schemas at API boundaries                                                 |
| Minimal SEO                     | Low      | Static metadata only, no OG images or per-route `generateMetadata`                                       |

### Recommended Priority

1. Dynamic import PdfViewer (low effort, immediate bundle improvement)
2. Split ChatContext into Auth/Pdf/UI contexts (medium effort, performance gain)
3. Add route-level `error.tsx` for chat pages (low effort, UX resilience)
4. Lazy-load NoteSlidePanel and PronunciationModal (low effort, bundle optimization)
5. PdfViewer hooks decomposition (high effort, maintainability)

---

## What's Next

- Google Document AI A/B test — resolve GCP billing, compare vs Haiku Vision
- PdfViewer decomposition (2,832 LOC → Core + hooks)
- NoteSlidePanel tab split, sidebar actions extraction
- Prompt v3.0 end-to-end testing
- Vercel unpause + production deployment
