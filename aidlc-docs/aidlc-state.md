# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield
- **Start Date**: 2026-06-21T13:18:33Z
- **Current Stage**: INCEPTION - Requirements Analysis
- **Active Roadmap Unit**: 1차 — 백엔드 API + 진단 파이프라인 정합화 (country ↔ region 대칭)

## Workspace State
- **Existing Code**: Yes (Python 엔진 — generation·rendering, country·region 양축)
- **Reverse Engineering Needed**: No (설계 명세·엔진이 이미 잘 문서화됨 — CLAUDE.md·PIPELINE.md·ROADMAP.md·README들)
- **Workspace Root**: /home/participant/silk-road_v1.0

## Code Location Rules
- **Application Code**: Workspace root (app/backend, app/frontend) — NEVER in aidlc-docs/
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Extension Configuration
| Extension | Enabled | Mode | Decided At |
|---|---|---|---|
| Security Baseline | No | — | Requirements Analysis |
| Resiliency Baseline | No | — | Requirements Analysis |
| Property-Based Testing | Yes | Partial (PBT-02·03·07·08·09 강제, 나머지 advisory) | Requirements Analysis |

## Execution Plan Summary
- **Unit of Work**: backend-api (단일)
- **Stages to Execute (5)**: Application Design, Functional Design, NFR Requirements(경량), Code Generation, Build & Test
- **Stages to Skip**: Reverse Engineering(문서 충실), User Stories(내부 API), Units Generation(단일 단위), NFR Design(NFR 경량), Infrastructure Design(배포 4차)

## Stage Progress

### 🔵 INCEPTION PHASE
- [x] Workspace Detection (2026-06-21) — Brownfield 확인, RE 생략 결정
- [x] Reverse Engineering — SKIP
- [x] Requirements Analysis (2026-06-21) — 1차 범위 확정, 승인 완료
- [x] User Stories — SKIP
- [x] Workflow Planning (2026-06-21) — execution-plan.md 작성 (사용자 승인 대기)
- [x] Application Design — EXECUTE (2026-06-21, 산출물 5종, 승인 완료)
- [x] Units Generation — SKIP

### 🟢 CONSTRUCTION PHASE (unit: backend-api)
- [x] Functional Design — EXECUTE (2026-06-21, 산출물 3종, 승인 완료)
- [x] NFR Requirements — EXECUTE (2026-06-21, 경량, 산출물 2종, 승인 완료)
- [x] NFR Design — SKIP
- [x] Infrastructure Design — SKIP
- [x] Code Generation — EXECUTE (2026-06-21, 생성 + code-reviewer 리뷰 반영, 코드 승인 완료)
- [x] Build and Test — EXECUTE (2026-06-21, 32/32 통과, 라우트 버그 수정, 산출물 5종, 승인 완료 — 1차 종료)

### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER

---

# 2차 사이클 — 챗봇 + 리서치 (Bedrock)

## Project Information (2차)
- **Active Roadmap Unit**: 2차 — 챗봇 + 리서치 (Bedrock, country/region 공통). region 리서치 명세 추가 포함.
- **의존**: 1차 backend-api (완료)
- **환경**: anthropic SDK 0.109.2 (AnthropicBedrock·AnthropicBedrockMantle 가용), boto3 1.42.97, AWS 자격증명 present, 리전 ap-northeast-2

## Stage Progress (2차)
### 🔵 INCEPTION PHASE
- [x] Workspace Detection — 동일 brownfield, RE 생략 유지
- [x] Reverse Engineering — SKIP
- [x] Requirements Analysis (2차) — requirements-2.md, 승인 완료 (Q4=region 잠정 최소+확장코멘트, Q8=실 Bedrock 테스트)
- [x] User Stories — SKIP
- [x] Workflow Planning (2차) — execution-plan-2.md 작성, 승인 대기
- [x] Application Design — EXECUTE (2026-06-21, 산출물 5종, 승인 대기)
- [x] Units Generation — SKIP
### 🟢 CONSTRUCTION PHASE (unit: research-chatbot)
- [x] Functional Design — EXECUTE (2026-06-21, 산출물 3종, Q1↔Q2 명확화 해소 — 승인 완료)
- [x] NFR Requirements — EXECUTE (2026-06-21, 경량, 산출물 2종 — 승인 완료)
- [x] NFR Design — SKIP
- [x] Infrastructure Design — SKIP
- [x] Code Generation — EXECUTE (2026-06-22, 22단계 전부 완료, py_compile OK, code-summary-2.md 작성)
- [x] Build and Test — EXECUTE (2026-06-22, non-bedrock 45 passed + 실 Bedrock country(PT) 스모크 1 passed — 2차 종료)

## 환경 보정 (Build & Test 중 발견)
- Mantle 엔드포인트(`bedrock-mantle.ap-northeast-2.api.aws`)가 이 환경에서 DNS 미해석 → 레거시 `AnthropicBedrock`(bedrock-runtime InvokeModel) 백엔드 사용. `config.BEDROCK_BACKEND="legacy"`.
- 모델 ID: on-demand `anthropic.claude-opus-4-8`는 inference profile 필요 → `global.anthropic.claude-opus-4-8`(global cross-region profile)로 변경.
- legacy 백엔드는 `output_config.format`(구조화 출력) 400 → `generate_structured`가 프롬프트 JSON 계약 + 코드펜스 제거 파싱으로 폴백(mantle 백엔드는 종전대로 구조화 출력 사용). env override로 환경 전환 가능.

