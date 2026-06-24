// CountryDiagnostics (P1) — 국가 상세 전용 진단 패널 3종.
// 보고서(PR1)에 없는 원천 데이터(role=gate 규제, 회수·리스크 1~5, IT 인프라 성숙도)를
// 시각화한다. CountryDetail이 data.items를 그대로 넘겨 받아 자체 파싱한다.
//   ① RegulatoryGates   — 진입 규제 신호등(role=gate 7종)
//   ③ RecoveryRiskPanel — 채권 회수·리스크 환경(회수 용이성·소요기간·추심·충당금·연체)
//   ④ ITMaturityPanel   — IT 인프라 성숙도(디지털 채널·CB·결제·딜러·국외이전 제한)
// 색은 CountryDetail의 EntityModeBadge 팔레트 계열(양호 그린 / 주의 앰버 / 제약 레드)로 통일.
import type { DetailItem } from '../reports/types'
import { useT } from '../../i18n/dict'
import { useLang, pickLang } from '../../i18n/locale'

// ── 시맨틱 상태 팔레트(라이트 카드 위, Kinetic Enterprise 계열) ──────────────
// 라벨(양호/주의/제약/정보)은 언어별 — labelKey를 useT()로 변환(영문 모드 대응).
type StatusKey = 'good' | 'mid' | 'low' | 'none'
const STATUS: Record<StatusKey, { fg: string; bg: string; dot: string; labelKey: string }> = {
  good: { fg: '#3f7a5c', bg: '#e9f3ee', dot: '#4f8a6d', labelKey: 'dtl.diag.status.good' },
  mid: { fg: '#a8761f', bg: '#fbf0e6', dot: '#d39a3a', labelKey: 'dtl.diag.status.mid' },
  low: { fg: '#b23b2a', bg: '#fbe9e6', dot: '#cf5340', labelKey: 'dtl.diag.status.low' },
  none: { fg: '#475569', bg: '#eef1f5', dot: '#94a3b8', labelKey: 'dtl.diag.status.none' },
}

// goodness(0~1) → 상태. 1에 가까울수록 진출에 유리.
function goodnessToStatus(g: number): StatusKey {
  if (g >= 0.7) return 'good'
  if (g >= 0.4) return 'mid'
  return 'low'
}

function findItem(items: DetailItem[], name: string): DetailItem | undefined {
  return items.find((it) => it.item.includes(name))
}

