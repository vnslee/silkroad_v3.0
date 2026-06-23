# Requirements — 2차: 챗봇 + 리서치 (Bedrock, country/region 공통)

## Intent 분석 요약
- **User Request**: ROADMAP 2차 진행 — `architecture/research/` 프롬프트·스키마를 실제 Bedrock 호출로 연결, region 리서치 명세 추가, 챗봇 응답 로직.
- **Request Type**: New Feature (리서치 Agent·챗봇 API 신규) + Enhancement (region 명세 추가)
- **Scope**: Multiple Components — 리서치 Bedrock 모듈 + 챗봇 로직 + region 리서치 명세 + 1차 API 확장
- **Complexity**: Moderate–Complex (LLM 연동·비동기 잡·스키마 강제·챗봇 분기)
- **Project Type**: Brownfield. **의존**: 1차 backend-api(FastAPI·잡 매니저·오케스트레이터·storage resolver).

## 확인된 환경
- `anthropic` SDK 0.109.2 (`AnthropicBedrock`·`AnthropicBedrockMantle` import 가능), boto3 1.42.97
- AWS 자격증명 present, 리전 **ap-northeast-2**
- country 리서치 프롬프트·스키마 정식 존재. region 명세 부재(2차 대상). region/EU 잠정 샘플 데이터 존재.

## 결정 사항 (명확화 답변)
| # | 결정 | 내용 |
|---|------|------|
| Q1 | Bedrock 호출 | **`AnthropicBedrockMantle(aws_region="ap-northeast-2")`** + `messages.create`. 모델 ID는 `anthropic.` 프리픽스 |
| Q2 | 리서치 모델 | **Opus 4.8** (`anthropic.claude-opus-4-8`) |
| Q3 | 스키마 강제 | **구조화 출력**(`output_config.format` json_schema) — country/region 스키마 준수 보장 |
| Q4 | region 명세 | **EU 샘플 기반 최소 스키마**(B). ⚠️ **명세·코드에 "잠정 샘플이며 추후 country 대칭 풀세트로 확장 예정"임을 명시**(코멘트 필수) |
| Q5 | 챗봇 범위 | **분기 + 리서치 트리거 + LLM 응답**(§6.5.1/6.5.2 충실). 보유 데이터 있으면 LLM 답변, 없으면 "리서치 진행?" 분기 |
| Q6 | 처리 방식 | **리서치=비동기 잡(1차 잡 매니저 재사용), 챗봇=동기** |
| Q7 | 권역 국가 리스트 | **API가 국가 코드 배열을 파라미터로 받음** — 각 국가 + 권역 리서치 |
| Q8 | 테스트 Bedrock | **실제 호출 포함**(B, 비용 이슈 없음). 테스트가 네트워크·자격증명 의존 |

## Extension 설정 (1차에서 확정, 2차 유지)
- Security: No · Resiliency: No · **PBT: Partial**(PBT-02·03·07·08·09 강제)

---

## 기능 요구사항 (Functional Requirements)

### FR-1. 리서치 Agent (Bedrock)
- **FR-1.1** country 리서치 — country 코드 + (옵션)세그먼트를 받아 `country_research_prompt.md` 프롬프트로 Bedrock(Opus 4.8) 호출 → `country_research_schema.md` 스키마(구조화 출력)로 검증된 JSON 생성.
- **FR-1.2** region 리서치 — 권역 코드 + **포함 국가 코드 배열**(Q7)을 받아 region 프롬프트로 호출 → region 스키마 JSON 생성. 포함 국가 중 데이터 없는 국가는 country 리서치도 수행.
- **FR-1.3** 저장 — `storage/data/research/{country,region}/<ID>/<ID>_<TS>.json` + `<ID>_latest.json` 포인터 갱신(PIPELINE §2, 기존 네이밍 규칙).
- **FR-1.4** 모델·리전 설정 — 모델 ID(`anthropic.claude-opus-4-8`)·리전(`ap-northeast-2`)은 config로 관리.

### FR-2. region 리서치 명세 (문서)
- **FR-2.1** `architecture/research/region_research_prompt.md` + `region_research_schema.md` 신규 작성 — **EU 샘플 데이터 구조 기반 최소 스키마**.
- **FR-2.2** ⚠️ 두 문서 상단 및 관련 코드에 **"잠정 샘플 — country 대칭 풀세트는 추후 확장 예정"** 코멘트 명시(Q4).

