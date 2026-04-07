---
title: "2026-04-07 Session Log"
date: 2026-04-07
description: "Three sessions: PDF viewer bug fixes (vocab highlight occurrences, mobile sidebar), UI animations (sliding tab pill, panel swipe), and docs accuracy audit across 5 feature docs"
tags: ["nativ", "pdf-viewer", "mobile-ux", "i18n", "docs"]
---

## Session 1 — PDF Viewer Bug Fixes (18:32)

> Fixed a tricky vocab highlight bug where all instances of a word always jumped to the first one, hardened text annotation interactions, and locked the mobile sidebar against background scroll.

### What I fixed

**Vocab highlights always pointing to the first occurrence**

When you saved the same word multiple times across a PDF page, all highlight marks would visually point to the same first instance instead of their actual positions. The root cause was that the code was matching spans by text content rather than exact character position.

The fix was to build a character offset map (`buildTextOffsetMap`) that maps each position in the flat text string to the exact DOM text node and offset. This lets us place the highlight precisely where the word actually appears, even when it shows up multiple times.

One extra wrinkle: because inserting a `<mark>` element splits DOM text nodes, the offset map becomes stale after each insertion. I had to rebuild it fresh for every highlight item inside the loop — a correctness-over-performance tradeoff.

**Same word on different pages causing wrong flash animation**

When you clicked a vocab word in the side panel, the flash animation was keyed only to the word text, not the page. So clicking "apple" on page 3 would also flash "apple" on page 5. Fixed by passing `page` alongside the word in the flash state, and matching against `flashPage` (not the current `pageNumber`) inside the slide panel.

**Text annotation drag-select showing the wrong popup**

If you dragged to select text inside a text annotation box (read-only mode), the regular note/vocab popup appeared — which didn't make sense in that context. Fixed by adding a `fromAnn` flag that hides note and vocab buttons when the selection originated from inside an annotation.

**Mobile sidebar scroll lock**

When the sidebar was open on mobile, background content was still scrollable, which felt broken. Fixed with three layers: `body.overflow: hidden` to block document scroll, `touchmove preventDefault` to block touch scroll events, and `pointer-events-none` on the content area. Scrollable regions inside the sidebar opt in via a `.mobile-sidebar-scroll` class marker.

### Key decisions

- `occurrence_index` for vocab highlights gets its own dedicated DB column (migration `023`). Notes reuse the `y_pct` column since highlight-type annotations don't need vertical position data.
- The offset map is rebuilt inside the loop (per item) for correctness — the DOM mutates with each insertion, so any pre-built map would have stale node references.

### One unresolved issue

Mobile keyboard covering input fields (chat textarea, toolbar inputs) — iOS Safari does not respond to `visualViewport` + CSS variable approaches when inputs are inside `position: fixed` elements. Both a viewport resize approach and a React state approach failed on iOS. Deferred for later.

---

## Session 2 — UI Animations: Sliding Tab Pill + Mobile Panel Swipe (23:31)

> Made the view mode tab switcher feel polished with a sliding pill animation, and added a left/right swipe transition between PDF and Chat panels on mobile.

### What I built

**Sliding tab indicator pill**

The view mode switcher (PDF / Chat / split) previously highlighted the active tab with a static background color. I replaced it with an animated pill that slides between tabs using a CSS `left` transition.

- On mobile (2 tabs): pill moves between `2px` and `calc(50%)` over 200ms
- On desktop (3 tabs): pill moves between `2px`, `calc(33.33%)`, and `calc(66.67%)` over 200ms

The container uses CSS grid (`grid-cols-2` or `grid-cols-3`) so each tab takes exactly equal width.

**Mobile panel slide animation**

On mobile, switching between PDF view and Chat view now slides the panels in/out like a native app:
- Both panels are `absolute inset-0` (stacked on top of each other, filling the screen)
- Active panel: `translateX(0)`, inactive panel: `translateX(±100%)`
- Transition: 300ms ease

Desktop keeps its existing layout (just toggling `hidden` class) — adding animation there would conflict with the PDF canvas re-render masking (`flashOverlay`) that already handles the visual transition.

