---
title: "2026-04-05 Session Log"
date: 2026-04-05
description: "Nativ: comprehensive mobile UX overhaul, guest-to-login claim optimization, DB query consolidation, secure context fallbacks"
tags: ["nativ"]
---

## Session 1: Performance & Secure Context Fixes

> Guest-to-login claim flow optimization, /init DB query consolidation, crypto.randomUUID secure context fallback, dev proxy for network IP access

### What I Did

- **Consolidated DB queries for PDF init** — replaced two sequential queries (`find_by_user_pdf` + `get_all`) with a single LEFT JOIN query (`get_messages_by_user_pdf`). This returns the `conversation_id` even when no messages exist yet (e.g., while a greeting stream is in progress), cutting the round-trip in half.

- **Optimized guest-to-login PDF claim flow** — the active PDF now opens immediately after claiming, while the remaining PDFs are claimed in a background IIFE. Selective polling breaks as soon as the active PDF's `pdfServerId` is ready, so the user sees their PDF without waiting for the full claim batch. Fixed a blob 404 bug where blob uploads were firing before the rest claim completed.

- **Fixed `crypto.randomUUID()` on non-secure contexts** — mobile browsers accessing the dev server over a LAN IP (`http://172.30.x.x`) don't have `crypto.randomUUID()`. Added a `getRandomValues`-based UUID v4 fallback for DB-bound UUIDs, and switched UI-only temp IDs to `generateChatId()` (nanoid-style). Also added an `isSecureContext` guard on Google One Tap to prevent silent failures on HTTP.

- **Added a dev upload proxy** — guest PDF uploads over a network IP failed due to CORS. Added a server-side proxy in `upload/route.ts` that forwards FormData to `localhost:8000`, scoped to `isLocalDev && !isLocalhost` so production and localhost are unaffected.

### Key Decisions

- `generateUUID()` uses an `isSecureContext` pre-check instead of try-catch — avoids exception-based control flow.
- Upload proxy is narrowly scoped: production always direct, localhost always direct, only IP-over-HTTP gets proxied.
- Active PDF opens before the rest of the claim batch completes — claim is an ownership transfer, `pdfServerId` doesn't change, so it's safe.

---

## Session 2: Comprehensive Mobile UX Overhaul

> Mobile UX improvements across the board — SelectionPopup bottom bar, toolbar restructuring, sidebar touch accessibility, text annotation mobile support

### What I Did

