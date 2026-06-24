// 킬스위치 탭 — 게이트 × 국가 매트릭스. 진출 형태(tier) 4단계 분류 + 게이트 PASS/FLAG/FAIL.
import type { RegionKillswitchCountry, RegionReportData } from '../types'
import { countryKo, Flag, SourcePill } from './shared'

// 진출 형태별 색상(배경, 글자) — region_report_renderer._KS_TIER_STYLE 이식.
const TIER_STYLE: Record<string, { bg: string; fg: string }> = {
  in_region_confidence: { bg: '#e9f3ee', fg: '#4f8a6d' }, // 초록(확신)
  external_solution: { bg: '#e6eef6', fg: '#3a6ea5' }, // 파랑(외부솔)
  jv_recommended: { bg: '#fbf0dd', fg: '#9a6b1e' }, // 호박(권고)
  jv_required: { bg: '#f6e7e3', fg: '#c0533f' }, // 빨강(필수)
}

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

  // tier_summary가 있으면 분포 문구(JV 필수 N · JV 권고 M …), 없으면 통과/탈락 폴백.
  const summary =
    ks.tier_summary && ks.tier_summary.length > 0
      ? ks.tier_summary.map((t) => `${t.label.ko} ${t.count}개국`).join(' · ')
      : null

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h2 className="font-headline-md text-headline-md text-primary m-0">킬스위치 매트릭스</h2>
        <SourcePill flag="EXT" />
        <SourcePill flag="CALC" suffix="· status_matrix" />
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant -mt-sm">
        {summary ? (
          <>진출 형태 분포 — {summary}. JV 필수국은 퀵윈 랭킹에서 제외, JV 권고국은 감점 후 포함.</>
        ) : (
          <>
            통과 {ks.passed_count}개국 · 탈락 {ks.failed_count}개국. 탈락국(
            {ks.failed_count > 0 ? ks.failed.join(', ') : '없음'})은 이후 스코어링에서 제외.
          </>
        )}
      </p>
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-surface-border">
              <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">국가</th>
              {gates.map((g) => (
                <th key={g} className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase whitespace-nowrap">
                  {g}
                </th>
              ))}
              <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase whitespace-nowrap">진출 형태</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm">
            {ks.countries.map((c) => (
              <tr key={c.country} className="border-b border-surface-border">
                <td className="py-sm px-sm font-medium text-primary whitespace-nowrap">
                  <span className="inline-flex items-center gap-xs">
                    <Flag code={c.country} />
                    {countryKo(c.country, c.country_name)} <span className="text-text-secondary">({c.country_name})</span>
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
                  <TierPill country={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// 진출 형태 pill — tier가 있으면 4단계 색상 라벨, 없으면(구버전) 통과/탈락 폴백.
function TierPill({ country }: { country: RegionKillswitchCountry }) {
  if (country.tier) {
    const style = TIER_STYLE[country.tier] ?? { bg: '#eef0f2', fg: '#6b7280' }
    const label = country.tier_label?.ko ?? country.tier
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
      {country.pass ? '통과' : '탈락'}
    </span>
  )
}

function GateBadge({ status }: { status: string }) {
  const s = gateStyle(status)
  const text =
    status === 'PASS' ? '○ PASS' : status === 'FLAG' ? '△ 주의' : status === 'FAIL' ? '✕ FAIL' : `${s.icon} ${status}`
  return (
    <span
      className="px-2 py-[2px] rounded-md font-label-sm text-label-sm whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {text}
    </span>
  )
}
