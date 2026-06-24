// 권역 상세(P2) 3-소스 병합 — 리서치 스냅샷 + 퀵윈 보고서 + internal 원시 데이터를
// 프론트에서 합쳐 RegionDetailData(표현용)를 만든다. 렌더링 엔진 미사용.
// 산식·스코어는 보고서 산출값을 재사용(여기선 카운트·매핑만, 새 계산 금지).
// 백엔드 region_detail_rendering_engine.build_entered/build_candidates와 동치 로직.
import type { RegionDetailSources } from '../api/types'
import type {
  RegionCandidateCountry,
  RegionDetailData,
  RegionEnteredCountry,
  RegionExecutiveSummary,
  RegionReportData,
} from '../components/reports/types'

// 리서치/보고서 레이어 코드 → 사내설정 코드(드리프트 별칭). 예: UK(리서치) → GB(사내).
const CODE_ALIAS: Record<string, string> = { UK: 'GB' }
const alias = (code: string) => CODE_ALIAS[code] ?? code

// 리서치 스냅샷 — region/region_ko/code + countries[](국가명 해석용).
export interface RegionResearchSnapshot {
  region?: string
  region_ko?: string
  code?: string
  schema_version?: string | null
  fetched_at?: string | null
  countries?: { code?: string; country?: string; country_ko?: string }[]
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
  for (const c of snapshot.countries ?? []) {
    const gb = alias(c.code ?? '')
    if (c.country_ko) koByCode[gb] = c.country_ko
    if (c.country) enByCode[gb] = c.country
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

  // ── 지도 멤버 — 소속국 코드 + 진출상태(운영중/준비중/미진출).
  const mapMembers = members.map((gb) => {
    const s = status[gb]
    return { code: gb, status: s === '운영중' || s === '준비중' ? s : '미진출' }
  })

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
    executive_summary: es as RegionExecutiveSummary,
  }
}
