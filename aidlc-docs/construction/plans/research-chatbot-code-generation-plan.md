# Code Generation Plan — research-chatbot (2차)

Code Generation의 **단일 출처(SoT)**. Part 2에서 단계 순서대로 실행, 각 단계 완료 시 `[x]`.

## 컨텍스트
- **Brownfield. Workspace Root**: `/home/participant/silk-road_v1.0`
- **Unit**: research-chatbot. 1차 backend-api(JobManager·StorageResolver·config·schemas·main) **확장**, 기존 엔진·1차 무파괴.
- **신규 코드**: `app/backend/api/services/`(4) + `routers/`(2) + region 명세 2종(`architecture/research/`) + 테스트
- **의존**: 1차 backend-api(완료). 외부: AnthropicBedrockMantle.

## 설계 입력
- Application Design 2차: `inception/application-design/*-2.md` (C8~C14 + 1차확장)
- Functional Design 2차: `construction/research-chatbot/functional-design/*-2.md` (엔티티·L1~L8·규칙·PBT)
- NFR 2차: `construction/research-chatbot/nfr-requirements/*-2.md` (Bedrock config·검증·핀)

## 산출물 구조
```
app/backend/api/
├── config.py            # [확장] BEDROCK_REGION/MODEL·RESEARCH_SPEC_DIR·RESEARCH_MAX_TOKENS
├── schemas.py           # [확장] JobStep+calling_bedrock/saving, ResearchJobResult, Chat*·ResearchTriggerRequest
├── services/
│   ├── job_manager.py        # [확장] _STEP_PERCENT += calling_bedrock/saving
│   ├── storage_resolver.py   # [확장] save_research()
│   ├── bedrock_client.py     # [신규] C8
│   ├── prompt_loader.py      # [신규] C9
│   ├── research_agent.py     # [신규] C10
│   ├── research_orchestrator.py  # [신규] C11
│   └── chatbot.py            # [신규] C12
├── routers/
│   ├── research.py           # [신규] C13
│   └── chat.py               # [신규] C14
└── main.py              # [확장] research·chat 라우터 등록
architecture/research/
├── region_research_prompt.md # [신규] 잠정 + 확장 코멘트
└── region_research_schema.md # [신규] 잠정 + 확장 코멘트
app/backend/tests/
├── strategies.py        # [확장] domain/member_codes 생성기
├── test_schemas_pbt_2.py     # [신규] Chat*·ResearchTrigger 라운드트립(PBT-02)
├── test_prompt_loader_pbt.py # [신규] 치환 불변식(PBT-03)
├── test_research_save_pbt.py # [신규] save_research 경로 불변식(PBT-03)
├── test_chatbot_integration.py   # [신규] 챗봇 분기(데이터없음=Bedrock 미호출)
└── test_research_bedrock_smoke.py # [신규] 실 Bedrock country 리서치 스모크(Q8, @pytest.mark.bedrock)
app/backend/requirements.txt  # [확장] anthropic==0.109.2
```

---

## 실행 단계 (번호화)
- [x] **Step 1 — config.py 확장**: BEDROCK_REGION/MODEL·RESEARCH_SPEC_DIR·RESEARCH_MAX_TOKENS + 로거 네임스페이스. (NFR)
- [x] **Step 2 — schemas.py 확장**: JobStep에 calling_bedrock/saving 추가, ResearchJobResult(domain·target_id·latest_url·schema_version), ChatTurn·ChatRequest·ChatResponse·ResearchTriggerRequest. (FR-3·4)
- [x] **Step 3 — job_manager.py 확장**: `_STEP_PERCENT += {calling_bedrock:40, saving:80}`. (후방호환)
- [x] **Step 4 — storage_resolver.py 확장**: `save_research(domain, target_id, data) -> (path, latest_path)` + 검증 모델 import. (FR-1.3, L4)
- [x] **Step 5 — services/bedrock_client.py**: get_client(lazy Mantle)·generate_structured(streaming·output_config.format)·generate_text. (C8, L2)
- [x] **Step 6 — services/prompt_loader.py**: load_country/region_prompt·country/region_json_schema(느슨)·검증 pydantic 모델(CountryResearch·RegionResearch·ResearchItem). (C9, L1, 검증)
- [x] **Step 7 — services/research_agent.py**: run(domain, ...) country/region(누락국가 선행) → 검증 → save_research. (C10, L3·L5)
- [x] **Step 8 — services/research_orchestrator.py**: run_research_job(JobManager 재사용·progress). (C11, L6)
- [x] **Step 9 — services/chatbot.py**: handle(§6.5 분기)·_summarize. (C12, L7·L8)
- [x] **Step 10 — routers/research.py**: POST /api/research/{countries,regions}/{id}(비동기 잡). (C13, FR-4.1)
- [x] **Step 11 — routers/chat.py**: POST /api/chat(동기). (C14, FR-4.2)
- [x] **Step 12 — main.py 확장**: research·chat 라우터 등록. (통합)
- [x] **Step 13 — region 명세**: region_research_prompt.md·region_research_schema.md(EU 샘플 기반 잠정 + "추후 country 대칭 확장 예정" 코멘트). (FR-2)
- [x] **Step 14 — requirements.txt 확장**: `anthropic==0.109.2` 추가. (NFR, Q3)
- [x] **Step 15 — tests/strategies.py 확장**: member_codes 생성기 등. (PBT-07)
- [x] **Step 16 — test_schemas_pbt_2.py**: Chat*·ResearchTrigger 라운드트립. (PBT-02)
- [x] **Step 17 — test_prompt_loader_pbt.py**: 치환 후 플레이스홀더 잔존 없음 불변식. (PBT-03)
- [x] **Step 18 — test_research_save_pbt.py**: save_research 경로 규칙 불변식(tmp 격리). (PBT-03)
- [x] **Step 19 — test_chatbot_integration.py**: 챗봇 분기(데이터 없음=needs_research, Bedrock 미호출)·422. (예제)
- [x] **Step 20 — test_research_bedrock_smoke.py**: 실 Bedrock country 리서치 1회 end-to-end(@pytest.mark.bedrock), 생성물 정리. (Q8)
- [x] **Step 21 — py_compile 게이트**: 신규/수정 .py 전체.
- [x] **Step 22 — 코드 요약 문서**: `construction/research-chatbot/code/code-summary-2.md`.

> 빌드/테스트 **실행**은 Build & Test 단계(실 Bedrock 스모크 포함).

## FR 추적성
| FR | Step |
|---|---|
| FR-1 리서치 Agent | 5,6,7,8 |
| FR-2 region 명세 | 13 |
| FR-3 챗봇 | 2,9,11 |
| FR-4 API 확장 | 2,10,11,12 |
| PBT(02·03·07·08·09) | 14,15,16,17,18 |
| Q8 실 Bedrock | 20 |

## 총 22단계. 신규 ~12파일 + 1차 4파일 확장 + region 명세 2 + requirements. 기존 엔진·1차 핵심 무파괴.
