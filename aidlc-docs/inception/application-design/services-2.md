# Services & Orchestration — research-chatbot (2차)

## 서비스 요약
| 서비스 | 책임 | 상태 |
|---|---|---|
| BedrockClient (C8) | Mantle 호출·구조화출력 | stateless(클라이언트 싱글톤) |
| PromptLoader (C9) | 프롬프트/스키마 로드·치환 | stateless(파일 읽기) |
| ResearchAgent (C10) | country/region 리서치 | stateless |
| ResearchOrchestrator (C11) | 리서치 비동기 잡 | 1차 JobManager(stateful) 사용 |
| ChatbotService (C12) | §6.5 분기·LLM 답변 | stateless(무상태, Q5=A) |

## 오케스트레이션 패턴

### 패턴 1 — 비동기 리서치 (Q6=A, 1차 잡 재사용)
```
POST /api/research/{domain}/{id}  (region이면 body.member_codes)
 → job_manager.create_job("research", {domain,target_id})
 → BackgroundTasks(run_research_job)
 → 202 JobCreatedResponse(job_id, status_url=/api/jobs/{id})

(백그라운드) run_research_job:
 start → calling_bedrock(40%)
   ResearchAgent.run:
     [region] 누락 member country 리서치 선행(각각 calling_bedrock)
     PromptLoader → BedrockClient.generate_structured(json_schema)
 → saving(80%) → storage_resolver.save_research(<ID>_<TS>.json + latest)
 → succeed(result: path/latest/schema_version)
 except → fail(error)

폴링: GET /api/jobs/{id} (1차 재사용)
```

### 패턴 2 — 동기 챗봇 (§6.5)
```
POST /api/chat {domain,target_id,message,history?,member_codes?}
 → ChatbotService.handle:
    exists = research_exists(domain,target_id)
    ┌ region: member_codes 중 누락 판정
    ├ 전체 보유 → ctx=_summarize(latest json) → BedrockClient.generate_text → answer
    ├ 부분 보유(권역) → needs_research=True, missing_codes, "일부 국가 정보 부족..." (§6.5.2)
    └ 없음 → needs_research=True, "외부 리서치 진행?" (권역이면 국가 리스트 요청)
 → ChatResponse
```
> 챗봇은 리서치를 **직접 트리거하지 않음** — needs_research 신호만 반환. 프론트(3차)가 사용자 동의 후 research API 호출(관심사 분리, web_design_spec §6.5 흐름).

## 대칭성 (NFR-1)
- ResearchAgent는 domain 인자로 country/region 분기(프롬프트·스키마만 차이). region 코드/스키마는 잠정이나 인터페이스 대칭.
- 라우터는 두 벌(countries/regions), 핸들러는 동일 서비스 호출.

## 에러 처리
| 상황 | 처리 |
|---|---|
| Bedrock 호출 실패(네트워크·자격증명·throttle) | 리서치 잡: status=failed + error / 챗봇: 502 |
| 구조화출력 스키마 위반(드묾) | generate_structured에서 예외 → 잡 failed |
| 리서치 대상 형식 오류 | 422(target_id 패턴 검증, 1차 규칙 재사용) |
| 챗봇 데이터 없음 | 200 + needs_research(정상 분기, 에러 아님) |

## 동시성
- BedrockClient 싱글톤은 thread-safe 생성(lock). JobManager는 1차 lock 재사용.
- 리서치 잡은 BackgroundTasks(1차와 동일 스레드풀).

## 1차 무파괴 (NFR-3)
- JobManager·StorageResolver·config·schemas는 **확장만**(필드/메서드 추가), 기존 시그니처 유지.
- JobStep enum 확장은 후방호환(기존 country/region 보고서 잡의 step 값 불변).
