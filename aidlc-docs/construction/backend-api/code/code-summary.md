# Code Summary — backend-api (1차)

Code Generation Part 2 산출물 요약. 전부 **신규 생성**(기존 엔진 무수정).

## 생성 파일 (애플리케이션 코드)

| 파일 | 컴포넌트 | 역할 |
|---|---|---|
| `app/backend/api/__init__.py` | — | 패키지 |
| `app/backend/api/config.py` | 공통 | STORAGE_BASE self-locate·CORS·로깅·도메인 상수·엔진 path 주입 |
| `app/backend/api/schemas.py` | C7 | Pydantic 모델(Summary·ExistenceInfo·ReportRef·Job*) |
| `app/backend/api/services/storage_resolver.py` | C5 | 목록·존재·채번조회·경로·to_url (L1·L3·L4) |
| `app/backend/api/services/engine_adapter.py` | C2 | 엔진/렌더 in-process 호출(유일한 engine 의존점) |
| `app/backend/api/services/job_manager.py` | C4 | dict+Lock 잡 수명주기, step→percent (L6) |
| `app/backend/api/services/orchestrator.py` | C3 | run_report_job: generation→rendering (L5) |
| `app/backend/api/services/pdf_service.py` | C6 | ensure_pdf(멱등, report-pdf 연계) (L7) |
| `app/backend/api/routers/catalog.py` | C1 | GET /api/countries·/regions·/{id} (FR-1) |
| `app/backend/api/routers/detail.py` | C1 | GET /{domain}/{id}/detail 캐시우선 (FR-2) |
| `app/backend/api/routers/reports.py` | C1 | POST reports·GET 목록·json·html·pdf (FR-3·4·5) |
| `app/backend/api/routers/jobs.py` | C1 | GET /api/jobs/{id} (FR-3.2) |
| `app/backend/api/main.py` | C1 | 앱·CORS·라우터등록·/health |
| `app/backend/requirements.txt` | — | 버전 핀 + hypothesis (FR-6) |

## 테스트 파일

| 파일 | 대상 |
|---|---|
| `app/backend/tests/conftest.py` | TestClient fixture |
| `app/backend/tests/strategies.py` | 도메인 생성기 (PBT-07) |
| `app/backend/tests/test_schemas_pbt.py` | 모델 라운드트립 (PBT-02·08) |
| `app/backend/tests/test_resolver_pbt.py` | to_url·parse_nnn 불변식 (PBT-03·08) |
| `app/backend/tests/test_api_integration.py` | happy-path + 409/404/422 (PBT-10 예제) |

## 엔드포인트 (country/region 대칭)
- `GET /health`
- `GET /api/countries` · `GET /api/regions`
- `GET /api/countries/{code}` · `GET /api/regions/{region}` (exists 플래그, 200)
- `GET /api/{domain}/{id}/detail` (text/html, 캐시우선)
- `POST /api/{domain}/{id}/reports` (202, job_id) → `GET /api/jobs/{job_id}`
- `GET /api/{domain}/{id}/reports` (목록)
- `GET /api/{domain}/{id}/reports/{rid}/json|html|pdf`

## 설계 준수
- in-process import(Q1=A), REST 경로(Q2=A), BackgroundTasks+dict 잡(Q3=A), 증분 채번(Q4=A), CORS `*`(Q5=A), 상세화면 캐시우선(Q6=A), 상대 URL(Q7=A)
- Python 3.9 호환(`from __future__ import annotations`, `Optional`/`Literal`)
- 기존 엔진 무수정. region 비대칭은 orchestrator가 명시 렌더로 흡수.

## 게이트
- ✅ `python3 -m py_compile` 전체 통과(21개 .py, 리뷰 반영 후 재통과)
- ⏭ 의존 설치(hypothesis)·테스트 실행·서버 기동은 **Build & Test** 단계

## code-reviewer 리뷰 반영 (Critical 0 / High 1 / Medium 4 / Low 6)
**적용:**
- **H1** report_id 전체 정규식(`REPORT_ID_PATTERN`) 강제 — 경로 traversal 방어 (reports.py·config.py)
- **M1** `research_latest_path` 단일 헬퍼로 통일 — exists 판정과 생성 입력 비대칭 제거 (storage_resolver·engine_adapter)
- **M2** detail 라우터 `SystemExit` 포착 (detail.py)
- **M3(부분)** `latest_report_id` 파일명만으로 판정 — existence_info의 불필요한 JSON 파싱 제거 (storage_resolver)
- **M4** PDF 함수 탐색서 `main` 제외, `convert` 우선 (pdf_service)
- **L1** `job_status_url` 명시 함수 분리 (storage_resolver·reports)
- **L2** parse_nnn 음성/경계 예제 테스트로 보강 (test_resolver_pbt)
- **L5** CORS `allow_credentials=False` (와일드카드 충돌 회피) (main)

**보류(사유):**
- **M3(카탈로그 캐싱)**·**L3·L4(요청모델·POST→job 폴링 테스트)** — 2차(요청 body·리서치 흐름) 진입 시 처리
- **L6** country/region 핸들러 중복 — 설계 Q2=A의 의도된 명시적 대칭 라우트, 현행 유지
