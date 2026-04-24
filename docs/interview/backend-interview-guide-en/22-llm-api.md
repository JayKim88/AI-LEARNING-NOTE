# 22. LLM API Patterns

### Why This Section Matters

Working with LLM APIs at production scale requires understanding patterns that don't exist in traditional APIs: token management, prompt caching, structured output, tool/function calling, and cost optimization. These aren't optional knowledge for AI engineers — they're daily operational concerns.

This section is particularly important for Nativ — every pattern here maps directly to architecture decisions you've made or will make.

**What interviewers actually probe:**
- How do you reduce LLM API costs in production?
- What is prompt caching and how does it work?
- How do you get structured JSON output from an LLM reliably?
- What is tool use / function calling?

---

## 22.1 Token Economics — What You're Actually Paying For

LLM APIs charge per token, not per request. Understanding the token structure of your calls determines your cost model.

```
Total cost = (input_tokens × input_price) + (output_tokens × output_price)

For GPT-4o (approx):
  input:  $2.50 / 1M tokens
  output: $10.00 / 1M tokens  ← 4x more expensive than input
```

**Token counting in a RAG request:**

```
System prompt:              500 tokens  (static — cacheable)
Retrieved context chunks:  2,000 tokens  (dynamic — changes per query)
User message:               100 tokens
─────────────────────────────────────────
Total input:              2,600 tokens
LLM response (output):      200 tokens

Cost per request: (2,600 × $0.0025) + (200 × $0.01) = $0.0065 + $0.002 = $0.0085
At 10,000 requests/day: $85/day
```

**Implication:** Output tokens are expensive — keep responses concise when possible. Don't ask "Write a comprehensive explanation" when "Explain in 2 sentences" serves the user equally well.

---

## 22.2 Prompt Caching — Anthropic and OpenAI

Prompt caching allows the LLM provider to cache the KV (key-value) state of a prefix and reuse it across requests. If your system prompt is 2,000 tokens and doesn't change, you pay full price for it only once — subsequent requests that include the same prefix are billed at ~10% of normal input price.

**Anthropic Claude — explicit cache control:**

```python
from anthropic import Anthropic

client = Anthropic()

# Mark the static part of the prompt for caching
response = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": LARGE_STATIC_SYSTEM_PROMPT,   # 2,000+ tokens
            "cache_control": {"type": "ephemeral"}  # cache this prefix
        }
    ],
    messages=[
        {
            "role": "user",
            "content": f"Translate this vocabulary item: {word}"
        }
    ]
)

# Check if cache was used
usage = response.usage
print(f"Cache read tokens: {usage.cache_read_input_tokens}")
print(f"Cache write tokens: {usage.cache_creation_input_tokens}")
```

**Requirements for cache hits:**
- The cached prefix must be identical across requests (byte-for-byte)
- Prefix must be ≥ 1,024 tokens (Anthropic), ≥ 2,048 tokens (some endpoints)
- Cache TTL: ~5 minutes for ephemeral cache, longer for explicit cache

**Cost math — Nativ's 90% cost reduction claim:**

```
Without caching:
  System prompt: 2,000 tokens × $3/1M = $0.006 per request
  At 1,000 req/day: $6/day

With caching (first request writes cache, subsequent reads):
  Cache write: $0.006 (once, or on cache expiry)
  Cache read:  2,000 tokens × $0.30/1M = $0.0006 per request
  Savings: 90% on the cached portion
```

> **Nativ connection:** Nativ caches the static language tutor system prompt across all requests for the same language pair. With 1,000+ daily users, each sending multiple requests, the savings are substantial.

---

## 22.3 Structured Output — Getting JSON Reliably

LLMs return text, not structured data. Getting reliable JSON requires explicit mechanisms — not just prompting "return JSON".

**OpenAI structured outputs (Pydantic integration):**

```python
from pydantic import BaseModel
from openai import OpenAI

client = OpenAI()

class VocabExplanation(BaseModel):
    word: str
    definition: str
    example_sentence: str
    difficulty: int   # 1-5

response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a German language tutor."},
        {"role": "user", "content": f"Explain the word: {word}"}
    ],
    response_format=VocabExplanation,   # OpenAI enforces this schema
)

explanation = response.choices[0].message.parsed   # Already a VocabExplanation instance
print(explanation.definition)
```

**Anthropic — JSON mode via prompt:**

```python
response = client.messages.create(
    model="claude-opus-4-7",
    messages=[
        {
            "role": "user",
            "content": f"Explain {word}. Respond ONLY with valid JSON matching this schema: {VocabExplanation.model_json_schema()}"
        }
    ],
)

import json
from pydantic import ValidationError

try:
    data = json.loads(response.content[0].text)
    explanation = VocabExplanation.model_validate(data)
except (json.JSONDecodeError, ValidationError) as e:
    # Retry or handle gracefully
    raise ValueError(f"LLM returned invalid schema: {e}")
```

**Common failure modes:**
- LLM adds commentary before/after the JSON (`"Here's the JSON: {...} Let me know if you need more"`)
- LLM omits required fields
- LLM uses wrong data types (`difficulty: "3"` instead of `3`)

