---
title: "PDF Indexing Pipeline: Unit Detection Guards and Copyright Filtering"
date: 2026-02-27
description: "Hard-won lessons from building a robust PDF chunker for a Korean-German textbook: multiple detection guards, line-level copyright stripping, and RAG behavior verification."
category: learnings
tags: ["pdf-parsing", "rag", "regex", "text-extraction", "pgvector", "indexing", "debugging"]
lang: en
draft: false
---

## Key Concepts

### The Multi-Guard Pattern for PDF Unit Detection

Detecting structural boundaries (chapters, units) in extracted PDF text requires **multiple independent guards**, not a single regex. Each guard blocks a distinct failure mode.

| Guard | What it blocks |
|-------|---------------|
| `LESSON_START_PAGE` | TOC/cover pages that contain standalone numbers matching content patterns |
| `LESSON_END_PAGE` | Appendix / answer-key pages that inflate the last unit with noise |
| `MAX_UNIT_STEP` | Page numbers in footers/headers being misread as unit numbers (large jumps) |
| Character class in regex | Latin text (e.g., "Zusammen A1") matching patterns intended for Korean |

Any one guard alone is insufficient — the failure modes interact.

### Line-Level vs Chunk-Level Filtering

There are two places to apply content filtering in a chunking pipeline:

**Chunk-level** (discard entire chunk if it matches):
- Simple to implement
- Catastrophic when the noise pattern appears on every page (e.g., a watermark)
- 70%+ of content can disappear silently

**Line-level** (strip matching lines, keep the rest):
- Requires iterating over `text.split("\n")`
- Preserves content from pages that have a watermark but also have lesson text
- The correct approach for licensed PDF watermarks

The symptom of chunk-level over-filtering: chunk count drops from expected ~250 to ~60 with no error.

### RAG Behavior: Meta-Questions vs Content Questions

An LLM injected with retrieval context behaves differently depending on question type:

| Question type | Example | Expected behavior |
|---------------|---------|-------------------|
| Content question | "Das ist ein Nudelgericht. 는 true인가요?" | Correctly uses injected chunks |
| Meta question | "PDF 내용을 봐줄 수 있나요?" | Answers "I can't read PDFs" — ignores chunks |

This is not a RAG bug. The model interprets the meta-question as asking about its capabilities (file access), not about the lesson content. The RAG context is injected silently into the system prompt — the model has no awareness that it came from a PDF. Test RAG with **content questions**, not capability questions.

## New Learnings

### Before

- Assumed a well-crafted regex would be sufficient to detect unit boundaries in extracted PDF text
- Thought chunk-level filtering was equivalent to line-level filtering
- Expected that injecting RAG context would make the model "know" it has PDF access

### After

- Unit detection in real-world PDFs requires layered guards. Even a clean PDF will have TOC pages, footers, page numbers, and appendices that all interfere with pattern matching.
- Line-level filtering is always safer than chunk-level when the noise pattern might appear alongside real content
- RAG context injection is invisible to the model's self-model. It cannot distinguish "I have context that came from a PDF" from "I was told this information". Meta-questions about capabilities bypass the context entirely.

## Practical Examples

### Format A: Unit number + wide indent on same line

Matches patterns like: `18                기간을 묻는 의문문`

```python
re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]{10,}\S")
```

### Format B: Unit number alone, title on next line

Matches patterns like:
```
18
                기간을 묻는 의문문
```

```python
re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]*\n[ \t]{15,}[\uAC00-\uD7A3]")
```

Note: `[\uAC00-\uD7A3]` (Korean character class) prevents matching Latin page footers like `"11\nZusammen A1"`.

### MAX_UNIT_STEP guard

Page numbers in PDF footers can match unit detection patterns. A unit jump guard eliminates false positives:

```python
MAX_UNIT_STEP = 5

if detected:
    detected_num = int(detected.split("-")[1])
    valid = (
        detected_num > current_unit_num
        and detected_num <= current_unit_num + MAX_UNIT_STEP
    )
    if valid:
        current_unit_id = detected
        current_unit_num = detected_num
```

Real unit transitions are always `+1`. Page number false positives jump `+10` or more. A step limit of 5 eliminates all false positives with zero false negatives.

### Line-level copyright stripping

```python
SKIP_IF_CONTAINS = [
    "저작권법에 의해 보호",
    "All rights reserved",
    "License Number",
    "Zusammen A1",      # footer watermark
]

# Strip lines BEFORE chunking — not after
text = "\n".join(
    line for line in text.split("\n")
    if not any(phrase in line for phrase in SKIP_IF_CONTAINS)
)
```

### asyncpg pool for Render cold starts

Render's free tier hibernates containers. On cold start, idle connections time out. Settings that prevent `asyncpg.exceptions.TooManyConnectionsError`:

```python
await asyncpg.create_pool(
    dsn=DATABASE_URL,
    min_size=1,
    max_size=5,
    timeout=60.0,                       # was 20s — insufficient for cold start
    max_inactive_connection_lifetime=300,  # recycle idle connections every 5 min
)
```

## Common Misconceptions

### "The chunk count dropped — the filter must be wrong"

Not necessarily. The filter logic can be correct but applied at the wrong granularity. When chunks disappeared in this project, the regex was fine — the issue was checking `SKIP_IF_CONTAINS` against the whole chunk string instead of individual lines.

### "If RAG chunks are injected, the model knows it has PDF access"

The model receives the chunks as part of the system prompt with no provenance metadata. It cannot distinguish injected context from instructions. A question like "can you see the PDF?" is interpreted as a capabilities question, not a content question, so the model answers based on its trained knowledge about its own capabilities.

### "Unit detection just needs a good regex"

A regex that works on 10 test pages will likely fail on edge cases: TOC pages, appendix pages, page footers, and numbering restarts. The production approach needs guards at the page level (start/end page bounds) and at the value level (step size limit), not just pattern level.

## References

- [backend/scripts/index_pdf.py](../../lingua-rag/backend/scripts/index_pdf.py) — Full implementation with all guards
- [backend/app/db/connection.py](../../lingua-rag/backend/app/db/connection.py) — asyncpg pool configuration
- [backend/app/services/claude_service.py](../../lingua-rag/backend/app/services/claude_service.py) — RAG context injection
- Previous learning: [2026-02-25 — RAG Architecture Fundamentals](./2026-02-25-rag-architecture-lingua-rag.md)

## Next Steps

- Add unit detection unit tests: test TOC pages, appendix pages, footer numbers, and normal transitions as separate test cases
- Consider making `LESSON_START_PAGE`, `LESSON_END_PAGE`, `MAX_UNIT_STEP` configurable per textbook in a YAML manifest rather than hardcoded
- Evaluate LLM-as-judge for output format validation (v0.3 plan)
