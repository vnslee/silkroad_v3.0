# Application Design (통합) — backend-api (1차)

> 세부 문서: [components.md](components.md) · [component-methods.md](component-methods.md) · [services.md](services.md) · [component-dependency.md](component-dependency.md)

## 개요
ROADMAP 1차 — 프론트(3차)가 호출할 FastAPI HTTP API를 `app/backend/api/` 패키지로 신규 구축하고, 검증된 country/region 엔진(generation·rendering)과 detail 렌더러를 **in-process import**로 연결한다. 보고서 생성은 **비동기 잡 + 폴링**, 산출물(JSON/HTML/PDF·상세화면 HTML)은 엔드포인트로 제공한다.

## 설계 결정 (Q1~Q7)
| 결정 | 값 |
|---|---|
| 디렉토리 | `app/backend/api/` 패키지(routers/services/schemas 분리) |
| URL | 리소스 중심 REST `/api/{countries|regions|jobs}/...` |
| 잡 | in-memory dict + FastAPI BackgroundTasks |
| 재생성 | 항상 새로(증분 채번, 엔진 기본 동작) |
| CORS | 개발용 전체 허용(`*`) |
| 상세화면 | 캐시 우선, 없으면 렌더 |
| 산출물 노출 | 상대 URL 반환 |

## 컴포넌트 (7)
1. **API Router (C1)** — 엔드포인트·검증·응답 직렬화, country/region 대칭
2. **Engine Adapter (C2)** — 엔진/렌더 in-process 래퍼(유일한 engine 의존점)
3. **Report Orchestrator (C3)** — generation→rendering 일괄(region 비대칭 흡수)
4. **Job Manager (C4)** — 비동기 잡 수명주기(stateful, lock 보호)
5. **Storage Resolver (C5)** — 경로·목록·존재·채번·URL 단일 해석점
6. **PDF Service (C6)** — HTML→PDF(report-pdf 연계)
7. **Schemas (C7)** — Pydantic 모델(직렬화 계약, PBT-02 대상)

## 핵심 흐름
- **조회**(동기): Router → Resolver → 응답
- **상세화면**(캐시우선): Router → Resolver.latest_detail_html → (없으면) Adapter.render_detail_html
- **보고서 생성**(비동기): Router → JobMgr.create_job + BackgroundTasks → Orchestrator(generation→rendering) → JobMgr.succeed; 폴링 `GET /api/jobs/{id}`
- **PDF**: Router → Resolver(html 경로) → PDF.ensure_pdf → FileResponse

## 대칭성·관심사 분리
- country/region은 동일 서비스 메서드를 도메인 인자로 호출(라우터만 두 벌). region 엔진 렌더러 자동호출 부재는 Orchestrator가 항상 명시 렌더로 흡수(외부 대칭).
- API는 계산/렌더를 재구현하지 않고 엔진 호출만(NFR-3). 기존 엔진 무수정(NFR-4).

## 경로·네이밍 (NFR-1)
- 입력: `storage/data/research/{country,region}/<ID>/<ID>_latest.json`, `internal/internal_latest.json`
- 출력: 엔진이 기존 규칙대로 작성(`report/.../data|html`, `detail/.../html`, PDF는 형제 `pdf/`)
- Resolver가 경로 해석·URL 변환 전담(STORAGE_BASE self-locate)

## NFR 반영 (경량)
- 동시성: JobMgr lock / BackgroundTasks 스레드(Q3)
- 에러: 409(데이터없음)·404(산출물없음)·422(검증)·500/job-failed(엔진오류) — services.md
- 테스트(PBT Partial): Schemas 라운드트립(PBT-02), Resolver 채번·URL 불변식(PBT-03), 도메인 생성기(PBT-07), seed 재현성(PBT-08), Hypothesis(PBT-09)

## 범위 밖 (후속)
- 리서치 실행·챗봇(2차), 프론트·mailto(3차), Docker/CFN(4차), 룰셋 수정 엔드포인트
