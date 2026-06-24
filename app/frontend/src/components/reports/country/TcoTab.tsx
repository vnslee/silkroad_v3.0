// 탭3 TCO·구독료 — KPI 4 + 구축산식 + 계약건수산식 + 워터폴 + 누적추이 + 구독료구간 + 승수표 + 근거항목
import type { ReactNode } from 'react'
import type { CountryReportData, ReportItem } from '../types'
import { Panel, EvidenceCard, Donut, MiniTimeseries, intComma } from './shared'
import { Money, useFx } from '../Money'
import { krwCompact } from '../../../utils/currency'

const MULT_TABLE: { band: string; mult: number }[] = [
  { band: '90 ~ 100', mult: 50 },
  { band: '80 ~ 90', mult: 60 },
  { band: '70 ~ 80', mult: 70 },
  { band: '60 ~ 70', mult: 80 },
  { band: '50 ~ 60', mult: 90 },
  { band: '< 50', mult: 100 },
]

export function TcoTab({ data }: { data: CountryReportData }) {
  const tco = data.tabs.tab_1_3_tco
  const dec = data.tabs.tab_1_2_decision
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아' }
  const baseKo = baseKoMap[data.target.base_country] ?? data.target.base_country

  // 기준국(이미 시스템 배포)·TCO 미산정 보고서는 build_breakdown 등이 없어 산식 렌더 불가 → 안내 대체.
  const hasTco =
    dec.decision !== 'baseline_already_deployed' &&
    tco.build_months != null &&
    tco.build_breakdown != null &&
    tco.expected_contracts_breakdown != null
  if (!hasTco) {
    return (
      <Panel icon="payments" title="TCO · 구독료">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {data.country_meta.country_ko}은(는) 이미 시스템이 배포된 기준국이거나 TCO 산정 대상이 아니어서, 구축비용·구독료 산식이 제공되지 않습니다.
        </p>
      </Panel>
    )
  }

  const mult = Math.round((tco.similarity_multiplier ?? 0) * 100)
  const bd = tco.build_breakdown
  const bi = bd.inputs
  const ec = tco.expected_contracts_breakdown.inputs

  return (
    <div className="flex flex-col gap-xl">
      {/* KPI 4 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
        <Kpi label="총 10년 TCO" icon="payments" value={<Money value={tco.total_tco_10y} currency={tco.currency} />} />
        <Kpi label="예상 구축 기간" icon="schedule" value={`${tco.build_months.toFixed(1)}M`} />
        <Kpi label="예상 계약건수" icon="fact_check" value={`${intComma(tco.expected_contracts)} 건`} />
        <Kpi label="유사도 승수" icon="percent" value={`${mult}%`} sub={`구간 ${tco.similarity_band}`} />
      </div>

      {/* 구축비용·기간 산식 */}
      <Panel icon="build" title="구축비용·기간 산식">
        <div className="bg-surface-container p-md rounded-lg border-l-4 border-primary mb-md font-body-sm text-body-sm text-on-surface-variant">
          {bd.formula ?? '구축비용/기간 = 베이스라인(B) 값 × 유사도 승수'}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-sm">
          <FormulaCell label="베이스라인" big={baseKo} small={tco.build_breakdown.inputs['베이스라인 솔루션'] ?? data.tabs.tab_1_2_decision.base_system} />
          <FormulaCell label="B 구축비용" big={<Money value={bi['B 구축비용']} currency={bd.currency ?? tco.currency} />} small="internal.json" />
          <FormulaCell label="B 구축기간" big={`${bi['B 구축기간(개월)'] ?? bi['B 구축기간']}M`} small="internal.json" />
          <FormulaCell label="종합 유사도" big={tco.similarity_score.toFixed(1)} small="유사도 점수 결과" />
          <FormulaCell label="적용 승수" big={`${mult}%`} small={`구간 ${tco.similarity_band}`} />
          <FormulaCell label="신규국 산출" big={<Money value={tco.build_cost} currency={tco.currency} />} small={`${tco.build_months.toFixed(1)}M`} highlight />
        </div>
      </Panel>

      {/* 예상 계약건수 산식 */}
      <Panel icon="function" title="예상 계약건수 산식">
        <div className="bg-surface-container p-md rounded-lg border-l-4 border-primary mb-md font-body-sm text-body-sm text-on-surface-variant">
          {tco.expected_contracts_breakdown.formula ?? '신차 판매대수 × 금융이용률(신차) × (할부+리스 비중) × 우리사 예상 점유율'}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-sm">
          <FormulaCell label="신차 판매대수" big={intComma(ec['신차 판매대수'])} small="대 / 년" />
          <FormulaCell label="금융 이용률" big={`${ec['금융 이용률(신차)_%'] ?? 0}%`} small="신차 기준" />
          <FormulaCell label="할부·리스 비중" big={`${ec['구매 패턴(할부·리스 비중)_%'] ?? 0}%`} small="구매 패턴" />
          <FormulaCell label="우리사 점유율" big={`${((ec['우리사 예상 점유율'] ?? 0) * 100).toFixed(1)}%`} small="internal.json" />
          <FormulaCell label="예상 계약건수" big={`${intComma(tco.expected_contracts)} 건`} small="= 산식 결과" highlight />
        </div>
      </Panel>

      {/* 워터폴 + 누적추이 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-6">
          <Panel icon="stacked_bar_chart" title="10년 TCO 구성 분해 (워터폴)">
            <TcoWaterfall tco={tco} />
          </Panel>
        </div>
        <div className="lg:col-span-6">
          <Panel
            icon="trending_up"
            title="10년 누적 비용 추이"
            right={
              <div className="flex items-center gap-md">
                <span className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-sm" style={{ background: '#14181C' }} />
                  <span className="font-label-sm text-label-sm text-text-secondary">Y0 구축비</span>
                </span>
                <span className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-full" style={{ background: '#14181C' }} />
                  <span className="font-label-sm text-label-sm text-text-secondary">누적 총비용</span>
                </span>
              </div>
            }
          >
            <CumulativeChart tco={tco} />
            <div className="mt-md bg-surface-container/60 p-md rounded-lg border-l-4 border-primary">
              <div className="flex items-center gap-xs mb-xs">
                <span className="material-symbols-outlined text-primary text-[14px]">function</span>
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">산식</span>
              </div>
              <code className="block font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                누적(Y) = 구축비 + (연 구독료 + 연 유지보수 + 운영비 ÷ 10) × Y
              </code>
            </div>
          </Panel>
        </div>
      </div>

      {/* 구독료 구간 스텝차트 + 승수표 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-7">
          <Panel icon="stairs" title="구독료 구간 (전체 소급)">
            <StepChart tco={tco} />
            <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
              X=누적 계약건수, Y=건당 단가 · 누적 증가 시 자동 하향 (전 물량 소급)
            </p>
          </Panel>
        </div>
        <div className="lg:col-span-5">
          <Panel icon="percent" title="유사도 → TCO 승수">
            <p className="font-body-sm text-body-sm text-text-secondary mb-sm">
              탭1-1 종합 유사도 점수를 베이스라인 비용·기간에 적용할 승수로 환산합니다.
            </p>
            <table className="w-full">
              <thead>
                <tr className="text-text-secondary">
                  <th className="px-2 py-1 text-left font-label-sm text-label-sm uppercase">종합 유사도</th>
                  <th className="px-2 py-1 text-right font-label-sm text-label-sm uppercase">승수</th>
                </tr>
              </thead>
              <tbody>
                {MULT_TABLE.map((r) => {
                  const active = r.band === tco.similarity_band
                  return (
                    <tr key={r.band} className={active ? 'bg-primary/10' : ''}>
                      <td className={`px-2 py-1 border-b border-surface-container-highest font-body-sm text-body-sm ${active ? 'text-primary font-semibold' : ''}`}>{r.band}</td>
                      <td className={`px-2 py-1 border-b border-surface-container-highest text-right font-body-sm text-body-sm ${active ? 'text-primary font-semibold' : 'text-text-primary'}`}>{r.mult}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex flex-col gap-xs mt-md pt-sm border-t border-surface-container-highest font-body-sm text-body-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">현재 유사도</span>
                <span className="text-text-primary font-semibold">{tco.similarity_score.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">적용 구간</span>
                <span className="text-primary font-semibold">{tco.similarity_band}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">적용 승수</span>
                <span className="text-primary font-semibold">{mult}%</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* 계약 규모 산정 근거 항목 */}
      <Panel icon="table_chart" title="계약 규모 산정 근거 항목">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {tco.items.map((it, i) => (
            <ContractBasisCard key={i} item={it} />
          ))}
        </div>
      </Panel>
    </div>
  )
}

