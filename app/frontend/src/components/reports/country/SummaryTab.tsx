// 탭0 요약 — 네이비 그라디언트 헤더 + KPI(도넛/워터폴/막대) + 결정트리 + 구독료표 + 종합 인사이트
import type { CountryReportData } from '../types'
import { DecisionTreeSvg, DecisionSidePanel, Panel, intComma, locText, fixed } from './shared'
import { Money, useFx } from '../Money'
import { krwCompact } from '../../../utils/currency'

export function SummaryTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const dec = data.tabs.tab_1_2_decision
  const tco = data.tabs.tab_1_3_tco
  const score = sim.overall_score
  const countryKo = data.country_meta.country_ko
  const countryCode = data.target.country
  const baseCode = data.target.base_country
  // 베이스라인 국가 한글명 — 데이터엔 코드만 있어 GB→영국 등 간이 매핑.
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아' }
  const baseKo = baseKoMap[baseCode] ?? baseCode
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
  const decisionLabel =
    dec.decision === 'baseline_system_expansion'
      ? `권역 내 확산 (${baseKo} 시스템)`
      : dec.decision === 'hq_build'
        ? '본사 자체구축'
        : dec.decision === 'external_solution'
          ? '외부솔루션'
          : `권역 내 확산 (${baseKo} 시스템)` // 폴백(구버전 데이터)
  // 우측 패널 제목 — 결정별로 바뀐다(구독료/본사구축/외부솔루션).
  const sidePanelTitle =
    dec.decision === 'external_solution'
      ? '추천 외부솔루션'
      : dec.decision === 'hq_build'
        ? '본사 구축 예상 비용'
        : '구독료 구간표'

  const sub = tco.subscription_details ?? ({} as typeof tco.subscription_details)
  const buildMonths = tco.build_months ?? 0
  const baseMonths = tco.build_breakdown?.inputs?.['B 구축기간(개월)'] ?? tco.build_breakdown?.inputs?.['B 구축기간'] ?? 18
  const monthsSaved = baseMonths - buildMonths
  const monthsSavedPct = baseMonths ? Math.round((monthsSaved / baseMonths) * 100) : 0
  const recommendationText = locText(dec.recommendation)

  // 워터폴 KPI: 구축 / 구독료(10Y) / 유지보수(10Y) / 운영비(10Y) / 총TCO
  const wf = [
    { label: '구축비', value: tco.build_cost },
    { label: '구독료(10Y)', value: tco.annual_subscription * 10 },
    { label: '유지보수(10Y)', value: tco.annual_maintenance * 10 },
    { label: '운영비(10Y)', value: tco.operations_10y },
  ]
  const total = tco.total_tco_10y

  return (
    <div className="flex flex-col gap-xl">
      {/* AISea 다크 히어로 요약 카드(잉크블랙 + 라임그린 강조) */}
      <section
        className="rounded-[18px] px-[30px] py-[28px] card-shadow text-white"
        style={{ background: 'linear-gradient(120deg,#14181C,#1f262d)' }}
      >
        <div className="font-label-sm text-[12px] mb-sm" style={{ color: '#C8F051', letterSpacing: '.1em' }}>
          국가 진단 보고서 · IT 유사도
        </div>
        <div className="flex items-start justify-between gap-lg flex-wrap">
          <div className="flex-1 min-w-0" style={{ minWidth: 280 }}>
            <div className="flex items-center gap-sm mb-md">
              <img
                src={`https://flagcdn.com/w160/${flag}.png`}
                alt=""
                style={{ width: 34, height: 23, borderRadius: 3, objectFit: 'cover', boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }}
              />
              <span className="text-[28px] font-bold leading-none">
                {countryKo}({countryCode})
              </span>
            </div>
            <div className="flex flex-col gap-sm">
              <p className="font-body-md text-[15px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                <strong className="text-white">{countryKo}({countryCode})</strong>의 종합 유사도는 베이스라인{' '}
                <strong className="text-white">{baseKo}({baseCode})</strong> 대비{' '}
                <strong className="text-white">{fixed(score)}점/100</strong>으로, 이에 따라 시스템 결정은{' '}
                <strong className="text-white">{decisionLabel}</strong>(으)로 권고됩니다.
              </p>
              {isBaselineDeployed ? (
                <p className="font-body-md text-[15px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  {isBaselineSelf
                    ? `${countryKo}(${countryCode})은(는) 이미 시스템이 배포된 권역 기준국으로, 신규 구축·TCO 산정 대상이 아닙니다.`
                    : `${countryKo}(${countryCode})은(는) 이미 진출(운영중)한 국가로, 신규 구축·TCO 산정 대상이 아닙니다.`}
                </p>
              ) : (
                <p className="font-body-md text-[15px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  예상 10년 TCO는 <strong className="text-white"><Money value={total} currency={tco.currency} inline subClassName="text-white/70" /></strong>이며, 구축 기간은 약{' '}
                  <strong className="text-white">{fixed(tco.build_months)}개월</strong>, 예상 신규 계약은{' '}
                  <strong className="text-white">{intComma(tco.expected_contracts)}건/년</strong>으로 추정됩니다.
                </p>
              )}
              {recommendationText && (
                <p className="font-body-md text-[15px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,.9)' }}>
                  결론적으로, {recommendationText}을(를) 권고합니다.
                </p>
              )}
            </div>
          </div>
          <div className="text-center flex-none">
            <div className="font-bold leading-none" style={{ fontSize: 64, color: '#C8F051' }}>
              {fixed(score)}
            </div>
            <div className="font-body-sm text-[12px] mt-1" style={{ color: '#AEB6C4' }}>
              IT 유사도 점수
            </div>
            <div
              className="mt-sm rounded-[9px] px-[14px] py-[6px] font-body-sm text-[12px] font-semibold inline-block"
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
            <span className="font-headline-md text-headline-md text-primary tracking-tight">유사도 점수</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <ScoreDonut score={score} />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight">예상 10년 TCO</span>
          </div>
          <div className="flex-1 flex items-center">
            {isBaselineDeployed ? (
              <p className="font-body-sm text-body-sm text-text-secondary">기준국 — 신규 TCO 산정 대상 아님</p>
            ) : (
              <WaterfallMini steps={wf} total={total} currency={tco.currency} />
            )}
          </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-md">
            <span className="font-headline-md text-headline-md text-primary tracking-tight">예상 구축 기간</span>
          </div>
          {isBaselineDeployed ? (
            <div className="flex-1 flex items-center">
              <p className="font-body-sm text-body-sm text-text-secondary">기준국 — 구축 기간 해당 없음</p>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center">
                <BuildBars targetMonths={buildMonths} baseMonths={baseMonths} targetKo={countryKo} baseKo={baseKo} />
              </div>
              <p className="font-label-sm text-label-sm text-text-secondary mt-sm">
                베이스라인 대비{' '}
                <strong className="text-primary">
                  {fixed(monthsSaved)}M ({monthsSavedPct}%) 단축
                </strong>
              </p>
            </>
          )}
        </div>
      </div>

      {/* 결정트리(8/12) + 구독료표(4/12), 종합 인사이트(12/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
        <div className="lg:col-span-8 flex flex-col gap-xl">
          <Panel title="시스템 결정 트리" className="flex-1">
            {isBaselineDeployed ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                {recommendationText ||
                  `${countryKo}은(는) 이미 시스템이 운영 중인 국가로, 신규 진출 결정 트리는 적용되지 않습니다.`}
              </p>
            ) : (
              <DecisionTreeSvg
                score={score}
                baseCountryKo={baseKo}
                decision={dec.decision}
                regionSystemExists={dec.region_system_exists}
                expansionMin={dec.thresholds?.expansion_min_score}
                hqBuildMin={dec.thresholds?.hq_build_min_score}
              />
            )}
          </Panel>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-xl">
          <Panel title={sidePanelTitle} className="flex-1">
            <DecisionSidePanel
              decision={dec.decision}
              externalCandidates={dec.external_candidates}
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
          <Panel title="국가 종합 인사이트">
            <ul className="flex flex-col gap-sm list-none p-0 m-0">
              <li className="flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary text-[16px] mt-[2px]">arrow_right</span>
                <span className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {data.overall_insight}
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
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
  const W = 360
  const H = 240
  const top = 16
  const bottom = 216
  const max = total || 1
  const scale = (bottom - top) / max
  const bars = [...steps, { label: '10년 TCO', value: total, isTotal: true as const }]
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
