// 요약 탭 — 요약 패널 / 퀵윈 Top3 포디엄 / 산점도 + 전체순위 / 외부 이슈 스캔.
import type { RegionReportData } from '../types'
import { countryKo, Flag, quickwinBandColor, SourcePill } from './shared'
import { ScatterChart, type ScatterPoint } from './ScatterChart'

export function SummaryTab({ data }: { data: RegionReportData }) {
  const es = data.tabs.executive_summary
  const cc = es.core_conclusion
  const qw = data.tabs.quickwin
  const regionKo = data.region_meta.region_ko
  const baseline = data.target.baseline_country
  const top1 = cc.top3[0]
  const newsItems = es.external_news_scan.items

  // 산점도 포인트: 퀵윈 rows(후보 + 기준국) 전체.
  const points: ScatterPoint[] = qw.rows.map((r) => ({
    country: r.country,
    attractiveness: r.attractiveness,
    it_similarity: r.it_similarity,
    is_baseline: r.is_baseline,
  }))

  return (
    <section className="flex flex-col gap-xl">
      {/* 요약 패널 (네이비 배경) */}
      <section className="bg-primary border border-primary rounded-xl p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center gap-sm mb-md pb-sm border-b border-white/20">
          <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
          <h2 className="font-headline-md text-[24px] leading-[32px] font-semibold text-on-primary">요약</h2>
        </div>
        <div className="flex flex-col gap-md [&_strong]:text-white">
          <p className="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
            <span>
              <strong>{regionKo}</strong> 권역의 후보 <strong>{data.data_quality.total_countries}</strong>개국을 베이스라인{' '}
              <strong>{countryKo(baseline)}({baseline})</strong> 대비 스코어링한 결과, 최우선 퀵윈 후보는{' '}
              <strong>{countryKo(top1.country)}({top1.country})</strong>(으)로 도출되었습니다.
            </span>
          </p>
          <p className="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
            <span>
              1위 근거 — <strong>{cc.why_top1.ko}</strong>. 킬스위치 탈락국은 <strong>{cc.killswitch_failed_count}</strong>개국입니다.
            </span>
          </p>
          {es.ai_cross_insight.insights.map((ins, i) => (
            <p key={i} className="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
              <span>{ins.ko}</span>
            </p>
          ))}
        </div>
      </section>

      {/* 퀵윈 Top 3 포디엄 */}
      <Podium top3={cc.top3} />

      {/* 산점도 + 전체 순위 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">매력도 × IT 유사도</h2>
              <SourcePill flag="CALC" suffix="· 2축" />
            </div>
            <ScatterChart points={points} />
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">전체 순위</h2>
              <SourcePill flag="CALC" suffix="· ranking" />
            </div>
            <FullRanking rows={qw.ranking} />
          </div>
        </div>
      </div>

      {/* 외부 이슈 스캔 */}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
          <h2 className="font-headline-md text-headline-md text-primary m-0">외부 이슈 스캔</h2>
          <SourcePill flag="NEWS" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {newsItems.map((n, i) => (
            <NewsCard key={i} news={n} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 포디엄: mockup 순서 [#2, #1, #3], 높이 h-12 / h-20 / h-8 ─────────────
function Podium({ top3 }: { top3: RegionReportData['tabs']['executive_summary']['core_conclusion']['top3'] }) {
  const byRank = (r: number) => top3.find((t) => t.rank === r)
  const order = [
    { entry: byRank(2), barH: 'h-12', barColor: '#14181C', topPad: 'pt-lg' },
    { entry: byRank(1), barH: 'h-20', barColor: '#C8F051', topPad: 'pt-0', highlight: true },
    { entry: byRank(3), barH: 'h-8', barColor: '#3a4048', topPad: 'pt-lg' },
  ]
  return (
    <div>
      <h2 className="font-headline-md text-headline-md text-primary mb-md">퀵윈 순위 (Top 3)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md items-end max-w-3xl mx-auto">
        {order.map((col, idx) => {
          const e = col.entry
          if (!e) return <div key={idx} />
          return (
            <div key={idx} className={`flex flex-col items-center justify-end ${col.topPad}`}>
              <div
                className={`w-full bg-surface-container-lowest rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] flex flex-col items-center text-center ${
                  col.highlight ? 'border border-primary ring-1 ring-primary/30' : 'border border-surface-border'
                }`}
              >
                <div className="flex items-center gap-xs mb-xs">
                  <span className="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">
                    Rank #{e.rank}
                  </span>
                  <SourcePill flag="CALC" />
                </div>
                <Flag code={e.country} className="w-10 h-[26px] my-xs border border-surface-border" />
                <div className="font-headline-md text-headline-md text-primary leading-tight">{countryKo(e.country)}</div>
                <div className="text-text-secondary text-body-sm">{e.country}</div>
                <div className="flex items-baseline gap-xs mt-sm">
                  <span className="text-4xl font-bold" style={{ color: '#14181C' }}>
                    {e.score_band}
                  </span>
                </div>
                <div className="mt-sm w-full grid grid-cols-2 gap-xs text-body-sm border-t border-surface-border pt-sm">
                  <div>
                    <span className="text-text-secondary block text-[10px] uppercase tracking-wider">매력도</span>
                    <span className="font-semibold text-primary">{e.attractiveness}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-[10px] uppercase tracking-wider">IT 유사도</span>
                    <span className="font-semibold text-primary">{e.it_similarity_band}</span>
                  </div>
                </div>
              </div>
              <div
                className={`w-full ${col.barH} rounded-b-md flex items-center justify-center`}
                style={{ background: col.barColor }}
              >
                <span className="font-bold text-white text-xl leading-none">{e.rank}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 전체 순위표 (퀵윈 ranking) ───────────────────────────────────────────
function FullRanking({ rows }: { rows: RegionReportData['tabs']['quickwin']['ranking'] }) {
  return (
    <>
      <div className="grid grid-cols-12 items-center gap-xs px-xs pb-sm border-b-2 border-surface-border text-label-md text-text-secondary uppercase tracking-wider">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6">국가</div>
        <div className="col-span-2 text-right">매력도</div>
        <div className="col-span-1 text-right">IT</div>
        <div className="col-span-2 text-right">퀵윈</div>
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.country}
            className={`grid grid-cols-12 items-center gap-xs py-md px-xs border-b border-surface-border last:border-b-0 ${
              r.rank <= 3 ? 'bg-surface-light/40' : ''
            }`}
          >
            <div className="col-span-1 text-center text-xl font-semibold">#{r.rank}</div>
            <div className="col-span-6 flex items-center gap-sm">
              <Flag code={r.country} className="w-6 h-[18px]" />
              <span className="font-label-md text-body-lg text-primary truncate">{countryKo(r.country)}</span>
              <span className="text-label-md text-text-secondary truncate">{r.country}</span>
            </div>
            <div className="col-span-2 text-right">
              <div className="text-primary font-medium text-body-md">{r.attractiveness}</div>
            </div>
            <div className="col-span-1 text-right">
              <div className="text-primary font-medium text-body-md">{r.it_similarity_band}</div>
            </div>
            <div className="col-span-2 text-right">
              <div className="text-3xl font-bold leading-none" style={{ color: quickwinBandColor(r.score_band) }}>
                {r.score_band}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── 뉴스 카드 (권역 공통 = 강조, 국가별 = 기본) ───────────────────────────
function NewsCard({ news }: { news: RegionReportData['tabs']['executive_summary']['external_news_scan']['items'][number] }) {
  const isRegion = news.scope === 'region'
  return (
    <div
      className={
        isRegion
          ? 'rounded-lg p-md border-2 border-[#c08a2e]/40 bg-[#fbf3e2]'
          : 'rounded-lg p-md border border-surface-border bg-surface-light'
      }
    >
      <div className="flex items-center justify-between mb-xs flex-wrap gap-xs">
        <div className="flex items-center gap-xs">
          {isRegion ? (
            <>
              <span
                className="font-label-sm text-label-sm font-semibold px-2 py-[2px] rounded-full"
                style={{ background: '#fbf3e2', color: '#c08a2e' }}
              >
                권역 공통
              </span>
              {news.news_category && (
                <span className="text-[10px] uppercase tracking-wider text-text-secondary ml-xs">{news.news_category}</span>
              )}
            </>
          ) : (
            <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">
              {countryKo(news.country ?? '', news.country ?? '')}
            </span>
          )}
        </div>
        <SourcePill flag="NEWS" suffix={news.date ? `· ${news.date}` : undefined} />
      </div>
      <h4 className="font-label-md text-label-md text-primary mb-xs">{news.headline}</h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{news.so_what}</p>
      <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
        출처: {news.publisher}
        {news.url && (
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-sm text-label-sm text-secondary hover:underline ml-xs"
          >
            ↗ 원문
          </a>
        )}
      </p>
    </div>
  )
}
