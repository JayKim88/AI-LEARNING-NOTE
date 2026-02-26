---
title: "2026-02-27 작업 로그"
date: 2026-02-27
description: "wrap-up: wrap-to-blog 스킬 구현 + ActivityCalendar 확장, blog-logs-activity: Logs 컬렉션 + ActivityCalendar 추가"
tags: ["wrap-up", "blog-logs-activity"]
---

## 오늘 작업한 주제

- [wrap-up](#wrap-up)
- [blog-logs-activity](#blog-logs-activity)

---

## wrap-up

> wrap-to-blog 스킬 구현 + 블로그 ActivityCalendar를 모든 컬렉션으로 확장

### 한 일

- feat: `wrap-to-blog` 스킬 구현 (`plugins/wrap-up/skills/wrap-to-blog/SKILL.md`) — wrap-up 완료 후 블로그 logs 컬렉션에 세션 기록 자동 저장
- feat: `config.yaml`에 `blog_log` 섹션 추가 (enabled flag, blog_dir, collection)
- feat: `SKILL.md` Step 6 추가 — `blog_log.enabled` 확인 후 블로그 로그 생성 여부 프롬프트
- feat: blog `logs` 컬렉션 스키마 추가 (`src/content/config.ts`)
- feat: blog에 logs 목록/상세 페이지 추가 (`src/pages/logs/index.astro`, `[...slug].astro`)
- feat: `ActivityCalendar` 컴포넌트 구현 — GitHub 잔디 스타일, 52주×7일, 순수 CSS Grid
- feat: blog 홈에 Activity 섹션 + Header에 Logs 네비 추가
- feat: `ActivityCalendar`를 digests/learnings/logs 통합 지원으로 확장
- feat: `ActivityEntry` 타입 + `getAllByDateMap()` 추가 (`posts.ts`) — 3개 컬렉션 통합 날짜 맵
- feat: 툴팁에 각 글 제목을 클릭 가능한 링크로 렌더링, 150ms hover delay로 마우스 이동 시 툴팁 유지
- chore: `wrap-to-blog` 심링크 등록 (`~/.claude/skills/wrap-to-blog`)
- feat: `CLAUDE.md`에 Session Management 규칙 추가 — 주제 전환 시 wrap-up 제안

### 주요 결정

- **wrap-to-blog를 별도 스킬로 분리**: Step 6에서 자동 호출하거나 `/wrap-to-blog`로 독립 실행 모두 가능
- **ActivityCalendar 통합 dateMap**: logs 전용 → 3개 컬렉션 통합으로 확장, `ActivityEntry { title, url }` 타입으로 추상화
- **툴팁 hover delay 방식**: `pointer-events: auto` + mouseenter/mouseleave + 150ms timeout으로 tooltip 내 링크 클릭 가능하게 구현
- **config.yaml 재사용**: 이전 세션에서 "불필요 파일"로 지정했으나, `blog_log` 섹션으로 용도가 생겨 유지

### 다음

- [ ] 프로젝트 변경사항 커밋 (wrap-to-blog 스킬 + blog 변경사항)
- [ ] 실제 wrap-up → wrap-to-blog 엔드투엔드 플로우 테스트
- [ ] blog GitHub Pages 배포 후 ActivityCalendar 동작 확인
- [ ] plugin.json 버전 업데이트

---

## blog-logs-activity

> AI Learning Blog에 Logs 컬렉션 + GitHub 스타일 ActivityCalendar 추가

### 한 일

- feat(blog/content): `logs` 컬렉션 추가 — `logSchema` 정의(title, date, description, tags), `config.ts` 등록
- feat(blog/pages): `logs/index.astro` — 날짜 역순 로그 목록 페이지
- feat(blog/pages): `logs/[...slug].astro` — 개별 로그 상세 페이지
- feat(blog/components): `ActivityCalendar.astro` — GitHub 스타일 연간 기여 히트맵 (월 레이블, 요일 레이블, 강도 4단계, 툴팁, 연도 선택, 날짜 클릭 드릴다운, Show more 페이지네이션)
- feat(blog/utils): `posts.ts`에 `getAllLogs()`, `getLogsByDateMap()`, `getAllByDateMap()` 추가
- feat(blog/pages): `index.astro` 홈에 Activity 섹션 통합
- feat(blog/components): `Header.astro`에 "Logs" 내비게이션 항목 추가
- chore(blog/content): 샘플 로그 4개 추가 (2026-02-23 ~ 2026-02-27)

### 주요 결정

- `getAllByDateMap()`으로 logs + digests + learnings 전체를 날짜 기준 집계해 하나의 캘린더에 표시
- 캘린더 렌더링은 클라이언트 사이드 JS (data-cal JSON payload) — Astro SSG 호환
- UTC 날짜 연산 (`T12:00:00Z`) 사용 — KST timezone offset(+9)에 의한 날짜 shift 방지
- 미래 날짜 투명 처리 (클릭 불가), 당해 연도 12월 31일까지 전체 렌더링
- 연도 선택기로 다년도 전환 지원; 기본값은 현재 연도

### 다음

- [ ] 다크 모드 지원 — 현재 셀 색상이 GitHub 고정 초록색 (CSS 변수로 교체 필요)
- [ ] Logs 목록 페이지에 태그 필터링 추가
- [ ] 검색 기능 검토 (Pagefind 등)
- [ ] 로그 엔트리 지속 추가해 캘린더 채우기
- [ ] 변경 사항 배포 후 GitHub Pages에서 동작 검증
