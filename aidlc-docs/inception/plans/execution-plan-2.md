# Execution Plan — 2차: 챗봇 + 리서치 (Bedrock)

## Detailed Analysis Summary

### Transformation Scope (Brownfield)
- **Transformation Type**: Application change — 리서치 Agent·챗봇 모듈 신규 + 1차 API 확장 + region 리서치 명세(문서) 추가.
- **Primary Changes**: `app/backend/api/`에 리서치·챗봇 서비스/라우터 추가, Bedrock 클라이언트 래퍼, `architecture/research/region_research_*.md` 신규.
- **Related Components**: 1차 backend-api(JobManager·Orchestrator·StorageResolver·schemas) **재사용**. 기존 엔진 무수정. country 리서치 명세 참조.

### Change Impact Assessment
- **User-facing**: Yes(간접) — 챗봇/리서치 API는 3차 프론트가 소비.
- **Structural**: Yes — `api/services/`·`api/routers/`에 모듈 추가. 1차 구조 패턴 그대로.
- **Data model**: 신규 리서치 JSON은 기존 스키마 준수. 신규는 챗봇/리서치 요청·응답 모델.
- **API**: Yes — 리서치 트리거(비동기)·챗봇(동기) 엔드포인트 신설.
- **NFR**: 경량(비동기 잡 재사용·PBT Partial). 보안/복원력 opt-out 유지. **실 Bedrock 테스트**.

### Component Relationships (Brownfield)
- **Primary**: 신규 `research_agent`·`chatbot` 서비스 + 라우터
- **재사용(1차)**: JobManager(C4)·Orchestrator 패턴(C3)·StorageResolver(C5)·schemas(C7)·config
- **신규 외부 의존**: AnthropicBedrockMantle(Bedrock, ap-northeast-2)
- **문서**: region_research_prompt.md·region_research_schema.md(잠정)

### Risk Assessment
- **Risk Level**: **Medium** — LLM 연동·외부 API·비동기·스키마 강제. 단 1차 인프라 재사용으로 신규 표면 한정.
- **Rollback**: Easy(신규 모듈 위주, 엔진·1차 무수정).
- **Testing**: Moderate — 실 Bedrock 호출 의존(네트워크/자격증명), 모킹 없이 스모크 중심.

## Workflow Visualization (Text)
```
INCEPTION (2차)
- Workspace Detection ........ COMPLETED (동일 brownfield)
- Reverse Engineering ........ SKIP
- Requirements Analysis ...... COMPLETED
- User Stories ............... SKIP (내부 API·LLM 연동)
- Workflow Planning .......... COMPLETED (현재)
- Application Design ......... EXECUTE
- Units Generation ........... SKIP (단일 research-chatbot 단위)

CONSTRUCTION (2차, unit: research-chatbot)
- Functional Design .......... EXECUTE (프롬프트 조립·스키마강제·챗봇분기·잡연동 + region명세 설계)
- NFR Requirements ........... EXECUTE (경량: Bedrock구성·실호출테스트·anthropic 핀)
- NFR Design ................. SKIP
- Infrastructure Design ...... SKIP (배포 4차)
- Code Generation ............ EXECUTE
- Build and Test ............. EXECUTE (실 Bedrock 스모크 포함)

OPERATIONS ................... PLACEHOLDER (배포 4차/deploy 스킬)
```

## Phases to Execute

### 🔵 INCEPTION PHASE
- [x] Workspace Detection — COMPLETED (1차와 동일 환경)
- [x] Reverse Engineering — SKIPPED
- [x] Requirements Analysis — COMPLETED
- [x] User Stories — SKIPPED (내부 API·LLM 연동, 화면 명세는 web_design_spec 보유)
- [x] Workflow Planning — IN PROGRESS
- [ ] Application Design — **EXECUTE**
  - **Rationale**: 신규 컴포넌트(Bedrock 클라이언트 래퍼·research_agent·chatbot 서비스·라우터)·1차 재사용 경계 정의
- [ ] Units Generation — **SKIP**
  - **Rationale**: 단일 응집 단위 `research-chatbot`. 1차 위에 얹는 모듈군

### 🟢 CONSTRUCTION PHASE (unit: research-chatbot)
- [ ] Functional Design — **EXECUTE**
  - **Rationale**: 프롬프트 조립·구조화출력 스키마·챗봇 §6.5 분기 상태·리서치 잡 흐름·region 잠정 스키마 설계 + PBT 속성
- [ ] NFR Requirements — **EXECUTE (경량)**
  - **Rationale**: Bedrock 구성(모델·리전)·실 Bedrock 테스트 정책·anthropic SDK 핀
- [ ] NFR Design — **SKIP** (NFR 경량, 상위 설계 흡수)
- [ ] Infrastructure Design — **SKIP** (배포 4차)
- [ ] Code Generation — **EXECUTE (ALWAYS)**
- [ ] Build and Test — **EXECUTE (ALWAYS)** — 실 Bedrock 스모크 포함

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

## Unit of Work
- **단일 단위**: `research-chatbot` — Bedrock 클라이언트 래퍼 + 리서치 Agent(country/region) + 챗봇 로직 + region 명세(문서) + API 확장 + 테스트

## Estimated Timeline
- **Stages to Execute**: 5 (Application Design, Functional Design, NFR Requirements, Code Generation, Build & Test) + region 명세 문서

## Success Criteria
- **Primary Goal**: Bedrock 리서치 Agent(country/region, 구조화출력)와 §6.5 챗봇 로직이 1차 API 위에서 동작, region 명세(잠정) 작성
- **Key Deliverables**:
  - Bedrock 클라이언트 래퍼(Mantle, Opus 4.8, ap-northeast-2)
  - research_agent(country/region, 스키마 강제 저장) + 비동기 잡 연동
  - chatbot 서비스(§6.5 분기 + LLM 답변)
  - 리서치 트리거(비동기)·챗봇(동기) 엔드포인트
  - `region_research_prompt.md`·`region_research_schema.md`(잠정 + 확장 코멘트)
  - anthropic SDK requirements.txt 핀, 테스트(PBT + 실 Bedrock 스모크)
- **Quality Gates**: py_compile 통과 · 스키마 계약 준수 · 1차 무파괴 · 실 Bedrock 스모크 1회 성공 · PBT Partial 준수
- **Integration Testing**: 챗봇 분기 → 리서치 잡 → storage 저장 → 데이터 기반 답변 흐름
