# Requirements 명확화 질문 — 1차 (백엔드 API + 진단 파이프라인 정합화)

아래 각 질문의 `[Answer]:` 뒤에 보기 문자(A/B/C…)를 적어주세요. 보기 중 맞는 게 없으면 마지막 보기(Other)를 고르고 `[Answer]:` 뒤에 직접 설명을 적어주세요. 다 끝나면 "완료"라고 알려주세요.

> 컨텍스트: 기존 엔진은 클래스(`CountryReportEngine`·`RegionReportEngine`·`*Renderer`) + CLI `main()` 구조입니다. API 레이어·`requirements.txt`는 아직 없습니다. 이 단계는 **프론트(3차)가 호출할 HTTP API**와 **country/region 진단 파이프라인의 대칭 정합화**가 목표입니다.

---

## Question 1
백엔드 API가 기존 엔진을 호출하는 방식은?

A) **In-process import** — FastAPI가 엔진 클래스(`CountryReportEngine` 등)를 직접 import해서 함수로 호출 (빠름, 에러 핸들링·반환값 제어 쉬움, 권장)

B) **Subprocess 호출** — 기존 CLI `main()`을 `subprocess`로 실행 (엔진 코드 무수정, 격리되지만 stdout 파싱·성능 부담)

C) **혼합** — 생성은 in-process, 렌더는 기존 CLI 재사용 등 선택적

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
보고서 생성(generation+rendering)은 수 초~수십 초 걸릴 수 있습니다. API 처리 방식은?

A) **동기(synchronous)** — 요청 시 끝까지 처리 후 결과 반환 (단순, PS2 프로그레스는 3차 프론트에서 폴링 없이 단순 로딩 표시). 1차는 이걸로 충분

B) **비동기 + 작업 상태 폴링** — 생성 요청 시 job_id 반환, `GET /jobs/{id}`로 진행률 조회 (PS2 프로그레스 화면과 정합, 구현 복잡)

C) **백그라운드 태스크(FastAPI BackgroundTasks)** — 즉시 수락 응답 후 백그라운드 생성, 완료는 별도 조회

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 3
1차에서 구현할 API 엔드포인트 범위는? (PIPELINE.md §1 기준)

A) **핵심 세트** — ① 국가/권역 목록·존재 확인 ② 리포트 생성 트리거(country/region) ③ 산출물(JSON/HTML) 제공 ④ 상세화면 HTML 제공. PDF·mailto·룰셋설정은 후속

B) **핵심 + PDF** — A에 보고서 PDF 변환·제공(`report-pdf` 스킬 연계) 추가

C) **풀 세트** — A + PDF + 룰셋(internal) 조회/수정 엔드포인트(PS1 룰셋 설정 대비)까지

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 4
HTML 산출물(상세화면·보고서)을 프론트에 제공하는 방식은? (PIPELINE.md §5: iframe embed 전제)

A) **정적 파일 서빙** — FastAPI `StaticFiles`로 `storage/` 하위 HTML을 URL 경로로 직접 노출 (iframe `src`로 바로 참조, 단순)

B) **API 엔드포인트로 HTML 반환** — `GET /reports/{...}/html`이 파일을 읽어 `text/html`로 반환 (경로 추상화·접근제어 용이)

C) **둘 다** — 메타·목록은 JSON API, HTML 본문은 정적 서빙

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 5
권역(region) 보고서는 현재 생성 엔진이 렌더러를 **자동 호출하지 않습니다**(country는 자동 호출). API 정합화 방향은?

A) **API 레이어에서 흡수** — country/region 모두 "생성 트리거 → JSON 생성 → HTML 렌더"를 API가 일괄 오케스트레이션해 외부에서 동일하게 보이게 함 (엔진 자동호출 비대칭은 그대로 두고 API가 대칭 보장, 권장)

B) **엔진 수정** — `region_report_engine.py`도 country처럼 렌더러 자동 호출하도록 엔진 자체를 대칭화

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 6
레거시 루트 파일 `app/backend/report_engine.py`(구 단일 `ReportEngine`, 현재 `engine/generation/`으로 분리됨) 처리는?

A) **그대로 둠** — 건드리지 않고 신규 API는 `engine/generation/`만 사용 (안전, 권장)

B) **삭제** — 더 이상 쓰지 않으므로 제거해 혼란 방지

X) Other (please describe after [Answer]: tag below)

[Answer]: X, 내가 이미 삭제했어

---

## Question 7
`requirements.txt` 생성 방식은? (ROADMAP 1차 산출물)

A) **현재 설치 패키지 핀(pin)** — 설치된 fastapi·uvicorn·boto3·pydantic·jinja2·requests·weasyprint 등을 버전 고정해 명시 (재현성, 권장)

B) **최소 명시(범위 지정)** — 핵심 패키지만 하한 버전(`>=`)으로 느슨하게

X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question: Security Extensions
이 프로젝트에 보안 확장 룰(SECURITY)을 적용할까요?

A) Yes — 모든 SECURITY 룰을 차단(blocking) 제약으로 강제 (프로덕션급 권장)

B) No — SECURITY 룰 생략 (PoC·프로토타입·실험 프로젝트 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question: Resiliency Extensions
복원력(Resiliency) 베이스라인을 적용할까요? (AWS Well-Architected 신뢰성 기둥 기반 설계-시점 모범사례 — 프로덕션 인증이 아닌 출발점)

A) Yes — 복원력 베이스라인을 설계-시점 가이드로 적용 (비즈니스 크리티컬 워크로드 권장)

B) No — 생략 (빠른 반복이 중요한 PoC·프로토타입 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question: Property-Based Testing Extension
속성 기반 테스트(PBT) 룰을 강제할까요?

A) Yes — 모든 PBT 룰 강제 (비즈니스 로직·데이터 변환·직렬화·상태 컴포넌트 많을 때 권장)

B) Partial — 순수 함수·직렬화 라운드트립에만 PBT 적용

C) No — PBT 생략 (단순 CRUD·UI·얇은 통합 레이어 적합)

X) Other (please describe after [Answer]: tag below)

[Answer]: B
