---
title: "PDF RAG Indexing: Unit Detection and Chunk Noise Filtering"
date: 2026-02-27
description: "How to reliably detect structured unit boundaries in a bilingual PDF and prevent boilerplate text from polluting RAG vector chunks."
category: learnings
tags: ["rag", "pdf-processing", "pdftotext", "regex", "vector-search", "python", "pgvector"]
lang: en
draft: false
---

## Key Concepts

**RAG (Retrieval-Augmented Generation) Indexing Pipeline**
The process of extracting text from a source document, splitting it into semantically meaningful chunks, embedding each chunk as a vector, and storing in a vector database for similarity search. For structured textbooks, "meaningful" means chunk boundaries should align with pedagogical units.

**Unit Detection**
Identifying where a new chapter/lesson begins in a PDF. This is a regex problem when the PDF has a consistent header format (e.g., `18                기간을 묻는 의문문`). Detected unit IDs are carried forward and assigned to all subsequent chunks until the next detection.

**False Positive Unit Detection**
When a regex pattern matches something that is NOT a unit header — e.g., the page footer `10\nZusammen A1` being mistaken for unit A1-10. This corrupts the unit_id assigned to chunks on continuation pages.

**Noise Chunks**
Chunks composed entirely of boilerplate (copyright notices, watermarks, brand footers). These pollute the vector index, degrade search quality, and waste embedding API calls.

---

## New Learnings

### Before: Naive `pattern.search()` on raw page text
```python
# Matched ANYTHING matching the format — including page footers
pattern = re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]{5,}\S")
```
Result: 14 of 56 units detected. Pages like p11 were assigned unit A1-11 (from footer `11\n    Zusammen A1`), meaning all continuation-page content was misclassified.

### After: Three-layer defense
1. **Pattern specificity** — distinguish header formats by whitespace count and required character type
2. **Monotonic step-guard** — reject detections that jump too far forward
3. **Page range guards** — skip TOC pages and appendix pages entirely

### The "Format B" footer problem
Each page in the PDF has a footer like:
```
11
                                                Zusammen A1
```
This matches `(\d{1,2})\n[ \t]{15,}\S` — a two-line pattern meant to catch multi-line unit titles. The fix: require the first character after whitespace on the second line to be a **Korean syllable** `[\uAC00-\uD7A3]`. "Z" from "Zusammen" is Latin, so it fails.

```python
# Format B: Korean-first-char requirement
re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]*\n[ \t]{15,}[\uAC00-\uD7A3]")
```

### Format A doesn't need the Korean constraint
Format A (`number + spaces + char on same line`) is not affected by footers because page numbers in footers stand **alone on their own line** — nothing follows on the same line. So `[ \t]{10,}\S` (same-line spaces) already excludes footers.

Units like A1-35 have Latin-starting titles (`35    W-의문문 만들기`), so requiring Korean in Format A would cause false negatives.

---

## Practical Examples

### Complete unit detection config (index_pdf.py)
```python
LESSON_START_PAGE = 10   # skip cover/TOC
LESSON_END_PAGE   = 178  # skip answer key / listening scripts
MAX_UNIT_STEP     = 5    # max allowed forward jump in unit number

UNIT_HEADER_PATTERNS_KO = [
    # Format A: number + 10+ spaces + any char on same line
    re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]{10,}\S"),
    # Format B: number alone, Korean title on next indented line
    re.compile(r"(?:^|\n)\s{0,6}(\d{1,2})[ \t]*\n[ \t]{15,}[\uAC00-\uD7A3]"),
]
```

### Monotonic step-guard in build_chunks
```python
current_unit_num = 0  # tracks highest accepted unit

detected_num = int(detected.split("-")[1])
valid = (
    detected_num > current_unit_num
    and detected_num <= current_unit_num + MAX_UNIT_STEP
)
if valid:
    current_unit_id = detected
    current_unit_num = detected_num
```
Effect: On page 11 (footer says "11"), `current_unit_num=1`, `11 > 1+5=6` → rejected. ✓

### Boilerplate line stripping before chunking
```python
SKIP_IF_CONTAINS = [
    "저작권법에 의해 보호",   # copyright header (every page top)
    "무단 전재와 복제를 금합니다",
    "License Number",         # per-user watermark
    "Zusammen A1",            # book title in footer
    "독독독 독일어",           # brand name in footer
]

# Applied in build_chunks before chunk_text()
text = "\n".join(
    line for line in text.split("\n")
    if not any(phrase in line for phrase in SKIP_IF_CONTAINS)
)
```

### Diagnostic script to verify detection quality
```python
# Compare detected unit per page against TOC ground truth
expected = {10: "A1-1", 12: "A1-2", 14: "A1-3", ...}  # from TOC
for page, uid in detected.items():
    exp = expected.get(page, "-")
    if exp == "-":
        print(f"p{page}: FALSE POSITIVE → {uid}")
    elif exp != uid:
        print(f"p{page}: WRONG → got {uid}, expected {exp}")
```

---

## Common Misconceptions

**"Requiring a Korean character after the spaces solves all false positives"**
Not quite. Format A (`number + spaces + char on same line`) has no false positives from footers at all — footers have the number alone on its own line. Applying Korean requirement to Format A breaks detection of units with Latin-starting titles like `35    W-의문문 만들기`. Only Format B needs the Korean constraint.

**"Stripping noise chunks is enough"**
`is_noise_chunk()` checks complete chunks against noise phrases, but copyright text usually appears at the TOP of each page and gets merged into the first content chunk of that page. The copyright text is never the sole content of a chunk — it's always mixed with lesson text. You must strip noise LINES from raw page text BEFORE chunking, not AFTER.

**"All 56 units being detected means the index is correct"**
Detecting all 56 unit header positions is necessary but not sufficient. If false positives overwrite the current unit before real content is assigned, continuation pages get wrong unit_ids even though the correct header was also detected on another page. The step-guard ensures monotonic progression.

---

## References

- `backend/scripts/index_pdf.py` — full indexing pipeline
- `backend/app/db/connection.py` — asyncpg pool config (Session Pooler compatible)
- `docs/wireframe-spec-v02.md` — v0.2 3-panel layout wireframe
- pdftotext (`poppler-utils`) — layout-preserving PDF text extraction
- pgvector — PostgreSQL extension for cosine similarity vector search

---

## Next Steps

- Run `python -m scripts.index_pdf --pdf "../resources/Zusammen-A1-*.pdf" --clear` to re-index with corrected pipeline
- Verify re-indexed data: `SELECT unit_id, COUNT(*) FROM document_chunks GROUP BY unit_id ORDER BY unit_id`
- Implement RAG retrieval endpoint (`/api/chat` → `sources[]` field) for v0.2 source panel
- Consider indexing `Hörtext 듣기지문` (listening scripts, p193-203) as a separate textbook_id for dialogue-based queries
