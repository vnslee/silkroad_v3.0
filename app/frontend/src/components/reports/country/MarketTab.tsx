// 탭4 시장·경쟁 배경 — 정성요약 + 금융사/OEM Top5 + EV추이 + 금리범위 + 경쟁사현황 + 브랜드Top10 + 규제기관 + 외부이슈 + 핵심지표
import type { CountryReportData, ReportItem, NewsEntry } from '../types'
import type { TimeseriesData } from '../../charts/types'
import {
  Panel,
  EvidenceCard,
  CaptiveChip,
  InsightBox,
  Donut,
  MiniTimeseries,
  TierBadge,
  EvidenceAccordion,
  hasCaptiveHint,
  parseShare,
  dash,
} from './shared'
import { useT } from '../../../i18n/dict'
import { useLang, pickLang } from '../../../i18n/locale'

export function MarketTab({ data }: { data: CountryReportData }) {
  const m = data.tabs.tab_1_4_market
  const t = useT()
  const lang = useLang()
  const find = (name: string): ReportItem | undefined => m.items.find((it) => it.item === name)

  const finItem = find('금융사 순위(Top 5)')
  const oemItem = find('OEM 순위(Top 5)')
  const evItem = find('EV 보급률')
  const rvItem = find('EV·ICE 잔존가치 리스크')
  const rateItem = find('경쟁사 금리 범위')

  return (
    <div className="flex flex-col gap-xl">
      {/* 국가 정성 요약 */}
      <Panel icon="summarize" title={t('mkt.qualSummary')}>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-md">{dash(pickLang(lang, m.country_summary.value, m.country_summary.value_en))}</p>
        {m.country_summary.insight && <InsightBox>{pickLang(lang, m.country_summary.insight, m.country_summary.insight_en)}</InsightBox>}
      </Panel>

      {/* 금융사 Top5 / OEM Top5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {finItem && <RankingPanel icon="account_balance" title={t('mkt.finTop5')} item={finItem} />}
        {oemItem && <RankingPanel icon="directions_car" title={t('mkt.oemTop5')} item={oemItem} />}
      </div>

      {/* EV 보급률 · 잔존가치 추이 */}
      {(evItem?.timeseries || rvItem?.timeseries) && (
        <Panel
          icon="battery_charging_full"
          title={t('mkt.evTrend')}
          right={
            <div className="flex items-center gap-md">
              <span className="flex items-center gap-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: '#14181C' }} />
                <span className="font-label-sm text-label-sm text-text-secondary">{t('mkt.evRate')}</span>
              </span>
              <span className="flex items-center gap-xs">
                <span className="w-3 h-3 rounded-full" style={{ background: '#c0533f' }} />
                <span className="font-label-sm text-label-sm text-text-secondary">{t('mkt.evResidual')}</span>
              </span>
            </div>
          }
        >
          <DualLineChart ev={evItem?.timeseries ?? null} rv={rvItem?.timeseries ?? null} />
          <p className="font-label-sm text-label-sm text-text-secondary mt-xs">{t('mkt.lineLegend')}</p>
        </Panel>
      )}

      {/* 경쟁사 금리 범위 */}
      {rateItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8">
            <Panel icon="percent" title={t('mkt.rateRange')}>
              <RateRangeChart text={dash(pickLang(lang, rateItem.value, rateItem.value_en))} />
            </Panel>
          </div>
          <div className="lg:col-span-4" />
        </div>
      )}

      {/* 경쟁사 현황 / 브랜드 Top10 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-6">
          <CompetitorPanel competitors={m.competitors} entryForm={m.competitor_entry_form} />
        </div>
        <div className="lg:col-span-6">
          <BrandTop10Panel brand={m.brand_top10} />
        </div>
      </div>

      {/* 규제기관 */}
      <Panel icon="policy" title={t('mkt.regulators')}>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-sm">{dash(pickLang(lang, m.regulators.value, m.regulators.value_en))}</p>
        {m.regulators.insight && (
          <div className="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{pickLang(lang, m.regulators.insight, m.regulators.insight_en)}</p>
          </div>
        )}
      </Panel>

      {/* 외부 이슈 스캔 */}
      <NewsPanel news={m.news} />

      {/* 시장·경쟁 핵심 지표(원천 데이터) */}
      <Panel icon="leaderboard" title={t('mkt.keyMetrics')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {m.items.map((it, i) => (
            <MarketMetricCard key={i} item={it} />
          ))}
        </div>
      </Panel>
    </div>
  )
}

