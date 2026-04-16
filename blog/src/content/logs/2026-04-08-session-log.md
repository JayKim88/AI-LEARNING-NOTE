---
title: "2026-04-08 Session Log"
date: 2026-04-08
description: "Three sessions: Koyeb cold start elimination with UptimeRobot keep-alive, mobile viewport height fix using visualViewport API, and tier-aware upgrade prompts for subscription upsell"
tags: ["nativ", "devops", "mobile-ux", "subscription", "billing"]
---

## Session 1 — Killing Koyeb Cold Starts (12:45)

> Added a lightweight `/api/ping` endpoint and wired up UptimeRobot to keep the backend from sleeping.

### The problem

Nativ's backend runs on Koyeb's free tier, which puts the instance to sleep after 1 hour of inactivity. When a user hits the app after a sleep period, the first request takes 10-15 seconds while the container boots — a terrible first impression.

### The fix

I added a `GET /api/ping` endpoint that returns a 200 immediately — no database query, no auth. Then I set up UptimeRobot (free tier) to hit this endpoint every 5 minutes, keeping the instance permanently warm.

One gotcha: UptimeRobot's free plan sends `HEAD` requests, not `GET`. FastAPI's `@router.get` returns 405 for HEAD. The fix was using `@router.api_route(methods=["GET", "HEAD"])` instead.

### Why not just use `/api/health`?

The existing health endpoint checks database connectivity, which takes 3-4 seconds on first pool reconnect. Pinging that every 5 minutes would create unnecessary DB load. `/api/ping` is instant (~1ms) and purpose-built for keep-alive.

---

## Session 2 — Mobile Browser Chrome vs. Fixed Layouts (12:49)

> Solved the mobile Safari/Chrome address bar show/hide flicker by switching from CSS viewport units to the `visualViewport` API.

### The problem

On mobile browsers, the app's shell height was set with CSS `100dvh`. When the user scrolled even slightly, the browser would hide its address bar/toolbar, which changes `dvh`. This triggered a layout recalculation, which caused content to overflow, which triggered the browser chrome to reappear — creating an infinite show/hide cycle.

### Why `100dvh` wasn't enough

Tailwind 4's `h-[100dvh]` arbitrary value actually caused a complete black screen (likely a class generation issue). Even after switching to a plain CSS utility, the fundamental problem remained: CSS viewport units react to browser chrome changes, and any height change causes a re-layout cascade.

### The fix: `visualViewport` API

Instead of CSS, I used JavaScript to listen to `window.visualViewport.resize` events and set the shell height directly on the DOM element:

- On mobile only (detected via `matchMedia("(max-width: 559px)")`)
- Skips updates when a keyboard is open (detected by checking if `document.activeElement` is an input/textarea) — this prevents a black gap from appearing below content when the keyboard slides up
- The ~50px difference from browser chrome showing/hiding gets handled smoothly; the ~300px keyboard resize gets intentionally ignored

### Guest rate limits discussion

Also discussed the guest rate limit architecture. Currently all three limits (upload, chat, translation) use an in-memory dict on the backend — meaning they reset every deploy. Agreed on a fix direction: a `guest_daily_usage` DB table keyed by IP + date, with a FastAPI startup job to clean old rows. Not implemented yet.

---

## Session 3 — Tier-Aware Upgrade Prompts (23:20)

> Made the "file too big" and "too many pages" modals actually useful — they now show the right upgrade path based on what tier can resolve the limit.

### The problem

When a logged-in user tried to upload a PDF that exceeded their plan limit (e.g., 205 pages vs. the 200-page login limit), they got a modal with just a "Confirm" button. No mention of Plus, no upgrade path. The user had no idea that upgrading would solve their problem.

Meanwhile, the backend error path (for things like daily message limits) already had proper upgrade prompts via the `SubscriptionModal`. But the client-side pre-check for file size and page count — which runs *before* the upload even starts — was using a separate `AccountGuideModal` that lacked this logic.

### Two-path architecture

The app checks limits in two places:

| Check | Where | Why |
|-------|-------|-----|
| File size, page count | **Client** (before upload) | Avoidable — why upload 200MB just to get rejected? |
| Daily messages, translations, annotations, vocab, memos | **Backend** (on action) | Requires DB state (today's usage count) |

The backend path was already correct. The client path needed the upgrade logic.

### The fix

The `AccountGuideModal` now receives the limits for every tier and applies a decision tree:

**For guests:**
1. Can login resolve it? → Show "Sign in with Google"
2. Can Plus resolve it? (login alone won't) → Show Plus info + "Sign in with Google"
3. Nothing resolves it? → Show plain "Confirm"

**For logged-in users:**
1. Can Plus resolve it? → Show "Upgrade to Plus" button (opens SubscriptionModal)
2. Nothing resolves it? → Show plain "Confirm"

**For Plus users:**
- They only see the modal if their file exceeds even Plus limits (e.g., 2,100 pages vs. 2,000 max) → plain "Confirm"

The key insight is using `canPlusResolve = fileSize <= plusMaxSize` rather than checking `isPlus` — this correctly handles edge cases like a 160MB file that exceeds even Plus's 150MB limit.

### The bug that cost an extra round

My first fix only updated `page.tsx` (the landing page). But most uploads happen through `ShellLayout` — the sidebar file input, drag-and-drop, and upload modal all route through ShellLayout's `handleFileSelect`, which had its own copy of the pre-check logic. The user tested, saw the old modal, and reported it still broken.

Lesson: when there's duplicate logic in two places, you have to fix both. (There's already a backlog item to deduplicate `handleFileSelect`.)

### Another bug: `isPlus` declared too late

ShellLayout has a local `isPlus` state (line 481) that gets set from a subscription API call. But the file handling code that needed it was at line 162 — inside a `useCallback` that runs before the state is initialized. JavaScript's block scoping caught this at compile time (`Block-scoped variable used before its declaration`).

Fix: read `isPlus` from `useAuthStore` instead (which is set during `initAuth()` at mount time), naming it `isAuthPlus` to avoid collision with the existing local state.

### i18n

Added 3 new translation keys across all 10 supported languages: `account.upgradeForLargerFile`, `account.upgradeForMorePages`, and `account.upgradePlus`.