## Current Status
- **Lifecycle Phase**: CONSTRUCTION → 완료 (2차, unit: research-chatbot)
- **Current Stage**: Build & Test (2차) 완료 — 2차 사이클 종료
- **Next Stage**: ROADMAP 3차(프론트엔드 React+Vite) 또는 사용자 지시 대기
- **Status**: non-bedrock 45 passed(1차 32 + 신규 13) + 실 Bedrock country 스모크 1 passed(약 3분, PT 단일국 end-to-end). 커밋은 사용자 지시 대기.

---

# 3차 사이클 — 프론트엔드 (React + Vite)

## Project Information (3차)
- **Active Roadmap Unit**: 3차 — 프론트엔드(React + Vite). 지도 UI + 8화면 + 챗봇 위젯 + D3 지구본 인트로.
- **의존**: 1차 backend-api(카탈로그·리포트·잡, 완료) + 2차 research-chatbot(리서치·챗봇 API, 완료)
- **디자인 SoT(변경 금지)**: web_design_spec.md(8화면·진입모드·6.x) · intro_spec.md(D3 인트로) · DESIGN.md(Kinetic Enterprise) · stitch mockup 8종 · PIPELINE.md §1/§5(iframe embed)

## 결정 사항 (Requirements 명확화 — 전부 A)
- Q1 화면범위=8화면 전체+D3 인트로 / Q2 API=실제 연동(Vite dev proxy) / Q3 embed=iframe src / Q4 지도=D3.js / Q5 스타일=Tailwind+토큰 매핑 / Q6 테스트=경량(Vitest, PBT 백엔드 전용) / Q7 이메일=포함(mailto, 무저장)

## Execution Plan Summary (3차)
- **Unit of Work**: frontend (단일)
- **Stages to Execute (5)**: Application Design, Functional Design, NFR Requirements(경량), Code Generation, Build & Test
- **Stages to Skip (5)**: Reverse Engineering(문서 충실), User Stories(화면·플로우 SoT 확정), Units Generation(단일 단위), NFR Design(NFR 경량), Infrastructure Design(배포 4차)

## Stage Progress (3차)
### 🔵 INCEPTION PHASE
- [x] Workspace Detection — COMPLETED (동일 brownfield, RE 생략 유지)
- [x] Reverse Engineering — SKIP
- [x] Requirements Analysis (3차) — requirements-3.md, 결정 7건 전부 A, 승인 완료
- [x] User Stories — SKIP (화면·플로우·페르소나 명세 SoT 보유)
- [x] Workflow Planning (3차) — execution-plan-3.md 작성, 승인 완료
- [x] Application Design — EXECUTE (2026-06-22, Q1~Q7=A, 산출물 5종 생성, 승인 대기)
- [ ] Units Generation — **SKIP** (단일 frontend 단위)
### 🟢 CONSTRUCTION PHASE (unit: frontend)
- [x] Functional Design — EXECUTE (2026-06-22, 질문 8개; Q1·Q6은 X답변→명확화 해소, Q5=B. 산출물 4종 생성, 승인 대기)
  - **범위 변경 확정**: ① 잡 3종(research/detail/report) — 상세화면 렌더링을 비동기 폴링 잡으로 **백엔드 확장**. ② PDF SES 첨부는 3차 제외(별도 범위), 3차는 mailto 유지. execution-plan-3·application-design-3 정합 갱신함.
- [x] NFR Requirements — EXECUTE (경량) (2026-06-22, Q1~Q5=A; Q2는 DESIGN.md 3단계 그리드 정합 보강. 산출물 2종 생성, 승인 대기)
- [ ] NFR Design — **SKIP**
- [ ] Infrastructure Design — **SKIP** (배포 4차)
- [x] Code Generation — EXECUTE (2026-06-22, 22단계 전부 완료: 백엔드 detail 잡 확장 4 + 프론트 신규 ~35파일. 게이트 tsc·vitest 24/24·vite build·py_compile 통과. code-summary-3 작성)
- [x] Build and Test — EXECUTE (2026-06-22, npm install·tsc 0에러·vitest 24/24·vite build·dev proxy 통합 스모크 FI-1~5·frontend-design 2-pass·산출물 5종, 승인 완료 — 3차 종료)
### 🟡 OPERATIONS PHASE
- [ ] Operations — PLACEHOLDER (배포 4차/deploy 스킬)

## Current Status (3차)
- **Lifecycle Phase**: CONSTRUCTION 완료 → 3차 사이클 **종료** (unit: frontend)
- **Current Stage**: Build & Test (3차) 승인 완료 — 3차 종료
- **Next Stage**: ROADMAP 4차(배포, Docker→ECR→CFN, deploy 스킬) 또는 사용자 지시
- **Status**: 3차 종료. tsc 0에러·vitest 24/24·vite build OK·통합 스모크 FI-1~5 통과(detail 잡 확장 포함)·백엔드 무파괴. 커밋은 사용자 지시 대기.
