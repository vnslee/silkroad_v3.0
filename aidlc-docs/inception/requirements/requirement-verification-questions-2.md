# Requirements 명확화 질문 — 2차 (챗봇 + 리서치, Bedrock)

ROADMAP 2차. 각 `[Answer]:` 뒤에 보기 문자를 적고, 끝나면 "완료"라고 알려주세요. 권장안은 대체로 A입니다.

> **확인된 환경**: `anthropic` SDK 0.109.2 + boto3 1.42.97 설치됨, `AnthropicBedrock`·`AnthropicBedrockMantle` 모두 import 가능. AWS 자격증명 present, 리전 ap-northeast-2. region 리서치 명세(`region_research_*.md`)는 **아직 없음(2차 생성 대상)**. country 리서치 프롬프트·스키마는 정식 존재. 1차 backend-api 완료(FastAPI + 잡/오케스트레이터).

## Question 1
리서치 Agent의 Bedrock 호출 방식은?

A) **anthropic SDK `AnthropicBedrockMantle`** — `AnthropicBedrockMantle(aws_region="ap-northeast-2")` + `messages.create(model="anthropic.claude-opus-4-8", ...)` (Messages API 일관성, claude-api 스킬 권장)

B) **boto3 `bedrock-runtime` invoke_model** — 저수준 직접 호출(JSON 수동 조립)

C) **anthropic SDK `AnthropicBedrock`** (레거시 invoke 경로)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
리서치에 사용할 모델은? (리서치는 장문·구조화 출력 — 비용/품질 트레이드오프)

A) **Opus 4.8** (`anthropic.claude-opus-4-8`) — 최고 품질, 복잡 리서치 적합 (claude-api 기본 권장)

B) **Sonnet 4.6** (`anthropic.claude-sonnet-4-6`) — 속도·비용 균형

C) **설정 가능** — internal/config에 모델 ID를 두고 교체 가능하게(기본 Opus)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
리서치 결과의 스키마 강제 방식은? (country/region 스키마 준수 필요)

A) **구조화 출력(`output_config.format` json_schema)** — 스키마로 강제, 검증 통과 보장 (Bedrock 지원, 권장)

B) **프롬프트 + 사후 파싱/검증** — 프롬프트로 JSON 요청 후 pydantic 검증, 실패 시 재시도

C) **둘 다** — 구조화 출력 우선, 실패 시 프롬프트 폴백

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
region 리서치 명세(`architecture/research/region_research_*.md`) 작성 범위는? (country 대칭, 현재 없음)

A) **country 대칭 풀세트** — `region_research_prompt.md` + `region_research_schema.md`를 country와 동일 구조로 신규 작성 (ROADMAP 명시, 권장)

B) **기존 EU 샘플 기반 최소 스키마** — 현재 `region/EU` 샘플 구조를 문서화하는 수준

X) Other (please describe after [Answer]: tag below)

[Answer]: X, B로 하되 샘플이라는게 명시되고 추후 COUNTRY 대칭 추가될 예정이라는 점이 코멘트 필요해.

## Question 5
챗봇 응답 로직의 범위는? (web_design_spec §6.5 분기)

A) **분기 + 리서치 트리거 (LLM 응답 포함)** — 보유 정보 있으면 LLM이 기존 데이터로 답변, 없으면 "리서치 진행?" 분기 → 리서치 Agent 호출 → 완료 후 답변 (스펙 §6.5.1/6.5.2 충실)

B) **분기 + 트리거만 (정형 응답)** — 데이터 유무 판정·리서치 트리거만, 답변은 정형 템플릿(LLM 자유응답 없음)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
챗봇·리서치 API 처리 방식은? (1차 보고서 생성과 정합)

A) **리서치=비동기 잡(1차 잡 매니저 재사용), 챗봇=동기** — 리서치는 수십 초이므로 job_id+폴링(1차 패턴 재사용), 단순 챗봇 질의는 동기 응답 (권장)

B) **둘 다 동기** — 단순하지만 리서치 중 HTTP 장시간 대기

C) **둘 다 비동기** — 챗봇도 잡으로

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
권역 리서치 시 "포함할 국가 리스트" 입력 처리는? (§6.5.2: 권역 정보 없으면 국가 리스트를 사용자에게 질의)

A) **API가 국가 리스트를 파라미터로 받음** — 프론트/챗봇이 국가 코드 배열을 넘기면 각 국가 + 권역 리서치 수행 (스펙 충실, 권장)

B) **권역만 리서치** — 국가 리스트 분기는 3차 프론트로 미루고 2차는 권역 단위만

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 8
테스트 시 실제 Bedrock을 호출할까요? (비용·자격증명 발생)

A) **모킹 우선** — 단위/통합 테스트는 Bedrock 클라이언트를 모킹, 실제 호출은 수동 스모크 1회 (비용 절감·CI 안전, 권장)

B) **실제 호출 포함** — 테스트에서 실 Bedrock 호출(비용·지연 발생)

X) Other (please describe after [Answer]: tag below)

[Answer]: B, 비용 이슈 없어.