// 금융사/OEM Top5 랭킹 패널
function RankingPanel({ icon, title, item }: { icon: string; title: string; item: ReportItem }) {
  const t = useT()
  const lang = useLang()
  const rows: { rank: number; name: string; share: number }[] = Array.isArray(item.value)
    ? item.value.map((r: any) => ({ rank: r.rank, name: r.name, share: parseShare(r.market_share) }))
    : []
  const top5sum = rows.reduce((a, r) => a + r.share, 0)
  const maxShare = Math.max(...rows.map((r) => r.share), 1)
  return (
    <Panel
      icon={icon}
      title={title}
      right={
        <div className="text-right">
          <div className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('mkt.top5cum')}</div>
          <div className="font-headline-md text-headline-md text-primary">
            {top5sum.toFixed(1)}
            <span className="font-body-sm text-body-sm text-text-secondary">%</span>
          </div>
        </div>
      }
    >
      <table className="w-full">
        <thead>
          <tr className="text-text-secondary border-b border-surface-container-highest">
            <th className="py-xs pr-sm text-left font-label-sm text-label-sm uppercase">{t('mkt.rankCompany')}</th>
            <th className="py-xs px-sm text-left font-label-sm text-label-sm uppercase">{t('mkt.share')}</th>
            <th className="py-xs pl-sm text-right font-label-sm text-label-sm uppercase">{t('mkt.value')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-surface-container-highest last:border-b-0">
              <td className="py-sm pr-sm align-middle">
                <div className="flex items-center gap-sm">
                  <span className={`font-headline-md text-headline-md w-6 text-right ${i === 0 ? 'text-primary' : 'text-text-secondary'}`}>{r.rank}</span>
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-text-primary">{r.name}</span>
                    {hasCaptiveHint(r.name) && (
                      <div className="flex items-center gap-xs mt-[2px]">
                        <CaptiveChip />
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-sm px-sm align-middle w-[40%]">
                <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(r.share / maxShare) * 100}%` }} />
                </div>
              </td>
              <td className="py-sm pl-sm align-middle text-right w-[80px]">
                <span className="font-headline-md text-headline-md text-primary">{r.share.toFixed(1)}</span>
                <span className="font-label-sm text-label-sm text-text-secondary">%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.insight && (
        <div className="mt-md">
          <InsightBox>{pickLang(lang, item.insight, item.insight_en)}</InsightBox>
        </div>
      )}
    </Panel>
  )
}

// 경쟁사 현황(유형별 자동 그룹핑)
function classifyCompetitor(name: string): 'bank' | 'oem_captive' | 'fleet_lease' | 'specialty' {
  const n = name.toLowerCase()
  const oem = ['volkswagen', 'vw', 'toyota', 'bmw', 'mercedes', 'audi', 'ford', 'renault', 'hyundai', 'kia', 'nissan', 'honda', 'peugeot', 'stellantis', 'fiat']
  if (oem.some((b) => n.includes(b))) return 'oem_captive'
  if (['ald', 'arval', 'alphabet', 'ayvens', 'leaseplan'].some((k) => n.includes(k))) return 'fleet_lease'
  if (['santander', 'cetelem', 'bnp', 'caixa', 'sabadell', 'ca auto', 'credit agricole', 'barclays', 'hsbc'].some((k) => n.includes(k))) return 'bank'
  return 'specialty'
}
const GROUP_META: Record<string, { labelKey: string; icon: string }> = {
  bank: { labelKey: 'mkt.grp.bank', icon: 'account_balance' },
  oem_captive: { labelKey: 'mkt.grp.oem', icon: 'directions_car' },
  fleet_lease: { labelKey: 'mkt.grp.fleet', icon: 'garage' },
  specialty: { labelKey: 'mkt.grp.specialty', icon: 'store' },
}
function CompetitorPanel({ competitors, entryForm }: { competitors: ReportItem; entryForm: ReportItem }) {
  const t = useT()
  const lang = useLang()
  const list: string[] = Array.isArray(competitors.value) ? competitors.value.map(String) : []
  const groups: Record<string, string[]> = { bank: [], oem_captive: [], fleet_lease: [], specialty: [] }
  list.forEach((c) => groups[classifyCompetitor(c)].push(c))
  const visible = Object.entries(groups).filter(([, members]) => members.length > 0)
  return (
    <Panel
      icon="groups"
      title={t('mkt.competitors')}
      right={<span className="font-label-sm text-label-sm text-text-secondary">{t('mkt.totalFirms').replace('{n}', String(list.length))}</span>}
    >
      <div className="bg-surface p-sm rounded-md border border-surface-container-highest mb-md">
        <div className="flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-text-secondary text-[clamp(11.9px,calc(10.5px_+_0.389vw),16.1px)]">flag</span>
          <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{t('mkt.entryForm')}</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{dash(pickLang(lang, entryForm.value, entryForm.value_en))}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {visible.map(([key, members]) => (
          <div key={key} className="p-sm bg-surface-container-low rounded-lg border border-surface-container-highest">
            <div className="flex items-center justify-between mb-xs">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)]">{GROUP_META[key].icon}</span>
                <span className="font-label-md text-label-md text-primary uppercase tracking-wider">{t(GROUP_META[key].labelKey)}</span>
              </div>
              <span className="font-label-sm text-label-sm text-text-secondary">{members.length}{t('mkt.countSuffix')}</span>
            </div>
            <div className="flex flex-wrap gap-xs">
              {members.map((mem, i) => (
                <span key={i} className="inline-flex items-center gap-xs bg-surface rounded-full border border-surface-container-highest px-sm py-[2px] font-label-sm text-label-sm text-text-primary">
                  {mem}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {competitors.insight && (
        <div className="mt-md">
          <InsightBox>{pickLang(lang, competitors.insight, competitors.insight_en)}</InsightBox>
        </div>
      )}
    </Panel>
  )
}

// 브랜드 Top10 (2열 카드)
function BrandTop10Panel({ brand }: { brand: ReportItem }) {
  const t = useT()
  const lang = useLang()
  // value는 문자열 배열(["Toyota", ...]) 또는 객체 배열([{rank, name}, ...]) 둘 다 올 수 있다.
  const list: string[] = Array.isArray(brand.value)
    ? brand.value.map((v: any) => (v && typeof v === 'object' ? String(v.name ?? '') : String(v)))
    : []
  return (
    <Panel
      icon="directions_car"
      title={t('mkt.brandTop10')}
      right={<span className="font-label-sm text-label-sm text-text-secondary">{t('mkt.newCarReg')}</span>}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
        {list.map((name, i) => {
          const rank = i + 1
          const top3 = rank <= 3
          return (
            <div key={i} className={`flex items-center gap-sm p-sm rounded-md border border-surface-container-highest ${top3 ? 'bg-surface-container-low' : 'bg-surface'}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-label-md text-label-md flex-shrink-0 ${top3 ? 'bg-primary text-on-primary' : 'bg-surface-container text-text-secondary'}`}>
                {rank}
              </span>
              <span className="font-body-md text-body-md text-text-primary flex-1 truncate">{name}</span>
              {hasCaptiveHint(name) && <CaptiveChip />}
            </div>
          )
        })}
      </div>
      {brand.insight && (
        <div className="mt-md">
          <InsightBox>{pickLang(lang, brand.insight, brand.insight_en)}</InsightBox>
        </div>
      )}
    </Panel>
  )
}

// 외부 이슈 스캔(뉴스)
const NEWS_CAT_STYLE = 'bg-orange-100 text-orange-700 border border-orange-200'
function NewsPanel({ news }: { news: ReportItem }) {
  const t = useT()
  const lang = useLang()
  const entries: NewsEntry[] = Array.isArray(news.value) ? news.value : []
  return (
    <Panel icon="newspaper" title={t('mkt.newsScan')}>
      <div className="flex flex-col gap-md">
        {entries.map((n, i) => {
          // headline/publisher 비어있으면 "미확보" 경고 박스
          if (!n.headline && !n.publisher) {
            return (
              <div key={i} className="p-md bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-xs mb-xs">
                  <span className="material-symbols-outlined text-yellow-700 text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)]">warning</span>
                  <span className="font-label-md text-label-md text-yellow-800 uppercase">{n.news_category}</span>
                </div>
                <p className="font-body-sm text-body-sm text-yellow-700">{t('mkt.newsMissing')}</p>
              </div>
            )
          }
          return (
            <div key={i} className="p-md bg-surface rounded-lg border border-surface-container-highest flex flex-col gap-xs">
              <div className="flex items-center gap-xs flex-wrap">
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase ${NEWS_CAT_STYLE}`}>{n.news_category}</span>
                <span className="font-label-sm text-label-sm text-text-secondary">
                  {n.publisher} · {n.pub_date}
                </span>
              </div>
              <h4 className="font-label-md text-label-md text-text-primary leading-relaxed m-0">{pickLang(lang, n.headline, n.headline_en)}</h4>
              <div className="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
                <div className="flex items-center gap-xs mb-xs">
                  <span className="material-symbols-outlined text-primary text-[clamp(11.9px,calc(10.5px_+_0.389vw),16.1px)]">psychology</span>
                  <span className="font-label-sm text-label-sm text-primary uppercase">So What</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{pickLang(lang, n.so_what, n.so_what_en)}</p>
              </div>
              {n.url && (
                <a className="text-primary underline" href={n.url} target="_blank" rel="noopener noreferrer">
                  {t('mkt.original')}
                </a>
              )}
            </div>
          )
        })}
      </div>
      {news.insight && (
        <div className="mt-md">
          <InsightBox label={t('mkt.overallInsight')}>{pickLang(lang, news.insight, news.insight_en)}</InsightBox>
        </div>
      )}
    </Panel>
  )
}