**Selection Popup — mobile bottom bar layout**
- On touch devices (`pointer: coarse`), the selection popup renders as a fixed bottom bar instead of a floating popover near the selection. This avoids overlapping with the iOS native selection menu (Copy/Look Up) which always appears above the selection.
- Added a `selectionchange` event listener with 400ms debounce to detect text selection on mobile (since `mouseup`/`mousedown` don't fire on touch).
- Added a backdrop for tap-to-dismiss and removed text labels (icons only) to keep it compact.

**SlidePanel z-index fix**
- The note/vocab SlidePanel was rendering inside an `isolate` div, which created a new stacking context. This trapped the panel's `z-50` below the shell header's `z-10`. Moved SlidePanel outside the `isolate` div so its `fixed z-50` competes in the root stacking context.

**Optimistic PDF delete**
- Moved `setLibrary()` before the server delete request. The UI now removes the PDF instantly. If the server delete fails, `syncWithServer` will restore it on next sync.

**User menu animation**
- Applied `useAnimatedMount` (scale + fade + translateY) to the sidebar user menu dropdown.

**iOS input auto-zoom prevention**
- Set `maximumScale: 1` in the viewport meta tag. This prevents iOS Safari from zooming in when focusing on inputs with `font-size < 16px`, which affected the search input, page number input, chat textarea, and text annotation toolbar inputs.

**PDF toolbar — mobile restructuring**
- Changed from `absolute` (scrolls with content) to `fixed bottom-4` on mobile, `md:absolute` on desktop.
- Switched from `flex-wrap` to `flex-nowrap` + `overflow-x-auto` with an inner `w-max` div — the toolbar is now a single row with horizontal scrolling.
- Fixed fit-to-width showing 50% on mobile: the calculation was dividing by a hardcoded `760` (desktop PDF width), but on mobile the actual base width is `containerWidth - 32`. Now uses `Math.min(containerWidth - 32, 760)`.

**Text annotation toolbar — restructured as PdfToolbar child**
- Previously rendered as a separate `absolute` element inside the `isolate` div (desktop) or via `createPortal` (mobile attempts). Both approaches had issues: the `isolate` stacking context broke `fixed` positioning, and portal-based rendering caused width/centering problems.
- Final solution: nest `TextAnnotationToolbar` inside `PdfToolbar` as an `absolute bottom-full` child. This means it naturally sits above the bottom toolbar, stays within the PDF viewer's bounds, and doesn't affect the parent's width.
- Font dropdown uses `createPortal` to `document.body` (avoids `overflow-x-auto` clipping).
- Color picker uses an invisible `<input type="color">` overlaid on the button for direct mobile touch.
- Added `data-text-toolbar` attribute to prevent `handleDeselectTextAnn` from treating toolbar clicks as "outside" clicks.

**Text annotation style persistence bug**
- When the user set styles (font, bold, etc.) in the toolbar and then clicked on the canvas to create an annotation, the new annotation was always created with `DEFAULT_TEXT_STYLE` instead of the selected style. Root cause: `useTextAnnClick`'s `useCallback` didn't include `currentStyle` in its deps array, so the closure captured the initial default value. Fixed by using a `useRef` to always reference the latest style.

**Sidebar touch accessibility**
- Desktop sidebar items show action buttons (bookmark, `...` menu) on hover — this doesn't work on touch devices. Added a `.sidebar-ctx-btn` CSS class with `@media (pointer: coarse) { opacity: 1 !important }` to always show the `...` button on touch.
- On mobile, bookmark icon and `...` button are laid out side-by-side (instead of stacked with hover-swap). The bookmark icon is display-only (no click handler) to prevent accidental unbookmarking — unbookmark is only available through the context menu.
- Added viewport overflow detection for context menu positioning (falls back to left side if right edge would overflow).
- Fixed context menu not closing on re-click: the `mousedown` outside-click handler was closing the menu before the `click` event could toggle it. Added `.sidebar-ctx-btn` exclusion to the outside-click handler.

**Mobile header icon**
- Replaced the hamburger (three horizontal lines) with the sidebar toggle icon (matching the desktop icon).

**Guest text annotation preview**
- Guests can now use the T button and text annotation toolbar to preview the feature. When they blur out of the text input (attempting to save), the annotation is discarded and a login modal appears.

### Key Decisions

- `maximumScale: 1` over per-input `font-size: 16px` — simpler, consistent, no risk of missing inputs.
- TextAnnotationToolbar as PdfToolbar child over portal — eliminates stacking context issues, width overflow, and centering problems in one structural change.
- Mobile bookmark icon is display-only — prevents accidental taps on small touch targets; unbookmark via context menu is intentional.
- Mobile SelectionPopup as fixed bottom bar — avoids the fundamentally unsolvable problem of iOS native menu positioning (which isn't exposed to JavaScript).

### Known Issues

- Vertical swipe on the bottom toolbar area causes the browser address bar to appear/disappear, shifting the header. This is a browser-level behavior that can't be prevented with CSS or JavaScript.
- Google OAuth doesn't allow IP addresses as redirect URIs, so mobile login testing on LAN requires deploying to production.
- `SpeechRecognition` (Web Speech API) is not available on iOS Safari or iOS Chrome (WebKit limitation). The app shows a guidance message.

### What's Next

- [ ] Sidebar loading indicators (per-section spinners)
- [ ] `handleFileSelect` duplicate removal (ShellLayout + landing page)
- [ ] Code review: sections 2.5~2.9
- [ ] Unused file cleanup: `useModalState.ts`, `useBackendHealth.ts`
- [ ] `/init` messages duplication fix
- [ ] Full mobile testing on production after deploy
- [ ] `_skipClaim` race condition — replace with AbortController
