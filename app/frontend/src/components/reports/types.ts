// Report 타입 정의 (PR1, PR2, P1, P2 공통)
import type { TimeseriesData } from '../charts/types'

export interface ReportMeta {
  report_id: string
  report_type: string
  title: string
  generated_at: string
  schema_version: string
  overall_insight: string
}

export interface CountryMeta {
  country: string
  country_ko: string
  region: string
  currency: string
  data_year: number
  fetched_at: string
  fetched_by: string
  entry_status?: string
}

export interface DataQuality {
  completeness_pct: number
  total_items: number
  target_items: number
  timeseries_coverage: number
  source_tiers: {
    tier1: number
    tier2: number
    tier3: number
    tier4: number
  }
  items_by_category: Record<string, any[]>
}

export interface TabData {
  title: { ko: string; en: string }
  sections: Section[]
}

export interface Section {
  title?: { ko: string; en: string }
  type: 'text' | 'table' | 'chart' | 'radar' | 'cards' | 'list'
  content?: any
  data?: any
}

// ───────────────────────────────────────────────────────────────
// PR1 국가 보고서 — 실제 tabs JSON 구조 (mockup 03_country_report 기준)
// ───────────────────────────────────────────────────────────────

/** 보고서 항목(원천 데이터) — tab_1_1 evidence_items, tab_1_3/1_4 items 공통 */
export interface ReportItem {
  item: string
  category?: string
  role?: string
  value: any
  value_en?: any
  unit?: string | null
  direction?: 'up' | 'down' | 'neutral' | null
  axis?: string | null
  gate_result?: string | null
  gate_scope?: string | null
  segment?: string | null
  context_type?: string | null
  timeseries?: TimeseriesData | null
  tier?: number
  source?: string
  insight?: string
  insight_ai_generated?: boolean
  status?: string
}

/** tab_1_1 유사도 — 디멘전별 채점 */
export interface SimilarityDimension {
  dimension: string
  target_score: number
  base_score: number
  gap: number
  similarity: number
  note?: string
}
export interface SimilarityItem {
  item: string
  axis: string
  weight: number
  dimensions: SimilarityDimension[]
  item_similarity: number
}
export interface SimilarityTabData {
  overall_score: number
  axes: Record<string, number>
  items: SimilarityItem[]
  method?: string
  scale?: string
  evidence_items: ReportItem[]
}

/** tab_1_2 시스템 결정 트리 */
export interface DecisionTabData {
  decision: string
  similarity_score: number
  recommendation: string
  base_country: string
  base_system: string
  region_system_exists: boolean
  hq_baseline_cost?: number
  hq_baseline_months?: number
  hq_baseline_currency?: string
  items: ReportItem[]
}

/** tab_1_3 TCO·구독료 */
export interface SubscriptionTier {
  min_volume: number
  max_volume: number | null
  price_per_unit: number
  currency: string
}
export interface TcoTabData {
  build_cost: number
  build_months: number
  annual_subscription: number
  annual_maintenance: number
  annual_recurring: number
  operations_10y: number
  system_cost_10y: number
  total_tco_10y: number
  currency: string
  /** 산식 작업 통화(항상 "EUR"). 표시 금액은 currency로 환산됨. 구버전 데이터엔 없음. */
  currency_base?: string
  /** 환산 전 EUR 원본 총 TCO. 구버전 데이터엔 없음. */
  total_tco_10y_eur?: number
  similarity_score: number
  similarity_multiplier: number
  similarity_band: string
  discount_applied: number
  build_breakdown: {
    formula?: string
    inputs: Record<string, any>
    outputs: Record<string, any>
    /** 표시 통화. 구버전 데이터엔 없음. */
    currency?: string
  }
  expected_contracts: number
  expected_contracts_breakdown: {
    value: number
    formula?: string
    inputs: Record<string, any>
  }
  subscription_details: Record<string, any>
  subscription_tiers: SubscriptionTier[]
  existing_total_volume: number
  items: ReportItem[]
}

/** tab_1_4 시장·경쟁 배경 */
export interface NewsEntry {
  news_category: string
  headline: string
  so_what: string
  publisher: string
  pub_date: string
  url: string
}
export interface MarketTabData {
  items: ReportItem[]
  competitors: ReportItem
  competitor_entry_form: ReportItem
  brand_top10: ReportItem
  news: ReportItem
  regulators: ReportItem
  country_summary: ReportItem
}

export interface CountryReportTabs {
  tab_1_1_similarity: SimilarityTabData
  tab_1_2_decision: DecisionTabData
  tab_1_3_tco: TcoTabData
  tab_1_4_market: MarketTabData
}

// PR1 - 국가 보고서
export interface CountryReportData extends ReportMeta {
  target: {
    country: string
    base_country: string
  }
  country_meta: CountryMeta
  data_quality: DataQuality
  tabs: CountryReportTabs
}

// ============================================================
// PR2 - 권역 퀵윈 분석 보고서 (실제 엔진 JSON 구조)
// ============================================================

