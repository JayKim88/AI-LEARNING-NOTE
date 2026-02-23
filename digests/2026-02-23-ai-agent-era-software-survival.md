# Make Something Agents Want: 에이전트 시대에 살아남는 소프트웨어의 3가지 조건

> **Source**: [LinkedIn - GB Jeong](https://www.linkedin.com/posts/gb-jeong_make-something-agents-want-yc%EC%9D%98-%EC%B2%A0%ED%95%99%EC%9D%B4-%EB%92%A4%EC%A7%91%ED%98%94%EC%8A%B5%EB%8B%88%EB%8B%A4-share-7431384260416196608-Y0AB)
> **Date**: 2026-02-23
> **Tags**: #ai #agent-economy #software-strategy #yc #a16z #harness #vertical-saas

## 요약 (Summary)

YC의 철학이 "Make something people want"에서 **"Make something agents want"**로 전환됐다. 에이전트가 선택하고, 추천하고, 배포하는 시대에서 소프트웨어의 가치 축이 근본적으로 이동했다. YC Lightcone, a16z, Lablup 신정규 대표 — 세 소스가 동시에 같은 방향을 가리키며, 에이전트 시대 생존 조건이 **3가지**로 수렴한다: (1) 에이전트가 선택하는 문서, (2) 코드가 아닌 생성 장치(harness), (3) 복제 불가능한 도메인.

핵심 메시지는 **가치의 이동**: 코드 → 문서 → harness → 도메인. 코드 자체의 가치는 0에 수렴하고, 진정한 해자(moat)는 도메인 지식과 고객 lock-in에 있다.

## 주요 개념 (Key Concepts)

### 1. 에이전트가 선택하는 문서 (Agent-Chosen Documentation)

- **What**: 에이전트(LLM)가 도구/서비스를 선택할 때 문서 품질이 결정적 기준
- **Why**: 에이전트는 랜딩페이지가 아닌 API와 문서로 세상을 이해
- **Impact**: 문서 품질 5% 차이 → 고객 수 몇 배 차이

| 승자 | 패자 | 차이점 |
|------|------|--------|
| **Supabase** | 경쟁 DB들 | "Best documentation" — YC Lightcone 언급 |
| **Resend** | SendGrid (직원 10,000+) | LLM.txt 제작, 에이전트 친화 문서 → ChatGPT 인바운드 Top 3 |
| **Mintlify** | — | 모든 개발사 문서를 에이전트 친화적으로 변환하는 도구 |

- **새로운 공식**: SEO 시대 = Google이 고객을 데려옴 → **에이전트 시대 = 문서가 데려옴**
- **실행 가능한 인사이트**: LLM.txt, 구조화된 API 문서, 코드 스니펫 우선 문서 설계

### 2. 코드가 아닌 생성 장치 — Harness

- **What**: 에이전트가 자동으로 일하게 만드는 맥락 + 워크플로우 시스템
- **Why**: 코드는 에이전트가 찍어내고 모델은 교체되지만, harness는 조직 노하우를 축적
- **Impact**: "코드의 가치는 0으로 수렴하지만, 그걸 만드는 harness가 소프트웨어의 새로운 정의" — 신정규

**Lablup 사례 (40일, 100만 줄):**

| 구성 요소 | 역할 |
|-----------|------|
| `CLAUDE.md` | 맥락 정의 (SOUL Document) |
| `PROGRESS.md` | 진행 추적 |
| `PLAN.md` | 계획 관리 |
| Cron (15분 주기) | 이슈 분석 → 코드 생성 → PR → 머지 자동화 |
| Sub-agents (최대 50개) | 병렬 처리, 사람은 리뷰만 |

**비개발 직군 사례:**

| 역할 | 성과 |
|------|------|
| CFO | 30분 학습 → 2시간 작업을 3분으로 단축 |
| 콘텐츠 담당자 | 1주일 만에 250개 문서 변환 + 뉴스 크롤링 자동화 harness 구축 |

- **핵심 차이**: 코딩을 배운 게 아니라 **생성 장치를 만든 것**

### 3. 복제 불가능한 도메인 (Unreplicable Domain)

- **What**: 문서와 harness는 결국 따라잡힘 → 최종 해자는 도메인 지식
- **Why**: 범용 AI가 한 번에 복제할 수 없는 10년간의 엣지 케이스 + 고객 lock-in
- **Impact**: a16z 데이터 — Vertical SaaS가 Finance/ERP/Marketing/Productivity를 전부 이김

**"낙차가 큰 곳에 물레방아를 설치하라"** — 신정규

| 도메인 | 복제 불가능한 이유 |
|--------|-------------------|
| 건설 정산 로직 | 복잡한 도급 구조, 관행, 예외 처리 |
| 의료 보험 청구 | 규제, 코드 체계, 심사 기준 |
| 물류 배차 최적화 | 실시간 변수, 운전자 패턴, 지역 특성 |

**복제 가능 vs 불가능:**

| 복제 가능 (빠르게 따라잡힘) | 복제 불가능 (진정한 해자) |
|---------------------------|-------------------------|
| 도구 숙련도 | 고객사의 실패 패턴 지식 |
| 프롬프트 기법 (1주일이면 확산) | 수년간 함께 풀어온 문제의 기억 |
| 에이전트 친화 문서 (Mintlify 등장) | 그 조직이 절대 못 하는 것을 아는 것 |
| harness 패턴 | 10년간 쌓인 엣지 케이스 |

## 실무 적용 방법 (Practical Applications)

### Use Case 1: 에이전트 친화적 문서 설계
- API 문서에 **LLM.txt** 추가 (Resend 사례 참고)
- 코드 스니펫을 문서 최상단에 배치
- 구조화된 메타데이터로 에이전트가 파싱하기 쉬운 형태 설계
- Mintlify 같은 도구 도입 검토

### Use Case 2: 조직 harness 구축
- CLAUDE.md / PROGRESS.md / PLAN.md 기반 SOUL Document 체계 도입
- GitHub Issue → PR → Merge 자동화 파이프라인 구축
- 비개발 직군도 harness를 만들 수 있도록 교육 (코딩 교육 X, 생성 장치 교육 O)

### Use Case 3: 도메인 해자 평가
- 자사 서비스의 "IT-도메인 낙차" 측정
- 복제 불가능한 도메인 자산 목록화 (엣지 케이스, 고객 관계, 규제 지식)
- Vertical SaaS 기회 탐색: 건설, 의료, 물류 등 갭이 큰 영역

## 가치 이동 프레임워크 (Value Migration Framework)

```
코드 (Code)
  ↓ 에이전트가 생성 가능 → 가치 0 수렴
문서 (Documentation)
  ↓ Mintlify 등 도구로 민주화 → 따라잡힘
생성 장치 (Harness)
  ↓ 패턴이 퍼지면 → 따라잡힘
도메인 (Domain Knowledge)
  → 10년 축적 + 고객 lock-in = 진정한 해자
```

**생존 조건 체크리스트:**
1. 에이전트가 선택하는 문서를 갖추었는가?
2. 코드가 아닌 harness를 축적하고 있는가?
3. 복제 불가능한 도메인 해자가 있는가?

## 주의사항 / 제한사항 (Limitations & Gotchas)

- 문서 품질만으로는 장기 해자가 되지 못함 (Mintlify 같은 도구가 평준화)
- harness 패턴도 결국 확산됨 — 차별화 기간은 한정적
- "에이전트 시대"가 모든 B2B SaaS에 동일하게 적용되지는 않음 — 에이전트 침투율이 높은 개발자 도구 영역에서 먼저 체감
- Vertical SaaS의 해자도 영원하지 않음 — 도메인 특화 LLM이 등장하면 격차 축소 가능

## 참고 링크 (References)

- [원문 - GB Jeong LinkedIn Post](https://www.linkedin.com/posts/gb-jeong_make-something-agents-want-yc%EC%9D%98-%EC%B2%A0%ED%95%99%EC%9D%B4-%EB%92%A4%EC%A7%91%ED%98%94%EC%8A%B5%EB%8B%88%EB%8B%A4-share-7431384260416196608-Y0AB)
- [YC Lightcone 영상](https://lnkd.in/gRzR5Tyx)
- [a16z Vertical SaaS 데이터](https://lnkd.in/g2CWbdrq)
- [노정석 대표 관련](https://lnkd.in/ggUTB56j)
- Lablup / 신정규 대표 — SOUL Document, Claude Code 활용 사례
- Resend — LLM.txt, 에이전트 친화 문서
- Mintlify — 에이전트 친화 문서 변환 도구
- Agent Mail — 에이전트 전용 이메일 서비스

## Next Steps

- [ ] LLM.txt 스펙 조사 및 자사 프로젝트 적용 검토
- [ ] SOUL Document (CLAUDE.md / PROGRESS.md / PLAN.md) 체계 실험
- [ ] 현재 프로젝트의 에이전트 친화도 평가 (문서 구조, API 설계)
- [ ] Vertical SaaS 기회 영역 리서치 (a16z 데이터 기반)
- [ ] Mintlify 도입 검토 또는 자체 에이전트 친화 문서 가이드라인 수립

---

**메모 (Notes)**:
이 글의 핵심은 "가치의 이동"이다. 코드 → 문서 → harness → 도메인으로 가치가 이동한다는 프레임워크는 현재 AI 에이전트 도구를 만드는 입장에서 매우 실질적인 전략 가이드가 된다. 특히 harness 개념은 Claude Code의 CLAUDE.md 기반 워크플로우와 직접 연결되며, 이미 실천하고 있는 부분과 강화해야 할 부분을 구분하는 데 유용하다.
