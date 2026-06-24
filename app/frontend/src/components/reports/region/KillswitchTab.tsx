// 킬스위치 탭 — 게이트 × 국가 매트릭스. 진출 형태(tier) 4단계 분류 + 게이트 PASS/FLAG/FAIL.
import type { RegionKillswitchCountry, RegionReportData } from '../types'
import { countryKo, Flag, SourcePill } from './shared'
import { useT } from '../../../i18n/dict'
import { useLang, pickLang } from '../../../i18n/locale'
import type { Lang } from '../../../store'

// 진출 형태별 색상(배경, 글자, 막대 솔리드) — region_report_renderer._KS_TIER_STYLE 이식.
const TIER_STYLE: Record<string, { bg: string; fg: string; bar: string }> = {
  in_region_confidence: { bg: '#e9f3ee', fg: '#4f8a6d', bar: '#6aa988' }, // 초록(확신)
  external_solution: { bg: '#e6eef6', fg: '#3a6ea5', bar: '#5a8bc4' }, // 파랑(외부솔)
  jv_recommended: { bg: '#fbf0dd', fg: '#9a6b1e', bar: '#cf9b3f' }, // 호박(권고)
  jv_required: { bg: '#f6e7e3', fg: '#c0533f', bar: '#cf6b54' }, // 빨강(필수)
}
const TIER_FALLBACK = { bg: '#eef0f2', fg: '#6b7280', bar: '#9ca3af' }

// 게이트 셀 상태별 표기 — PASS/FLAG/FAIL/UNKNOWN.
function gateStyle(status: string): { bg: string; fg: string; icon: string } {
  switch (status) {
    case 'PASS':
      return { bg: '#e9f3ee', fg: '#4f8a6d', icon: '○' }
    case 'FLAG':
      return { bg: '#fbf0dd', fg: '#9a6b1e', icon: '△' }
    case 'FAIL':
      return { bg: '#f7e4e0', fg: '#c0533f', icon: '✕' }
    default:
      return { bg: '#eef0f2', fg: '#6b7280', icon: '—' }
  }
}

export function KillswitchTab({ data }: { data: RegionReportData }) {
  const ks = data.tabs.tab_2_0_killswitch
  const gates = ks.gates
  const t = useT()
  const lang = useLang()

  // tier_summary가 있으면 분포 표, 없으면 통과/탈락 폴백 문구.
  const tierSummary = ks.tier_summary && ks.tier_summary.length > 0 ? ks.tier_summary : null

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rks.matrix')}</h2>
        <SourcePill flag="EXT" />
        <SourcePill flag="CALC" suffix="· status_matrix" />
      </div>
      {tierSummary ? (
        <TierDistribution summary={tierSummary} />
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-sm">
          통과 {ks.passed_count}개국 · 탈락 {ks.failed_count}개국. 탈락국(
          {ks.failed_count > 0 ? ks.failed.join(', ') : '없음'})은 이후 스코어링에서 제외.
        </p>
      )}
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-surface-border">
              <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{t('rks.col.country')}</th>
              {gates.map((g) => (
                <th key={g} className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase whitespace-nowrap">
                  {g}
                </th>
              ))}
              <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase whitespace-nowrap">{t('rks.col.entryForm')}</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm">
            {ks.countries.map((c) => {
              // 게이트 중 PASS가 아닌 항목(FLAG·FAIL·UNKNOWN 등)이 하나라도 있으면 행에 음영.
              const hasNonPass = gates.some((g) => (c.gates[g]?.status ?? 'PASS') !== 'PASS')
              return (
              <tr
                key={c.country}
                className="border-b border-surface-border"
                style={hasNonPass ? { background: '#faf3f1' } : undefined}
              >
                <td className="py-sm px-sm font-medium text-primary whitespace-nowrap">
                  <span className="inline-flex items-center gap-xs">
                    <Flag code={c.country} />
                    {lang === 'en' ? c.country_name : countryKo(c.country, c.country_name)}{' '}
                    <span className="text-text-secondary">({c.country_name})</span>
                  </span>
                </td>
                {gates.map((g) => {
                  const cell = c.gates[g]
                  return (
                    <td key={g} className="py-sm px-sm" title={cell?.value ?? ''}>
                      <GateBadge status={cell?.status ?? '—'} />
                    </td>
                  )
                })}
                <td className="py-sm px-sm whitespace-nowrap">
                  <TierPill country={c} lang={lang} />
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// 진출 형태 분포 — 비율 누적 막대 + 범례. 등급별 색상으로 권역 구성을 한눈에.
function TierDistribution({ summary }: { summary: RegionReportData['tabs']['tab_2_0_killswitch']['tier_summary'] }) {
  const items = summary ?? []
  const total = items.reduce((s, t) => s + t.count, 0)
  if (total === 0) return null
  return (
    <div className="-mt-sm flex flex-col gap-sm">
      {/* 누적 비율 막대 */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container">
        {items.map((t) => {
          const style = TIER_STYLE[t.key] ?? TIER_FALLBACK
          const pct = (t.count / total) * 100
          if (pct === 0) return null
          return (
            <div
              key={t.key}
              className="h-full"
              style={{ width: `${pct}%`, background: style.bar }}
              title={`${t.label.ko} ${t.count}개국 (${Math.round(pct)}%)`}
            />
          )
        })}
      </div>
      {/* 범례 — 색 점 + 라벨 + 개수 */}
      <div className="flex flex-wrap items-center gap-x-md gap-y-xs">
        {items.map((t) => {
          const style = TIER_STYLE[t.key] ?? TIER_FALLBACK
          return (
            <span key={t.key} className="inline-flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: style.bar }} />
              {t.label.ko}
              <span className="font-medium text-primary">{t.count}개국</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// 진출 형태 pill — tier가 있으면 4단계 색상 라벨, 없으면(구버전) 통과/탈락 폴백.
function TierPill({ country, lang }: { country: RegionKillswitchCountry; lang: Lang }) {
  const t = useT()
  if (country.tier) {
    const style = TIER_STYLE[country.tier] ?? TIER_FALLBACK
    const label = country.tier_label ? pickLang(lang, country.tier_label.ko, country.tier_label.en) : country.tier
    return (
      <span
        className="px-2 py-[2px] rounded-md font-label-sm text-label-sm"
        style={{ background: style.bg, color: style.fg }}
      >
        {label}
      </span>
    )
  }
  return (
    <span
      className="px-2 py-[2px] rounded-md font-label-sm text-label-sm"
      style={country.pass ? { background: '#e9f3ee', color: '#4f8a6d' } : { background: '#f7e4e0', color: '#c0533f' }}
    >
      {country.pass ? t('rks.pass') : t('rks.fail')}
    </span>
  )
}

function GateBadge({ status }: { status: string }) {
  const t = useT()
  const s = gateStyle(status)
  const text =
    status === 'PASS' ? '○ PASS' : status === 'FLAG' ? `△ ${t('rks.flag')}` : status === 'FAIL' ? '✕ FAIL' : `${s.icon} ${status}`
  return (
    <span
      className="px-2 py-[2px] rounded-md font-label-sm text-label-sm whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {text}
    </span>
  )
}
