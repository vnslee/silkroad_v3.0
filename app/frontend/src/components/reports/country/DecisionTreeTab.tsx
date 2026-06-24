// 탭2 시스템 결정 트리 — 결정트리(3/4) + 구독료 구간표(1/4)
import type { CountryReportData } from '../types'
import { DecisionTreeSvg, SubscriptionTierTable, Panel } from './shared'

export function DecisionTreeTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const tco = data.tabs.tab_1_3_tco
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아' }
  const baseKo = baseKoMap[data.target.base_country] ?? data.target.base_country
  const sub = tco.subscription_details ?? ({} as NonNullable<typeof tco.subscription_details>)

  return (
    <div className="flex flex-col lg:flex-row gap-gutter items-stretch">
      <div className="lg:w-3/4 flex min-w-0">
        <Panel icon="account_tree" title="시스템 결정 트리" className="h-full w-full">
          <DecisionTreeSvg score={sim.overall_score} baseCountryKo={baseKo} />
        </Panel>
      </div>
      <div className="lg:w-1/4 flex min-w-0">
        <Panel icon="payments" title="구독료 구간표" className="h-full w-full">
          <SubscriptionTierTable
            tiers={tco.subscription_tiers}
            appliedPrice={sub.unit_price}
            existing={sub.existing_volume ?? tco.existing_total_volume}
            newAdded={sub.new_volume ?? tco.expected_contracts}
            newCumulative={sub.total_volume ?? tco.existing_total_volume + tco.expected_contracts}
          />
        </Panel>
      </div>
    </div>
  )
}
