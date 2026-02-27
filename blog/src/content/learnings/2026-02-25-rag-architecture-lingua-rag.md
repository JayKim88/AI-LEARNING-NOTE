---
title: "RAG Architecture Fundamentals — pgvector, FastAPI, SSE Streaming, and Embedding Models"
date: 2026-02-25
description: "Core RAG concepts understood while planning LinguaRAG: offline/online phase separation, SSE streaming mechanics, prompt assembly, and the role of pgvector."
category: learnings
tags: ["rag", "fastapi", "sse-streaming", "pgvector", "embedding", "claude-api", "llm"]
lang: en
draft: false
---

## Key Concepts

### RAG's Two Phases: Offline vs Online

The core idea of RAG (Retrieval-Augmented Generation) is **"heavy work once, question answering lightweight"**.

**Offline phase** (runs once on PDF upload):
```
PDF upload
  → text extraction (pdfplumber)
  → chunk splitting (500-800 tokens)
  → embedding generation (text → numeric vector)
  → pgvector storage
⏱ ~30-60s, ~$0.05 (one-time cost)
```

**Online phase** (runs on every user question):
```
User question
  → question embedding
  → pgvector similarity search (Top-K=3 chunks)
  → prompt assembly (system prompt + chunks + history + question)
  → Claude API streaming call
  → return answer
⏱ first token < 2s, ~$0.01-0.03/question
```

### Embeddings

Converting text into numeric vectors. Text with similar meaning produces vectors that are numerically close.

```
"약속을 잡을 때 뭐라고 해요?" → [0.12, -0.87, 0.34, ...]
"Wann passt es dir?"         → [0.11, -0.85, 0.36, ...]
                                  ↑ numbers are close = semantically similar
```

- **Claude/GPT**: text → text (understands and generates)
- **Embedding model**: text → numeric vector (only quantifies meaning, no generation) → much cheaper

### pgvector

A PostgreSQL extension. A single `CREATE EXTENSION vector;` turns an existing PostgreSQL instance into a vector similarity search database.

```sql
-- similarity search (cosine similarity)
SELECT content FROM chunks
WHERE unit_id = 'A1-13'
ORDER BY embedding <=> $1  -- $1 = question vector
LIMIT 3;
```

No need for dedicated vector DB services (Pinecone, Weaviate) — works directly on existing PostgreSQL.

### SSE (Server-Sent Events) Streaming

A technology for the server to push data to the client in real time, unidirectionally. This is how ChatGPT delivers answers as if typing.

```
[Regular HTTP]: server completes the full response, then delivers all at once
[SSE]:          delivers token by token in real time → first token < 2s

Raw data sent by the server:
data: {"type": "token", "content": "Akkusativ"}
data: {"type": "token", "content": "는"}
...
data: [DONE]
```

Why SSE instead of WebSocket: LLM responses flow in one direction — server to client — so SSE is sufficient. Implementation is simpler and reconnection is automatic.

### Prompt Assembly

The server-side task of combining multiple pieces into the message sent to Claude.

```python
client.messages.create(
    system=system_prompt,    # ① role + level + unit context (built on the server)
    messages=[
        *history,            # ② last 10 messages fetched from DB
        {"role": "user",
         "content": "What is Akkusativ?"}  # ③ user input
    ]
)
```

Why assembly happens on the server (FastAPI): prevents API key exposure, enables DB access, and keeps the system prompt hidden from clients.

### Why FastAPI

- Native `async/await` → pairs naturally with Claude API streaming
- `StreamingResponse` → SSE implementation feels natural
- Type hints → automatic OpenAPI docs generation (`/docs`)

---

## New Learnings

### The Vector DB Sits Inside the Server

It's easy to assume "the vector DB is a separate external service," but with pgvector, your existing PostgreSQL becomes the vector DB. No separate server or service needed.

### PDF Upload ≠ Loading Everything at Once

- **Index perspective**: the full content is stored in the vector DB (available for retrieval)
- **Query perspective**: only the relevant Top-K chunks are sent to Claude per question (not the entire document)

This is due to Claude's context window limit. Feeding all of A1 (56 units) at once would mean millions of tokens — not feasible.

### No Embedding Model Needed in v0.1

Embeddings and pgvector are only required at v0.2 (when PDF RAG is introduced). v0.1 runs purely on system prompt-based logic. No need to choose an embedding model yet.

### The Embedding Model Doesn't Have to Be OpenAI

For a German learning app, a multilingual-specialized model may be a better fit:
- Voyage AI `voyage-multilingual-2` (Anthropic-invested, multilingual-specialized)
- Cohere `embed-multilingual-v3.0` (supports 100 languages)
- HuggingFace `multilingual-e5-large` (free)

German retrieval quality matters more than cost. The total chunk count for all of A1 is ~1,000 — any option will cost only a few cents.

---

## Practical Examples

### FastAPI SSE Streaming — Core Code

```python
# FastAPI server
from fastapi.responses import StreamingResponse
from anthropic import Anthropic

client = Anthropic()

@app.post("/api/chat")
async def chat(request: ChatRequest):
    async def generate():
        with client.messages.stream(
            model="claude-sonnet-4-6",
            system=build_system_prompt(request.level, request.unit_id),
            messages=[*history, {"role": "user", "content": request.message}]
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

```typescript
// Next.js client
const response = await fetch('/api/chat', { method: 'POST', body: ... })
const reader = response.body!.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // parse token → append to UI
}
```

### pgvector Similarity Search

```sql
-- install
CREATE EXTENSION IF NOT EXISTS vector;

-- table (1536-dimension vector)
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    unit_id VARCHAR(10),
    content TEXT,
    embedding vector(1536)
);

-- similarity search (with unit_id filter)
SELECT content, embedding <=> $1 AS distance
FROM chunks
WHERE unit_id = 'A1-13'
ORDER BY distance
LIMIT 3;
```

### Error Handling: Exponential Backoff

```python
async def call_claude_with_retry(messages, system_prompt, max_retries=3):
    delays = [1, 2, 4]  # 1s → 2s → 4s

    for attempt in range(max_retries):
        try:
            return client.messages.stream(...)
        except (APITimeoutError, RateLimitError) as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(delays[attempt])
```

---

## Common Misconceptions

### "RAG = sending the entire PDF to Claude"

Wrong. RAG uses vector search to extract only the relevant chunks and sends those. Sending the full PDF every time is neither cost-effective nor feasible in terms of speed.

### "A vector DB requires a separate service"

With pgvector, your existing PostgreSQL becomes the vector DB. A dedicated service like Pinecone is unnecessary for small-scale use.

### "Embedding model = LLM"

An embedding model does not generate text. It only converts text into numeric vectors. It is much faster and cheaper.

---

## References

- [F1 Spec Document](projects/lingua-rag/docs/f1-streaming-qa-spec.md)
- [Product Brief](projects/lingua-rag/product-brief-lingua-rag-v01-20260225.md)
- [ADR Technical Decisions](projects/lingua-rag/docs/decisions.md)
- [Anthropic Streaming Docs](https://docs.anthropic.com/en/api/messages-streaming)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

---

## Next Steps

- [ ] Implement F1: FastAPI + Claude Streaming prototype (Week 1)
- [ ] Test prompt quality for 10 sample questions via `build_system_prompt()`
- [ ] A/B test embedding models at v0.2 (OpenAI vs Voyage AI)
- [ ] Set up pgvector in local Docker environment and experiment with similarity search
