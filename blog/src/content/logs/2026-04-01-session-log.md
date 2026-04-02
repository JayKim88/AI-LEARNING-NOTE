---
title: "2026-04-01 Session Log"
date: 2026-04-01
description: "Full-day sprint on Nativ: billing lifecycle, legal pages, brand overhaul, modal animations, translation proxy, landing redesign"
tags: ["nativ"]
---

## Billing & Payments

> Fixed subscription cancel lifecycle, added refund policy page, introduced yearly plan, and set up Paddle pricing

### What I Did
- **Subscription cancel fix** — When a user cancels mid-billing-cycle, they now keep Plus access until the period ends. Previously, the webhook handler immediately downgraded them to Free. The fix lives in two layers: the webhook sets `tier=plus` if `period_end > now`, and the DB query (`get_tier`) also checks `canceled + period_end > NOW()` as a safety net.
- **Refund Policy page** (`/refund`) — All purchases are non-refundable. Exceptions only for verified technical outages or duplicate charges. This was a Paddle domain approval blocker (they require a visible refund policy).
- **Monthly/Yearly toggle** — Added a plan interval selector to both the billing page and the upgrade modal. Monthly: $6.99/mo, Yearly: $53.88/year ($4.49/mo, 36% off). Default selection is yearly for better conversion.
- **Legal page cleanup** — Fixed light mode visibility (`text-white` → `text-ink-bright`), replaced Stripe references with Paddle, fixed a leftover "LINGURARAG" reference, increased font sizes, updated all dates.
- **Contact email** — Changed from `hello@nativ.to` to `support@nativ.to`. Set up Namecheap Catch All email forwarding to Gmail.
- **Paddle pricing** — Changed base price from KRW ₩9,900 to USD $6.99 with KRW as a country-specific override. Tax inclusive.
- **20 billing webhook tests** — Covers the full lifecycle: create → renew → cancel mid-cycle (keeps Plus) → period expire (downgrades to Free). Also tests signature verification, transaction completion, and helper functions.

### Key Decisions
- **No-refund policy** (ChatPDF pattern) — The Free plan already acts as a trial. A 7-day refund window would be abusable (subscribe, use, refund, repeat).
- **DB query guards + webhook guards** — Defensive on both sides. If the webhook misses an event, the DB query still calculates the correct tier from `status + period_end`.
- **Tax inclusive pricing** — What users see is what they pay. Paddle handles per-country tax calculations automatically.

---

## Brand & Logo Overhaul

> Replaced all placeholder book icons with the new N mark logo, set up dark/light mode variants

### What I Did
- **Logo replacement** — Every book SVG icon in the app was replaced with the new N mark PNG:
  - Sidebar header: `logotitle-yellow.png` (dark) / `logotitle-black.png` (light)
  - Landing hero & CTA: `logo-no-bg.png` (dark) / `logo-dark.png` (light)
  - Footer: `logotitle-white.png` (dark) / `logotitle-black.png` (light)
  - Chat AI avatar: N mark replaces the old book icon
- **Favicon regeneration** — All sizes (32px ico, 180px Apple Touch, 192px Android, 512px PWA) generated from the new logo. Added `icons` metadata to `layout.tsx`.
- **Cleanup** — Removed 4 unused files from `public/` (old logo variants, duplicate screenshots).
- **Dark/light switching** — Used Tailwind's `hidden dark:block` / `dark:hidden` pattern. Zero JavaScript, purely CSS-driven.

### Key Decisions
- **PNG over inline SVG** — The logo SVGs are auto-traced (complex paths, 180KB+). Not suitable for inline use. Next.js `<Image>` gives automatic WebP conversion and size optimization anyway.
- **No logo+title combo image yet** — Tried generating one with ImageMagick but the text rendering quality was poor. Needs to be done in Figma.

---

## Modal Animation System

> Built a CSS-only animation wrapper and migrated all 14+ modals

