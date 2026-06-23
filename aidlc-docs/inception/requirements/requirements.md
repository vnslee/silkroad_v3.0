# Requirements — 1차: 백엔드 API + 진단 파이프라인 정합화 (country ↔ region 대칭)

## Intent 분석 요약

- **User Request**: 설계 문서 완료 → 실제 구현 착수. AI-DLC로 순차 진행, ROADMAP **1차(백엔드 API + 진단 파이프라인)** 부터.
- **Request Type**: New Feature (신규 API 레이어) + Enhancement (기존 엔진 정합화)
- **Scope**: Multiple Components — FastAPI 앱 신규 + 기존 generation/rendering 엔진(country·region) 연결
- **Complexity**: Moderate — 엔진은 존재, API 레이어·비동기 잡 관리·산출물 서빙을 신규 구축
- **Project Type**: Brownfield (엔진·스토리지·설계 명세 존재)

## 결정 사항 (명확화 답변 반영)

| # | 결정 | 내용 |
|---|------|------|
| Q1 | 엔진 호출 | **In-process import** — FastAPI가 `CountryReportEngine`·`RegionReportEngine`·`*Renderer` 클래스를 직접 import해 호출 |
| Q2 | 생성 처리 | **비동기 + 작업 상태 폴링** — 생성 트리거가 `job_id` 반환, `GET /jobs/{id}`로 진행 상태 조회 (PS2 프로그레스 정합) |
| Q3 | 엔드포인트 범위 | **핵심 + PDF** — 목록/존재확인·생성트리거·산출물(JSON/HTML) 제공·상세화면 HTML + **보고서 PDF**. 룰셋 수정·mailto는 후속(2/3차) |
| Q4 | HTML 제공 | **API 엔드포인트로 반환** — `text/html`로 파일을 읽어 반환(경로 추상화). 정적 서빙 미채택 |
| Q5 | region 비대칭 | **API 레이어에서 흡수** — country/region 모두 API가 "생성 JSON → 렌더 HTML"을 일괄 오케스트레이션해 외부에서 대칭. region 엔진 자동호출 비대칭은 그대로 둠 |
| Q6 | 레거시 파일 | 사용자가 `app/backend/report_engine.py` **이미 삭제**(git `D` 확인). 신규 API는 `engine/generation/`만 사용 |
| Q7 | requirements.txt | **현재 설치 패키지 버전 핀(pin)** |

## Extension 설정

- **Security Baseline**: No (생략)
- **Resiliency Baseline**: No (생략)
- **Property-Based Testing**: **Yes — Partial** (PBT-02 라운드트립 · PBT-03 불변식 · PBT-07 생성기 품질 · PBT-08 shrinking/재현성 · PBT-09 프레임워크 강제. 나머지 advisory)

---

## 기능 요구사항 (Functional Requirements)

### FR-1. 국가/권역 조회 API
- **FR-1.1** country 목록 조회 — 리서치 데이터(`storage/data/research/country/`)가 있는 국가 코드 목록 반환.
- **FR-1.2** region 목록 조회 — `storage/data/research/region/` 기준 권역 코드 목록 반환.
- **FR-1.3** 단일 country/region 존재·메타 확인 — 리서치 데이터 유무, 기존 산출물(detail/report) 유무 플래그 반환. (PIPELINE §1: 데이터 없으면 리서치 분기 — 1차는 "없음" 신호만, 실제 리서치 트리거는 2차)

### FR-2. 상세화면(P1/P2) HTML 제공
- **FR-2.1** country 상세화면 HTML 요청 — 캐시(`detail/country/<CODE>/html/`)가 있으면 최신본 반환, 없으면 `country_detail_renderer`를 호출해 렌더 후 반환.
- **FR-2.2** region 상세화면 HTML 요청 — 동일하게 `region_detail_renderer` 사용.
- **FR-2.3** 반환 형식: `text/html` (iframe `src`로 embed 가능, PIPELINE §5).

