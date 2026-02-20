# Spec Interview Plugin 구현 - AskUserQuestion 도구를 활용한 AI 주도 요구사항 수집

## 핵심 개념

### 1. Spec Interview Plugin
Claude Code의 새로운 플러그인으로, **AI가 사용자를 인터뷰하는 방식**으로 요구사항을 수집합니다.

**기존 방식과의 차이:**
- **전통적**: 사용자가 요구사항 작성 → AI가 실행
- **Spec Interview**: AI가 질문 → 사용자가 답변 → AI가 요구사항 도출

### 2. AskUserQuestion 도구의 숨겨진 활용법
Claude Code에 내장된 `AskUserQuestion` 도구를 **Plan 모드 밖에서도** 적극적으로 활용하는 패턴입니다.

**도구 기능:**
```python
AskUserQuestion(
    questions=[
        {
            "question": "실제 질문 내용",
            "header": "짧은 레이블 (12자 이내)",
            "options": [
                {"label": "선택지 A", "description": "설명"},
                {"label": "선택지 B", "description": "설명"}
            ],
            "multiSelect": false  # true면 다중 선택 가능
        }
    ]
)
```

### 3. Simple Skill Pattern
Multi-agent가 아닌 **단일 스킬 패턴**으로 구현:
- 순차적 대화 흐름 (인터뷰는 병렬 처리 불가)
- AskUserQuestion이 상호작용 처리
- 에이전트 조정 불필요

### 4. 질문 품질의 중요성

**나쁜 질문 (피해야 할):**
- "보안이 중요한가요?" → 항상 yes
- "성능이 좋아야 하나요?" → 너무 모호
- "베스트 프랙티스를 따를까요?" → 의미 없음

**좋은 질문 (목표):**
- "두 명의 사용자가 동시에 같은 항목을 수정하면, 마지막 쓰기가 이기는 방식(last-write-wins)으로 할까요, 아니면 충돌을 감지할까요?"
- "외부 API가 다운되면 요청을 큐에 넣을까요, 아니면 즉시 에러를 표시할까요?"
- "더 유연한 아키텍처(구현 시간 더 걸림) vs 더 단순한 구현(빠르지만 확장 어려움) 중 어느 쪽을 우선시하나요?"

### 5. 실제 트레이드오프 제시

**나쁜 옵션:**
- Option A: 빠르고, 안전하고, 확장 가능 (명백히 좋음)
- Option B: 느리고, 불안전하고, 확장 불가 (명백히 나쁨)

**좋은 옵션:**
- Option A: 서버 사이드 렌더링 (SEO 좋음, 상호작용 느림)
- Option B: 클라이언트 렌더링 (빠른 상호작용, SEO 어려움)
- Option C: 하이브리드 (둘 다 장점, 복잡도 증가)

## 새로운 학습

### Before: Plan 모드에서만 AskUserQuestion 사용
- Plan 모드 진입 → 질문 → 승인 → 실행
- 계획 단계에서만 사용자 입력 받음

### After: 일반 Skill에서도 적극 활용 가능
- 일반 스킬이 AskUserQuestion을 직접 호출
- 여러 라운드에 걸쳐 반복 질문
- 대화형 요구사항 수집 가능

### Before: 사용자가 요구사항을 명확히 설명해야 함
```
User: "로그인 페이지 만들어줘. 이메일/비밀번호 인증이고, 소셜 로그인도 지원하고..."
→ 사용자가 모든 것을 생각해내야 함
```

### After: AI가 질문하며 요구사항 발견
```
User: "로그인 페이지 만들고 싶어"
AI: "인증 방식은? 세션 유지 시간은? 비밀번호 복구는? 다중 기기 로그인은?"
→ AI가 놓친 부분을 찾아줌
```

## 실무 적용 방법

### 1. 플러그인 구조 생성

```bash
# 템플릿 복사
cp -r templates/plugin-template plugins/spec-interview

# 스킬 디렉토리 리네임
mv plugins/spec-interview/skills/PLUGIN_NAME \
   plugins/spec-interview/skills/spec-interview

# 불필요한 디렉토리 제거 (Simple Skill이므로)
rm -rf plugins/spec-interview/agents
rm -rf plugins/spec-interview/commands
```

