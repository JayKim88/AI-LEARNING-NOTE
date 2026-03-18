---
title: "2026-03-10 Session Log"
date: 2026-03-10
description: "LinguaRAG: PDF viewer UX fixes, client-side page text extraction via forwardRef, trigger-based page context injection"
tags: ["lingua-rag"]
---

## PDF Viewer UX & Page Text Extraction

> Replaced image-based page context with trigger-based text extraction — cheaper, faster, and more reliable

### What I Did

- **Scroll animation fix** — changed `scrollIntoView({ behavior: "smooth" })` to `"instant"` to prevent janky animation when switching pages. Reduced `ignoreScrollRef` timeout to 100ms
- **Floating toolbar fix** — the bottom toolbar was scrolling away with content. Restructured the DOM: moved toolbar and search panel JSX outside the scrollable `div` (as siblings of `scrollRef`, children of `containerRef`)
- **`PdfViewerHandle` with `forwardRef`** — exposed `getPageText()` (using pdf.js `getTextContent()`) and `hasFile()` via imperative ref, so the parent component can extract page text on demand without owning pdf.js state
- **Removed auto canvas capture** — deleted the old `onRenderSuccess` → `canvas.toDataURL()` → `onPageImageChange` pipeline that captured a base64 image on every page render. Replaced with a lightweight `onPageChange(pageNumber)` callback
- **Backend text endpoint** — `GET /api/pdfs/{pdf_id}/page/{page_num}/text` using PyMuPDF `get_text()` (ready for when server-stored PDFs are needed)
- **Page text injection** — `useChat` detects "이 페이지" regex in user messages → calls `getPageText()` → sends as `page_text` in the POST body. Backend injects the text before the user message in Claude's context
- **Context indicator** — InputBar shows "PDF 연결됨" with a tooltip explaining that mentioning "이 페이지" activates page context

### Key Decisions

- **Client-side extraction over server round-trip** — PdfViewer already has the pdf.js document loaded in memory via `pdfDocRef`. Using `getTextContent()` client-side avoids a network request and works with locally-stored PDFs
- **Trigger-based over auto-send** — sending page images on every page turn was expensive (vision tokens per render). The "이 페이지" trigger costs nothing until the user explicitly references the page
- **`forwardRef` + `useImperativeHandle`** — correct React pattern for imperative access to child component internals without lifting pdf.js state up to the parent
