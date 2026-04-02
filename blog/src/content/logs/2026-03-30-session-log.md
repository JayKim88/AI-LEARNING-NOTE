---
title: "2026-03-30 Dev Log"
date: 2026-03-30
description: "LinguaRAG: guest localStorage sync, DB rate limiting, subscription UI, prompt v5.0, TTS fixes, DB refactor, naming cleanup"
tags: ["lingua-rag", "backend", "frontend", "refactor", "ux"]
---

## LinguaRAG

Six sessions today. From top-level: guest session persistence, database-backed rate limiting, subscription UI redesign, tutor prompt upgrade, TTS fixes, backend DB refactor, and a full naming cleanup that touched the whole stack.

---

### Session 1 — Guest PDFs Persist Across Tabs

> Moved guest PDF metadata from `sessionStorage` (per-tab) to `localStorage` (browser-wide), and added IndexedDB age tracking with automatic cleanup.

#### The problem with sessionStorage

`sessionStorage` is isolated per browser tab. That means:

- Open a PDF as a guest in Tab 1
- Open the app in Tab 2
- Tab 2 doesn't know about your PDF

Worse: when you log in, the login page opens in the same tab, clearing the session — potentially losing the guest PDF metadata.

#### The fix

Guest metadata now uses `localStorage` with the same scoping as logged-in users. The key format is `lingua-pdf-library:guest` for guests vs `lingua-pdf-library:{userId}` for logged-in users. This happens automatically because `scopedKey()` returns the `guest` variant when `_userId` is null.

A one-time migration function (`migrateGuestSessionToLocal`) handles existing sessions that used the old `sessionStorage["guest-tab-pdfs"]` key. It merges the data rather than overwriting, in case both storages have entries.

About 6 session-specific functions that only existed to handle the sessionStorage case were deleted. After the change, guest and logged-in metadata flows through the same code path.

#### Multi-tab login race condition

When you log in while having the app open in multiple tabs, both tabs detect the auth state change and both try to "claim" your guest PDFs. This caused corruption — duplicate claims, wrong active PDF selection.

The fix is a `skipClaim` ref. When a tab initializes as guest, it sets `skipClaim = true`. Only the tab that caused the login (full page reload, ref starts `false`) actually runs the claim. Other tabs' auth state change fires as an effect re-run, not a page reload, so their ref is already `true` and they skip claim.

This is simpler than a distributed lock because it leverages a physical property: page reload = ref reset. No coordination needed.

Two more bugs fixed as part of this:

1. **Blob upload race**: the frontend was uploading the PDF blob to cloud storage "fire-and-forget" while immediately requesting a signed URL for it. Sometimes the request arrived before the upload finished. Fixed by awaiting the upload.

2. **Sidebar flash on claim**: after claiming, a `syncWithServer` call was re-fetching the PDF list from the server, which returned a *different sort order* than what was in localStorage, causing a visible jump. Skipped that sync after claim — data was already written correctly.

#### IndexedDB age-based cleanup

Every IDB read now updates a `lastAccessed` timestamp on the entry. When the user adds a new PDF, the app first runs `gcStaleEntries()` — cleaning up entries older than 7 days (guests) or 30 days (logged-in users).

Guests get a shorter window because their IDB is the *only* copy — it's not backed by cloud storage. Logged-in users' PDFs can be re-downloaded from Storage, so a more lenient window is fine.

---

### Session 2 — DB-Backed Rate Limiting & Account UI

> Moved login user rate tracking from in-memory to database, fixed a TOCTOU race condition in translation counting, and redesigned the AccountModal with real usage bars.

#### Why in-memory tracking was a problem

Rate limits for translations and uploads were tracked in Python dictionaries — in memory, on the server. This means:

- Server restart = counter reset
- Multiple server instances = each has its own counter (limits easily bypassed)

The fix: track uploads via `pdf_files WHERE created_at >= CURRENT_DATE` (already exists in DB), and track translations via a new `translation_usage (user_id, date, count)` table (migration 016).

#### The TOCTOU fix for translations

"TOCTOU" = Time of Check, Time of Use. The old code did:

```
1. read count from DB
2. if count < limit: allow
3. write +1 to DB
```

