// 탭1 유사도 점수 — 레이더(축별) + 축별 점수카드 + 디멘전별 채점 + 원천 데이터 항목
import type { CountryReportData, SimilarityItem } from '../types'
import { Panel, EvidenceCard } from './shared'
import { useT } from '../../../i18n/dict'
import { useLang } from '../../../i18n/locale'

const AXIS_KEY: Record<string, string> = { system: 'sim.axis.system', product: 'sim.axis.product', regulatory: 'sim.axis.regulatory', risk: 'sim.axis.risk' }
// 레이더 4축 고정 순서: 상단=시스템, 우=상품, 하=규제, 좌=리스크 (mockup)
const RADAR_ORDER = ['system', 'product', 'regulatory', 'risk']

function scoreColor(s: number): string {
  if (s >= 80) return 'text-emerald-700'
  if (s >= 60) return 'text-yellow-700'
  return 'text-accent-red'
}
function gapColor(gap: number): string {
  if (gap <= 1) return 'text-emerald-700'
  if (gap <= 2) return 'text-yellow-700'
  return 'text-accent-red'
}

export function SimilarityTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const t = useT()
  const lang = useLang()
  const countryKo = lang === 'en' ? data.country_meta.country : data.country_meta.country_ko
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아', AU: '호주', CL: '칠레' }
  const baseEnMap: Record<string, string> = { GB: 'UK', US: 'USA', DE: 'Germany', FR: 'France', IT: 'Italy', AU: 'Australia', CL: 'Chile' }
  const baseKo = (lang === 'en' ? baseEnMap[data.target.base_country] : baseKoMap[data.target.base_country]) ?? data.target.base_country
  const mult = Math.round((data.tabs.tab_1_3_tco.similarity_multiplier ?? 0) * 100)
  const band = data.tabs.tab_1_3_tco.similarity_band

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      {/* 레이더 */}
      <div className="lg:col-span-8 flex flex-col gap-xl">
        <Panel
          icon="radar"
          title={
            <>
              {t('sim.score')} ({countryKo} vs {baseKo})
            </>
          }
        >
          <div className="relative flex flex-col items-center">
            <div className="w-full aspect-square relative flex items-center justify-center mb-md max-w-md mx-auto">
              <RadarChart axes={sim.axes} />
              <span className="absolute top-0 left-1/2 -translate-x-1/2 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('sim.axis.system')}</span>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('sim.axis.product')}</span>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('sim.axis.regulatory')}</span>
              <span className="absolute left-0 top-1/2 -translate-y-1/2 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('sim.axis.risk')}</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* 축별 점수 */}
      <div className="lg:col-span-4 flex flex-col gap-xl">
        <Panel icon="assessment" title={t('sim.axisScores')}>
          <div className="grid grid-cols-2 gap-sm mb-md">
            {RADAR_ORDER.map((ax) => (
              <div key={ax} className="flex flex-col p-sm bg-surface rounded-lg border border-surface-container-highest">
                <span className="font-label-sm text-label-sm text-text-secondary uppercase">{t(AXIS_KEY[ax] ?? ax)}</span>
                <span className="font-headline-md text-headline-md text-primary">{(sim.axes[ax] ?? 0).toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="p-md bg-surface-container rounded-lg border-l-4 border-primary mb-sm">
            <div className="flex items-center gap-xs mb-xs">
              <span className="font-semibold font-label-md text-label-md text-primary uppercase">Overall Score</span>
            </div>
            <div className="flex items-baseline gap-xs">
              <span className="font-headline-lg text-headline-lg text-primary">{sim.overall_score.toFixed(1)}</span>
              <span className="font-body-sm text-body-sm text-text-secondary">/ 100</span>
            </div>
          </div>
          <div className="p-md rounded-lg border-l-4 border-emerald-600" style={{ background: 'rgba(16,122,71,.06)' }}>
            <div className="flex items-center gap-xs mb-xs">
              <span className="font-semibold font-label-md text-label-md text-emerald-800 uppercase">{t('sim.tcoMult')}</span>
            </div>
            <div className="flex items-baseline gap-xs">
              <span className="font-headline-lg text-headline-lg text-emerald-700">{mult}%</span>
            </div>
            <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
              {t('sim.bandApplied').replace('{band}', band).replace('{mult}', String(mult))}
            </p>
          </div>
        </Panel>
      </div>

      {/* 디멘전별 채점 */}
      <div className="lg:col-span-12">
        <Panel
          icon="calculate"
          title={
            <>
              {t('sim.dimScoring')} ({countryKo} vs {baseKo})
            </>
          }
        >
          <p className="font-body-sm text-body-sm text-text-secondary mb-md">
            {t('sim.dimScoringLead')}
          </p>
          <div className="flex flex-col gap-md">
            {sim.items.map((it, i) => (
              <DimensionCard key={i} item={it} countryKo={countryKo} baseKo={baseKo} />
            ))}
          </div>
        </Panel>
      </div>

      {/* 원천 데이터 항목 */}
      <div className="lg:col-span-12">
        <Panel icon="fact_check" title={t('sim.evidenceItems')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {sim.evidence_items.map((it, i) => (
              <EvidenceCard key={i} item={it} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function DimensionCard({ item, countryKo, baseKo }: { item: SimilarityItem; countryKo: string; baseKo: string }) {
  const t = useT()
  const lang = useLang()
  const headScore = Math.round(item.item_similarity)
  return (
    <div className="bg-surface border border-surface-container-highest rounded-lg p-md">
      <div className="flex items-start justify-between gap-md mb-sm">
        <div>
          <div className="font-label-md text-label-md text-text-primary uppercase tracking-wider">{item.item}</div>
          <div className="font-label-sm text-label-sm text-text-secondary mt-xs">
            {t('sim.axisLabel')}: {item.axis} · {t('sim.weight')} {Math.round(item.weight * 100)}%
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className={`font-headline-md text-headline-md ${scoreColor(headScore)}`}>{headScore}</div>
          <div className="font-label-sm text-label-sm text-text-secondary">/ 100</div>
        </div>
      </div>
      <table className="w-full font-body-sm text-body-sm">
        <thead>
          <tr className="text-text-secondary border-b border-surface-container-highest">
            <th className="py-xs pr-sm text-left font-label-sm text-label-sm uppercase">{t('sim.dimension')}</th>
            <th className="py-xs px-sm text-left font-label-sm text-label-sm uppercase">
              {countryKo} <span className="text-text-secondary normal-case">({t('sim.targetCountry')})</span>
            </th>
            <th className="py-xs px-sm text-left font-label-sm text-label-sm uppercase">
              {baseKo} <span className="text-text-secondary normal-case">({t('sim.baseline')})</span>
            </th>
            <th className="py-xs px-sm text-right font-label-sm text-label-sm uppercase">{t('sim.gap')}</th>
            <th className="py-xs pl-sm text-right font-label-sm text-label-sm uppercase">{t('sim.similarity')}</th>
          </tr>
        </thead>
        <tbody>
          {item.dimensions.map((d, i) => (
            <tr key={i} className="border-b border-surface-container-highest align-top">
              <td className="py-sm pr-sm">
                <div className="font-body-sm text-body-sm text-text-primary font-semibold">{d.dimension}</div>
                {d.note && <div className="font-body-sm text-body-sm text-text-secondary mt-xs">{lang === 'en' && d.note_en ? d.note_en : d.note}</div>}
              </td>
              <td className="py-sm px-sm w-[110px]">
                <ScoreBar score={d.target_score} color="bg-primary" />
              </td>
              <td className="py-sm px-sm w-[110px]">
                <ScoreBar score={d.base_score} color="bg-secondary" />
              </td>
              <td className={`py-sm px-sm w-[60px] text-right font-label-sm text-label-sm ${gapColor(d.gap)}`}>{d.gap}</td>
              <td className="py-sm pl-sm w-[80px] text-right font-label-md text-label-md text-primary font-bold">{Math.round(d.similarity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-xs">
      <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="font-label-sm text-label-sm text-text-primary w-[20px] text-right">{score}</span>
    </div>
  )
}

// 4축 레이더 — mockup viewBox 200x200, 4방향(상=시스템,우=상품,하=규제,좌=리스크)
function RadarChart({ axes }: { axes: Record<string, number> }) {
  const cx = 100
  const cy = 100
  const maxR = 80
  // 방향 단위벡터: 상 우 하 좌
  const dirs: Record<string, [number, number]> = {
    system: [0, -1],
    product: [1, 0],
    regulatory: [0, 1],
    risk: [-1, 0],
  }
  const pt = (ax: string, frac: number) => {
    const [dx, dy] = dirs[ax]
    return [cx + dx * maxR * frac, cy + dy * maxR * frac] as [number, number]
  }
  const polyAt = (frac: number) =>
    RADAR_ORDER.map((ax) => {
      const [x, y] = pt(ax, frac)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  const dataPoly = RADAR_ORDER.map((ax) => {
    const [x, y] = pt(ax, Math.max(0, Math.min(100, axes[ax] ?? 0)) / 100)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200" role="img" aria-label="유사도 4축 레이더">
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon key={i} fill="none" points={polyAt(f)} stroke="#d3cfc4" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {RADAR_ORDER.map((ax, i) => {
        const [x, y] = pt(ax, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e6e3db" strokeWidth="1" strokeDasharray="3 3" />
      })}
      <polygon points={dataPoly.join(' ')} fill="#14181C" fillOpacity="0.12" stroke="#14181C" strokeWidth="2.5" strokeLinejoin="round" />
      {dataPoly.map((p, i) => {
        const [x, y] = p.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#14181C" stroke="#fff" strokeWidth="1.5" />
      })}
    </svg>
  )
}
