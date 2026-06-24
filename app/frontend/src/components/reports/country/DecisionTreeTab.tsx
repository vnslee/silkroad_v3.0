// 탭2 시스템 결정 트리 — 결정트리(3/4) + 구독료 구간표(1/4)
import type { CountryReportData } from '../types'
import { DecisionTreeSvg, DecisionSidePanel, Panel } from './shared'
import { useT } from '../../../i18n/dict'
import { useLang, locText } from '../../../i18n/locale'

export function DecisionTreeTab({ data }: { data: CountryReportData }) {
  const sim = data.tabs.tab_1_1_similarity
  const dec = data.tabs.tab_1_2_decision
  const tco = data.tabs.tab_1_3_tco
  const t = useT()
  const lang = useLang()
  const baseKoMap: Record<string, string> = { GB: '영국', US: '미국', DE: '독일', FR: '프랑스', IT: '이탈리아', AU: '호주', CL: '칠레' }
  const baseEnMap: Record<string, string> = { GB: 'UK', US: 'USA', DE: 'Germany', FR: 'France', IT: 'Italy', AU: 'Australia', CL: 'Chile' }
  const baseKo = (lang === 'en' ? baseEnMap[data.target.base_country] : baseKoMap[data.target.base_country]) ?? data.target.base_country
  const sub = tco.subscription_details ?? ({} as NonNullable<typeof tco.subscription_details>)

  // APAC(아시아) — 권역 확산·유사도 분기 없이 외부솔루션·자체구축(내재화)을 양쪽 동등 제시(decision="apac_dual").
  const isApac = dec.is_apac === true
  const isApacDual = dec.decision === 'apac_dual'
  // 구독제(EU/NetSol) 여부 — is_subscription 우선, 구버전 데이터는 구독료 티어 존재로 추론.
  // 비구독(미주 권역 확산 등)이면 구독료 구간표 대신 구축비용·기간을 노출(TCO 탭과 일관).
  const isSubscription = tco.is_subscription ?? (tco.subscription_tiers?.length ?? 0) > 0

  // 우측 패널 제목/아이콘 — 결정별로 바뀐다. APAC(양쪽 제시)은 외부솔루션 후보를 노출.
  const sidePanelTitle = isApacDual
    ? t('sum.side.apac')
    : dec.decision === 'external_solution'
      ? t('sum.side.ext')
      : dec.decision === 'hq_build'
        ? isApac
          ? t('dtt.side.internalize')
          : t('sum.side.hq')
        : isSubscription
          ? t('sum.side.sub')
          : t('sum.side.build')
  const sidePanelIcon =
    isApacDual || dec.decision === 'external_solution'
      ? 'extension'
      : dec.decision === 'hq_build'
        ? 'domain'
        : isSubscription
          ? 'payments'
          : 'build'

  // 기준국·이미 진출(운영중)한 국가는 신규 진출 결정 트리가 적용되지 않음 → 권고 안내로 대체.
  const isAlreadyDeployed =
    dec.is_already_deployed ||
    dec.decision === 'baseline_already_deployed' ||
    dec.decision === 'already_deployed'
  if (isAlreadyDeployed) {
    const rec = locText(dec.recommendation, lang)
    return (
      <Panel icon="account_tree" title={t('sum.decisionTree')}>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {rec || t('sum.noDecisionTree').replace('{country}', lang === 'en' ? data.country_meta.country : data.country_meta.country_ko)}
        </p>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-gutter items-stretch">
      <div className="lg:w-3/4 flex min-w-0">
        <Panel icon="account_tree" title={t('sum.decisionTree')} className="h-full w-full">
          <DecisionTreeSvg
            score={sim.overall_score}
            baseCountryKo={baseKo}
            decision={dec.decision}
            regionSystemExists={dec.region_system_exists}
            expansionMin={dec.thresholds?.expansion_min_score}
            hqBuildMin={dec.thresholds?.hq_build_min_score}
            isApac={isApac}
          />
        </Panel>
      </div>
      <div className="lg:w-1/4 flex min-w-0">
        <Panel icon={sidePanelIcon} title={sidePanelTitle} className="h-full w-full">
          <DecisionSidePanel
            decision={dec.decision}
            isApac={isApac}
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
              newCumulative: sub.total_volume ?? tco.existing_total_volume + tco.expected_contracts,
              currency: sub.currency ?? tco.currency,
            }}
          />
        </Panel>
      </div>
    </div>
  )
}