function Kpi({ label, icon, value, sub }: { label: string; icon: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow flex flex-col">
      <div className="flex items-center justify-between mb-sm">
        <span className="font-label-md text-label-md text-primary uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
      </div>
      <span className="font-display-lg text-display-lg text-primary leading-none">{value}</span>
      {sub && <span className="font-label-sm text-label-sm text-text-secondary mt-xs">{sub}</span>}
    </div>
  )
}

function FormulaCell({ label, big, small, highlight }: { label: string; big: ReactNode; small?: string; highlight?: boolean }) {
  return (
    <div className={`p-sm rounded-lg ${highlight ? 'bg-primary/10 border-2 border-primary' : 'bg-surface border border-surface-container-highest'}`}>
      <div className={`font-label-sm text-label-sm uppercase tracking-wider ${highlight ? 'text-primary' : 'text-text-secondary'}`}>{label}</div>
      <div className="font-headline-md text-headline-md text-primary">{big}</div>
      {small && <div className="font-label-sm text-label-sm text-text-secondary">{small}</div>}
    </div>
  )
}

// 원천 데이터(계약 규모): 도넛(%) 또는 미니 시계열 + 아코디언
function ContractBasisCard({ item }: { item: ReportItem }) {
  let chart: React.ReactNode = undefined
  const donutMap: Record<string, [string, string]> = {
    '금융 이용률(신차)': ['금융 이용', '현금'],
    '구매 패턴(할부·리스 비중)': ['할부·리스', '현금·기타'],
    '캡티브 강도(점유율)': ['캡티브 금융사', '그 외'],
  }
  if (typeof item.value === 'number' && donutMap[item.item]) {
    const [seg, rest] = donutMap[item.item]
    chart = (
      <>
        <Donut pct={item.value} segLabel={seg} restLabel={rest} />
        {item.timeseries && <MiniTimeseries ts={item.timeseries} />}
      </>
    )
  } else if (item.timeseries) {
    chart = <MiniTimeseries ts={item.timeseries} />
  }
  return <EvidenceCard item={item} chart={chart} />
}

