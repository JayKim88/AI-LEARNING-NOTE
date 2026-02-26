---
title: "RAG 아키텍처 기초 — pgvector, FastAPI, SSE Streaming, 임베딩 모델"
date: 2026-02-25
description: "LinguaRAG 기획 과정에서 이해한 RAG 핵심 개념: 오프라인/온라인 단계 분리, SSE Streaming 동작 원리, 프롬프트 조합, pgvector 역할."
category: learnings
tags: ["rag", "fastapi", "sse-streaming", "pgvector", "embedding", "claude-api", "llm"]
lang: ko
draft: false
---

## Key Concepts

### RAG의 두 단계: 오프라인 vs 온라인

RAG(Retrieval-Augmented Generation)의 핵심은 **"무거운 작업은 1회만, 질문 응답은 가볍게"** 다.

**오프라인 단계** (PDF 업로드 시 1회만 실행):
```
PDF 업로드
  → 텍스트 추출 (pdfplumber)
  → 청크 분할 (500-800 token)
  → 임베딩 생성 (텍스트 → 숫자 벡터)
  → pgvector 저장
⏱ ~30-60초, ~$0.05 (일회성)
```

**온라인 단계** (유저 질문마다 실행):
```
유저 질문
  → 질문 임베딩
  → pgvector 유사도 검색 (Top-K=3 청크)
  → 프롬프트 조합 (시스템 프롬프트 + 청크 + 히스토리 + 질문)
  → Claude API 스트리밍 호출
  → 답변 반환
⏱ 첫 토큰 < 2초, ~$0.01-0.03/질문
```

### 임베딩(Embedding)

텍스트를 숫자 벡터로 변환하는 것. 의미가 비슷한 텍스트는 벡터값도 가까움.

```
"약속을 잡을 때 뭐라고 해요?" → [0.12, -0.87, 0.34, ...]
"Wann passt es dir?"         → [0.11, -0.85, 0.36, ...]
                                  ↑ 숫자들이 가까움 = 의미 유사
```

- **Claude/GPT**: 텍스트 → 텍스트 (이해하고 생성)
- **임베딩 모델**: 텍스트 → 숫자 벡터 (의미 수치화만, 생성 없음) → 훨씬 저렴

### pgvector

PostgreSQL 확장(extension). `CREATE EXTENSION vector;` 한 줄로 기존 PostgreSQL이 벡터 유사도 검색 DB가 됨.

```sql
-- 유사도 검색 (cosine similarity)
SELECT content FROM chunks
WHERE unit_id = 'A1-13'
ORDER BY embedding <=> $1  -- $1 = 질문 벡터
LIMIT 3;
```

벡터 DB 전용 서비스(Pinecone, Weaviate) 없이 기존 PostgreSQL 그대로 활용 가능.

### SSE (Server-Sent Events) Streaming

서버가 클라이언트에게 단방향으로 데이터를 실시간 푸시하는 기술. ChatGPT가 타이핑하듯 답변이 나오는 방식.

```
[일반 HTTP]: 서버가 전체 응답 완성 후 한 번에 전달
[SSE]:       토큰 단위로 실시간 전달 → 첫 토큰 < 2초

서버가 보내는 원시 데이터:
data: {"type": "token", "content": "Akkusativ"}
data: {"type": "token", "content": "는"}
...
data: [DONE]
```

WebSocket 대신 SSE를 쓰는 이유: LLM 응답은 "서버→클라이언트" 단방향이라 SSE로 충분. 구현이 단순하고 재연결이 자동.

### 프롬프트 조합 (Prompt Assembly)

Claude에게 보내는 메시지를 여러 조각으로 합치는 서버 작업.

```python
client.messages.create(
    system=system_prompt,    # ① 역할 + 레벨 + 단원 컨텍스트 (서버에서 빌드)
    messages=[
        *history,            # ② DB에서 조회한 최근 10개 메시지
        {"role": "user",
         "content": "Akkusativ가 뭐예요?"}  # ③ 유저 입력
    ]
)
```

서버(FastAPI)에서 조합하는 이유: API 키 노출 방지, DB 접근, 시스템 프롬프트 숨김.

