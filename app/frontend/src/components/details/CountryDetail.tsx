// CountryDetail (P1) — 국가 상세 정보 화면
// mockup: architecture/.../01_country_detail.html (Kinetic Enterprise).
// 레이아웃: 2열 그리드 — 좌(핵심 지표 추이 차트 + 경쟁 금융사 Top5 표·로즈 차트), 우(AI 인사이트 불릿 + 베이스라인 국가).
import type { ReactNode } from 'react'
import type { CountryDetailData, CountryReportData, DetailItem, RankedEntity } from '../reports/types'
import type { RoseChartDatum } from '../charts'
import { LineChart, RoseChart } from '../charts'
import { locText } from '../reports/country/shared'
<<<<<<< HEAD
import { useT, valueLabel } from '../../i18n/dict'
import { useLang } from '../../i18n/locale'
import type { Lang } from '../../store'
=======
import { RegulatoryGates, RecoveryRiskPanel, ITMaturityPanel } from './CountryDiagnostics'
>>>>>>> 42abc18 (야간 수술)

interface Props {
  data: CountryDetailData
  className?: string
  /** 최신 국가 보고서 — "진출 정보" 패널의 시스템 결정·IT 유사도·베이스라인·기준 솔루션 출처. 미생성 시 null. */
  report?: CountryReportData | null
  /** 진출 상태 라벨(DetailView 헤더와 동일 기준: 운영중/기진출/미진출/진출예정/기준국 등). */
  entryStatus?: string
  /** 진출 상태 배지 스타일(DetailView 헤더와 동일). */
  entryStatusStyle?: string
  /** 권역 베이스라인 국가의 한국어명(있으면 코드와 함께 표기). */
  baselineNameKo?: string
  /** 기진출국 여부 — true면 실제 진출 자산(솔루션·법인유형·진출일)을 표시, false면 보고서 기반 결정/유사도. */
  entered?: boolean
  /** 진출국 사용 솔루션(country_assets.solution). */
  entrySolution?: string
  /** 진출 법인유형 라벨(country_assets.type → '단독법인'|'JV'). */
  entryMode?: string
  /** 진출연도(country_assets.since). */
  entrySince?: number
}

