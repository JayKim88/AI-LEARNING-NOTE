---
title: "2026-03-20 Session Log"
date: 2026-03-20
description: "LinguaRAG RAG optimization: cross-language BM25 fix, query routing, prompt caching, chunk size reduction, 58% token cost savings"
tags: ["lingua-rag"]
---

## LinguaRAG — RAG Pipeline Optimization

> Major RAG pipeline overhaul: fixed cross-language search, added query routing, activated prompt caching, reduced chunk sizes, and cut input token costs by 58%.

### What I Did

**Cross-language search fix (BM25 AND → OR)**

The hybrid search was returning zero results for cross-language queries — for example, asking a Korean question about German textbook content. The root cause: `plainto_tsquery` uses AND logic, requiring all tokens to match. Korean tokens simply don't exist in German text chunks. Switched to `to_tsquery` with OR logic so partial matches work across languages.

**Query routing**

Added a `_detect_mode()` classifier that routes queries into two paths:
- **Keyword mode** ("find this text") — BM25-primary search with vector supplement
- **Semantic mode** ("explain this concept") — standard hybrid search

Supports multilingual trigger patterns across Korean, English, German, Chinese, Japanese, French, Spanish, and Portuguese. This is intentionally temporary — once chunking quality improves, a single hybrid search should handle both cases.

**Page-number direct lookup**

Users often ask "what's on page 5?" — now detected via regex and served directly from `get_chunks_by_page()` without running full search. Supports patterns like `p.12`, `Page 30`, `페이지`, `Seite`, `第N页`.

**Prompt caching activation**

Split the system prompt into 3 blocks: fixed prefix (cacheable) + document summary + RAG chunks. Applied `cache_control` with 1-hour TTL on the summary block. Sonnet 4.6 requires ≥2048 tokens for caching to activate.

Language learning sessions typically run 30+ minutes on the same PDF, so the 1-hour TTL provides good cache hit rates despite the 2x write cost.

**Chunk size reduction (3000 → 800 chars)**

Reduced `MAX_CHUNK_CHARS` from 3000 to 800 with 100-char overlap. This had a dramatic impact — for one German A2 textbook, chunks went from 248 to 443, but average input tokens per request dropped from 7312 to 3045 (58% reduction). Also discovered that PyMuPDF extracts text with single newlines for many PDFs, so added `\n` as a fallback split character when `\n\n` produces only one segment.

**Document summary auto-generation**

Created `summary_service.py` that uses Haiku to generate structured summaries (overview, structure, topics, difficulty level) after indexing completes. Stored in `pdf_files.summary` column for use in the cacheable prompt prefix.

**Frontend cleanup**

Removed the `pageMode` toggle entirely — the backend now handles page-aware search automatically. Cleaned up `getPageText` dead code across `useChat.ts`, `ChatPanel.tsx`, and `page.tsx`.

### Key Decisions

| Decision | Reasoning |
|----------|-----------|
| BM25 OR over AND | Cross-language queries fail with AND because token sets don't overlap between languages |
| Query routing is temporary | Regex-based routing is a stopgap; proper chunking should make single hybrid search sufficient |
| Haiku for indexing, Sonnet for chat | Cost optimization: Haiku ($1/M) for batch tasks, Sonnet ($3/M) for user-facing responses |
| 1-hour cache TTL | Sessions last 30+ min; 1h TTL amortizes the 2x write cost better than the default 5-min TTL |
| `max_distance` 0.7 → 0.75 | Temporary loosening; cross-language queries had relevant chunks filtered at the old threshold |

### Next

- [ ] Contextual prepend — Haiku adds 2-sentence context to each chunk at indexing time
- [ ] Remove `_detect_mode` routing → single hybrid search with vector 1.0 : BM25 0.25
- [ ] Reranking with Haiku (10 → 3 chunks)
- [ ] Greeting redesign with pre-generated summary
- [ ] Flashcard batch generation with Haiku
