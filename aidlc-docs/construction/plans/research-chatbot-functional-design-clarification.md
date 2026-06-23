# Functional Design — 명확화 질문 (Q1 ↔ Q2 긴장 해소)

답변 분석 결과 한 가지 긴장이 있어 확인이 필요합니다.

## 감지된 긴장
- **Q1=A**: 구조화 출력 json_schema는 **느슨하게**(최상위+필수키만) 강제 → LLM이 세부·조건부 필드를 자유롭게 채움(통과율↑).
- **Q2=B**: 사후 검증은 **전체 pydantic 엄격 검증**.

country 스키마는 **조건부 필드가 많습니다**: `score_dimensions`는 지정된 6개 item에만, `timeseries`는 수치형 item에만, role(score/gate/context)별로 추가 필드가 다름. "전체 엄격 pydantic"으로 모든 필드·조건을 강제하면, LLM이 한 항목이라도 누락/형식 위반 시 **검증 실패 → 잡 failed**가 잦아질 수 있습니다(리서치는 비싸고 느린 작업이라 재실패 비용 큼).

## Clarification Question 1
"전체 pydantic 검증(Q2=B)"의 **엄격도/실패 처리**를 어떻게 할까요?

A) **전체 검증하되, 조건부 필드는 Optional·관대하게** — 모든 필드를 pydantic 모델로 정의하되 조건부/세부 필드(score_dimensions·timeseries·role별 추가)는 `Optional`로 두고, **필수 핵심키(code·schema_version·items·item/category/role 등)만 strict**. 위반 시 잡 failed. (Q1 느슨 강제와 정합 — 권장)

B) **전체 필드 strict(모두 required)** — 조건부 필드까지 엄격 요구. 검증 실패율↑ 감수(품질 우선, 재트리거 빈번 가능)

C) **전체 검증 + 검증 실패 시 1회 프롬프트 보강 재호출** — Q5=A(재시도 없음)와 상충하므로, 검증 실패에 한해 예외적으로 1회 재시도 허용

X) Other (please describe after [Answer]: tag below)

[Answer]: A
