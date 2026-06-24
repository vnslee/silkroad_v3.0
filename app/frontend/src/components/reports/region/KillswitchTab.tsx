// 킬스위치 탭 — 게이트 × 국가 PASS/FAIL 매트릭스.
import type { RegionReportData } from '../types'
import { countryKo, Flag, SourcePill } from './shared'

export function KillswitchTab({ data }: { data: RegionReportData }) {
  const ks = data.tabs.tab_2_0_killswitch
  const gates = ks.gates

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h2 className="font-headline-md text-headline-md text-primary m-0">킬스위치 매트릭스</h2>
        <SourcePill flag="EXT" />
        <SourcePill flag="CALC" suffix="· status_matrix" />
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant -mt-sm">
        통과 {ks.passed_count}개국 · 탈락 {ks.failed_count}개국. 탈락국({ks.failed_count > 0 ? ks.failed.join(', ') : '없음'})은 이후
        스코어링에서 제외.
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
              <th className="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">종합</th>
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
                <td className="py-sm px-sm">
                  <span
                    className="px-2 py-[2px] rounded-md font-label-sm text-label-sm"
                    style={c.pass ? { background: '#e9f3ee', color: '#4f8a6d' } : { background: '#f7e4e0', color: '#c0533f' }}
                  >
                    {c.pass ? '통과' : '탈락'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GateBadge({ status }: { status: string }) {
  const pass = status === 'PASS'
  return (
    <span
      className="px-2 py-[2px] rounded-md font-label-sm text-label-sm"
      style={pass ? { background: '#e9f3ee', color: '#4f8a6d' } : { background: '#f7e4e0', color: '#c0533f' }}
    >
      {pass ? '○ PASS' : `× ${status}`}
    </span>
  )
}
