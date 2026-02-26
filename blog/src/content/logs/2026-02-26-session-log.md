---
title: "2026-02-26 작업 로그"
date: 2026-02-26
description: "debate-plugin: 5-layer AI quality system + debate v2 멀티라운드 엔진, prism-debate 리네임 + 에이전트 확장, competitive-agents: planning-interview 연결..."
tags: ["debate-plugin", "competitive-agents"]
---

## 오늘 작업한 주제

- [debate-plugin (17:44)](#debate-plugin-1744)
- [debate-plugin (20:06)](#debate-plugin-2006)
- [competitive-agents (20:40)](#competitive-agents-2040)

---

## debate-plugin (17:44)

> 5-layer AI quality system 구현 + think-deep → debate v2 리네임 + 멀티라운드 tiki-taka 토론 엔진 설계 및 구현

### 한 일

- feat: 5-layer AI quality system 설계 및 구현
  - Layer 3 (Output Quality): `~/.claude/CLAUDE.md`에 Claim Labeling 규칙 추가 ([FACT]/[ESTIMATE]/[OPINION]/[UNCERTAIN])
  - Layer 5 (Usage Quality): `~/.claude/CLAUDE.md`에 Question Routing 테이블 추가 (technical/values-based/prediction 분류)
  - Layer 1 (Input Quality): `~/.claude/context/` 인프라 생성 (values.md, constraints.md, decision-log.md)
  - Layer 2 (Process Quality): debate 플러그인으로 구현
  - Layer 4 (Validation Quality): decision-log.md 템플릿으로 구현
- feat(debate): `think-deep` → `debate` 플러그인 리네임 (v2.0.0)
- feat(debate): v2 멀티라운드 토론 엔진 구현 — Mode 0(빠른 판결) / Mode 1(자율 토론) / Mode 2(참여형 토론)
- feat(debate): 컨텍스트 자동 감지 기능 추가 — "debate"만 입력해도 최근 대화에서 결정 주제 자동 추출
- feat(debate): 에이전트 4개 Round N Behavior 추가 — 포지션 추적 ([MAINTAINED/PARTIALLY_CONCEDED/SHIFTED]), 교차 반박 규칙
- feat(debate): llm-council 개념 선택적 채택 — 교차 반박·포지션 추적·수렴 감지 채택, 익명화 미채택
- chore: `~/.claude/context/` 개인화된 컨텍스트 파일 생성 (values.md, constraints.md, decision-log.md)

### 주요 결정

- **debate vs 별도 재검증 도구**: Layer 3 always-on claim labeling이 일상 답변 신뢰성 커버, debate Mode 0이 집중 재검증 커버 → 별도 도구 불필요
- **익명화 미채택**: llm-council의 익명화는 다중 LLM prestige bias 방지용 — 단일 Claude 모델에서는 역할명이 tiki-taka 구조에 필요하므로 미채택
- **Claude Max = 추가 API 비용 없음**: Task() 호출은 구독 내 포함, 라운드 제한 불필요

### 다음

- [ ] debate Mode 0으로 실제 결정 테스트 (e.g. 기술 스택 선택, 커리어 결정)
- [ ] decision-log.md 첫 번째 실제 엔트리 기록
- [ ] "verify" 모드 추가 검토: 특정 Claude 답변을 debate 에이전트로 사후 검증하는 shortcut
- [ ] Layer 1 강화: `~/.claude/context/` 파일들 실제 사용하며 업데이트

---

## debate-plugin (20:06)

> debate → prism-debate 리네임 + 에이전트 2개 신규 추가 (Alternative, Pre-Mortem) + Worldview 캐릭터화 + README v2 (Mermaid + How It Works)

### 한 일

- feat(prism-debate): `debate` → `prism-debate` 리네임 (v3.0.0) — `plugins/debate/` → `plugins/prism-debate/`, 트리거 `prism`/`prism-debate`/`/prism`
- feat(prism-debate): 에이전트 2개 신규 생성
  - `agents/alternative.md` — "The Inventor" (REFRAME): 명제 밖 대안 2-3개 구체 제시, De Bono Green Hat 기반
  - `agents/pre-mortem.md` — "The Oracle" (FUTURE FAILURE): 실패 기정사실로 두고 역추적, 5 Whys 인과 체인. Gary Klein PreMortem 기반
- feat(prism-debate): 모든 에이전트 Worldview 캐릭터화 (Moltbook 인사이트)
  - Optimist → "The Builder" / Critic → "The Skeptic" / Pragmatist → "The Operator" / Synthesizer → "The Judge"
- feat(prism-debate): SKILL.md Core/Extended 에이전트 선택 로직 추가 — Core 3(Optimist+Critic+Pragmatist) / Extended 5(+Alternative+Pre-Mortem)
- docs(prism-debate): README v2 전면 개선 — Mermaid 다이어그램 2개, How It Works, Context Integration, Output Reference 섹션
- docs(prism-debate): CLAUDE.md 전면 업데이트 (v3.0.0 아키텍처, 에이전트 테이블, 검증 체크리스트)

### 주요 결정

- **이름 prism-debate**: "prism"(목적: 다각 분석) + "debate"(메커니즘: 교차 반박) 합성으로 왜/어떻게 동시 전달
- **De Bono Six Hats 매핑**: Yellow(Optimist) + Black(Critic) + White(Pragmatist) + Green(Alternative) + 별도 Oracle(Pre-Mortem)
- **Moltbook 인사이트**: 스탠스(FOR/AGAINST)보다 Worldview(세계관)가 에이전트를 더 일관되고 예측 가능하게 만듦
- **Alternative 우선 추가**: 이분법 맹점(A vs not-A)이 가장 보편적 blind spot → 첫 확장 에이전트
- **Pre-Mortem은 Critic과 다름**: Critic은 순방향 위험 식별, Pre-Mortem은 실패 기정사실 + 역추적 → 별도 에이전트 정당화
- **2-티어 구조**: Core 3(항상) + Extended 2(선택) — 복잡도 최소화 vs 분석 깊이 균형

### 다음

- [ ] prism-debate Mode 0 Core로 실제 결정 테스트 (e.g. 기술 스택, 커리어 결정)
- [ ] prism-debate Extended 모드 테스트 — Alternative + Pre-Mortem 실제 동작 확인
- [ ] decision-log.md 첫 번째 실제 엔트리 기록
- [ ] Future agents 설계: Gut Check (Red Hat / 직관·가치관) + Red Team (악의적 공격 시뮬레이션)
- [ ] Layer 1 강화: `~/.claude/context/` 파일들 실제 토론에서 사용하며 업데이트

---

## competitive-agents (20:40)

> planning-interview outputs를 competitive-agents 입력으로 연결 + dev-log.md 제거 + frontmatter version 필드 제거

### 한 일

- feat(competitive-agents): Step 1에 "Use planning-interview outputs" 옵션 추가 — 디렉토리 경로 입력받아 prd.md, user-journey-map.md, tech-spec.md, wireframe-spec.md 읽어 mission context로 합산
- feat(competitive-agents): Step 11.5에 planning-interview docs 복사 로직 추가 — `planning_docs_path` 설정 시 `final/docs/`에 파일명 그대로 복사
- chore(competitive-agents): Step 11.5에서 `dev-log.md` 생성 제거 — 빈 템플릿이라 실질 가치 낮음
- fix(competitive-agents): SKILL.md frontmatter에서 `version` 필드 제거 — skill 파일에서 지원되지 않는 속성 (IDE 경고 해소)
- docs(competitive-agents): Step 12 완료 요약 및 Quick Reference 출력 트리에 planning-interview docs 항목 반영

### 주요 결정

- **planning-interview → competitive-agents 연결**: planning-interview가 prd/user-journey/tech-spec/wireframe 4개를 생성하므로, 이를 그대로 mission context로 활용하는 것이 자연스러운 워크플로우
- **dev-log.md 제거**: 빈 템플릿은 생성 가치가 낮고, 사용자가 직접 만드는 편이 나음. decisions.md (ADR)만으로 프로젝트 히스토리 충분
- **version 필드 제거**: Claude Code skill 파일에서 지원되지 않는 속성임을 확인 → 완전 제거

### 다음

- [ ] competitive-agents 실행 후 Step 11.5 동작 검증 (generate_docs = Yes 선택)
  - [ ] decisions.md ADR 품질 확인 — judge report에서 올바르게 추출되는지 테스트
  - [ ] spec 파일 제공 시 spec.md 복사 동작 확인
- [ ] planning-interview → competitive-agents 전체 플로우 테스트 — planning-interview로 4개 docs 생성 → competitive-agents "Use planning-interview outputs" 선택 → final/docs/ 확인
