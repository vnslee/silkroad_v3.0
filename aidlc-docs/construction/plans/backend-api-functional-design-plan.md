# Functional Design Plan — backend-api (1차)

Application Design을 토대로 한 상세 설계 계획. 아래 **질문**에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 산출물(`functional-design/`)을 생성한다.

## 확인된 데이터 구조 (스키마 설계 근거)

- **country 리서치 JSON**: `code`(ES)·`country`(Spain)·`country_ko`·`region`(EU)·`is_baseline`·`currency`·`fetched_at`·`overall_insight`·`items[]`
- **region 리서치 JSON**: `code`·`region`(European Union)·`region_ko`·`baseline_country`·`fetched_at`·`countries[]`
- **리포트 JSON 공통**: `report_id`·`report_type`·`title`·`target`·`generated_at`·`schema_version`·`data_quality`·`tabs`
  - region 리포트는 추가로 `fx`·`config_version`·`engine_version`·`region_meta`

## 산출물 계획 (Mandatory)
- [ ] `functional-design/domain-entities.md` — 도메인 엔티티·스키마(요청/응답/잡)·필드
- [ ] `functional-design/business-logic-model.md` — 핵심 로직(잡 상태머신·캐시우선·채번조회·URL변환·오케스트레이션)
- [ ] `functional-design/business-rules.md` — 검증·에러매핑·대칭 규칙 + **PBT 속성 식별(PBT-01)**

---

# 질문

## Question 1
잡(Job) 상태 모델의 진행 단계(progress) 표현 방식은? (PS2 프로그레스 화면 정합)

A) **단계 열거 + 퍼센트** — `step`(enum: queued/generating/rendering/done)+`percent`(0·40·80·100 등 고정 매핑) (프론트 진행바 단순, 권장)

B) **단계 열거만** — `step`만, 퍼센트 없음(프론트가 단계→표시 매핑)

C) **자유 메시지 로그** — 진행 메시지 배열 누적

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
완료된 잡의 보관(메모리 dict) 정책은? (Q3=A in-memory 전제)

A) **무기한 보관(프로세스 생존 동안)** — 개수 제한 없음. 단순, 1차 충분(권장)

B) **TTL/개수 상한** — 오래된/초과 잡 자동 제거(메모리 관리)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
국가/권역 목록 응답에 포함할 메타 수준은? (M1 지도/선택 화면이 소비)

A) **식별+상태 최소셋** — `code`·`name`(영문)·`name_ko`·`region`(country만)·`is_baseline`·보유플래그(has_detail/has_report) (지도 마커·목록 충분, 권장)

B) **식별만** — `code`·`name`만(상태는 상세 조회에서)

C) **확장** — A + 리서치 `fetched_at`·최신 report_id 등

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
존재하지 않는 국가/권역(리서치 데이터 없음) 조회 시 응답은? (PIPELINE §1: 리서치 분기)

A) **200 + `exists:false` 플래그** — 정상 응답으로 "없음" 신호(+ 리서치 가능 여부). 프론트가 리서치 제안 분기 (권장)

B) **404 Not Found** — 리소스 없음으로 처리

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
보고서 생성 시 입력 리서치 데이터 버전 선택은?

A) **항상 `<ID>_latest.json`** — 최신 리서치 기준 생성 (단순, 권장)

B) **버전 지정 옵션** — 요청에 `version` 받아 특정 스냅샷으로 생성 가능(기본 latest)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
country/region 공통 잡 결과(result) 스키마 통일 수준은?

A) **완전 통일** — `{domain, target_id, report_id, json_url, html_url, pdf_url(null 가능)}` 동일 형태 (대칭 NFR-2, 권장)

B) **도메인별 분기** — country/region 결과 필드 다르게

X) Other (please describe after [Answer]: tag below)

[Answer]: A
