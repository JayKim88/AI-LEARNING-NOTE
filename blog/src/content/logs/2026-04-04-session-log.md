---
title: "2026-04-04 Session Log"
date: 2026-04-04
description: "nativ: Fixed PdfViewer view-mode flicker, built a design token system, and polished the SelectionPopup with per-function button colors"
tags: ["nativ"]
---

## nativ

Two sessions today, both focused on polish and reducing visual glitches in the app.

---

### Session 1 — PdfViewer: Killing the View-Mode Flicker

When switching between "scroll" and "page" view modes in the PDF viewer, the canvas would briefly show the wrong layout before catching up. This is a classic React rendering problem: the state update triggers a re-render, but the browser already painted one "wrong" frame before the DOM settled.

**What I built:**

- Added a `flashOverlay()` method to the `PdfViewerHandle` interface — an imperative escape hatch that parent components can call directly.
- Inside `PdfViewer`, a `forceOverlay` state renders a full-size overlay (`z-50`) that covers both the PDF canvas *and* the annotation/text layers (which are rendered by PDF.js separately and would otherwise flash through).
- Used `useLayoutEffect` in the page component to call `flashOverlay()` *before* the browser paints, whenever `effectiveViewMode` changes. This guarantees the overlay is in place before any visual frame.
- An `overlayTimerRef` clears the overlay after 350ms, and resets on rapid consecutive switches so the overlay never disappears prematurely mid-transition.

**Key decision:** `useLayoutEffect` instead of `useEffect` — the whole point is to block the browser from painting until the overlay is up. `useEffect` fires *after* paint, which would defeat the purpose.

---

### Session 2 — Design Tokens, Spinner, Modal Fix, SelectionPopup Polish

A batch of UI improvements across several components.

**Design token system for status colors**

Before this, colors like "success green" and "danger red" were hardcoded differently across 15+ components (`emerald-400`, `green-500`, `red-500`, etc.). I introduced four semantic tokens in `globals.css`:

```css
--color-status-success      /* emerald — "it worked" */
--color-status-warning      /* orange  — "heads up"  */
--color-status-danger       /* red     — "something's wrong" */
--color-status-danger-muted /* softer red for secondary danger text */
```

Both dark and light mode variants are defined. All the hardcoded colors across components now reference these tokens, so changing "the danger color" means editing one line.

**Spinner component**

Replaced the dozen or so inline `<span className="... border-t-accent animate-spin" />` patterns scattered throughout the app with a single `<Spinner>` component. Cleaner JSX, consistent sizing.

**AnimatedModal stacking context fix**

The Pronunciation Practice modal was appearing *above* the modal backdrop instead of below it — meaning you could see it even when a different modal was supposed to be on top. Root cause: the component rendered inside a deeply nested DOM tree, which created its own stacking context that ignored z-index.

Fix: wrap `AnimatedModal`'s return in `createPortal(…, document.body)`. The modal now renders directly on `<body>`, outside any stacking context. This fixes the bug for *all* modals using `AnimatedModal` — no per-modal workaround needed.

**Chat panel — stale state on PDF switch**

When a user hit their daily message limit and then switched to a different PDF, the "limit reached" state was persisting on the new PDF. The input bar was still disabled even though the new PDF had a fresh quota.

Fix: reset `dailyLimitReached`, `guestLimitReached`, and `dailyLimitInfo` whenever the active PDF changes. Also fixed a related bug where `isLoadingHistory` never resolved to `false` when uploading a brand new PDF (because there's no server PDF ID yet to fetch history for).

**Zustand store — atomic setState on init**

The PDF library store was calling `setState` twice during initialization: once for `library`, then again for `activeChatId`. Between those two calls there was a brief moment where `library` was populated but `activeChatId` was null — causing a flash of the wrong UI state. Merged both into a single `setState` call.

**SelectionPopup — per-function button colors**

The text selection popup (shown when you highlight text in a PDF) now has distinct colors per action:

| Button | Color |
|--------|-------|
| Listen (TTS) | Blue |
| Copy | Gray |
| Translate | Teal |
| Ask AI | Violet |
| Pronunciation practice | Purple |
| Note / Vocabulary | Amber |

In light mode, hovering a button shows a tinted background matching its color. In dark mode, all hover states use the same neutral zinc to avoid being garish.

The translate button, word chips below it, and translation result label all use the same teal — so the whole translate feature reads as one coherent color group.

**SelectionPopup — viewport edge clamping**

The popup was previously only guarded against overflowing the *right* edge of the screen (`Math.min(x, vw - 160)`). Near the left edge it would get clipped. Fixed with a `useLayoutEffect` that measures the popup's actual rendered width and clamps both edges with an 8px margin — running synchronously before paint, so there's no visible jump.

**Color constants refactor**

Instead of inline Tailwind class strings scattered through the popup's JSX, all button and chip colors are now defined as top-level constants (`BTN`, `CHIP`, `TRANSLATE_SPINNER`). Changing a button's color scheme is now a one-line edit at the top of the file.

---

### Key Decisions

- **`status-success` (emerald) vs `teal`**: emerald is reserved for system status indicators ("PDF Ready", "indexed"). Teal is the translate feature's color. They're visually close but semantically distinct — using the same color for both would make "is this green thing a status or a translate feature?" ambiguous.
- **`createPortal` at the `AnimatedModal` level**: applying it once here fixes all modals universally, rather than patching individual modals one by one.
- **Color constants over inline classes**: the SelectionPopup had accumulated many color-tuning iterations this session. Centralizing them at the top prevents future hunting through JSX.

### Up Next

- [ ] Deduplicate `handleFileSelect` (exists in both `ShellLayout` and the landing page)
- [ ] Code review: sections 2.5–2.9
- [ ] Clean up unused files: `hooks/useModalState.ts`, `hooks/useBackendHealth.ts`