**Fix:** Use providers' native structured output (OpenAI `response_format`, Anthropic tool use with forced tool call) rather than relying on prompt instructions alone.

---

## 22.4 Tool Use / Function Calling

Tool calling lets the LLM decide to call a function, receive the result, and continue reasoning. This is what makes LLM agents work — the model can take actions and use results to formulate responses.

```python
from openai import OpenAI
import json

client = OpenAI()

# Define available tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_vocab_item",
            "description": "Retrieve a vocabulary item by word",
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "The word to look up"},
                    "language": {"type": "string", "description": "ISO 639-1 language code"}
                },
                "required": ["word", "language"]
            }
        }
    }
]

# First call — model may choose to call a tool
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Tell me about the German word 'Wanderlust'"}],
    tools=tools,
)

# Check if model wants to call a tool
if response.choices[0].finish_reason == "tool_calls":
    tool_call = response.choices[0].message.tool_calls[0]
    args = json.loads(tool_call.function.arguments)

    # Execute the tool
    result = get_vocab_item(args["word"], args["language"])

    # Continue conversation with tool result
    messages = [
        {"role": "user", "content": "Tell me about the German word 'Wanderlust'"},
        response.choices[0].message,             # assistant's tool call request
        {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result),        # tool result
        }
    ]

    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
```

**When to use tool calling:**
- Agent workflows that need external data (database lookup, web search, calculations)
- Structured output extraction (force the model to fill a "save_result" function schema)
- Multi-step reasoning where intermediate results are needed

---

## 22.5 Streaming Responses

See §17 for implementation details. The pattern at the LLM API level:

```python
# OpenAI streaming
stream = await client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    stream=True,
)

async for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        yield content   # or SSE-format it: f"data: {json.dumps({'token': content})}\n\n"
```

**Token counting with streaming:** You don't get usage stats in streaming chunks by default. Request them explicitly:

```python
stream = await client.chat.completions.create(
    ...,
    stream=True,
    stream_options={"include_usage": True}  # final chunk includes usage
)
```

---

## 22.6 Cost Optimization Patterns

**1. Cache static prompts** — as described in §22.2

**2. Choose the right model tier:**

```python
# Route to cheaper model when task is simple
def select_model(task: str, complexity: int) -> str:
    if task == "classify" or complexity < 3:
        return "gpt-4o-mini"    # ~15x cheaper than gpt-4o
    return "gpt-4o"
```

**3. Limit output tokens:**

```python
client.chat.completions.create(
    ...,
    max_tokens=200,   # hard cap — prevents runaway output
)
```

**4. Async batching for non-interactive tasks:**

```python
# OpenAI Batch API — 50% cost reduction, 24h completion window
# For offline processing (embedding generation, classification, evaluation)
from openai import OpenAI

batch = client.batches.create(
    input_file_id=file_id,
    endpoint="/v1/chat/completions",
    completion_window="24h",
)
```

**5. Semantic caching:**
Cache not just exact prompts, but semantically similar ones. If "What is Wanderlust?" was answered 5 minutes ago, "Can you explain Wanderlust to me?" gets the cached answer.

```python
async def get_cached_or_generate(query: str, db, redis):
    # Embed the query
    query_embedding = await embed(query)

    # Check if a similar query was answered recently
    cached = await vector_search(redis, query_embedding, threshold=0.95)
    if cached:
        return cached.response

    # Generate and cache with the embedding as key
    response = await llm_generate(query)
    await cache_response(redis, query_embedding, response, ttl=300)
    return response
```

---

## 22.7 Interview Answer Scripts

**Q: "How do you reduce LLM API costs in production?"**

> "Several strategies with different impact levels. The highest-ROI one for RAG systems is prompt caching — if your system prompt is 2,000+ tokens and static across requests, Anthropic's cache_control lets you pay ~10% of normal price on cache hits. In Nativ, this reduced per-request cost by ~90% on the system prompt portion. Second, model routing — use GPT-4o-mini or Haiku for simpler classification and extraction tasks, reserve GPT-4o or Opus for tasks requiring deeper reasoning. Third, output token management — be explicit about response length in the prompt and set `max_tokens` as a hard cap. Output tokens are 3-4x more expensive than input. Fourth, batching non-interactive workloads through the Batch API for a 50% discount. Fifth, semantic caching for repeated queries — if users frequently ask similar questions, cache the response and skip the LLM call entirely."

**Q: "What is tool use / function calling and how would you use it in a RAG system?"**

> "Function calling lets the LLM request to execute a function you've defined. You provide a list of available tools with their names, descriptions, and parameter schemas. The model decides when to call a tool, constructs the arguments, and you execute the function and return the result. In a RAG system, instead of always retrieving context before the model sees the query, you can give the model a `search_knowledge_base(query: str)` tool. The model can choose when retrieval is necessary, construct an optimal search query, and incorporate the results. This is more flexible than pre-retrieval because the model can decide to search multiple times or not at all. The tradeoff: it's more complex, adds latency (extra round trip for each tool call), and requires careful tool descriptions to guide the model's decisions."

