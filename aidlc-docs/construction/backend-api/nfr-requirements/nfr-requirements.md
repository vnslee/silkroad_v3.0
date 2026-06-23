# NFR Requirements — backend-api (1차)

NFR은 **경량**(Security/Resiliency opt-out). 아래는 1차에서 적용·문서화할 비기능 요구사항.

## 성능 (Performance) — Q5=A 목표만 명시
| 항목 | 목표(비강제) |
|---|---|
| 조회 API(목록·존재·산출물 read) | < 1s (로컬 파일 I/O 수준) |
| 상세화면 캐시 hit | < 1s |
| 상세화면 캐시 miss(렌더) | 엔진 렌더 시간 의존(수 초) |
| 보고서 생성(잡) | 비동기 — HTTP 타임아웃 무관. generation+rendering 수 초~수십 초 |
| PDF 변환 | weasyprint 의존(수 초) |
> 보고서 생성은 BackgroundTasks라 클라이언트는 즉시 202. 진행은 폴링.

## 확장성 (Scalability)
- 1차는 **단일 프로세스/단일 인스턴스** 전제. 잡은 in-memory(프로세스 로컬).
- 멀티 인스턴스/수평 확장은 범위 밖(4차 배포에서 단일 컨테이너로 시연). 잡 상태 공유 저장소 도입은 후속.

## 가용성 (Availability)
- 개발/시연 수준. HA·페일오버 요구 없음(Resiliency opt-out).
- 서버 재시작 시 in-memory 잡 상태 휘발 허용(FD-Q2=A). 산출물(파일)은 디스크 영속이라 재조회 가능.

## 신뢰성 (Reliability)
- 엔진 예외는 잡 status=failed로 캡처(프로세스 비중단). 동기 경로 예외는 500.
- 동시성: Job Manager dict는 `threading.Lock` 보호.
- 에러 매핑은 `business-rules.md` 표 준수(409/404/422/500, exists=200).

## 보안 (Security) — opt-out
- 인증/인가 없음(1차). CORS 전체 허용(개발용, 배포 시 조정 — Q5 Application Design).
- 무저장 원칙(이메일 등 PII 수집 안 함 — mailto는 3차 클라이언트 위임).

## 유지보수성 (Maintainability)
- 라우터/서비스/스키마 모듈 분리(Application Design Q1=A).
- 로깅: 표준 `logging`, INFO 기본(요청·잡 진행·에러 stdout) — Q4=A.
- 구문 게이트: 신규 `.py`는 `python3 -m py_compile` 통과(CLAUDE.md).
- 기존 엔진 무수정(NFR-4).

## 테스트 (Testability) — PBT Partial
- 러너: **pytest + Hypothesis**(Q1=A), `app/backend/tests/`.
- API 통합: **FastAPI TestClient**(httpx, in-process) — Q2=A.
- PBT 강제: PBT-02(스키마 라운드트립)·PBT-03(to_url·report_id 불변식)·PBT-07(도메인 생성기)·PBT-08(seed 로깅·shrinking 유지)·PBT-09(Hypothesis).
- 예제 기반 테스트(통합): 핵심 엔드포인트 happy-path + 에러(409/404/422) — PBT-10(advisory).

## 사용성 (Usability)
- 1차는 UI 없음. OpenAPI 자동 문서(`/docs`)로 프론트(3차) 계약 가시화.
- 응답은 상대 URL 노출(Q7=A)로 프론트 iframe 조립 용이.

## Python 호환
- **Python 3.9.25** — 타입 힌트는 `from __future__ import annotations` 또는 `typing.Optional/Literal` 사용(`X | None` 런타임 평가 회피).
