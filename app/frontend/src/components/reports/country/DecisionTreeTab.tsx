// 탭2 시스템 결정 트리 — 결정트리(3/4) + 구독료 구간표(1/4)
import type { CountryReportData } from '../types'
import { DecisionTreeSvg, DecisionSidePanel, Panel } from './shared'

export function DecisionTreeTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const dec = data.tabs.tab_1_2_decision
  const tco = data.tabs.tab_1_3_tco
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아' }
  const baseKo = baseKoMap[data.target.base_country] ?? data.target.base_country
  const sub = tco.subscription_details ?? ({} as NonNullable<typeof tco.subscription_details>)

  // 우측 패널 제목/아이콘 — 결정별로 바뀐다.
  const sidePanelTitle =
    dec.decision === 'external_solution'
      ? '추천 외부솔루션'
      : dec.decision === 'hq_build'
        ? '본사 구축 예상 비용'
        : '구독료 구간표'
  const sidePanelIcon = dec.decision === 'external_solution' ? 'extension' : dec.decision === 'hq_build' ? 'domain' : 'payments'

  // 기준국·이미 진출(운영중)한 국가는 신규 진출 결정 트리가 적용되지 않음 → 권고 안내로 대체.
  const isAlreadyDeployed =
    dec.is_already_deployed ||
    dec.decision === 'baseline_already_deployed' ||
    dec.decision === 'already_deployed'
  if (isAlreadyDeployed) {
    const rec = typeof dec.recommendation === 'object' ? dec.recommendation.ko : dec.recommendation
    return (
      <Panel icon="account_tree" title="시스템 결정 트리">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {rec ??
            `${data.country_meta.country_ko}은(는) 이미 시스템이 운영 중인 국가로, 신규 진출 결정 트리는 적용되지 않습니다.`}
        </p>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-gutter items-stretch">
      <div className="lg:w-3/4 flex min-w-0">
        <Panel icon="account_tree" title="시스템 결정 트리" className="h-full w-full">
          <DecisionTreeSvg
            score={sim.overall_score}
            baseCountryKo={baseKo}
            decision={dec.decision}
            regionSystemExists={dec.region_system_exists}
            expansionMin={dec.thresholds?.expansion_min_score}
            hqBuildMin={dec.thresholds?.hq_build_min_score}
          />
        </Panel>
      </div>
      <div className="lg:w-1/4 flex min-w-0">
        <Panel icon={sidePanelIcon} title={sidePanelTitle} className="h-full w-full">
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
              newCumulative: sub.total_volume ?? tco.existing_total_volume + tco.expected_contracts,
              currency: sub.currency ?? tco.currency,
            }}
          />
        </Panel>
      </div>
    </div>
  )
}
