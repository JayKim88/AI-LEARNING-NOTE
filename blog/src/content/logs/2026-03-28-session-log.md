---
title: "2026-03-28 Dev Log"
date: 2026-03-28
description: "LinguaRAG: subscription config cleanup, FREE→LOGIN rename, chat reset fix for guests, async PDF delete"
tags: ["lingua-rag", "backend", "performance", "refactor"]
---

## LinguaRAG

Two back-to-back sessions today. The first cleaned up a mess in how subscription limits were named and enforced. The second fixed a silent bug in chat reset and made PDF deletion noticeably faster.

---

### Session 1 — Subscription Config Cleanup & FREE→LOGIN Rename

> Audited all subscription limit variables, fixed Plus tier enforcement, and renamed `FREE_*` to `LOGIN_*` across the entire codebase.

#### What got done

**Plus tier was broken in two ways**

1. `tierKey` in `ChatContext.tsx` always resolved to `"free"` — even for paying Plus users. The code was checking `isGuest` but never checking `isPlus`, so Plus users were getting Free-tier limits everywhere.

2. `PLUS_MAX_NOTE_PAGES` was set to `50` when it should have been unlimited. Note pages are just sidebar folders stored as JSONB — they have zero server cost, so capping Plus at 50 made no sense.

Both are now fixed. Plus users get `maxPages = -1` (unlimited), which short-circuits all frontend pre-checks entirely.

**Cleaned up dead config variables**

`PLUS_MAX_PDFS_TOTAL` was defined but never actually used anywhere in the code. Removed it. The Plus PDF limit is `None` (unlimited) enforced directly in `pdfs.py`.

**Renamed `FREE_*` → `LOGIN_*`**

This was the biggest change by file count. The old `FREE_` prefix was misleading — the variable controls limits for *logged-in, non-paying* users, not "free tier" as a pricing concept. The codebase already branches on auth state (guest sentinel UUID vs. real user), so `LOGIN_` is more accurate.

Affected: `config.py`, all backend routers, `useBackendHealth.ts`, `ChatContext.tsx`, billing page, `.env`, docs. The DB `tier` column still stores the string `"free"` — only the code-side names changed.

#### Key decisions

- **`LOGIN_` over `FREE_`** — auth state and pricing tier are different concepts. Code should reflect what it actually checks (is this a real user? yes/no), not the marketing label.
- **Plus note pages = unlimited** — no cost to serve, no reason to gate. Removed the limit entirely.
- **`MAX_NOTE_PAGES` over `MAX_PAGES_TOTAL`** — the old `_TOTAL` suffix was ambiguous (total PDF pages? total note pages?). The new name is self-documenting.

---

### Session 2 — Chat Reset Fix & Faster PDF Delete

> Fixed chat reset silently failing for guest users, consolidated the reset API from 2 calls to 1, and moved PDF storage cleanup to a background task.

#### The chat reset bug

When a guest user hit "Reset Chat," nothing happened — no error, no feedback, the chat history stayed. The root cause was straightforward once traced:

```
resetChat() → GET /api/conversations/by-pdf/{id}/messages
                        ↑ requires JWT auth
                        guest has no JWT → 401
                        res.ok = false → early return
                        setChatResetKey never called → UI never resets
```

The fix: guests now call `DELETE /api/guest/pdfs/{pdf_id}/messages` (no auth required). Logged-in users call the new `DELETE /api/conversations/by-pdf/{pdf_id}/messages`. Both delete in a single round-trip.

**Before vs. after for logged-in users:**

```
Before:
  GET  /api/conversations/by-pdf/{id}/messages  → get conversation_id
  DELETE /api/conversations/{id}/messages        → delete messages
  (2 network round-trips)

After:
  DELETE /api/conversations/by-pdf/{id}/messages
  (1 round-trip)
```

The new `delete_messages_by_pdf()` repository method reuses two existing methods — `find_by_user_pdf()` + `delete_messages()` — rather than duplicating the SQL.

#### Faster PDF delete

Before, deleting a PDF was synchronous and sequential:

```
storage_delete(user_path)   ← wait
storage_delete(guest_path)  ← wait
db.delete(pdf)              ← wait
→ respond to user
```

Two storage calls always ran, because PDFs claimed from guest accounts could still have files at the guest path (background move might not have completed). Both paths need to be covered.

Now it's:

```
db.delete(pdf)              ← wait (immediate)
→ respond to user
[background] storage_delete(user_path) + storage_delete(guest_path)  ← parallel
```

DB deletion cascades to all related records (chunks, messages, conversations), so from the user's perspective the delete is instant. Storage cleanup runs in parallel in the background via `asyncio.gather`. If it fails, a warning is logged — the existing startup GC catches orphan files periodically.

This is the standard SaaS pattern: delete the data first (users can't see it anymore), clean up storage asynchronously.

#### Key decisions

- **DB first, storage in background** — storage errors shouldn't block the user. DB cascade ensures data consistency immediately. Orphan storage files are a billing concern, not a correctness concern, and the startup GC handles them.
- **Guest reset = no-auth endpoint** — guest sessions have no Supabase JWT. Any operation for guests must live under `/api/guest/*` with `GUEST_USER_ID` hardcoded server-side.
- **Missing conversation = success, not 404** — if no conversation exists yet (user never chatted), there's nothing to delete. Returning 404 would break the reset flow for no reason.

---

### What's next

- [ ] `loadPdfFromLibrary` simultaneous-get fix (scoped + legacy IndexedDB keys in one transaction)
- [ ] Common backend limit error helper (`raise_limit_error()`) to reduce router boilerplate
- [ ] Storage orphan alert — warning log if background cleanup fails, consider retry queue
- [ ] DB backup automation (GitHub Actions `pg_dump` → artifact)
- [ ] Payment error cases B-4~B-8 (blocked on Paddle approval)
