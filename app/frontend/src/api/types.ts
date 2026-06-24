// 백엔드 api/schemas.py 와 1:1 대응하는 TS 타입(domain-entities-3).
// 필드/리터럴은 schemas.py 실측 기준.

export type Domain = 'country' | 'region'
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed'
export type JobStep =
  | 'queued'
  | 'generating'
  | 'rendering'
  | 'calling_bedrock'
  | 'members_progress'
  | 'region_synth'
  | 'result_gen'
  | 'saving'
  | 'done'

// 프론트 잡 종류(3종). 백엔드 create_job(kind=...) 값과 정합.
export type JobKind = 'research' | 'detail' | 'report'

export interface CountrySummary {
  code: string
  name: string
  name_ko?: string | null
  region?: string | null
  is_baseline: boolean
  has_detail: boolean
  has_report: boolean
  // 진출 상태(internal_latest.json country_status): 운영중·미진출 등. 없으면 null.
  status?: string | null
  // 지도 마커 좌표(백엔드 geo 참조). 있으면 프론트가 마커를 자동 표시.
  lon?: number | null
  lat?: number | null
  // 진출형태(internal country_assets[code].type): '단독법인'|'JV'. 기진출국만, 미진출국은 null.
  entry_mode?: string | null
}

export interface RegionSummary {
  code: string
  name: string
  name_ko?: string | null
  baseline_country?: string | null
  has_detail: boolean
  has_report: boolean
}

// 권역 상세(P2) 3-소스 병합용 원시 internal 데이터 — /api/regions/{r}/detail-sources 와 1:1.
// country_assets[code]: { solution, type('SA'|'JV'), products[], since } (기진출국만 존재).
export interface RegionAssetEntry {
  solution?: string
  type?: string
  products?: string[]
  since?: number | string
}
export interface RegionDetailSources {
  region: string
  members: string[] // 권역 소속국(ISO alpha-2)
  country_assets: Record<string, RegionAssetEntry>
  country_status: Record<string, string> // ISO alpha-2 → '운영중'|'준비중'|'미진출'
}

// 지도 채색 데이터 — 백엔드 /api/map-colors (schemas.MapColorData) 와 1:1.
export interface MapColorData {
  country_status: Record<string, string> // ISO alpha-2 → '운영중'|'미진출'|...
  hyundai_countries: string[] // 현대 해외사업망 국가 영문명
}

export interface ExistenceInfo {
  domain: Domain
  target_id: string
  exists: boolean
  has_detail: boolean
  has_report: boolean
  can_research: boolean
  latest_report_id?: string | null
}

export interface ReportRef {
  report_id: string
  report_type?: string | null
  title?: string | null
  generated_at?: string | null
  json_url: string
  html_url: string
  pdf_url: string
}

export interface ReportListResponse {
  domain: Domain
  target_id: string
  reports: ReportRef[]
}

export interface JobResult {
  domain: Domain
  target_id: string
  report_id: string
  json_url: string
  html_url: string
  pdf_url?: string | null
}

export interface ResearchJobResult {
  domain: Domain
  target_id: string
  latest_url?: string | null
  schema_version?: string | null
}

export interface DetailJobResult {
  domain: Domain
  target_id: string
  html_url?: string | null
}

export type JobResultUnion = JobResult | ResearchJobResult | DetailJobResult

export interface JobCreatedResponse {
  job_id: string
  status: JobState
  status_url: string
}

// 분야 agent별 진행률(리서치 잡 per-agent 프로그레스바). schemas.py AgentProgress와 1:1.
export interface AgentProgress {
  key: string // market | regulatory | system | product
  label: string
  status: JobState
  percent: number
}

export interface JobStatus {
  job_id: string
  kind: string
  status: JobState
  step: JobStep
  percent: number
  message?: string | null
  result?: JobResultUnion | null
  error?: string | null
  params: Record<string, string>
  // 리서치 잡의 분야 agent별 진행률. 보고서/상세 잡은 빈 배열.
  agents: AgentProgress[]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  domain: Domain
  target_id: string
  message: string
  history?: ChatTurn[]
  member_codes?: string[]
}

export type ChatIntent = 'qa' | 'research' | 'report'
export type ChatAction = 'summary' | 'research' | 're_research' | 'report' | 're_report'

export interface ChatResponse {
  answer?: string | null
  needs_research: boolean
  needs_report: boolean
  // 명시적 의도(보유국 재리서치·보고서 생성)면 확인 없이 즉시 트리거.
  auto_trigger: boolean
  research_suggestion?: string | null
  missing_codes: string[]
  // 질문에서 백엔드가 식별한 대상(§6.5) — 리서치/보고서 트리거 대상으로 사용.
  resolved_domain?: Domain | null
  resolved_target_id?: string | null
  // 대상 상태 + 노출할 선택지(상세요약/리서치/보고서).
  intent: ChatIntent
  exists: boolean
  has_report: boolean
  actions: ChatAction[]
}

export interface ResearchTriggerRequest {
  member_codes?: string[]
  segment?: string
}

// 룰셋 설정(FR-6) — 보고서 엔진이 실제 쓰는 가중치/계수. schemas.py RulesetPayload와 1:1.
// quick_win_rules·maintenance_rate는 엔진 산식 미사용이라 제외.
export interface RulesetPayload {
  version?: string | null
  updated_at?: string | null
  biz_attractiveness: Record<string, number>
  it_readiness: Record<string, number>
  report_blend: Record<string, number>
  similarity_item_weights: Record<string, number>
  similarity_item_axes: Record<string, string>
  tier_weights: Record<string, number>
  decision_thresholds: Record<string, number>
}

// PUT /api/ruleset 응답 — 저장된 룰셋 + 생성된 버전 스냅샷 메타. schemas.py RulesetSaveResult와 1:1.
export interface RulesetSaveResult {
  ruleset: RulesetPayload
  version: string
  snapshot_file: string
  updated_at: string
}

// 버전 스냅샷 목록 항목(드롭다운용). schemas.py RulesetVersionInfo와 1:1.
export interface RulesetVersionInfo {
  version: string
  date: string
  file: string
  is_latest: boolean
}
