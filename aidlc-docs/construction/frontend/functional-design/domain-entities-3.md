# Domain Entities — frontend (3차)

> Functional Design 산출물 ①. 프론트 뷰모델·TS 타입(백엔드 schemas.py 1:1)·라우트 상태·잡 참조 엔티티. 기술-무관 도메인 정의.

## 1. 백엔드 대응 TS 타입 (schemas.py 1:1)

```ts
type Domain = 'country' | 'region'
type JobState = 'queued' | 'running' | 'done' | 'failed'

// JobStep: 백엔드 enum. (상세 렌더 잡 확장 시 'rendering' 재사용 또는 신규 step 추가)
type JobStep = 'queued' | 'generating' | 'rendering' | 'calling_bedrock' | 'saving' | 'done'

interface CountrySummary { code: string; name: string; name_ko?: string; region?: string; is_baseline: boolean; has_detail: boolean; has_report: boolean }
interface RegionSummary  { code: string; name: string; name_ko?: string; baseline_country?: string; has_detail: boolean; has_report: boolean }

interface ExistenceInfo  { domain: Domain; target_id: string; exists: boolean; has_detail: boolean; has_report: boolean; can_research: boolean; latest_report_id?: string }

interface ReportRef { report_id: string; created_at?: string; /* + 메타 */ }
interface ReportListResponse { domain: Domain; target_id: string; reports: ReportRef[] }

interface JobResult         { domain: Domain; target_id: string; report_id: string; json_url: string; html_url: string; pdf_url?: string }
interface ResearchJobResult { domain: Domain; target_id: string; latest_url?: string; schema_version?: string }
interface DetailJobResult   { domain: Domain; target_id: string; html_url: string }   // ★상세 렌더 잡 확장 시 신규
type JobResultUnion = JobResult | ResearchJobResult | DetailJobResult

interface JobStatus { job_id: string; kind: JobKind; status: JobState; step: JobStep; percent: number; message?: string; result?: JobResultUnion; error?: string; params: Record<string,string> }
interface JobCreatedResponse { job_id: string; status: JobState; status_url: string }

interface ChatTurn     { role: 'user' | 'assistant'; content: string }
interface ChatRequest  { domain: Domain; target_id: string; message: string; history?: ChatTurn[]; member_codes?: string[] }
interface ChatResponse { answer?: string; needs_research: boolean; research_suggestion?: string; missing_codes: string[] }

interface ResearchTriggerRequest { member_codes?: string[]; segment?: string }
```

## 2. 잡 종류(JobKind) — 3종 (사용자 확정)

```ts
type JobKind = 'research' | 'detail' | 'report'
```

| kind | 트리거 | 백엔드 | 의미 | PS2 표현 |
|---|---|---|---|---|
| `research` | `POST .../research` (기존, 202) | `run_research_job` (`calling_bedrock`→`saving`) | 국가/권역 데이터 생성 — 시장·규제·상품·시스템 4 agent 서치 | **4 agent 바**(시장/규제/상품/시스템) + 결과 생성 |
| `detail` | `POST .../detail` (★신규 확장, 202) | 신규 detail orchestrator (현재 동기 GET → 잡화) | 상세화면 P1/P2 HTML 렌더 | 렌더링 단일 진행 |
| `report` | `POST .../reports` (기존, 202) | `run_report_job` (`generating`→`rendering`) | 보고서 데이터 생성 → 렌더링 → 완료 | 데이터 생성 → 렌더링 → 완료 |

> **범위 변경**: `detail` 잡은 백엔드 확장 산출물(현재 동기). 본 FD가 프론트 계약을, 백엔드 확장은 Code Generation 단계에서 1·2차 패턴(JobManager·orchestrator 동형)으로 추가.

## 3. 프론트 뷰모델 / 라우트 상태

```ts
type EntryMode = 'popup' | 'fullscreen'
type ScreenId = 'map' | 'detail' | 'report' | 'ruleset' | 'progress'

interface RouteState {
  screen: ScreenId
  domain?: Domain
  id?: string          // 국가코드/권역코드
  reportId?: string    // PR 화면 시
  mode: EntryMode      // ?mode= 쿼리 (Q8=A)
}

// 진행 중 잡 참조 (전역 store; §5.3 프로그레스 카드 노출 판단)
interface JobRef { jobId: string; kind: JobKind; domain: Domain; id: string; label: string }

// 챗봇 세션 (무상태 — 클라이언트 보관, Q4=A)
interface ChatSession { target: { domain: Domain; id: string } | null; turns: ChatTurn[] }

// 지도 마커 (Q7=A: 카탈로그 API + 정적 지오좌표)
interface MapMarker { code: string; name: string; lon: number; lat: number; status: 'active' | 'planned'; hasReport: boolean }
//   status: is_baseline||has_detail||has_report → 'active', 그 외 카탈로그 등재국 → 'planned'

// PS2 프로그레스 바 (kind별 구성 — Q1 확정)
interface ProgressBar { key: string; label: string; percent: number; state: 'pending' | 'active' | 'done' }
```

## 4. mailto 입력 엔티티 (Q6=A)

```ts
interface MailtoInput {
  domain: Domain
  targetName: string     // 국가/권역명
  reportId: string
  createdAt?: string
  summary: string        // 판정/핵심 점수 1~2줄 (리포트 JSON에서)
  htmlUrl: string
  pdfUrl?: string
}
// buildMailtoUrl(MailtoInput): string  — to 비움, subject/body 인코딩, 첨부 안내 포함
```

## 5. 룰셋 폼 엔티티 (PS1, Q5 무관 — C8)

```ts
interface RulesetForm {
  rulesetId: string
  categoryWeights: { market: number; regulation: number; environment: number; system: number }  // 합 100
  thresholdFactors: { transferThreshold: number; systemGate: number }                            // 0~100
  sourceFactors: { tier1: number; tier2: number; tier3: number }                                 // 0~1.0
}
// 저장: 백엔드 API 부재 → localStorage/placeholder (Q5 Application Design 결정 유지)
```

## 6. 엔티티 관계 요약
- `RouteState` → 화면/모드/대상 결정 → 화면 컴포넌트 + 컨테이너
- `JobRef`(전역) ↔ `JobStatus`(폴링) → `ProgressBar[]`(PS2, kind별)
- `ChatResponse{needs_research,missing_codes}` → 리서치 `JobRef` 생성 → 폴링 → 챗봇 복귀
- `JobResult.report_id/html_url/pdf_url` → ReportView iframe + MailtoInput
