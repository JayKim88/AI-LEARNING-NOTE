---
title: "2026-02-25 작업 로그"
date: 2026-02-25
description: "lingua-rag 기획+F1 구현(competitive-agents), planning-interview v2.0 통합, business-avengers v2.1 감사, truth-checker 아이디어, plugin-tester 설계..."
tags: ["lingua-rag", "business-avengers", "planning-interview", "plugin-tester", "competitive-agents", "lingua-rag-planning-docs", "truth-checker"]
---

## 오늘 작업한 주제

- [lingua-rag (01:34)](#lingua-rag-0134)
- [business-avengers (14:51)](#business-avengers-1451)
- [lingua-rag (14:52)](#lingua-rag-1452)
- [planning-interview (15:06)](#planning-interview-1506)
- [planning-interview (15:19)](#planning-interview-1519)
- [plugin-tester (17:16)](#plugin-tester-1716)
- [lingua-rag (17:16)](#lingua-rag-1716)
- [competitive-agents (17:16)](#competitive-agents-1716)
- [lingua-rag-planning-docs (18:15)](#lingua-rag-planning-docs-1815)
- [planning-interview (18:15)](#planning-interview-1815)
- [truth-checker (20:30)](#truth-checker-2030)

---

## lingua-rag (01:34)

> AI Product Engineer 킬러 프로젝트 LinguaRAG 기획 완성 — Lean Canvas → Product Brief (Startup 모드) → 독독독 A1 구조 반영

### 한 일

- docs: `projects/lingua-rag/lean-canvas-lingua-rag-20260225.md` 생성 (planning-interview Solo 모드)
  - 핵심 인사이트: 유저 가치 = 패턴 기반 반복 듣기/말하기 훈련 (단순 Q&A 아님)
  - North Star Metric: 연습 문장 세트 반복 완료 횟수
- docs: `projects/lingua-rag/product-brief-lingua-rag-v01-20260225.md` 생성 (Startup 모드)
  - 범위: v0.1 (Week 1-4) — PDF 없이 독일어 Q&A + 단원 대시보드 + 레벨 매핑
  - 기능 목록: F1~F8 (Must/Should/Could), API 설계, DB 스키마, 베타 테스터 설문 3개 가설
- refactor(product-brief): Netzwerk A1 → 독독독 A1 구조로 전면 교체 — 56개 단원 / 8개 Band, Jay의 실제 진행(A1-1~A1-20 완료) 반영
- refactor: v0.2 섹션을 독독독 PDF 연동 중심으로 업데이트 (저작권 처리: 유저 업로드 → 처리 후 삭제)

### 주요 결정

- **독독독 단원 구조를 v0.1 기준으로 채택**: v0.1 하드코딩 → v0.2 실제 PDF로 대체하는 점진적 전략
- **단원 유형(type) 분류 도입**: grammar/vocabulary/conversation/practice — 시스템 프롬프트를 유형에 따라 최적화
- **v0.1 범위 확장**: Streaming Q&A만 → 단원 네비게이션 + 레벨 매핑 포함. Week 1-2 Q&A 우선, Week 3-4 대시보드
- **저작권 전략**: 유저가 직접 구매한 PDF 업로드 방식, 서버 영구 저장 금지

### 다음

- [ ] spec-interview로 F1(Claude Streaming Q&A) 상세 기능 스펙 작성 → competitive-agents에게 구현 의뢰
- [ ] Open Questions 해결 (v0.1 개발 시작 전)
- [ ] GitHub repo `lingua-rag` 생성 및 초기 커밋

---

## business-avengers (14:51)

> v2.1 감사 37건 잔여 항목 완료 + Phase 0 아이디어 문서 입력 기능 추가

### 한 일

- feat: v2.1 감사 잔여 항목 전체 완료
  - I2: Phase 9 CS Manager에 GTM 전략 컨텍스트 추가
  - I3: Phase 5 프론트/백엔드 sprint_context 변수 분리 (`sprint_context_frontend`, `sprint_context_backend`)
  - I5: Phase 11 sprint_context에 sprint_goal 포함
  - I7: Step 20 (Sprint Completion)에 sprint-review.md 템플릿 기반 리뷰 생성 통합
  - I8: RESUME 모드에서 `workflow` 변수 미정의 버그 수정
  - I10: Phase 실행 루프 명시적 매핑 추가 (Phase 0→Step 4, ..., Phase 12→Step 16)
  - I11: 완료 후 라우팅 추가 (Sprint→Step 20, Orchestra→Step 21)
  - M1-M9+UX4: org-structure.yaml 동기화 및 마이너 정리
- feat: Phase 0 아이디어 문서 입력 기능 추가
  - CPO가 먼저 "기존 문서가 있나요?" 분기 질문
  - 파일 경로 입력 시 Glob+Read로 로드 / 텍스트 붙여넣기 시 그대로 사용
  - 파일 못 찾으면 텍스트 폴백 + 안내 메시지

### 주요 결정

- **문서 입력 방식**: `--from-doc` 커맨드 플래그 대신 Phase 0 CPO 대화 내 자연스러운 분기 채택 (UX 우선)
- **파일 경로 판별**: `/` 또는 `\` 포함 AND 확장자 체크 (`.md`, `.txt`, `.pdf`, `.docx`)

### 다음

- [ ] 새 세션에서 E2E 전체 플로우 테스트 (Phase 0→1→2)
  - [ ] 문서 입력 분기 검증 (파일 경로 / 텍스트 붙여넣기 양쪽)
  - [ ] Phase 1 병렬 3개 에이전트 실행 및 출력 검증

---

## lingua-rag (14:52)

> F1 Competitive Agents 파이프라인 전체 완료 — Alpha vs Beta 2라운드 경쟁 후 Fuse, lingua-rag 리포 초기 push

### 한 일

- feat: F1 spec-interview 완료 → `projects/lingua-rag/docs/f1-streaming-qa-spec.md` 생성
- feat: Competitive Agents 파이프라인 7단계 전체 실행
  - Phase 1: Alpha (Pragmatist) v1, Beta (Architect) v1 병렬 생성
  - Phase 2~5: 2라운드 크로스 리뷰 + 개선 — Alpha 82.5/100, Beta 82.5/100 (동점)
  - Phase 6: Judge — Alpha **74.0** / Beta **67.0** (Alpha 승, 결정적 차이: Beta에 프론트엔드 없음)
  - Phase 7: "Fuse A + B" 선택 → `tempo/competitive-agents/lingua-rag-f1/fused/` 생성
- feat: Fused 구현 (39 files)
  - Beta 백엔드 레이어드 아키텍처 + Alpha 프론트엔드 채택
  - `backend/app/routers/chat.py`: history fetch + user persist를 `session_lock` 내부로 이동, LRU 1,000-entry cap
  - `frontend/hooks/useChat.ts`: truncated 이벤트 처리 + 경고 UI 추가
- feat: GitHub repo `lingua-rag` 클론 → fused 40개 파일 복사 → push
- docs: `README.md` 작성 (기술 스택, 로컬 개발 가이드, API 엔드포인트, 설계 결정)

### 주요 결정

- **Fuse 전략**: Alpha 승리했으나 Beta의 레이어드 아키텍처 품질 우수 → 백엔드는 Beta, 프론트엔드는 Alpha
- **asyncio.Lock 스코프**: 히스토리 fetch와 user message persist 모두 lock 내부 — race condition 방지 (크로스 리뷰 Critical 이슈)
- **--workers 1 고정**: asyncio.Lock은 단일 프로세스 내에서만 유효

### 다음

- [ ] 로컬 개발 환경 세팅 및 동작 확인 (backend + frontend 연결 테스트)
- [ ] Railway 백엔드 배포 + Vercel 프론트엔드 배포
- [ ] 베타 테스터 모집 글 작성 (네이버 카페 "독일어 스터디" + Reddit r/German)

---

## planning-interview (15:06)

> planning-interview v2.0 통합 기획 플러그인 구현 — 4-Phase 단일 흐름 + Context Import 단계 추가

### 한 일

- feat: planning-interview + spec-interview 통합 설계 확정 — Mode는 인터뷰 깊이만 결정, 문서 선택은 별도 단계
- feat(planning-interview): SKILL.md v2.0 전면 재작성
  - Phase 1: PRD (Lean Canvas / Product Brief / Full PRD)
  - Phase 2: User Journey Map (신규)
  - Phase 3: Technical Specification (spec-interview에서 이식)
  - Phase 4: Wireframe Specification (신규)
  - Mode×Phase 질문 수 매트릭스: Solo(4/3/4/3), Startup(6/5/6/4), Team(9/7/9/6)
  - Session state v2.0: phases_selected, phase_state[1-4], shared_context
  - Cross-phase context: Phase 1 답변을 Phase 2-4에서 참조
- feat(planning-interview): 신규 템플릿 3개 생성 — user-journey-map.md, tech-spec.md, wireframe-spec.md
- chore: 기존 템플릿 3개 v2.0 업데이트 (lean-canvas, product-brief, full-prd)
- chore: plugin.json v1.0.0 → v2.0.0 업데이트
- fix: link-local.sh 실행으로 심링크 재연결 (파일 복사본 → 심볼릭 링크로 교체)
- feat(planning-interview): Step 2.5 Context Import 추가
  - 트리거에 내용 포함(~50단어+) 시 자동 감지, 질문 없이 바로 추출
  - 추출 항목: problem, solution, users, features, tech_stack → Phase 인터뷰 질문 skip 로직 연동
  - 예상 질문 감소: 6Q → 2-3Q (Solo/Startup), 9Q → 4-5Q (Team)

### 주요 결정

- **문서 제거 판단** (오버 엔지니어링): SDD → Tech Spec Architecture 섹션으로 흡수, 독립 IA 파일 → Wireframe Spec으로 흡수
- **Context Import UX**: 트리거에 내용 포함 시 질문 건너뜀, 짧은 트리거 시에만 선제 질문

### 다음

- [ ] AskUserQuestion freeform 질문 옵션 최소 2개 요건 전수 점검
- [ ] 새 세션에서 E2E 테스트 (Context Import 동작 검증)

---

## planning-interview (15:19)

> AskUserQuestion 제약 전수 점검 및 수정 — freeform 질문 처리 방식 명확화, Step 5 옵션 수 초과 버그 수정

### 한 일

- fix(planning-interview): Step 5 Document Selection 옵션 수 초과 수정 — 5개 → 4개 (AskUserQuestion max 4 제약 준수)
- fix(planning-interview): Interview Question Convention 섹션 추가
  - Steps 7–14 인터뷰 질문의 `allow_freeform=true` 표기는 pseudo-code임을 명시
  - 실제 AskUserQuestion 도구 호출 금지, plain text 출력으로 처리 규칙 추가
  - 두 가지 질문 유형(구조적 선택 vs 자유 응답) 테이블로 명확화

### 주요 결정

- **freeform 질문 처리 전략**: 60개+ 개별 질문 블록 수정 대신, 단일 Convention 섹션으로 전체 규칙 선언 — 유지보수성 우선

### 다음

- [ ] 새 세션에서 `/planning-interview` E2E 실행 검증

---

## plugin-tester (17:16)

> plugin-tester 플러그인 아이디어 구체화 — 5-agent 아키텍처 설계 및 설계 문서 작성

### 한 일

- docs: LLM-driven 플러그인의 결정론적 테스트 한계 분석 — "문서 정합성 검증"과 "실행 검증" 두 레이어 정의
- docs: 검증 범위 확정 — SKILL.md, agent 파일, README.md, plugin.json + 교차 검증 항목
- docs: 5-agent 아키텍처 설계
  - doc-collector (haiku) → static-linter (sonnet) → behavior-reviewer (sonnet) → scenario-runner (sonnet) → test-reporter (haiku)
  - Phase 1 (직렬) → Phase 2 (병렬) → Phase 3 (시뮬레이션) → Phase 4 (리포트)
- docs: 판정 체계 설계 — 10점 만점 체크리스트 기반, PASS / WARN / FAIL 등급
- docs: `docs/plugin-tester-design.md` 작성 완료

### 주요 결정

- **v1.0 범위 축소**: static-linter + behavior-reviewer만 시작 — 가장 신뢰도 높고 비용 낮음. scenario-runner는 v1.1에서 추가
- **체크리스트 기반 판정**: LLM 주관적 판단 대신 명시적 기준 채점 → 재현성 확보

### 다음

- [ ] plugin-tester 플러그인 실제 구현 시작
- [ ] v1.0 에이전트 파일 작성 (static-linter, behavior-reviewer)
- [ ] `skills/plugin-tester/SKILL.md` 실행 알고리즘 작성
- [ ] 기존 플러그인 대상 시범 테스트 실행

---

## lingua-rag (17:16)

> lingua-rag 리포 README 다이어그램 추가 + docs/ 이전, competitive-agents SKILL.md Step 11.5 개선 검증

### 한 일

- docs: README.md에 Mermaid 다이어그램 3개 추가
  - 시스템 아키텍처 (graph TB): 브라우저 → Vercel → Railway → DB → Claude 전체 구성
  - SSE 채팅 흐름 (sequenceDiagram): 전체 스트리밍 플로우
  - DB 스키마 (erDiagram): sessions ↔ conversations ↔ messages 관계도
- docs: `projects/lingua-rag/docs/` 3개 파일 lingua-rag repo `/docs/`로 이전 및 push
  - `decisions.md` (ADR-001~004), `f1-streaming-qa-spec.md`, `dev-log.md`
- chore: competitive-agents SKILL.md Step 11.5 개선 완료 검증 (grep으로 4개 편집 확인)

### 다음

- [ ] dev-log.md에 첫 개발 세션 기록 (로컬 환경 세팅 시작 시 작성)

---

## competitive-agents (17:16)

> competitive-agents SKILL.md Step 11.5 추가 — 파이프라인 최종 결과물에 프로젝트 문서(ADR, dev-log, spec) 자동 생성

### 한 일

- feat: Step 1에 "Project Docs" 질문 추가 (rounds 수와 함께 한 번에 제시)
  - "Yes — generate docs/ (Recommended)": `final/docs/`에 decisions.md, dev-log.md, spec.md 생성
  - "No — skip docs": 빠른 실험이나 플러그인만 필요한 경우 스킵
- feat: Step 11.5 신규 추가 (Step 11 Execute Decision과 Step 12 Completion Summary 사이)
  - `final/docs/decisions.md`: judge-report의 Strengths to Preserve + per-criterion 점수 + mission에서 ADR 3~6개 자동 추출
  - `final/docs/dev-log.md`: 개발 일지 빈 템플릿
  - `final/docs/spec.md`: spec 파일 제공 시에만 복사
  - 서브에이전트 없이 Claude가 인라인으로 생성 (mission, judge-report가 이미 컨텍스트에 존재)
- docs: Step 12 완료 요약 업데이트 + Quick Reference 출력 트리 업데이트

### 주요 결정

- **인라인 생성 방식 채택**: judge-report와 mission이 이미 메모리에 있으므로 별도 에이전트 없이 직접 생성. 더 빠르고 컨텍스트 손실 없음
- **ADR 소스 = judge-report**: "Strengths to Preserve", "Why Winner", per-criterion 분석이 자연스럽게 아키텍처 결정 사항을 담고 있음
- **opt-in 방식**: 기본 권장(Recommended)이지만 선택 가능 → 빠른 실험 케이스 대응
- **트리거**: LinguaRAG F1 fused 결과물에 decisions.md 없어 repo 이전 시 수동 작성 필요했던 경험 → 자동화

### 다음

- [ ] competitive-agents 실행 후 Step 11.5 동작 검증 (generate_docs = Yes 선택)
  - [ ] decisions.md ADR 품질 확인
  - [ ] dev-log.md 템플릿 형식 확인
  - [ ] spec 파일 제공 시 spec.md 복사 동작 확인
- [ ] decisions.md ADR 포맷 표준화

---

## lingua-rag-planning-docs (18:15)

> planning-interview v2.0 E2E 테스트 — LinguaRAG를 대상으로 4종 기획 문서 생성 (PRD, User Journey Map, Tech Spec, Wireframe Spec)

### 한 일

- docs(lingua-rag): planning-interview v2.0 Startup 모드로 4종 기획 문서 생성
  - `projects/lingua-rag/prd.md` — Product Brief (기존 Product Brief 임포트 → GTM 1개 질문만 추가)
  - `projects/lingua-rag/user-journey-map.md` — 3 Journey (첫 방문/온보딩, 일반 Q&A, 단원 전환), 온보딩 6단계 ~2분, 리텐션 루프
  - `projects/lingua-rag/tech-spec.md` — 아키텍처(Next.js 15 + FastAPI + PostgreSQL + Railway/Vercel), 6 FR, 3-Phase 구현 계획, NFR
  - `projects/lingua-rag/wireframe-spec.md` — 4 화면 ASCII 레이아웃, 반응형/접근성

### 주요 결정

- **단원 패널 UI**: 트리 구조 (교재 > Band > 단원 펼치기/접기) — 드롭다운 대비 단원 간 컨텍스트 가시성 우수
- **입력창 문자 카운터**: 우하단 실시간 표시 ("48/500") — 초과 시에만 표시보다 예측 가능성 높음
- **v0.1 Auth 전략**: 없음(단일 사용자 private) → v0.3에서 NextAuth.js 이메일 Magic Link 추가 예정
- **컨텍스트 윈도우**: 최근 10개 메시지 sliding window — v0.2에서 요약 압축 검토

### 다음

- [ ] tech-spec.md 기반 Phase 1 구현 착수 (FastAPI POST /api/chat SSE)
- [ ] wireframe-spec.md 기반 채팅 UI 구현 (Next.js 15)

---

## planning-interview (18:15)

> planning-interview E2E 전체 검증 완료 — LinguaRAG Product Brief 임포트 후 4종 문서 생성 성공

### 한 일

- test(planning-interview): E2E 전체 흐름 검증 (Startup Mode, 4-Phase, 기존 문서 임포트 경로)
  - Step 2.5 Context Import: "기존 문서 있음" 선택 → LinguaRAG Product Brief 임포트 정상 동작 ✅
  - shouldSkipQuestion: Phase 1 6개 질문 중 5개 자동 스킵 (pre-filled), GTM 1개만 질문 ✅
  - Phase 2 인터뷰: plain text 질문 정상 출력 (AskUserQuestion 미호출), 2개 질문 ✅
  - Phase 3/4 인터뷰: 각각 스킵 로직 + 남은 질문 정상 수행 ✅
- feat(lingua-rag): planning-interview로 4종 기획 문서 생성 완료

### 주요 결정

- **Phase 4 단원 패널**: 트리 구조 채택 — 드롭다운 대비 단원 맥락 파악 용이
- **입력창 카운터**: 우하단 실시간 "48/500" 항상 표시

### 다음

- [ ] planning-interview 실전 테스트 피드백 기반 SKILL.md 개선 검토
  - Phase 간 handoff 메시지 명확성
  - shouldSkipQuestion 스킵 시 사용자 알림 문구 자연스럽게 개선

---

## truth-checker (20:30)

> 거짓 내용 분석 서비스 Truth Checker 아이디어 도출 및 종합 문서 작성 — 한국어 특화 팩트체킹 서비스

### 한 일

- feat: Truth Checker 서비스 아이디어 도출
  - 구름 DeepDive 참고 분석, AI Hub 낚시성 기사 탐지 데이터셋 (71,338건) 확인
  - 사용자 기술 스택 매칭 (React, Claude API, Recharts, Supabase)
- docs: 종합 아이디어 문서 작성 (`truth-checker-service-idea.md`, 30+ 섹션)
  - Problem: 허위정보 범람, 팩트체크 도구 부족, 시장 규모
  - Solution: 5단계 검증 파이프라인
  - Core Features: 입력(URL/텍스트/이미지), 클레임 추출(Claude API), 출처 신뢰도 분석(A-D 등급), 낚시성 탐지(AI Hub 데이터), 유사 오보 검색, 신뢰도 점수(0-100), 시각화 대시보드
  - Business Model: Freemium ($0/$10/$30), B2B ($500-2k)

### 주요 결정

- **서비스명**: Truth Checker
- **MVP 기간**: 4주 (Week 1: 클레임 추출+출처 검증, Week 2: Fact Checking 엔진, Week 3: 시각화, Week 4: AI Hub 데이터 통합)
- **핵심 차별화**: 한국어 특화 + 모든 콘텐츠 지원(URL/텍스트/이미지) + 빠른 검증 (10-30초 vs SNU 팩트체크 수일)
- **신뢰도 점수 공식**: 출처(30%) + 교차검증(40%) + 논리(30%) = 100점
- **Tech Stack 최종**: React 18+TypeScript+Vite, Recharts+React Flow, Node.js+Supabase, Claude API+KoBERT fine-tuned

### 다음

- [ ] AI Hub 낚시성 기사 데이터셋 다운로드 신청
- [ ] React 프로젝트 초기화
- [ ] MVP Week 1 개발 시작 (URL 입력폼, Cheerio 크롤링, Claude API 클레임 추출)
- [ ] MVP 스펙 상세화 (planning-interview 스킬 활용 고려)
