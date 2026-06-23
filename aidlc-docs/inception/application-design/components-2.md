# Components — research-chatbot (2차)

설계 결정(Q1~Q7 전부 권장안 A) 반영. 신규 코드는 1차 `app/backend/api/` 패키지에 모듈 추가. 1차 컴포넌트(JobManager·StorageResolver·config·schemas) 재사용, 기존 엔진 무수정.

## 디렉토리 (1차 위에 추가)
```
app/backend/api/
├── config.py            # (1차) + Bedrock 상수 추가(모델·리전)
├── schemas.py           # (1차) + 리서치/챗봇 모델 추가 + JobStep enum 확장
├── services/
│   ├── bedrock_client.py     # C8 신규 — Mantle 클라이언트·구조화출력 래퍼
│   ├── prompt_loader.py      # C9 신규 — 프롬프트/스키마 파일 로드·치환
│   ├── research_agent.py     # C10 신규 — country/region 리서치(도메인 분기)
│   ├── research_orchestrator.py  # C11 신규 — 리서치 잡 실행(JobManager 재사용)
│   ├── chatbot.py            # C12 신규 — §6.5 분기 + LLM 답변
│   ├── job_manager.py        # (1차 재사용, step enum 확장)
│   └── storage_resolver.py   # (1차 재사용 + research 저장 헬퍼 추가)
└── routers/
    ├── research.py           # C13 신규 — 비동기 리서치 트리거 + 잡
    └── chat.py               # C14 신규 — 동기 챗봇
```

## C8. BedrockClient (`bedrock_client.py`)
- **목적**: `AnthropicBedrockMantle(aws_region="ap-northeast-2")` 생성·관리, 구조화 출력 호출 래퍼.
- **책임**:
  - 클라이언트 lazy 싱글톤(자격증명은 boto3 체인)
  - `generate_structured(prompt, json_schema, *, system=None) -> dict` — `messages.create(model=BEDROCK_MODEL, output_config={"format":{"type":"json_schema","schema":...}})` 호출 → 검증된 dict 반환
  - `generate_text(prompt, *, system=None, context=None) -> str` — 챗봇 자유 답변용
- **인터페이스**: Bedrock에만 의존(유일점). 모델 ID·리전은 config.
- **하지 않는 것**: 프롬프트 조립·저장(다른 컴포넌트).

## C9. PromptLoader (`prompt_loader.py`)
- **목적**: `architecture/research/{country,region}_research_prompt.md`·`_schema.md` 로드·치환(Q3·Q4=A).
- **책임**:
  - 프롬프트 본문 추출 + `{COUNTRY}`·`{REGION}`·`{SEGMENT}` 치환
  - `_schema.md`에서 JSON Schema 도출(구조화출력용). region은 잠정 스키마.
  - 파일 self-locate(`architecture/research/` 경로)
- **인터페이스**: `load_country_prompt(...)`·`load_region_prompt(...)`·`country_json_schema()`·`region_json_schema()`.

## C10. ResearchAgent (`research_agent.py`)
- **목적**: country/region 리서치 수행(Q2=A 단일+분기).
- **책임**:
  - `run(domain, target_id, *, segment=None, member_codes=None, progress_cb=None) -> ResearchResult`
  - PromptLoader로 프롬프트·스키마 준비 → BedrockClient.generate_structured 호출 → StorageResolver로 `<ID>_<TS>.json` + `<ID>_latest.json` 저장
  - region: `member_codes`(국가 배열) 중 데이터 없는 국가는 country 리서치 선행(FR-1.2)
- **인터페이스**: 도메인 인자 대칭. 저장 경로는 StorageResolver 위임.

## C11. ResearchOrchestrator (`research_orchestrator.py`)
- **목적**: 리서치를 비동기 잡으로 실행(Q1=A, 1차 JobManager 재사용).
- **책임**:
  - `run_research_job(job_id, domain, target_id, segment, member_codes)` — JobManager.start → progress(calling_bedrock/saving) → ResearchAgent.run → succeed(result)
  - step→percent 매핑 확장 사용(아래 schemas)
- **인터페이스**: 1차 orchestrator와 동일 패턴(progress_cb=job_manager.set_progress).

## C12. ChatbotService (`chatbot.py`)
- **목적**: §6.5 챗봇 분기 + LLM 답변(Q5=A 무상태, Q6=A 요약 컨텍스트).
- **책임**:
  - `handle(domain, target_id, message, history=None, member_codes=None) -> ChatResponse`
  - StorageResolver로 데이터 존재 판정 → 있으면 BedrockClient.generate_text(컨텍스트=요약) 답변 / 없으면 "리서치 진행?" 분기 응답
  - 권역 부분 데이터·국가 리스트 분기(§6.5.2)
- **인터페이스**: 무상태(history는 요청으로 전달). 리서치 트리거는 직접 안 하고 분기 신호만 반환(프론트가 research API 호출).

## C13. Research Router (`routers/research.py`)
- **목적**: `POST /api/research/{domain}/{id}`(비동기 트리거)·잡 결과는 1차 `/api/jobs/{id}` 폴링 재사용.
- **책임**: 요청 검증 → JobManager.create_job(kind="research") → BackgroundTasks(run_research_job) → 202 JobCreatedResponse. region은 member_codes 바디 수용.

## C14. Chat Router (`routers/chat.py`)
- **목적**: `POST /api/chat`(동기).
- **책임**: 요청 검증 → ChatbotService.handle → ChatResponse 반환.

## 1차 변경(확장) 컴포넌트
- **config.py**: `BEDROCK_REGION="ap-northeast-2"`, `BEDROCK_MODEL="anthropic.claude-opus-4-8"`, `RESEARCH_SPEC_DIR` 추가.
- **schemas.py**: `JobStep`에 `"calling_bedrock"`·`"saving"` 추가(리서치 step). 리서치/챗봇 요청·응답 모델 추가.
- **storage_resolver.py**: 리서치 저장 헬퍼(`save_research(domain,id,data) -> path` + latest 포인터) 추가.
