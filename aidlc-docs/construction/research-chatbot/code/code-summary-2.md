# Code Summary — research-chatbot (2차)

Code Generation Part 2 산출물 요약. 1차 backend-api 무파괴 확장 + 신규 서비스/라우터/명세/테스트.

## 1차 확장 (추가만, 기존 시그니처 유지 — BR-COMPAT)
- **`api/config.py`**: `BEDROCK_REGION`(기본 ap-northeast-2)·`BEDROCK_MODEL`(`anthropic.claude-opus-4-8`)·`RESEARCH_MAX_TOKENS`(16000)·`RESEARCH_SPEC_DIR`(architecture/research). env override 지원.
- **`api/schemas.py`**: `JobStep`에 `calling_bedrock`/`saving` 추가(기존 step 불변). `ResearchJobResult`·`ResearchTriggerRequest`·`ChatTurn`·`ChatRequest`·`ChatResponse` 신설. `JobStatus.result`를 `Union[JobResult, ResearchJobResult]`로 확장.
- **`api/services/job_manager.py`**: `_STEP_PERCENT`에 `calling_bedrock:40`·`saving:80` 추가. `succeed`/`_set` result 타입을 Union으로 확장.
- **`api/services/storage_resolver.py`**: `save_research(domain, target_id, data) -> (path, latest_path)` 추가. `<id>_<ts>.json` 작성 + `<id>_latest.json` 포인터 갱신(L4, CLAUDE.md 경로 규칙). ts는 fetched_at(콜론압축) 우선.

## 신규 서비스 (`api/services/`)
- **`bedrock_client.py`** (C8, L2): `get_client()`(lazy `AnthropicBedrockMantle` 싱글톤)·`generate_structured()`(streaming + `output_config.format` json_schema → 첫 text 블록 JSON 파싱)·`generate_text()`(챗봇용). 자격증명 boto3 체인(SigV4, 별도 API Key 불필요). 앱 재시도 없음(Q5=A). 예외는 `BedrockError`.
- **`prompt_loader.py`** (C9, L1): `load_country/region_prompt`(명세 코드펜스 추출 + 플레이스홀더 치환)·`country/region_json_schema`(느슨, Q1=A)·검증 모델 `CountryResearch`/`RegionResearch`/`ResearchItem`(관대, `extra:allow`). region은 잠정.
- **`research_agent.py`** (C10, L3·L5): `run(domain, target_id, segment, member_codes, region, progress_cb)`. country=직접, region=누락 멤버 국가 선행(Q6=A) 후 권역. L3 검증(필수키·items≥1만 실패) → `save_research`. 예외 `ResearchError`.
- **`research_orchestrator.py`** (C11, L6): `run_research_job(...)`. 1차 JobManager 재사용, 상태 queued→calling_bedrock(40)→saving(80)→done(100). `ResearchJobResult`로 succeed.
- **`chatbot.py`** (C12, L7·L8): `handle(...)` §6.5 분기(보유→LLM 답변 / 없음·부분→needs_research 신호만, 직접 트리거 안 함). `_summarize`(overall_insight + score/gate 핵심 N개). 무상태(Q5=A).

## 신규 라우터 (`api/routers/`)
- **`research.py`** (C13): `POST /api/countries/{code}/research`·`POST /api/regions/{region}/research` (비동기 잡, 202 + status_url). region은 member_codes VR-3 검증.
- **`chat.py`** (C14): `POST /api/chat` (동기). message 빈값·target_id 형식 422, BedrockError 502, 데이터 없음 200+needs_research.
- **`main.py`**: research·chat 라우터 등록(총 라우트 25개).

## 명세 (`architecture/research/`)
- **`region_research_prompt.md`**·**`region_research_schema.md`**: 잠정 v0.1(EU 샘플 기반, country 중첩). "추후 country 대칭 풀세트 확장 예정" 코멘트 명시(BR-RGN-1).

## 의존성
- **`app/backend/requirements.txt`**: `anthropic==0.109.2` 추가(Q3).

## 테스트 (`app/backend/tests/`)
- **`strategies.py`**: `member_codes`·`chat_roles` 생성기 추가(PBT-07).
- **`test_schemas_pbt_2.py`** (PBT-02): Chat*·ResearchTrigger 라운드트립 4종.
- **`test_prompt_loader_pbt.py`** (PBT-03): 치환 후 플레이스홀더 잔존 없음 + 스키마 형태.
- **`test_research_save_pbt.py`** (PBT-03): save_research 경로 규칙·round-trip(tmp 격리, monkeypatch RESEARCH_DIR).
- **`test_chatbot_integration.py`**: 챗봇 없음/부분 분기(Bedrock 미호출 단언)·422 2종.
- **`test_research_bedrock_smoke.py`** (Q8): 실 Bedrock country(PT) end-to-end, `@pytest.mark.bedrock`(기본 제외), tmp 격리.
- **`pytest.ini`**: `bedrock` 마커 등록 + `addopts=-m "not bedrock"`(기본 수집 제외).

## 게이트 결과
- `py_compile`: 신규/수정 .py 전부 통과.
- `pytest`(non-bedrock): **45 passed, 1 deselected**(1차 32 + 신규 13).
- 실 Bedrock 스모크: **1 passed**(PT 단일국 end-to-end, 약 3분). `pytest -m bedrock`.

## 환경 보정 (Build & Test 중 발견 — config로 흡수)
- **Mantle 엔드포인트 DNS 미해석** → `config.BEDROCK_BACKEND="legacy"`(AnthropicBedrock, bedrock-runtime). env override로 mantle 전환 가능.
- **모델 ID**: on-demand `anthropic.claude-opus-4-8`는 inference profile 필요 → 기본값 `global.anthropic.claude-opus-4-8`.
- **구조화 출력**: legacy 백엔드는 `output_config.format` 400 → `generate_structured`가 프롬프트 JSON 계약 + 코드펜스 제거 파싱으로 폴백. mantle 백엔드는 종전대로 구조화 출력 사용.

## 미해결/후속
- region 명세·스키마·검증 모델은 **잠정** — 엔진 권역 산식 요구 필드로 확장 필요.
- mantle 엔드포인트가 가용한 환경에서는 `BEDROCK_BACKEND=mantle`로 구조화 출력 강제 권장(스키마 보장).
