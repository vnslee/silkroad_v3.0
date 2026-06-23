# Code Generation Plan — backend-api (1차)

이 계획이 Code Generation의 **단일 출처(SoT)**다. Part 2에서 단계 순서대로 실행하며 각 단계 완료 시 `[x]`로 표시한다.

## 컨텍스트
- **Project Type**: Brownfield. **Workspace Root**: `/home/participant/silk-road_v1.0`
- **Unit**: backend-api. 기존 엔진(`app/backend/engine/`)은 **무수정 호출**.
- **신규 코드 위치**: `app/backend/api/` (애플리케이션 코드 — aidlc-docs 아님)
- **테스트 위치**: `app/backend/tests/`
- **의존**: 없음(1차 최초). 후속(2·3차)이 이 API에 의존.

## 설계 입력 (참조)
- Application Design: `inception/application-design/*` (컴포넌트 C1~C7)
- Functional Design: `construction/backend-api/functional-design/*` (엔티티·로직 L1~L7·규칙·PBT)
- NFR/Tech: `construction/backend-api/nfr-requirements/*` (버전 핀·Hypothesis·Python3.9)

## 산출물 구조 (생성 대상)
```
app/backend/
├── api/
│   ├── __init__.py
│   ├── config.py            # STORAGE_BASE self-locate, CORS, 로깅, 상수
│   ├── schemas.py           # C7 Pydantic 모델
│   ├── services/
│   │   ├── __init__.py
│   │   ├── storage_resolver.py   # C5 (L1·L3·L4)
│   │   ├── engine_adapter.py     # C2
│   │   ├── orchestrator.py       # C3 (L5)
│   │   ├── job_manager.py        # C4 (L6)
│   │   └── pdf_service.py        # C6 (L7)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── catalog.py            # C1 FR-1
│   │   ├── detail.py             # C1 FR-2 (L2)
│   │   ├── reports.py            # C1 FR-3·4·5
│   │   └── jobs.py               # C1 FR-3.2
│   └── main.py              # 앱·CORS·라우터 등록·예외 핸들러
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # TestClient fixture
│   ├── test_schemas_pbt.py       # PBT-02 라운드트립
│   ├── test_resolver_pbt.py      # PBT-03 to_url·report_id 불변식 + PBT-07 생성기
│   ├── test_api_integration.py   # happy-path + 에러(409/404/422) — PBT-10 예제기반
│   └── strategies.py             # PBT-07 도메인 생성기(재사용)
└── requirements.txt         # FR-6 버전 핀 + hypothesis
```

---

## 실행 단계 (번호화)

- [x] **Step 1 — 패키지 스캐폴딩**: `api/__init__.py`, `api/services/__init__.py`, `api/routers/__init__.py`, `tests/__init__.py` 생성. (FR 전반)
- [x] **Step 2 — config.py**: STORAGE_BASE self-locate(엔진과 동일 기준), 도메인 상수, CORS origin, 로깅 설정(`silkroad.api`). (NFR)
- [x] **Step 3 — schemas.py**: CountrySummary·RegionSummary·ExistenceInfo·ReportRef·ReportListResponse·JobCreatedResponse·JobStatus·JobResult. Python3.9 호환(`from __future__ import annotations`). (C7, FR-1·3·4)
- [x] **Step 4 — services/storage_resolver.py**: list_countries/regions·research_exists·existence_info·list_reports·report_json/html_path·latest_detail_html·to_url. (C5, L1·L3·L4, FR-1·2·4)
- [x] **Step 5 — services/engine_adapter.py**: generate_report_json·render_report_html·render_detail_html (engine sys.path 주입, 절대경로). (C2)
- [x] **Step 6 — services/job_manager.py**: dict+Lock, create_job/start/set_progress/succeed/fail/get_job, step→percent 매핑. (C4, L6)
- [x] **Step 7 — services/orchestrator.py**: run_report_pipeline(generation→rendering, progress_cb). (C3, L5)
- [x] **Step 8 — services/pdf_service.py**: ensure_pdf(report-pdf 스크립트 연계, 멱등). (C6, L7, FR-5)
- [x] **Step 9 — routers/catalog.py**: GET /api/countries·/regions·/{id}. (FR-1)
- [x] **Step 10 — routers/detail.py**: GET /api/{domain}/{id}/detail (캐시우선). (FR-2, L2)
- [x] **Step 11 — routers/reports.py**: POST reports(잡 트리거+BackgroundTasks)·GET reports 목록·json·html·pdf. (FR-3·4·5)
- [x] **Step 12 — routers/jobs.py**: GET /api/jobs/{job_id}. (FR-3.2)
- [x] **Step 13 — main.py**: FastAPI 앱, CORS 미들웨어, 라우터 등록, 예외→HTTP 매핑, 로깅 init. (C1, NFR)
- [x] **Step 14 — requirements.txt**: 버전 핀(fastapi·uvicorn·pydantic·jinja2·weasyprint·boto3·requests + pytest·hypothesis·httpx). (FR-6, PBT-09)
- [x] **Step 15 — tests/strategies.py**: 도메인 생성기(domain·target_id·nnn·report_id). (PBT-07)
- [x] **Step 16 — tests/test_schemas_pbt.py**: 모델 라운드트립 property. (PBT-02·08)
- [x] **Step 17 — tests/test_resolver_pbt.py**: to_url·report_id 파싱 불변식 property. (PBT-03·08)
- [x] **Step 18 — tests/conftest.py + test_api_integration.py**: TestClient happy-path + 409/404/422. (PBT-10 예제기반, FR 전반)
- [x] **Step 19 — py_compile 게이트**: 신규 .py 전체 `python3 -m py_compile`. (CLAUDE.md)
- [x] **Step 20 — 코드 요약 문서**: `aidlc-docs/construction/backend-api/code/code-summary.md`(생성 파일·매핑). (문서)

> 빌드/서버 기동·테스트 **실행**은 다음 Build & Test 단계에서 수행(여기선 생성까지).

## FR 추적성
| FR | 충족 Step |
|---|---|
| FR-1 조회 | 3,4,9 |
| FR-2 상세화면 | 4,5,10 |
| FR-3 보고서 생성(잡) | 3,5,6,7,11,12 |
| FR-4 산출물 제공 | 4,11 |
| FR-5 PDF | 8,11 |
| FR-6 requirements | 14 |
| PBT(02·03·07·08·09) | 14,15,16,17 |

## 총 단계: 20. 범위: 신규 ~18개 파일 + requirements.txt + 요약 문서. 기존 엔진 무수정.
