// RegionDetail (P2) — 권역 상세 정보 화면.
// 디자인 참조: region_detail_rendering_engine.py 산출 HTML(DTL_<REGION>_NNN.html) 구조.
// 구성(스펙 §4 P2): KPI 3카드 → 기진출 국가 → (권역 지도 + 진출예정국 Quick-Win 순위) → 권역 인사이트.
// 데이터는 프론트에서 3-소스 병합(buildRegionDetail) — 표현만 담당(렌더링 엔진 미사용).
import { useEffect, useRef, useState } from 'react'
import type {
  RegionDetailData,
  RegionAssetReuse,
  RegionCandidateCountry,
  RegionEnteredCountry,
  RegionMemberTrend,
  RegionTrendMetric,
} from '../reports/types'
import { buildRegionMapGeometry } from './regionMapGeo'
import { Flag } from '../reports/region/shared'
import { useT, valueLabel } from '../../i18n/dict'
import { useLang, pickLang } from '../../i18n/locale'
import type { Lang } from '../../store'

interface Props {
  data: RegionDetailData
  className?: string
}

// 진출상태 → 지도 노드 색(채움/글자) + 범례 라벨 키. render_helpers _MAP_STATE와 동일.
// 키(운영중/준비중/미진출)는 데이터 status 매칭용이라 한국어 고정. labelKey는 화면 표시 라벨의 i18n 키(범례에서 t()로 변환).
const MAP_STATE: Record<string, { fill: string; fg: string; labelKey: string }> = {
  운영중: { fill: '#3f6cb4', fg: '#ffffff', labelKey: 'rdtl.map.state.active' },
  준비중: { fill: '#6e97d6', fg: '#101622', labelKey: 'rdtl.map.state.preparing' },
  미진출: { fill: '#eef0f2', fg: '#3b3f46', labelKey: 'rdtl.map.state.none' },
}

// 점수(0-100) → 신호색. render_helpers.score_color와 동일.
function scoreColor(v: number): string {
  return v >= 70 ? '#4f8a6d' : v >= 50 ? '#3f6cb4' : v >= 35 ? '#c08a2e' : '#c0533f'
}

// 법인종류(SA/JV) → 라벨·색. region_detail_rendering_engine _ENTITY_TYPE와 동일.
const ENTITY_TYPE: Record<string, { label: string; bg: string; fg: string }> = {
  SA: { label: '단독법인', bg: '#e9f3ee', fg: '#4f8a6d' },
  JV: { label: 'JV', bg: '#fbf0e6', fg: '#c08a2e' },
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded font-label-sm text-label-sm whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  )
}

export function RegionDetail({ data, className = '' }: Props) {
  const t = useT()
  const lang = useLang()
  const kpi = data.kpi ?? { candidates: 0, quickwin: 0, killswitch_failed: 0 }
  const entered = data.entered_countries ?? []
  const candidates = [...(data.candidate_countries ?? [])].sort(
    (a, b) => (a.quick_win_rank ?? 999) - (b.quick_win_rank ?? 999),
  )
  const members = data.map?.members ?? []
  const trends = data.trends ?? []
  const assetReuse = data.asset_reuse ?? []
  const es = data.executive_summary

  return (
    <div
      className={`flex items-start justify-center min-h-full w-full p-margin-mobile md:p-margin-desktop bg-background ${className}`}
    >
      <div className="w-full max-w-[min(92vw,1760px)] rounded-xl custom-shadow-level-3 flex flex-col border-surface-border bg-surface-container-lowest">
        <div className="p-lg flex flex-col gap-xl">
          {/* 제목(권역명)은 DetailView 헤더 chrome에 이미 노출 — 바디 중복 제거 */}
          {/* 권역 인사이트 — 최상단. 뉴스 제외, AI 교차 인사이트만 최대 5줄 */}
          <RegionInsight es={es} baseline={data.baseline_country} lang={lang} />

          {/* KPI 3카드 */}
          <div className="grid grid-cols-3 gap-sm">
            <KpiCard value={kpi.candidates} label={t('rdtl.kpi.candidates')} color="#3F6CB4" />
            <KpiCard value={kpi.quickwin} label={t('rdtl.kpi.quickwin')} color="#4F8A6D" />
            <KpiCard value={kpi.killswitch_failed} label={t('rdtl.kpi.killswitchFailed')} color="#14171C" />
          </div>

          {/* 기진출 국가 */}
          {entered.length > 0 && <EnteredList rows={entered} lang={lang} />}

          {/* 권역 지도(시장규모 버블·진출상태) + 시장 추세 매트릭스(A) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md items-stretch">
            <RegionMap code={data.code} members={members} links={assetReuse} />
            {trends.length > 0 ? (
              <MarketTrendPanel rows={trends} />
            ) : (
              candidates.length > 0 && <QuickwinTable rows={candidates} />
            )}
          </div>

          {/* 진출예정국 Quick-Win 순위 — 추세 패널이 지도 옆을 차지하면 전폭으로 내린다 */}
          {trends.length > 0 && candidates.length > 0 && <QuickwinTable rows={candidates} />}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-[14px] p-md text-center">
      <div className="font-mono text-[clamp(25.5px,calc(22.5px_+_0.833vw),34.5px)] font-bold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="font-body-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] text-[#6B7280] mt-1">{label}</div>
    </div>
  )
}

