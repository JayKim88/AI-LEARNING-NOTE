# Backend Interview Learning Plan

> **목표:** 개념을 외우는 게 아니라 문제를 만나고 해결하면서 배운다.
> **방식:** 각 Sprint마다 기능을 추가하고, 막히면 인터뷰 가이드 해당 섹션을 참고한다.
> **프로젝트:** ai-learning 백엔드 API — 내 학습 노트를 저장하고 검색하는 FastAPI 서버

---

## 프로젝트 구조 목표

```
ai-learning/
├── api/                        ← FastAPI 백엔드 (신규)
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── core/
│   ├── tests/
│   ├── alembic/
│   ├── Dockerfile
│   └── requirements.txt
├── blog/                       ← 기존 Astro 블로그
└── docs/
    ├── backend-learning-plan.md  ← 이 파일
    └── interview/                ← 인터뷰 가이드 (참고용)
```

---

## Sprint 계획

### Sprint 1 — 기본 API 뼈대
**문제:** 학습 노트를 API로 CRUD하고 싶다
**만드는 것:** FastAPI 앱, 노트 생성/조회/수정/삭제 엔드포인트
**참고 섹션:** §1 HTTP, §2 REST API Design, §11 FastAPI, §12 Pydantic

```
GET    /notes          노트 목록
POST   /notes          노트 생성
GET    /notes/{id}     노트 조회
PUT    /notes/{id}     노트 수정
DELETE /notes/{id}     노트 삭제
```

**완료 기준:**
- [ ] FastAPI 앱 실행
- [ ] Pydantic 스키마 (NoteCreate, NoteResponse)
- [ ] 메모리 저장 (DB 없이 일단 dict로)
- [ ] 블로그 포스팅: "REST API 설계하면서 배운 것"

---

### Sprint 2 — 데이터베이스 연결
**문제:** 서버 재시작하면 데이터가 날아간다
**만드는 것:** PostgreSQL + SQLAlchemy + Alembic 마이그레이션
**참고 섹션:** §4 SQL Fundamentals, §5 PostgreSQL, §6 SQLAlchemy, §7 Alembic

**완료 기준:**
- [ ] SQLAlchemy AsyncSession 설정
- [ ] Note 모델 (id, title, content, tags, created_at)
- [ ] Alembic 초기 마이그레이션
- [ ] Docker Compose로 PostgreSQL 실행
- [ ] 블로그 포스팅: "SQLAlchemy 2.x + Alembic 설정기"

---

### Sprint 3 — 인증
**문제:** 내 노트는 나만 볼 수 있어야 한다
**만드는 것:** JWT 인증, 회원가입/로그인, 보호된 엔드포인트
**참고 섹션:** §3 Authentication

**완료 기준:**
- [ ] POST /auth/register, POST /auth/login
- [ ] JWT 발급 및 검증
- [ ] get_current_user Depends
- [ ] 모든 노트 엔드포인트에 인증 적용
- [ ] 블로그 포스팅: "JWT 인증 직접 구현해보기"

---

### Sprint 4 — N+1 문제 발견과 해결
**문제:** 태그가 붙은 노트 목록을 불러오면 쿼리가 N+1개 나간다
**만드는 것:** Tag 모델, N+1 직접 재현, selectinload로 수정
**참고 섹션:** §6 SQLAlchemy (N+1), §4 SQL (EXPLAIN ANALYZE)

**완료 기준:**
- [ ] Note-Tag 관계 모델 (many-to-many)
- [ ] EXPLAIN ANALYZE로 N+1 쿼리 직접 확인
- [ ] selectinload로 수정 후 쿼리 수 비교
- [ ] 블로그 포스팅: "N+1 문제 직접 만들고 고치기"

---

### Sprint 5 — Race Condition
**문제:** 동시 요청이 노트 생성 quota를 초과한다
**만드는 것:** 플랜별 노트 개수 제한, SELECT FOR UPDATE
**참고 섹션:** §18 Concurrency & Race Conditions

**완료 기준:**
- [ ] 유저에 quota 필드 추가 (free: 100개)
- [ ] race condition 재현 (asyncio.gather로 동시 요청)
- [ ] SELECT FOR UPDATE로 수정
- [ ] 원자적 UPDATE 방식과 비교
- [ ] 블로그 포스팅: "Race condition 직접 재현해보기"

---

### Sprint 6 — Semantic Search
**문제:** 키워드 검색은 의미를 모른다. "비동기 패턴"으로 검색하면 async 관련 노트가 안 나온다
**만드는 것:** pgvector 임베딩, hybrid search (vector + full-text)
**참고 섹션:** §8 pgvector

