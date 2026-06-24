// IT/순위 탭 — IT 유사도 히트맵 / 퀵윈 종합순위 / 산점도 / 상위 3개국 프로파일 /
// 국가별 IT 유사도 산식 / 국가별 퀵윈 산식.
import type { RegionReportData, RegionITCountry, RegionQuickwinRow, RegionTop3Card } from '../types'
import { countryKo, dash, Flag, itBandStyle, quickwinBandColor, SourcePill } from './shared'
import { ScatterChart, type ScatterPoint } from './ScatterChart'

export function ITTab({ data }: { data: RegionReportData }) {
  const it = data.tabs.tab_2_2_it_similarity
  const qw = data.tabs.quickwin
  const cards = data.tabs.top3_country_cards
  const baselineName = countryKo(it.baseline_country, it.baseline_country)
  const axisOrder = Object.keys(it.weights)

  // 히트맵 행 정렬: 후보(밴드 내림차순) → 기준국 하단.
  const candidates = it.countries.filter((c) => !c.is_baseline).sort((a, b) => b.it_similarity_raw - a.it_similarity_raw)
  const baselineRow = it.countries.find((c) => c.is_baseline)

  const points: ScatterPoint[] = qw.rows.map((r) => ({
    country: r.country,
    attractiveness: r.attractiveness,
    it_similarity: r.it_similarity,
    is_baseline: r.is_baseline,
  }))

  // 퀵윈 종합순위(기준국·탈락 제외)
  const qwRanking = qw.ranking

  return (
    <section className="flex flex-col gap-xl">
      {/* 히트맵 */}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center justify-between gap-sm mb-md border-b border-surface-border pb-sm flex-wrap">
          <div className="flex items-center gap-sm">
            <h2 className="font-headline-md text-headline-md text-primary m-0">IT 유사도 히트맵</h2>
            <span className="text-label-sm text-text-secondary">vs 기준국 {it.countries.find((c) => c.is_baseline)?.country_name ?? it.baseline_country}</span>
            <SourcePill flag="CALC" suffix="· 10점 구간" />
          </div>
          <BandLegend />
        </div>
        <Heatmap axisOrder={axisOrder} candidates={candidates} baselineRow={baselineRow} />
        <p className="mt-md text-label-sm text-text-secondary">
          정렬: 종합 점수 내림차순 · 기준국은 비교용으로 하단 표시. 셀 호버 시 raw 값 확인.
        </p>
      </div>

      {/* 퀵윈 종합순위 + 산점도 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">퀵윈 종합 순위</h2>
              <SourcePill flag="CALC" />
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-surface-border">
                  <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">순위</th>
                  <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">국가</th>
                  <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">퀵윈</th>
                  <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">매력도</th>
                  <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">IT</th>
                </tr>
              </thead>
              <tbody className="font-body-sm">
                {qwRanking.map((r) => (
                  <tr key={r.country} className="border-b border-surface-border">
                    <td className="py-sm px-sm font-medium text-primary">#{r.rank}</td>
                    <td className="py-sm px-sm">
                      <span className="inline-flex items-center gap-xs">
                        <Flag code={r.country} />
                        {countryKo(r.country)} <span className="text-text-secondary">({r.country})</span>
                      </span>
                    </td>
                    <td className="py-sm px-sm font-semibold" style={{ color: quickwinBandColor(r.score_band) }}>
                      {r.score_band}
                    </td>
                    <td className="py-sm px-sm text-text-secondary">{r.attractiveness}</td>
                    <td className="py-sm px-sm text-text-secondary">{r.it_similarity_band}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-sm text-label-sm text-text-secondary">{qw.note.ko}</p>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">매력도 × IT 유사도</h2>
              <SourcePill flag="CALC" suffix="· 2축" />
            </div>
            <ScatterChart points={points} />
          </div>
        </div>
      </div>

      {/* 상위 3개국 프로파일 */}
      <div>
        <div className="flex items-center gap-sm mb-md flex-wrap">
          <h2 className="font-headline-md text-headline-md text-primary m-0">상위 3개국 프로파일</h2>
          <SourcePill flag="CALC" />
          <SourcePill flag="EXT" />
          <SourcePill flag="NEWS" />
          <SourcePill flag="AI" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {cards.map((card) => (
            <Top3ProfileCard key={card.country} card={card} />
          ))}
        </div>
      </div>

      {/* 국가별 IT 유사도 산식 */}
      <div>
        <h3 className="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm">국가별 IT 유사도 산식</h3>
        <div className="flex flex-col gap-sm">
          {orderedForFormula(it.countries).map((c) => (
            <ITFormula key={c.country} country={c} axisOrder={axisOrder} baselineName={baselineName} />
          ))}
        </div>
      </div>

      {/* 국가별 퀵윈 산식 */}
      <div>
        <h3 className="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm">국가별 퀵윈 점수 산식</h3>
        <div className="flex flex-col gap-sm">
          {[...qw.rows]
            .sort((a, b) => a.country.localeCompare(b.country))
            .map((row) => (
              <QuickwinFormula key={row.country} row={row} weights={qw.weights} />
            ))}
        </div>
      </div>
    </section>
  )
}

