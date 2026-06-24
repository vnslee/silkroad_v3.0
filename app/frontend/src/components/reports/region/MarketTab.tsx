// 시장 배경(참고) 탭 — 국가별 시장 카드 2열 그리드.
import type { RegionReportData, RegionMarketCountry } from '../types'
import { countryKo, Flag, SourcePill } from './shared'

export function MarketTab({ data }: { data: RegionReportData }) {
  const mb = data.tabs.tab_2_3_market_background
  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h2 className="font-headline-md text-headline-md text-primary m-0">시장 배경 (참고)</h2>
        <SourcePill flag="EXT" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {mb.countries.map((c) => (
          <MarketCard key={c.country} country={c} />
        ))}
      </div>
    </section>
  )
}

function Field({ label, pillSuffix, children }: { label: string; pillSuffix?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-xs mb-xs">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">{label}</span>
        <SourcePill flag="EXT" suffix={pillSuffix} />
      </div>
      {children}
    </div>
  )
}

function MarketCard({ country }: { country: RegionMarketCountry }) {
  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
      <div className="flex items-center gap-sm mb-sm border-b border-surface-border pb-sm">
        <Flag code={country.country} className="w-6 h-4" />
        <h3 className="font-headline-md text-headline-md text-primary m-0">{countryKo(country.country, country.country_name)}</h3>
        <span className="text-text-secondary">({country.country_name})</span>
      </div>
      <div className="flex flex-col gap-sm">
        {country.oem_top5?.length > 0 && (
          <Field label="OEM Top 5" pillSuffix="· ranking">
            <ol className="list-decimal pl-5 flex flex-col gap-[2px]">
              {country.oem_top5.map((o) => (
                <li key={o.rank} className="text-body-sm">
                  <span className="text-primary font-medium">{o.name}</span> <span className="text-text-secondary">{o.market_share}</span>
                </li>
              ))}
            </ol>
          </Field>
        )}
        {country.brand_top10?.length > 0 && (
          <Field label="브랜드 Top 10" pillSuffix="· ranking">
            <div className="text-body-sm text-on-surface-variant">{country.brand_top10.join(', ')}</div>
          </Field>
        )}
        {country.competitors?.length > 0 && (
          <Field label="주요 경쟁사">
            <div className="text-body-sm text-on-surface-variant">{country.competitors.join(', ')}</div>
          </Field>
        )}
        {country.purchase_pattern != null && (
          <Field label="구매 패턴(할부·리스)">
            <div className="text-body-sm text-on-surface-variant">
              {country.purchase_pattern}
              {country.purchase_pattern_unit ?? '%'}
            </div>
          </Field>
        )}
        {country.avg_new_car_price && (
          <Field label="평균 신차가격" pillSuffix="· single_value">
            <div className="text-body-sm text-on-surface-variant">{country.avg_new_car_price}</div>
          </Field>
        )}
        {country.qualitative_summary && (
          <Field label="국가 요약" pillSuffix="· qualitative">
            <div className="text-body-sm text-on-surface-variant">{country.qualitative_summary}</div>
          </Field>
        )}
      </div>
    </div>
  )
}