// overall_insight 문장을 불릿으로 분리(마침표 기준, 약어 오분할 방지로 최소 길이 컷).
function toBullets(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[.。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
}

function findItem(items: DetailItem[], name: string): DetailItem | undefined {
  return items.find((it) => it.item.includes(name))
}

// market_share 문자열("약 20%"·"15%"·"~6 %" 등)에서 첫 숫자를 점유율(%)로 파싱. 없으면 null.
function parseShare(raw?: string): number | null {
  if (!raw) return null
  const m = raw.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}

export function CountryDetail({
  data,
  className = '',
  report = null,
  entryStatus,
  entryStatusStyle = 'bg-surface-container text-on-surface-variant',
  baselineNameKo,
  entered = false,
  entrySolution,
  entryMode,
  entrySince,
}: Props) {
  const t = useT()
  const lang = useLang()
  const items = data.items || []

  // "진출 정보" 패널 값 — 시스템 결정·IT 유사도·베이스라인·기준 솔루션은 보고서(tab_1_2/1_1)에서.
  const decision = report?.tabs.tab_1_2_decision
  const systemDecision = decision ? locText(decision.recommendation, lang) || undefined : undefined
  // IT 유사도: similarity 탭 overall_score(=decision.similarity_score) 우선.
  const itSimilarity =
    report?.tabs.tab_1_1_similarity?.overall_score ?? decision?.similarity_score
  const baseCountry = decision?.base_country
  const baseSystem = decision?.base_system

  // 차트: timeseries 보유 score 항목 중 GDP 성장률 + 신차 판매대수 우선(둘 다 mockup 계열).
  const gdp = findItem(items, 'GDP 성장률')
  const sales = findItem(items, '신차 판매대수')
  // 오토금융 이용률(신차) 시계열 — 절대 이용률(%)을 그대로 보여준다.
  // GDP 성장률과 스케일이 달라(이용률 65~77% vs 성장률 -1~5%) LineChart의 독립 y축(normalizeEach)으로 겹친다.
  const autoFin = findItem(items, '금융 이용률')

  // 경쟁 금융사 Top (금융사 순위 value=객체배열).
  const finRank = findItem(items, '금융사 순위')
  const competitors: RankedEntity[] = Array.isArray(finRank?.value)
    ? (finRank!.value as RankedEntity[]).slice(0, 5)
    : []

  // 로즈 차트 데이터 — market_share("약 20%" 등)에서 숫자를 파싱해 점유율로 인코딩.
  const roseData: RoseChartDatum[] = competitors
    .map((c): RoseChartDatum | null => {
      const num = parseShare(c.market_share)
      return num != null
        ? { label: c.name, value: num, display: c.market_share ?? `${num}%` }
        : null
    })
    .filter((d): d is RoseChartDatum => d !== null)

  const bullets = toBullets(
    lang === 'en' && data.overall_insight_en ? data.overall_insight_en : data.overall_insight,
  ).slice(0, 6)

  // 규제 신호등 권위 판정 — 보고서(tab_1_2_decision)가 분류한 gate_result(PASS/FLAG/FAIL)를
  // 항목명 부분키 → 상태로 매핑한다(있는 항목만; 없으면 신호등 컴포넌트가 휴리스틱 폴백).
  const gateResults: Record<string, 'good' | 'mid' | 'low'> = {}
  for (const it of decision?.items ?? []) {
    if (it.role !== 'gate' || !it.gate_result) continue
    const r = String(it.gate_result).toUpperCase()
    const status = r === 'PASS' ? 'good' : r === 'FAIL' ? 'low' : 'mid'
    // GATE_ITEMS와 동일한 부분키로 등록(항목명에서 추출).
    for (const key of ['외국인 지분', '외환', '데이터 현지화', '국가신용등급', '라이선스 취득', '라이선스 체제', '금리 상한']) {
      if (it.item.includes(key)) gateResults[key] = status
    }
  }

  return (
    <div className={`flex-1 bg-background flex items-start justify-center p-md ${className}`}>
      <div className="relative z-chrome max-w-[min(92vw,1760px)] w-full mx-auto border border-surface-border rounded-xl card-shadow flex flex-col bg-surface-container-lowest">
        <div className="p-lg flex flex-col gap-xl">
          {/* 국가명·상태 배지는 DetailView 헤더 chrome에 이미 노출 — 바디 중복 제거 */}
          {/* 본문 2열 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {/* 좌: 차트 + 경쟁사 */}
            <div className="flex flex-col gap-lg">
              <div className="border border-surface-border rounded-lg p-md bg-surface">
                <div className="flex justify-between items-center mb-md">
                  <h4 className="font-label-md text-label-md text-on-surface-variant">
                    {t('dtl.keyTrend')}
                  </h4>
                </div>
                {gdp?.timeseries ? (
                  <LineChart
                    data={gdp.timeseries}
                    seriesLabel={t('dtl.chart.gdp')}
                    secondary={autoFin?.timeseries ?? null}
                    secondaryLabel={t('dtl.chart.autoFin')}
                    normalizeEach
                  />
                ) : autoFin?.timeseries ? (
                  <LineChart data={autoFin.timeseries} seriesLabel={t('dtl.chart.autoFinShort')} height={160} />
                ) : sales?.timeseries ? (
                  <LineChart data={sales.timeseries} seriesLabel={t('dtl.chart.sales')} height={160} />
                ) : (
                  <p className="font-body-sm text-body-sm text-on-surface-variant py-md">
                    {t('dtl.noTimeseries')}
                  </p>
                )}
              </div>

              {/* 경쟁 금융사 점유율 — 표 없이 로즈 차트(범례에 순위·금융사·점유율 포함). */}
              {roseData.length >= 2 && (
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary mb-md">
                    {t('dtl.competitorTop').replace('{n}', String(competitors.length))}
                  </h3>
                  <div className="border border-surface-border rounded-lg p-md bg-surface">
                    <RoseChart data={roseData} />
                  </div>
                </div>
              )}
            </div>

            {/* 우: AI 인사이트 + 베이스라인 */}
            <div className="flex flex-col gap-lg lg:border-l border-surface-border lg:pl-lg">
<<<<<<< HEAD
              <h3 className="font-headline-md text-headline-md text-primary -mb-2">
                {t('dtl.aiInsight')}
              </h3>
              <ul className="flex flex-col gap-xs">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-sm py-[2px] first:pt-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-[8px] shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
=======
              {/* 권역 상세 인사이트(RegionInsight)와 동일한 다크 히어로 카드 —
                  잉크블랙 그라디언트 + 라임그린(#C8F051) 라벨 + AI 아이콘(ai_icon.png). */}
              <div
                className="rounded-[18px] px-[30px] py-[28px] custom-shadow-level-3 text-white"
                style={{ background: 'linear-gradient(120deg,#14181C,#1f262d)' }}
              >
                <div
                  className="font-label-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] mb-sm"
                  style={{ color: '#C8F051', letterSpacing: '.1em' }}
                >
                  국가 진단 · AI 인사이트
                </div>
                <div className="flex items-center gap-sm mb-md">
                  <img
                    src={`${import.meta.env.BASE_URL}brand/ai_icon.png`}
                    alt=""
                    aria-hidden="true"
                    className="w-6 h-6 shrink-0 object-contain"
                  />
                  <h3 className="text-[clamp(18.7px,calc(16.5px_+_0.611vw),25.3px)] font-bold leading-none text-white m-0">
                    AI 인사이트
                  </h3>
                </div>
                <div className="flex flex-col gap-sm [&_strong]:text-white">
                  {bullets.map((b, i) => (
                    <p
                      key={i}
                      className="font-body-md text-[clamp(12.75px,calc(11.25px_+_0.417vw),17.25px)] leading-[1.6] m-0"
                      style={{ color: 'rgba(255,255,255,.9)' }}
                    >
>>>>>>> 42abc18 (야간 수술)
                      {b}
                    </p>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-headline-md text-headline-md text-primary mb-sm">
                  {t('dtl.entryInfo')}
                </h3>
                <div className="border border-surface-border rounded-lg bg-surface overflow-hidden divide-y divide-surface-border">
                  {/* 진출 상태 — 항상 표시(배지). */}
                  <InfoRow label={t('dtl.row.status')}>
                    {entryStatus ? (
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 font-label-md text-label-md ${entryStatusStyle}`}
                      >
                        {entryStatus}
                      </span>
                    ) : (
                      <Pending />
                    )}
                  </InfoRow>

                  {entered ? (
                    /* 기진출국: 실제 진출 자산(솔루션·법인유형·진출일). */
                    <>
                      <InfoRow label={t('dtl.row.solution')}>
                        <span className="font-body-md text-body-md text-on-surface">
                          {entrySolution || <Pending />}
                        </span>
                      </InfoRow>
                      <InfoRow label={t('dtl.row.entityType')}>
                        {entryMode ? <EntityModeBadge mode={entryMode} lang={lang} /> : <Pending />}
                      </InfoRow>
                      <InfoRow label={t('dtl.row.entryDate')}>
                        <span className="font-body-md text-body-md text-on-surface whitespace-nowrap">
                          {entrySince != null ? `${entrySince}${t('dtl.year')}` : <Pending />}
                        </span>
                      </InfoRow>
                    </>
                  ) : (
                    /* 미진출국: 보고서(tab_1_2/1_1) 기반 시스템 결정·유사도·베이스라인·기준 솔루션. */
                    <>
                      <InfoRow label={t('dtl.row.systemDecision')}>
                        <span className="font-body-md text-body-md text-on-surface leading-relaxed">
                          {systemDecision ?? <Pending />}
                        </span>
                      </InfoRow>
                      <InfoRow label={t('dtl.row.itSim')}>
                        {itSimilarity != null ? (
                          <span className="font-label-md text-label-md text-secondary font-semibold whitespace-nowrap">
                            {itSimilarity.toFixed(1)}{' '}
                            <span className="text-outline font-normal">/ 100</span>
                          </span>
                        ) : (
                          <Pending />
                        )}
                      </InfoRow>
                      <InfoRow label={t('dtl.row.baseline')}>
                        {baseCountry ? (
                          <span className="inline-flex items-center gap-xs font-body-md text-body-md text-on-surface whitespace-nowrap">
                            <img
                              alt=""
                              aria-hidden
                              src={`https://flagcdn.com/w20/${baseCountry.toLowerCase()}.png`}
                              className="h-3.5 w-5 rounded-sm object-cover"
                              loading="lazy"
                            />
                            {baselineNameKo ? `${baselineNameKo} (${baseCountry})` : baseCountry}
                          </span>
                        ) : (
                          <Pending />
                        )}
                      </InfoRow>
                      <InfoRow label={t('dtl.row.baseSystem')}>
                        <span className="font-body-md text-body-md text-on-surface">
                          {baseSystem ?? <Pending />}
                        </span>
                      </InfoRow>
                    </>
                  )}
                </div>
                {!entered && !report && (
                  <p className="mt-xs font-label-sm text-label-sm text-outline">
                    {t('dtl.afterReport')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 진입 환경 진단 — 보고서(PR1)에 없는 원천 데이터 시각화.
              ① 진입 규제 신호등(전폭) ③ 채권 회수·리스크 ④ IT 인프라 성숙도(2열). */}
          <RegulatoryGates items={items} gateResults={gateResults} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <RecoveryRiskPanel items={items} />
            <ITMaturityPanel items={items} />
          </div>
        </div>
      </div>
    </div>
  )
}

// 진출 정보 패널 행 — 좌측 라벨 + 우측 값(우측 정렬).
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-md py-sm px-md">
      <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider shrink-0">
        {label}
      </span>
      <span className="min-w-0 text-right break-words">{children}</span>
    </div>
  )
}

// 법인 유형 태그 — 라벨('단독법인'|'JV') → 색. 권역 팝업(RegionDetail) Badge 팔레트와 동일.
const ENTITY_MODE_STYLE: Record<string, { bg: string; fg: string }> = {
  단독법인: { bg: '#e9f3ee', fg: '#4f8a6d' },
  JV: { bg: '#fbf0e6', fg: '#c08a2e' },
}
function EntityModeBadge({ mode, lang }: { mode: string; lang: Lang }) {
  const style = ENTITY_MODE_STYLE[mode] ?? { bg: '#eef1f5', fg: '#475569' }
  const label = valueLabel('entityMode', mode, lang)
  return (
    <span
      className="inline-block px-2 py-0.5 rounded font-label-sm text-label-sm whitespace-nowrap"
      style={{ background: style.bg, color: style.fg }}
    >
      {label}
    </span>
  )
}

// 보고서 미생성 시 값 자리 표시.
function Pending() {
  return <span className="font-body-md text-body-md text-on-surface-variant">—</span>
}
