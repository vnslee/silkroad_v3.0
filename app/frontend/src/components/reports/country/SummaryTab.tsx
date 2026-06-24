// 탭0 요약 — 네이비 그라디언트 헤더 + KPI(도넛/워터폴/막대) + 결정트리 + 구독료표 + 종합 인사이트
import type { CountryReportData } from '../types'
import { DecisionTreeSvg, DecisionSidePanel, Panel, intComma, locText, fixed } from './shared'
import { Money, useFx } from '../Money'
import { krwCompact } from '../../../utils/currency'
import { useT } from '../../../i18n/dict'
import { useLang } from '../../../i18n/locale'

export function SummaryTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const dec = data.tabs.tab_1_2_decision
  const tco = data.tabs.tab_1_3_tco
  const score = sim.overall_score
  const t = useT()
  const lang = useLang()
  // 영어 모드면 국가명도 영문(country)으로 — 한국어면 한글명.
  const countryKo = lang === 'en' ? data.country_meta.country : data.country_meta.country_ko
  const countryCode = data.target.country
  const baseCode = data.target.base_country
  // 베이스라인 국가명 — 데이터엔 코드만 있어 간이 매핑(ko/en).
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아', AU: '호주', CL: '칠레' }
  const baseEnMap: Record<string, string> = { GB: 'UK', US: 'USA', DE: 'Germany', FR: 'France', IT: 'Italy', AU: 'Australia', CL: 'Chile' }
  const baseKo = (lang === 'en' ? baseEnMap[baseCode] : baseKoMap[baseCode]) ?? baseCode
  const flag = countryCode.toLowerCase()

  // 기준국·이미 진출(운영중)한 국가는 TCO/구축 산식이 없어 build_months 등이 null → KPI 분기.
  const isBaselineDeployed =
    dec.is_already_deployed ||
    tco.is_already_deployed ||
    dec.decision === 'baseline_already_deployed' ||
    dec.decision === 'already_deployed' ||
    tco.build_months == null
  // 기준국 자가분석인지(=베이스라인 본인) — 안내 문구 분기에 사용.
  const isBaselineSelf = dec.is_baseline || dec.decision === 'baseline_already_deployed'

  // 시스템 결정 라벨 — 엔진 decision 기준(하드코딩 금지). 요약 헤더/뱃지에서 공용.
  // APAC(apac_dual)은 외부솔루션·자체구축을 양쪽 동등 제시 — 분기 없음.
  const decisionLabel =
    dec.decision === 'apac_dual'
      ? t('sum.dec.apac')
      : dec.decision === 'baseline_system_expansion'
        ? t('sum.dec.expansion').replace('{base}', baseKo)
        : dec.decision === 'hq_build'
          ? t('sum.dec.hq')
          : dec.decision === 'external_solution'
            ? t('sum.dec.ext')
            : t('sum.dec.expansion').replace('{base}', baseKo) // 폴백(구버전 데이터)
  // 구독제(EU/NetSol) 여부 — is_subscription 우선, 구버전 데이터는 구독료 티어 존재로 추론.
  // 비구독(미주 권역 확산 등)이면 구독료 구간표 대신 구축비용·기간을 노출(TCO 탭과 일관).
  const isSubscription = tco.is_subscription ?? (tco.subscription_tiers?.length ?? 0) > 0
  // 우측 패널 제목 — 결정별로 바뀐다(구독료/구축비용/본사구축/외부솔루션).
  const sidePanelTitle =
    dec.decision === 'apac_dual'
      ? t('sum.side.apac')
      : dec.decision === 'external_solution'
        ? t('sum.side.ext')
        : dec.decision === 'hq_build'
          ? t('sum.side.hq')
          : isSubscription
            ? t('sum.side.sub')
            : t('sum.side.build')

  const sub = tco.subscription_details ?? ({} as typeof tco.subscription_details)
  const buildMonths = tco.build_months ?? 0
  // APAC — 기준국(AU) 자산 고정값(승수 미적용). 베이스라인 대비 '단축' 개념이 없다.
  const isApacFixed = tco.build_method === 'apac_fixed'
  const baseMonths =
    tco.build_breakdown?.inputs?.['B 구축기간(개월)'] ??
    tco.build_breakdown?.inputs?.['B 구축기간'] ??
    tco.build_breakdown?.inputs?.['기준국 구축기간(개월)'] ??
    18
  const monthsSaved = baseMonths - buildMonths
  const monthsSavedPct = baseMonths ? Math.round((monthsSaved / baseMonths) * 100) : 0
  const recommendationText = locText(dec.recommendation, lang)

  // 워터폴 KPI: 구축 / 구독료(10Y) / 유지보수(10Y) / 운영비(10Y) / 총TCO
  const wf = [
    { label: t('sum.wf.build'), value: tco.build_cost },
    { label: t('sum.wf.sub'), value: tco.annual_subscription * 10 },
    { label: t('sum.wf.maint'), value: tco.annual_maintenance * 10 },
    { label: t('sum.wf.ops'), value: tco.operations_10y },
  ]
  const total = tco.total_tco_10y

  return (
    <div className="flex flex-col gap-xl">
      {/* AISea 다크 히어로 요약 카드(잉크블랙 + 라임그린 강조) */}
      <section
        className="rounded-[18px] px-[30px] py-[28px] card-shadow text-white"
        style={{ background: 'linear-gradient(120deg,#14181C,#1f262d)' }}
      >
        <div className="font-label-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] mb-sm" style={{ color: '#C8F051', letterSpacing: '.1em' }}>
          {t('sum.hero.eyebrow')}
        </div>
        <div className="flex items-start justify-between gap-lg flex-wrap">
          <div className="flex-1 min-w-0" style={{ minWidth: 280 }}>
            <div className="flex items-center gap-sm mb-md">
              <img
                src={`https://flagcdn.com/w160/${flag}.png`}
                alt=""
                style={{ width: 34, height: 23, borderRadius: 3, objectFit: 'cover', boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }}
              />
              <span className="text-[clamp(23.8px,calc(21px_+_0.778vw),32.2px)] font-bold leading-none">
                {countryKo}({countryCode})
              </span>
            </div>
            <div className="flex flex-col gap-sm">
              <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                {t('sum.hero.line1')
                  .replace('{country}', `${countryKo}(${countryCode})`)
                  .replace('{base}', `${baseKo}(${baseCode})`)
                  .replace('{score}', fixed(score))
                  .replace('{decision}', decisionLabel)}
              </p>
              {isBaselineDeployed ? (
                <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  {(isBaselineSelf ? t('sum.hero.baselineSelf') : t('sum.hero.deployed')).replace('{country}', `${countryKo}(${countryCode})`)}
                </p>
              ) : (
                <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  {t('sum.hero.tcoPre')}{' '}
                  <strong className="text-white"><Money value={total} currency={tco.currency} inline subClassName="text-white/70" /></strong>
                  {t('sum.hero.tcoMid').replace('{months}', fixed(tco.build_months)).replace('{contracts}', intComma(tco.expected_contracts))}
                </p>
              )}
              {recommendationText && (
                <p className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  {t('sum.hero.conclusion').replace('{rec}', recommendationText)}
                </p>
              )}
            </div>
          </div>
          <div className="text-center flex-none">
            <div className="font-bold leading-none" style={{ fontSize: 'clamp(54.4px, calc(48px + 1.778vw), 73.6px)', color: '#C8F051' }}>
              {fixed(score)}
            </div>
            <div className="font-body-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] mt-1" style={{ color: '#AEB6C4' }}>
              {t('sum.itSimScore')}
            </div>
            <div
              className="mt-sm rounded-[9px] px-[14px] py-[6px] font-body-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] font-semibold inline-block"
              style={{ background: 'rgba(200,240,81,.16)', border: '1px solid rgba(200,240,81,.4)', color: '#C8F051' }}
            >
              {decisionLabel}
            </div>
          </div>
        </div>
      </section>

      {/* KPI 3종: 유사도 도넛 / TCO 워터폴 / 구축기간 막대 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight">{t('sum.kpi.simScore')}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <ScoreDonut score={score} />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight">{t('sum.kpi.tco')}</span>
          </div>
          <div className="flex-1 flex items-center">
            {isBaselineDeployed ? (
              <p className="font-body-sm text-body-sm text-text-secondary">{(isBaselineSelf ? t('sum.baselineLabel') : t('sum.operatingLabel'))} — {t('sum.noTco')}</p>
            ) : (
              <WaterfallMini steps={wf} total={total} currency={tco.currency} />
            )}
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight">{t('sum.kpi.buildMonths')}</span>
          </div>
          {isBaselineDeployed ? (
            <div className="flex-1 flex items-center">
              <p className="font-body-sm text-body-sm text-text-secondary">{(isBaselineSelf ? t('sum.baselineLabel') : t('sum.operatingLabel'))} — {t('sum.noBuild')}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center">
                <BuildBars targetMonths={buildMonths} baseMonths={baseMonths} targetKo={countryKo} baseKo={baseKo} />
              </div>
              <p className="font-label-sm text-label-sm text-text-secondary mt-sm">
                {isApacFixed
                  ? t('sum.buildNoteApac').replace('{base}', baseKo)
                  : t('sum.buildNote').replace('{months}', fixed(monthsSaved)).replace('{pct}', String(monthsSavedPct))}
              </p>
            </>
          )}
        </div>
      </div>

      {/* 결정트리(8/12) + 구독료표(4/12), 종합 인사이트(12/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
        <div className="lg:col-span-8 flex flex-col gap-xl">
          <Panel title={t('sum.decisionTree')} className="flex-1">
            {isBaselineDeployed ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {recommendationText || t('sum.noDecisionTree').replace('{country}', countryKo)}
              </p>
            ) : (
              <DecisionTreeSvg
                score={score}
                baseCountryKo={baseKo}
                decision={dec.decision}
                regionSystemExists={dec.region_system_exists}
                expansionMin={dec.thresholds?.expansion_min_score}
                hqBuildMin={dec.thresholds?.hq_build_min_score}
                isApac={dec.is_apac === true}
              />
            )}
          </Panel>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-xl">
          <Panel title={sidePanelTitle} className="flex-1">
            <DecisionSidePanel
              decision={dec.decision}
              isSubscription={isSubscription}
              buildCost={tco.build_cost}
              buildMonths={tco.build_months}
              buildCurrency={tco.currency}
              externalCandidates={dec.external_candidates}
              externalSolutionSummary={dec.external_solution_summary}
              hqBaselineCost={dec.hq_baseline_cost}
              hqBaselineMonths={dec.hq_baseline_months}
              hqBaselineCurrency={dec.hq_baseline_currency}
              subscription={{
                tiers: tco.subscription_tiers,
                appliedPrice: sub.unit_price,
                existing: sub.existing_volume ?? tco.existing_total_volume,
                newAdded: sub.new_volume ?? tco.expected_contracts,
                newCumulative: sub.total_volume ?? (tco.existing_total_volume + tco.expected_contracts),
                currency: sub.currency ?? tco.currency,
              }}
            />
          </Panel>
        </div>
        <div className="lg:col-span-12">
          <Panel title={t('sum.overallInsight')}>
            <ul className="flex flex-col gap-sm list-none p-0 m-0">
              {splitSentences(lang === 'en' && data.overall_insight_en ? data.overall_insight_en : data.overall_insight).map((sentence, i) => (
                <li key={i} className="flex items-start gap-sm">
                  <span className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    {sentence}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// 종합 인사이트 한 문단을 문장 단위 불릿으로 분리.
// 마침표 뒤가 공백/끝일 때만 자르되, 소수점·금액(12.9%, €5M 등)은 앞 글자가 숫자이므로 자르지 않는다.
function splitSentences(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/(?<=[^\d]\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// 유사도 점수 도넛(KPI) — mockup viewBox 160x160, secondary 색
function ScoreDonut({ score }: { score: number }) {
  const r = 53
  const cx = 80
  const cy = 80
  const circ = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(100, score)) / 100
  return (
    <svg viewBox="0 0 160 160" className="w-full max-w-[220px] h-auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`유사도 점수 ${fixed(score)}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e6e3db" strokeWidth="22" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#14181C"
        strokeWidth="22"
        strokeLinecap="round"
        strokeDasharray={`${(frac * circ).toFixed(1)} ${circ.toFixed(1)}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y="91" textAnchor="middle" fontSize="38" fontWeight="800" fill="#14181C">
        {fixed(score)}
      </text>
    </svg>
  )
}

// TCO 워터폴(KPI) — 누적 막대, 마지막 총합 강조
function WaterfallMini({ steps, total, currency }: { steps: { label: string; value: number }[]; total: number; currency: string }) {
  const fx = useFx()
  const t = useT()
  const W = 360
  const H = 240
  const top = 16
  const bottom = 216
  const max = total || 1
  const scale = (bottom - top) / max
  const bars = [...steps, { label: t('sum.wf.total'), value: total, isTotal: true as const }]
  let cum = 0
  const barW = 42.24
  const gap = 64
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="10년 TCO 워터폴">
      <line x1="24" y1={bottom} x2="344" y2={bottom} stroke="#e6e3db" strokeWidth="1" />
      {bars.map((b, i) => {
        const isTotal = 'isTotal' in b
        const h = b.value * scale
        const x = 24 + i * gap
        let y: number
        if (isTotal) {
          y = bottom - h
          cum = 0
        } else {
          y = bottom - cum * scale - h
          cum += b.value
        }
        const color = isTotal ? '#14181C' : '#e6e3db'
        const labelColor = isTotal ? '#14181C' : '#9aa0a6'
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, 2)} fill={color} rx="3" />
            <text x={x + barW / 2} y={y - 6} fontSize={isTotal ? 11 : 10} fill={labelColor} fontWeight="700" textAnchor="middle">
              {isTotal ? krwCompact(b.value, currency, fx) : `+${krwCompact(b.value, currency, fx)}`}
            </text>
            <text x={x + barW / 2} y={230} fontSize="9.5" fill="#3a4048" textAnchor="middle">
              {b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// 구축기간 비교 막대(KPI)
function BuildBars({ targetMonths, baseMonths, targetKo, baseKo }: { targetMonths: number; baseMonths: number; targetKo: string; baseKo: string }) {
  const W = 360
  const H = 168
  const full = 316
  const max = Math.max(targetMonths, baseMonths) || 1
  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="구축 기간 비교">
      <text x="0" y="19" fontSize="15" fill="#3a4048" fontWeight="700">{targetKo}</text>
      <rect x="0" y="30" width={full} height="30" rx="5" fill="#f2f0e9" />
      <rect x="0" y="30" width={(targetMonths / max) * full} height="30" rx="5" fill="#14181C" />
      <text x={(targetMonths / max) * full + 8} y="49" fontSize="13" fill="#14181C" fontWeight="700">{targetMonths.toFixed(1)}M</text>
      <text x="0" y="99" fontSize="15" fill="#3a4048" fontWeight="700">{baseKo}</text>
      <rect x="0" y="110" width={full} height="30" rx="5" fill="#f2f0e9" />
      <rect x="0" y="110" width={(baseMonths / max) * full} height="30" rx="5" fill="#e6e3db" />
      <text x={(baseMonths / max) * full + 8} y="129" fontSize="13" fill="#9aa0a6" fontWeight="700">{baseMonths.toFixed(1)}M</text>
    </svg>
  )
}
