---
title: "2026-03-15 Session Log"
date: 2026-03-15
description: "LinguaRAG: cross-page selection highlights, accurate page tracking for notes, pin annotation cleanup, TTS sync diagnosis"
tags: ["lingua-rag"]
---

## lingua-rag

> PDF cross-page drag highlights, note page accuracy, pin annotation removal, TTS word-highlight sync investigation

### What I Did

- **Fixed cross-page drag highlight not rendering** — When scrolled so page 2 is partially visible and you drag-select text there, the blue selection overlay didn't appear. Root cause: the render condition checked `n === pageNumber` (the *active* page from scroll position), so highlights only drew on the current page. Added a `selectionPage` state that tracks which page the selection actually occurred on, and passed the correct page number to `ensureTextContent(forPage?)` so it loads the right page's text data for rect computation.

- **Fixed notes/vocab saving with wrong page number** — When selecting text on a non-active page (e.g., page 2 while viewing page 1), notes and vocabulary were saved with the wrong page. Added a `page` field to the `SelectionPopup` interface so the popup carries the actual selected page. Updated note panel, vocab panel, and highlight-index calculation to use `popup.page` instead of the scroll-based `pageNumber`.

- **Prevented popup from appearing on empty area drag** — Dragging in blank space (no text) still triggered the selection popup. This happened because `caretRangeFromPoint` always returns the *nearest* text node even when clicking empty areas. Added an `e.target !== textLayer` guard — if the click target is the text layer container itself (not a child `<span>`), it's treated as empty space and the drag is ignored.

- **Removed pin/sticky annotation system (~280 lines)** — The old pin-based annotation system (📌 icons on PDF pages with sticky-note-style editing popovers) was fully superseded by the highlight notes system. Pins were being created at `x_pct: 0, y_pct: 0`, causing stray 📌 icons in the top-left corner. Removed: `STICKY_COLORS` constant, 6 state variables (`isStickyMode`, `pendingSticky`, `editingSticky`, `stickyText`, `stickyColor`, `draggingPin`), 2 refs (`pinDragRef`, `pinWasDraggedRef`), the pin-drag `useEffect`, sticky mode click handler on page containers, and all pin/sticky rendering JSX. Kept the annotation API functions since the highlight note system still uses them.

- **Reverted compound word merging for pronunciation** — Implemented adjacent-word merging to handle STT splitting compound words like "ChatGPT" → "chat" + "gpt". The approach was to concatenate 1-2 adjacent unmatched STT words and compare against the expected word. Reverted per user request — needs further design consideration.

- **Diagnosed TTS word-highlight sync issue with numbers** — When TTS reads "Microsoft 365", the highlight chip jumps past "365" too quickly. Root cause: the timer-based highlighting estimates duration by character count (`w.length`). "365" gets weight 3 (3 chars), but TTS pronounces it as "three hundred sixty-five" (~1-1.5 seconds). The 210ms allocation (3 × 70ms) is far too short. Investigated `SpeechSynthesisUtterance.onboundary` as a solution — it provides exact word timing from the speech engine. However, Chrome's Google network voices (`localService: false`) don't fire boundary events because audio is streamed from Google servers without word-level metadata. Local voices do support it.

### Key Decisions

- **Pin annotations removed entirely** — Highlight-based notes replaced this feature completely. The pin system had a side effect where annotations created via the note panel got `x_pct: 0, y_pct: 0`, placing unwanted pins at the top-left corner.
- **`popup.page` pattern** — Embedding the page number in the popup state decouples selection context from scroll position. This is more reliable than relying on `pageNumber` which updates asynchronously based on scroll events.

### Next

- [ ] Improve TTS word highlighting — prefer local voices + `onboundary` events, with timer-based fallback for network voices (hybrid approach)
- [ ] Resolve compound word STT splitting (e.g., "ChatGPT" → "chat" + "gpt") — revisit adjacent word merging design
- [ ] Test full guest→login flow with 2+ PDFs
- [ ] Commit all session changes
