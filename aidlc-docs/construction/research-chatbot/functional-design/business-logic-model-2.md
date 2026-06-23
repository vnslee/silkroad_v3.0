# Business Logic Model — research-chatbot (2차)

기술 비종속 핵심 로직.

## L1. 프롬프트 조립 (PromptLoader)
```
country: read country_research_prompt.md 본문
  → 치환 {COUNTRY}=country_name, {REGION}=region, {SEGMENT}=segment|기본
region: read region_research_prompt.md(잠정) 본문 → {REGION}=region_name, member_codes 안내
json_schema: read *_schema.md → 느슨 JSON Schema 도출(domain-entities §1)
```
> 파일 self-locate(config.RESEARCH_SPEC_DIR). 명세=실행 단일출처(Q3=A).

## L2. 구조화 출력 호출 (BedrockClient.generate_structured)
```
client = AnthropicBedrockMantle(aws_region="ap-northeast-2")  # lazy 싱글톤
resp = client.messages.create(
  model="anthropic.claude-opus-4-8",
  max_tokens=16000, (streaming)            # Q3=A
  output_config={"format":{"type":"json_schema","schema": loose_schema}},
  system=..., messages=[{"role":"user","content":prompt}],
)
→ 첫 text 블록 JSON 파싱 → dict 반환
```
> 큰 출력이라 streaming + get_final_message. SDK 기본 재시도(429/5xx 2회) 활용, 앱 재시도 없음(Q5=A).

## L3. 사후 검증 (관대한 전체, Clarification=A)
```
data = generate_structured(...)
try: CountryResearch.model_validate(data)   # 필수키 strict, 조건부 Optional
     assert len(data["items"]) >= 1
except ValidationError as e: raise ResearchError(f"스키마 검증 실패: {e}")
```
> 필수 핵심키 누락·items 비어있음만 실패. 조건부 필드 누락은 통과(extra:allow).

## L4. 저장 (StorageResolver.save_research)
```
ts = fetched_at(콜론압축, YYYY-MM-DDTHHMM) 또는 생성시각
path = storage/data/research/<domain>/<id>/<id>_<ts>.json
write(path, data) ; write(<id>_latest.json, data)   # 포인터 갱신
→ (path, latest_path)
```
> 기존 네이밍·경로 규칙(PIPELINE §2, CLAUDE.md). 1차 StorageResolver에 헬퍼 추가.

## L5. 리서치 Agent (ResearchAgent.run)
```
country(domain=country):
  prompt = L1 ; data = L2 ; L3 검증 ; path = L4
  → ResearchResult(domain,target_id,path,latest_path,schema_version)

region(domain=region, member_codes):           # Q6=A 누락국가 선행
  for code in member_codes:
    if not research_exists(country, code):
       progress("calling_bedrock", f"국가 {code} 리서치")
       run(country, code)                       # 선행
  progress("calling_bedrock","권역 리서치")
  prompt = L1(region) ; data = L2 ; L3(RegionResearch) ; L4
```

## L6. 리서치 잡 (ResearchOrchestrator.run_research_job) — Q1=A 1차 재사용
```
job_manager.start(job_id)                         # running, step=generating→ 즉시 calling_bedrock
progress_cb = λ step,msg: job_manager.set_progress(job_id, step, msg)
try:
  result = ResearchAgent.run(domain, target_id, segment, member_codes, progress_cb)
  job_manager.succeed(job_id, JobResult-유사{domain,target_id,latest_url,...})
except Exception as e:
  job_manager.fail(job_id, str(e))
```
> 상태 전이: queued→calling_bedrock(40)→saving(80)→done(100). 1차 JobManager·폴링 그대로.

## L7. 챗봇 분기 (ChatbotService.handle) — §6.5, Q5=A 무상태
```
exists = research_exists(domain, target_id)
if domain==region and member_codes:
   missing = [c for c in member_codes if not research_exists(country,c)]
else: missing = []

if domain==region and exists and missing:        # 부분 데이터(§6.5.2)
   → ChatResponse(needs_research=True, missing_codes=missing,
       research_suggestion="일부 국가 정보가 부족합니다. 리서치를 진행할까요?")
elif exists and not missing:                      # 보유 → LLM 답변
   ctx = _summarize(load latest research)         # Q6=A overall_insight+핵심 items
   answer = BedrockClient.generate_text(message, system=챗봇톤, context=ctx, history)
   → ChatResponse(answer=answer)
else:                                             # 없음(§6.5.1/6.5.2)
   sug = "외부 리서치를 진행할까요?" + (권역이면 "포함할 국가를 알려주세요")
   → ChatResponse(needs_research=True, research_suggestion=sug)
```
> 챗봇은 리서치 직접 트리거 안 함 — needs_research 신호만(프론트가 동의 후 research API). 무상태(history는 요청 전달).

## L8. 컨텍스트 요약 (_summarize) — Q6=A
```
overall_insight + items 중 role==score/gate 핵심 N개(item·value·unit·insight) 추출
→ 토큰 절약용 텍스트 블록
```