### What I Did
- **`AnimatedModal` component + `useAnimatedMount` hook** — CSS-only enter/exit animations (fade + scale, 200ms). No dependencies (saves 30KB vs framer-motion).
- **Full migration** — All modals in the app now use `<Modal isOpen={show} />` instead of `{show && <Modal />}`. This enables exit animations (previously impossible because the component unmounted immediately).
- **Light mode accent color** — Changed from indigo to blue (`blue-600`/`blue-700`). Better contrast on white backgrounds.
- **SelectionPopup dual theme** — Light mode gets white background with darker semantic colors; dark mode keeps zinc-800 with lighter colors.
- **Spinner unification** — All 11 loading spinners now use `border-t-accent` instead of hardcoded `blue-500` or `amber-400`.
- **Quality toggle fix** — The paywall message incorrectly said "free trial messages" when toggling the quality model. Now correctly says "High-quality AI model is available for Plus members."

### Key Decisions
- **CSS-only over framer-motion** — A 50-line hook handles `setTimeout(20)` for paint guarantee, managing `mounted → visible → hidden → unmounted` lifecycle. Simpler and lighter.

---

## Translation Proxy

> Added Google Translate as primary translator with GPT fallback, redesigned quota system

### What I Did
- **Google Translate proxy** (`/api/translate-proxy`) — Uses the unofficial `client=gtx` endpoint. Single words return up to 3 alternative meanings. Backend handles the Google → GPT fallback in one endpoint (no frontend retry logic).
- **Quota redesign** — Extracted shared `check_translation_limit` / `record_translation` into `translate_limit.py`. Count-on-success pattern: quota is consumed only after a successful translation. Daily limits: Guest 200, Free 500, Plus unlimited.
- **Guest support** — `/api/guest/translate-proxy` with IP-based rate limiting.

### Key Decisions
- **Google `client=gtx`** — 10-year track record, no known legal issues, sufficient for current scale. If it gets blocked, GPT fallback kicks in automatically.
- **Backend-side fallback** — Prevents double-counting and keeps quota enforcement in one place.

---

## Landing Page Redesign

> Complete visual overhaul with zigzag layout, new copy, and scoped drag-drop

### What I Did
- **Zigzag showcase** — 5 feature sections (Listen, Speak, Translate, Save, Organize) with alternating image-text layout and product screenshots.
- **New brand copy** — "Be Nativ in Any Language." / "Turn any PDF into your personal language tutor."
- **Pricing section** — Monthly/Annual toggle with "Save 36%" badge and 8-item plan comparison.
- **CTA section** — Gradient background, entire card accepts click + file drop.
- **Tier limit fixes** — Plus users were incorrectly getting login-tier limits (200 pages instead of 2000). Fixed in ChatContext, backend account endpoint, and translation endpoints.
- **OCR fix** — `google-cloud-documentai` was missing from `requirements.txt`, causing `ModuleNotFoundError` on scanned PDF uploads.

### Key Decisions
- **USD as display currency** — Paddle handles local currency conversion at checkout. Avoids maintaining 10 localized price strings.
- **Zigzag over card grid** — Larger screenshots, natural scroll rhythm, follows Linear/Vercel conventions.

---

## Selection Popup Fixes

> Scoped amber highlight to popup-enabled areas, fixed NoteViewer popup positioning

### What I Did
- **Scoped selection color** — Created `.selection-amber` CSS class and applied it only to containers that have a SelectionPopup (MessageList, SlidePanel, NoteViewer). Previously, chat messages had the amber highlight but note modals and side panels used browser-default blue.
- **NoteViewer popup position** — Changed from `range.getBoundingClientRect()` to `e.clientX/Y` to match PDF/Chat/SlidePanel behavior. Also captured mouse coordinates before `setTimeout` to avoid React event pooling edge cases.

---

## Sidebar & UI Polish

> Various fixes for sidebar behavior, vocabularypage, and i18n

### What I Did
- Added 16 vocabulary i18n keys to all 10 language files
- Replaced native `<select>` with custom dropdowns (macOS overlay issue)
- New chat button now matches the account button pattern
- Vocab sidebar refreshes live when words are added/deleted (`vocab-changed` event)
- Fixed ghost popup on external click, dark mode highlight icon, PDF rename input height jump
- Contact modal in footer with Help/Feedback and Partnerships cards

---

## What's Next

- Deploy all commits and verify Paddle domain approval
- End-to-end payment test (monthly + yearly checkout flow)
- Test subscription cancel → verify Plus access maintained until period end
- Hero section screenshot for landing page
- Google Translate proxy monitoring for potential blocks
