// 요약 탭 — 요약 패널 / 퀵윈 Top3 포디엄 / 산점도 + 전체순위 / 외부 이슈 스캔.
import type { RegionReportData } from '../types'
import { countryKo, Flag, quickwinBandColor, SourcePill } from './shared'
import { ScatterChart, type ScatterPoint } from './ScatterChart'
import { useT } from '../../../i18n/dict'
import { useLang, pickLang } from '../../../i18n/locale'
import type { Lang } from '../../../store'

// 국가명 — en이면 영문(region 메타엔 영문명 없어 코드 폴백), ko면 한글 매핑.
function nameOf(lang: Lang, code: string): string {
  if (lang === 'en') return code
  return countryKo(code)
}

export function SummaryTab({ data }: { data: RegionReportData }) {
  const es = data.tabs.executive_summary
  const cc = es.core_conclusion
  const qw = data.tabs.quickwin
  const t = useT()
  const lang = useLang()
  const regionKo = lang === 'en' ? data.region_meta.region : data.region_meta.region_ko
  const baseline = data.target.baseline_country
  const top1 = cc.top3[0]
  const newsItems = es.external_news_scan.items

  // 산점도 포인트: 퀵윈 rows(후보 + 기준국). 진출국(이미 운영중)은 후보가 아니므로 제외.
  // 단 기준국(baseline)은 진출국이라도 비교용 별표로 유지한다.
  const points: ScatterPoint[] = qw.rows
    .filter((r) => r.is_baseline || !r.already_entered)
    .map((r) => ({
      country: r.country,
      attractiveness: r.attractiveness,
      it_similarity: r.it_similarity,
      is_baseline: r.is_baseline,
      is_top1: r.country === top1.country, // 퀵윈 순위 1위 강조
    }))

  // 진출국(이미 운영중·기준국 제외) — 요약에 제외 사실을 명시한다.
  const enteredRows = qw.rows.filter((r) => r.already_entered && !r.is_baseline)
  // 실제 후보국(baseline·진출국 제외) — total_countries는 평가국 전체라 후보 수와 다르다.
  const candidateRows = qw.rows.filter((r) => !r.excluded)
  // 퀵윈 최적 사분면(① 매력도≥50 & IT유사도≥50) 후보국 — 산점도 기준선과 동일.
  const quickwinOptimal = candidateRows.filter((r) => r.attractiveness >= 50 && r.it_similarity >= 50)

  // 권역 인사이트 — 기준국(baseline) 언급 항목은 요약에서 제외(APAC은 baseline 없음).
  const insights = es.ai_cross_insight.insights.filter(
    (ins) => !/기준국|baseline/i.test(ins.ko) && (!baseline || !ins.ko.includes(`(${baseline})`)),
  )
  // 인사이트에 곁들일 권역 공통 뉴스 1건(헤드라인 + 시사점 한 줄).
  const regionNews = newsItems.find((n) => n.scope === 'region')

  return (
    <section className="flex flex-col gap-xl">
      {/* 요약 패널 — 국가 요약 탭과 동일한 다크 히어로 카드(잉크블랙 그라디언트 + 라임그린 강조) */}
      <section
        className="rounded-[18px] px-[30px] py-[28px] card-shadow text-white"
        style={{ background: 'linear-gradient(120deg,#14181C,#1f262d)' }}
      >
        <div className="font-label-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] mb-sm" style={{ color: '#C8F051', letterSpacing: '.1em' }}>
          권역 진단 보고서 · 퀵윈 스코어링
        </div>
        <div className="flex items-center gap-sm mb-md">
          <span className="material-symbols-outlined" style={{ color: '#C8F051', fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
          <h2 className="text-[clamp(23.8px,calc(21px_+_0.778vw),32.2px)] font-bold leading-none text-white">요약</h2>
        </div>
        <div className="flex flex-col gap-md [&_strong]:text-white">
          <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
            <strong>{regionKo}</strong> 권역 평가 <strong>{data.data_quality.total_countries}</strong>개국
            {baseline && (
              <>
                {' '}중 베이스라인{' '}
                <strong>{nameOf(lang, baseline)}({baseline})</strong>
              </>
            )}
            {enteredRows.length > 0 && (
              <>
                {baseline ? ' 및' : ' 중'} 진출국{' '}
                <strong>
                  {enteredRows.map((r) => `${nameOf(lang, r.country)}(${r.country})`).join('·')}
                </strong>
                {' '}{enteredRows.length}개국
              </>
            )}
            {baseline || enteredRows.length > 0 ? '을(를) 제외한 ' : '에서 '}후보 <strong>{candidateRows.length}</strong>개국을 스코어링한 결과, 최우선 퀵윈 후보는{' '}
            <strong>{nameOf(lang, top1.country)}({top1.country})</strong>(으)로 도출되었습니다.
          </p>
          <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
            {t('rsum.top1reason')} — <strong>{pickLang(lang, cc.why_top1.ko, cc.why_top1.en)}</strong>.
            {quickwinOptimal.length > 0 && (
              <>
                {' '}후보 {candidateRows.length}개국 중 <strong>{quickwinOptimal.length}</strong>개국(
                {quickwinOptimal.map((r) => r.country).join('·')})이 매력도·IT유사도 모두 높은 <strong>퀵윈 최적 영역</strong>에 위치합니다.
              </>
            )}
            {cc.killswitch_failed_count > 0 && (
              <> 킬스위치 탈락국은 <strong>{cc.killswitch_failed_count}</strong>개국입니다.</>
            )}
          </p>
          {insights.map((ins, i) => (
            <p key={i} className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
              {pickLang(lang, ins.ko, ins.en)}
            </p>
          ))}
          {regionNews && (
            <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
              <span style={{ color: '#C8F051' }}>{t('rsum.recentIssue')} —</span>{' '}
              <strong>{pickLang(lang, regionNews.headline, (regionNews as { headline_en?: string }).headline_en)}</strong>.{' '}
              {pickLang(lang, regionNews.so_what, (regionNews as { so_what_en?: string }).so_what_en)}
            </p>
          )}
        </div>
      </section>

      {/* 퀵윈 Top 3 포디엄 */}
      <Podium top3={cc.top3} t={t} lang={lang} />

      {/* 산점도 + 전체 순위 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rsum.attrXit')}</h2>
              <SourcePill flag="CALC" suffix="· 2축" />
            </div>
            <ScatterChart points={points} />
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
              <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rsum.fullRanking')}</h2>
              <SourcePill flag="CALC" suffix="· ranking" />
            </div>
            <FullRanking rows={qw.ranking} lang={lang} />
          </div>
        </div>
      </div>

      {/* 외부 이슈 스캔 */}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
          <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rsum.externalScan')}</h2>
          <SourcePill flag="NEWS" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {newsItems.map((n, i) => (
            <NewsCard key={i} news={n} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ── 포디엄: mockup 순서 [#2, #1, #3], 높이 h-12 / h-20 / h-8 ─────────────
function Podium({
  top3,
  t,
  lang,
}: {
  top3: RegionReportData['tabs']['executive_summary']['core_conclusion']['top3']
  t: (key: string) => string
  lang: Lang
}) {
  const byRank = (r: number) => top3.find((x) => x.rank === r)
  const order = [
    { entry: byRank(2), barH: 'h-12', barColor: '#14181C', topPad: 'pt-lg' },
    { entry: byRank(1), barH: 'h-20', barColor: '#C8F051', topPad: 'pt-0', highlight: true },
    { entry: byRank(3), barH: 'h-8', barColor: '#3a4048', topPad: 'pt-lg' },
  ]
  return (
    <div>
      <h2 className="font-headline-md text-headline-md text-primary mb-md">{t('rsum.quickwinTop3')}</h2>
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
                    Rank {e.rank}
                  </span>
                  <SourcePill flag="CALC" />
                </div>
                <Flag code={e.country} className="w-10 h-[26px] my-xs border border-surface-border" />
                <div className="font-headline-md text-headline-md text-primary leading-tight">{nameOf(lang, e.country)}</div>
                <div className="text-text-secondary text-body-sm">{e.country}</div>
                <div className="flex items-baseline gap-xs mt-sm">
                  <span className="text-4xl font-bold" style={{ color: '#14181C' }}>
                    {e.score_band}
                  </span>
                </div>
                <div className="mt-sm w-full grid grid-cols-2 gap-xs text-body-sm border-t border-surface-border pt-sm">
                  <div>
                    <span className="text-text-secondary block text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] uppercase tracking-wider">{t('rsum.attractiveness')}</span>
                    <span className="font-semibold text-primary">{e.attractiveness}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] uppercase tracking-wider">{t('rsum.itSim')}</span>
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
function FullRanking({ rows, lang }: { rows: RegionReportData['tabs']['quickwin']['ranking']; lang: Lang }) {
  const t = useT()
  return (
    <>
      <div className="grid grid-cols-12 items-center gap-xs px-xs pb-sm border-b-2 border-surface-border text-label-md text-text-secondary uppercase tracking-wider">
        <div className="col-span-1 text-center">{t('rsum.col.rank')}</div>
        <div className="col-span-6">{t('rsum.col.country')}</div>
        <div className="col-span-2 text-right">{t('rsum.col.attr')}</div>
        <div className="col-span-1 text-right">{t('rsum.col.it')}</div>
        <div className="col-span-2 text-right">{t('rsum.col.quickwin')}</div>
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.country}
            className={`grid grid-cols-12 items-center gap-xs py-md px-xs border-b border-surface-border last:border-b-0 ${
              r.rank <= 3 ? 'bg-surface-light/40' : ''
            }`}
          >
            <div className="col-span-1 text-center text-xl font-semibold">{r.rank}</div>
            <div className="col-span-6 flex items-center gap-sm">
              <Flag code={r.country} className="w-6 h-[18px]" />
              <span className="font-label-md text-body-lg text-primary truncate">{nameOf(lang, r.country)}</span>
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
function NewsCard({
  news,
  lang,
}: {
  news: RegionReportData['tabs']['executive_summary']['external_news_scan']['items'][number]
  lang: Lang
}) {
  const t = useT()
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
                {t('rsum.news.regionCommon')}
              </span>
              {news.news_category && (
                <span className="text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] uppercase tracking-wider text-text-secondary ml-xs">{news.news_category}</span>
              )}
            </>
          ) : (
            <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">
              {nameOf(lang, news.country ?? '')}
            </span>
          )}
        </div>
        <SourcePill flag="NEWS" suffix={news.date ? `· ${news.date}` : undefined} />
      </div>
      <h4 className="font-label-md text-label-md text-primary mb-xs">
        {pickLang(lang, news.headline, (news as { headline_en?: string }).headline_en)}
      </h4>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {pickLang(lang, news.so_what, (news as { so_what_en?: string }).so_what_en)}
      </p>
      <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
        {t('rsum.news.source')} {news.publisher}
        {news.url && (
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label-sm text-label-sm text-secondary hover:underline ml-xs"
          >
            {t('rsum.news.original')}
          </a>
        )}
      </p>
    </div>
  )
}
