---
title: "Optimizing Guest-to-Login Data Transfer: From 4s to 100ms"
date: 2026-03-14
description: "How reordering async operations, splitting API calls, and deferring storage moves eliminated a 4-second login delay and fixed missing chat history."
category: learnings
tags: ["react", "async-operations", "performance", "fastapi", "background-tasks", "race-condition", "supabase"]
lang: en
draft: false
---

## Key Concepts

### The Guest-to-Login Transfer Problem

In apps that allow anonymous (guest) usage before requiring login, transferring guest data to an authenticated account is a deceptively complex operation. The core challenge: **multiple async operations must complete in a specific order**, and the UI must reflect the correct state at each step.

In this case, a language-learning app lets guests upload PDFs and chat with an AI tutor. On login, guest data (PDFs, conversations, chat messages) must transfer to the authenticated user's account. Two bugs emerged:

1. **Chat history disappeared** for the currently-viewed PDF after login
2. **Login felt slow** — 4-10 seconds staring at a landing page

### Race Conditions in State Transitions

The root cause of the missing chat was a classic **async ordering bug**. React state updates trigger component mounts, which trigger data fetches — and if the backend hasn't finished ownership transfer yet, those fetches return empty results.

```
Before (broken):
1. setActiveChatId()     → ChatPanel mounts → fetches chat history
2. await claimAPI()      → transfers DB ownership (too late!)
3. setChatResetKey()     → remounts ChatPanel (sometimes works, sometimes doesn't)
```

The fix is conceptually simple but easy to miss: **complete the ownership transfer before triggering the UI update**.

```
After (fixed):
1. await claimAPI()      → transfers DB ownership ✓
2. setActiveChatId()     → ChatPanel mounts → fetches chat history (ownership already transferred)
3. setChatResetKey()     → safety net remount
```

### Why Only the Active PDF Was Affected

Inactive PDFs weren't affected because their ChatPanel never mounts during the transfer. When users click them later, the claim has long completed. Only the **currently-viewed PDF** triggers an immediate mount + fetch, hitting the race window.

## New Learnings

### Bottleneck Analysis Changes the Solution

Initial assumption: "The claim API is slow, we need to make it faster." After measuring with server logs, the actual breakdown revealed three independent bottlenecks:

| Bottleneck | Time | Root Cause |
|-----------|------|------------|
| Upload polling | 0-15s | Waiting for ALL PDFs to get server IDs |
| Sequential processing | ~2s per PDF | `for item in items` loop |
| Storage file move | ~2s per PDF (size-dependent) | Download → upload → delete per file |

Each required a different optimization technique. Without measuring, I might have applied the wrong fix.

### Not Everything Needs to Block the Response

The biggest insight: **Supabase Storage file moves don't need to block the claim API response**. The PDF file already exists in the client's IndexedDB — the viewer displays it locally. Storage moves only matter for cross-device access (opening the same PDF from another browser).

This realization turned a 2-second-per-PDF blocking operation into a zero-cost background task.

### Split What You Await

The "claim split" pattern — process the critical item first, handle the rest in the background — is broadly applicable:

```typescript
// Before: await ALL items, then restore UI
await fetch("/api/claim", { body: JSON.stringify({ items: allItems }) });
restoreUI();

// After: await ONLY the critical item, restore UI, background the rest
await fetch("/api/claim", { body: JSON.stringify({ items: [activeItem] }) });
restoreUI(); // User sees result immediately

// Non-blocking — fire and forget
fetch("/api/claim", { body: JSON.stringify({ items: remainingItems }) });
```

## Practical Examples

### Backend: `asyncio.gather` for Parallel Processing

```python
# Before: sequential — O(n) time
for item in body.items:
    record = await claim_from_guest(user, item.id)
    data = await storage_download(guest_path)
    await storage_upload(user_path, data)
    await storage_delete(guest_path)
    await transfer_conversations(item.id)

# After: parallel — O(1) time (bounded by slowest item)
async def _claim_one(item):
    record = await claim_from_guest(user, item.id)
    bg.add_task(_move_storage, item.id)  # deferred
    await transfer_conversations(item.id)
    return {"id": item.id, "ok": True}

results = await asyncio.gather(*[_claim_one(item) for item in body.items])
```

### Backend: FastAPI `BackgroundTasks` for Deferred Work

```python
@router.post("/claim")
async def claim_guest_pdfs(body: PdfClaimRequest, user: ..., bg: BackgroundTasks):
    async def _move_storage(pdf_id: str):
        data = await storage_download(guest_path)
        await storage_upload(user_path, data)
        await storage_delete(guest_path)

    async def _claim_one(item):
        await pdf_repo.claim_from_guest(user, item.id, GUEST_ID)
        bg.add_task(_move_storage, item.id)  # runs after response
        await conv_repo.transfer_by_pdf(GUEST_ID, user, item.id)
        return {"id": item.id, "ok": True}

    results = await asyncio.gather(*[_claim_one(item) for item in body.items])
    return {"results": list(results)}
```

### Frontend: Scoped Polling

```typescript
// Before: wait for ALL PDFs to have server IDs
const hasPending = guestPdfs.some((m) => !m.pdfServerId);
if (hasPending) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    if (getSessionMeta().every((m) => m.pdfServerId)) break; // ALL must resolve
  }
}

// After: wait only for the ACTIVE PDF
const activePending = guestPdfs.some(
  (m) => m.chatId === activeChatId && !m.pdfServerId
);
if (activePending) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const active = getSessionMeta().find((m) => m.chatId === activeChatId);
    if (active?.pdfServerId) break; // only active must resolve
  }
}
```

## Common Misconceptions

### "React batches state updates, so order doesn't matter"

React does batch synchronous `setState` calls, but `await` breaks the synchronous flow. After an `await`, each `setState` can trigger a separate render cycle. In this case, `setActiveChatId()` after `await claimAPI()` is in a new microtask — React may process it before the next state update, mounting ChatPanel immediately.

### "Moving the file is part of the claim"

The claim operation is really about **ownership transfer** (database records), not file relocation. Conflating the two made the API unnecessarily slow. Separating concerns — "what must happen now" vs "what can happen later" — is the key optimization lever.

### "Parallel API calls are risky"

`asyncio.gather` with independent operations (each PDF's claim is isolated) is safe. The operations don't share mutable state — each works on a different `pdf_id`. The only consideration is concurrent load on external services (Supabase Storage), which is acceptable at this scale.

## References

- FastAPI [BackgroundTasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) — for deferring non-critical work
- Python [`asyncio.gather`](https://docs.python.org/3/library/asyncio-task.html#asyncio.gather) — for concurrent coroutine execution
- React state update batching behavior in async contexts

## Next Steps

- Monitor background storage moves for failure rates in production
- Consider a dedicated message queue (e.g., Celery) if background task volume grows
- Evaluate eliminating storage moves entirely by storing a `storage_path` column in the database (files stay in their original location regardless of owner)