/** 권역 보고서 최상위 — region_report_engine.py 산출 JSON */
export interface RegionReportData {
  report_id: string
  report_type: string
  title: string
  target: {
    region: string
    evaluated_countries: string[]
    baseline_country: string
  }
  generated_at: string
  generated_by?: string
  data_snapshot_id?: string
  config_version?: string
  engine_version?: string
  schema_version?: string
  fx?: {
    base: string
    as_of: string
    rates: Record<string, number>
    note?: string
  }
  region_meta: {
    region: string
    region_ko: string
    code: string
    fetched_at?: string
    fetched_by?: string
  }
  data_quality: {
    total_countries: number
    countries: string[]
    timeseries_coverage_avg?: number
    source_tiers?: { tier1: number; tier2: number; tier3: number; tier4: number }
    country_completeness?: Record<string, unknown>
    critical_gaps?: unknown[]
    readiness?: { can_generate: boolean; tabs?: Record<string, unknown> }
  }
  tabs: RegionTabs
}

export interface RegionTabs {
  tab_2_0_killswitch: RegionKillswitchTab
  tab_2_1_attractiveness: RegionAttractivenessTab
  tab_2_2_it_similarity: RegionITSimilarityTab
  tab_2_3_market_background: RegionMarketTab
  quickwin: RegionQuickwinTab
  top3_country_cards: RegionTop3Card[]
  executive_summary: RegionExecutiveSummary
}

// --- 2.0 킬스위치 ---
export interface RegionKillswitchGateCell {
  status: string // "PASS" | "FLAG" | "FAIL" 등
  value: string
  source?: string
  tier?: number
  gate_scope?: string
}
/** 진출 형태(killswitch tier) 라벨 — ko/en */
export interface KillswitchTierLabel {
  ko: string
  en: string
}
export interface RegionKillswitchCountry {
  country: string
  country_name: string
  pass: boolean
  /** 진출 형태 키 — "jv_required" | "jv_recommended" | "external_solution" | "in_region_confidence". 구버전 데이터엔 없음. */
  tier?: string
  tier_label?: KillswitchTierLabel
  gates: Record<string, RegionKillswitchGateCell>
}
/** tier_summary 항목 — tier별 분포 요약(severity 오름차순) */
export interface RegionKillswitchTierSummary {
  key: string
  label: KillswitchTierLabel
  severity: number
  count: number
}
export interface RegionKillswitchTab {
  nature: string
  source_flag: string
  gates: string[]
  countries: RegionKillswitchCountry[]
  passed: string[]
  failed: string[]
  passed_count: number
  failed_count: number
  /** tier별 카운트(키→개수). 구버전 데이터엔 없음. */
  tier_counts?: Record<string, number>
  /** tier별 분포 요약. 구버전 데이터엔 없음. */
  tier_summary?: RegionKillswitchTierSummary[]
}

// --- 2.1 매력도 ---
export interface RegionAttrContribution {
  raw_value: number
  normalized: number
  weight: number
  tier: number
  tier_multiplier: number
  effective_weight: number
  reverse: boolean
  source_item: string
  contribution: number
}
export interface RegionAttrCountry {
  country: string
  country_name: string
  attractiveness_score: number
  contributions: Record<string, RegionAttrContribution>
  rank: number
}
export interface RegionRankingEntry {
  rank: number
  country: string
  score: number
}
export interface RegionAttractivenessTab {
  nature: string
  source_flag: string
  weights: Record<string, number>
  tier_weights: Record<string, number | string>
  axes: Record<string, Record<string, number>>
  countries: RegionAttrCountry[]
  ranking: RegionRankingEntry[]
  method?: string
}

// --- 2.2 IT 유사도 ---
export interface RegionITAxis {
  source_item: string
  weight: number
  tier: number
  tier_multiplier: number
  effective_weight: number
  target_value: string | number
  baseline_value: string | number
  score_raw: number
  score_band: number
}
export interface RegionITCountry {
  country: string
  country_name: string
  it_similarity_raw: number
  it_similarity_band: number
  is_baseline: boolean
  axes: Record<string, RegionITAxis>
}
export interface RegionITRankingEntry {
  rank: number
  country: string
  score_band: number
}
export interface RegionITSimilarityTab {
  nature: string
  source_flag: string
  baseline_country: string
  weights: Record<string, number>
  tier_weights: Record<string, number | string>
  countries: RegionITCountry[]
  ranking: RegionITRankingEntry[]
  method?: string
  note?: string
}

// --- 2.3 시장 배경 ---
export interface RegionMarketOem {
  rank: number
  name: string
  market_share: string
}
export interface RegionMarketCountry {
  country: string
  country_name: string
  oem_top5: RegionMarketOem[]
  brand_top10: string[]
  purchase_pattern?: number
  purchase_pattern_unit?: string
  competitors: string[]
  competitor_entry_form?: string
  competitor_rates?: string
  avg_new_car_price?: string
  qualitative_summary?: string
}
export interface RegionMarketTab {
  nature: string
  source_flag: string
  countries: RegionMarketCountry[]
}

