// PR1 국가 보고서 — 탭 공유 컴포넌트/유틸 (mockup 03_country_report 충실 이식)
// 색은 시맨틱 Tailwind 클래스 우선. mockup 고유 raw hex(차트)는 인라인 style로 그대로 사용.
import type { ReactNode } from 'react'
import type { ReportItem } from '../types'
import type { TimeseriesData } from '../../charts/types'
import { Money } from '../Money'

/** 통화 €1,234 포맷 (mockup: 천단위 콤마, 소수 없음) */
export function eur(value: number | null | undefined, symbol = '€'): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${symbol}${Math.round(value).toLocaleString('en-US')}`
}

/** 통화 코드 → 심볼. 매핑 없으면 코드+공백 폴백. */
const CCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', KRW: '₩', GBP: '£' }

/**
 * 통화-인식 금액 포맷. 엔진이 권역 표시통화로 이미 환산한 값을 받아 기호/단위만 입힌다.
 * - KRW: 억 단위 표기(0.1억 단위 반올림). 예 11,600,000 → "₩0.1억", 850,000,000 → "₩8.5억".
 * - 그 외(EUR/USD 등): 기호 + 천단위 콤마, 소수 없음.
 */
export function money(value: number | null | undefined, currency = 'EUR'): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  if (currency === 'KRW') {
    const eok = Math.round((value / 1e8) * 10) / 10 // 0.1억 단위
    return `₩${eok}억`
  }
  const sym = CCY_SYMBOL[currency] ?? currency + ' '
  return `${sym}${Math.round(value).toLocaleString('en-US')}`
}

/** 천단위 콤마 정수 */
export function intComma(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/** 다국어 {ko,en} 또는 문자열을 한국어 텍스트로 안전 변환(React child로 객체 렌더 방지) */
export function locText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.ko === 'string') return o.ko
    if (typeof o.en === 'string') return o.en
  }
  return String(value)
}

/** 숫자 .toFixed 안전 래퍼 — null/undefined/NaN이면 dash 반환 */
export function fixed(value: number | null | undefined, digits = 1, dash = '—'): string {
  if (value === null || value === undefined || isNaN(value)) return dash
  return value.toFixed(digits)
}

/**
 * 임의 스칼라값을 표시 문자열로 안전 변환 — null/undefined면 '—'(리서치 데이터 필드
 * 누락 시 화면에 "undefined"가 그대로 노출되던 회귀 방지). 빈 String(...) 대체용.
 */
export function dash(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

/** 캡티브 금융사/OEM 화이트리스트 (백엔드 _CAPTIVE_HINTS 이식) */
const CAPTIVE_HINTS = [
  'Toyota', 'Volkswagen', 'VW', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Audi',
  'Ford', 'Renault', 'Hyundai', 'Kia', 'Honda', 'Nissan', 'Peugeot',
  'Stellantis', 'Fiat', 'Volvo', 'SEAT', 'Skoda', 'Santander Consumer',
  'BMW Bank', 'Volkswagen Financial', 'Toyota Financial', 'Mercedes-Benz Bank',
  'Ford Credit', 'Hyundai Capital', 'Kia Capital', 'Renault Bank',
]
export function hasCaptiveHint(name: string | undefined | null): boolean {
  if (!name) return false
  const lower = String(name).toLowerCase()
  return CAPTIVE_HINTS.some((k) => lower.includes(k.toLowerCase()))
}

/** "약 20%" / "8.39%" → 숫자 추출 */
export function parseShare(raw: any): number {
  if (raw === null || raw === undefined) return 0
  const m = String(raw).match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

// ── 섹션 카드(흰 카드 + 아이콘 헤더) ────────────────────────────
interface PanelProps {
  icon?: string
  title: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
}
export function Panel({ title, right, children, className = '' }: PanelProps) {
  return (
    <section
      className={`bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow ${className}`}
    >
      <div className="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
        <div className="flex items-center gap-sm">
          <h2 className="font-headline-md text-headline-md text-primary m-0">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

// ── 캡티브 칩 ───────────────────────────────────────────────────
export function CaptiveChip() {
  return (
    <span
      className="inline-flex items-center gap-xs bg-secondary-container/30 text-secondary border border-secondary/40 px-2 py-[1px] rounded-full font-label-sm text-label-sm"
      title="캡티브 금융사 보유 추정"
    >
      <span className="material-symbols-outlined text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)]">verified</span>
      <span>캡티브</span>
    </span>
  )
}

// ── Tier 배지(원천 데이터 항목) ─────────────────────────────────
const TIER_STYLE: Record<number, string> = {
  1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  2: 'bg-blue-100 text-blue-800 border-blue-200',
  3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  4: 'bg-surface-container text-text-secondary border-surface-border',
}
export function TierBadge({ tier }: { tier?: number }) {
  if (!tier) return null
  const style = TIER_STYLE[tier] ?? TIER_STYLE[4]
  return (
    <span className={`border px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase ${style}`}>
      Tier {tier}
    </span>
  )
}

// ── 인사이트 박스(좌측 강조선) ──────────────────────────────────
export function InsightBox({
  children,
  label = '인사이트',
  icon = 'lightbulb',
}: {
  children: ReactNode
  label?: string
  icon?: string
}) {
  return (
    <div className="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
      <div className="flex items-center gap-xs mb-xs">
        <span className="material-symbols-outlined text-primary text-[clamp(11.9px,calc(10.5px_+_0.389vw),16.1px)]">{icon}</span>
        <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{children}</p>
    </div>
  )
}

// ── 근거·인사이트 아코디언(details) ─────────────────────────────
export function EvidenceAccordion({ source, insight, ai }: { source?: string; insight?: string; ai?: boolean }) {
  if (!source && !insight) return null
  return (
    <details className="border-t border-surface-container-highest pt-sm group">
      <summary className="flex items-center justify-between gap-xs cursor-pointer list-none">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-text-secondary text-[clamp(11.9px,calc(10.5px_+_0.389vw),16.1px)]">info</span>
          <span className="font-label-sm text-label-sm text-text-secondary uppercase">근거 · 인사이트</span>
          {ai && (
            <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">
              AI
            </span>
          )}
        </div>
        <span className="material-symbols-outlined text-text-secondary text-[clamp(13.6px,calc(12px_+_0.444vw),18.4px)] transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="flex flex-col gap-sm mt-sm">
        {source && (
          <div>
            <div className="flex items-center gap-xs mb-xs">
              <span className="material-symbols-outlined text-text-secondary text-[clamp(11.9px,calc(10.5px_+_0.389vw),16.1px)]">source</span>
              <span className="font-label-sm text-label-sm text-text-secondary uppercase">근거</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{source}</p>
          </div>
        )}
        {insight && <InsightBox>{insight}</InsightBox>}
      </div>
    </details>
  )
}

/** 원천 데이터 항목의 값 표시(문자열/숫자+단위). 순위형 list는 별도 처리. */
function ItemValue({ item }: { item: ReportItem }) {
  const { value, unit } = item
  if (Array.isArray(value)) return null
  if (typeof value === 'number') {
    return (
      <div className="font-body-md text-body-md text-primary text-right max-w-[55%] font-semibold">
        <span className="font-semibold">{intComma(value)}</span>{' '}
        {unit && <span className="text-text-secondary font-body-sm">{unit}</span>}
      </div>
    )
  }
  // 콤마(,)로 구분된 다중 세그먼트 값은 줄바꿈해서 가독성을 높인다.
  // 단, 괄호 안 콤마(예: "(S.A., 최저자본)")는 분리하지 않는다.
  // 값이 비면 dash()로 '—' 폴백.
  const text = dash(value)
  const segments = splitTopLevelCommas(text)
  return (
    <div className="font-body-md text-body-md text-primary text-right max-w-[55%] font-semibold">
      {segments.length > 1
        ? segments.map((seg, i) => <div key={i}>{seg}</div>)
        : text}
    </div>
  )
}

/** 괄호 밖 콤마(, 또는 、)만 기준으로 분리. 괄호 안 콤마는 보존한다. */
function splitTopLevelCommas(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '（') depth++
    else if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === '、') && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

// ── 원천 데이터 항목 카드(라벨 + 값 + 게이트배지 + 선택적 차트 + 아코디언) ──
export function EvidenceCard({ item, chart }: { item: ReportItem; chart?: ReactNode }) {
  const gatePass = item.gate_result === 'PASS' || item.gate_result === 'pass'
  return (
    <div className="p-md bg-surface rounded-lg border border-surface-container-highest flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-sm">
        <div className="flex items-center gap-xs flex-wrap">
          <span className="font-label-md text-label-md text-text-primary uppercase tracking-wide">{item.item}</span>
          <TierBadge tier={item.tier} />
          {gatePass && (
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">
              PASS
            </span>
          )}
        </div>
        <ItemValue item={item} />
      </div>
      {chart}
      <EvidenceAccordion source={item.source} insight={item.insight} ai={item.insight_ai_generated} />
    </div>
  )
}

// ── 도넛(단일 퍼센트) ───────────────────────────────────────────
// AISea: 라이트 카드 위 데이터는 잉크블랙(#14181C), 배경 링은 베이지 그레이.
const DONUT = '#14181C'
const DONUT_BG = '#e6e3db'
export function Donut({
  pct,
  segLabel,
  restLabel,
}: {
  pct: number
  segLabel: string
  restLabel: string
}) {
  const cx = 60
  const cy = 60
  const frac = Math.max(0, Math.min(100, pct)) / 100
  const startAngle = -90
  const endAngle = startAngle + frac * 360
  const toXY = (radius: number, angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]
  }
  const rOuter = 50
  const rInner = 30
  const [ox1, oy1] = toXY(rOuter, startAngle)
  const [ox2, oy2] = toXY(rOuter, endAngle)
  const [ix2, iy2] = toXY(rInner, endAngle)
  const [ix1, iy1] = toXY(rInner, startAngle)
  const large = frac > 0.5 ? 1 : 0
  const segPath =
    frac <= 0
      ? ''
      : `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`
  return (
    <div className="flex items-center gap-md bg-surface-container-low rounded-md p-sm">
      <svg viewBox="0 0 120 120" style={{ width: 100, height: 100 }} preserveAspectRatio="xMidYMid meet">
        {/* 배경 링 */}
        <path
          d={`M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 1 ${cx - 0.01} ${cy - rOuter} M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 0 ${cx + 0.01} ${cy - rInner} Z`}
          fill={DONUT_BG}
          fillRule="evenodd"
        />
        {segPath && <path d={segPath} fill={DONUT} />}
        <text x="60" y="61" textAnchor="middle" fontSize="14" fontWeight="700" fill={DONUT}>
          {Math.round(pct)}%
        </text>
      </svg>
      <div className="flex flex-col gap-xs flex-1">
        <div className="flex items-center gap-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: DONUT }} />
          <span className="font-label-sm text-label-sm text-text-secondary">{segLabel}</span>
          <span className="font-label-sm text-label-sm text-text-primary font-semibold">{Math.round(pct)}%</span>
        </div>
        <div className="flex items-center gap-xs">
          <span className="w-3 h-3 rounded-sm" style={{ background: DONUT_BG }} />
          <span className="font-label-sm text-label-sm text-text-secondary">{restLabel}</span>
          <span className="font-label-sm text-label-sm text-text-primary font-semibold">{100 - Math.round(pct)}%</span>
        </div>
      </div>
    </div>
  )
}

// ── 미니 시계열(원천 항목 안의 작은 라인차트) ───────────────────
// AISea: viewBox 360x90, 과거 실선 + 전망 점선, 라이트면 데이터는 잉크블랙.
const MINI = '#14181C'
export function MiniTimeseries({ ts }: { ts: TimeseriesData }) {
  const W = 360
  const H = 90
  const padL = 36
  const padR = 12
  const padT = 8
  const padB = 18
  const hist = ts.history ?? []
  const fore = ts.forecast ?? []
  const all = [...hist, ...fore]
  if (all.length === 0) return null
  const values = all.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const xStep = (W - padL - padR) / (all.length - 1 || 1)
  const toX = (i: number) => padL + i * xStep
  const toY = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB)
  const histPts = hist.map((p, i) => ({ x: toX(i), y: toY(p.value) }))
  const forePts = fore.map((p, i) => ({ x: toX(hist.length - 1 + i + 1), y: toY(p.value) }))
  const foreJoin = histPts.length && forePts.length ? [histPts[histPts.length - 1], ...forePts] : forePts
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <div className="bg-surface-container-low rounded-md p-sm flex flex-col gap-xs">
      <svg className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ maxHeight: 100 }}>
        <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="#e6e3db" />
        <line x1={padL} y1={(padT + H - padB) / 2} x2={W - padR} y2={(padT + H - padB) / 2} stroke="#e6e3db" />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e6e3db" />
        <text x={padL - 4} y="14" fontSize="9" fill="#9aa0a6" textAnchor="end">
          {Math.round(max)}
        </text>
        <text x={padL - 4} y={H - padB - 1} fontSize="9" fill="#9aa0a6" textAnchor="end">
          {Math.round(min)}
        </text>
        <text x={padL} y={H - 6} fontSize="9" fill="#9aa0a6" textAnchor="middle">
          {all[0]?.year}
        </text>
        <text x={W - padR} y={H - 6} fontSize="9" fill="#9aa0a6" textAnchor="middle">
          {all[all.length - 1]?.year}
        </text>
        {histPts.length > 1 && <path d={toPath(histPts)} fill="none" stroke={MINI} strokeWidth="2" />}
        {foreJoin.length > 1 && (
          <path d={toPath(foreJoin)} fill="none" stroke={MINI} strokeWidth="2" strokeDasharray="4 3" opacity="0.85" />
        )}
        {histPts.map((p, i) => (
          <circle key={`h${i}`} cx={p.x} cy={p.y} r="2.5" fill={MINI} />
        ))}
        {forePts.map((p, i) => (
          <circle key={`f${i}`} cx={p.x} cy={p.y} r="2.5" fill={MINI} opacity="0.7" />
        ))}
      </svg>
      {(ts.cagr_hist != null || ts.cagr_forecast != null) && (
        <div className="flex gap-md font-label-sm text-label-sm text-text-secondary">
          {ts.cagr_hist != null && (
            <span className="inline-flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: MINI }} />
              CAGR(과거): <span className="font-semibold text-text-primary">{ts.cagr_hist}%</span>
            </span>
          )}
          {ts.cagr_forecast != null && (
            <span className="inline-flex items-center gap-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: MINI, opacity: 0.7 }} />
              CAGR(전망): <span className="font-semibold text-text-primary">{ts.cagr_forecast}%</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── 시스템 결정 트리(탭0 요약 / 탭2) — mockup SVG 그대로(raw hex 유지) ──
export function DecisionTreeSvg({
  score,
  baseCountryKo,
  decision,
  regionSystemExists = true,
  expansionMin = 65,
  hqBuildMin = 55,
  isApac = false,
}: {
  score: number
  baseCountryKo: string
  /** 엔진 산출 결정값. 미지정 시 score·임계값으로 폴백 추론. */
  decision?: string
  /** 권역 내 구축 시스템 존재 여부(첫 분기). */
  regionSystemExists?: boolean
  /** 권역 확산 임계값(룰셋 expansion_min_score). 미지정 시 65 폴백. */
  expansionMin?: number
  /** 본사 자체구축 임계값(룰셋 hq_build_min_score). 미지정 시 55 폴백. */
  hqBuildMin?: number
  /** APAC(아시아) — 권역 확산·유사도 분기 없이 외부솔루션·자체구축 양쪽 동등 제시. */
  isApac?: boolean
}) {
  // APAC — 권역 확산·유사도 분기 없이 외부솔루션·자체구축을 양쪽 동등 제시.
  if (isApac) {
    return <DecisionTreeSvgApac />
  }
  // 엔진 decision을 시각화 분기로 매핑. decision이 없으면 score·임계값으로 폴백.
  // - baseline_system_expansion → 권역 내 확산 (B)
  // - hq_build                  → 본사 자체구축 (HQ)
  // - external_solution         → 외부솔루션 (EXT)
  const branch: 'B' | 'HQ' | 'EXT' = (() => {
    if (decision === 'baseline_system_expansion') return 'B'
    if (decision === 'hq_build') return 'HQ'
    if (decision === 'external_solution') return 'EXT'
    // 폴백: 권역 시스템 없으면 외부솔루션, 아니면 임계값 비교
    if (!regionSystemExists) return 'EXT'
    if (score >= expansionMin) return 'B'
    if (score >= hqBuildMin) return 'HQ'
    return 'EXT'
  })()
  // 외부솔루션이 "권역 시스템 없음(NO)" 경로로 도달했는지 여부 — active path가 달라진다.
  const extViaNo = branch === 'EXT' && !regionSystemExists
  const isB = branch === 'B'
  const isHQ = branch === 'HQ'
  const isEXT = branch === 'EXT'
  // 활성 경로 d 속성 — 분기별로 굵게 점등되는 라인.
  const activePath = isB
    ? 'M450 140 L450 200 M450 320 L450 360 L150 360 L150 560' // region exists → ≥65 → B(좌)
    : isHQ
      ? 'M450 140 L450 200 M450 320 L450 360 L750 360 L750 560' // region exists → 55~65 → HQ(우)
      : extViaNo
        ? 'M520 80 L820 80 L820 480 L520 480 L450 480 L450 540 L450 615' // NO → 외부솔루션
        : 'M450 140 L450 200 M450 320 L450 420 L450 540 L450 615' // <55 → 외부솔루션(중앙 하단)
  const activeBullet = isB
    ? { cx: 150, cy: 560 }
    : isHQ
      ? { cx: 750, cy: 560 }
      : { cx: 450, cy: 612 }
  // 비활성 분기 카드 공통 클래스(흐림). 활성 분기는 강조.
  const cardActive = 'border-2 bg-primary/10 border-primary rounded-xl p-md'
  const cardActiveShadow = { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }
  const cardIdle = 'border-2 bg-surface-container border-outline-variant opacity-40 rounded-xl p-md'
  return (
    <div className="flex flex-col items-center pt-md gap-sm">
      <style>{`
        @keyframes dt-pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes dt-flow { to { stroke-dashoffset: -24; } }
        @keyframes dt-dash { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
        @keyframes dt-glow { 0%,100%{filter:drop-shadow(0 0 6px rgba(200,240,81,.55))} 50%{filter:drop-shadow(0 0 14px rgba(200,240,81,1))} }
        .dt-diamond { animation: dt-pop .6s ease-out .3s both; transform-origin:center; }
        .dt-flow-line { stroke:#9aa0a8; stroke-width:2; stroke-dasharray:6 6; animation:dt-flow 1.2s linear infinite; fill:none; }
        .dt-active-path { stroke:#14181C; stroke-width:4; stroke-linecap:round; fill:none; stroke-dasharray:1000; stroke-dashoffset:1000; animation: dt-dash 1.6s ease-out .6s forwards, dt-glow 2s ease-in-out 2.2s infinite; }
        .dt-active-bullet { animation: dt-pop .5s ease-out 2s both, dt-glow 2s ease-in-out 2.4s infinite; transform-origin:center; transform-box:fill-box; }
        .dt-branch-card { animation: dt-pop .55s ease-out both; transform-origin:top center; }
        .dt-branch-b { animation-delay:2.1s; } .dt-branch-ext { animation-delay:2.3s; } .dt-branch-hq { animation-delay:2.5s; }
        @media (prefers-reduced-motion: reduce) {
          .dt-diamond,.dt-active-path,.dt-active-bullet,.dt-branch-card { animation: none !important; }
          .dt-flow-line { animation: none !important; }
          .dt-active-path { stroke-dashoffset: 0 !important; }
        }
      `}</style>
      <svg
        className="w-full max-w-4xl block"
        viewBox="0 0 900 640"
        preserveAspectRatio="xMidYMid meet"
        style={{ marginBottom: '-8px' }}
        role="img"
        aria-label="시스템 결정 트리"
      >
        <g className="dt-diamond">
          <polygon points="450,20 520,80 450,140 380,80" fill="#fbf9f9" stroke="#14181C" strokeWidth="2" />
          <text x="450" y="75" textAnchor="middle" fontSize="14" fill="#14181C" fontWeight="700">권역 내 구축</text>
          <text x="450" y="92" textAnchor="middle" fontSize="14" fill="#14181C" fontWeight="700">시스템 존재?</text>
        </g>
        <path d="M450 140 L450 200" className="dt-flow-line" opacity="0.25" />
        <text x="465" y="175" textAnchor="start" fontSize="14" fontWeight="700" fill={regionSystemExists ? '#14181C' : '#9aa0a8'}>YES ({baseCountryKo})</text>
        <path d="M520 80 L820 80 L820 480 L520 480" className="dt-flow-line" opacity="0.25" />
        <text x="700" y="70" textAnchor="middle" fontSize="14" fontWeight="700" fill={extViaNo ? '#14181C' : '#9aa0a8'}>NO → 외부솔루션</text>
        <g className="dt-diamond" style={{ animationDelay: '0.6s' }}>
          <polygon points="450,200 525,260 450,320 375,260" fill="#fbf9f9" stroke="#14181C" strokeWidth="2" />
          <text x="450" y="255" textAnchor="middle" fontSize="12" fill="#14181C" fontWeight="700">유사도</text>
          <text x="450" y="280" textAnchor="middle" fontSize="18" fill="#14181C" fontWeight="800">{score.toFixed(1)}</text>
        </g>
        <path d="M450 320 L450 360 L150 360 L150 560" className="dt-flow-line" opacity="0.25" />
        <text x="300" y="350" textAnchor="middle" fontSize="14" fontWeight="700" fill={isB ? '#14181C' : '#9aa0a8'}>{`≥ ${expansionMin} → 권역 내 확산`}</text>
        <path d="M450 320 L450 360 L750 360 L750 560" className="dt-flow-line" opacity="0.25" />
        <text x="600" y="350" textAnchor="middle" fontSize="14" fontWeight="700" fill={isHQ ? '#14181C' : '#9aa0a8'}>{`${hqBuildMin}~${expansionMin} → 본사 자체구축`}</text>
        <path d="M450 320 L450 420" className="dt-flow-line" opacity="0.25" />
        <text x="465" y="370" textAnchor="start" fontSize="14" fontWeight="700" fill={isEXT ? '#14181C' : '#9aa0a8'}>{`< ${hqBuildMin}`}</text>
        <g className="dt-diamond" style={{ animationDelay: '1.0s' }}>
          <polygon points="450,420 520,480 450,540 380,480" fill="#fbf9f9" stroke="#9aa0a8" strokeWidth="2" />
          <text x="450" y="475" textAnchor="middle" fontSize="12" fill="#9aa0a8" fontWeight="700">외부솔루션</text>
          <text x="450" y="492" textAnchor="middle" fontSize="12" fill="#9aa0a8" fontWeight="700">기준점 통과?</text>
        </g>
        <path d="M450 540 L450 615" className="dt-flow-line" opacity="0.25" />
        <text x="465" y="585" textAnchor="start" fontSize="14" fontWeight="700" fill={isEXT ? '#14181C' : '#9aa0a8'}>YES → 외부솔루션</text>
        <path d="M520 480 L750 480 L750 560" className="dt-flow-line" opacity="0.25" />
        <text x="640" y="472" textAnchor="middle" fontSize="14" fontWeight="700" fill="#9aa0a8">NO (Fallback)</text>
        {/* active path: 엔진 decision(B/HQ/EXT)에 따라 점등 경로가 달라진다. */}
        <path d={activePath} className="dt-active-path" />
        <circle className="dt-active-bullet" cx={activeBullet.cx} cy={activeBullet.cy} r="7" fill="#14181C" />
      </svg>
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-3 gap-lg">
          <div className={`dt-branch-card dt-branch-b ${isB ? cardActive : cardIdle}`} style={isB ? cardActiveShadow : undefined}>
            <div className="flex items-center justify-center gap-xs">
              <span className={`material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] ${isB ? 'text-primary' : 'text-text-secondary'}`}>expand_circle_down</span>
              <span className={`font-semibold font-body-md text-body-md uppercase tracking-wider ${isB ? 'text-primary' : 'text-text-secondary'}`}>권역 내 확산</span>
            </div>
          </div>
          <div className={`dt-branch-card dt-branch-ext ${isEXT ? cardActive : cardIdle}`} style={isEXT ? cardActiveShadow : undefined}>
            <div className="flex items-center justify-center gap-xs">
              <span className={`material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] ${isEXT ? 'text-primary' : 'text-text-secondary'}`}>extension</span>
              <span className={`font-semibold font-body-md text-body-md uppercase tracking-wider ${isEXT ? 'text-primary' : 'text-text-secondary'}`}>외부솔루션</span>
            </div>
          </div>
          <div className={`dt-branch-card dt-branch-hq ${isHQ ? cardActive : cardIdle}`} style={isHQ ? cardActiveShadow : undefined}>
            <div className="flex items-center justify-center gap-xs">
              <span className={`material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] ${isHQ ? 'text-primary' : 'text-text-secondary'}`}>domain</span>
              <span className={`font-semibold font-body-md text-body-md uppercase tracking-wider ${isHQ ? 'text-primary' : 'text-text-secondary'}`}>본사 자체구축</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── APAC 전용 결정 트리(외부솔루션 / 자체구축 — 양쪽 동등 제시) ───────────
//   권역 내 확산 경로도, 유사도 임계값 분기도 없다. 두 경로를 동등하게 함께
//   제시한다(추천 강조 없음). 의사결정은 사용자 몫.
function DecisionTreeSvgApac() {
  // 양쪽 모두 활성 — 중립 동등 제시.
  const cardActive = 'border-2 bg-primary/10 border-primary rounded-xl p-md'
  const cardActiveShadow = { boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }
  return (
    <div className="flex flex-col items-center pt-md gap-sm">
      <style>{`
        @keyframes dt-pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes dt-dash { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
        @keyframes dt-glow { 0%,100%{filter:drop-shadow(0 0 6px rgba(200,240,81,.55))} 50%{filter:drop-shadow(0 0 14px rgba(200,240,81,1))} }
        .dt-node { animation: dt-pop .6s ease-out .3s both; transform-origin:center; }
        .dt-active-path { stroke:#14181C; stroke-width:4; stroke-linecap:round; fill:none; stroke-dasharray:1000; stroke-dashoffset:1000; animation: dt-dash 1.6s ease-out .6s forwards, dt-glow 2s ease-in-out 2.2s infinite; }
        .dt-branch-card { animation: dt-pop .55s ease-out both; transform-origin:top center; }
        .dt-branch-int { animation-delay:1.6s; } .dt-branch-ext { animation-delay:1.8s; }
        @media (prefers-reduced-motion: reduce) {
          .dt-node,.dt-active-path,.dt-branch-card { animation: none !important; }
          .dt-active-path { stroke-dashoffset: 0 !important; }
        }
      `}</style>
      <svg
        className="w-full max-w-4xl block"
        viewBox="0 0 900 400"
        preserveAspectRatio="xMidYMid meet"
        style={{ marginBottom: '-8px' }}
        role="img"
        aria-label="APAC 시스템 결정 트리 (외부솔루션·자체구축 양쪽 검토)"
      >
        {/* 시작 노드 — 진출 검토. 분기 없이 두 경로로 동시 연결. */}
        <g className="dt-node">
          <rect x="350" y="30" width="200" height="60" rx="12" fill="#fbf9f9" stroke="#14181C" strokeWidth="2" />
          <text x="450" y="58" textAnchor="middle" fontSize="14" fill="#14181C" fontWeight="700">APAC 진출 검토</text>
          <text x="450" y="76" textAnchor="middle" fontSize="11" fill="#3a4048">두 경로 함께 검토</text>
        </g>
        {/* 좌(외부솔루션)·우(자체구축) 양쪽 모두 활성 경로로 점등. */}
        <path d="M450 90 L450 140 L230 140 L230 230" className="dt-active-path" />
        <path d="M450 90 L450 140 L670 140 L670 230" className="dt-active-path" style={{ animationDelay: '0.8s' }} />
        <text x="230" y="125" textAnchor="middle" fontSize="13" fontWeight="700" fill="#14181C">외부솔루션 도입</text>
        <text x="670" y="125" textAnchor="middle" fontSize="13" fontWeight="700" fill="#14181C">자체구축(내재화)</text>
      </svg>
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-2 gap-lg">
          <div className="dt-branch-card dt-branch-ext" >
            <div className={cardActive} style={cardActiveShadow}>
              <div className="flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] text-primary">extension</span>
                <span className="font-semibold font-body-md text-body-md uppercase tracking-wider text-primary">외부솔루션</span>
              </div>
            </div>
          </div>
          <div className="dt-branch-card dt-branch-int">
            <div className={cardActive} style={cardActiveShadow}>
              <div className="flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-[clamp(17px,calc(15px_+_0.556vw),23px)] text-primary">domain</span>
                <span className="font-semibold font-body-md text-body-md uppercase tracking-wider text-primary">자체구축(내재화)</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center font-label-sm text-label-sm text-text-secondary mt-md">
          APAC은 권역 확산·유사도 분기를 적용하지 않습니다 — 두 경로를 동등하게 비교 검토합니다.
        </p>
      </div>
    </div>
  )
}

// ── 구독료 구간표(탭0/탭2 공유) ─────────────────────────────────
interface SubTierTableProps {
  tiers?: { min_volume: number; max_volume: number | null; price_per_unit: number }[]
  appliedPrice?: number
  existing?: number
  newAdded?: number
  newCumulative?: number
  /** 단가 통화(데이터 currency). 한화 환산 병기에 사용. */
  currency?: string
}
export function SubscriptionTierTable({ tiers, appliedPrice, existing, newAdded, newCumulative, currency = 'EUR' }: SubTierTableProps) {
  const rows = tiers ?? []
  // 기준국 등 구독료 데이터가 없으면 표 자체를 생략(크래시 방지).
  if (rows.length === 0) {
    return <p className="font-body-sm text-body-sm text-text-secondary">구독료 구간 데이터가 없습니다.</p>
  }
  return (
    <>
      <table className="w-full font-body-md text-body-md">
        <thead>
          <tr className="text-text-secondary">
            <th className="px-2 py-1.5 text-left font-label-md text-label-md uppercase">누적건수</th>
            <th className="px-2 py-1.5 text-right font-label-md text-label-md uppercase">단가</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const isApplied = appliedPrice != null && Math.abs(t.price_per_unit - appliedPrice) < 1e-6
            const lo = t.min_volume + (i === 0 ? 0 : 1)
            const range = t.max_volume == null ? `${intComma(lo)}+` : `${intComma(t.min_volume)} ~ ${intComma(t.max_volume)}`
            return (
              <tr key={i} className={isApplied ? 'bg-primary/10 text-primary font-semibold' : 'text-text-primary'}>
                <td className="px-2 py-1.5 border-b border-surface-container-highest">{range}</td>
                <td className="px-2 py-1.5 border-b border-surface-container-highest text-right">
                  <Money value={t.price_per_unit} currency={currency} inline />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex flex-col gap-xs mt-md pt-sm border-t border-surface-container-highest font-body-md text-body-md">
        <div className="flex justify-between">
          <span className="text-text-secondary">기존 누적</span>
          <span className="text-text-primary font-semibold">{intComma(existing)} 건</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">신규 추가</span>
          <span className="text-text-primary font-semibold">{intComma(newAdded)} 건</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">신규 누적</span>
          <span className="text-primary font-semibold">{intComma(newCumulative)} 건</span>
        </div>
        <div className="flex justify-between items-center mt-xs px-sm py-2 rounded-lg bg-primary/10 border-l-4 border-primary">
          <span className="text-primary font-semibold uppercase tracking-wider font-label-md text-label-md">적용 단가</span>
          <span className="text-primary font-bold font-body-lg text-body-lg">
            <Money value={appliedPrice} currency={currency} inline />
          </span>
        </div>
      </div>
    </>
  )
}

// ── 결정별 우측 패널(구독료/본사구축비용/외부솔루션 후보) ──────────────
// decision에 따라 표시를 분기한다:
//   external_solution → 추천 벤더 후보 리스트
//   hq_build          → 본사 자체구축 예상 비용/기간
//   그 외(권역 확산)   → 기존 구독료 구간표
interface DecisionSidePanelProps {
  decision?: string
  externalCandidates?: { name: string; category?: string | null; cost_note?: string }[]
  externalSolutionSummary?: {
    solution_type?: string | null
    solution_type_insight?: string | null
    vendor_pattern?: string | null
    source?: string | null
  } | null
  hqBaselineCost?: number
  hqBaselineMonths?: number
  hqBaselineCurrency?: string
  subscription: SubTierTableProps
  /** APAC(아시아) — hq_build 결정을 '내재화'로 표기. */
  isApac?: boolean
}
export function DecisionSidePanel({
  decision,
  externalCandidates,
  externalSolutionSummary,
  hqBaselineCost,
  hqBaselineMonths,
  hqBaselineCurrency = 'EUR',
  subscription,
  isApac = false,
}: DecisionSidePanelProps) {
  if (decision === 'external_solution' || decision === 'apac_dual') {
    const list = externalCandidates ?? []
    if (list.length === 0) {
      return <p className="font-body-sm text-body-sm text-text-secondary">해당국 외부솔루션 후보 데이터가 없습니다.</p>
    }
    return (
      <div className="flex flex-col gap-sm">
        <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
          {decision === 'apac_dual'
            ? '자체구축(내재화)과 함께 검토할 현지 외부솔루션 후보입니다. 자체구축 예상 비용은 TCO 탭을 참조하세요.'
            : '권역 확산·본사 구축 기준 미달 → 현지 외부솔루션 도입을 검토합니다. 후보 벤더는 다음과 같습니다.'}
        </p>
        <ul className="flex flex-col gap-xs list-none p-0 m-0">
          {list.map((c, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-xs px-sm py-2 rounded-lg bg-surface-container border border-outline-variant"
            >
              <span className="flex items-center gap-xs min-w-0">
                <span className="font-body-md text-body-md text-text-primary font-semibold truncate">{c.name}</span>
                {c.category && (
                  <span className="shrink-0 font-label-sm text-label-sm px-2 py-[1px] rounded-full bg-primary/10 text-primary">
                    {c.category}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-label-sm text-label-sm text-text-secondary">{c.cost_note ?? '별도 견적'}</span>
            </li>
          ))}
        </ul>
        {externalSolutionSummary && (
          <div className="mt-xs flex flex-col gap-xs rounded-lg bg-surface-light border border-outline-variant px-sm py-2">
            {externalSolutionSummary.solution_type && (
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">솔루션 유형</span>
                <span className="font-body-sm text-body-sm text-text-primary">{externalSolutionSummary.solution_type}</span>
              </div>
            )}
            {externalSolutionSummary.vendor_pattern && (
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">벤더 패턴</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{externalSolutionSummary.vendor_pattern}</span>
              </div>
            )}
            {externalSolutionSummary.source && (
              <span className="font-label-sm text-label-sm text-text-secondary">출처: {externalSolutionSummary.source}</span>
            )}
          </div>
        )}
        <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
          * 도입 비용은 벤더별 견적에 따라 산정됩니다.
        </p>
      </div>
    )
  }
  if (decision === 'hq_build') {
    return (
      <div className="flex flex-col gap-sm">
        <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
          {isApac
            ? '유사도 충분 → 본사 내재화 구축을 권고합니다. 예상 규모는 다음과 같습니다.'
            : '권역 확산 기준 미달, 외부솔루션 대비 적합 → 본사 자체구축을 권고합니다. 예상 규모는 다음과 같습니다.'}
        </p>
        <div className="flex flex-col gap-xs font-body-md text-body-md">
          <div className="flex justify-between items-center px-sm py-2 rounded-lg bg-primary/10 border-l-4 border-primary">
            <span className="text-primary font-semibold uppercase tracking-wider font-label-md text-label-md">예상 구축비용</span>
            <span className="text-primary font-bold font-body-lg text-body-lg">{money(hqBaselineCost ?? 0, hqBaselineCurrency)}</span>
          </div>
          <div className="flex justify-between items-center px-sm py-2 rounded-lg bg-surface-container border border-outline-variant">
            <span className="text-text-secondary font-semibold uppercase tracking-wider font-label-md text-label-md">예상 구축기간</span>
            <span className="text-text-primary font-bold font-body-md text-body-md">{intComma(hqBaselineMonths)} 개월</span>
          </div>
        </div>
        <p className="font-label-sm text-label-sm text-text-secondary mt-xs">
          {isApac ? '* 내재화 기준 baseline 값(참고용).' : '* 본사 자체구축 기준 baseline 값(참고용).'}
        </p>
      </div>
    )
  }
  // 기본: 권역 확산 — 구독료 구간표
  return <SubscriptionTierTable {...subscription} />
}
