# AI Learning Notes

AI 학습과 실험 기록을 정리하는 개인 레포지토리입니다.

**Blog**: [https://jaykim88.github.io/AI-LEARNING-NOTE/](https://jaykim88.github.io/AI-LEARNING-NOTE/)

## 구조

```
ai-learning/
├── blog/                    # Astro 블로그 (GitHub Pages 자동 배포)
│   ├── src/content/
│   │   ├── digests/         # AI 아티클/뉴스 다이제스트
│   │   └── learnings/       # 실전 학습 기록
│   ├── src/pages/           # 페이지 라우팅
│   └── scripts/migrate.ts   # 콘텐츠 마이그레이션 스크립트
├── digests/                 # 원본 다이제스트 (마이그레이션 전)
├── learnings/               # 원본 학습 노트 (마이그레이션 전)
├── docs/                    # 기획 문서 (Lean Canvas, Spec)
├── topics/                  # 주제별 정리
└── resources/               # 참고 자료
```

## 콘텐츠 작성

### 블로그에 직접 작성 (권장)

`blog/src/content/learnings/` 또는 `blog/src/content/digests/`에 frontmatter 포함 MD 파일 작성 후 push.

### Claude Code 스킬 활용

| 스킬 | 트리거 | 저장 위치 |
|------|--------|----------|
| `learning-summary` | "배운 내용 문서화" | `blog/src/content/learnings/` |
| `ai-digest` | "/ai-digest [URL]" | `blog/src/content/digests/` |

```bash
# 로컬 개발
cd blog && npm run dev

# 빌드
npm run build

# 배포: main push → GitHub Actions 자동 배포
git push
```

## 목적

- AI 관련 지식 축적 및 공유
- 실전 학습 과정을 투명하게 기록
- 개인 브랜딩/포트폴리오 채널
