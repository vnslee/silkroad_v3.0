# NFR Requirements — research-chatbot (2차)

경량. 1차 결정 대부분 상속, 2차 신규만 명시.

## 성능
| 항목 | 목표(비강제) |
|---|---|
| 챗봇 동기 응답(데이터 보유, LLM 답변) | Bedrock 텍스트 생성 지연 의존(수 초) |
| 챗봇 분기(데이터 없음) | <1s (파일 존재 판정만) |
| 리서치(비동기 잡) | HTTP 즉시 202, 실제 생성 수십 초~분(Opus 4.8 장문). 폴링 |
| region 리서치(누락 국가 선행) | member 수 × country 리서치 + 권역 1회(선형) |

## 가용성·신뢰성
- 단일 프로세스, in-memory 잡(1차 상속, 재시작 시 휘발).
- Bedrock 호출 실패 → 잡 failed 캡처(프로세스 비중단). 앱 재시도 없음(Q5=A), SDK 기본 재시도(429/5xx 2회)만.
- 타임아웃: SDK 기본(10분) + streaming(Q2=A). 비동기라 HTTP 대기 무관.

## 보안
- 자격증명: **boto3 표준 체인**(AWS_*/프로파일/IAM 롤) — 앱이 키 보관 안 함(Q1=A). 리전 config 기본 ap-northeast-2(env override).
- 무저장 원칙 유지(챗봇 무상태, history는 요청 전달).
- CORS·인증: 1차 상속(개발용).

## 유지보수성
- 신규 모듈은 1차 `api/services`·`api/routers` 패턴 따름. 1차 컴포넌트 확장만(무파괴).
- region 명세·코드에 "잠정 — country 대칭 확장 예정" 코멘트(BR-RGN-1).
- 로깅: `silkroad.api.research`·`silkroad.api.chatbot`·`silkroad.api.bedrock`.
- py_compile 게이트.

## 테스트 (PBT Partial + 실 Bedrock)
- PBT: 스키마 라운드트립(02)·프롬프트치환/저장경로 불변식(03)·생성기(07)·seed(08)·Hypothesis(09).
- **실 Bedrock 통합 스모크**(Q8=B) — country 리서치 1회 end-to-end(네트워크·자격증명 의존). 비용 이슈 없음 확인됨.
- 챗봇 분기(데이터 없음)는 Bedrock 미호출 — 순수 로직 테스트 가능.

## Python 호환
- 3.9.25 — `Optional`/`Literal`/`from __future__ import annotations`.