// 워터폴: 구축비 / 유지비(10Y=구독+유보) / 시스템소계 / 운영비(10Y) / 총TCO
function TcoWaterfall({ tco }: { tco: CountryReportData['tabs']['tab_1_3_tco'] }) {
  const fx = useFx()
  const cur = tco.currency
  const W = 760
  const H = 320
  const top = 20
  const bottom = 280
  const recurring10 = tco.annual_recurring * 10
  const total = tco.total_tco_10y
  const max = total || 1
  const scale = (bottom - top) / max
  const barW = 98
  const gap = 140
  type Bar = { label: string; value: number; mode: 'add' | 'subtotal' | 'total'; color: string }
  const bars: Bar[] = [
    { label: '구축비', value: tco.build_cost, mode: 'add', color: '#4f8a6d' },
    { label: '유지비(10Y)', value: recurring10, mode: 'add', color: '#4f8a6d' },
    { label: '시스템 소계', value: tco.system_cost_10y, mode: 'subtotal', color: '#14181C' },
    { label: '운영비(10Y)', value: tco.operations_10y, mode: 'add', color: '#4f8a6d' },
    { label: '총 TCO', value: total, mode: 'total', color: '#14181C' },
  ]
  let cum = 0
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="10년 TCO 워터폴">
      <line x1="40" y1={bottom} x2="740" y2={bottom} stroke="#e6e3db" strokeWidth="1" />
      {bars.map((b, i) => {
        const x = 40 + i * gap
        const h = b.value * scale
        let y: number
        if (b.mode === 'add') {
          y = bottom - cum * scale - h
          cum += b.value
        } else if (b.mode === 'subtotal') {
          y = bottom - h
          // 소계 후 누적 리셋(소계값부터 다시 쌓임)
          cum = b.value
        } else {
          y = bottom - h
          cum = 0
        }
        const opacity = b.mode === 'add' ? 0.85 : 1
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 2)} fill={b.color} opacity={opacity} rx="3" />
            <text x={x + barW / 2} y={y - 6} fontSize="11" fill={b.color} fontWeight="700" textAnchor="middle">
              {b.mode === 'add' ? `+${krwCompact(b.value, cur, fx)}` : krwCompact(b.value, cur, fx)}
            </text>
            <text x={x + barW / 2} y="296" fontSize="11" fill="#3a4048" textAnchor="middle">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// 10년 누적 비용 추이(Y0~Y10)
function CumulativeChart({ tco }: { tco: CountryReportData['tabs']['tab_1_3_tco'] }) {
  const fx = useFx()
  const cur = tco.currency
  const W = 760
  const H = 320
  const left = 70
  const right = 740
  const top = 30
  const bottom = 280
  const annual = tco.annual_recurring + tco.operations_10y / 10
  const pts: { x: number; y: number; cum: number }[] = []
  const total = tco.total_tco_10y
  for (let y = 0; y <= 10; y++) {
    const cum = tco.build_cost + annual * y
    pts.push({ x: 0, y: 0, cum })
  }
  const max = total || 1
  const xStep = (right - left) / 10
  const scaleY = (v: number) => bottom - (v / max) * (bottom - top)
  const coords = pts.map((p, i) => ({ x: left + i * xStep, y: scaleY(p.cum) }))
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const areaPath = `M ${left} ${bottom} ${coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')} L ${right} ${bottom} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: top + (bottom - top) * f, v: max * (1 - f) }))
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="10년 누적 비용 추이">
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={left} y1={g.y} x2={right} y2={g.y} stroke="#e6e3db" />
          <text x={left - 6} y={g.y + 4} fontSize="10" fill="#9aa0a6" textAnchor="end">
            {krwCompact(g.v, cur, fx)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="#14181C" opacity="0.12" />
      <path d={linePath} fill="none" stroke="#14181C" strokeWidth="2.5" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="#14181C" />
      ))}
      <rect x={left - 7} y={coords[0].y} width="14" height={Math.max(bottom - coords[0].y, 4)} rx="3" fill="#14181C" />
      <text x={left} y={coords[0].y - 8} fontSize="11" fill="#14181C" fontWeight="700" textAnchor="middle">
        구축 {krwCompact(tco.build_cost, cur, fx)}
      </text>
      <text x={right - 6} y={20} fontSize="12" fill="#14181C" fontWeight="700" textAnchor="end">
        Y10 누적 {krwCompact(total, cur, fx)}
      </text>
      {coords.map((_, i) => (
        <text key={i} x={left + i * xStep} y="298" fontSize="10" fill="#9aa0a6" textAnchor="middle">
          Y{i}
        </text>
      ))}
    </svg>
  )
}

// 구독료 구간 스텝차트(누적건수→단가, 현재 위치 마커)
function StepChart({ tco }: { tco: CountryReportData['tabs']['tab_1_3_tco'] }) {
  const fx = useFx()
  const cur = tco.subscription_details.currency ?? tco.currency
  const W = 760
  const H = 260
  const left = 60
  const right = 740
  const top = 20
  const bottom = 220
  const tiers = tco.subscription_tiers
  const current = tco.subscription_details.total_volume ?? tco.existing_total_volume + tco.expected_contracts
  const appliedPrice = tco.subscription_details.unit_price
  // 구독료 미적용 국가(applicable=false) 또는 데이터 부재 → 차트 생략, 안내만 표시.
  if (appliedPrice == null || !tiers?.length) {
    return (
      <p className="font-body-sm text-body-sm text-text-secondary py-md">
        {tco.subscription_details.note ?? '이 국가는 구독료 구간이 적용되지 않습니다.'}
      </p>
    )
  }
  const maxPrice = Math.max(...tiers.map((t) => t.price_per_unit)) * 1.15
  const scaleY = (p: number) => bottom - (p / maxPrice) * (bottom - top)
  // X축: 로그 유사 — 구간 경계값 기준 비선형. mockup 처럼 경계점만 표기.
  const bounds = [0, ...tiers.filter((t) => t.max_volume != null).map((t) => t.max_volume as number)]
  const maxVol = Math.max(current * 1.05, bounds[bounds.length - 1] ? bounds[bounds.length - 1] * 6 : current * 2)
  const scaleX = (v: number) => left + (Math.log10(v + 1) / Math.log10(maxVol + 1)) * (right - left)
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: top + (bottom - top) * f, v: maxPrice * (1 - f) }))
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="구독료 구간 스텝차트">
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={left} y1={g.y} x2={right} y2={g.y} stroke="#e6e3db" />
          <text x={left - 6} y={g.y + 4} fontSize="10" fill="#9aa0a6" textAnchor="end">
            {krwCompact(g.v, cur, fx)}
          </text>
        </g>
      ))}
      {bounds.map((b, i) => (
        <text key={i} x={scaleX(b === 0 ? 0 : b + 1)} y={236} fontSize="10" fill="#9aa0a6" textAnchor="middle">
          {b === 0 ? '0' : (b + 1).toLocaleString('en-US')}
        </text>
      ))}
      {tiers.map((t, i) => {
        const x1 = scaleX(i === 0 ? 0 : t.min_volume + 1)
        const x2 = t.max_volume == null ? right : scaleX(t.max_volume)
        const y = scaleY(t.price_per_unit)
        return <line key={i} x1={x1} y1={y} x2={x2} y2={y} stroke="#14181C" strokeWidth="3" strokeLinecap="round" />
      })}
      {/* 현재 위치 마커 */}
      <line x1={scaleX(current)} y1={top} x2={scaleX(current)} y2={bottom} stroke="#4f8a6d" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx={scaleX(current)} cy={scaleY(appliedPrice)} r="6" fill="#4f8a6d" />
      <text x={scaleX(current) + 10} y={scaleY(appliedPrice) + 4} fontSize="12" fill="#4f8a6d" fontWeight="700">
        현재 {intComma(current)}건 → {krwCompact(appliedPrice, cur, fx)}
      </text>
    </svg>
  )
}
