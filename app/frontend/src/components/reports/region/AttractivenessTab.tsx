// 매력도 탭 — 비즈니스 매력도 순위 / 항목 기여분(스택 막대) / 국가별 산식.
import type { RegionReportData, RegionAttrCountry } from '../types'
import { axisLabel, countryKo, Flag, scoreBarColor, normBarColor, SourcePill } from './shared'
import { useT } from '../../../i18n/dict'
import { useLang } from '../../../i18n/locale'
import type { Lang } from '../../../store'

// 항목(축)별 스택 막대 색 — 7개 항목이 서로 또렷이 구분되도록 색상환을 넓게 배치
// (기존엔 4개가 동일 #2f6be0이라 구분 불가). 보고서 톤(블루 베이스 + 앰버 포인트) 유지.
const AXIS_COLORS: Record<string, string> = {
  'GDP 성장률': '#1f3a8a', // 진한 네이비
  '자동차 판매대수': '#3f8fd0', // 미드 블루
  시장규모: '#34b3a0', // 틸
  '오토금융 성장률(CAGR)': '#8fce5a', // 라임그린
  '금융 이용률': '#f0b429', // 골드
  금융이용유형: '#c0533f', // 테라코타
  경쟁강도: '#8159c9', // 퍼플
}

// 국가명 표시 — en이면 country_name(영문) 우선, 없으면 코드. ko면 한글 매핑.
function nameOf(lang: Lang, code: string, nameEn?: string): string {
  if (lang === 'en') return nameEn ?? code
  return countryKo(code, nameEn)
}