function EntityCell({ type, lang }: { type: string; lang: Lang }) {
  const e = ENTITY_TYPE[(type || '').toUpperCase()]
  if (!e) return <span className="text-on-surface-variant">—</span>
  // 법인종류 라벨도 언어별로(단독법인 → SA). 매핑 없으면 원본 유지.
  return <Badge text={valueLabel('entityMode', e.label, lang)} bg={e.bg} fg={e.fg} />
}

function ProductsCell({ products, lang }: { products: string[]; lang: Lang }) {
  if (!products?.length) return <span className="text-on-surface-variant">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {products.map((p, i) => (
        // 상품명도 언어별로(오토론 → Auto loan). 매핑 없으면 원본 유지.
        <Badge key={i} text={valueLabel('product', p, lang)} bg="#eaf0f8" fg="#2c4c86" />
      ))}
    </div>
  )
}

function EnteredList({ rows, lang }: { rows: RegionEnteredCountry[]; lang: Lang }) {
  const t = useT()
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">
      <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold mb-md">
        {t('rdtl.entered.title')}
      </h3>
      <table className="w-full text-left border-collapse font-body-sm text-body-sm">
        <thead>
          <tr className="bg-surface-light border-b border-surface-border">
            <Th>{t('rdtl.col.country')}</Th>
            <Th>{t('rdtl.entered.entityType')}</Th>
            <Th>{t('rdtl.entered.since')}</Th>
            <Th>{t('rdtl.entered.products')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
            >
              <td className="p-sm text-on-surface">
                <span className="flex items-center gap-xs">
                  <Flag code={r.code} />
                  <span>
                    {pickLang(lang, r.name_ko, r.name_en)}{' '}
                    <span className="font-mono text-xs text-on-surface-variant">{r.code}</span>
                  </span>
                </span>
              </td>
              <td className="p-sm">
                <EntityCell type={r.type} lang={lang} />
              </td>
              <td className="p-sm text-on-surface-variant">{r.since ?? '—'}</td>
              <td className="p-sm">
                <ProductsCell products={r.products} lang={lang} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 시계열 추세 패널(A) — 멤버국 × (시장규모·EV) 스파크라인. 보고서엔 없는 "추세" 관점.
// 단위·축이 국가마다 달라도 각 셀은 자기 시계열만 그리므로 정규화 불필요(상대 모양·CAGR만 본다).
function MarketTrendPanel({ rows }: { rows: RegionMemberTrend[] }) {
  const t = useT()
  const lang = useLang()
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
      <div className="flex items-center gap-sm mb-md">
        <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold flex-1">
          {t('rdtl.trend.title')}
        </h3>
        <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full whitespace-nowrap">
          {t('rdtl.trend.tag')}
        </span>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse font-body-sm text-body-sm">
          <thead>
            <tr className="bg-surface-light border-b border-surface-border">
              <Th>{t('rdtl.col.country')}</Th>
              <Th>{t('rdtl.trend.marketSize')}</Th>
              <Th>{t('rdtl.trend.evRate')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.code}
                className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
              >
                <td className="p-sm text-on-surface whitespace-nowrap">
                  {pickLang(lang, r.name_ko, r.name_en)}{' '}
                  <span className="font-mono text-xs text-on-surface-variant">{r.code}</span>
                </td>
                <td className="p-sm">
                  <TrendCell metric={r.market} />
                </td>
                <td className="p-sm">
                  <TrendCell metric={r.ev} pct />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-label-sm text-label-sm text-outline mt-md pt-md border-t border-surface-border m-0">
        {t('rdtl.trend.note')}
      </p>
    </div>
  )
}

// 추세 셀 — 스파크라인 + 최신값 + CAGR 배지. metric 없으면 "—".
function TrendCell({ metric, pct = false }: { metric: RegionTrendMetric | null; pct?: boolean }) {
  if (!metric) return <span className="text-on-surface-variant">—</span>
  const c = metric.cagr
  // 방향 고려: direction 'down'이면 하락이 긍정. 표시는 순수 증감 부호 기준 색.
  const up = c != null && c >= 0
  const cagrColor = c == null ? '#6B7280' : up ? '#4f8a6d' : '#c0533f'
  const latest = pct
    ? `${Math.round(metric.latest * 10) / 10}%`
    : fmtCompact(metric.latest, metric.unit)
  return (
    <div className="flex items-center gap-sm">
      <Sparkline history={metric.history} forecast={metric.forecast} />
      <div className="flex flex-col leading-tight">
        <span className="font-label-md text-label-md text-on-surface font-semibold whitespace-nowrap">
          {latest}
        </span>
        {c != null && (
          <span className="font-label-sm text-label-sm whitespace-nowrap" style={{ color: cagrColor }}>
            {up ? '▲' : '▼'} {Math.abs(c)}%
          </span>
        )}
      </div>
    </div>
  )
}

// 순수 SVG 스파크라인 — history(실선)+forecast(점선)를 같은 y스케일로. 라이브러리 미사용(지도와 동일 패턴).
function Sparkline({
  history,
  forecast,
}: {
  history: { year: number; value: number }[]
  forecast: { year: number; value: number }[]
}) {
  const W = 76
  const H = 26
  const pad = 2
  const all = [...history, ...forecast]
  if (all.length < 2) return <span className="text-on-surface-variant">—</span>
  const xs = all.map((p) => p.year)
  const ys = all.map((p) => p.value)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const px = (x: number) => pad + ((x - xMin) / xSpan) * (W - pad * 2)
  const py = (y: number) => H - pad - ((y - yMin) / ySpan) * (H - pad * 2)
  const toPath = (pts: { year: number; value: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.year).toFixed(1)},${py(p.value).toFixed(1)}`).join(' ')
  const histPath = toPath(history)
  // forecast 실선과 끊김 없이: history 마지막 점에서 이어 그린다.
  const fcPath = forecast.length
    ? toPath([history[history.length - 1], ...forecast])
    : ''
  const last = history[history.length - 1]
  const col = '#3f6cb4'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden="true">
      {fcPath && (
        <path d={fcPath} fill="none" stroke={col} strokeWidth="1.2" strokeDasharray="2.5 2" opacity="0.55" />
      )}
      <path d={histPath} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(last.year)} cy={py(last.value)} r="1.8" fill={col} />
    </svg>
  )
}

// 큰 수 축약 표시(시장규모 등). 단위 접두 통화코드만 떼어 함께 표기.
function fmtCompact(v: number, unit: string): string {
  const ccy = (unit.match(/^([A-Z]{3})/)?.[1] ?? '').trim()
  const billion = /billion/i.test(unit)
  // _M(백만) 단위 값이면 1000 이상은 'b'(십억)로 축약, 아니면 그대로.
  let n = v
  let suffix = ''
  if (billion) {
    suffix = 'b'
  } else if (Math.abs(v) >= 1000) {
    n = v / 1000
    suffix = 'b'
  } else {
    suffix = 'm'
  }
  const num = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return `${ccy ? ccy + ' ' : ''}${num}${suffix}`
}

function RegionMap({
  code,
  members,
  links = [],
}: {
  code: string
  members: RegionDetailData['map']['members']
  links?: RegionAssetReuse[]
}) {
  // 실제 국경(world-atlas 50m)을 권역 멤버 bbox 에 fit 해 클로즈업. 진출상태별 채움.
  // atlas 매칭 0건(미등록 권역)이면 안내 폴백.
  // 지도 영역의 실제 크기를 ResizeObserver 로 측정해 그 비율로 projection 을 fit —
  // 패널이 넓든 좁든 letterbox 여백 없이 지도가 영역을 꽉 채운다.
  const t = useT()
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 380 })
  // 연결선(기진출→후보) 토글 — 자산 재사용 매핑이 있을 때만 노출.
  const hasLinks = links.length > 0
  const [showLinks, setShowLinks] = useState(false)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      if (w > 0 && h > 0) setSize((p) => (p.w === w && p.h === h ? p : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = buildRegionMapGeometry(members, size.w, size.h)
  const statusByCode = Object.fromEntries(members.map((m) => [m.code, m.status]))
  // 시장규모(KRW bn) 버블 — 보유 멤버만. 반지름 ∝ √값(면적 비례), 짧은 변 기준 스케일.
  const krwByCode = Object.fromEntries(
    members.map((m) => [m.code, m.market_krw_bn ?? null]),
  ) as Record<string, number | null>
  const krwVals = members
    .map((m) => m.market_krw_bn)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const krwMax = krwVals.length ? Math.max(...krwVals) : 0
  // 라벨 중심 좌표(연결선·버블 기준) — geo.shapes에서 코드별로.
  const centerByCode: Record<string, [number, number]> = {}
  if (geo) for (const s of geo.shapes) centerByCode[s.code] = s.label
  const shortSide = geo ? Math.min(geo.width, geo.height) : 0

  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
      <div className="flex items-center gap-sm mb-md">
        <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold flex-1">
          {t('rdtl.map.title')}
        </h3>
        {hasLinks && (
          <button
            type="button"
            onClick={() => setShowLinks((v) => !v)}
            aria-pressed={showLinks}
            className="font-label-sm text-label-sm px-2 py-0.5 rounded-full border border-surface-border whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            style={
              showLinks
                ? { background: '#3f6cb4', color: '#ffffff', borderColor: '#3f6cb4' }
                : { color: '#3b3f46' }
            }
          >
            {t('rdtl.map.assetLink')} {showLinks ? t('rdtl.map.hide') : t('rdtl.map.show')}
          </button>
        )}
      </div>
      <div ref={areaRef} className="flex-1 flex items-stretch justify-center min-h-[460px]">
        {geo ? (
          <svg
            viewBox={geo.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            role="img"
            aria-label={t('rdtl.mapAria').replace('{code}', code)}
          >
            {geo.shapes.map((s) => {
              const st = MAP_STATE[statusByCode[s.code]] ?? MAP_STATE['미진출']
              return (
                <path
                  key={`p-${s.code}`}
                  d={s.d}
                  fill={st.fill}
                  // 흰 테두리는 미진출국(거의 흰 fill) 위에서 경계가 사라져 보임 → 중립 회색 경계.
                  stroke="#9aa0a6"
                  strokeWidth="0.7"
                  strokeOpacity="0.7"
                  strokeLinejoin="round"
                />
              )
            })}
            {/* 시장규모 버블 — 색칠 위, 라벨 아래. 보유국만. */}
            {krwMax > 0 &&
              geo.shapes.map((s) => {
                const v = krwByCode[s.code]
                if (typeof v !== 'number' || v <= 0) return null
                // 반지름: 면적 비례(√), 짧은 변의 3%~12% 범위.
                const r = (0.03 + 0.09 * Math.sqrt(v / krwMax)) * shortSide
                return (
                  <circle
                    key={`b-${s.code}`}
                    cx={s.label[0]}
                    cy={s.label[1]}
                    r={r}
                    fill="#14171c"
                    fillOpacity="0.14"
                    stroke="#14171c"
                    strokeOpacity="0.25"
                    strokeWidth="0.4"
                  />
                )
              })}
            {/* 기진출 → 후보 연결선(토글) — 자산 재사용 매핑 기반. */}
            {showLinks &&
              links.flatMap((l) => {
                const from = centerByCode[l.from_code]
                if (!from) return []
                return l.matches.map((m) => {
                  const to = centerByCode[m.code]
                  if (!to) return null
                  // 살짝 휜 2차 베지어로 겹침 완화.
                  const mx = (from[0] + to[0]) / 2
                  const my = (from[1] + to[1]) / 2 - shortSide * 0.06
                  return (
                    <path
                      key={`l-${l.from_code}-${m.code}`}
                      d={`M${from[0]},${from[1]} Q${mx},${my} ${to[0]},${to[1]}`}
                      fill="none"
                      stroke="#c08a2e"
                      strokeWidth={shortSide * 0.006}
                      strokeOpacity="0.8"
                      strokeLinecap="round"
                    />
                  )
                })
              })}
            {geo.shapes.map((s) => {
              const st = MAP_STATE[statusByCode[s.code]] ?? MAP_STATE['미진출']
              // 라벨 폰트는 viewBox(=패널 실측) 좌표계 기준 — 짧은 변에 비례시켜 패널 크기와 무관하게 일정한 화면 크기로 보이게 한다.
              const fs = Math.max(9, Math.min(18, shortSide * 0.042))
              return (
                <text
                  key={`t-${s.code}`}
                  x={s.label[0]}
                  y={s.label[1] + fs * 0.34}
                  textAnchor="middle"
                  fontSize={fs}
                  fontWeight="700"
                  fill={st.fg}
                  paintOrder="stroke"
                  // 외곽선은 글자색 대비로 — 흰 글자(운영중)엔 어두운 외곽선, 어두운 글자(미진출)엔 옅은 흰 외곽선.
                  stroke={st.fg === '#ffffff' ? 'rgba(20,23,28,0.45)' : 'rgba(255,255,255,0.9)'}
                  strokeWidth={fs * 0.16}
                >
                  {s.code}
                </text>
              )
            })}
          </svg>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
            {t('rdtl.map.noData')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-md mt-md pt-md border-t border-surface-border">
        {Object.values(MAP_STATE).map((s) => (
          <span
            key={s.labelKey}
            className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant"
          >
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.fill }} />
            {t(s.labelKey)}
          </span>
        ))}
        {krwMax > 0 && (
          <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: 'rgba(20,23,28,0.14)', border: '1px solid rgba(20,23,28,0.25)' }}
            />
            {t('rdtl.map.bubbleLegend')}
          </span>
        )}
      </div>
    </div>
  )
}

function QuickwinTable({ rows }: { rows: RegionCandidateCountry[] }) {
  const t = useT()
  const lang = useLang()
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
      <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold mb-md">
        {t('rdtl.quickwin.title')}
      </h3>
      <table className="w-full text-left border-collapse font-body-sm text-body-sm">
        <thead>
          <tr className="bg-surface-light border-b border-surface-border">
            <Th>#</Th>
            <Th>{t('rdtl.col.country')}</Th>
            <Th align="center">{t('rdtl.quickwin.score')}</Th>
            <Th>{t('rdtl.quickwin.verdict')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = r.composite_score ?? 0
            const col = scoreColor(v)
            return (
              <tr
                key={r.code}
                className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
              >
                <td className="p-sm font-label-md text-label-md text-primary font-bold">
                  {r.quick_win_rank ?? '—'}
                </td>
                <td className="p-sm text-on-surface whitespace-nowrap">
                  <span className="flex items-center gap-xs">
                    <Flag code={r.code} />
                    <span>
                      {pickLang(lang, r.name_ko, r.name_en)}{' '}
                      <span className="font-mono text-xs text-on-surface-variant">{r.code}</span>
                    </span>
                  </span>
                </td>
                <td className="p-sm text-center">
                  <div className="inline-flex flex-col items-center gap-1 w-[96px]">
                    <span
                      className="font-label-md text-label-md font-semibold leading-none"
                      style={{ color: col }}
                    >
                      {Math.round(v * 10) / 10}
                    </span>
                    <div className="w-full h-base bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: col }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-sm">
                  <Badge
                    text={r.quick_win ? t('rdtl.quickwin.badge') : valueLabel('quadrant', r.quadrant, lang) || '-'}
                    bg={r.quick_win ? '#e9f3ee' : '#eef0f2'}
                    fg={r.quick_win ? '#4f8a6d' : '#3b3f46'}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RegionInsight({
  es,
  baseline,
  lang,
}: {
  es: RegionDetailData['executive_summary']
  baseline?: string
  lang: Lang
}) {
  const t = useT()
  // 기준국(top1·why_top1) 얘기는 제외 — AI 교차 인사이트만 본문으로.
  // 보고서 SummaryTab과 동일하게 기준국 언급 항목('기준국'·'baseline'·'(코드)')도 제외.
  const crossAll = (es?.ai_cross_insight?.insights ?? []).filter((i) => {
    const text = pickLang(lang, i.ko, i.en) || i.ko || i.en || ''
    if (!text) return false
    if (/기준국|baseline/i.test(text)) return false
    if (baseline && text.includes(`(${baseline})`)) return false
    return true
  })
  // 인사이트는 5줄 이내로 — 교차 인사이트 상위 5건만. 각 줄은 1행으로 클램프(line-clamp-1).
  // 잘린 항목은 "+N건(보고서)"으로 표기. 뉴스는 노출하지 않는다(인사이트 정보만).
  const cross = crossAll.slice(0, 5)
  const hiddenCount = crossAll.length - cross.length
  if (cross.length === 0) return null
  // 권역 보고서 요약 탭(region/SummaryTab)과 동일한 다크 히어로 카드 —
  // 잉크블랙 그라디언트 + 라임그린(#C8F051) 강조 + AI 스파클 아이콘(ai_icon.png, 배경 투명).
  return (
    <div
      className="rounded-[18px] px-[30px] py-[28px] custom-shadow-level-3 text-white"
      style={{ background: 'linear-gradient(120deg,#14181C,#1f262d)' }}
    >
      <div className="flex items-center gap-sm mb-sm">
        <div
          className="font-label-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] flex-1"
          style={{ color: '#C8F051', letterSpacing: '.1em' }}
        >
          {t('rdtl.insight.eyebrow')}
        </div>
        {hiddenCount > 0 && (
          <span className="font-label-sm text-label-sm whitespace-nowrap" style={{ color: 'rgba(255,255,255,.55)' }}>
            {t('rdtl.insight.hidden').replace('{n}', String(hiddenCount))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-sm mb-md">
        <img
          src={`${import.meta.env.BASE_URL}brand/ai_icon.png`}
          alt=""
          aria-hidden="true"
          className="w-6 h-6 shrink-0 object-contain"
        />
        <h3 className="text-[clamp(18.7px,calc(16.5px_+_0.611vw),25.3px)] font-bold leading-none text-white m-0">
          {t('rdtl.insight.title')}
        </h3>
      </div>
      <ul className="flex flex-col gap-sm [&_strong]:text-white list-none p-0 m-0">
        {cross.map((i, idx) => {
          const txt = (pickLang(lang, i.ko, i.en) || i.ko || i.en || '').trim()
          return (
            <li
              key={idx}
              className="flex items-start gap-sm font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0"
              style={{ color: 'rgba(255,255,255,.9)' }}
              title={txt}
            >
              <span aria-hidden="true" className="shrink-0 select-none leading-[1.6]" style={{ color: '#C8F051' }}>•</span>
              <span className="min-w-0 line-clamp-1">{txt}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  const cls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  return (
    <th className={`p-sm font-label-md text-label-md text-outline font-semibold ${cls}`}>
      {children}
    </th>
  )
}
