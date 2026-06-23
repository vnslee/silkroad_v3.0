# Tech Stack Decisions — backend-api (1차)

## 런타임
- **Python 3.9.25** (기존 환경). 타입힌트: `from __future__ import annotations` + `typing` (3.9 호환).

## 핵심 의존성 (Q7=A 버전 핀 — 현재 설치본 고정)

| 패키지 | 버전 | 용도 | 근거 |
|---|---|---|---|
| fastapi | 0.128.8 | API 프레임워크 | 설치본, OpenAPI 자동문서 |
| uvicorn | 0.39.0 | ASGI 서버 | Q3=A `uvicorn ... main:app` |
| pydantic | 2.13.4 | 스키마/검증 | 모델·직렬화(PBT-02 대상) |
| starlette | 0.49.3 | (fastapi 의존) | TestClient·Response 기반 |
| jinja2 | 3.1.6 | 엔진 렌더 의존 | 기존 엔진 사용(detail 템플릿) |
| weasyprint | 66.0 | HTML→PDF | FR-5, report-pdf 연계 |
| boto3 | 1.42.97 | (2차 Bedrock 대비) | 기설치 핀 — 1차 미사용이나 고정 |
| botocore | 1.42.97 | boto3 의존 | |
| requests | 2.32.5 | (2차 대비) | 기설치 핀 |

## 테스트 의존성

| 패키지 | 버전 | 용도 | 근거 |
|---|---|---|---|
| pytest | 8.4.2 | 테스트 러너 | Q1=A, 설치본 |
| hypothesis | 6.141.1 | **PBT 프레임워크** | **PBT-09 강제** — 신규 설치, custom 생성기·shrinking·seed 지원 |
| httpx | 0.28.1 | TestClient HTTP | Q2=A, 설치본 |
| anyio | 4.12.1 | (starlette/httpx 의존) | |

## requirements.txt 구성 방침 (FR-6)
- 위 버전을 `==`로 핀.
- `requirements.txt`(런타임) + 테스트는 같은 파일에 포함하거나 `requirements-dev.txt` 분리 — **단일 `requirements.txt`에 통합**(1차 단순, pytest/hypothesis/httpx 포함).
- 위치: `app/backend/requirements.txt` (백엔드 스코프 명확) 또는 루트. → **`app/backend/requirements.txt`**.

## PBT 프레임워크 결정 (PBT-09)
- **Hypothesis 6.141.1** 선정. 검증 기준 충족:
  - ✅ custom 생성기(`@composite`, `strategies`) — 도메인 타입(domain/target_id/report_id) 생성기(PBT-07)
  - ✅ 자동 shrinking — 기본 활성(PBT-08, 비활성 금지)
  - ✅ seed 재현성 — 실패 시 `@reproduce_failure`/seed 출력(PBT-08)
  - ✅ pytest 통합 — `@given` 데코레이터
- requirements.txt 포함(PBT-09 의존성 요구 충족).

## 서버 실행 (Q3=A)
```bash
# 개발/시연
uvicorn app.backend.api.main:app --reload --port 8000
# (app/backend/api/main.py 의 `app = FastAPI(...)`)
```

## 로깅 (Q4=A)
- 표준 `logging`, 루트 INFO. 포맷: `%(asctime)s %(levelname)s %(name)s %(message)s`.
- 로거 네임스페이스: `silkroad.api.*`. 요청 수신·잡 전이(start/progress/succeed/fail)·예외 로깅.

## 미채택 / 범위 밖
- Celery·Redis 등 외부 잡 큐(오버엔지니어링 — Q3에서 제외).
- 인증/DB/ORM(1차 무상태·파일 기반).
- 멀티 인스턴스 잡 공유 저장소(후속).
