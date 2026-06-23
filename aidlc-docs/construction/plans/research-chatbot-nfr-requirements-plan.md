# NFR Requirements Plan — research-chatbot (2차)

NFR은 **경량**. 1차 결정(Python 3.9·로깅·pytest+Hypothesis·CORS·PBT Partial) 대부분 상속. 신규 결정만 질문. `[Answer]:`를 채운 뒤 "완료".

## 상속(재질문 안 함)
- 런타임 Python 3.9.25(`Optional`/`from __future__`), 로깅 `silkroad.api.*`, pytest+Hypothesis, PBT Partial(02·03·07·08·09), 단일 프로세스·in-memory 잡(1차 JobManager).
- 모델 `anthropic.claude-opus-4-8`, 리전 ap-northeast-2, 구조화출력 느슨+관대검증.
- 테스트: 실 Bedrock 호출 포함(Q8=B).

## 산출물 계획 (Mandatory)
- [ ] `nfr-requirements/nfr-requirements-2.md`
- [ ] `nfr-requirements/tech-stack-decisions-2.md`

---

# 질문

## Question 1
Bedrock 자격증명·리전 구성 방식은?

A) **boto3 표준 체인 + config 기본 리전** — 자격증명은 환경(AWS_*/프로파일/IAM 롤, boto3 자동), 리전은 config.BEDROCK_REGION 기본값 ap-northeast-2(환경변수 override 허용) (권장)

B) **앱 전용 환경변수 강제** — 별도 SILKROAD_AWS_* 변수 요구

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
리서치 호출의 클라이언트 타임아웃은? (Opus 4.8 장문, 비동기 잡 내부)

A) **SDK 기본(10분) + streaming** — 비동기 잡이라 HTTP 클라이언트 대기 무관, SDK 기본 타임아웃·재시도 사용 (권장)

B) **명시적 상향(예: 15분)** — 매우 긴 리서치 대비 타임아웃 늘림

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
anthropic SDK를 requirements.txt에 어떻게?

A) **현재 버전 핀 추가(`anthropic==0.109.2`)** — 1차 `app/backend/requirements.txt`에 추가(버전 핀 일관) (권장)

B) **범위 지정(`anthropic>=0.109`)** — 느슨하게

X) Other (please describe after [Answer]: tag below)

[Answer]: A
