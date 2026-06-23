# Components — backend-api (1차)

설계 결정(Q1~Q7 모두 권장안 A) 반영. 신규 코드는 `app/backend/api/` 패키지로 모듈 분리한다. 기존 엔진은 무수정 호출.

## 디렉토리 구조 (Q1=A)

```
app/backend/
├── api/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 생성·CORS·라우터 등록·Static/예외 핸들러
│   ├── config.py            # 경로(STORAGE_BASE 자동탐지)·상수·CORS 설정
│   ├── schemas.py           # Pydantic 요청/응답·잡 상태 모델
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── catalog.py       # 국가/권역 목록·존재·메타 (FR-1)
│   │   ├── detail.py        # 상세화면 HTML (FR-2)
│   │   ├── reports.py       # 보고서 생성트리거·목록·JSON/HTML·PDF (FR-3·4·5)
│   │   └── jobs.py          # 잡 상태 폴링 (FR-3.2)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── engine_adapter.py    # 엔진/렌더 in-process 래퍼 (C2)
│   │   ├── orchestrator.py      # generation→rendering 일괄 (C3)
│   │   ├── job_manager.py       # 비동기 잡 발급·상태 (C4)
│   │   ├── storage_resolver.py  # storage 경로·탐색·채번조회 (C5)
│   │   └── pdf_service.py       # HTML→PDF (C6)
│   └── ...
└── engine/ (기존, 무수정)
```

> `api/` 패키지는 실행 시 `engine/`을 import해야 하므로, `engine/generation`·`engine/rendering` 경로를 `sys.path`에 추가하는 기존 프로젝트 패턴(CLAUDE.md 크로스폴더 import 규칙)을 따른다. PDF는 `.claude/skills/report-pdf/scripts/`를 호출.

---

## C1. API Router Layer (`api/routers/*`, `api/main.py`)
- **목적**: HTTP 엔드포인트 정의. 요청 검증(Pydantic) → 서비스 호출 → 응답 직렬화.
- **책임**:
  - 라우트 선언(리소스 중심 REST, Q2=A): `/api/countries`, `/api/regions`, `/api/jobs` 등
  - country/region **대칭 라우터**(같은 모양의 경로·핸들러)
  - HTML은 `Response(media_type="text/html")`, JSON은 모델 반환, PDF는 `FileResponse`
  - 예외 → HTTP 상태 매핑(404 없음 / 409 데이터없음 / 500 엔진오류)
- **인터페이스**: FastAPI `APIRouter`. 비즈니스 로직 없음(서비스에 위임).
- **하지 않는 것**: 계산·렌더·경로 조립(서비스 책임).

## C2. Engine Adapter (`api/services/engine_adapter.py`)
- **목적**: 기존 엔진 클래스/렌더 함수를 in-process로 호출하는 **얇은 래퍼**(Q1=A in-process import).
- **책임**:
  - country/region generation 엔진 인스턴스화·실행 → 리포트 JSON 경로 반환
  - report renderer 호출 → HTML 경로 반환
  - detail renderer 함수형 `render()` 호출 → HTML 경로 반환
  - 엔진의 CWD 의존성 흡수(절대경로 주입)
- **인터페이스**: 도메인(`country`/`region`)을 인자로 받는 대칭 메서드.
- **하지 않는 것**: 잡 관리·HTTP·경로 채번 결정(resolver/orchestrator 협조).

## C3. Report Orchestrator (`api/services/orchestrator.py`)
- **목적**: 보고서 라인의 generation→rendering을 **일괄 수행**(Q5=A: region 자동호출 비대칭을 여기서 흡수).
- **책임**:
  - `generate_report(domain, id)`: adapter로 JSON 생성 → 같은 흐름으로 HTML 렌더 → 산출물 ID·경로 묶음 반환
  - country/region 동일 시퀀스 보장(외부 대칭)
  - 진행 단계(generation/rendering) 콜백을 Job Manager에 보고
- **인터페이스**: `run_report_pipeline(domain, target_id, progress_cb)`.

## C4. Job Manager (`api/services/job_manager.py`)
- **목적**: 비동기 잡 수명주기 관리(Q3=A in-memory dict + BackgroundTasks).
- **책임**:
  - `job_id` 발급(UUID), 상태 저장(`queued`→`running`→`succeeded`/`failed`)
  - 진행 단계·메시지·결과(산출물 URL)·에러 보관
  - 조회 API에 상태 스냅샷 제공
- **인터페이스**: `create_job()`·`get_job(id)`·`update_*()`. 프로세스 메모리(dict), thread-safe(lock).
- **제약**: 서버 재시작 시 휘발(1차 허용 범위).

## C5. Storage Resolver (`api/services/storage_resolver.py`)
- **목적**: storage 경로·네이밍 규칙(CLAUDE.md)의 **단일 해석 지점**.
- **책임**:
  - STORAGE_BASE 자동탐지(파일 위치 기준 self-locate)
  - 리서치 데이터 존재 여부·국가/권역 목록 스캔
  - 리포트 목록·최신본·다음 채번(NNN) 조회
  - 상세화면 HTML 캐시 경로 탐색(Q6=A)
  - 산출물 → 상대 URL 변환(Q7=A)
- **인터페이스**: 경로/목록/존재 질의 메서드 모음. 파일 I/O 읽기 위주(쓰기는 엔진이 수행).

## C6. PDF Service (`api/services/pdf_service.py`)
- **목적**: 보고서 HTML→PDF 변환(FR-5).
- **책임**:
  - report-pdf 스크립트(`html_to_pdf.py`) 로직 호출(import 또는 subprocess)
  - 출력 규약(`html/` → 형제 `pdf/`) 준수, 기존 PDF 재사용
- **인터페이스**: `ensure_pdf(html_path) -> pdf_path`.

## C7. Schemas (`api/schemas.py`)
- **목적**: 요청/응답·잡 상태의 Pydantic 모델(직렬화 계약).
- **책임**: `CountrySummary`·`RegionSummary`·`ExistenceInfo`·`ReportRef`·`JobCreatedResponse`·`JobStatus`·`ReportListResponse` 등.
- **PBT 관련**: 직렬화 라운드트립(PBT-02) 대상.