// --- 퀵윈 ---
export interface RegionQuickwinRow {
  country: string
  country_name: string
  attractiveness: number
  it_similarity: number
  it_similarity_band: number
  quickwin_raw: number
  quickwin_band: number
  is_baseline: boolean
  killswitch_excluded: boolean
  /** 진출 형태 키 — 랭킹 제외/감점 판정용. 구버전 데이터엔 없음. */
  killswitch_tier?: string
  killswitch_tier_label?: KillswitchTierLabel
  /** 랭킹 점수 차감(JV 권고=10, 그 외 0). 구버전 데이터엔 없음. */
  quickwin_penalty?: number
  /** 이미 진출(운영중·기진출 자산 보유)한 국가 → 후보 제외. */
  already_entered?: boolean
  excluded: boolean
  exclusion_reason: string | null
  rank: number
}
export interface RegionQuickwinRankingEntry {
  rank: number
  country: string
  score_band: number
  attractiveness: number
  it_similarity_band: number
}
export interface RegionQuickwinTab {
  nature: string
  source_flag: string
  weights: { w_biz: number; w_it: number }
  baseline_country: string
  rows: RegionQuickwinRow[]
  ranking: RegionQuickwinRankingEntry[]
  note: { ko: string; en: string }
}

// --- top3 국가 카드 ---
export interface RegionTop3Competitor {
  rank: number
  name: string
  market_share?: string
  market_share_en?: string
}
export interface RegionTop3Card {
  rank: number
  country: string
  country_name: string
  quickwin_score_band: number
  attractiveness: number
  it_similarity_band: number
  killswitch_pass: boolean
  /** 진출 형태 키. 구버전 데이터엔 없음. */
  killswitch_tier?: string
  killswitch_tier_label?: KillswitchTierLabel
  market_brief: Record<string, number>
  competition_brief: {
    금융사_Top5?: RegionTop3Competitor[]
    경쟁사_진출_형태?: string
  }
  top_news?: {
    news_category?: string
    headline: string
    so_what: string
    publisher?: string
    pub_date?: string
    url?: string
  }
  ai_comment?: string
}

// --- 요약 ---
export interface RegionExecTop3 {
  rank: number
  country: string
  score_band: number
  attractiveness: number
  it_similarity_band: number
}
export interface RegionExecNewsItem {
  country: string | null
  scope: string
  headline: string
  so_what: string
  publisher?: string
  date?: string | null
  url?: string
  news_category?: string
}
export interface RegionExecutiveSummary {
  core_conclusion: {
    source_flag: string
    top3: RegionExecTop3[]
    killswitch_failed_count: number
    why_top1: { ko: string; en: string }
  }
  ai_cross_insight: {
    source_flag: string
    insights: { ko: string; en: string }[]
  }
  external_news_scan: {
    source_flag: string
    items: RegionExecNewsItem[]
    region_news_count?: number
    note?: { ko: string; en: string }
  }
}

// P1 - 국가 상세
export interface CountryDetailData {
  country: string
  country_ko: string
  code: string
  region: string
  is_baseline: boolean
  currency: string
  data_year: number
  fetched_at: string
  overall_insight: string
  overall_insight_en?: string
  items: DetailItem[]
}

// P2 - 권역 상세 (백엔드 build_detail_data 3-소스 병합 결과)
// region_detail_rendering_engine.build_detail_data() 산출 JSON과 1:1.
export interface RegionEnteredCountry {
  code: string
  name_ko: string
  name_en: string
  status: string
  solution: string
  products: string[]
  since: number | string
  type: string // 'SA' | 'JV' | ''
}
export interface RegionCandidateCountry {
  quick_win_rank: number
  code: string
  name_ko: string
  similarity: number
  attractiveness: number
  composite_score: number
  quick_win: boolean
  quadrant: string
}
export interface RegionMapMember {
  code: string
  status: string // '운영중' | '준비중' | '미진출'
}
export interface RegionDetailData {
  region: string
  region_ko: string
  code: string
  schema_version?: string | null
  fetched_at?: string | null
  kpi: {
    candidates: number
    quickwin: number
    killswitch_failed: number
  }
  entered_countries: RegionEnteredCountry[]
  candidate_countries: RegionCandidateCountry[]
  map: { members: RegionMapMember[] }
  executive_summary: RegionExecutiveSummary
}

export interface DetailItem {
  item: string
  category: string
  role: string
  value: any
  value_en?: any
  unit?: string
  direction?: 'up' | 'down' | 'neutral'
  axis?: string
  source?: string
  source_en?: string
  source_tier?: number
  tier?: number
  flag?: string
  insight?: string
  insight_en?: string
  insight_ai_generated?: boolean
  timeseries?: {
    history: { year: number; value: number }[]
    forecast?: { year: number; value: number }[]
    cagr_hist?: number
    cagr_forecast?: number
    estimated?: boolean
  }
}

/** 금융사/OEM 순위 항목(value가 객체 배열일 때) */
export interface RankedEntity {
  rank: number
  name: string
  market_share?: string
  captive?: boolean | string
}