// ── 공통 패널 셸(CountryDetail의 카드 스타일과 동일) ─────────────────────────
function DiagPanel({
  icon,
  title,
  hint,
  children,
}: {
  icon: string
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-surface-border rounded-lg p-md bg-surface flex flex-col gap-md">
      <div className="flex items-center gap-xs">
        <span className="material-symbols-outlined text-primary text-[clamp(15px,calc(13px_+_0.5vw),20px)]">
          {icon}
        </span>
        <h4 className="font-headline-md text-headline-md text-primary m-0">{title}</h4>
      </div>
      {hint && (
        <p className="font-label-sm text-label-sm text-outline -mt-xs">{hint}</p>
      )}
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ① 진입 규제 신호등 — role=gate 항목(자유텍스트)을 신호등으로 분류.
// ════════════════════════════════════════════════════════════════════════════

// 진입 규제로 다룰 gate 항목(고정 순서). data.items에서 이름 부분일치로 찾는다.
const GATE_ITEMS = [
  { key: '외국인 지분', icon: 'groups', labelKey: 'dtl.gate.foreignEquity' },
  { key: '외환', icon: 'currency_exchange', labelKey: 'dtl.gate.fx' },
  { key: '데이터 현지화', icon: 'dns', labelKey: 'dtl.gate.dataLocal' },
  { key: '국가신용등급', icon: 'verified_user', labelKey: 'dtl.gate.sovereign' },
  { key: '라이선스 취득', icon: 'badge', labelKey: 'dtl.gate.license' },
  { key: '라이선스 체제', icon: 'gavel', labelKey: 'dtl.gate.licenseRegime' },
  { key: '금리 상한', icon: 'percent', labelKey: 'dtl.gate.rateCap' },
]

// 자유텍스트 gate 값을 신호등으로 분류(휴리스틱). 보고서 gate_result가 있으면 그쪽이 우선.
//   부정(제약) → 긍정(양호) → 주의 → 정보 순으로 우선 판정한다.
function classifyGate(value: string): StatusKey {
  const v = value || ''
  // 부정: 명시적 불가/금지(단, "금지 없음"류 제외) — 강제 현지화 등.
  if (/불가|진입\s*제한|금지(?!\s*없|\s*안)/.test(v)) return 'low'
  if (/강제\s*현지화(?!.*없)/.test(v)) return 'low'
  // 긍정: 허용·자유·면제·가능·통제 없음·안정적.
  if (/허용|자유|면제|취득\s*가능|통제\s*없음|현지화\s*없음|안정/.test(v)) return 'good'
  // 주의: 인가·감독·상한·의무·제한·부담·조건부 등 조건부 진입.
  if (/인가|감독|상한|의무|제한|부담|조건부|규제/.test(v)) return 'mid'
  return 'none'
}

export function RegulatoryGates({
  items,
  gateResults,
}: {
  items: DetailItem[]
  /** 보고서(tab_1_2_decision) 기반 권위 판정 — 항목명 부분키 → PASS|FLAG|FAIL. */
  gateResults?: Record<string, StatusKey>
}) {
  const t = useT()
  const lang = useLang()
  const rows = GATE_ITEMS.map((g) => {
    const it = findItem(items, g.key)
    if (!it) return null
    // 분류는 항상 한국어 원문 휴리스틱으로(classifyGate), 표시는 lang에 맞춰 value_en 선택.
    const value = it.value == null ? '' : String(it.value)
    const display = String(pickLang(lang, it.value ?? '', it.value_en) ?? '')
    const status = gateResults?.[g.key] ?? classifyGate(value)
    return { ...g, value: display, status, insight: it.insight }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) return null

  return (
    <DiagPanel
      icon="traffic"
      title={t('dtl.gate.title')}
      hint={t('dtl.gate.hint')}
    >
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-sm list-none p-0 m-0">
        {rows.map((r) => {
          const s = STATUS[r.status]
          return (
            <li
              key={r.key}
              className="flex items-start gap-sm rounded-lg border border-surface-border bg-surface-container-lowest p-sm"
            >
              <span
                className="material-symbols-outlined shrink-0 text-[clamp(16px,calc(14px_+_0.5vw),20px)] mt-[2px]"
                style={{ color: s.fg }}
              >
                {r.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <span className="font-label-md text-label-md text-on-surface truncate">{t(r.labelKey)}</span>
                  <span
                    className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-[1px] font-label-sm text-label-sm"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} aria-hidden />
                    {t(s.labelKey)}
                  </span>
                </div>
                <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant leading-snug">
                  {r.value || '—'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </DiagPanel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 공통 — 1~5 척도 세그먼트 바(방향 인지: direction=down이면 낮을수록 양호).
// ════════════════════════════════════════════════════════════════════════════
function ScoreBar({
  label,
  value,
  direction = 'up',
  suffix = '/5',
}: {
  label: string
  value: number
  direction?: 'up' | 'down'
  suffix?: string
}) {
  const v = Math.max(1, Math.min(5, Math.round(value)))
  // goodness: up은 높을수록, down은 낮을수록 1에 가깝다.
  const g = direction === 'down' ? (5 - v) / 4 : (v - 1) / 4
  const s = STATUS[goodnessToStatus(g)]
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between gap-xs">
        <span className="font-label-md text-label-md text-on-surface">{label}</span>
        <span className="font-label-md text-label-md font-semibold" style={{ color: s.fg }}>
          {v}
          <span className="text-outline font-normal"> {suffix}</span>
        </span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${label} ${v}${suffix}`}>
        {[1, 2, 3, 4, 5].map((seg) => (
          <span
            key={seg}
            className="h-2 flex-1 rounded-sm"
            style={{ background: seg <= v ? s.dot : '#e6e3db' }}
          />
        ))}
      </div>
    </div>
  )
}

// 소요기간(일) — 길수록 불리. 365일 기준 비례 바.
function DurationBar({ label, days, refDays = 365 }: { label: string; days: number; refDays?: number }) {
  const t = useT()
  const frac = Math.max(0, Math.min(1, days / refDays))
  const g = 1 - frac // 짧을수록 양호
  const s = STATUS[goodnessToStatus(g)]
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between gap-xs">
        <span className="font-label-md text-label-md text-on-surface">{label}</span>
        <span className="font-label-md text-label-md font-semibold" style={{ color: s.fg }}>
          {days.toLocaleString('en-US')}
          <span className="text-outline font-normal"> {t('dtl.diag.days')}</span>
        </span>
      </div>
      <div className="h-2 rounded-sm overflow-hidden" style={{ background: '#e6e3db' }}>
        <div className="h-full rounded-sm" style={{ width: `${frac * 100}%`, background: s.dot }} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ③ 채권 회수·리스크 환경.
// ════════════════════════════════════════════════════════════════════════════
const RECOVERY_SCORES = [
  { key: '차량회수 절차 용이성', labelKey: 'dtl.recovery.repo', direction: 'up' as const },
  { key: '추심 규제', labelKey: 'dtl.recovery.collection', direction: 'down' as const },
  { key: '충당금 규정', labelKey: 'dtl.recovery.provision', direction: 'up' as const },
  { key: '연체 분류 기준', labelKey: 'dtl.recovery.npl', direction: 'up' as const },
]

export function RecoveryRiskPanel({ items }: { items: DetailItem[] }) {
  const t = useT()
  const scores = RECOVERY_SCORES.map((m) => {
    const it = findItem(items, m.key)
    return it != null && typeof it.value === 'number' ? { ...m, value: it.value } : null
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  const daysItem = findItem(items, '법적 회수 소요기간')
  const days = daysItem != null && typeof daysItem.value === 'number' ? daysItem.value : null

  if (scores.length === 0 && days == null) return null

  return (
    <DiagPanel
      icon="gavel"
      title={t('dtl.recovery.title')}
      hint={t('dtl.recovery.hint')}
    >
      <div className="flex flex-col gap-md">
        {scores.map((m) => (
          <ScoreBar key={m.key} label={t(m.labelKey)} value={m.value} direction={m.direction} />
        ))}
        {days != null && <DurationBar label={t('dtl.recovery.legalDays')} days={days} />}
      </div>
    </DiagPanel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ④ IT 인프라 성숙도.
// ════════════════════════════════════════════════════════════════════════════
const IT_SCORES = [
  { key: '디지털 채널 성숙도', labelKey: 'dtl.it.channel', direction: 'up' as const },
  { key: '신용정보', labelKey: 'dtl.it.cb', direction: 'up' as const },
  { key: '결제·정산 인프라', labelKey: 'dtl.it.payment', direction: 'up' as const },
  { key: '디지털 딜러 성숙도', labelKey: 'dtl.it.dealer', direction: 'up' as const },
  { key: '국외이전 제한', labelKey: 'dtl.it.crossBorder', direction: 'down' as const },
]

export function ITMaturityPanel({ items }: { items: DetailItem[] }) {
  const t = useT()
  const scores = IT_SCORES.map((m) => {
    const it = findItem(items, m.key)
    return it != null && typeof it.value === 'number' ? { ...m, value: it.value } : null
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (scores.length === 0) return null

  return (
    <DiagPanel
      icon="lan"
      title={t('dtl.it.title')}
      hint={t('dtl.it.hint')}
    >
      <div className="flex flex-col gap-md">
        {scores.map((m) => (
          <ScoreBar key={m.key} label={t(m.labelKey)} value={m.value} direction={m.direction} />
        ))}
      </div>
    </DiagPanel>
  )
}
