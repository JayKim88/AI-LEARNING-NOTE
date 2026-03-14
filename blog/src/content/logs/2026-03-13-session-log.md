---
title: "2026-03-13 Session Log"
date: 2026-03-13
description: "lingua-rag: PDF viewer UI overhaul, drag-and-drop reordering, vocabulary system, DOM-based highlight overlay, cross-chunk text highlighting"
tags: ["lingua-rag"]
---

## lingua-rag

> A full day of PDF viewer improvements — from UI redesign and drag-and-drop to building a vocabulary system and solving a fundamental limitation in how react-pdf handles text highlighting.

Five sessions today, each building on the last. Here's the story.

---

### Session 1: The Great Header Cleanup

**The Problem: Too Many Headers, Wrong Tools**

The PDF viewer had its own header bar (file name, language selector, search, close button) that duplicated the root app header. The bottom floating toolbar had Pan and Select tool buttons — borrowed from SmallPDF's design but useless for a language-learning reader.

**What Changed**

- Removed the entire PDF header component — no more duplicate UI
- Gutted Pan/Select tool mode: deleted `toolMode`, `isPanning`, `panStart`, keyboard shortcuts (H/V), and all pan event handlers
- Replaced Pan/Select buttons with **language selector** and **in-page search** in the bottom toolbar

**Spotlight-Style Search**

Built a macOS Spotlight-inspired search overlay:
- Opens via `Cmd+F` or toolbar button, closes on `Escape` or focus-out
- Fully draggable across the viewport using `fixed` positioning (not `absolute`, which would confine it to the scroll container)
- Position and search query persist across open/close cycles via `localStorage`

Hit a subtle focus bug: the X (clear) button conditionally renders only when there's text. Clicking it unmounts the button before `focus()` on the input fires, so focus falls to `document.body` and the modal's `onBlur` never triggers. Fix: `requestAnimationFrame(() => input.focus())` — defers until after React's paint.

**Sidebar Split & Instant Language Selection**
- Added draggable Chats/Folders divider with `localStorage` persistence
- Fixed SSR hydration mismatch: `useState(() => localStorage.getItem(...))` fails on server. Initialize at 50%, restore in `useEffect`
- New uploads now show the language modal immediately, with deferred server save when `pdfServerId` arrives

---

### Session 2: Chat Panel Cleanup + Drag Selection Fix

**Summary Viewer Removal**

Removed the "요약 보기" (View Summary) feature from ChatPanel — the overlay, toolbar button, and all related state (`summaries`, `selectedSummary`, `showSummaries`, plus unused imports like `ReactMarkdown`, `remarkGfm`). The component was doing too much.

**TTS Button for Vocabulary**

Added a small speaker icon next to each word in the vocab table. The `speak` function is passed down from PdfViewer through NoteSlidePanel.

**The Tricky One: Drag Selection Over Note Highlights**

This was a real bug. `customTextRenderer` injects `<mark>` tags into the text layer, which splits a single `<span>`'s text into multiple DOM text nodes. The drag selection code (`computeRangeRects`) used `range.startOffset`/`endOffset` directly — but these offsets are relative to the individual text node, not the full span.

Example: `<span>hello <mark>world</mark> today</span>` has three text nodes. Selecting "today" gives `startOffset = 0` for the third text node, but the code was treating it as offset 0 of the full span text "hello world today".

Fix: Added `resolveOffset()` using `TreeWalker` to compute the absolute offset within the span. Had to remove an initial shortcut ("if container's parent is the span, offset is correct") because it fails when the text node is a direct child but NOT the first child (e.g., text after a `<mark>` tag).

---

### Session 3: UX Polish Sprint

**Search Highlight Sync**

Search highlights were showing even when the Spotlight modal was closed. The `customTextRenderer` was gated by `searchQuery.trim()` but not by `showSearch`. Added the `showSearch` check so highlights disappear when the modal closes.

**Pronunciation Success Sound**

Added a "ding-dong" chime using Web Audio API when the user passes a pronunciation test. Two sine oscillators (784 Hz + 523.25 Hz) for a warm two-tone sound. Went through 3 iterations: sine/880 (harsh) → triangle/1318 (too sharp) → sine/784 (warm).

Also fixed a visual timing issue: the last word chip needs to turn green before the success UI appears. Wrapped the success phase transition in `setTimeout(500)`.

**The LIBRARY_MAX Bug**

PDFs weren't appearing in the sidebar after upload. Root cause: `LIBRARY_MAX = 10` was silently truncating `upsertLibraryMeta()` with `.slice(0, 10)`. New PDFs at index 11+ were immediately sliced off — no error, just invisible. Removed `LIBRARY_MAX` entirely; server-side subscription tiers will handle limits.

**Drag-and-Drop Reordering**

Big feature. Added `sortOrder` field to `PdfMeta` and replaced all 17+ instances of `.sort((a,b) => a.addedAt - b.addedAt)` with `sortByOrder()`. Three levels of drag-and-drop:
1. **Sidebar PDF list** — blue drop indicator lines between items
2. **Folder PDFs** — same UX within folder view
3. **Tree nodes (folders & pages)** — 3-zone hit detection on folders: top 25% = before, middle 50% = drop into folder, bottom 25% = after

