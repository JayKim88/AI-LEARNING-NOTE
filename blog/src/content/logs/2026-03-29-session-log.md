---
title: "2026-03-29 Dev Log"
date: 2026-03-29
description: "LinguaRAG: remove Supabase Storage for guests, dark/light theme, guest menu redesign, pronunciation UI polish"
tags: ["lingua-rag", "frontend", "backend", "ux", "performance"]
---

## LinguaRAG

Two sessions today. The first made a significant infrastructure change — removing cloud storage for guest users entirely. The second added a dark/light theme system and polished several UI components.

---

### Session 1 — Stop Paying for Guest Storage

> Guests no longer upload PDFs to Supabase Storage. Files stay in the browser's IndexedDB until the user logs in, then get moved to cloud storage only at that point.

#### Why this mattered

Storage egress was the largest cost driver. Guest users were uploading PDFs, the backend was saving those files to Supabase Storage, and then the vast majority of guests never signed up. The files would sit there accumulating egress costs without ever being used by a real account.

The insight: the frontend was *already* rendering PDFs from IndexedDB. The browser had the file the whole time. Why upload it to cloud before it's actually needed?

#### How the new flow works

**Before (old flow):**
```
Guest uploads PDF
  → backend saves file to Supabase Storage
  → backend indexes text into DB
  → if user logs in: copy Storage file to new user path
```

**After (new flow):**
```
Guest uploads PDF
  → frontend keeps file in IndexedDB (browser only)
  → backend indexes text from the raw bytes (no Storage write)
  → if user logs in: frontend uploads blob from IndexedDB to Storage once
```

The backend's `index_pdf()` function now accepts an optional `pdf_bytes` parameter. When bytes are provided directly (guest case), it skips the `storage_download` step entirely. For logged-in users who upload normally, nothing changes — backward compatible.

The claim flow (guest → logged-in) was also simplified. Before, it tried to move the Storage file to the user's folder as a background task. Now it's just a pure DB operation (reassign `user_id`), and separately the frontend uploads the blob from its own cache.

#### Fixing IDB key confusion after login

This exposed a bug: guest PDFs were stored in IndexedDB under the key `guest:{chatId}`, but after login the app looked them up under `{userId}:{chatId}`. So when a user logged in, it couldn't find their PDFs in IDB and would try to re-fetch from Storage — which no longer existed.

The fix was a 3-tier lookup in `loadPdfFromLibrary`:
1. Try `{userId}:{chatId}` (current scoped key)
2. Try `guest:{chatId}` (guest prefix — migrate on first successful read)
3. Try bare `{chatId}` (legacy key from older versions)

Once found under an old key, the entry is immediately re-saved under the new key, so future lookups are fast.

#### Key decisions

- **No Storage for guests** — guest conversion rate is low enough that it's not worth paying for storage on every upload. IndexedDB holds the file just fine.
- **Client-generated PDF IDs** — the frontend now generates the UUID *before* uploading. This means if a user starts an upload, gets interrupted, and logs in mid-way, the PDF ID is already stored locally and can be recovered. No more "ghost uploads."
- **Background blob upload after claim** — adds ~1-2 seconds to the login/claim flow, but it's a one-time operation and the user sees their PDFs appear immediately regardless.

---

### Session 2 — Dark/Light Theme & UI Polish

> Added a proper dark/light theme toggle, redesigned the guest user menu, and polished the pronunciation practice UI with green success colors.

#### Theme system

Added `next-themes` to handle theme state. The default is dark mode (since the app was designed dark-first). Light mode was implemented using CSS variable overrides on `html.light` — overriding Tailwind 4's `@layer theme` variables without touching any component files.

Why this approach works: non-layered CSS beats layered CSS in specificity, so `html.light { --color-bg: ... }` cleanly overrides the defaults.

System preference is intentionally **not** followed (`enableSystem: false`). Reason: preventing unexpected light mode on first load for users who happen to have light mode set system-wide. The user should explicitly choose.

All hardcoded hex colors were replaced with semantic design tokens across 6 files:

| Before | After (token) |
|--------|---------------|
| `#2a2d2e` | `surface-raised` |
| `#cccccc` | `ink` |
| `#858585` | `ink-muted` |

This means light mode "just works" — the token values change, every component using them adapts automatically.

#### Guest menu redesign

Guests used to have a floating language button in the top-right corner that felt disconnected from the rest of the UI. Now guests get the same dropdown menu pattern as logged-in users, with:

- "Guest" label that opens a dropdown
- Sign in / Sound Settings / Language Settings / Toggle Theme

The logged-in user menu and guest menu reuse the same `showUserMenu` state — guests and logged-in users are mutually exclusive, so one boolean covers both.

The language button was removed from the top-right for guests to reduce clutter.

#### Pronunciation success colors

The pronunciation practice modal was showing amber/orange for correct matches (the app's default accent color). But amber doesn't read as "success" — it reads as "caution." Changed all success indicators (pass count badge, progress gauge, matched word chips, success message) to `emerald-500` (green).

This is hardcoded rather than using a theme token — pronunciation success should always be green regardless of dark/light mode or any future accent color changes.

#### i18n maintenance

Added the `shell.menu.theme` and `shell.menu.guest` keys to all 10 locale files. Also backfilled 44 missing `billing.*` and `sub.*` keys in 8 non-English/Korean locale files with English fallbacks — these were causing TypeScript build errors.

---

### What's next

- [ ] Move guest metadata from `sessionStorage` (per-tab) to `localStorage` (browser-wide) — so PDFs persist across tabs
- [ ] Add `lastAccessed` timestamp to IndexedDB entries for age-based cleanup
- [ ] App name decision: ChatLingo, LexiChat, or Readlingo — still undecided
- [ ] Translate `billing.*` keys in non-English locale files (currently English fallback)
