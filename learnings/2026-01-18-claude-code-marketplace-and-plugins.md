# Claude Code 마켓플레이스와 플러그인 이해하기

## 핵심 개념

### 1. 마켓플레이스의 본질

**마켓플레이스 = GitHub 레포지토리**

Claude Code의 마켓플레이스는 중앙 집중식 App Store가 아니라 **분산형 시스템**입니다.

| 특징 | 설명 |
|------|------|
| **타입** | 분산형 (npm, pip와 유사) |
| **생성 방법** | GitHub 레포지토리 + `.claude-plugin/marketplace.json` 파일 |
| **승인 절차** | Anthropic 승인 불필요 |
| **식별자** | `owner/repo-name` 형식 (예: `team-attention/plugins-for-claude-natives`) |

### 2. 마켓플레이스 vs 플러그인

**비유: App Store vs 앱**

| 개념 | 실제 예시 | 설명 |
|------|----------|------|
| **마켓플레이스** | `team-attention/plugins-for-claude-natives` | 여러 플러그인을 모아놓은 카탈로그 (App Store) |
| **플러그인** | `agent-council`, `clarify`, `dev` | 개별 기능을 제공하는 확장 프로그램 (앱) |

**관계도:**
```
마켓플레이스 (GitHub 레포)
├── 플러그인 A
├── 플러그인 B
└── 플러그인 C
```

### 3. 마켓플레이스 구조

```
레포지토리/
├── .claude-plugin/
│   ├── marketplace.json    # 마켓플레이스 정의 (플러그인 목록)
│   └── plugin.json         # 메타데이터
└── plugins/
    ├── plugin-1/           # 개별 플러그인
    ├── plugin-2/
    └── plugin-3/
```

## 새로 알게된 것

### Before: 오해했던 것

- 마켓플레이스 = Anthropic이 운영하는 중앙 스토어
- `/plugin marketplace add` = 내가 만든 플러그인을 퍼블리시하는 것
- 플러그인을 만들려면 마켓플레이스에 등록해야 함
- Anthropic의 승인이 필요함

### After: 실제 작동 방식

- 마켓플레이스는 분산형 시스템 - 누구나 만들 수 있음
- `/plugin marketplace add` = 남이 만든 마켓플레이스를 내 로컬 Claude Code에 연결
- 플러그인 설치 방법은 3가지 (마켓플레이스, npx, 심볼릭 링크)
- 승인 불필요 - GitHub에 올리기만 하면 됨

## 실용적 예시

### 예시 1: 마켓플레이스를 통한 설치

```bash
# 1단계: 마켓플레이스를 내 Claude Code에 연결
/plugin marketplace add team-attention/plugins-for-claude-natives

# 2단계: 원하는 플러그인 설치
/plugin install agent-council
```

**의미:**
- "남이 만든 마켓플레이스를 내 로컬 Claude Code에 구독"
- 마켓플레이스에 등록된 플러그인들을 설치 가능하게 됨
- ❌ 내가 마켓플레이스를 만드는 것이 아님
- ❌ 남들이 볼 수 있게 퍼블리시하는 것이 아님

### 예시 2: npx로 직접 설치 (마켓플레이스 불필요)

```bash
# agent-council 플러그인 직접 설치
npx github:team-attention/agent-council
```

**장점:**
- 마켓플레이스 등록 없이 바로 설치
- 현재 프로젝트의 `.claude/skills/agent-council/`에 복사
- 자동으로 Claude Code/Codex CLI 감지

### 예시 3: 로컬 개발용 심볼릭 링크

```bash
# 전역 skills 디렉토리에 링크
ln -s /path/to/cloned-repo/plugins/agent-council/skills/agent-council \
      ~/.claude/skills/agent-council
```

**장점:**
- 실시간 수정 가능
- 여러 프로젝트에서 공유

### 예시 4: marketplace.json 구조

```json
{
  "name": "team-attention-plugins",
  "owner": {
    "name": "Team Attention",
    "url": "https://github.com/team-attention"
  },
  "description": "Claude Code plugins for power users",
  "plugins": [
    {
      "name": "agent-council",
      "description": "Collect opinions from multiple AI agents",
      "source": "./plugins/agent-council"
    },
    {
      "name": "clarify",
      "description": "Transform vague requirements into specs",
      "source": "./plugins/clarify"
    }
  ]
}
```

### 예시 5: 최소 플러그인 구조

```
my-skill/
├── SKILL.md          # Claude가 읽는 스킬 정의
└── scripts/
    └── main.sh       # 실행 스크립트
```

**SKILL.md 예시:**
```markdown
---
name: my-skill
description: Short description that triggers when user says "keyword"
---

# My Skill

Detailed description for Claude to understand how to use this skill.

## Usage

```bash
./scripts/main.sh "user query"
```
```

## 일반적인 오해

| 오해 | 실제 |
|------|------|
| 마켓플레이스 = 중앙 App Store | 분산형, 누구나 만들 수 있음 |
| `/plugin marketplace add` = 내가 퍼블리시 | 남의 마켓플레이스를 내 로컬에 연결 |
| Anthropic 승인 필요 | 승인 불필요, GitHub에 올리면 끝 |
| 플러그인 = 마켓플레이스 | 플러그인(앱) ⊂ 마켓플레이스(스토어) |
| 마켓플레이스에 등록해야만 사용 가능 | npx나 심볼릭 링크로도 설치 가능 |

## 참고 자료

### 파일 위치
- **마켓플레이스 정의**: `.claude-plugin/marketplace.json`
- **전역 스킬**: `~/.claude/skills/`
- **로컬 스킬**: `프로젝트/.claude/skills/`

### 실제 예시
- **agent-council 플러그인**: `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/plugins/agent-council/`
- **마켓플레이스 정의 파일**: `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/.claude-plugin/marketplace.json`

### GitHub 레포지토리
- https://github.com/team-attention/plugins-for-claude-natives

### 원본 문서
- `/Users/jaykim/Documents/Projects/clones/plugins-for-claude-natives/claude-code-marketplace-guide.md`

## 다음 단계

1. `learning-summary` 스킬을 정기적으로 사용하여 학습 내용 기록
2. 다른 플러그인들 탐색 (`agent-council`, `clarify`, `dev`)
3. 직접 커스텀 스킬/플러그인 만들어보기
4. 나만의 마켓플레이스 레포지토리 생성 고려
5. 전역 설치 vs 로컬 설치 전략 수립