### FR-3. 보고서(PR1/PR2) 생성 — 비동기 잡
- **FR-3.1** 생성 트리거 — country/region 대상 보고서 생성 요청 시 `job_id` 발급하고 즉시 반환(수락).
- **FR-3.2** 잡 상태 조회 — `GET /jobs/{job_id}`로 상태(`queued`/`running`/`succeeded`/`failed`)·진행 단계·결과 산출물 ID 반환.
- **FR-3.3** 오케스트레이션 — API가 country/region 모두 "generation(JSON) → rendering(HTML)"을 일괄 수행(Q5: region 비대칭을 API가 흡수해 외부 대칭).
- **FR-3.4** 채번 — 기존 엔진의 `RPT_CTR_<CODE>_<NNN>` / `RPT_RGN_<REGION>_<NNN>` 채번 규칙을 그대로 사용.

### FR-4. 산출물 제공
- **FR-4.1** 리포트 JSON 조회 — `report/<country|region>/<ID>/data/RPT_*.json` 반환(application/json).
- **FR-4.2** 보고서 HTML 조회 — `report/.../html/RPT_*.html` 반환(text/html).
- **FR-4.3** 보고서 목록 — 특정 country/region의 생성된 리포트 ID 목록 반환.

### FR-5. 보고서 PDF
- **FR-5.1** 보고서 HTML → PDF 변환 제공 — `report-pdf` 스킬 로직(weasyprint) 연계로 `report/.../pdf/`에 생성·반환.
- **FR-5.2** 이미 변환된 PDF가 있으면 재사용.

### FR-6. 패키징
- **FR-6.1** `requirements.txt` — 현재 설치된 백엔드 의존성(fastapi·uvicorn·boto3·pydantic·jinja2·requests·weasyprint 등) + PBT 프레임워크(**Hypothesis**, PBT-09)를 버전 핀으로 명시.

---

## 비기능 요구사항 (Non-Functional Requirements)

- **NFR-1 (경로 규칙 준수)**: CLAUDE.md·`storage/README.md`의 입출력 경로·네이밍 규칙을 API가 위반하지 않는다. JSON/HTML/PDF 폴더 분리 유지.
- **NFR-2 (대칭성)**: country/region API는 동일한 경로 형태·응답 스키마를 공유한다(ROADMAP 공통 제약).
- **NFR-3 (관심사 분리)**: API 레이어는 엔진의 계산 로직을 재구현하지 않고 호출만 한다. 엔진은 표현/계산 책임 분리(CLAUDE.md) 유지.
- **NFR-4 (엔진 무파괴)**: 기존 엔진 CLI(`main()`) 동작과 import 인터페이스를 깨지 않는다(클래스 직접 호출).
- **NFR-5 (구성)**: 리전 `ap-northeast-2`, storage 베이스 경로는 설정/자동탐지로 해석(엔진 self-locate 패턴 존중).
- **NFR-6 (테스트 — PBT Partial)**: 직렬화 라운드트립(PBT-02)·스코어링 불변식(PBT-03, 예: 점수 범위·랭킹 보존)·도메인 생성기(PBT-07)·seed 재현성(PBT-08)·프레임워크(PBT-09, Hypothesis)를 충족한다.
- **NFR-7 (구문 게이트)**: Python 편집 후 `python3 -m py_compile` 통과(CLAUDE.md 컨벤션).

---

## 범위 밖 (Out of Scope — 후속 덩어리)

- 리서치 실행(Bedrock 호출)·region 리서치 명세 — **2차**
- 챗봇 엔드포인트 — **2차**
- 프론트엔드(React+Vite)·iframe chrome·mailto 조립 — **3차**
- Docker/ECR/CloudFormation 배포 — **4차**
- 룰셋(internal) 수정 엔드포인트(PS1) — 1차는 조회만 고려, 수정은 후속

---

## 핵심 요구사항 요약

1차는 **프론트가 호출할 FastAPI HTTP API**를 신규 구축하고, 기존 country·region 엔진을 **in-process import**로 연결한다. 보고서 생성은 **비동기 잡 + 폴링**으로 처리하고, 상세화면·보고서 HTML·JSON·**PDF**를 엔드포인트로 제공한다. region의 렌더러 자동호출 비대칭은 **API 오케스트레이션이 흡수**해 country/region을 외부에서 대칭으로 노출한다. 산출물은 기존 storage 경로·네이밍 규칙을 그대로 따르고, `requirements.txt`(버전 핀, Hypothesis 포함)를 생성한다.
