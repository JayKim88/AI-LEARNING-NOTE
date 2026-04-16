---
title: "2026-04-15 Session Log"
date: 2026-04-15
description: "SEO foundation for Nativ, SSR experiment (attempted & reverted), prompt quality improvements, guest mode bug fixes, legal page corrections"
tags: ["nativ"]
---

## Topics Covered Today

- [AI Prompt Quality](#ai-prompt-quality) — Language detection, pronunciation rules, TTS guidance
- [SEO Foundation](#seo-foundation) — OG image, JSON-LD, sitemap, Google Search Console
- [SSR Experiment](#ssr-experiment) — Attempted landing page SSR conversion, reverted
- [Guest Mode Bug Fix](#guest-mode-bug-fix) — Stale sidebar after login, dead code cleanup
- [Legal Page Corrections](#legal-page-corrections) — Privacy policy & terms accuracy fixes

---

## AI Prompt Quality

> Improved how the AI tutor responds — language detection, pronunciation notation, and response formatting (prompt v5.2 → v5.6)

### What Changed

- **Language detection fix**: The AI now only looks at the *last paragraph* to determine response language. Previously, if a user pasted foreign textbook content and asked a question in Korean, the AI would respond in the textbook's language instead of Korean.
- **Language hint moved to system prompt**: Changed from prepending a hint to the user's message (easily ignored by the model) to embedding it in the system prompt Block 3 (authoritative). This made the nano model reliably follow language instructions.
- **Pronunciation notation by language family**: European languages use IPA, Chinese uses Pinyin, Japanese uses Hiragana, Korean uses Revised Romanization. Previously everything was IPA-only, which didn't make sense for non-European languages.
- **TTS nudge**: AI now reminds users to click the speaker button for pronunciation practice, instead of trying to write out phonetic approximations (which were often inaccurate).
- **Flexible response length**: Simple questions stay under 150 words, grammar explanations can go up to 400 words. Previously everything was capped at 200 words.
- **Tables allowed**: Grammar comparisons (verb conjugation, active/passive) can now use markdown tables.
- **Any-language scope**: Tutor no longer refuses questions about languages that differ from the textbook's target language.

### Key Decision

Tested `gpt-4.1` thinking the model was the problem, but the real issue was *where* the language hint was placed in the prompt. Reverted to `gpt-4.1-nano` for the free tier — the architectural fix was sufficient.

---

## SEO Foundation

> Set up the technical SEO basics — OG image, structured data, sitemap, middleware fixes, and Google Search Console registration

### What Was Done

1. **OG image**: Created a dynamic Open Graph image using Next.js `ImageResponse` — renders the Nativ logo, tagline, and language flags. Previously the OG image reference was broken (file didn't exist), so social shares showed no preview.

2. **Middleware fix**: The Next.js middleware was blocking unauthenticated access to `/privacy`, `/terms`, `/refund`, `/sitemap.xml`, `/robots.txt`, and `/opengraph-image`. Google's crawler couldn't reach the sitemap — it was getting redirected to the HTML landing page instead. Fixed by adding these paths to the `isPublic` whitelist.

3. **Sitemap update**: Removed `/vocabulary` (auth-protected, useless for crawlers) and added the three legal pages.

4. **JSON-LD structured data**: Added three Schema.org schemas:
   - `SoftwareApplication` — product name, pricing (Free/$4.49 Plus)
   - `FAQPage` — all 8 FAQ Q&A pairs (enables rich results in Google)
   - `Organization` — company info and logo

5. **Canonical URLs**: Added to the root layout and all legal pages to prevent duplicate indexing (e.g., Vercel preview URLs).

6. **Dynamic `<html lang>`**: The `lang` attribute now reads from the `nativ-lang` cookie instead of being hardcoded to `"en"`.

7. **noindex on protected pages**: Added `robots: noindex, nofollow` metadata to `/c/[id]`, `/vocabulary`, and `/settings` via layout files.

8. **Google Search Console**: Registered `nativ.to` via DNS TXT verification (Namecheap), submitted sitemap — processed successfully.

9. **Environment variable**: Added `NEXT_PUBLIC_APP_URL=https://nativ.to` to both local `.env.local` and Vercel production.

### Issue Encountered

Google Search Console initially reported "Sitemap is HTML" — because the middleware was redirecting `/sitemap.xml` to `/` (the landing page). Fixed by allowing `/sitemap.xml` and `/robots.txt` through the middleware.

---

## SSR Experiment

> Attempted to convert the landing page from fully client-rendered to partial SSR. Reverted after discovering it provided no SEO benefit and broke language switching.

### What Happened

1. Split the landing page into Server Components (hero text, language bar, how-it-works, feature showcase) and a Client shell (upload zone, FAQ accordion, pricing toggle, contact modal).
2. Extracted a pure `translate()` function from the i18n module so Server Components could use translations without React hooks.
3. Build succeeded. But when testing, discovered that **changing the UI language didn't update the server-rendered sections** — Server Components only render once on the server and don't respond to client-side state changes.

### Why It Was Reverted

- **No SEO benefit**: Next.js already SSRs "use client" components. The `<h1>` text was already in the page source before the refactor. Verified by checking `site:nativ.to` on Google — the site was already fully indexed.
- **UX regression**: Language switching in the settings modal no longer updated the static sections (hero title, feature descriptions).
- **Marginal performance gain**: Slightly smaller JS bundle and less hydration work — not worth the complexity and regression.

### Lesson Learned

"use client" in Next.js does NOT mean "client-only rendering." It means "include this component's JS in the client bundle." Next.js still server-renders it for the initial HTML. The SSR conversion was solving a problem that didn't exist.

---

## Guest Mode Bug Fix

> Fixed a bug where the sidebar showed stale PDFs from a previously logged-in user when returning to guest mode

### The Problem

When a user logged out and returned to guest mode, the sidebar sometimes showed PDFs from their previous account. This happened because `library-meta:guest` in localStorage wasn't being cleared at the right time during the guest→login transfer process.

### The Fix

- Moved `localStorage.removeItem(guestLibKey)` to execute immediately after capturing the data (line 702), instead of deferring it to a background IIFE that could be interrupted by page refresh.
- Removed ~64 lines of dead code: `readGuestMeta()` polling, `pendingPdfs` handling, and the IIFE pending section. These were leftovers from an earlier architecture where `clientPdfId` was set asynchronously — it's now set synchronously on upload, making the polling unnecessary.

---

## Legal Page Corrections

> Updated privacy policy and terms of service to match the actual product behavior

### Changes

- **Privacy policy**: Removed mention of "email/password" authentication (only Google OAuth exists). Changed guest file deletion description from "when session ends" to "after a retention period." Replaced sessionStorage references with IndexedDB.
- **Terms of service**: Changed account deletion from "from settings menu" to "by contacting support@nativ.to" — no deletion UI exists yet in the app.