**Q: "How do you get structured JSON output reliably from an LLM?"**

> "Prompting alone — 'return JSON' — is unreliable. The model might add commentary, use wrong types, or omit fields. The reliable approaches: OpenAI's `response_format` with a Pydantic model via the `.parse()` method — this uses grammar-constrained generation to enforce the schema at the model output level. Anthropic's tool use with `tool_choice: {type: 'tool', name: 'save_result'}` forces the model to call your structured tool, which behaves like structured output. For providers without native support: validate and retry — parse the response with Pydantic, catch `ValidationError`, and retry with an error message telling the model what it got wrong. Retrying once or twice handles most edge cases. In production, instrument the validation failure rate — a high rate means your schema or prompt needs refinement."

**Q: "How do you implement retry logic for LLM API calls that handles both rate limits and transient errors?"**

> "LLM API errors fall into two buckets: retriable (rate limit 429, server overload 529, transient 500) and non-retriable (invalid API key 401, malformed request 400, content policy 400). The strategy: exponential backoff with jitter for retriable errors, immediate failure for non-retriable. Implementation with tenacity: `@retry(retry=retry_if_exception_type((RateLimitError, APIStatusError)), wait=wait_exponential(multiplier=1, min=1, max=60), stop=stop_after_attempt(5))`. Jitter prevents thundering herd — if 100 requests hit a rate limit simultaneously, randomizing the wait spreads the retry load. For 429 specifically, check the `Retry-After` header — the API often tells you exactly how long to wait. In Nativ, I wrap all LLM calls in a `generate_with_retry` utility that logs each retry attempt with the error type and wait time, which surfaces in observability when the LLM provider has an incident."

---

## 22.8 Self-Tests

Try answering these before looking at the answers.

1. Your Nativ system prompt is 3,000 tokens and static. Anthropic charges $3/1M input tokens and $0.30/1M cache-read tokens. At 10,000 requests/day, what's the daily cost with and without caching?
2. You call `response.usage` after a streaming response but `input_tokens` is None. What's missing?
3. A user uploads a document and asks 20 questions about it in sequence. The document context is 5,000 tokens. How do you avoid paying for 5,000 × 20 = 100,000 input tokens per session?
4. Your structured output parser fails 5% of the time because the LLM returns markdown-wrapped JSON (` ```json {...} ``` `). How do you fix this robustly?
5. You want the LLM to search the database only when it doesn't know the answer. How would you design this with tool calling?

<details>
<summary>Answers</summary>

1. **Without caching:** 3,000 tokens × $3/1M = $0.009 per request. At 10,000/day: $90/day. **With caching:** First request each 5-minute TTL window pays cache write (full price). Subsequent requests pay cache read. If the cache is warm for 99% of requests: 100 cache writes × $0.009 + 9,900 cache reads × 3,000 × $0.30/1M = $0.90 + $8.91 = $9.81/day. Savings: ~89% on the system prompt portion. This is why prompt caching is the highest-ROI optimization for RAG systems with large static system prompts.

2. Streaming responses don't include usage data in chunks by default. You need to add `stream_options={"include_usage": True}` to the API call. With this option, the final chunk in the stream includes a `usage` object with `prompt_tokens`, `completion_tokens`, and `total_tokens`. Without it, `response.usage` is None because there's no single response object — usage is aggregated at the end.

3. Use prompt caching on the document context. In Anthropic: mark the document content with `cache_control: {type: "ephemeral"}`. The first question pays full price to write the cache. Questions 2-20 read from cache at ~10% cost. The 5,000-token document context is only fully priced once per 5-minute window. Alternatively, maintain a conversation history with the document as the first assistant message and use the provider's context caching — the model doesn't need the document repeated in every message if it's in the conversation history and the provider caches it.

4. Add a post-processing step to strip markdown code fences before JSON parsing:
   ```python
   import re
   def extract_json(text: str) -> str:
       # Strip markdown code blocks
       cleaned = re.sub(r"```json\s*|\s*```", "", text).strip()
       return cleaned
   ```
   This is a pragmatic fix for a known LLM output pattern. For a more robust solution: use the provider's native structured output mode (OpenAI `.parse()`, Anthropic tool use) which enforces the schema at generation time and never returns markdown-wrapped JSON. If you must use prompt-based JSON, also instruct the model explicitly: "Respond ONLY with raw JSON. No markdown code fences. No commentary."

5. Design a `search_vocabulary` tool and give the model instructions that it should use the tool when asked about specific words or concepts it may not have complete information about. The model's self-knowledge determines when it calls the tool — GPT-4o knows common words but may call the tool for rare or technical vocabulary. Pattern: `tools=[search_vocabulary_tool]`, `tool_choice="auto"` (model decides). For more control: `tool_choice={"type": "function", "function": {"name": "search_vocabulary"}}` forces a call, or add instructions in the system prompt: "Always call search_vocabulary when asked about a specific word before answering, even if you think you know the definition — the user's vocabulary database may have custom notes."

</details>

---

← Back to [21. System Design Patterns](21-system-design.md) | Next → [23. RAG Systems Deep Dive](23-rag.md)
