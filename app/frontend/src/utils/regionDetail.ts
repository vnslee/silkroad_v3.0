// 권역 상세(P2) 3-소스 병합 — 리서치 스냅샷 + 퀵윈 보고서 + internal 원시 데이터를
// 프론트에서 합쳐 RegionDetailData(표현용)를 만든다. 렌더링 엔진 미사용.
// 산식·스코어는 보고서 산출값을 재사용(여기선 카운트·매핑만, 새 계산 금지).
// 백엔드 region_detail_rendering_engine.build_entered/build_candidates와 동치 로직.
import type { RegionDetailSources } from '../api/types'
import type {
  RegionAssetReuse,
  RegionCandidateCountry,
  RegionDetailData,
  RegionEnteredCountry,
  RegionExecutiveSummary,
  RegionMemberTrend,
  RegionReportData,
  RegionTrendMetric,
} from '../components/reports/types'

// 리서치/보고서 레이어 코드 → 사내설정 코드(드리프트 별칭). 예: UK(리서치) → GB(사내).
const CODE_ALIAS: Record<string, string> = { UK: 'GB' }
const alias = (code: string) => CODE_ALIAS[code] ?? code

// 리서치 스냅샷 items[] — 시계열·시장규모 추출용(상세화면 전용, 보고서 미사용 데이터).
export interface RegionSnapshotItem {
  item?: string
  value?: unknown
  unit?: string | null
  direction?: string | null
  timeseries?: {
    history?: { year: number; value: number }[] | null
    forecast?: { year: number; value: number }[] | null
  } | null
}

// 리서치 스냅샷 — region/region_ko/code + countries[](국가명 해석 + items 시계열).
export interface RegionResearchSnapshot {
  region?: string
  region_ko?: string
  code?: string
  schema_version?: string | null
  fetched_at?: string | null
  countries?: {
    code?: string
    country?: string
    country_ko?: string
    items?: RegionSnapshotItem[]
  }[]
}

// 법인종류 코드 → 표시 키(SA/JV). RegionDetail이 라벨·색을 결정.
function entityType(t?: string): string {
  return (t ?? '').toUpperCase()
}