**Localized chat date separators**

Chat history shows "Today" / "Yesterday" separators. These were hardcoded strings. I added `chat.today` and `chat.yesterday` translation keys to all 10 language files (Korean, English, German, French, Spanish, Italian, Portuguese, Russian, Japanese, Chinese), and updated `formatDateLabel()` to accept a `language` parameter.

One nuance: `formatDateLabel` is called in a render context but not inside a React component tree, so it can't use a hook. I used the `translate()` pure function directly instead.

---

## Session 3 — Documentation Accuracy Audit (23:38)

> Compared all EN and KO feature docs side by side, verified claims against actual source code, and corrected multiple inaccuracies that had accumulated as features evolved.

### What I audited and fixed

**Cross-language alignment (EN ↔ KO docs)**

Scanned all 11 EN/KO feature doc pairs. Most were already in sync. Two had structural gaps:

- `guest-to-login.md` (KO): Missing 6 structural elements present in EN — Guest Data Flow diagram, Claim API sequence diagram (5-participant: frontend/Vercel/backend/DB/storage), Frontend and Backend claim logic text blocks, Claim Optimization table, plus an extra `### 문제` subsection that had no EN equivalent. All aligned.
- `chat-streaming.md` (EN): Missing two Mermaid flowcharts that existed in KO (`useChat.ts Core Logic`, `chat.py Endpoint Flow`). Added them.
- `state-management.md` (EN): A node label in the InitProvider diagram was getting truncated ("set is" instead of "set isPlus"). Fixed with a `<br/>` line break.

**Karaoke highlight removal**

Several docs described a "TTS karaoke" feature — word-by-word highlighting that tracks audio playback in real time using character timing weights (`charWeight`, `msPerChar`, `spokenWordIndex`, `setInterval`). Searching the codebase confirmed none of this was ever implemented. The docs were describing a planned but unbuilt feature.

Removed from: `pdf-viewer-highlight.md` and `tts-pronunciation.md` (both EN and KO):
- Key Terms entries
- Architecture diagrams
- Decisions sections (timing estimation tables, backoff strategies for word timing)
- Problems Solved rows
- Interview Q&A entries

**Windowed rendering window size: ±3 was wrong, actual is ±1**

Docs claimed the PDF viewer renders "current page ±3" as canvases (~7 total). The actual code (`Math.abs(n - pageNumber) <= 1`) renders only ±1 — max 3 canvases at once. The ±3 figure applies to the *highlight processing* window (pre-applying marks before the user scrolls), not canvas rendering.

Fixed in both `pdf-viewer-highlight.md` and `performance.md` (EN + KO): diagrams, technique tables, decisions tables, problems solved rows, and interview Q&A answers.

**Key prop includes a generation counter**

Docs said `key={file.name}` is used to remount the PDF `<Document>` component on file switch. The actual code uses `` key={`${file.name}-${fileGeneration}`} `` — a generation counter is appended so that switching to a PDF with the same filename as a previous one still triggers a full remount.

Fixed in `pdf-viewer-highlight.md` and `performance.md` (EN + KO).

**Embedding retry backoff formula was wrong**

The `performance.md` docs stated that the OpenAI Embedding service retries 5xx errors with `2^(n+1) → 2,4,8s` backoff. The actual code uses `2^n → 1,2,4s`. Fixed in both EN and KO.

**Vocab flash: no overlay div, just a CSS class**

An earlier doc version described the vocab flash animation as inserting a separate overlay `<div>`. In reality, the flash is applied as a CSS class (`vocab-highlight-flash`) added to the existing `<mark>` element. The pulsing opacity animation runs via CSS keyframes. No extra DOM element is involved.

**`renderedPages` Set, not `renderGen` counter**

The docs referenced a `renderGen` counter state that supposedly incremented to trigger highlight re-application after a page re-renders. The actual code uses a `renderedPages: Set<number>` — pages are added to the set on `onRenderSuccess`, and the highlight `useEffect` depends on this set. Fixed the Page Re-render Handling section accordingly.
