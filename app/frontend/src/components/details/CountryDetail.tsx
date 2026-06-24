// CountryDetail (P1) — 국가 상세 정보 화면
// mockup: architecture/.../01_country_detail.html (Kinetic Enterprise).
// 레이아웃: 2열 그리드 — 좌(핵심 지표 추이 차트 + 경쟁 금융사 Top3), 우(AI 인사이트 불릿 + 베이스라인 국가).
import type { CountryDetailData, DetailItem, RankedEntity } from '../reports/types'
import { LineChart } from '../charts'

interface Props {
  data: CountryDetailData
  className?: string
}

// overall_insight 문장을 불릿으로 분리(마침표 기준, 약어 오분할 방지로 최소 길이 컷).
function toBullets(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[.。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
}

function findItem(items: DetailItem[], name: string): DetailItem | undefined {
  return items.find((it) => it.item.includes(name))
}

export function CountryDetail({ data, className = '' }: Props) {
  const items = data.items || []

  // 차트: timeseries 보유 score 항목 중 GDP 성장률 + 신차 판매대수 우선(둘 다 mockup 계열).
  const gdp = findItem(items, 'GDP 성장률')
  const sales = findItem(items, '신차 판매대수')

  // 경쟁 금융사 Top (금융사 순위 value=객체배열).
  const finRank = findItem(items, '금융사 순위')
  const competitors: RankedEntity[] = Array.isArray(finRank?.value)
    ? (finRank!.value as RankedEntity[]).slice(0, 3)
    : []

  const bullets = toBullets(data.overall_insight).slice(0, 6)

  const statusLabel = data.is_baseline ? '기준국' : '미진출'
  const statusStyle = data.is_baseline
    ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
    : 'bg-surface-container text-on-surface-variant'

  return (
    <div className={`flex-1 bg-background flex items-start justify-center p-md ${className}`}>
      <div className="relative z-chrome max-w-5xl w-full mx-auto border border-surface-border rounded-xl card-shadow flex flex-col bg-surface-container-lowest">
        <div className="p-lg flex flex-col gap-xl">
          {/* 헤더: 국가명 + 상태 배지 */}
          <div className="flex items-center gap-sm flex-wrap">
            <span
              className="material-symbols-outlined text-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              public
            </span>
            <h2 className="font-headline-lg text-headline-lg text-primary">{data.country}</h2>
            <span className="font-body-lg text-body-lg text-on-surface-variant">
              {data.country_ko}
            </span>
            <span
              className={`ml-auto inline-flex items-center rounded-full px-3 py-0.5 font-label-sm text-label-sm uppercase tracking-wide ${statusStyle}`}
            >
              {statusLabel}
            </span>
          </div>

          {/* 본문 2열 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {/* 좌: 차트 + 경쟁사 */}
            <div className="flex flex-col gap-lg">
              <div className="border border-surface-border rounded-lg p-md bg-surface">
                <div className="flex justify-between items-center mb-md">
                  <h4 className="font-label-md text-label-md text-on-surface-variant">
                    핵심 시장 지표 추이
                  </h4>
                </div>
                {gdp?.timeseries ? (
                  <LineChart
                    data={gdp.timeseries}
                    seriesLabel="GDP 성장률"
                    height={160}
                  />
                ) : sales?.timeseries ? (
                  <LineChart data={sales.timeseries} seriesLabel="신차 판매대수" height={160} />
                ) : (
                  <p className="font-body-sm text-body-sm text-on-surface-variant py-md">
                    시계열 데이터가 없습니다.
                  </p>
                )}
              </div>

              {competitors.length > 0 && (
                <div>
                  <h3 className="font-headline-md text-headline-md text-primary mb-md flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary">groups</span>
                    경쟁 금융사 Top {competitors.length}
                  </h3>
                  <div className="border border-surface-border rounded-lg bg-surface overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-variant/40 border-b border-surface-border">
                          <th className="py-sm px-md font-label-sm text-label-sm text-outline uppercase tracking-wider">
                            #
                          </th>
                          <th className="py-sm px-md font-label-sm text-label-sm text-outline uppercase tracking-wider">
                            금융사
                          </th>
                          <th className="py-sm px-md font-label-sm text-label-sm text-outline uppercase tracking-wider text-right">
                            점유율
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map((c) => (
                          <tr
                            key={c.rank}
                            className="border-b border-surface-border last:border-0 hover:bg-surface-variant/40 transition-colors"
                          >
                            <td className="py-sm px-md font-label-md text-label-md text-primary font-bold w-8">
                              {c.rank}
                            </td>
                            <td className="py-sm px-md font-body-md text-body-md text-on-surface break-words">
                              {c.name}
                            </td>
                            <td className="py-sm px-md font-label-md text-label-md text-secondary font-semibold text-right whitespace-nowrap">
                              {c.market_share ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 우: AI 인사이트 + 베이스라인 */}
            <div className="flex flex-col gap-lg lg:border-l border-surface-border lg:pl-lg">
              <h3 className="font-headline-md text-headline-md text-primary -mb-2 flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary">auto_awesome</span>
                AI 인사이트
              </h3>
              <ul className="flex flex-col gap-xs">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-sm py-[2px] first:pt-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-[8px] shrink-0" />
                    <span className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>

              <div>
                <h3 className="font-headline-md text-headline-md text-primary mb-sm flex items-center gap-sm">
                  <span className="material-symbols-outlined text-secondary">star</span>
                  국가 기본 정보
                </h3>
                <div className="border border-surface-border rounded-lg bg-surface overflow-hidden flex flex-col lg:flex-row">
                  <InfoCell label="권역" value={data.region} />
                  <InfoCell label="통화" value={data.currency} />
                  <InfoCell label="데이터 기준연도" value={String(data.data_year)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 py-sm px-md border-b lg:border-b-0 lg:border-r border-surface-border last:border-0">
      <div className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-xs">
        {label}
      </div>
      <div className="font-body-md text-body-md text-on-surface break-words">{value}</div>
    </div>
  )
}