// IT 산식: mockup은 기준국 먼저(raw 내림차순). 후보를 band 내림차순, 기준국은 맨 앞.
function orderedForFormula(countries: RegionITCountry[]): RegionITCountry[] {
  const base = countries.filter((c) => c.is_baseline)
  const rest = countries.filter((c) => !c.is_baseline).sort((a, b) => b.it_similarity_raw - a.it_similarity_raw)
  return [...base, ...rest]
}

function BandLegend() {
  const bands = [
    { l: '≥90', bg: '#2f5c46', fg: '#FFFFFF' },
    { l: '80', bg: '#4f8a6d', fg: '#FFFFFF' },
    { l: '70', bg: '#6fa98c', fg: '#FFFFFF' },
    { l: '60', bg: '#c7e2d3', fg: '#2f5c46' },
    { l: '50', bg: '#fbf3e2', fg: '#8a6a1e' },
    { l: '40', bg: '#c08a2e', fg: '#FFFFFF' },
    { l: '<40', bg: '#c0533f', fg: '#FFFFFF' },
  ]
  return (
    <div className="flex items-center gap-xs flex-wrap">
      <span className="text-label-sm text-text-secondary mr-xs">밴드</span>
      {bands.map((b) => (
        <div key={b.l} className="rounded px-2 py-[2px] text-label-sm font-semibold" style={{ background: b.bg, color: b.fg }}>
          {b.l}
        </div>
      ))}
    </div>
  )
}

function Heatmap({
  axisOrder,
  candidates,
  baselineRow,
}: {
  axisOrder: string[]
  candidates: RegionITCountry[]
  baselineRow?: RegionITCountry
}) {
  const gridCols = `minmax(180px, 1.4fr) repeat(${axisOrder.length}, minmax(80px, 1fr)) minmax(72px, 0.9fr)`
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* header */}
        <div className="grid items-end gap-[2px] mb-xs" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-sm py-xs text-label-sm text-text-secondary uppercase tracking-wider">국가</div>
          {axisOrder.map((a) => (
            <div key={a} className="px-xs py-xs text-label-sm text-text-secondary text-center whitespace-normal leading-tight">
              {a}
            </div>
          ))}
          <div className="px-xs py-xs text-label-sm text-text-secondary text-center uppercase tracking-wider">종합</div>
        </div>
        {candidates.map((c) => (
          <HeatRow key={c.country} country={c} axisOrder={axisOrder} gridCols={gridCols} />
        ))}
        {baselineRow && <HeatRow country={baselineRow} axisOrder={axisOrder} gridCols={gridCols} isBaseline />}
      </div>
    </div>
  )
}

function HeatRow({
  country,
  axisOrder,
  gridCols,
  isBaseline = false,
}: {
  country: RegionITCountry
  axisOrder: string[]
  gridCols: string
  isBaseline?: boolean
}) {
  const overall = itBandStyle(country.it_similarity_band)
  return (
    <div
      className={`grid items-stretch rounded-md hover:bg-surface-light transition-colors ${
        isBaseline ? 'bg-surface-light/60 border-t-2 border-dashed border-surface-border mt-xs pt-xs' : ''
      }`}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className={`px-sm py-sm flex items-center gap-xs ${isBaseline ? 'opacity-70' : ''}`}>
        <Flag code={country.country} />
        <span className="font-label-md text-label-md text-primary truncate">{countryKo(country.country, country.country_name)}</span>
        <span className="text-label-sm text-text-secondary truncate">{country.country_name}</span>
        {isBaseline && (
          <span className="text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold ml-xs px-[6px] py-[1px] rounded-full" style={{ background: '#e3edff', color: '#2f6be0' }}>
            기준
          </span>
        )}
      </div>
      {axisOrder.map((axis) => {
        const cell = country.axes[axis]
        const band = cell?.score_band ?? 0
        const st = itBandStyle(band)
        return (
          <div
            key={axis}
            className="m-[2px] rounded-md flex items-center justify-center font-semibold py-sm text-body-sm transition-transform hover:scale-105"
            style={{ background: st.bg, color: st.fg, minHeight: '42px' }}
            title={cell ? `${axis}: ${cell.target_value} (raw ${cell.score_raw})` : axis}
          >
            {band}
          </div>
        )
      })}
      <div
        className="m-[2px] rounded-md flex items-center justify-center font-bold py-sm text-body-md"
        style={{ background: overall.bg, color: overall.fg, minHeight: '42px' }}
        title={`raw ${country.it_similarity_raw}`}
      >
        {country.it_similarity_band}
      </div>
    </div>
  )
}

