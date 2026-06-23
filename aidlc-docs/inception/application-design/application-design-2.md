# Application Design (통합) — research-chatbot (2차)

> 세부: [components-2.md](components-2.md) · [component-methods-2.md](component-methods-2.md) · [services-2.md](services-2.md) · [component-dependency-2.md](component-dependency-2.md)

## 개요
ROADMAP 2차 — `AnthropicBedrockMantle`(Opus 4.8, ap-northeast-2)로 country/region 리서치 Agent를 구현하고, §6.5 챗봇 로직을 1차 backend-api 위에 추가한다. 리서치는 1차 JobManager를 재사용한 **비동기 잡**, 챗봇은 **동기·무상태**. region 리서치 명세는 잠정(코드 생성 단계에서 작성).

## 설계 결정 (Q1~Q7 전부 A)
| 결정 | 값 |
|---|---|
| 잡 오케스트레이션 | 1차 JobManager 재사용 + research orchestrator(kind=research) |
| 리서치 코드 | 단일 ResearchAgent + domain 분기 |
| 프롬프트/스키마 | 파일에서 로드(`architecture/research/*`) |
| 구조화출력 스키마 | `_schema.md`에서 도출(region 잠정) |
| 챗봇 상태 | 무상태(history 요청 전달) |
| LLM 컨텍스트 | 요약/핵심(overall_insight + 핵심 items) |
| region 명세 시점 | Code Generation 단계에서 .md 작성 |

## 컴포넌트 (신규 7 + 1차 확장 3)
- **신규**: C8 BedrockClient · C9 PromptLoader · C10 ResearchAgent · C11 ResearchOrchestrator · C12 ChatbotService · C13 ResearchRouter · C14 ChatRouter
- **1차 확장**: config(Bedrock 상수) · schemas(JobStep enum + 리서치/챗봇 모델) · storage_resolver(save_research)

## 핵심 흐름
- **리서치(비동기)**: `POST /api/research/{domain}/{id}` → JobManager.create_job + BG → Orchestrator → Agent(PromptLoader→BedrockClient 구조화출력→StorageResolver 저장) → `/api/jobs/{id}` 폴링
- **챗봇(동기)**: `POST /api/chat` → ChatbotService(데이터 있으면 LLM 답변, 없으면 리서치 제안 분기) → ChatResponse

## 대칭·관심사 분리
- ResearchAgent는 domain 인자 분기(1차 대칭 패턴 일관). region 잠정이나 인터페이스 대칭.
- BedrockClient만 Bedrock 의존(격리). 챗봇은 리서치 직접 트리거 안 하고 신호만(프론트가 후속 호출).
- 1차 컴포넌트는 **확장만**, 기존 시그니처·엔진 무파괴(NFR-3).

## 경로·계약 (NFR-2)
- 입력 프롬프트/스키마: `architecture/research/{country,region}_research_*.md`
- 출력: `storage/data/research/{domain}/<ID>/<ID>_<TS>.json` + `<ID>_latest.json`(기존 규칙)
- 구조화출력으로 스키마 강제 → 계약 위반 차단

## NFR 반영 (경량)
- Bedrock 구성: Mantle·`anthropic.claude-opus-4-8`·ap-northeast-2 (config)
- 비동기: 1차 JobManager·step/percent(calling_bedrock/saving 추가)·폴링 재사용
- 테스트: PBT Partial(프롬프트 치환·스키마 검증·저장경로 라운드트립) + **실 Bedrock 스모크**(Q8)
- 의존성: anthropic 0.109.2 requirements.txt 핀

## region 명세 (잠정 — Q4·Q7)
- `region_research_prompt.md`·`region_research_schema.md`를 EU 샘플 구조 기반 **최소 스키마**로 Code Generation 때 작성.
- 두 문서·관련 코드에 **"잠정 샘플 — 추후 country 대칭 풀세트 확장 예정"** 코멘트 명시(필수).

## 범위 밖
- 프론트 챗봇 위젯·iframe·mailto(3차) · region 풀세트 명세(후속) · 배포(4차)