Between steps 2 and 3, two concurrent requests could both read `count = 49`, both pass the check, and both write — resulting in 51 translations when the limit is 50.

The fix: one atomic upsert.

```sql
INSERT INTO translation_usage (user_id, date, count)
VALUES ($1, CURRENT_DATE, 1)
ON CONFLICT (user_id, date) DO UPDATE
  SET count = translation_usage.count + 1
  WHERE translation_usage.count < $2
RETURNING count
```

If the `WHERE` clause prevents the update (count is already at limit), the insert/update returns nothing (`NULL`). The Python code checks: if `NULL` returned, reject with 429. If a number returned, the transaction succeeded and count is valid.

This also fixed a boundary bug — before, the 50th translation was blocked (`>= limit`). Now only the 51st is blocked (increment happens first, check is against the post-increment count).

#### AccountModal redesign

The account modal now shows three `UsageBar` components for messages, translations, and uploads:

- Gray fill for normal usage
- Amber fill when ≥ 80% used
- Shows exact counts and the reset time (midnight UTC)

For Plus users, it shows an "unlimited" grid. Limits like "max pages per PDF" and "max file size" are now fetched from the backend — not hardcoded in the frontend. This means changing a limit in `config.py` automatically updates what the UI shows.

#### SubscriptionModal redesign

Complete visual overhaul. The new design:

- Single-column card layout
- Stat grid showing key numbers (∞ messages / 2K pages / 150MB)
- Feature rows with checkmarks
- Slide-in-from-bottom on mobile, zoom-in-95 on desktop

---

### Session 3 — Billing UI & Portfolio Sprint Planning

> Updated subscription feature lists to match competitive benchmarks, fixed chat route error handling, and planned the 3-day portfolio launch sprint.

#### Feature list updates

The billing page feature lists were updated to match the actual product:

- Login tier now shows 8 features including "N translations per day" and "up to N PDFs total"
- Plus tier now shows unlimited PDF storage at the top (most compelling differentiator)
- Model names (GPT-4.1-nano/mini) removed from feature descriptions — marketing copy shouldn't promise specific internal model names that might change

Login daily message limit reduced from 30 → 20 to match ChatPDF's free tier benchmark.

#### Error handling for backend unavailability

When the backend is down (Koyeb scales to zero after inactivity), `/api/chat` was returning an unhandled 500 with a stack trace. Added a 503 graceful response with a user-friendly message.

#### Sprint planning

Planned the 3-day portfolio launch:
- Day 1: App name + landing page
- Day 2: Prompt quality + CJK tutor testing
- Day 3: Smoke test + deploy

Key pricing decision: keeping ₩9,900/month. Average user costs ~$1.80/month in API fees. Risk: heavy users (150+ messages/day) could run at a loss — soft cap to be added if real users sign up.

---

### Session 4 — Tutor Prompt v5.0 + TTS Fixes + Context Refactor

> Upgraded the AI tutor prompt to v5.0 with adaptive teaching patterns, unified TTS volume/language handling, and removed prop drilling in ChatPanel/MessageList.

#### Prompt v5.0 — what changed

The tutor prompt was rewritten from scratch with several new teaching patterns:

1. **Adaptive level detection** — recognizes CEFR (A1-C2), HSK (1-9), JLPT (N5-N1), TOPIK levels from context and adjusts explanations accordingly. A beginner gets simple grammar tables; an advanced learner gets nuance and edge cases.

2. **Quick Action patterns** — the AI now pro-actively offers numbered follow-up options at the end of responses (e.g., "1) See more examples 2) Compare similar grammar 3) Test yourself"). Learners can just type "1" to continue.

3. **L1-L2 contrastive analysis** — when a learner makes an error, the AI explains *why* it's wrong by comparing the learner's native language pattern to the target language pattern. More pedagogically effective than just correcting.

4. **Active recall prompts** — instead of just explaining, the AI occasionally asks "What do you think this means?" before explaining. Forces the brain to retrieve, which improves retention.

5. **European language pronunciation guide** — added IPA notation support and mouth position descriptions for French/German/Spanish learners.

#### TTS: unified settings

Before this session, different TTS components handled volume and language inconsistently:

