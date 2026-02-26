# Blog Logs & Activity Calendar - Wrap Up

> **Project**: `/Users/jaykim/Documents/Projects/ai-learning`
> **Scope**: `blog/`

## Session: 2026-02-27 01:29

> **Context**: AI Learning Blog에 Logs 컬렉션 + GitHub 스타일 ActivityCalendar 추가

### Done

- feat(blog/content): `logs` 컬렉션 추가 — `logSchema` 정의 (title, date, description, tags), `config.ts` 등록
- feat(blog/pages): `logs/index.astro` — 날짜 역순 로그 목록 페이지
- feat(blog/pages): `logs/[...slug].astro` — 개별 로그 상세 페이지
- feat(blog/components): `ActivityCalendar.astro` — GitHub 스타일 연간 기여 히트맵 (월 레이블, 요일 레이블, 강도 4단계, 툴팁, 연도 선택, 날짜 클릭 드릴다운, Show more 페이지네이션)
- feat(blog/utils): `posts.ts`에 `getAllLogs()`, `getLogsByDateMap()`, `getAllByDateMap()` 추가 — 전체 컬렉션 날짜 집계
- feat(blog/pages): `index.astro` 홈에 Activity 섹션 통합 (log 카운트 표시, ActivityCalendar 렌더링)
- feat(blog/components): `Header.astro`에 "Logs" 내비게이션 항목 추가
- chore(blog/content): 샘플 로그 4개 추가 (2026-02-23 ~ 2026-02-27)

### Decisions

- `getAllByDateMap()`으로 logs + digests + learnings 전체를 날짜 기준으로 집계해 하나의 캘린더에 표시
- 캘린더 렌더링은 클라이언트 사이드 JS (data-cal JSON payload 방식) — Astro SSG와 호환
- UTC 날짜 연산 (`T12:00:00Z`) 사용 — timezone offset(KST +9)에 의한 날짜 shift 방지
- 미래 날짜는 투명 처리 (클릭 불가), 당해 연도 12월 31일까지 전체 렌더링
- 연도 선택기로 다년도 전환 지원; 기본값은 현재 연도

### Next

- [ ] 다크 모드 지원 — 현재 캘린더 셀 색상이 GitHub 고정 초록색 (CSS 변수로 교체 필요)
- [ ] Logs 목록 페이지에 태그 필터링 추가
- [ ] 검색 기능 검토 (Pagefind 등)
- [ ] 로그 엔트리 지속 추가해 캘린더 채우기
- [ ] 변경 사항 배포 후 GitHub Pages에서 동작 검증
