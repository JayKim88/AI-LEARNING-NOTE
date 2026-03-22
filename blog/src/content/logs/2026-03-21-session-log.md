---
title: "2026-03-21 Session Log"
date: 2026-03-21
description: "LinguaRAG: language selection bug fixes, text annotation persistence & resize, JSONB codec, sidebar multi-split refactor"
tags: ["lingua-rag"]
---

## LinguaRAG — Annotation Fixes & Sidebar Refactor

> Two sessions: morning fixed language selection bugs and text annotation persistence/resize; evening refactored the sidebar divider system from nested splits to a flat multi-split structure.

---

### Session 1: Language Selection & Text Annotations

**Language selection contamination fix**

The `learningLang` state was persisted to localStorage, which caused a subtle bug: opening a German PDF after a Chinese PDF would show Chinese as the pre-selected language. Fixed by making `learningLang` pure in-memory state — the server already stores the per-PDF language, so localStorage persistence was unnecessary and harmful.

Also removed the backend auto-detect language feature entirely. The `language_detect.py` module had a fundamental flaw: Korean hangul characters were classified as Latin script, leading to French misdetection. Simpler and more reliable to let users always choose via the modal.

**JSONB codec registration**

Text annotation styles were being returned from the database as raw JSON strings instead of parsed objects, causing all style properties (`font`, `bold`, `italic`, etc.) to be `undefined` in the frontend. Root cause: asyncpg doesn't automatically parse JSONB columns.

Fixed by registering a JSONB codec (`json.loads`/`json.dumps`) on the connection pool at init time. This is a single registration point that benefits all JSONB columns automatically — much cleaner than sprinkling `json.dumps` calls in individual repository methods (removed 3 such manual calls).

**Batch style PATCH on deselect**

Previously, every toolbar click (bold, italic, font change) triggered an individual API call. Refactored to a batch approach: toolbar changes update the UI immediately but only send a single PATCH request when the annotation is deselected. Dirty tracking via ref detects whether any style actually changed.

**Height resize for text annotations**

Added vertical resize capability with bottom edge (↕) and bottom-right corner (⤡) handles. The `height` field is nullable — `null` means auto height (content-based, the default), while a number sets a fixed height as a percentage of the container. This maintains backward compatibility with existing annotations.

**Other annotation fixes**
- Toolbar now syncs to the selected annotation's actual style (was showing defaults)
- New annotations always start with `DEFAULT_TEXT_STYLE` (not the last-used style)
- Fixed event bubbling where clicking in text mode would deselect the just-created annotation
- Deferred annotation layer rendering until PDF page render completes (prevents flash)
- Fixed alignment icon SVGs (left/center/right were visually identical)

---

### Session 2: Sidebar Multi-Split Refactor

**The problem with nested splits**

The sidebar had 4 sections (Bookmarks, Chats, Folders, Vocabulary) arranged in a nested percentage-based split:

```
Outer split (top half / bottom half)
  ├─ Top: Bookmarks (fixed px) + Chats (flex)
  └─ Bottom: Folders (flex) + Vocabulary (fixed px)
```

This caused two issues:
1. **Divider coupling**: Dragging the Chats↔Folders divider would shift the Bookmarks↔Chats and Folders↔Vocab dividers too, because resizing the outer container proportionally repositions the inner percentage-based dividers.
2. **Refresh jump**: On page load, the server rendered the guest layout (Bookmarks at auto height), then auth resolved and switched to the logged-in layout (Bookmarks at 15%) — causing a visible layout jump.

**The flat multi-split solution**

Replaced the entire structure with a single `useMultiSplit` hook that manages all 4 sections at the same level:

```
Container (flat)
  ├─ Bookmarks  (pcts[0]%)
  ├─ divider 0  → adjusts pcts[0] and pcts[1] only
  ├─ Chats      (pcts[1]%)
  ├─ divider 1  → adjusts pcts[1] and pcts[2] only
  ├─ Folders    (pcts[2]%)
  ├─ divider 2  → adjusts pcts[2] and pcts[3] only
  └─ Vocabulary (pcts[3]%)
```

Each divider only modifies its two adjacent percentage values. Moving the Chats↔Folders divider changes `pcts[1]` and `pcts[2]` — Bookmarks and Vocabulary percentages stay fixed.

**Unified guest/logged-in layout**

Both guest and logged-in users now render the same `multiSplit` container. For guests, dividers are static (non-draggable thin lines) and section content shows login prompts. This eliminates the auth-transition layout jump since the DOM structure doesn't change.

**Divider styling**: thin `h-px` gray line by default, thickens to `h-1` blue on hover/drag for easy grabbing.

### Key Decisions

| Decision | Reasoning |
|----------|-----------|
| Flat multi-split over nested | Nested percentage splits cause proportional divider movement when outer container resizes |
| Unified guest/logged-in layout | Prevents layout jump on auth state transition by keeping the same DOM structure |
| JSONB codec at pool level | Single registration vs. per-query manual parsing; all JSONB columns benefit automatically |
| Batch style PATCH on deselect | Reduces N API calls (per toolbar click) to 1 (on deselect); dirty tracking via ref |
| Pure in-memory `learningLang` | Server stores per-PDF language; localStorage caused cross-PDF contamination |

### Next

- [ ] Test text annotation height resize with existing annotations after refresh
- [ ] Greeting redesign with pre-generated summary + suggested question buttons
- [ ] Flashcard batch generation with Haiku
- [ ] Vercel unpause + production deployment
