# Blog Logs & Activity Calendar - Wrap Up

> **Project**: `/Users/jaykim/Documents/Projects/ai-learning`
> **Scope**: `blog/`

## Session: 2026-03-02 23:55

> **Context**: 블로그에 Plugins Showcase 섹션 추가 — sync 스크립트, 카테고리 그룹핑, Mermaid 라이트박스

### Done

- feat(blog/scripts): `sync-plugins.ts` 작성 — `claude-ai-engineering/plugins/` 에서 README.md 읽어 `src/content/plugins/` 에 frontmatter 자동 생성하여 저장. title(H1), description(bold 또는 첫 문단), agentCount(N-agent 패턴), category(플러그인명 매핑), tags(키워드 휴리스틱), lastUpdated(파일 mtime) 추출
- feat(blog/content): `config.ts`에 `pluginSchema` + `plugins` 컬렉션 추가 (`title`, `description`, `category`, `agentCount`, `tags`, `lastUpdated`)
- feat(blog/pages): `pages/plugins/index.astro` — 포트폴리오 intro 섹션(22개 플러그인, 총 agent 수), 카테고리별 그룹핑(5개 섹션), agent count 뱃지, `<div>` + overlay `<a>` 카드 패턴
- feat(blog/pages): `pages/plugins/[...slug].astro` — PostLayout 재사용 (Mermaid, TOC, reading time 자동 지원)
- feat(blog/components): `Header.astro`에 "Plugins" 내비게이션 항목 추가
- feat(blog/layouts): `PostLayout.astro`에 Mermaid 라이트박스 추가 — 클릭 시 확대 모달, SVG viewBox 보존 후 width/height 제거로 fill 적용, 닫기는 오버레이 클릭
- chore(blog): `package.json`에 `"sync-plugins": "tsx scripts/sync-plugins.ts"` 스크립트 추가
- fix(blog/pages): 카드 내부 TagBadge(`<a>`) + 카드 래퍼(`<a>`) nested anchor 버그 수정 → `<div>` + `card-overlay` 패턴으로 교체
- fix(blog/layouts): Mermaid 라이트박스 모달이 원본보다 작던 문제 — SVG 고정 width/height 제거, `width: min(92vw, 1100px)` 적용
- fix(blog/pages): Astro nested ternary + double-nested `.map()` 패턴이 inner children 드롭하는 버그 → sections를 frontmatter JS 블록에서 사전 계산하여 단순 `.map()` 한 겹으로 변경

### Decisions

- sync 스크립트 결과물을 git에 커밋 — 빌드 시 외부 경로 접근 불필요, GitHub Pages CI 호환
- `lastUpdated`는 `fs.statSync().mtime` 사용 — 스크립트 실행일이 아닌 실제 README 수정일
- 카테고리 사전 계산을 Astro frontmatter JS 블록에서 처리 — Astro JSX 중첩 렌더링 버그 회피
- PostLayout을 플러그인 상세 페이지에 그대로 재사용 — Mermaid, TOC 등 기존 기능 무료 획득

### Issues

- Astro JSX에서 `{condition ? A : B.map(...)}` + 내부 중첩 `.map()` 패턴이 children을 드롭하는 렌더링 버그 확인 — frontmatter 사전 계산으로 우회
- TagBadge(`<a>`) + 카드(`<a>`) 중첩 → 브라우저가 outer `<a>`를 강제 닫아 빈 ghost 요소 생성 — overlay 패턴으로 해결

### Next

- [ ] 변경 사항 배포 후 GitHub Pages에서 plugins 섹션 동작 검증
- [ ] 홈 페이지 stats에 plugin 수 추가 검토
- [ ] 일부 플러그인 agentCount가 추출 안 됨 (명시적 "N-agent" 패턴 없는 경우) — 수동 보완 또는 추출 로직 개선 고려
- [ ] 다크 모드에서 Mermaid 라이트박스 배경색(흰색 고정) 개선 필요

---

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