**완료 기준:**
- [ ] pgvector extension 설치
- [ ] embedding vector 컬럼 추가
- [ ] OpenAI embeddings API로 노트 임베딩
- [ ] cosine similarity 검색
- [ ] full-text search와 RRF로 hybrid search
- [ ] 블로그 포스팅: "pgvector로 semantic search 구현"

---

### Sprint 7 — Redis 캐싱
**문제:** 같은 검색 쿼리가 반복되는데 매번 DB를 친다
**만드는 것:** Redis 캐싱, cache invalidation
**참고 섹션:** §9 Redis & Caching

**완료 기준:**
- [ ] Redis Docker Compose 추가
- [ ] 검색 결과 캐싱 (TTL 5분)
- [ ] 노트 수정 시 캐시 무효화
- [ ] cache hit/miss 로그
- [ ] 블로그 포스팅: "Redis 캐싱 적용기"

---

### Sprint 8 — RAG: 내 노트에 질문하기
**문제:** "내가 pgvector에 대해 뭘 배웠더라?" 를 자연어로 묻고 싶다
**만드는 것:** RAG 파이프라인, SSE 스트리밍 응답
**참고 섹션:** §22 LLM API, §23 RAG, §17 Streaming

**완료 기준:**
- [ ] POST /ask — 질문 받아서 관련 노트 검색 후 LLM으로 답변
- [ ] SSE로 토큰 스트리밍
- [ ] prompt caching 적용
- [ ] 블로그 포스팅: "내 학습 노트 RAG 만들기"

---

### Sprint 9 — Background Jobs
**문제:** 노트 저장할 때 임베딩 생성이 느려서 응답이 3초씩 걸린다
**만드는 것:** Celery + Redis, 비동기 임베딩 처리
**참고 섹션:** §19 Message Queues & Async Jobs

**완료 기준:**
- [ ] 노트 저장은 즉시 응답 (embedding_status: pending)
- [ ] Celery worker가 백그라운드에서 임베딩
- [ ] acks_late=True 설정
- [ ] 블로그 포스팅: "Celery로 백그라운드 임베딩 처리"

---

### Sprint 10 — 보안 강화
**문제:** IDOR, SQL injection, rate limiting이 없다
**만드는 것:** 보안 감사 및 수정
**참고 섹션:** §27 Security

**완료 기준:**
- [ ] 모든 엔드포인트 IDOR 점검 (user_id 소유권 확인)
- [ ] parameterized query 확인
- [ ] rate limiting (Redis 슬라이딩 윈도우)
- [ ] 블로그 포스팅: "백엔드 보안 점검 체크리스트"

---

### Sprint 11 — 테스트 스위트
**문제:** 리팩토링할 때 뭐가 깨지는지 모른다
**만드는 것:** pytest + AsyncClient 통합 테스트
**참고 섹션:** §28 Testing

**완료 기준:**
- [ ] conftest.py (test DB, AsyncClient)
- [ ] 핵심 엔드포인트 통합 테스트
- [ ] LLM 호출 mock
- [ ] 커버리지 70% 이상
- [ ] 블로그 포스팅: "FastAPI 비동기 테스트 작성법"

---

### Sprint 12 — Observability + 배포
**문제:** 프로덕션에서 뭐가 느린지 모른다
**만드는 것:** 구조화 로깅, 메트릭, Docker, GitHub Actions CI/CD
**참고 섹션:** §29 Observability, §30 DevOps

**완료 기준:**
- [ ] structlog 구조화 로깅
- [ ] 모든 LLM 호출 latency/token 로깅
- [ ] Dockerfile + docker-compose.yml
- [ ] GitHub Actions (test → build → deploy)
- [ ] 블로그 포스팅: "FastAPI 프로덕션 배포 체크리스트"

---

## 인터뷰 가이드 참고 방법

**원칙: 막히면 찾아본다. 미리 읽지 않는다.**

```
기능 구현 시도
    ↓
막히거나 이해 안 됨
    ↓
docs/interview/backend-interview-guide-en/{N}-섹션.md 참고
    ↓
다시 구현
    ↓
Self-Tests 직접 답변
    ↓
블로그 포스팅
```

---

## 진행 상황

| Sprint | 상태 | 완료일 | 블로그 링크 |
|--------|------|--------|-----------|
| 1 기본 API | 🔜 | | |
| 2 데이터베이스 | 🔜 | | |
| 3 인증 | 🔜 | | |
| 4 N+1 | 🔜 | | |
| 5 Race Condition | 🔜 | | |
| 6 Semantic Search | 🔜 | | |
| 7 Redis 캐싱 | 🔜 | | |
| 8 RAG | 🔜 | | |
| 9 Background Jobs | 🔜 | | |
| 10 보안 | 🔜 | | |
| 11 테스트 | 🔜 | | |
| 12 배포 | 🔜 | | |
