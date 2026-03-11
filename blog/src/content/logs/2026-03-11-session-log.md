---
title: "2026-03-11 Session Log"
date: 2026-03-11
description: "LinguaRAG Phase 1 pivot: German-only tutor → universal PDF-based language learning service"
tags: ["lingua-rag"]
---

## lingua-rag

> Phase 1 pivot completed — removed all German-specific code and converted from unit-based to PDF-based universal language tutor architecture. Also polished PDF viewer UX (annotations, language selection, sticky notes) earlier in the day.

### What I Did

**The Big Picture: Why This Pivot?**

LinguaRAG started as a German-only AI tutor tied to a specific textbook ("DokDokDok A1"). The curriculum data — 56 units, vocabulary lists, level configs — was all hardcoded. This made the product impossible to expand to other languages or user-provided materials.

The pivot transforms it into a universal service: users upload any language textbook as a PDF, and the AI tutor works with that content via RAG. No hardcoded curriculum. Any language.

**Backend: Gutting the German-Specific Code**

- Rewrote `prompts.py` from scratch — removed `TUTOR_ROLE`, `LEVEL_CONFIG`, `UNIT_SUMMARY_TABLE`, and `_build_constraints()`. Replaced with a universal `build_system_prompt(language, learner_language, rag_chunks)` that works for any language. Kept the prompt caching split (fixed prefix for role/rules + dynamic suffix for RAG chunks).

- Deleted `units.py` entirely — 1,000+ lines of hardcoded German curriculum data gone (`DOKDOKDOK_A1`, `BAND_1~8`, 56 units).

- Updated every model and repository to use `pdf_id` instead of `unit_id/textbook_id/level`:
  - `ChatRequest`: removed `unit_id`, `level`, `textbook_id` → added `pdf_id`
  - `ConversationRepository.get_or_create()`: key changed from `(user, unit_id)` to `(user, pdf_id)`
  - `VectorSearchRepository.search()`: `textbook_id` filter → `pdf_id` filter
  - Removed `search_vocabulary()` entirely (was WORTLISTE-A1 specific)
  - All summary/note repos and routers switched to `pdf_id/pdf_name`

- Flipped `RAG_ENABLED` default from `False` to `True` — RAG is now the product's core, not an optional add-on.

- Rewrote `test_prompts.py` — 16 tests covering tutor role parametrization, answer format, constraints, RAG chunk injection, and prompt caching split. All pass.

**Database Migration**

Created `001_unit_to_pdf.sql` migration that:
1. Added `pdf_id`/`pdf_name` columns to `conversations`, `summaries`, `notes`, `document_chunks`
2. Migrated existing data (`pdf_id = unit_id` for backward compatibility)
3. Dropped old columns (`unit_id`, `textbook_id`, `level`, `unit_title`)

Hit a `NotNullViolationError` after the initial migration — the old `unit_id` column still had `NOT NULL` constraint, so new INSERTs (which only provide `pdf_id`) failed. Fixed by adding `ALTER COLUMN ... DROP NOT NULL` before the DROP statements.

**Frontend: From Unit Selector to PDF-First**

- Removed `UNITS` array from `types.ts` (56 hardcoded units)
- Deleted `setup/page.tsx` (the old unit selector page)
- Simplified landing page to redirect straight to `/chat`
- Removed all level/unit state from `chat/page.tsx` — no more `"A1" | "A2"` type, no `textbookId` derivation, no `useSearchParams`
- `ChatPanel` props simplified: `unitId/level/textbookId` → `pdfId/pdfName`
- `useChat` hook: sends `pdf_id` to API, `SUMMARY_PROMPT` made language-agnostic
- API routes and lib functions (`summaries.ts`, `notes.ts`) all switched to `pdf_id`

**Documentation**

- Full README.md rewrite — new features section, architecture diagrams with `pdf_id`, complete DB schema (including `pdf_files`, `pdf_annotations`, `summaries`, `notes`), updated API endpoint table, revised design decisions
- Updated `todo.md` — Phase 1 fully checked off, Phase 3 (prompt + UX) marked complete (was done as part of Phase 1)

**Earlier Sessions (Same Day)**

Before the pivot work, I also:
- Fixed language selection UX — new PDFs no longer inherit a default language; amber "언어 선택" prompt shown instead
- Redesigned sticky notes to Windows Sticky Notes style (colored header bar, pastel body, color swatches)
- Built chat message action bars (Copy/👍/👎/Retry/Edit) with inline editing
- Added message retry with DB truncation (`DELETE /api/messages/{id}/truncate`)
- Implemented multi-page PDF scrolling with windowed rendering (±3 pages)
- Added per-PDF language and last-page persistence to Supabase
- Migrated PDF storage from local filesystem to Supabase Storage
- Built PDF annotation system (sticky memos with drag, edit, color, DB persistence)

### Key Decisions

- **Add-then-drop migration strategy** over column rename — avoids implicit dependencies and lets both old and new code coexist during the transition window
- **Old conversation data orphaned by design** — old `unit_id` values ("A1-1") don't match new PDF UUIDs, so old conversations naturally disappear. Acceptable for a pivot.
- **Scripts cleanup deferred** — `evaluate.py` and `index_wortliste.py` still have German references but don't affect the running app. Will be handled in Phase 2/4.
- **RAG is core, not optional** — `RAG_ENABLED` default flipped to `True` because in the PDF-based architecture, RAG is the only way the AI knows about the user's textbook content.

### What's Next

- [ ] Phase 2: `POST /api/pdfs/{id}/index` — automatic PDF text extraction → chunking → embedding → `document_chunks` storage on upload
- [ ] Phase 2: `pdf_files.index_status` column for tracking indexing progress (`pending → indexing → ready → failed`)
- [ ] Phase 2: Indexing status UI in PDF sidebar
- [ ] Phase 2: Chunking strategy (page-based with paragraph split for long pages)
