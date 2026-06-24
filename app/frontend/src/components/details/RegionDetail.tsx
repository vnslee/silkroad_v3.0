// RegionDetail (P2) — 권역 상세 정보 화면
// mockup: architecture/.../02_region_detail.html (Kinetic Enterprise).
// 레이아웃: 헤더(권역명) + 2열(권역 지도 SVG + 국가 목록) + 권역 인사이트.
// 퀵윈 점수·판정은 권역 보고서(report) 산출물이라 리서치 JSON엔 없음 → 보유국/후보국 구분과
// baseline 표시까지만 표현(점수 임의 생성 금지).
import type { RegionDetailData, CountryDetailData } from '../reports/types'

interface Props {
  data: RegionDetailData
  className?: string
}

// mockup 지도 좌표(EU 기준) — 코드별 viewBox(0 10 82 76) 좌표. 없으면 그리드 폴백.
const EU_COORDS: Record<string, { x: number; y: number }> = {
  ES: { x: 22, y: 76 },
  PL: { x: 68, y: 32 },
  CZ: { x: 60, y: 47 },
  HU: { x: 72, y: 53 },
  DE: { x: 50, y: 40 },
  FR: { x: 30, y: 55 },
  IT: { x: 52, y: 70 },
  GB: { x: 20, y: 26 },
  AT: { x: 57, y: 57 },
  DK: { x: 44, y: 18 },
  NL: { x: 37, y: 35 },
  PT: { x: 10, y: 74 },
}

const OPERATING = '#14181C'
const CANDIDATE = '#e6e3db'

function bullets(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[.。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
}

export function RegionDetail({ data, className = '' }: Props) {
  const countries = data.countries || []
  const baselineCode = data.baseline_country

  // 좌표 보유 국가만 지도에 표시(없으면 균등 그리드 배치).
  const mapped = countries.map((c, i) => {
    const coord = EU_COORDS[c.code] ?? {
      x: 14 + (i % 5) * 16,
      y: 22 + Math.floor(i / 5) * 22,
    }
    const isOperating = c.is_baseline || c.code === baselineCode
    return { c, coord, isOperating }
  })

  // 인사이트: baseline 국가의 overall_insight를 권역 요약으로 사용(없으면 첫 국가).
  const insightSrc =
    countries.find((c) => c.is_baseline || c.code === baselineCode) ?? countries[0]
  const regionBullets = bullets(insightSrc?.overall_insight ?? '').slice(0, 4)

  return (
    <div
      className={`flex items-start justify-center min-h-full w-full p-margin-mobile md:p-margin-desktop bg-background ${className}`}
    >
      <div className="w-full max-w-5xl rounded-xl custom-shadow-level-3 flex flex-col border-surface-border bg-surface-container">
        <div className="p-lg flex flex-col gap-xl">
          {/* 제목 */}
          <div className="flex items-center gap-sm flex-wrap">
            <span
              className="material-symbols-outlined text-primary text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              public
            </span>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">
              {data.region}
            </h2>
            <span className="font-body-lg text-body-lg text-on-surface-variant">
              {data.region_ko}
            </span>
          </div>

          {/* 지도 + 국가 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md items-stretch">
            {/* 권역 지도 */}
            <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
              <h3 className="font-headline-md text-[18px] leading-[24px] text-primary font-bold mb-md flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary text-[20px]">map</span>
                권역 지도
              </h3>
              <div className="flex-1 flex items-center justify-center min-h-[260px]">
                <svg
                  viewBox="0 10 82 76"
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-full max-h-[300px]"
                  role="img"
                  aria-label={`${data.code} 권역 진출 상태 지도`}
                >
                  {mapped.map(({ c, coord, isOperating }) => (
                    <g key={c.code}>
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r="6.4"
                        fill={isOperating ? OPERATING : CANDIDATE}
                        stroke="#fbf9f4"
                        strokeWidth="1"
                      />
                      <text
                        x={coord.x}
                        y={coord.y + 2.1}
                        textAnchor="middle"
                        fontSize="4.4"
                        fontWeight="700"
                        fill={isOperating ? '#ffffff' : '#3a4048'}
                      >
                        {c.code}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="flex flex-wrap gap-md mt-md pt-md border-t border-surface-border">
                <LegendDot color={OPERATING} label="운영중(기준국)" />
                <LegendDot color={CANDIDATE} label="미진출/후보" />
              </div>
            </div>

            {/* 국가 목록 */}
            <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
              <h3 className="font-headline-md text-[18px] leading-[24px] text-primary font-bold mb-md flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  leaderboard
                </span>
                권역 구성 국가 ({countries.length})
              </h3>
              <table className="w-full text-left border-collapse font-body-sm text-body-sm">
                <thead>
                  <tr className="bg-surface-light border-b border-surface-border">
                    <th className="p-sm font-label-md text-label-md text-outline font-semibold">
                      국가
                    </th>
                    <th className="p-sm font-label-md text-label-md text-outline font-semibold">
                      통화
                    </th>
                    <th className="p-sm font-label-md text-label-md text-outline font-semibold text-right">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c: CountryDetailData) => {
                    const isOperating = c.is_baseline || c.code === baselineCode
                    return (
                      <tr
                        key={c.code}
                        className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
                      >
                        <td className="p-sm text-on-surface whitespace-nowrap">
                          {c.country_ko}{' '}
                          <span className="font-mono text-xs text-on-surface-variant">
                            {c.code}
                          </span>
                        </td>
                        <td className="p-sm text-on-surface-variant">{c.currency}</td>
                        <td className="p-sm text-right">
                          <span
                            className="px-2 py-1 rounded-md font-label-sm text-label-sm whitespace-nowrap"
                            style={
                              isOperating
                                ? { background: '#eef9c9', color: '#404d00' }
                                : { background: '#f2f0e9', color: '#3a4048' }
                            }
                          >
                            {isOperating ? '기준국' : '후보'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 권역 인사이트 */}
          {regionBullets.length > 0 && (
            <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">
              <div className="flex items-center gap-sm mb-md">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  psychology
                </span>
                <h3 className="font-headline-md text-[18px] leading-[24px] text-primary font-bold flex-1">
                  권역 인사이트
                </h3>
                <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full whitespace-nowrap">
                  AI 분석
                </span>
              </div>
              <div className="flex flex-col gap-sm">
                {regionBullets.map((b, i) => (
                  <div
                    key={i}
                    className="flex gap-md items-start rounded-lg bg-surface-light p-md"
                  >
                    <span className="font-headline-md text-[16px] leading-[24px] text-secondary font-bold shrink-0 w-6 text-center">
                      {i + 1}
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface m-0">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">
      <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
