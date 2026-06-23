# Component Methods — backend-api (1차)

메서드 시그니처·입출력 개요. 상세 비즈니스 규칙은 Functional Design에서 확정. 도메인은 `Literal["country","region"]`.

## C2. Engine Adapter

```python
def generate_report_json(domain, target_id, *, internal_path=None) -> str
    # domain별 *ReportEngine 인스턴스화 → load → generate_typeN → save → 리포트 JSON 절대경로 반환
    # country: generate_type1_report / region: generate_type2_report(+gap)

def render_report_html(domain, report_json_path) -> str
    # *ReportRenderer(report_json_path) → load_report → save_html() → HTML 절대경로 반환

def render_detail_html(domain, target_id, *, version=None) -> str
    # detail 렌더러 render(code|region, version) 호출 → 출력 HTML 절대경로 반환
    # 입력: data/research/<domain>/<id>/<id>_latest.json (self-locate)
```

## C3. Report Orchestrator

```python
def run_report_pipeline(domain, target_id, progress_cb=None) -> ReportResult
    # 1) progress_cb("generation") → adapter.generate_report_json
    # 2) progress_cb("rendering")  → adapter.render_report_html
    # 3) ReportResult(report_id, json_path, html_path, json_url, html_url) 반환
    # country/region 동일 시퀀스 (Q5: region 비대칭 흡수)
```

## C4. Job Manager

```python
def create_job(kind, params) -> str                 # job_id(UUID) 발급, status="queued"
def start(job_id) -> None                            # status="running"
def set_progress(job_id, step, message=None) -> None # 진행 단계 기록 (generation/rendering)
def succeed(job_id, result: dict) -> None            # status="succeeded", result(산출물 URL 등)
def fail(job_id, error: str) -> None                 # status="failed", error 메시지
def get_job(job_id) -> JobStatus | None              # 상태 스냅샷 (없으면 None→404)
# 내부: dict + threading.Lock
```

## C5. Storage Resolver

```python
def list_countries() -> list[str]                    # research/country/* 코드 목록
def list_regions() -> list[str]                      # research/region/* 코드 목록
def research_exists(domain, target_id) -> bool       # <id>_latest.json 또는 <id>_*.json 존재
def existence_info(domain, target_id) -> ExistenceInfo # research/detail/report 보유 플래그
def list_reports(domain, target_id) -> list[ReportRef] # report/<domain>/<id>/data/RPT_*.json 목록
def report_json_path(domain, target_id, report_id) -> str | None
def report_html_path(domain, target_id, report_id) -> str | None
def latest_detail_html(domain, target_id) -> str | None  # detail 캐시 최신본 (Q6)
def to_url(kind, domain, target_id, report_id=None) -> str  # 상대 URL 조립 (Q7)
# STORAGE_BASE: 모듈 로드시 self-locate (engine 패턴 차용)
```

## C6. PDF Service

```python
def ensure_pdf(html_path) -> str
    # 형제 pdf/ 경로 계산 → 있으면 그대로 반환, 없으면 html_to_pdf 변환 후 pdf 경로 반환
```

## C1. Routers (엔드포인트 ↔ 핸들러)

| Method · Path | 핸들러 책임 | 응답 |
|---|---|---|
| `GET /api/countries` | resolver.list_countries | `list[CountrySummary]` |
| `GET /api/regions` | resolver.list_regions | `list[RegionSummary]` |
| `GET /api/countries/{code}` | resolver.existence_info(country) | `ExistenceInfo` |
| `GET /api/regions/{region}` | resolver.existence_info(region) | `ExistenceInfo` |
| `GET /api/countries/{code}/detail` | 캐시 or adapter.render_detail_html | `text/html` |
| `GET /api/regions/{region}/detail` | 동상 | `text/html` |
| `POST /api/countries/{code}/reports` | job_manager.create_job + BackgroundTasks(orchestrator) | `JobCreatedResponse(job_id, status_url)` |
| `POST /api/regions/{region}/reports` | 동상 | `JobCreatedResponse` |
| `GET /api/countries/{code}/reports` | resolver.list_reports | `ReportListResponse` |
| `GET /api/regions/{region}/reports` | 동상 | `ReportListResponse` |
| `GET /api/countries/{code}/reports/{rid}/json` | resolver.report_json_path | `application/json` |
| `GET /api/countries/{code}/reports/{rid}/html` | resolver.report_html_path | `text/html` |
| `GET /api/countries/{code}/reports/{rid}/pdf` | pdf_service.ensure_pdf | `application/pdf` (FileResponse) |
| (region 동형 reports/{rid}/json·html·pdf) | 동상 | 〃 |
| `GET /api/jobs/{job_id}` | job_manager.get_job | `JobStatus` |

> 모든 country/region 경로는 대칭(NFR-2). 핸들러는 도메인만 다르고 동일 서비스 호출.
