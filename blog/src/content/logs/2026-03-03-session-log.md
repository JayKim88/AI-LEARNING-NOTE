---
title: "2026-03-03 작업 로그"
date: 2026-03-03
description: "business-avengers: Phase 0 Q&A 재설계 + PM knowledge doc, lingua-rag: LLM-as-Judge eval 시스템 구축 + PDF hover UX + chat cancel"
tags: ["business-avengers", "lingua-rag"]
---

## 오늘 작업한 주제

- [business-avengers](#business-avengers)
- [lingua-rag](#lingua-rag)

---

## business-avengers

> Per-phase fine-tuning kick-off — Phase 0 ideation Q&A redesign + JTBD/Why Now additions, Phase 2 PM knowledge doc creation

### 한 일

- Phase 0 Q&A를 5개 거래형 질문 → 7개 탐색형 질문으로 재설계
  - 스토리 기반 문제 발견 ("마지막으로 이 문제를 겪었을 때 어땠나요?")
  - Why Now 질문 신설 ("왜 지금이 이걸 만들기 좋은 타이밍인가?")
  - Switching Trigger 질문 신설 ("기존 솔루션 사용자를 이탈하게 만드는 건 무엇인가?")
  - CPO가 "discovery mode" 프레이밍으로 대화 시작
- `agents/product-manager.md`에 Phase 0 전문 프레임워크 추가
  - Mom Test 적용 규칙 (과거시제 행동 묘사, 위양성 필터)
  - JTBD 작성 기준 — 3가지 직업 유형 (Functional / Emotional / Social)
  - Why Now 평가 (Technology / Behavioral / Regulatory / Cost shift 분류)
  - Competitive Moat Test (구조적 차별화 vs. 모방 가능 차별화)
  - Own Problem Validation 가이드
- `templates/idea-canvas.md`에 JTBD 섹션 + Why Now 섹션 추가
  - JTBD: Core statement 형식 + 3가지 직업 유형 필드 + Switching Trigger 필드
  - Why Now: Timing Trigger + Enablement + Opportunity Window 필드
- `quality/phase-rubrics.md` Phase 0 체크리스트 + 루브릭 확장
  - 체크리스트: JTBD 형식 검사 + Why Now 존재 검사 추가
  - 루브릭: 4개 → 6개 기준으로 확장 (JTBD 품질 + Why Now 추가)
- `SKILL.md` Step 4 PM 태스크 지시 강화
  - JTBD 3-type 필수 작성 (Functional/Emotional/Social + Switching Trigger)
  - Why Now 명시적 요구 (없으면 타이밍 리스크로 플래그)
  - 차별화 6개월 해자 테스트
  - "모든 플레이스홀더 필수 작성" 규칙 추가
- `knowledge/extended/prd-methods-advanced.md` 신규 생성
  - Inspired (Marty Cagan): 4가지 제품 리스크, Opportunity Assessment 10개 질문
  - Shape Up (Ryan Singer): Appetite 사이징, Pitch 형식, Shaping, Hill Charts
  - User Story Mapping (Jeff Patton): Backbone, Walking Skeleton, Release 슬라이스
  - Continuous Discovery (Teresa Torres): Opportunity Solution Tree, Assumption Testing
  - PRD 품질 기준: 아웃컴 메트릭, "Will NOT Build" 형식, RICE Confidence Gate
  - JTBD 기반 페르소나 형식 (행동 > 인구통계)
- `SKILL.md` Step 6 PM 태스크 강화 — knowledge doc 추가 + 6 → 18 단계로 확장

### 주요 결정

- Phase 0 Q&A 재설계: 거래형 5문항 → 탐색적 대화형 7문항 (Mom Test 원칙 적용)
- 에이전트 아키텍처: agent def = 역할 + 프레임워크 목록 (얇게) / knowledge doc = 심층 내용 + 예시 (Option B 채택)
- `prd-methods-advanced.md`: Shape Up + Inspired + Story Mapping을 파일 분리 없이 단일 참조 문서로 통합

### 다음

- [ ] Phase 0 업데이트 테스트 — 새 Q&A + JTBD/Why Now 섹션이 idea-canvas 출력에 제대로 채워지는지 검증
- [ ] Phase 1 (Market Research) 파인튜닝 — business-analyst, marketing-strategist, revenue-strategist 에이전트
- [ ] Phase 5 (Dev Guide) SKILL.md Step 9 강화 — frontend-dev + backend-dev + devops-engineer
- [ ] Phase 6 (QA) SKILL.md Step 10 강화 — qa-lead 태스크, Test Pyramid + Core Web Vitals 기준
- [ ] Phase 9 (Operations) SKILL.md Step 13 강화 — cs-manager + data-analyst 태스크
- [ ] 나머지 에이전트 Quality Standards 추가 — ui-designer, ux-researcher, coo, cto, cmo, cpo 등

---

## lingua-rag

> PDF hover/selection popup UX 개선 + 채팅 전송 취소 + LLM-as-Judge 평가 시스템 구축 (v0.3 Phase 1) + getText() fallback 개선

### 한 일

**PDF UX & 채팅 취소 (세션 1)**
- feat(pdf): hover popup 버튼 "채팅창에 붙여넣기" → "질문하기" 이름 변경, [Ask, Read] → [Sound, Ask] 순서 변경
- fix(pdf): 버튼 클릭 active 효과 표시 — `onMouseDown: e.preventDefault()` / `onClick: action+close` 분리
- fix(pdf): Sound 버튼 클릭 시 팝업 유지, `onMouseLeave`에서만 닫힘
- fix(pdf): hover popup 외부 클릭 시 닫힘 + selection popup 닫힌 직후 재출현 방지 (2-layer guard)
- feat(pdf): selection popup `onMouseLeave` — 자동 닫힘 + 선택 영역 해제
- fix(pdf): hover detection 강화 — `extractSentenceText` 결과에 Latin 문자 체크 추가
- feat(chat): `useChat` — `cancelMessage` 구현 (queue clear + `AbortController.abort()`)
- feat(chat): 스트리밍 중 전송 버튼 → 빨간 정지(■) 버튼으로 교체, 취소 시 "_응답이 취소되었습니다._" 표시

**LLM-as-Judge & 프롬프트 개선 (세션 2)**
- fix(frontend): `MessageList.tsx` — tight list `<li>` 아이템에 `LineWithActions` 적용 (이전: `<p>` 만 처리)
- feat(eval): `scripts/test_questions.json` — 10개 고정 테스트 질문 (단원별 포맷 유혹 케이스)
- feat(eval): `scripts/evaluate.py` — LLM-as-judge runner 구현
  - 6가지 규칙: german_bold_complete, no_markdown_table, translation_inline, dialogue_structure, example_length_ok, tip_included
  - Judge 모델: claude-sonnet-4-6 (Haiku → Sonnet 업그레이드)
  - `_parse_judge_json()`: markdown fence 제거 + JSON boundary fallback + retry
- fix(prompts): `ANSWER_FORMAT` bold 규칙 강화 — 괄호 안, 헤딩, 국가명, 형태소 예시 추가
- chore(eval): Baseline 실행 → 프롬프트 개선 후 **83.3% → 90.0%** 달성
- refactor(frontend): `getText()` fallback 개선 — Korean strip → Latin 단어 시퀀스 추출 (`/[a-zA-ZÀ-ÖØ-öø-ÿ]+/g`)
- docs: `docs/portfolio-story.md` 신규 생성 — AI Product Engineer 역량 매핑 + 면접 예상 질문

### 주요 결정

- **LLM-as-Judge 채택**: 골든 데이터셋 없이 실사용자 0명 상태에서도 품질 측정 가능. 형식 규칙은 Judge가 컨텍스트 이해 필요
- **Judge Sonnet 업그레이드**: Haiku가 어휘 목록 bold 여부 등에서 false positive 발생 → Sonnet 교체로 정확도 향상
- **`<strong>` = 의미적 독일어 마커**: Bold는 단순 스타일이 아니라 TTS 추출 메커니즘. LLM 준수율 개선이 근본 해결책
- **`getText()` Latin extraction**: 이 앱 컨텍스트에서 Latin 문자 = 독일어 (고신뢰). `<strong>` 1순위 + Latin 추출 fallback 구조 유지

**Sound Settings & Notes/Memo Feature (Session 3)**
- refactor(tts): simplified `useTTS` — removed pitch, voice selection; single Google Deutsch voice, auto-selected by `PREFERRED_VOICE_NAMES` priority
- feat(sound-modal): moved sound settings from user menu popover to centered modal with draft state pattern (X discards, Save commits to localStorage)
- feat(resize): chat panel drag handle double-click resets width to 560px
- feat(notes): full backend — `notes` table, `NoteRepository` with CRUD, `notes.py` router (`GET/POST/DELETE /api/notes`)
- feat(notes): full frontend — `lib/notes.ts` API helpers, Next.js proxy routes, "Memo" button in InputBar, memo write modal, Summary/Memo tabs in notes overlay
- feat(notes): ChatPanel overhaul — "Saved Summaries" renamed to "Notes" with combined badge (summaries + memos)

### 다음

- [ ] User Feedback UI — 응답 하단 👍/👎 버튼 + `message_feedback` DB 테이블 (v0.3 Phase 2)
- [ ] 실사용자 확보 — 채널 선정 (Reddit r/German, Discord, Naver 카페), 목표 10~20명
- [ ] Hover popup edge positioning — viewport top 오버플로우 시 아래 표시 fallback
- [ ] Run notes table migration in Supabase SQL editor (production)
- [ ] Verify `Connection: close` fix in production
