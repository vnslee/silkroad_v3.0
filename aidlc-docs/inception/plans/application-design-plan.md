# Application Design Plan — backend-api (1차)

요구사항(`requirements.md`)·실행계획을 바탕으로 한 애플리케이션 설계 계획이다. 아래 **설계 질문**에 `[Answer]:` 답변을 채운 뒤 "완료"라고 알려주면, 답변을 반영해 설계 산출물(`application-design/`)을 생성한다.

## 확인된 엔진 인터페이스 (호출 대상, 무수정)

- **Generation**
  - `CountryReportEngine(country_data_path, internal_data_path, output_base_path)` → `load_country_data()`·`load_internal_data()`·`generate_type1_report()`·`save_type1_report(report)`
  - `RegionReportEngine(region_data_path, internal_path, output_base)` → `load_region_data()`·`load_internal_data()`·`generate_type2_report()`·`save_type2_report(report)`(+gap report)
- **Report Renderer**: `Country/RegionReportRenderer(report_json_path)` → `load_report()`·`save_html(output_path=None)`
- **Detail Renderer**: 함수형 `render(code|region, version=None)` → 출력 HTML 경로 반환(self-locate, `data/research` 읽어 `detail/.../html` 작성)
- **PDF**: `.claude/skills/report-pdf/scripts/html_to_pdf.py <html_path> [out_pdf]`

## 설계 산출물 계획 (Mandatory)

- [ ] `application-design/components.md` — 컴포넌트 정의·책임·인터페이스
- [ ] `application-design/component-methods.md` — 메서드 시그니처·입출력
- [ ] `application-design/services.md` — 서비스 정의·오케스트레이션 패턴
- [ ] `application-design/component-dependency.md` — 의존 매트릭스·통신·데이터 흐름
- [ ] `application-design/application-design.md` — 통합 설계 문서

## 식별된 컴포넌트 (초안 — 질문 답변으로 확정)

1. **FastAPI App / Router** — HTTP 엔드포인트(조회·존재확인·상세화면·보고서생성트리거·잡상태·산출물·PDF)
2. **Engine Adapter** — 엔진 클래스/렌더 함수를 in-process로 감싸는 country/region 대칭 래퍼
3. **Report Orchestrator** — generation(JSON)→rendering(HTML) 일괄 수행(Q5 비대칭 흡수)
4. **Job Manager** — 비동기 잡 발급·상태 추적(queued/running/succeeded/failed)·진행단계
5. **Storage Resolver** — storage 경로·네이밍·산출물 탐색(목록·최신본·존재여부)
6. **PDF Service** — 보고서 HTML→PDF 변환(report-pdf 스크립트 연계)
7. **Schemas (Pydantic)** — 요청/응답·잡 상태 모델

---

# 설계 질문

## Question 1
신규 API 코드의 디렉토리 구조는? (CLAUDE.md는 `app/backend/api/` 또는 `main.py`를 언급)

A) **`app/backend/api/` 패키지** — `api/main.py`(앱)·`api/routers/`·`api/services/`·`api/schemas.py`·`api/adapters/` 등 모듈 분리 (확장성, 권장)

B) **단일 `app/backend/main.py`** — 한 파일에 앱+라우트 집중 (단순, 소규모)

C) **`app/backend/api/` + 평면 구조** — `api/` 안에 모듈을 두되 서브패키지 없이 평면적으로

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
API 경로(URL) 네이밍 규칙은? (country/region 대칭 전제)

A) **리소스 중심 `/api/{domain}/...`** — 예: `/api/countries`, `/api/countries/{code}`, `/api/countries/{code}/detail`, `/api/countries/{code}/reports`, `/api/regions/{region}/...`, 생성은 `POST /api/countries/{code}/reports`, 잡은 `/api/jobs/{id}` (REST 관행, 권장)

B) **액션 중심 `/api/generate-report?domain=country&code=ES`** — 쿼리 파라미터로 분기

C) **버전 프리픽스 포함 `/api/v1/...`** — A에 `/v1` 추가

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
비동기 잡(Job)의 저장소/실행 방식은? (Q2=B 폴링 채택 반영, 단일 서버 전제)

A) **In-memory dict + FastAPI BackgroundTasks** — 프로세스 메모리에 잡 상태 보관, 백그라운드 실행 (단순, 1차 충분, 서버 재시작 시 휘발 — 권장)

B) **In-memory + 파일 영속화** — 잡 상태를 `storage`에 JSON으로도 기록(재시작 후 조회 가능)

C) **외부 큐/워커(Celery·RQ 등)** — 별도 워커 프로세스 (오버엔지니어링 우려)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
이미 산출물(리포트 JSON/HTML)이 존재할 때 생성 트리거의 동작은?

A) **항상 새로 생성(증분 채번)** — 기존 NNN 유지하고 +1 새 리포트 생성 (이력 보존, 엔진 기본 동작과 일치 — 권장)

B) **캐시 우선** — 최신본이 있으면 재사용, `force=true` 시에만 재생성

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
CORS 설정은? (3차 React 프론트가 별도 origin에서 호출 예정)

A) **개발용 전체 허용** — `allow_origins=["*"]` (1차/개발 단계 단순, 배포 시 조정 — 권장)

B) **명시적 화이트리스트** — localhost:5173(Vite) 등 구체적 origin만

C) **미설정** — 1차는 CORS 신경 안 씀(같은 origin 가정)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
상세화면(P1/P2) HTML 요청 시 캐시 정책은? (FR-2)

A) **캐시 우선, 없으면 렌더** — `detail/.../html`에 최신본 있으면 반환, 없으면 `render()` 호출 후 반환 (PIPELINE §6 (B) 시퀀스와 일치 — 권장)

B) **항상 새로 렌더** — 매 요청마다 최신 리서치로 재렌더

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
응답에서 "산출물 위치"를 프론트에 어떻게 노출할까? (iframe src 조립 위해)

A) **상대 URL 경로 반환** — 예: `{ "html_url": "/api/countries/ES/reports/RPT_CTR_ES_001/html" }` (프론트가 베이스URL 붙여 iframe src로 사용 — 권장)

B) **서버 파일시스템 경로 반환** — `storage/...` 실제 경로 (프론트가 직접 못 씀, 비권장)

C) **ID만 반환** — 프론트가 규칙으로 URL 조립

X) Other (please describe after [Answer]: tag below)

[Answer]: A