// ── 상위 3개국 프로파일 카드 ──────────────────────────────────────────────
function Top3ProfileCard({ card }: { card: RegionTop3Card }) {
  const band = card.quickwin_score_band
  const brief = card.market_brief
  const top5 = card.competition_brief.금융사_Top5 ?? []
  const entryForm = card.competition_brief.경쟁사_진출_형태
  // market_brief 키(한글) → 라벨 매핑
  const briefRows: { label: string; value: string }[] = []
  if (brief['신차_판매대수'] != null) briefRows.push({ label: '신차 판매', value: String(brief['신차_판매대수']) })
  if (brief['금융_이용률_신차'] != null) briefRows.push({ label: '금융 이용', value: `${brief['금융_이용률_신차']}%` })
  if (brief['EV_보급률'] != null) briefRows.push({ label: 'EV 보급', value: `${brief['EV_보급률']}%` })

  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-sm">
        <div className="flex items-center gap-sm">
          <span className="text-2xl font-bold text-primary">#{card.rank}</span>
          <div>
            <div className="font-label-sm text-label-sm text-text-secondary uppercase">Rank #{card.rank}</div>
            <div className="flex items-center gap-xs mt-[2px]">
              <Flag code={card.country} className="w-6 h-4" />
              <h3 className="font-headline-md text-headline-md text-primary m-0">{countryKo(card.country, card.country_name)}</h3>
              <span className="text-text-secondary">({card.country_name})</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="font-label-sm text-label-sm text-text-secondary uppercase">퀵윈</span>
          <div className="text-2xl font-bold" style={{ color: quickwinBandColor(band) }}>
            {band}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-xs mb-sm">
        <div className="bg-surface-light rounded-md p-xs text-center">
          <span className="font-label-sm text-label-sm text-text-secondary">매력도</span>
          <div className="font-semibold text-primary">{card.attractiveness}</div>
        </div>
        <div className="bg-surface-light rounded-md p-xs text-center">
          <span className="font-label-sm text-label-sm text-text-secondary">IT 유사도</span>
          <div className="font-semibold text-primary">{card.it_similarity_band}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm mb-xs">
        <span className="text-text-secondary">킬스위치</span>
        <span
          className="px-2 py-[2px] rounded-md font-label-sm text-label-sm"
          style={card.killswitch_pass ? { background: '#e9f3ee', color: '#4f8a6d' } : { background: '#f7e4e0', color: '#c0533f' }}
        >
          {card.killswitch_pass ? '통과' : '탈락'}
        </span>
      </div>

      <div className="flex flex-col">
        {briefRows.map((r) => (
          <div key={r.label} className="flex items-start gap-xs py-xs border-b border-surface-border min-w-0">
            <span className="font-label-sm text-label-sm text-text-secondary w-20 shrink-0 mt-xs">{r.label}</span>
            <span className="flex-1 min-w-0 text-body-sm text-on-surface-variant break-words" style={{ overflowWrap: 'anywhere' }}>
              {r.value}
            </span>
            <span className="shrink-0 mt-xs">
              <SourcePill flag="EXT" />
            </span>
          </div>
        ))}
        {(top5.length > 0 || entryForm) && (
          <div className="py-xs border-b border-surface-border min-w-0">
            <div className="flex items-center gap-xs mb-xs">
              <span className="font-label-sm text-label-sm text-text-secondary">경쟁사 진출</span>
              <SourcePill flag="EXT" />
            </div>
            {top5.length > 0 && (
              <div className="mb-xs">
                <div className="font-label-sm text-label-sm text-primary mb-[2px]">금융사 Top 5</div>
                <div className="flex flex-wrap -m-[2px]">
                  {top5.map((f) => (
                    <span
                      key={f.rank}
                      className="inline-block px-2 py-[1px] bg-surface-container text-on-surface-variant rounded-full text-[clamp(9.35px,calc(8.25px_+_0.306vw),12.65px)] m-[2px]"
                      title={f.market_share}
                    >
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entryForm && <div className="text-body-sm text-on-surface-variant mb-xs">{entryForm}</div>}
          </div>
        )}
      </div>

      {card.top_news && (
        <div className="mt-sm bg-surface-light border border-surface-border rounded-md p-sm">
          <div className="flex items-center justify-between mb-xs">
            <span className="font-label-sm text-label-sm text-text-secondary uppercase">핵심 이슈</span>
            <SourcePill flag="NEWS" />
          </div>
          <div className="font-label-md text-label-md text-primary mb-xs">{card.top_news.headline}</div>
          <div className="text-body-sm text-on-surface-variant">{card.top_news.so_what}</div>
          {card.top_news.publisher && <div className="text-label-sm text-text-secondary mt-xs">{card.top_news.publisher}</div>}
        </div>
      )}

      {card.ai_comment && (
        <div className="mt-sm bg-[#e3edff]/40 border border-[#e3edff] rounded-md p-sm">
          <div className="flex items-center gap-xs mb-xs">
            <span className="material-symbols-outlined text-[clamp(13.6px,calc(12px_+_0.444vw),18.4px)]" style={{ color: '#2f6be0' }}>
              psychology
            </span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider">AI 코멘트</span>
            <SourcePill flag="AI" />
          </div>
          <div className="text-body-sm text-on-surface-variant">{card.ai_comment}</div>
        </div>
      )}
    </div>
  )
}

// ── 국가별 IT 유사도 산식 ─────────────────────────────────────────────────
function ITFormula({ country, axisOrder, baselineName }: { country: RegionITCountry; axisOrder: string[]; baselineName: string }) {
  const band = country.it_similarity_band
  const bandColor = band >= 80 ? '#4f8a6d' : band >= 60 ? '#2f6be0' : '#c08a2e'
  return (
    <details className="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
      <summary className="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
        <span className="material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
        <Flag code={country.country} />
        <span className="font-label-md text-label-md text-primary">
          {countryKo(country.country, country.country_name)} <span className="text-text-secondary font-normal">({country.country_name})</span>
          {country.is_baseline && <span className="text-label-sm text-secondary ml-xs">기준</span>}
        </span>
        <span className="text-2xl font-bold ml-xs" style={{ color: bandColor }}>
          {band}
        </span>
        <span className="text-label-sm text-text-secondary flex-1">/100 (raw {country.it_similarity_raw})</span>
        <span className="font-label-sm text-label-sm text-secondary">산식 보기</span>
      </summary>
      <div className="px-md pb-md pt-xs">
        <div className="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant">
          축별 raw 점수 = (수치 1~5) 100−|Δ|×20 / (범주·라이선스/솔루션) 텍스트 토큰 Jaccard 유사도 30+J×65 (완전 일치=100) / (gate)
          동일=90·한쪽 PASS=50·기타=30. 유효가중치 = 항목 가중치 × Tier 멀티플라이어(대상국 데이터 신뢰도 기준, Tier1=1.0 고정). 종합 =
          Σ(raw × 유효가중치) ÷ Σ(유효가중치) → 10점 구간 반올림.
        </div>
        {axisOrder.map((axis) => {
          const a = country.axes[axis]
          if (!a) return null
          const axisBandColor = a.score_band >= 80 ? '#4f8a6d' : a.score_band >= 60 ? '#2f6be0' : a.score_band >= 40 ? '#c08a2e' : '#c0533f'
          return (
            <div key={axis} className="border-b border-surface-border last:border-b-0 py-sm">
              <div className="flex items-start justify-between gap-sm mb-xs">
                <div className="flex-1">
                  <div className="flex items-center gap-xs flex-wrap">
                    <span className="font-label-md text-label-md text-primary">{axis}</span>
                    <span className="px-[6px] py-[1px] rounded text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold" style={{ background: '#eef0f2', color: '#3a4048' }}>
                      Tier {a.tier} ×{a.tier_multiplier}
                    </span>
                    <SourcePill flag="EXT" />
                  </div>
                  <div className="text-label-sm text-text-secondary mt-xs">조사항목: {a.source_item}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-label-sm text-text-secondary">유효 가중치</div>
                  <div className="font-semibold text-primary">
                    {a.weight} × {a.tier_multiplier} = <strong>{a.effective_weight}</strong>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-sm text-body-sm">
                <div className="bg-surface-light rounded p-xs">
                  <div className="text-label-sm text-text-secondary mb-xs">기준국 {baselineName}</div>
                  <div className="text-primary">{dash(a.baseline_value)}</div>
                </div>
                <div className="bg-surface-light rounded p-xs">
                  <div className="text-label-sm text-text-secondary mb-xs">대상국 {country.country_name}</div>
                  <div className="text-primary">{dash(a.target_value)}</div>
                </div>
                <div className="rounded p-xs" style={{ background: 'rgba(63,108,180,0.06)' }}>
                  <span className="text-label-sm text-text-secondary mb-xs">밴드 점수</span>
                  <div className="font-bold" style={{ color: axisBandColor }}>
                    {a.score_band} <span className="text-label-sm text-text-secondary font-normal">(raw {a.score_raw})</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

// ── 국가별 퀵윈 산식 ──────────────────────────────────────────────────────
function QuickwinFormula({ row, weights }: { row: RegionQuickwinRow; weights: { w_biz: number; w_it: number } }) {
  const band = row.quickwin_band
  const bandColor = band >= 60 ? (band >= 80 ? '#4f8a6d' : '#2f6be0') : band >= 40 ? '#c08a2e' : '#c0533f'
  const sum = (row.attractiveness * weights.w_biz + row.it_similarity * weights.w_it).toFixed(2)
  return (
    <details className="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
      <summary className="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
        <span className="material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
        <Flag code={row.country} />
        <span className="font-label-md text-label-md text-primary">
          {countryKo(row.country, row.country_name)} <span className="text-text-secondary font-normal">({row.country_name})</span>
        </span>
        <span className="text-2xl font-bold ml-xs" style={{ color: bandColor }}>
          {band}
        </span>
        <span className="text-label-sm text-text-secondary flex-1">퀵윈 구간</span>
        {row.is_baseline ? (
          <span className="px-2 py-[2px] rounded-md font-label-sm text-label-sm" style={{ background: '#e3edff', color: '#2f6be0' }}>
            기준국 (제외)
          </span>
        ) : row.killswitch_excluded ? (
          <span className="px-2 py-[2px] rounded-md font-label-sm text-label-sm" style={{ background: '#f7e4e0', color: '#c0533f' }}>
            킬스위치 탈락
          </span>
        ) : (
          <span className="px-2 py-[2px] rounded-md font-label-sm text-label-sm" style={{ background: '#e9f3ee', color: '#4f8a6d' }}>
            평가 대상
          </span>
        )}
      </summary>
      <div className="px-md pb-md pt-xs">
        <div className="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant">
          퀵윈 = 매력도 × w_biz + IT유사도 × w_it. 킬스위치 탈락국 제외, 10점 구간 표기.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sm text-body-sm">
          <div className="bg-surface-light rounded p-sm">
            <span className="text-label-sm text-text-secondary mb-xs">매력도</span>
            <div className="text-2xl font-bold text-primary">{row.attractiveness}</div>
            <div className="text-label-sm text-text-secondary mt-xs">× {weights.w_biz}</div>
          </div>
          <div className="bg-surface-light rounded p-sm">
            <span className="text-label-sm text-text-secondary mb-xs">IT 유사도</span>
            <div className="text-2xl font-bold text-primary">{row.it_similarity}</div>
            <div className="text-label-sm text-text-secondary mt-xs">× {weights.w_it}</div>
          </div>
          <div className="rounded p-sm" style={{ background: 'rgba(63,108,180,0.06)' }}>
            <span className="text-label-sm text-text-secondary mb-xs">합산 → 구간</span>
            <div className="text-2xl font-bold" style={{ color: bandColor }}>
              {band}
            </div>
            <div className="text-label-sm text-text-secondary mt-xs">raw {row.quickwin_raw}</div>
          </div>
        </div>
        <div className="text-label-sm text-text-secondary mt-sm">
          산식 전개: {row.attractiveness} × {weights.w_biz} + {row.it_similarity} × {weights.w_it} = {sum} → 10점 구간 {band}
        </div>
      </div>
    </details>
  )
}