export function AttractivenessTab({ data }: { data: RegionReportData }) {
  const at = data.tabs.tab_2_1_attractiveness
  const axisOrder = Object.keys(at.weights)
  const t = useT()
  const lang = useLang()
  const weightsNote = axisOrder.map((k) => `${axisLabel(lang, k)} ${at.weights[k]}`).join(', ')

  return (
    <section className="flex flex-col gap-xl">
      {/* 순위 막대 */}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
          <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rattr.bizRank')}</h2>
          <SourcePill flag="CALC" suffix="· ranking · 0~100" />
        </div>
        <div className="flex flex-col gap-sm">
          {at.ranking.map((r) => (
            <div key={r.country} className="grid grid-cols-12 items-center gap-sm">
              <div className="col-span-3 flex items-center gap-xs">
                <span className="font-label-sm text-label-sm text-text-secondary w-5 text-right">#{r.rank}</span>
                <Flag code={r.country} />
                <span className="font-label-md text-label-md text-primary">{nameOf(lang, r.country)}</span>
              </div>
              <div className="col-span-7">
                <div className="w-full h-4 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: scoreBarColor(r.score) }} />
                </div>
              </div>
              <div className="col-span-2 text-right font-semibold text-primary">{r.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 항목 기여분 스택 막대 */}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
        <div className="flex items-center justify-between mb-md border-b border-surface-border pb-sm flex-wrap gap-sm">
          <div className="flex items-center gap-sm">
            <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rattr.contribution')}</h2>
            <SourcePill flag="CALC" suffix="· composition" />
          </div>
          <div className="flex flex-wrap gap-md">
            {axisOrder.map((axis) => (
              <div key={axis} className="flex items-center gap-xs">
                <div className="w-3 h-3 rounded-sm" style={{ background: AXIS_COLORS[axis] ?? '#2f6be0' }} />
                <span className="text-label-sm text-text-secondary">{axisLabel(lang, axis)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-sm">
          {at.countries.map((c) => {
            const total = c.attractiveness_score
            // 막대는 '항목 구성비'를 보여주므로 기여분 합 기준으로 100%를 채운다. total(최종 점수)로
            // 나누면 합이 total과 달라(반올림·표시 외 항목) 막대가 덜 차서 빈 공간이 생기던 문제 해소.
            const sumContrib = axisOrder.reduce(
              (s, axis) => s + (c.contributions[axis]?.contribution ?? 0),
              0,
            )
            return (
              <div key={c.country} className="grid grid-cols-12 items-center gap-sm">
                <div className="col-span-3 flex items-center gap-xs">
                  <Flag code={c.country} />
                  <span className="font-label-md text-label-md text-primary">{nameOf(lang, c.country, c.country_name)}</span>
                </div>
                <div className="col-span-7">
                  <div className="w-full h-4 bg-surface-container rounded overflow-hidden flex">
                    {axisOrder.map((axis) => {
                      const contrib = c.contributions[axis]?.contribution ?? 0
                      const pct = sumContrib > 0 ? (contrib / sumContrib) * 100 : 0
                      return (
                        <div
                          key={axis}
                          className="h-full"
                          style={{ width: `${pct}%`, background: AXIS_COLORS[axis] ?? '#2f6be0' }}
                          title={`${axisLabel(lang, axis)}: ${contrib.toFixed(1)}`}
                        />
                      )
                    })}
                  </div>
                </div>
                <div className="col-span-2 text-right text-text-secondary text-label-sm">{t('rattr.total')} {total}</div>
              </div>
            )
          })}
        </div>
        <p className="mt-md text-label-sm text-text-secondary">{t('rattr.weight')}: {weightsNote}</p>
      </div>

      {/* 국가별 산식 */}
      <div>
        <h3 className="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm">{t('rattr.scoreFormula')}</h3>
        <div className="flex flex-col gap-sm">
          {[...at.countries]
            .sort((a, b) => b.attractiveness_score - a.attractiveness_score)
            .map((c) => (
              <CountryFormula key={c.country} country={c} axisOrder={axisOrder} lang={lang} />
            ))}
        </div>
      </div>
    </section>
  )
}

function CountryFormula({ country, axisOrder, lang }: { country: RegionAttrCountry; axisOrder: string[]; lang: Lang }) {
  const t = useT()
  return (
    <details className="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
      <summary className="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
        <span className="material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] text-text-secondary transition-transform group-open:rotate-90">
          chevron_right
        </span>
        <Flag code={country.country} />
        <span className="font-label-md text-label-md text-primary">
          {nameOf(lang, country.country, country.country_name)} <span className="text-text-secondary font-normal">({country.country_name})</span>
        </span>
        <span className="text-2xl font-bold ml-xs" style={{ color: scoreBarColor(country.attractiveness_score) }}>
          {country.attractiveness_score}
        </span>
        <span className="text-label-sm text-text-secondary flex-1">{t('rattr.summaryNote')}</span>
        <span className="font-label-sm text-label-sm text-secondary">{t('rattr.viewFormula')}</span>
      </summary>
      <div className="px-md pb-md pt-xs">
        <div className="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant">
          {t('rattr.formula')}
        </div>
        {axisOrder.map((axis) => {
          const ctr = country.contributions[axis]
          if (!ctr) return null
          return (
            <div key={axis} className="border-b border-surface-border last:border-b-0 py-sm">
              <div className="flex items-start justify-between gap-sm mb-xs">
                <div className="flex-1">
                  <div className="flex items-center gap-xs flex-wrap">
                    <span className="font-label-md text-label-md text-primary">{axisLabel(lang, axis)}</span>
                    {ctr.reverse ? (
                      <span className="px-[6px] py-[1px] rounded text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold" style={{ background: '#f7e4e0', color: '#c0533f' }}>
                        {t('rattr.reverseScore')}
                      </span>
                    ) : (
                      <span className="px-[6px] py-[1px] rounded text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold" style={{ background: '#e9f3ee', color: '#4f8a6d' }}>
                        {t('rattr.normalScore')}
                      </span>
                    )}
                    <span className="px-[6px] py-[1px] rounded text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold" style={{ background: '#eef0f2', color: '#3a4048' }}>
                      Tier {ctr.tier} ×{ctr.tier_multiplier}
                    </span>
                    <SourcePill flag="EXT" />
                  </div>
                  <div className="text-label-sm text-text-secondary mt-xs">{t('rattr.surveyItem')}: {ctr.source_item}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-label-sm text-text-secondary">{t('rattr.contributionCol')}</div>
                  <div className="font-semibold text-primary">{ctr.contribution}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-sm text-body-sm">
                <div>
                  <div className="text-label-sm text-text-secondary">{t('rattr.surveyValue')}</div>
                  <div className="text-primary font-medium">{ctr.raw_value}</div>
                </div>
                <div>
                  <div className="text-label-sm text-text-secondary">{t('rattr.normalized')}</div>
                  <div className="text-primary font-medium">{ctr.normalized}</div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden mt-xs">
                    <div className="h-full rounded-full" style={{ width: `${ctr.normalized}%`, background: normBarColor(ctr.normalized) }} />
                  </div>
                </div>
                <div>
                  <div className="text-label-sm text-text-secondary">{t('rattr.effectiveWeight')}</div>
                  <div className="text-primary font-medium">
                    {ctr.weight} × {ctr.tier_multiplier} = <strong>{ctr.effective_weight}</strong>
                  </div>
                </div>
                <div>
                  <div className="text-label-sm text-text-secondary">{t('rattr.contribFormula')}</div>
                  <div className="text-primary font-medium">
                    {ctr.normalized} × {ctr.effective_weight} = <strong>{ctr.contribution}</strong>
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
