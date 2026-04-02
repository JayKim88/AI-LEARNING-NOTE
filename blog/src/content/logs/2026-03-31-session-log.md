---
title: "2026-03-31 Session Log"
date: 2026-03-31
description: "Full day on Nativ — renamed the project, hardened the landing page, wired up Paddle payments, and polished the UI with new fonts, light theme, and a chat model toggle."
tags: ["nativ", "ui", "theme", "payments", "refactor"]
---

## What I worked on today

Three back-to-back sessions, all on **Nativ** — an AI-powered multilingual PDF tutor.
Today's focus: get the app ready for portfolio launch and real production use.

---

## Session 1 — 16:34 · Project Rename & Custom Domain

> Renamed the entire project from *LinguaRAG* to *Nativ* and pointed a real domain at it.

### What got done

**Code rename (67 files)**
The old name `lingua-rag` / `LinguaRAG` was scattered everywhere — README badges, environment variables, package names, evaluation scripts, Claude config. I swept through all of it and replaced every occurrence with `nativ` / `Nativ`.

One subtle issue: after renaming the project folder, the Python virtual environment broke because its shebang paths were hardcoded to the old folder name. Recreated `.venv` to fix that.

**Production infrastructure wired up**
- **Vercel**: project renamed to `nativ`, old `lingua-rag.vercel.app` alias removed
- **Custom domain**: connected `nativ.to` via Namecheap (A record + CNAME). Vercel redirects bare `nativ.to` → `www.nativ.to` with a 307
- **Supabase**: updated Site URL and OAuth redirect URLs to `https://nativ.to`
- **Google OAuth**: added `nativ.to` and `www.nativ.to` to Authorized JavaScript Origins; added the callback URL to Authorized Redirect URIs
- **Koyeb (backend)**: updated `FRONTEND_URL` env var to `https://nativ.to`

### Key decisions

- Kept the PostgreSQL database name as `lingua_rag` for now — renaming a live DB requires a careful migration and isn't urgent
- Removed `lingua-rag.vercel.app` without a redirect, since there are no active users on the old URL

---

## Session 2 — 20:27 · Launch Prep: Security, Landing Page, Paddle Payments

> Verified the codebase is clean, improved the landing page, and integrated Paddle production checkout.

### What got done

**Security audit**
Scanned the full git history for accidentally committed secrets — confirmed `.env` files were never committed. No real credentials exposed.

Also cleaned up a few remaining `LinguaRAG` references that were missed in session 1.

**Landing page overhaul**
Rewrote `LandingContent.tsx` to look production-ready:
- Replaced emoji hero with a proper SVG brand mark (amber background + book icon)
- Replaced emoji feature cards with colored SVG icons (amber / purple / blue / green)
- Added three trust signal badges: *"No signup required · 9 languages · Free to start"*
- Improved the upload zone with a hover color transition
- Added section headers and color-differentiated step numbers to "How it works"
- Propagated trust signal copy across all 10 supported languages

**Paddle production payments — CSP fix**
When testing the Paddle checkout overlay, it was blocked by the app's Content Security Policy. Added the missing Paddle domains to `frame-src` and `child-src`:
```
https://buy.paddle.com
https://checkout-service.paddle.com
https://*.paddle.com
```

### Issues hit

- **Paddle 403 on localhost**: Paddle intentionally blocks production checkouts on `localhost`. Real payment testing must happen at `nativ.to` after domain approval — not a bug, expected behavior.
- **Old domain in Paddle**: Only `lingua-rag.vercel.app` was registered in Paddle's Domain Approval list. Need to add `nativ.to` and `www.nativ.to` before live payment testing works.

---

## Session 3 — 23:42 · UI Polish

> Typography, light theme redesign, sidebar sizing, chat model toggle, and note editor improvements.

### What got done

**Custom fonts**
Added proper fonts via `next/font/google` — the app was previously falling back to the OS system font (inconsistent across devices):
- **Plus Jakarta Sans** for Latin characters — modern, warm, fits the learning brand
- **Noto Sans KR** as a Korean fallback — covers Hangul consistently without relying on the OS
- Japanese / Chinese fall back to system fonts (adding Noto Sans JP/SC would bloat the bundle too much for now)

**Light theme overhaul**
The light theme was too bright and eye-straining. Two changes:

1. **Indigo accent color** — replaced amber in light mode. Amber has low contrast on white backgrounds; indigo-500 is much more readable. Dark mode still uses amber.
2. **Improved contrast tokens** — background shifted from pure white (zinc-50) to zinc-100 to reduce glare; text and border tokens bumped one step darker across the board.

Also fixed a long-standing bug: Tailwind's `dark:` utility classes were responding to the *system* dark mode preference instead of the app's theme toggle. Added `@variant dark (&:where(.dark, .dark *))` to `globals.css` so `dark:` variants now correctly follow the `.dark` class set by `next-themes`. This was causing landing page step icons to show dark backgrounds even when the app was in light mode.

**Sidebar sizing**
- All tree nodes, PDF item names, and account dropdown items bumped from 12px to 14px
- Account dropdown width increased from 192px to 260px

**Chat model toggle (Fast / Quality)**
Added a sliding pill toggle inside the chat input bar, right next to the "PDF Ready" chip:
- **Fast** = GPT-4.1-nano (default, free)
- **Quality** = GPT-4.1-mini (Plus plan only)

On the backend, added a `use_quality` flag to `ChatRequest`. An `effective_is_plus` check ensures non-Plus users can't bypass the restriction even if they manipulate the client.

**Note editor improvements**
- Dates now show as "Today at 22:13" / "Yesterday at 10:30" / "Mar 30 at 22:13" instead of the verbose "30 March 2026 at 22:13". Clock and pencil SVG icons replace the "Created:" / "Modified:" text labels.
- Removed hardcoded `"ko-KR"` locale from all date formatting — dates now use the browser's locale automatically.
- Toolbar wrap fix: previously, when the note modal was narrow, toolbar buttons would break at arbitrary mid-group positions. Wrapped each button group (`H1 H2 H3`, `B I U S </>`, lists, blocks, undo/redo) in a `shrink-0` div so wrapping only happens at group boundaries — looks clean at any width.
- Plus plan modal: infinity symbols (∞) bumped from 14px to 20px — they were barely visible before.

### Key decisions

- **Indigo for light mode**: amber works well on dark, but has poor contrast on white. Different accents per theme is a common pattern and felt natural here.
- **Group-level toolbar wrapping**: overflow scroll felt unnatural for a writing tool. Group-aware wrapping (whole groups move to the next line together) is more predictable and cleaner.

---

## What's next

- [ ] Add `nativ.to` and `www.nativ.to` to Paddle's Domain Approval list, then run a real end-to-end payment test on production
- [ ] Fix 3 stale backend tests in `test_guest_claim.py` (broken after recent code changes)
- [ ] Write the capstone blog post (product + architecture, single article)
- [ ] Set up uptime monitoring (BetterStack or UptimeRobot)
- [ ] Remove `lingua-rag.vercel.app` from Google OAuth Authorized JavaScript Origins
- [ ] Properly i18n the hardcoded Korean labels in `format-utils.ts` ("방금", "오늘", "어제")