### FR-3. 챗봇 응답 로직
- **FR-3.1** 단순 질의 응답 — 특정 country/region 질의 시 보유 데이터 존재하면 Bedrock LLM이 기존 리서치 데이터 기반으로 답변(§6.5.1/6.5.2).
- **FR-3.2** 데이터 없음 분기 — 데이터 없으면 "외부 리서치 진행?" 응답 → 사용자 동의 시 리서치 트리거.
- **FR-3.3** 권역 부분 데이터 — 권역 질의 시 일부 국가만 보유하면 "일부 국가 정보 부족, 리서치 필요?" 분기(§6.5.2). 권역 정보 없으면 포함 국가 리스트 질의(Q7).
- **FR-3.4** 완료 안내 — 리서치 완료 후 안내 문구 + 기존 답변 흐름 복귀(§6.5).

### FR-4. API 확장 (1차 위에 추가)
- **FR-4.1** 리서치 트리거 엔드포인트 — country/region 리서치를 **비동기 잡**으로 트리거(1차 잡 매니저·폴링 재사용, Q6). region은 국가 코드 배열 파라미터 수용.
- **FR-4.2** 챗봇 엔드포인트 — 챗봇 질의를 **동기**로 처리(Q6), 분기 결과/답변 반환.
- **FR-4.3** 기존 1차 API·storage resolver와 정합(존재 확인 로직 재사용).

---

## 비기능 요구사항 (Non-Functional Requirements)
- **NFR-1 (대칭)**: 리서치 Agent는 country/region 대칭 구조. region 코드/명세는 잠정이나 인터페이스는 대칭.
- **NFR-2 (스키마 계약)**: 생성 JSON은 기존 스키마·네이밍·저장 규칙(PIPELINE §2, CLAUDE.md) 위반 없음. 구조화 출력으로 강제.
- **NFR-3 (관심사 분리)**: 리서치/챗봇 모듈은 Bedrock 호출·프롬프트 조립·검증을 담당. 1차 엔진(generation/rendering)·API 레이어 구조 존중.
- **NFR-4 (Bedrock 구성)**: Mantle 클라이언트, `anthropic.` 프리픽스 모델 ID, ap-northeast-2. 자격증명은 환경(boto3 체인).
- **NFR-5 (비동기 정합)**: 리서치 잡은 1차 JobManager·step/percent·폴링 패턴 재사용. 챗봇은 동기.
- **NFR-6 (테스트 — PBT Partial + 실 Bedrock)**: 프롬프트 조립·스키마 검증·저장 경로 라운드트립(PBT-02)·불변식(PBT-03)·생성기(PBT-07)·seed(PBT-08)·Hypothesis(PBT-09). **Bedrock 실호출 통합 테스트 포함(Q8)** — 네트워크·자격증명 의존(스모크).
- **NFR-7 (구문 게이트)**: 신규 .py `python3 -m py_compile` 통과.
- **NFR-8 (의존성)**: anthropic SDK를 requirements.txt에 명시(현재 0.109.2 핀).

## 범위 밖 (후속)
- 프론트 챗봇 위젯 UI·iframe·mailto — 3차
- region country 대칭 **풀세트** 명세(현재는 잠정 최소) — 후속 확장
- Docker/배포 — 4차

## 핵심 요약
2차는 `AnthropicBedrockMantle`(Opus 4.8, ap-northeast-2)로 country/region 리서치 Agent를 구현해 **구조화 출력**으로 스키마를 강제하고 기존 storage 규칙대로 저장한다. region 리서치 명세는 **EU 샘플 기반 잠정 최소 스키마**로 작성하되 "추후 country 대칭 확장 예정" 코멘트를 명시한다. 챗봇은 §6.5 분기(보유 시 LLM 답변·없으면 리서치 트리거, 권역은 국가 리스트 수용)를 구현한다. 리서치는 1차 잡 매니저를 재사용한 **비동기**, 챗봇은 **동기**. 테스트는 **실 Bedrock 호출**을 포함한다.
