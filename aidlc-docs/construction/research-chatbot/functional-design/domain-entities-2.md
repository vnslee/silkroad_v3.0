# Domain Entities & Schemas — research-chatbot (2차)

Pydantic 모델·구조화출력 JSON Schema 전략. 도메인 = `Literal["country","region"]`.

## 1. 구조화 출력 JSON Schema (느슨, Q1=A)
`output_config.format`에 넣는 json_schema는 **최상위 구조 + item 필수 키만** 강제. 세부·조건부는 프롬프트 지시.

### country 구조화 스키마 (느슨)
```
object(additionalProperties:false 미강제 — 세부 자유) {
  country: str, country_ko: str, code: str, region: str,
  is_baseline: bool, currency: str, schema_version: str,
  data_year: (str|int), fetched_at: str, overall_insight: str,
  items: array of object {            # item 필수 키만
     item: str, category: str, role: str, region: str,
     tier: int, source: str, insight: str
     # value/unit/direction/timeseries/score_dimensions 등은 프롬프트로 지시(스키마 미강제)
  }
}
```
> claude-api 제약(numeric/length constraints 미지원·재귀 불가)을 피하려 타입·required 위주로만. `additionalProperties:false`는 최상위에만 신중 적용(세부 필드 허용 위해 item엔 미적용).

### region 구조화 스키마 (잠정, EU 샘플 기반)
```
object {
  region: str, region_ko: str, code: str, schema_version: str,
  fetched_at: str, baseline_country: str,
  countries: array of (country 느슨 스키마)   # 중첩
}
```
> ⚠️ **잠정 샘플 스키마 — 추후 country 대칭 풀세트로 확장 예정**(코드/명세 코멘트 필수, Q4).

## 2. Pydantic 검증 모델 (관대한 전체, Clarification=A)
사후 검증용. 전체 필드 정의하되 **조건부/세부는 Optional**, 필수 핵심키만 required.

```python
class ResearchItem(BaseModel):
    # 필수 핵심
    item: str
    category: str
    role: str
    region: str
    tier: int
    source: str
    insight: str
    # 조건부/세부 — Optional (role/항목별로만 존재)
    insight_ai_generated: Optional[bool] = None
    value: Optional[Any] = None
    unit: Optional[str] = None
    direction: Optional[str] = None
    axis: Optional[str] = None
    timeseries: Optional[dict] = None
    similarity_axis: Optional[str] = None
    similarity_weight: Optional[float] = None
    score_dimensions: Optional[dict] = None
    model_config = {"extra": "allow"}   # 미정의 필드 허용(스키마 진화 대비)

class CountryResearch(BaseModel):
    code: str                      # 필수
    country: str
    schema_version: str
    region: Optional[str] = None
    country_ko: Optional[str] = None
    is_baseline: bool = False
    currency: Optional[str] = None
    data_year: Optional[Any] = None
    fetched_at: Optional[str] = None
    overall_insight: Optional[str] = None
    items: List[ResearchItem]      # 필수, 비어있으면 검증 실패(min 1 — 코드에서 확인)
    model_config = {"extra": "allow"}

class RegionResearch(BaseModel):   # 잠정
    code: str
    region: str
    schema_version: str
    baseline_country: Optional[str] = None
    countries: List[CountryResearch]
    model_config = {"extra": "allow"}
```
> **검증 규칙**: 필수 핵심키 누락·items 비어있음 → ValidationError → 잡 failed. 조건부 필드는 없어도 통과(관대). `extra:allow`로 스키마 진화 수용.

## 3. API 요청/응답 (schemas.py 확장)
```python
JobStep = Literal["queued","generating","rendering","calling_bedrock","saving","done"]

class ResearchTriggerRequest(BaseModel):    # region POST body
    member_codes: List[str] = Field(default_factory=list)
    segment: Optional[str] = None

class ChatTurn(BaseModel):
    role: Literal["user","assistant"]
    content: str

class ChatRequest(BaseModel):
    domain: Domain
    target_id: str
    message: str
    history: Optional[List[ChatTurn]] = None
    member_codes: Optional[List[str]] = None

class ChatResponse(BaseModel):
    answer: Optional[str] = None
    needs_research: bool = False
    research_suggestion: Optional[str] = None
    missing_codes: List[str] = Field(default_factory=list)
```

## 4. step→percent 매핑 (리서치)
| step | percent |
|---|---|
| queued | 0 |
| calling_bedrock | 40 |
| saving | 80 |
| done | 100 |
> 1차 보고서 잡의 generating/rendering은 그대로 유지(후방호환). 리서치 잡은 calling_bedrock/saving 사용.

## 직렬화 (PBT-02)
신규 모델(ChatRequest·ChatResponse·ResearchTriggerRequest)은 model_dump↔model_validate 라운드트립 동치.
