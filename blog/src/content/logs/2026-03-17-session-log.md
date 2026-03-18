---
title: "2026-03-17 Session Log"
date: 2026-03-17
description: "LinguaRAG: CJK pronunciation, text annotations on PDF, native PDF selection, server-side vocabulary pagination, translation with Claude Haiku, Google One Tap login"
tags: ["lingua-rag"]
---

## lingua-rag

> Note panel UX improvements, pronunciation practice bug fixes, CJK word splitting, Chinese pinyin matching, Japanese furigana via backend morphological analysis

### What I Did

- **Segment control for note panel** — replaced ambiguous toggle button with `[All|p.N]` segment control so current filter state is always visible
- **CJK word splitting** — extracted `segmentWords` utility using `Intl.Segmenter` API for Chinese/Japanese where spaces don't exist between words
- **AudioContext fix** — React StrictMode double-mount closes AudioContext but ref isn't nulled; added `getAudioCtx()` helper that checks `state === "closed"` and recreates
- **Chinese pinyin matching** — installed `pinyin-pro` (~15KB) for tone-stripped pinyin comparison in pronunciation practice. STT may return different characters with same pronunciation (做 vs 这), so comparing pinyin is more forgiving than comparing characters
- **Character-level normalize for Chinese** — `Intl.Segmenter` splits original text and STT transcript differently (e.g., `["我的", "天"]` vs `["我", "的", "天"]`), so Chinese text is split into individual characters before matching
- **Japanese furigana API** — `POST /api/furigana` using `fugashi` (MeCab wrapper) for morphological segmentation + `pykakasi` for hiragana/romaji conversion. Chose server-side over client-side `kuroshiro` because the dictionary is ~20MB
- **Smart token merging** — auxiliary verbs (助動詞) merge with preceding verb stems for natural chip grouping. `しています` instead of `し`/`て`/`い`/`ます`
- **Unified annotation style** — replaced `<ruby>` (above-text) with inline `<span>` (right-of-word) for both Chinese and Japanese

### Key Decisions

- **fugashi over pykakasi alone** — pykakasi groups all consecutive hiragana into one segment (e.g., `があってとても`), fugashi provides proper morphological boundaries
- **Backend processing over client-side** — 20MB dictionary too heavy for browser; server handles it with no client cost

### Learnings

- Google STT cannot recognize single-syllable particles (啊, 呢, 吧) in isolation — requires at least 2 syllables. This is an engine-level constraint
- `pykakasi` romanization has edge cases: `なった` → `natsuta` instead of `natta`. Contracted forms don't always match standard Hepburn

---

## Text Annotations on PDF

> Built a custom text annotation system — place, edit, drag, resize text boxes on PDF pages with full DB persistence and extensive rendering optimization

### What I Did

- **Text annotation feature** — click-to-place text boxes on PDF pages using `contentEditable` divs with absolute positioning (x/y as percentages)
- **Toolbar** — floating bar matching existing bottom toolbar style with font family, size, color, bold, italic, text-align, opacity controls
- **Style persistence** — added `style JSONB` column to `pdf_annotations` table. All text styling stored as a single JSON object
- **Optimistic UI** — text box renders immediately with a temporary ID (`temp-${Date.now()}`), API persists in background, temp→real ID swap on response. If API fails, annotation is removed
- **UX flow** — T button activates text mode → click places box → type → click outside saves → double-click re-enters edit mode → drag handle moves, right-edge resizes

### Performance Deep Dive

This was the most educational part. Adding text annotations exposed rendering bottlenecks in the existing highlight overlay system:

**Problem 1: State coupling**
`textAnnotations` was initially stored in the same `annotations` state. Changing it triggered the highlight overlay effect that DOM-walks all page text layers — even though text annotations have nothing to do with text highlights.
→ **Fix**: Separated into `textAnnotations` state, then further extracted into React Context (`TextAnnotationProvider`) so changes don't re-render PdfViewer at all.

**Problem 2: Full DOM re-walk**
The highlight overlay effect used `document.querySelectorAll("mark.note-highlight")` to clean up ALL marks across ALL pages, then re-applied everything.
→ **Fix**: Track previous state per page via `buildPageKey()`. Only cleanup + reapply on pages whose key actually changed. Pages scrolled out of view get their marks cleaned up lazily.

**Problem 3: `React.memo` invalidation**
`handleTextAnnDelete` had `selectedTextAnnId` in its dependency array — every selection change created a new function reference, invalidating `React.memo` for all 15 TextAnnotation components.
→ **Fix**: Used `setSelectedTextAnnId(prev => prev === id ? null : prev)` (updater function) to remove the dependency.

**Problem 4: Style comparison by reference**
`React.memo` compared `annotation.style` by reference (`===`). But spread operations in state updates always create new objects even when values are identical.
→ **Fix**: Custom `styleEqual` function that compares each field individually.

