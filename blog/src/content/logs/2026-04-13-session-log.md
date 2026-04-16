---
title: "2026-04-13 Dev Log"
date: 2026-04-13
description: "RAG page_only mode for quick actions, mobile sidebar UX, prompt quality analysis, full docs audit across EN/KO/portfolio"
tags: ["nativ", "rag", "ux", "docs", "prompt"]
---

## nativ — RAG, UX, Docs Audit

> RAG page_only mode for quick actions, sidebar UX (right-slide panel + folder/note name modal), prompt quality analysis, full docs audit (EN+KO+portfolio) to sync with codebase

### What I did

**RAG: page_only mode for quick actions**

- Quick action buttons (Summarize, Key Phrases, Explain Simply, Practice Quiz) were pulling in chunks from unrelated pages via vector search. These buttons are explicitly about "this page," so vector search doesn't make sense here.
- Added a `page_only` flag that flows from frontend → backend → `rag_service.py`. When `page_only=true`, only the current page's chunks are fetched — no embedding, no vector search.
- New `_page_only_rag()` function in `rag_service.py`, `page_only` field added to both `ChatRequest` and `GuestChatRequest` schemas.

**UX: Mobile sidebar and folder/note creation**

- Mobile sidebar now slides in from the **right** instead of the left. Added a panel icon to the right side of the mobile header. This follows the common mobile pattern where primary content is left, secondary tools are right.
- "Add folder" and "Add note" from the context menu now open a name input modal instead of instantly creating with a default name like "새 폴더". Extended `NewFolderModal` with a `type` prop to handle both folder and note variants.
- Added `modal.newNote.title` and `modal.newNote.namePlaceholder` i18n keys across all 10 languages.

**Prompt quality analysis**

- Evaluated the current chat prompt (v5.0) against 5 language education theories: Comprehensible Input, Output Hypothesis, Noticing Hypothesis, Interactionist Approach, Spaced Repetition.
- Main finding: the prompt declares good teaching behaviors but lacks triggers that force the AI to actually do them. Production prompts, level re-adaptation, and within-session reinforcement are the highest-impact improvements.
- Created a prioritized improvement plan (P1–P8) in `todo.md` — deferred to a future session because changes need A/B testing.

**Full documentation audit**

- Audited all 18 EN docs + 18 KO docs + 11 portfolio docs against the actual codebase. Fixed every mismatch:
  - `max_size` 5→15, tests 163→165, PdfViewer 1,695→1,844 LOC, cost savings 91%→94%
  - "GPT-4.1" → "GPT-4.1-nano/mini" everywhere (plain GPT-4.1 is not a model we use)
  - Highlight window ±3→±1 (matches actual `Math.abs(n - pageNumber) <= 1`)
  - CI pipeline diagram fixed — backend and frontend are independent chains, not gated
  - `transfer_by_pdf` 1.5s retry → `claim_from_guest` atomic transaction (function never existed)
  - PaddleOCR migration plan removed (not planned), pronunciation "badge" → celebration screen
  - Eval judge model: GPT-4.1-mini → Claude Sonnet (cross-model evaluation to avoid self-preference bias)
- Dockerfile updated: `python:3.11-slim` → `python:3.13-slim` to match local and CI environments.

### Key decisions

- **`page_only` over `skipVectorSearch`**: Cleaner semantics — "this is about the current page" is the intent, not "don't do vector search." The flag name communicates purpose, not implementation.
- **No deploy gate (CI = quality gate only)**: Solo project pushes directly to main. Adding PR-based branch protection would slow iteration without meaningful risk reduction. CI catches issues post-deploy; rollback is `git revert` + push.
- **Prompt improvements deferred**: The current prompt works. Improvements (production prompts, level adaptation) need evaluation infrastructure — rushing them in would risk regression.

### Next

- [ ] Fix greeting bug — `serverPdfId` timing race on page refresh
- [ ] Live mode switch — LS live API key + webhook to production
- [ ] Prompt quality improvements (P1–P8)
- [ ] Portfolio guest-to-login.md restructure — reduce duplication, simplify 5-layer framing