- `SelectionPopup` was hardcoded to volume 1.0, speed 0.85
- `PronunciationModal` was using defaults with no user settings at all
- `VocabularyNotebook` only applied speed, ignored user volume

The root cause: no shared way to read TTS settings. Fixed by adding a `getTtsSettings()` helper that reads from `localStorage` directly — no context, no prop drilling. Every component that needs TTS settings calls this one function.

Additionally, a new `SoundSettingsModal` test button was restored with language-specific sample sentences across 10 languages.

#### Frontend refactor: removing prop drilling

`ChatPanel` and `MessageList` were receiving `speak`, `learningLang`, `language`, and `isGuest` as props from `page.tsx`. These were all available in `ChatContext`. Removed the props, added `useChatContext()` calls inside the components.

This reduced `page.tsx` by 5 prop passings and made `ChatPanel`'s API much simpler. The rule: app-specific components that will only ever live inside this app's context can use `useChatContext()` directly. Generic UI components (`SelectionPopup`, `PronunciationModal`) still use props so they stay reusable.

#### PdfMeta.language cache

Language setting fetch was causing a race condition when moved to `page.tsx`. On first render, `learningLang` was `null`, which triggered a language selection modal incorrectly.

Solution: keep language fetch inside `PdfViewer` (where it was), but cache the result in `PdfMeta.language`. Second and subsequent visits to the same PDF use the cached value immediately — no fetch, no delay, no race.

---

### Session 5 — Backend DB Refactor + Translation Bug Fixes + Dead Code Removal

> Split `repositories.py` (1,280 lines, 9 classes) into 4 domain files, extracted shared RAG logic, fixed two translation counting bugs, and deleted ~200 lines of dead code.

#### The repositories.py problem

One file had 9 unrelated classes crammed together:

```
repositories.py (1,280 LOC):
  UserQueries, SubscriptionQueries,
  ConversationQueries, MessageQueries,
  PdfFileQueries, VectorSearchQueries,
  SummaryQueries, NoteQueries,
  AnnotationQueries, VocabularyQueries
```

Split into domain files:

| File | Contents |
|------|----------|
| `user_queries.py` | UserQueries, SubscriptionQueries |
| `chat_queries.py` | ConversationQueries, MessageQueries |
| `pdf_queries.py` | PdfFileQueries, VectorSearchQueries |
| `content_queries.py` | SummaryQueries, NoteQueries, AnnotationQueries, VocabularyQueries |
| `_helpers.py` | `_record_to_dict`, `_is_super` shared utilities |

Backward-compatible aliases kept in `db/__init__.py` so imports across 15 routers didn't all need updating at once.

Classes were also renamed: `*Repository` → `*Queries`. These aren't ORM repositories — they're SQL helper functions. `Queries` is more honest.

#### RAG extraction

`chat.py` and `guest.py` had ~95 lines of near-identical context retrieval logic: embed the query, search vectors, format results, log. The only difference was the log prefix (`"chat"` vs `"guest"`).

Extracted into `rag_service.py` with `retrieve_rag_context(query, pdf_id, log_prefix)` and a `RagResult` dataclass. Both routers now call the same function.

#### Translation rate limit bugs (two separate)

**Bug 1**: After a user hit the daily 50-translation limit, every subsequent request *still incremented the counter*. By end of day, `count` might be 70 or 80 even though only 50 translations were served. The next day's starting count should be 0 but the display showed yesterday's overflow.

Root cause: increment ran before the limit check, and even rejected requests ran the increment.

Fix: `ON CONFLICT DO UPDATE WHERE count < $2` — the upsert only updates if below the limit. Rejected requests don't touch the counter.

**Bug 2**: The 50th translation was being blocked. The check was `>= limit` which blocked at exactly 50. Changed to `> limit` so the 50th goes through and only the 51st is blocked.

#### Dead code removed

- `constants.py` — everything had moved to `config.py`
- `claude_service.py` — model had switched to OpenAI, file was unused
- `frontend/lib/notes.ts` — replaced by a proper API route
- `get_embedding_dimensions()` — unused function
- `cookie_secure` — unused flag

---

### Session 6 — Full Naming Cleanup: Page → Note, notes table → memos