### FastAPI 선택 이유

- `async/await` 네이티브 → Claude API 스트리밍과 궁합
- `StreamingResponse` → SSE 구현이 자연스러움
- 타입 힌트 → 자동 OpenAPI 문서 생성 (`/docs`)

---

## New Learnings

### 벡터 DB는 서버 안에 있다

"벡터 DB는 별도 외부 서비스"라고 생각하기 쉽지만, pgvector를 쓰면 기존 PostgreSQL이 벡터 DB가 된다. 별도 서버/서비스 불필요.

### PDF 업로드 = 모든 내용을 "한 번에" 참조하는 게 아니다

- **인덱스 관점**: 전체 내용이 벡터 DB에 저장됨 (참조 가능)
- **쿼리 관점**: 질문마다 관련 Top-K 청크만 Claude에게 전달 (전체 아님)

Claude의 context window 한계 때문. A1 전체(56단원)를 한 번에 넣으면 수백만 토큰 → 불가능.

### v0.1에서 임베딩 모델이 필요 없다

임베딩과 pgvector는 v0.2(PDF RAG 도입) 시점에 필요. v0.1은 시스템 프롬프트 기반으로만 동작. 미리 선택할 필요 없음.

### 임베딩 모델은 OpenAI가 아니어도 된다

독일어 학습 앱이라면 다국어 특화 모델이 더 적합할 수 있음:
- Voyage AI `voyage-multilingual-2` (Anthropic 투자, 다국어 특화)
- Cohere `embed-multilingual-v3.0` (100개 언어 지원)
- HuggingFace `multilingual-e5-large` (무료)

비용보다 독일어 검색 품질이 우선. A1 전체 청크 수는 ~1,000개 → 어느 옵션이든 수 센트 수준.

---

## Practical Examples

### FastAPI SSE Streaming 핵심 코드

```python
# FastAPI 서버
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
// Next.js 클라이언트
const response = await fetch('/api/chat', { method: 'POST', body: ... })
const reader = response.body!.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // 토큰 파싱 → UI에 append
}
```

### pgvector 유사도 검색

```sql
-- 설치
CREATE EXTENSION IF NOT EXISTS vector;

-- 테이블 (1536차원 벡터)
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    unit_id VARCHAR(10),
    content TEXT,
    embedding vector(1536)
);

-- 유사도 검색 (unit_id 필터 포함)
SELECT content, embedding <=> $1 AS distance
FROM chunks
WHERE unit_id = 'A1-13'
ORDER BY distance
LIMIT 3;
```

### 에러 처리: exponential backoff

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

### "RAG = PDF 전체를 Claude에게 보내는 것"

틀렸다. RAG는 벡터 검색으로 관련 청크만 추출해서 보내는 것. PDF 전체를 매번 보내는 건 비용/속도 모두 불가능.

### "벡터 DB는 별도 서비스가 필요하다"

pgvector를 쓰면 기존 PostgreSQL이 벡터 DB가 된다. Pinecone 같은 별도 서비스 없이도 충분 (소규모 기준).

### "임베딩 모델 = LLM"

임베딩 모델은 텍스트를 생성하지 않는다. 텍스트 → 숫자 벡터 변환만 한다. 훨씬 빠르고 저렴.

---

## References

- [F1 스펙 문서](projects/lingua-rag/docs/f1-streaming-qa-spec.md)
- [Product Brief](projects/lingua-rag/product-brief-lingua-rag-v01-20260225.md)
- [ADR 기술 결정](projects/lingua-rag/docs/decisions.md)
- [Anthropic Streaming Docs](https://docs.anthropic.com/en/api/messages-streaming)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

---

## Next Steps

- [ ] F1 구현: FastAPI + Claude Streaming 프로토타입 (Week 1)
- [ ] `build_system_prompt()` 함수로 10개 질문 프롬프트 품질 테스트
- [ ] v0.2 시점에 임베딩 모델 A/B 테스트 (OpenAI vs Voyage AI)
- [ ] pgvector 로컬 Docker 환경 세팅 후 유사도 검색 실험