### Key Decisions

- **Custom implementation over npm packages** — researched react-pdf-highlighter (highlight-only), @pdfme (PDF generation, not annotation), recogito-react-pdf (unmaintained 2 years), Syncfusion (commercial). No free OSS package supports free-text boxes on react-pdf
- **Context separation** — `TextAnnotationProvider` wraps PdfViewer. Text annotation state lives in context, not in PdfViewer's local state. This is the single biggest performance win

---

## Translation & Upload Pipeline

> Claude Haiku translation, /init API consolidation, Google One Tap login, PDF upload modal, embedding retry improvements

### What I Did

- **Claude Haiku translation** — backend `/api/translate` endpoint uses Claude Haiku for logged-in users (~$0.00016/request), MyMemory free API for guests
- **Word vs sentence detection** — words get 3 dictionary-style meanings, sentences get single translation. CJK uses character count (≤4 chars = word) since `text.split()` doesn't work without spaces
- **2-layer translation cache** — L1 in-memory (both frontend and backend) + L2 persistent DB cache for words only. Sentences are too context-specific to cache
- **Quality gate** — validates LLM output before caching: filters error strings, strips parentheses, extracts numbered lines. Bad outputs still returned to user but not persisted
- **`GET /pdfs/{id}/init`** — single request replaces 4 individual fetches with `asyncio.gather`. Reduced initial load from 4 sequential round-trips to 1 parallel request
- **Google One Tap login** — GSI script with `signInWithIdToken` + SHA-256 nonce. Supabase GoTrue expects hex-encoded hash (not base64url)
- **PDF upload modal** — drag-and-drop + file picker, replacing direct OS file dialog
- **Embedding retry** — failed batches retried 3 rounds with cooldown. `executemany` batch INSERT for chunks (~52s → seconds)

### Key Decisions

- **Prompt version in cache key** — cleaner than TTL expiration. Improving the prompt automatically invalidates all stale cached translations
- **Guest = MyMemory, logged-in = Claude** — avoids API cost for unauthenticated users
- **Words cached in DB, sentences not** — words have high cross-user reuse value, sentences are too context-specific

---

## Native PDF Selection & TTS Cleanup

> Replaced ~400 lines of custom selection code with native browser selection

### What I Did

- **Removed custom selection system** — deleted `computeRangeRects`, `ensureTextContent`, `textContentCache`, `getCaretRange`, custom overlay divs. pdf.js text layer already handles selection natively; the custom `caretRangeFromPoint` logic was causing DOM-order vs visual-order mismatch bugs
- **`sel.toString()` over `extractTextFromRange`** — the TreeWalker-based extraction followed DOM order (not visual order), capturing wrong text on multi-line drag selections
- **Popup repositioning fix** — added `popupElRef` guard in `handleMouseUp` to skip selection logic when clicking popup buttons (previously repositioned the popup on every click)
- **Removed TTS word-by-word highlight** — deleted `spokenWordIndex`, `ttsTimersRef`, `charWeights` timing logic. The timing-based estimation was inaccurate; clean word chips UI is sufficient

### Learnings

- pdf.js text layer renders spans in DOM order which may differ from visual (reading) order on complex layouts. Native browser selection handles this correctly; custom code cannot without reimplementing the rendering engine's layout logic

---

## Server-Side Vocabulary Pagination

> Rewrote vocabulary page with server-side pagination, persistent filters, and multiple code quality fixes

### What I Did

- **Server-side pagination** — backend `list_all_for_user` rewritten with offset/limit/search/language/sort_by params. Frontend sends `searchParams` to backend instead of fetching all and filtering client-side
- **Per-language localStorage persistence** — page size, page number, language filter, and sort order are all saved per-language in localStorage. Restored on browser reload, reset to defaults on SPA re-entry
- **Reload vs re-entry detection** — module-level `hasBeenMounted` flag + `isPageReload()` (Performance Navigation API) distinguishes browser refresh from SPA navigation
- **Fetch race condition fix** — version counter (`fetchIdRef`) ignores stale responses when language switch triggers two rapid fetches
- **Auto-save on page viewer close** — replaced `window.confirm` with `pageViewerSaveRef` callback pattern
- **Code quality fixes** — Pydantic `Field(ge=0, le=3)` validation, authorization on check update, `toLocaleLowerCase()` for i18n-safe comparison, silent errors → toast notifications

### Key Decisions

- **Module-level `hasBeenMounted` over Performance API alone** — `performance.getEntriesByType("navigation")` persists for the entire page lifecycle; after one reload, all subsequent SPA navigations still show `type="reload"`
- **Version counter over AbortController** — simpler pattern for ignoring stale fetch responses; `fetchIdRef.current++` invalidates in-flight requests without aborting them
