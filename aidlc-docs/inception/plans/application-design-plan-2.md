# Application Design Plan — research-chatbot (2차)

requirements-2 + 1차 설계를 토대로 한 애플리케이션 설계 계획. 아래 질문에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 설계 산출물(`application-design/` 2차분)을 생성한다.

## 확인된 구조
- **country 스키마**: `{country, country_ko, code, region, is_baseline, currency, schema_version, data_year, fetched_at, overall_insight, items[]}` (items=role별 객체 배열)
- **region 샘플(잠정)**: `{region, region_ko, code, schema_version, fetched_at, baseline_country, countries[]}` — `countries[]` 각 원소 ≈ country 구조(중첩)
- **1차 재사용**: JobManager(dict+Lock, step/percent)·Orchestrator 패턴(progress_cb)·StorageResolver(경로·존재·to_url)·schemas·config(self-locate·로깅)
- **Bedrock**: `AnthropicBedrockMantle(aws_region="ap-northeast-2")`, 모델 `anthropic.claude-opus-4-8`, 구조화출력 `output_config.format`

## 식별된 컴포넌트 (초안)
1. **BedrockClient** (`api/services/bedrock_client.py`) — Mantle 클라이언트 생성·messages.create 래퍼·구조화출력 헬퍼
2. **ResearchAgent** (`api/services/research_agent.py`) — country/region 프롬프트 조립 → Bedrock 호출 → 스키마 검증 → storage 저장(<ID>_<TS>.json + latest 포인터)
3. **ChatbotService** (`api/services/chatbot.py`) — §6.5 분기(데이터 유무 판정·LLM 답변·리서치 트리거 제안)
4. **라우터**: `routers/research.py`(비동기 트리거+잡), `routers/chat.py`(동기)
5. **프롬프트 로더** — `architecture/research/*_prompt.md`·스키마 로드/치환
6. **Schemas 확장** — 리서치 트리거 요청/응답·챗봇 요청/응답

## 산출물 계획 (Mandatory)
- [ ] `application-design/components-2.md`
- [ ] `application-design/component-methods-2.md`
- [ ] `application-design/services-2.md`
- [ ] `application-design/component-dependency-2.md`
- [ ] `application-design/application-design-2.md`(통합)

---

# 설계 질문

## Question 1
리서치 잡 오케스트레이션은 1차를 어떻게 재사용할까?

A) **JobManager 그대로 재사용 + 신규 research orchestrator 함수** — 1차 JobManager(dict/lock/step·percent)를 공유하고, 리서치용 run 함수만 추가(kind="research"). step 매핑은 리서치에 맞게(queued/calling_bedrock/saving/done) (권장)

B) **별도 리서치 잡 매니저 신설** — 리서치 전용 상태 관리 분리

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
country/region 리서치 코드 구조는?

A) **단일 ResearchAgent + 도메인 분기** — 한 모듈에서 domain 인자로 country/region 분기(프롬프트·스키마만 다름), 1차 대칭 패턴과 일관 (권장)

B) **country/region 별도 클래스** — 각각 독립 모듈

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
프롬프트·스키마 소스 로딩 방식은?

A) **파일에서 로드** — `architecture/research/{country,region}_research_prompt.md`·`_schema.md`를 런타임에 읽어 치환(단일 출처, 명세=실행) (권장)

B) **코드에 임베드** — 프롬프트/스키마를 Python 상수로 복제(파일 의존 없음, 중복 위험)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
구조화 출력 JSON 스키마는 어디서 가져올까? (output_config.format에 넣을 json_schema)

A) **`_schema.md`에서 도출/관리** — 명세 스키마를 JSON Schema로 표현해 구조화출력에 사용(명세와 일치 보장). region은 잠정 스키마 (권장)

B) **별도 JSON Schema 파일** — `*.schema.json` 파일을 코드 옆에 두고 관리

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
챗봇 대화 상태(멀티턴) 관리는?

A) **무상태(stateless)** — 매 요청에 필요한 컨텍스트(대상 코드·이전 메시지)를 클라이언트가 전달, 서버는 보관 안 함 (1차 무저장 원칙과 일관, 단순, 권장)

B) **서버 세션 보관** — 대화 이력을 서버 메모리에 보관

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
챗봇이 LLM 답변 생성 시 컨텍스트로 넣을 데이터 범위는?

A) **해당 리서치 JSON 요약/핵심 + internal 규칙 일부** — 토큰 절약 위해 overall_insight·핵심 items 위주로 컨텍스트 구성 (권장)

B) **리서치 JSON 전체** — 전부 컨텍스트로(토큰 많음, 단순)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
region 명세(`region_research_*.md`) 작성을 이 2차 작업의 어느 단계에서?

A) **Code Generation 단계에서 문서 생성** — 설계는 지금 확정, 실제 .md 파일은 코드 생성 때 함께 (권장)

B) **지금(설계 단계) 즉시 작성**

X) Other (please describe after [Answer]: tag below)

[Answer]: A
