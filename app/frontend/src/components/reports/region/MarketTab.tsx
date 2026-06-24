// 시장 배경(참고) 탭 — 국가별 시장 카드 2열 그리드.
import type { RegionReportData, RegionMarketCountry } from '../types'
import { countryKo, Flag, SourcePill } from './shared'
import { useT } from '../../../i18n/dict'
import { useLang, pickLang } from '../../../i18n/locale'
import type { Lang } from '../../../store'
import { useFx } from '../Money'
import { parseFirstAmount, toKRW, formatKRW } from '../../../utils/currency'

// 신차가격(자유서술 문자열)에서 첫 금액을 한화로 환산해 원문 위에 크게 병기.
// 파싱·환산 실패 시 원문만 표시(그레이스풀).
function NewCarPrice({ text }: { text: string }) {
  const fx = useFx()
  const t = useT()
  const hit = parseFirstAmount(text)
  const krw = hit ? toKRW(hit.value, hit.currency, fx) : null
  return (
    <div className="text-body-sm text-on-surface-variant">
      {krw != null && <span className="font-semibold text-text-primary">{t('rmkt.approx')} {formatKRW(krw)}</span>}
      <span className={krw != null ? 'block text-label-sm text-text-secondary' : undefined}>{text}</span>
    </div>
  )
}

export function MarketTab({ data }: { data: RegionReportData }) {
  const mb = data.tabs.tab_2_3_market_background
  const t = useT()
  const lang = useLang()
  return (
    <section className="flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h2 className="font-headline-md text-headline-md text-primary m-0">{t('rmkt.background')}</h2>
        <SourcePill flag="EXT" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {mb.countries.map((c) => (
          <MarketCard key={c.country} country={c} lang={lang} />
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

function MarketCard({ country, lang }: { country: RegionMarketCountry; lang: Lang }) {
  const t = useT()
  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
      <div className="flex items-center gap-sm mb-sm border-b border-surface-border pb-sm">
        <Flag code={country.country} className="w-6 h-4" />
        <h3 className="font-headline-md text-headline-md text-primary m-0">
          {lang === 'en' ? country.country_name : countryKo(country.country, country.country_name)}
        </h3>
        <span className="text-text-secondary">({country.country_name})</span>
      </div>
      <div className="flex flex-col gap-sm">
        {country.oem_top5?.length > 0 && (
          <Field label={t('rmkt.oemTop5')} pillSuffix="· ranking">
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
          <Field label={t('rmkt.brandTop10')} pillSuffix="· ranking">
            <div className="text-body-sm text-on-surface-variant">{country.brand_top10.join(', ')}</div>
          </Field>
        )}
        {country.competitors?.length > 0 && (
          <Field label={t('rmkt.competitors')}>
            <div className="text-body-sm text-on-surface-variant">{country.competitors.join(', ')}</div>
          </Field>
        )}
        {country.purchase_pattern != null && (
          <Field label={t('rmkt.purchasePattern')}>
            <div className="text-body-sm text-on-surface-variant">
              {country.purchase_pattern}
              {country.purchase_pattern_unit ?? '%'}
            </div>
          </Field>
        )}
        {country.avg_new_car_price && (
          <Field label={t('rmkt.avgPrice')} pillSuffix="· single_value">
            <NewCarPrice text={pickLang(lang, country.avg_new_car_price, country.avg_new_car_price_en)} />
          </Field>
        )}
        {country.qualitative_summary && (
          <Field label={t('rmkt.countrySummary')} pillSuffix="· qualitative">
            <div className="text-body-sm text-on-surface-variant">{pickLang(lang, country.qualitative_summary, country.qualitative_summary_en)}</div>
          </Field>
        )}
      </div>
    </div>
  )
}
