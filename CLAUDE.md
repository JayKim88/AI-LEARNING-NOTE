# AI Learning Note — Project Instructions

## 프로젝트 구조

```
ai-learning/
├── api/                        ← FastAPI 백엔드 (Sprint 진행 중)
├── blog/                       ← Astro 블로그 (GitHub Pages)
└── docs/
    ├── backend-learning-plan.md  ← Sprint 계획
    └── interview/                ← 백엔드 인터뷰 가이드 (참고용)
        └── backend-interview-guide-en/  ← §1-33 섹션
```

## Backend Learning Project

**목표:** 백엔드 인터뷰 개념을 구현하면서 배운다. 외우지 않는다.

**Sprint 계획:** `docs/backend-learning-plan.md`
**인터뷰 가이드:** `docs/interview/backend-interview-guide-en/`

### 작업 원칙

1. 문제를 먼저 만난다 — 개념을 미리 읽지 않는다
2. 막히면 해당 인터뷰 가이드 섹션을 참고한다
3. Sprint 완료 후 블로그 포스팅 (`blog/src/content/learnings/`)

### 인터뷰 가이드 참고 방법

| Sprint | 참고 섹션 |
|--------|---------|
| 1 기본 API | §1, §2, §11, §12 |
| 2 데이터베이스 | §4, §5, §6, §7 |
| 3 인증 | §3 |
| 4 N+1 | §6, §4 |
| 5 Race Condition | §18 |
| 6 Semantic Search | §8 |
| 7 Redis 캐싱 | §9 |
| 8 RAG | §22, §23, §17 |
| 9 Background Jobs | §19 |
| 10 보안 | §27 |
| 11 테스트 | §28 |
| 12 배포 | §29, §30 |

## Blog

Astro 기반 정적 블로그. GitHub Pages 자동 배포.

```bash
cd blog && npm run dev   # 로컬 개발
git push                 # 자동 배포
```

콘텐츠 위치: `blog/src/content/learnings/` (학습 포스팅)
