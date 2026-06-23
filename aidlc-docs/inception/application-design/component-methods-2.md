# Component Methods — research-chatbot (2차)

도메인 = `Literal["country","region"]`.

## C8. BedrockClient
```python
def get_client() -> AnthropicBedrockMantle          # lazy 싱글톤(aws_region=config.BEDROCK_REGION)
def generate_structured(prompt, json_schema, *, system=None) -> dict
    # messages.create(model=config.BEDROCK_MODEL, max_tokens=..., 
    #   output_config={"format":{"type":"json_schema","schema":json_schema}}, ...)
    # → 첫 text 블록 JSON 파싱 후 반환 (구조화출력이 스키마 보장)
def generate_text(prompt, *, system=None) -> str     # 챗봇 자유 답변(구조화 없음)
```

## C9. PromptLoader
```python
def load_country_prompt(country_name, region, segment=None) -> str  # {COUNTRY}/{REGION}/{SEGMENT} 치환
def load_region_prompt(region_name, member_codes) -> str            # region 잠정 프롬프트
def country_json_schema() -> dict                                   # _schema.md → JSON Schema
def region_json_schema() -> dict                                    # region 잠정 스키마
# 경로: config.RESEARCH_SPEC_DIR (architecture/research) self-locate
```

## C10. ResearchAgent
```python
def run(domain, target_id, *, segment=None, member_codes=None, progress_cb=None) -> ResearchResult
    # country: load_country_prompt → generate_structured(country_json_schema) → save_research
    # region: 각 member_code 데이터 없으면 country run 선행 → load_region_prompt → generate_structured(region_json_schema) → save_research
    # progress_cb(step) 호출(calling_bedrock/saving)
    # → ResearchResult(domain, target_id, path, latest_path, schema_version)
```

## C11. ResearchOrchestrator
```python
def run_research_job(job_id, domain, target_id, segment=None, member_codes=None) -> None
    # job_manager.start(job_id)
    # progress_cb = lambda step,msg=None: job_manager.set_progress(job_id, step, msg)
    # try: ResearchAgent.run(...) → job_manager.succeed(job_id, JobResult-like)
    # except: job_manager.fail(job_id, str(e))
```

## C12. ChatbotService
```python
def handle(domain, target_id, message, *, history=None, member_codes=None) -> ChatResponse
    # exists = storage_resolver.research_exists(domain, target_id)
    # region: member_codes 중 누락 국가 판정(부분 데이터 분기, §6.5.2)
    # if exists(전체): ctx = _summarize(research json) → generate_text(message+ctx) → answer
    # else: needs_research=True, 분기 메시지(+ 권역이면 국가 리스트 요청 여부)
    # → ChatResponse(answer, needs_research, research_suggestion, missing_codes)

def _summarize(research_data) -> str   # overall_insight + 핵심 items (Q6=A 토큰 절약)
```

## C13/C14. Routers ↔ 핸들러
| Method · Path | 핸들러 | 응답 |
|---|---|---|
| `POST /api/research/countries/{code}` | create_job(research) + BG(run_research_job, country) | 202 JobCreatedResponse |
| `POST /api/research/regions/{region}` | body: `{member_codes:[...]}` → create_job + BG(run_research_job, region) | 202 JobCreatedResponse |
| `GET /api/jobs/{job_id}` | (1차 재사용) | JobStatus |
| `POST /api/chat` | body: `{domain,target_id,message,history?,member_codes?}` → ChatbotService.handle | ChatResponse |

## schemas.py 확장
```python
JobStep = Literal["queued","generating","rendering","calling_bedrock","saving","done"]  # 리서치 step 추가
_STEP_PERCENT += {"calling_bedrock":40, "saving":80}  # (job_manager 매핑)

class ResearchTriggerRequest(BaseModel):   # region용
    member_codes: List[str] = Field(default_factory=list)
    segment: Optional[str] = None

class ChatRequest(BaseModel):
    domain: Domain
    target_id: str
    message: str
    history: Optional[List[ChatTurn]] = None
    member_codes: Optional[List[str]] = None

class ChatTurn(BaseModel):
    role: Literal["user","assistant"]
    content: str

class ChatResponse(BaseModel):
    answer: Optional[str] = None
    needs_research: bool = False
    research_suggestion: Optional[str] = None
    missing_codes: List[str] = Field(default_factory=list)
```