// quickwin_band → 사분면 라벨. 백엔드 _quadrant_label과 동일.
function quadrantLabel(band: number): string {
  if (band >= 60) return '선별 후보'
  if (band >= 40) return '기회 탐색'
  return '관망'
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

// 상세화면 시계열 패널(A)이 뽑는 핵심 지표 — 리서치 item명과 1:1.
// '시장규모'는 국가간 비교 시 통화 정규화(아래 marketSizeToKrwBn) 대상, 'EV'는 % 동일단위.
const TREND_MARKET = '오토금융/리스 시장규모'
const TREND_EV = 'EV 보급률'

// 시장규모 unit → KRW 십억(=10^9) 환산용 (단위당 KRW × 보고서 fx.rates). 국가간 버블·정규화용.
// 리서치 unit 표기: EUR_M·GBP_M·USD_M(백만 단위), EUR_billion_new_business(십억 단위) 혼재.
// fx.rates는 '통화 1단위당 KRW'. report 없으면(=fx 없음) 정규화 불가 → null.
function marketSizeToKrwBn(
  value: number,
  unit: string | null | undefined,
  fxRates: Record<string, number> | undefined,
): number | null {
  if (!fxRates || !Number.isFinite(value)) return null
  const u = (unit ?? '').trim()
  // unit 앞부분이 통화코드, 뒤가 스케일(_M=백만, _billion=십억).
  const m = u.match(/^([A-Z]{3})/)
  const ccy = m?.[1]
  if (!ccy || !(ccy in fxRates)) return null
  const perUnitKrw = fxRates[ccy] // 통화 1단위당 KRW
  const scale = /billion/i.test(u) ? 1e9 : /_M\b|_M$|_M/i.test(u) ? 1e6 : 1
  const krw = value * scale * perUnitKrw
  return krw / 1e9 // KRW 십억(bn)
}

// 시계열 history 첫·끝값으로 CAGR(%) — 새 스코어링 아님, 단순 연복리 성장률.
// 끝값/첫값 ≤0 또는 1점 이하면 계산 불가(null).
function cagrPct(points: { year: number; value: number }[]): number | null {
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const years = last.year - first.year
  if (years <= 0 || first.value <= 0 || last.value <= 0) return null
  const r = Math.pow(last.value / first.value, 1 / years) - 1
  return Math.round(r * 1000) / 10 // 소수 1자리 %
}

// 멤버국 1개의 시계열 패널 데이터 추출(보유 item에서 시장규모·EV만).
function buildTrend(
  items: RegionSnapshotItem[] | undefined,
  metricName: string,
): RegionTrendMetric | null {
  const it = (items ?? []).find((x) => x.item === metricName)
  const hist = it?.timeseries?.history
  if (!it || !hist || hist.length < 2) return null
  const points = hist
    .filter((p) => typeof p?.value === 'number' && Number.isFinite(p.value))
    .map((p) => ({ year: p.year, value: p.value }))
  if (points.length < 2) return null
  const fc = (it.timeseries?.forecast ?? [])
    .filter((p) => typeof p?.value === 'number' && Number.isFinite(p.value))
    .map((p) => ({ year: p.year, value: p.value }))
  return {
    metric: metricName,
    unit: it.unit ?? '',
    direction: it.direction ?? 'up',
    history: points,
    forecast: fc,
    latest: points[points.length - 1].value,
    cagr: cagrPct(points),
  }
}

/** 3-소스 병합 → RegionDetailData(표현용). report가 없으면 후보/인사이트는 빈 값. */
export function buildRegionDetail(
  snapshot: RegionResearchSnapshot,
  sources: RegionDetailSources,
  report: RegionReportData | null,
): RegionDetailData {
  const code = snapshot.code ?? sources.region ?? ''
  const status = sources.country_status ?? {}
  const assets = sources.country_assets ?? {}
  const members = sources.members ?? []

  // 국가명 해석(별칭 고려): geo 참조(member_names)를 베이스로 깔고, 스냅샷 countries[]로 덮어쓴다.
  // 스냅샷에 없는 기진출국(예: DE)도 geo 이름이 채워져 코드 중복("DE DE")을 막는다.
  const koByCode: Record<string, string> = {}
  const enByCode: Record<string, string> = {}
  for (const [code, n] of Object.entries(sources.member_names ?? {})) {
    const gb = alias(code)
    if (n.name_ko) koByCode[gb] = n.name_ko
    if (n.name) enByCode[gb] = n.name
  }
  // 멤버 코드 → 리서치 items[](시계열·시장규모 추출용). 별칭 정규화.
  const itemsByCode: Record<string, RegionSnapshotItem[]> = {}
  for (const c of snapshot.countries ?? []) {
    const gb = alias(c.code ?? '')
    if (c.country_ko) koByCode[gb] = c.country_ko
    if (c.country) enByCode[gb] = c.country
    if (c.items) itemsByCode[gb] = c.items
  }

  // ── 기진출 국가 = 권역 소속국 중 status '운영중'. (백엔드 build_entered 동치)
  const entered: RegionEnteredCountry[] = members
    .filter((gb) => status[gb] === '운영중')
    .map((gb) => {
      const a = assets[gb] ?? {}
      return {
        code: gb,
        name_ko: koByCode[gb] ?? gb,
        // 영문명 없으면 빈 값 — 컴포넌트가 "DE DE"처럼 코드를 두 번 찍지 않도록(코드 중복 방지).
        name_en: enByCode[gb] ?? '',
        status: status[gb] ?? '-',
        solution: a.solution ?? '—',
        products: a.products ?? [],
        since: a.since ?? '—',
        type: entityType(a.type),
      }
    })

  // ── 진출 예정국 후보 = 퀵윈 보고서의 랭킹된(비제외) 행. (백엔드 build_candidates 동치)
  const qwRows = report?.tabs?.quickwin?.rows ?? []
  const candidates: RegionCandidateCountry[] = qwRows
    .filter((r) => !r.excluded && r.rank != null)
    .map((r) => {
      const band = num(r.quickwin_band)
      return {
        quick_win_rank: r.rank,
        code: r.country ?? '',
        name_ko: koByCode[r.country ?? ''] || r.country_name || '',
        // 영문명 없으면 빈 값 — 컴포넌트의 pickLang이 ko로 폴백.
        name_en: enByCode[r.country ?? ''] ?? '',
        similarity: num(r.it_similarity),
        attractiveness: num(r.attractiveness),
        composite_score: num(r.quickwin_raw),
        quick_win: band >= 70,
        quadrant: quadrantLabel(band),
      }
    })

  const es: RegionExecutiveSummary | undefined = report?.tabs?.executive_summary

  // ── KPI — 후보 수 / 퀵윈 수 / 킬스위치 탈락 수. (백엔드 kpi_cards 동치)
  const killswitchFailed =
    es?.core_conclusion?.killswitch_failed_count ??
    qwRows.filter((r) => r.killswitch_excluded).length

  // ── 시계열 추세(A) — 멤버국별 시장규모·EV 보급률 history(+forecast). 보고서엔 없는 데이터.
  //    timeseries 보유국만 행이 생긴다(미보유국은 trends에서 제외 → 패널이 "—" 처리할 필요 없음).
  const fxRates = report?.fx?.rates
  const trends: RegionMemberTrend[] = members
    .map((gb) => {
      const items = itemsByCode[gb]
      const market = buildTrend(items, TREND_MARKET)
      const ev = buildTrend(items, TREND_EV)
      if (!market && !ev) return null
      return {
        code: gb,
        name_ko: koByCode[gb] ?? gb,
        // 영문명 없으면 빈 값 — 컴포넌트의 pickLang이 ko로 폴백.
        name_en: enByCode[gb] ?? '',
        market,
        ev,
        // 국가간 비교용 정규화 시장규모(KRW bn). fx 없으면 null → 지도 버블 생략.
        market_krw_bn: market ? marketSizeToKrwBn(market.latest, market.unit, fxRates) : null,
      }
    })
    .filter((t): t is RegionMemberTrend => t !== null)

  // ── 지도 멤버 — 소속국 코드 + 진출상태(운영중/준비중/미진출) + 시장규모(버블 크기).
  //    리서치 데이터(items)가 있는 국가만 지도에 그린다. 예: DE는 기진출(운영중)이라 members에
  //    있으나 리서치 스냅샷엔 없어 회색 노드로만 찍히므로 제외(데이터 없는 국가 비표시).
  const krwByCode: Record<string, number | null> = {}
  for (const t of trends) krwByCode[t.code] = t.market_krw_bn
  const mapMembers = members
    .filter((gb) => (itemsByCode[gb]?.length ?? 0) > 0)
    .map((gb) => {
      const s = status[gb]
      return {
        code: gb,
        status: s === '운영중' || s === '준비중' ? s : '미진출',
        market_krw_bn: krwByCode[gb] ?? null,
      }
    })

  // ── 자산 재사용 매핑(B) — 기진출 거점(솔루션 보유)별로 IT유사도 높은 후보 Top3 연결.
  //    보고서는 후보를 우리 자산과 연결하지 않음 → 상세화면 전용 관점.
  //    기진출국이 없거나 후보가 없으면 빈 배열(컴포넌트가 패널 숨김).
  const rankedCands = [...candidates].sort((a, b) => b.similarity - a.similarity)
  const assetReuse: RegionAssetReuse[] = entered
    .filter((e) => e.solution && e.solution !== '—')
    .map((e) => ({
      from_code: e.code,
      from_name_ko: e.name_ko,
      solution: e.solution,
      type: e.type,
      // 유사도 내림차순 후보 Top3(점수 0 초과만 — 의미있는 매칭).
      matches: rankedCands
        .filter((c) => c.similarity > 0)
        .slice(0, 3)
        .map((c) => ({
          code: c.code,
          name_ko: c.name_ko,
          similarity: c.similarity,
          quick_win: c.quick_win,
        })),
    }))
    .filter((r) => r.matches.length > 0)

  return {
    region: snapshot.region ?? code,
    region_ko: snapshot.region_ko ?? '',
    code,
    schema_version: snapshot.schema_version ?? null,
    fetched_at: snapshot.fetched_at ?? null,
    baseline_country: report?.target?.baseline_country ?? '',
    kpi: {
      candidates: candidates.length,
      quickwin: candidates.filter((r) => r.quick_win).length,
      killswitch_failed: killswitchFailed,
    },
    entered_countries: entered,
    candidate_countries: candidates,
    map: { members: mapMembers },
    trends,
    asset_reuse: assetReuse,
    executive_summary: es as RegionExecutiveSummary,
  }
}