### 2. plugin.json 작성

```json
{
  "name": "spec-interview",
  "version": "1.0.0",
  "description": "AI-driven requirements gathering through in-depth interviews",
  "keywords": ["requirements", "interview", "specification", "planning"]
}
```

### 3. SKILL.md 핵심 알고리즘

```markdown
### Step 1: Parse Initial Request
- 주제 추출
- 컨텍스트 파악
- 집중 영역 식별

### Step 2: Generate First Question Set
- AskUserQuestion으로 2-4개 질문
- 6가지 카테고리 순환 (기술, UX, 비즈니스, 보안, 트레이드오프, NFR)
- 비자명한 질문만 선택

### Step 3: Analyze Responses
- 커버리지 추적 (✅ 완료, ⚠️ 더 필요, ❌ 미착수)
- 갭 식별
- 모호한 답변 표시

### Step 4: Generate Next Question Set
- 갭 기반 추가 질문
- 모호한 답변 심화
- 트레이드오프 검증

### Step 5: Determine Completion
- 3-5 라운드 (간단한 기능)
- 5-8 라운드 (복잡한 프로젝트)
- 수확 체감 시 종료

### Step 6-9: Generate & Save Spec
- 12개 섹션 템플릿 사용
- 빈 섹션 생략
- 사용자 언어 보존
- 파일 저장 및 확인
```

### 4. marketplace.json 업데이트

```json
{
  "plugins": [
    // ... 기존 플러그인들
    {
      "name": "spec-interview",
      "description": "AI-driven requirements gathering through in-depth interviews",
      "source": "./plugins/spec-interview"
    }
  ]
}
```

### 5. 로컬 링크 및 테스트

```bash
# 심볼릭 링크 생성
npm run link

# 확인
ls -la ~/.claude/skills/spec-interview/

# Claude Code에서 테스트
"인터뷰해줘" 또는 "interview me about [topic]"
```

## 코드 예제

### AskUserQuestion 사용 예제

```python
# 실제 SKILL.md에서 사용하는 형식
AskUserQuestion(
    questions=[
        {
            "question": "사용자가 로그인할 수 있는 방법은 무엇으로 할까요?",
            "header": "인증 방식",
            "options": [
                {
                    "label": "이메일/비밀번호만",
                    "description": "구현이 간단하고 사용자 데이터를 완전히 제어할 수 있지만, 사용자가 또 하나의 계정을 만들어야 함"
                },
                {
                    "label": "소셜 로그인만",
                    "description": "가입 장벽이 낮고 빠르지만, 외부 서비스 의존도가 높고 연동 설정 필요"
                },
                {
                    "label": "둘 다 지원",
                    "description": "사용자에게 선택권을 주지만, 구현 복잡도와 유지보수 비용 증가"
                }
            ],
            "multiSelect": false
        }
    ]
)
```

### 생성되는 Spec 템플릿 구조

```markdown
# [Feature] - Technical Specification

## 1. Overview
- Purpose
- Scope (In/Out)

## 2. Requirements
- Functional Requirements (FR-1, FR-2, ...)
- Non-Functional Requirements (NFR-1, NFR-2, ...)

## 3. Technical Design
- Architecture Overview
- Technology Stack
- Key Components
- Data Models

## 4. User Experience
- User Flows
- UI/UX Considerations

## 5. Implementation Details
- Phase 1, Phase 2, ...
- Technical Decisions (with rationale)

## 6. Edge Cases & Error Handling

## 7. Security & Privacy

## 8. Testing Strategy

## 9. Risks & Mitigations

## 10. Open Questions

## 11. Success Metrics

## 12. References
- Interview Notes
```

### 플러그인 디렉토리 최종 구조

