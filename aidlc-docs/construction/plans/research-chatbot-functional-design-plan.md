# Functional Design Plan — research-chatbot (2차)

Application Design(2차)을 토대로 한 상세 설계 계획. 아래 질문에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 산출물(`construction/research-chatbot/functional-design/`)을 생성한다.

## 확인된 사항 (설계 이슈)
- **country 스키마 복잡도**: item 공통 필드 + role별(score/gate/context) 추가 필드 + 조건부 `score_dimensions`(6개 item 한정, 중첩) + `timeseries`(수치형만). 매우 풍부·조건부.
- **구조화 출력 JSON Schema 제약**(claude-api): `minLength`/`maxLength`/numeric constraints 미지원, `additionalProperties:false` 권장, 재귀 불가. → 복잡한 country 스키마를 strict로 100% 강제하면 스키마 작성·통과가 어려울 수 있음.
- region 스키마는 잠정(EU 샘플 기반 최소).

## 산출물 계획 (Mandatory)
- [ ] `functional-design/domain-entities-2.md` — 리서치/챗봇 엔티티·JSON Schema 전략
- [ ] `functional-design/business-logic-model-2.md` — 프롬프트조립·구조화출력·잡상태·챗봇분기 로직
- [ ] `functional-design/business-rules-2.md` — 검증·에러·대칭 규칙 + PBT 속성

---

# 질문

## Question 1
구조화 출력(`output_config.format`)에 넣을 JSON Schema의 엄격도는? (country 스키마가 복잡·조건부)

A) **느슨한 스키마(핵심 키만 강제)** — 최상위 구조(code·country·items 배열 등)와 item 필수 키만 json_schema로 강제, item 세부(role별·score_dimensions)는 프롬프트 지시 + 사후 pydantic 경량 검증. 구조화출력 통과율↑·복잡도↓ (권장)

B) **엄격한 전체 스키마** — 명세 전체를 json_schema로 표현해 강제(작성·통과 까다로움, 조건부 필드 표현 한계)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
사후 검증(생성 JSON이 스키마 충족하는지) 수준은?

A) **경량 필수키 검증** — code·schema_version·items(비어있지 않음) 등 필수 키 존재만 확인, 실패 시 잡 failed (권장)

B) **전체 pydantic 모델 검증** — 모든 필드를 pydantic으로 엄격 검증

C) **검증 없음** — 구조화출력만 신뢰

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3
리서치 max_tokens·effort 설정은? (Opus 4.8, 장문 구조화 출력)

A) **넉넉히 + streaming** — max_tokens 16000~ + streaming(claude-api: 큰 출력은 스트리밍 권장), effort 기본(high) (권장)

B) **비스트리밍 고정** — max_tokens 보수적, 단순 호출

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
챗봇 LLM 답변의 출력 형식은?

A) **자유 텍스트(structured 없음)** — generate_text로 자연어 답변, 시스템 프롬프트로 톤·범위 지정 (권장)

B) **구조화(answer+근거 분리)** — 답변+인용 item을 json_schema로

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
리서치 실패(Bedrock 오류·스키마 위반) 시 재시도 정책은?

A) **재시도 없음(잡 failed로 명확히)** — 실패 시 error 메시지와 함께 failed, 사용자가 재트리거. anthropic SDK 기본 재시도(429/5xx 2회)는 활용 (권장)

B) **앱 레벨 재시도** — 스키마 위반 시 프롬프트 보강 후 1~2회 재호출

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
region 리서치의 member country 처리 순서는? (FR-1.2)

A) **누락 국가 country 리서치 선행 → 권역 리서치** — member_codes 중 데이터 없는 국가를 먼저 각각 리서치(같은 잡 내 순차), 그 후 권역 (스펙 §6.5.2 충실, 권장)

B) **권역만** — 국가별 리서치는 별도 트리거로 분리

X) Other (please describe after [Answer]: tag below)

[Answer]: A
