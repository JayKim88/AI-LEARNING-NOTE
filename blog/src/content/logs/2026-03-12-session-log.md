---
title: "2026-03-12 Session Log"
date: 2026-03-12
description: "lingua-rag: Phase 4-5 infrastructure (Hybrid Search, CI/CD, Eval, Stats) + PDF management bug fix marathon"
tags: ["lingua-rag"]
---

## lingua-rag

> Two back-to-back sessions — first built out the Phase 4-5 infrastructure (Hybrid Search, CI/CD, eval framework, stats API), then went on a bug fix marathon for PDF management UX.

### What I Did

**Session 1: Phase 4-5 Infrastructure**

**Hybrid Search with Reciprocal Rank Fusion**

The vector-only search had a blind spot: it understood semantic meaning but missed exact keyword matches (important when learners search for specific vocabulary). Built a hybrid approach:

- Added a `tsv tsvector` column with GIN index to `document_chunks` (migration `004_hybrid_search.sql`)
- During indexing, `to_tsvector('simple', content)` populates the column — using the `'simple'` tokenizer (language-agnostic whitespace splitting) because the service handles PDFs in any language
- Search query in `repositories.py` runs both pgvector cosine similarity AND PostgreSQL full-text search in a single SQL with 3 CTEs, then merges results using Reciprocal Rank Fusion (RRF, k=60). Falls back gracefully to vector-only if tsvector column is empty

**LLM-as-Judge Eval Framework**

- Built `scripts/evaluate.py` — sends test questions to the API, then has Claude grade the responses against 8 rules (5 content + 3 format) plus a RAG keyword recall metric
- Created a 12-question multilingual test set (`test_questions.json`): DE×5, EN×2, JA×2, ZH×1, FR×1, ES×1 — with `expected_in_response` ground truth keywords for RAG recall scoring
- Added `eval.yml` GitHub Actions workflow (manual trigger via `workflow_dispatch`) that runs the eval and uploads results as artifacts

**CI/CD Pipeline**

- `ci.yml` runs on PR/push: backend lint (ruff) + pytest + frontend lint + typecheck + build
- Added `pyproject.toml` with ruff config (line-length 120, E/F/W/I rules); reformatted 9 backend files

**Stats API + Observability**

- `GET /api/stats` endpoint — token usage tracking, RAG hit rate, cost estimates (Claude output at $15/M tokens + OpenAI embedding at $0.02/M tokens × 750 tokens/chunk), 14-day daily usage chart data, per-PDF breakdown (top 10)

**Language Auto-Detection**

- `language_detect.py` — pure stdlib implementation (no external dependencies) using Unicode script analysis (detects hiragana/katakana for Japanese, CJK for Chinese) plus function-word frequency matching for 6 Latin-script languages
- Auto-sets `pdf_files.language` during indexing if the user hasn't manually selected one

**Embedding Model Analysis**

- Wrote `docs/embedding-comparison.md` comparing `text-embedding-3-small` vs alternatives (E5-large, multilingual-e5, etc.)
- Built `scripts/compare_embeddings.py` benchmark (Hit@K, MRR, cosine separation)
- Decision: **keep `text-embedding-3-small`** — costs <$1/mo vs $50+/mo for self-hosted E5. Hybrid Search already compensates for the multilingual accuracy gap. Migration would require DB schema changes + full re-index of all PDFs.

---

**Session 2: PDF Management Bug Fix Marathon**

After shipping the infrastructure, spent a session squashing UX bugs that had accumulated:

**Polling & State Sync**

- **Polling restart bug** — after uploading a PDF, the indexing status polling wouldn't start. Root cause: `useRef` + `[]` deps pattern meant the polling check ran with stale state. Replaced with a derived `pollingNeeded` state that triggers polling reactively
- **New PDF not appearing during active polling** — the polling callback only updated existing entries' status. Added `getLibraryMeta()` re-read so newly uploaded PDFs appear in the sidebar without waiting for polling to finish
- **Modal upload not reflecting in sidebar** — the modal upload path was missing a `setPdfLibrary()` call after successful upload

**Key & Identity Fixes**

- **React duplicate key error** — sidebar and modal both used `key={meta.name}`, which breaks when two PDFs have the same filename. Changed to `key={meta.chatId ?? meta.name}`
- **Same-filename PDFs showing wrong selection highlight** — sidebar was comparing `activePdfName` (filename string). Switched to `activeChatId` (unique identifier) for correct highlighting

**Delete & Upload Edge Cases**

- **Deleting active PDF left blank screen** — added auto-selection of the first remaining PDF after deletion
- **PDF deletion left orphan data in DB** — `pdf_repo.delete()` now runs a transaction that cascades through `document_chunks`, `summaries`, `notes`, and `conversations`
- **Large PDF upload failing (10MB limit)** — Next.js middleware was applying the body size limit to API routes. Fixed by excluding `api/` paths from the middleware matcher

**Search & Embedding Resilience**

- **Search results clicking closed the dropdown** — changed to only navigate the page, keeping the search modal open (closes on mouseLeave instead)
- **Search term highlighting** — added `customTextRenderer` that wraps matching text in yellow `<mark>` tags
- **Embedding API 500 errors** — added exponential backoff retry (3 attempts) to `embed_batch`. Also added batch-level skip: if one batch permanently fails, the rest of the chunks still get indexed

**Other**

- **Page refresh flicker** — the landing page briefly showed before the chat UI loaded. Added a loading spinner gate on the `initialized` flag

### Issues

- One specific PDF (`_OceanofPDF.com_Hands-On_Large_Language_Models_-_Jay_Alammar.pdf`) consistently triggers OpenAI 500 errors during embedding. The retry + batch skip mechanism handles it gracefully (partial indexing works), but the root cause is unknown — possibly corrupted text extraction or oversized tokens in certain chunks.

### Key Decisions

- **`'simple'` tokenizer for tsvector** — language-specific tokenizers (e.g., `'german'`) would require knowing the language at index time and wouldn't work for multilingual PDFs. `'simple'` does whitespace splitting universally.
- **RRF in SQL, not application code** — single query with CTEs + FULL OUTER JOIN is faster than fetching two result sets and merging in Python. Candidate pool set to `limit × 5` for better fusion quality.
- **Keep `text-embedding-3-small`** — the cost-performance tradeoff doesn't justify switching. Hybrid Search compensates for multilingual accuracy. Re-indexing all existing PDFs would be painful.
- **Pure stdlib language detection** — `langdetect` and `fasttext` add deployment complexity for marginal accuracy gains on single-language textbook PDFs.

### What's Next

- [ ] Investigate OpenAI 500 errors — log the actual text content of failed embedding batches to identify problematic chunks
- [ ] Refactor `activePdfName` → `activeChatId` throughout the codebase (currently only sidebar)
- [ ] Phase 4: user acquisition (10-20 users)
- [ ] Run eval benchmark and record scores for portfolio
- [ ] Portfolio documentation: architecture diagram, ADR records, quantitative results