> Resolved naming confusion where "page" meant both PDF physical pages AND folder tree note documents. Renamed components, DB tables, and updated every reference across the full stack.

#### The confusion

The app uses "page" in two completely different contexts:

1. **PDF pages** — the physical numbered pages in a PDF document (page 1, page 2...)
2. **Folder tree nodes** — note documents inside folders in the sidebar tree

Using "page" for both was confusing. If someone said "go to page 3," it could mean either one. The tree documents aren't pages — they're notes. So: **rename tree nodes from "page" → "note".**

Similarly, the component `NoteSlidePanel` (the memo/vocabulary panel) had "Note" in its name, but notes are now the tree documents. The panel is just a utility panel. Renamed to `SlidePanel`.

#### What changed, in each layer

**TypeScript types:**
```typescript
// Before
type NodeType = "folder" | "page"
// After
type NodeType = "folder" | "note"
```

**Component files:**
- `PageViewer.tsx` → `NoteViewer.tsx`
- `NoteSlidePanel.tsx` → `SlidePanel.tsx` (also `NoteSlideProps` → `SlidePanelProps`)

**All usages updated:**
- `useTreeManager.ts` — 5 places where `type === "page"` was checked, default node name "새 페이지" → "새 노트"
- `SidebarTree.tsx` — `onAddNode(id, "page")` → `"note"`
- `SaveToPageModal.tsx` — filter for `n.type === "page"` → `"note"`
- `SummarySaveModal.tsx` — internal `Tab = "memo" | "note"` (was `"note" | "page"`)
- `ShellLayout.tsx` — dynamic import updated to `NoteViewer`
- `PdfViewer.tsx` — import and JSX updated to `SlidePanel`

**Backend:**
- `tree.py` — `node.get("type") == "note"` (was `"page"`)

**i18n (10 language files):**
- `tree.addPage` → `tree.addNote`
- `editor.pageName` → `editor.noteName`
- `save.title` "Save to Page" → "Save to Note"
- `note.tab.note` value "Notes" → "Memo"
- `save.tab.note` value "현재 페이지 노트" → "현재 페이지 메모"
- And 6 more keys updated across en.ts / ko.ts

#### The `notes` table → `memos` rename

The `notes` DB table stores memo-style entries saved from AI responses (via the SlidePanel). But internally, the codebase already used "memo" everywhere:

- Config: `LOGIN_MAX_MEMOS_PER_PDF`
- Error codes: `MEMO_LIMIT_REACHED`
- API error messages: "Memo limit reached"

Only the table name said `notes`. Renamed to `memos` for consistency.

Migration:
```sql
ALTER TABLE notes RENAME TO memos;
```

This affected 5 Python files (content_queries, pdf_queries, account.py, main.py, and the router renamed from notes.py to memos.py). No frontend changes needed — the frontend only talks to API routes.

#### DB migration: fixing JSONB data

The sidebar tree is stored as a JSONB blob in `sidebar_tree.tree_json`. The tree node type lives *inside* the JSON, not as a column — so `UPDATE ... SET type = 'note'` doesn't work.

Migration 017 used `jsonb_array_elements` + `jsonb_set` to iterate and patch:

```sql
UPDATE sidebar_tree
SET tree_json = (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN elem->>'type' = 'page'
    THEN jsonb_set(elem, '{type}', '"note"')
    ELSE elem END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(tree_json) AS elem
)
WHERE tree_json @> '[{"type": "page"}]'::jsonb;
```

The `WHERE` clause initially missed some rows. Re-run without the WHERE clause (process all rows unconditionally) to fully clean up. The `CASE` handles it safely — non-"page" nodes pass through unchanged.

#### TypeScript: zero errors after changes

Ran `npx tsc --noEmit` after all changes. 0 errors. The type system caught several places where the old string literals (`"page"`) needed updating — which is exactly what you want from TypeScript.

---

### What's next

- [ ] Run migration 018 on Supabase (`ALTER TABLE notes RENAME TO memos`)
- [ ] Full smoke test: folder note creation/open/save, SlidePanel memo/vocab, AI response save
- [ ] App name decision + codebase-wide update
- [ ] Landing page overhaul (images, copy, production quality)
- [ ] Secret key rotation + git history security audit