---

### Session 4: Vocabulary System

**Backend + API**

- Ran `006_vocabulary.sql` migration (vocabulary table + indexes)
- Created Next.js API proxy routes for CRUD (`vocabulary/route.ts`, `vocabulary/[vocabId]/route.ts`)
- Wired all vocab props to NoteSlidePanel: save, update, delete, language, initial word, force tab

**Vocab UX**

- Unified `showAll` toggle between memo and vocab tabs (one toggle, `localStorage` persistence)
- Flat vocab table in "show all" mode with `p.` column instead of per-page grouping
- Row click navigates to page and flashes the word in the PDF (red animation, first occurrence only)
- Duplicate word detection with amber warning banner ("save anyway" / "go to existing")

**Color System Swap**

Swapped the color roles: drag selection changed from yellow to blue, note highlights from blue to yellow. All CSS hover/flash animations updated to match.

**Panel UX**

- `forceMemoTab`/`forceVocabTab` controls — popup actions force the correct tab
- Panel stays open after saving from popup (removed auto-close)
- Unified memo input: merged `isCreating` and regular input into one shared textarea block

---

### Session 5: The Highlight Architecture Problem

This was the most technically interesting session. Two related bugs led to a fundamental architecture change.

**Bug 1: Long sentence highlights don't appear**

When a user highlights "as you have experiences and perspectives that are unique to you" and adds a note, the yellow highlight doesn't show. Short phrases like "as you have experiences" work fine.

**Root cause:** react-pdf splits text into `textItem` chunks per `<span>`. The `customTextRenderer` function operates per-chunk using `textItem.str.includes(highlightedText)` — which fails when the highlighted text spans multiple chunks. "unique to" might be split across `"unique t"` and `"oyou"`.

**Bug 2: Vocab flash shows yellow instead of red**

Clicking a vocabulary word was supposed to flash red, but it flashed yellow. The vocab flash was implemented inside `customTextRenderer`. When triggered, react-pdf re-rendered the entire text layer, which destroyed the DOM-based note highlights. The highlight `useEffect` then re-applied yellow note highlights on top of the vocab text.

**The Solution: DOM Overlay Architecture**

Replaced the `customTextRenderer` approach for both notes and vocab with a post-render DOM overlay:

1. After react-pdf renders each page, a `useEffect` fires (gated by `renderGen` state that increments on `onRenderSuccess`)
2. Uses `TreeWalker` to walk all text nodes in the text layer, building a character offset map
3. Creates `Range` objects spanning the exact start/end positions of highlighted text — even across multiple `<span>` elements
4. Wraps matched ranges with `<mark>` elements using `surroundContents` (single node) or segment-by-segment wrapping (cross-node)

This approach handles text that spans any number of chunks/spans because it operates on the full text content, not per-chunk.

**Multi-line Grouped Hover**

For highlights spanning multiple lines, each line gets its own `<mark>` element. Hovering one line should highlight all of them. Added `data-note-group` attribute on all marks in the same highlight, with event delegation on `mouseover`/`mouseleave` to toggle `.note-highlight-hover` class on all group members.

Debugging this took several rounds:
- `mouseenter`/`mouseleave` with `capture: true` → didn't work (capture fires on container, not marks)
- `mouseover`/`mouseleave` → event listener wasn't registering because `useEffect` with `[]` deps ran before `containerRef` was mounted
- Changed deps to `[file]` → hover class applied but not visible because inline `style="background:..."` overrides CSS `!important`
- Removed inline background, moved all styles to CSS classes → finally worked

**Other Fixes**

- Guest mode language modal reappearing on reload: guard changed from `!pdfServerIdProp` to `!pdfServerIdProp && !language`
- SSR error `localStorage is not defined` in `useResizePanel.ts`: added `typeof window !== "undefined"` guard
- Vocab table horizontal overflow on long words: `table-fixed` + `break-all`

### Key Decisions

- **DOM overlay over `customTextRenderer` for highlights** — the only way to handle cross-chunk text. `customTextRenderer` is now search-only
- **`customTextRenderer` and DOM overlay are fundamentally incompatible** — activating `customTextRenderer` re-renders the text layer, destroying DOM-injected marks. They must serve different purposes (search vs. highlights) and never conflict
- **CSS-only styles for `<mark>` elements** — no inline `style` attributes, preserving the CSS specificity chain for hover/flash states
- **Removed `LIBRARY_MAX`** — subscription-tier limits enforced server-side, not client-side
- **`sortOrder` field for drag-and-drop** — decoupled from `addedAt`, uses integer re-indexing on drop
- **3-zone folder detection** — 25% top/bottom for reorder, 50% middle for drop-into, coexisting with move-into-folder

### What's Next

- [ ] Verify vocab flash (red) works end-to-end after DOM refactor
- [ ] Verify multi-line highlight grouped hover in production
- [ ] Guest mode: sidebar `...` menu for rename/delete
- [ ] Vocab export (CSV/Anki format)
- [ ] i18n implementation (locale dictionaries, `useLocale()` hook)
- [ ] Replace MyMemory API with backend LLM-based translation
- [ ] Refactor `activePdfName` → `activeChatId` across the full codebase
- [ ] Phase 4: user acquisition (10-20 users)