// 핵심 지표 카드(순위 리스트형 / 도넛 / 시계열 / 텍스트)
function MarketMetricCard({ item }: { item: ReportItem }) {
  // 순위형 list (금융사/OEM 순위) → 컴팩트 리스트
  if (Array.isArray(item.value) && item.value.length > 0 && typeof item.value[0] === 'object') {
    const rows = item.value as { rank: number; name: string; market_share?: string }[]
    const maxShare = Math.max(...rows.map((r) => parseShare(r.market_share)), 1)
    return (
      <div className="p-md bg-surface rounded-lg border border-surface-container-highest flex flex-col gap-sm">
        <div className="flex items-center gap-xs flex-wrap">
          <span className="font-label-md text-label-md text-text-primary uppercase tracking-wide">{item.item}</span>
          {item.tier && <TierBadge tier={item.tier} />}
        </div>
        <ul className="flex flex-col gap-xs w-full mt-xs list-none p-0 m-0">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-xs">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-label-sm text-label-sm flex-shrink-0 ${i < 3 ? 'bg-primary text-on-primary' : 'bg-surface-container text-text-secondary'}`}>
                {r.rank}
              </span>
              <span className="font-label-md text-label-md text-text-primary flex-1 truncate">{r.name}</span>
              {hasCaptiveHint(r.name) && (
                <span className="ml-xs">
                  <CaptiveChip />
                </span>
              )}
              <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(parseShare(r.market_share) / maxShare) * 100}%` }} />
              </div>
              <span className="font-label-md text-label-md text-text-secondary w-12 text-right">{r.market_share}</span>
            </li>
          ))}
        </ul>
        <EvidenceAccordion source={item.source} insight={item.insight} ai={item.insight_ai_generated} />
      </div>
    )
  }
  // 도넛형(%값 + 라벨 매핑)
  const donutMap: Record<string, [string, string]> = {
    '금융사 점유율(Top 5)': ['Top 5', '기타'],
    'EV 보급률': ['EV', 'ICE 외'],
  }
  let chart: React.ReactNode = undefined
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

// EV 보급률 + 잔존가치 듀얼 라인 (mockup viewBox 760x280)
function DualLineChart({ ev, rv }: { ev: TimeseriesData | null; rv: TimeseriesData | null }) {
  const W = 760
  const H = 280
  const left = 50
  const right = 740
  const top = 20
  const bottom = 244
  const series = [
    { ts: ev, color: '#14181C' },
    { ts: rv, color: '#c0533f' },
  ].filter((s) => s.ts) as { ts: TimeseriesData; color: string }[]
  if (series.length === 0) return null
  const allVals = series.flatMap((s) => [...(s.ts.history ?? []), ...(s.ts.forecast ?? [])].map((p) => p.value))
  const allYears = series.flatMap((s) => [...(s.ts.history ?? []), ...(s.ts.forecast ?? [])].map((p) => p.year))
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const spanV = maxV - minV || 1
  const minY = Math.min(...allYears)
  const maxY = Math.max(...allYears)
  const spanYr = maxY - minY || 1
  const scaleX = (yr: number) => left + ((yr - minY) / spanYr) * (right - left)
  const scaleY = (v: number) => bottom - ((v - minV) / spanV) * (bottom - top)
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: top + (bottom - top) * f, v: maxV - spanV * f }))
  const years = Array.from({ length: spanYr + 1 }, (_, i) => minY + i)
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="EV 보급률·잔존가치 추이">
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={left} y1={g.y} x2={right} y2={g.y} stroke="#e6e3db" strokeWidth="1" />
          <text x={left - 6} y={g.y + 4} fontSize="10" fill="#9aa0a6" textAnchor="end">
            {Math.round(g.v)}
          </text>
        </g>
      ))}
      {years.map((yr, i) => (
        <text key={i} x={scaleX(yr)} y={260} fontSize="10" fill="#9aa0a6" textAnchor="middle">
          {yr}
        </text>
      ))}
      {series.map((s, si) => {
        const hist = s.ts.history ?? []
        const fore = s.ts.forecast ?? []
        const histPts = hist.map((p) => ({ x: scaleX(p.year), y: scaleY(p.value) }))
        const forePts = fore.map((p) => ({ x: scaleX(p.year), y: scaleY(p.value) }))
        const foreJoin = histPts.length && forePts.length ? [histPts[histPts.length - 1], ...forePts] : forePts
        const toPath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        return (
          <g key={si}>
            {histPts.length > 1 && <path d={toPath(histPts)} fill="none" stroke={s.color} strokeWidth="2.5" />}
            {foreJoin.length > 1 && <path d={toPath(foreJoin)} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray="6 4" />}
            {histPts.map((p, i) => (
              <circle key={`h${i}`} cx={p.x} cy={p.y} r="3" fill={s.color} />
            ))}
            {forePts.map((p, i) => (
              <circle key={`f${i}`} cx={p.x} cy={p.y} r="3" fill={s.color} opacity="0.6" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// 경쟁사 금리 범위(텍스트에서 범위 추출 → 가로 범위 막대)
function RateRangeChart({ text }: { text: string }) {
  const ranges: { lo: number; hi: number }[] = []
  const re = /(\d+(?:\.\d+)?)\s*[~\-–]\s*(\d+(?:\.\d+)?)\s*%/g
  let mm: RegExpExecArray | null
  while ((mm = re.exec(text)) !== null) ranges.push({ lo: parseFloat(mm[1]), hi: parseFloat(mm[2]) })
  const rows: { label: string; lo: number; hi: number; color: string }[] = []
  if (ranges[0]) rows.push({ label: '신차 자동차대출', lo: ranges[0].lo, hi: ranges[0].hi, color: '#14181C' })
  if (ranges[1]) rows.push({ label: '캡티브 프로모', lo: ranges[1].lo, hi: ranges[1].hi, color: '#4f8a6d' })
  const single = text.match(/평균[^0-9]*?(\d+(?:\.\d+)?)\s*%/)
  if (single) rows.push({ label: '소비자신용 평균', lo: parseFloat(single[1]), hi: parseFloat(single[1]), color: '#c0533f' })
  if (rows.length === 0) return <p className="font-body-sm text-body-sm text-text-secondary">{text}</p>

  const W = 760
  const labelW = 160
  const trackL = labelW
  const trackR = 700
  const maxRate = Math.max(...rows.map((r) => r.hi), 10)
  const scaleX = (v: number) => trackL + (v / maxRate) * (trackR - trackL)
  const rowH = 40
  const H = rows.length * rowH
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${Math.max(H, 80)}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="경쟁사 금리 범위">
      {rows.map((r, i) => {
        const y = i * rowH + 32
        const x1 = scaleX(r.lo)
        const x2 = scaleX(r.hi)
        return (
          <g key={i}>
            <text x="0" y={y + 4} fontSize="13" fill="#14181C" fontWeight="600">
              {r.label}
            </text>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={r.color} strokeWidth="6" strokeLinecap="round" />
            <circle cx={x1} cy={y} r="5" fill={r.color} />
            <circle cx={x2} cy={y} r="5" fill={r.color} />
            <text x={x1 - 6} y={y + 4} fontSize="11" fill="#3a4048" fontWeight="600" textAnchor="end">
              {r.lo.toFixed(1)}%
            </text>
            <text x={x2 + 8} y={y + 4} fontSize="11" fill="#3a4048" fontWeight="600">
              {r.hi.toFixed(1)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