```
plugins/spec-interview/
├── .claude-plugin/
│   └── plugin.json          # 메타데이터
├── skills/
│   └── spec-interview/
│       └── SKILL.md         # 650줄 실행 알고리즘
├── README.md                # 257줄 사용자 문서
└── CLAUDE.md                # 497줄 개발자 가이드
```

## 일반적인 오해 및 해결

### 오해 1: "AskUserQuestion은 Plan 모드 전용"
**실제**: 일반 스킬에서도 사용 가능합니다. SKILL.md의 `description`에 트리거 구문만 명시하면 자동으로 스킬이 실행됩니다.

### 오해 2: "복잡한 기능은 Multi-agent가 필수"
**실제**: Spec Interview는 Simple Skill로 충분합니다. 순차적 대화 흐름에는 병렬 처리가 필요 없습니다.

### 오해 3: "질문은 많을수록 좋다"
**실제**: 질문의 **품질**이 핵심입니다. 2-4개의 깊이 있는 질문이 10개의 뻔한 질문보다 낫습니다.

### 오해 4: "모든 섹션을 채워야 한다"
**실제**: 빈 섹션은 생략하는 것이 좋습니다. 사용자의 실제 답변에만 집중합니다.

### 오해 5: "스킬을 직접 호출해야 한다"
**실제**: SKILL.md의 `description`에 있는 트리거 구문을 사용하면 자동으로 스킬이 실행됩니다.

## 참고 자료

### 프로젝트 파일
- `/Users/jaykim/Documents/Projects/claude-ai-engineering/plugins/spec-interview/`
- `SKILL.md` - 실행 알고리즘 (17,487 bytes)
- `README.md` - 사용자 문서 (8,711 bytes)
- `CLAUDE.md` - 개발자 가이드 (12,605 bytes)

### 관련 문서
- `templates/NEW_PLUGIN_GUIDE.md` - 플러그인 생성 가이드
- `plugins/learning-summary/` - Simple Skill 참고 예제
- `plugins/project-insight/` - Multi-agent 참고 예제

### 영감 출처
- **Danny Postma의 인사이트**: "AI가 질문하는 것"이 "사용자가 설명하는 것"보다 효과적
- **Tariq (Claude Code 개발자)**: AskUserQuestion을 Plan 모드 밖에서도 활용 가능하다고 언급

### Git Commit
```bash
Commit: 587b7f5
Message: feat: add spec-interview plugin
Files: 5 files changed, 1426 insertions(+)
```

## 다음 단계

### 즉시 실행 가능
1. **테스트**: `"로그인 페이지에 대해 인터뷰해줘"` 실행
2. **다른 주제로 시도**: `"Interview me about building a REST API"`
3. **생성된 스펙 확인**: 현재 디렉토리에 `./*-spec.md` 파일 생성됨

### 향후 개선 사항
1. **시각적 다이어그램**: Mermaid.js로 아키텍처 다이어그램 생성
2. **협업 인터뷰**: 여러 이해관계자 동시 인터뷰, 답변 출처 태깅
3. **스펙 템플릿**: CRUD, 실시간, 인증 등 일반 패턴별 템플릿
4. **이어서 인터뷰**: 부분 스펙 읽고 중단된 곳부터 계속
5. **태스크 통합**: Linear/Jira 티켓 자동 생성

### 학습 확장
1. **다른 Skill 개선**: 기존 플러그인에 AskUserQuestion 추가
2. **질문 디자인 연구**: 좋은 질문의 패턴 더 연구
3. **사용자 피드백**: 실제 사용 후 질문 품질 개선

---

**작성일**: 2026-02-03
**태그**: #claude-code #askuserquestion #plugin-development #requirements-gathering #spec-interview
**카테고리**: claude-code

**핵심 인사이트**:
> "좋은 도구는 새로 만드는 게 아니라, 있는 걸 다르게 조합하는 데서 나온다"
>
> AskUserQuestion은 이미 있었지만, Plan 모드 밖에서 적극 활용하는 패턴은 거의 없었습니다. 이것을 인터뷰 방식으로 전환하는 것만으로 완전히 새로운 가치를 창출할 수 있습니다.
