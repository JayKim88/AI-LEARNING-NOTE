---
title: "LLM Fundamentals: Parameters, Embeddings, and Attention"
date: 2026-03-02
description: "How LLM parameters encode meaning, what embedding dimensions actually represent, and why Transformer attention is computed in parallel."
category: learnings
tags: ["llm", "embeddings", "attention", "transformer", "rag", "pgvector", "ai-engineering"]
lang: en
draft: false
---

## Key Concepts

### Parameters

A **parameter** is a single floating-point number — e.g., `0.73` or `-2.14`. An LLM with 13 billion parameters (Llama-13B) contains exactly 13 billion such numbers, organized into weight matrices.

Parameters are **not** weights per individual word. They encode distributed patterns across the entire training corpus. A single concept like "Paris = capital of France" is spread across thousands of parameters that collectively represent that relationship.

### Embeddings (Vectors)

When text is passed through an embedding model, the output is a vector — an ordered list of floats like `[0.79, 0.28, -0.15, ...]`.

Critical distinction: **individual dimensions of an embedding vector have no interpretable meaning**. It is the *direction* of the entire vector in high-dimensional space that encodes semantics.

Evidence: vector arithmetic works across the space:
```
king - man + woman ≈ queen
Seoul - Korea + Japan ≈ Tokyo
```

The relationship between vectors carries meaning, not any single dimension.

### Attention (Transformer)

The Transformer processes all token relationships **simultaneously** via matrix multiplication — not sequentially. For the input "I ate an apple", all pairwise token relationships are computed in a single parallel operation.

However, **output generation remains sequential**: tokens are generated one at a time (autoregressive decoding).

```
Input processing:  parallel  ✅  (attention over all tokens at once)
Output generation: sequential ✅  (one token at a time)
```

---

## New Learnings

### Before
- Assumed embedding dimensions might individually represent interpretable features (e.g., "fruitiness" of a word)
- Thought LLMs processed tokens sequentially like RNNs
- Unclear whether pgvector stores parameters or something else

### After
- **Embedding dimensions**: collectively directional, individually meaningless
- **Attention**: parallel computation across all token pairs within a forward pass
- **pgvector stores outputs**: not model parameters, but the *result* of passing text through a pre-trained embedding model's fixed parameters

---

## Practical Examples

### Parameters as learned pattern strength

Simplified training example for sentiment classification:

```
Before training (random):
  weight("good") = 0.1
  weight("bad")  = -0.1

After training on 1,000 positive reviews:
  weight("good") = 0.89   ← strengthened
  weight("bad")  = -0.95  ← strengthened in negative direction
```

"Getting stronger" = the number's magnitude increases, making that connection more influential on output.

### Vector similarity in pgvector (lingua-rag)

```
apple → [0.82, 0.31, -0.12, ...]
fruit → [0.79, 0.28, -0.15, ...]  ← high cosine similarity
car   → [-0.31, 0.92, 0.44, ...]  ← low cosine similarity
```

When querying lingua-rag with "apple", documents about "fruit" surface high in results because their vectors point in similar directions.

### RAG pipeline: parameters vs. embeddings

```
German text ("Wie geht es dir?")
  ↓
Embedding model (pre-trained, fixed parameters)
  ↓
[0.12, -0.83, 0.41, ... × 1536]  ← THIS is stored in pgvector
  ↓
pgvector similarity search
```

The embedding model's parameters were trained by OpenAI/Anthropic. lingua-rag only *uses* those frozen parameters to produce vectors from its own document corpus.

---

## Common Misconceptions

| Misconception | Correction |
|--------------|------------|
| Each embedding dimension = one semantic feature | Dimensions are not individually interpretable; meaning lives in the full vector direction |
| More documents = new model training | Documents are converted to vectors using a frozen pre-trained model — no training occurs |
| LLMs process tokens left-to-right like humans read | Attention computes all token relationships simultaneously; only generation is sequential |
| Parameters correspond to specific words | Parameters encode distributed patterns; no single parameter "owns" a word |

---

## Connection to lingua-rag

The embedding model choice directly impacts RAG retrieval quality:

- An English-dominant embedding model may fail to capture German semantic relationships accurately
- Multilingual models (e.g., `multilingual-e5`) are more appropriate for German content
- **This is a measurable gap** — one of the things RAGAS evaluation would surface when added to lingua-rag v0.3

The human associative memory analogy holds well for vector similarity search: thinking "Paris" activates "France, Bonjour, Europe" — exactly how cosine similarity retrieves semantically related documents.

---

## References

- *AI Engineering* — Chip Huyen (reading in progress)
- lingua-rag: FastAPI + pgvector + Supabase RAG system (personal project)
- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/) — recommended for backend/data system depth (post Chip Huyen)

---

## Next Steps

- [ ] Read Attention/Transformer chapter in Chip Huyen — will formalize Q/K/V matrix intuition
- [ ] Evaluate embedding model choice in lingua-rag: is `text-embedding-3-small` appropriate for German content?
- [ ] Add RAGAS evaluation to lingua-rag v0.3 — will quantify retrieval quality including embedding model impact
- [ ] Consider writing a blog post connecting embedding concepts to actual lingua-rag retrieval behavior (concrete before/after with multilingual model swap)
