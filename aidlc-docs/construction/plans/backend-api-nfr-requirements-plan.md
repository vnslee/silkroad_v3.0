# NFR Requirements Plan — backend-api (1차)

NFR은 **경량**(Security/Resiliency opt-out). 핵심은 ① 비동기/성능 전제 정리 ② **테스트·tech stack 확정**(PBT-09 프레임워크 포함). 아래 질문에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 NFR 산출물을 생성한다.

## 확인된 설치 버전 (Q7=A 버전 핀 근거)
```
Python 3.9.25
fastapi==0.128.8   uvicorn==0.39.0   pydantic==2.13.4   starlette==0.49.3
jinja2==3.1.6      weasyprint==66.0  boto3==1.42.97     requests==2.32.5
pytest==8.4.2      httpx==0.28.1     anyio==4.12.1      hypothesis: 미설치(설치 예정)
```
> ⚠️ Python 3.9 → `X | None` 신규 유니온 표기는 런타임 평가 시 문제. 코드는 `from __future__ import annotations` 또는 `Optional[X]` 사용.

## 산출물 계획 (Mandatory)
- [ ] `nfr-requirements/nfr-requirements.md` — 성능·확장·가용·신뢰·유지보수·테스트 NFR
- [ ] `nfr-requirements/tech-stack-decisions.md` — 라이브러리·버전 핀·근거 + PBT 프레임워크(PBT-09)

## 사전 결정(기확정, 재질문 안 함)
- 비동기: in-memory dict + BackgroundTasks(Q3). 동시성: threading.Lock.
- CORS: 전체 허용(Q5). 잡 보관: 무기한(FD-Q2).
- PBT: Hypothesis(PBT-09), Partial 모드.

---

# 질문

## Question 1
테스트 러너/구조는?

A) **pytest + Hypothesis** — 설치된 pytest(8.4.2)에 hypothesis 추가, `app/backend/tests/`에 통합(httpx TestClient)·PBT 테스트 (권장)

B) **unittest 표준 라이브러리** — 외부 의존 최소

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
API 통합 테스트 클라이언트는? (FastAPI 권장 방식)

A) **httpx + Starlette TestClient** — `fastapi.testclient.TestClient`(httpx 0.28.1 설치됨), 실서버 없이 in-process 테스트 (권장)

B) **실서버 기동 후 requests** — uvicorn 띄우고 외부 호출

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
서버 실행/기동 방식은? (개발·시연용)

A) **uvicorn 직접 실행** — `uvicorn app.backend.api.main:app --reload`, 포트 8000 (단순, 권장)

B) **`python -m app.backend.api.main`** — main에 `uvicorn.run()` 내장(엔트리 스크립트)

C) **둘 다 지원** — 모듈 실행 + uvicorn CLI 모두 가능하게

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
로깅 수준/방식은?

A) **표준 logging + INFO 기본** — 요청·잡 진행·에러를 stdout 로깅(파이썬 logging) (권장)

B) **print 최소화** — 엔진 기존 print 출력에 의존, API는 최소 로깅

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
성능/타임아웃 목표(보고서 생성은 수 초~수십 초)는?

A) **목표만 명시, 강제 안 함** — 생성은 비동기라 HTTP 타임아웃 무관. 조회는 즉시(<1s 기대) 목표치만 문서화 (1차 적절, 권장)

B) **명시적 타임아웃/SLA 설정** — 엔드포인트별 타임아웃·실패 정책 강제

X) Other (please describe after [Answer]: tag below)

[Answer]: A
