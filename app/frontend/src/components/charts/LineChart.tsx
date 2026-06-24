// LineChart — 시계열 추이 (AISea: 과거 실선 + 예측 점선 + 원형 마커)
// 스타일: viewBox 320x160, 과거 잉크블랙 #14181C / 예측 블루 #2f6be0.
import { useMemo } from 'react'
import type { TimeseriesData } from './types'

interface Props {
  data: TimeseriesData
  /** 선택: 같은 X축(연도)에 겹쳐 그릴 두 번째 시계열 — 단위가 같은 지표끼리 비교용 */
  secondary?: TimeseriesData | null
  title?: string
  height?: number
  showLegend?: boolean
  /** 범례 라벨(기본: 실적/예측) */
  seriesLabel?: string
  /** secondary 시계열 범례 라벨 */
  secondaryLabel?: string
  /** 두 시계열의 단위·스케일이 다를 때, 각 선을 자기 값 범위로 독립 정규화(이중 y축처럼)해 둘 다 기울기가 살게 한다.
   *  기본(false)은 공통 y축 — 단위가 같고 절대값 비교가 의미 있을 때 사용. */
  normalizeEach?: boolean
  /** 주 시계열을 선 대신 막대로 그린다(콤보 차트). history=채운 막대, forecast=빗금 막대. */
  primaryAsBars?: boolean
  className?: string
}

const VIEW_W = 320
// 패널 폭을 꽉 채우되 너무 높아지지 않도록 납작한 비율(320:108 ≈ 3:1). 높이는 폭의 약 34%.
const VIEW_H = 108
const PAD = 10

// secondary 시계열 색(주 시계열은 잉크블랙 #14181C, 보조는 녹색 #4f8a6d).
const SECONDARY_COLOR = '#4f8a6d'

export function LineChart({
  data,
  secondary = null,
  title,
  // height는 패널 폭에 맞춰 자동(viewBox 비율)이라 더는 쓰지 않음 — 호환을 위해 prop만 유지하고 무시.
  showLegend = true,
  seriesLabel,
  secondaryLabel,
  normalizeEach = false,
  primaryAsBars = false,
  className = '',
}: Props) {
  const { primary, secondaryPaths, barW, baselineY, xLabels } = useMemo(() => {
    // X축은 두 시계열을 합친 연도 범위로 잡아 같은 격자에 정렬한다.
    const merged = [
      ...data.history,
      ...(data.forecast || []),
      ...((secondary?.history) || []),
      ...((secondary?.forecast) || []),
    ]
    if (merged.length === 0) {
      return {
        primary: null,
        secondaryPaths: null,
        barW: 16,
        baselineY: VIEW_H - PAD,
        xLabels: [] as { label: string; leftPct: number }[],
      }
    }

    const years = Array.from(new Set(merged.map((p) => p.year))).sort((a, b) => a - b)
    const minYr = years[0]
    const maxYr = years[years.length - 1]
    const spanYr = maxYr - minYr || 1

    // 공통 y축(기본): 두 시계열을 합친 범위. normalizeEach면 각 시계열이 자기 범위를 따로 쓴다.
    const rangeOf = (pts: { value: number }[]) => {
      const vs = pts.map((p) => p.value)
      const mn = Math.min(...vs)
      const mx = Math.max(...vs)
      return { min: mn, span: mx - mn || 1 }
    }
    const sharedRange = rangeOf(merged)

    const toX = (yr: number) => PAD + ((yr - minYr) / spanYr) * (VIEW_W - PAD * 2)
    const toYWith = (v: number, r: { min: number; span: number }) =>
      PAD + (1 - (v - r.min) / r.span) * (VIEW_H - PAD * 2)

    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    const buildSeries = (ts: TimeseriesData) => {
      // normalizeEach면 이 시계열(history+forecast) 자체 범위로 정규화 → 단위가 달라도 기울기가 살아남.
      const all = [...ts.history, ...(ts.forecast || [])]
      const r = normalizeEach ? rangeOf(all) : sharedRange
      const toY = (v: number) => toYWith(v, r)
      const histPts = ts.history.map((p) => ({ x: toX(p.year), y: toY(p.value) }))
      const forePts = (ts.forecast || []).map((p) => ({ x: toX(p.year), y: toY(p.value) }))
      // 예측선은 과거 마지막 점에서 이어지도록 시작점을 공유.
      const foreWithJoin =
        histPts.length && forePts.length ? [histPts[histPts.length - 1], ...forePts] : forePts
      return {
        historyPath: toPath(histPts),
        forecastPath: toPath(foreWithJoin),
        historyPts: histPts,
        forecastPts: forePts,
      }
    }

    return {
      primary: buildSeries(data),
      secondaryPaths: secondary ? buildSeries(secondary) : null,
      // 막대 폭 — 연도 간격(픽셀)의 60%. 막대는 차트 바닥(baseline)에서 각 값까지.
      barW: spanYr > 0 ? ((VIEW_W - PAD * 2) / spanYr) * 0.6 : 16,
      baselineY: VIEW_H - PAD,
      // 라벨은 점(마커)과 같은 toX 좌표를 공유해야 정렬이 맞는다.
      // 좌표를 VIEW_W 기준 백분율로 환산해 절대 배치한다(아래 렌더 참고).
      xLabels: years.map((y) => ({ label: y.toString(), leftPct: (toX(y) / VIEW_W) * 100 })),
    }
  }, [data, secondary, normalizeEach])

  const historyPath = primary?.historyPath ?? ''
  const forecastPath = primary?.forecastPath ?? ''
  const historyPts = primary?.historyPts ?? []
  const forecastPts = primary?.forecastPts ?? []

  return (
    <div className={className}>
      {title && (
        <h4 className="font-label-md text-label-md text-on-surface-variant mb-md">{title}</h4>
      )}
      {/* 차트+라벨을 한 래퍼에 묶고 패널(부모) 폭을 채우되, 아주 넓은 패널에선 상한을 둬 과대해지지 않게 한다.
          폭이 SVG·라벨 div에 동일하게 적용돼 점·연도 정렬이 유지된다. */}
      <div className="relative w-full" style={{ maxWidth: 640 }}>
        {/* SVG 폭 = 패널 폭 = 아래 라벨 div 폭. viewBox 비율(2:1)대로 높이가 폭에 따라간다(maxHeight 금지 — 주면 가운데로 축소돼 라벨과 어긋남). */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block w-full h-auto"
          role="img"
          aria-label={title || '시계열 추이 차트'}
        >
          {primaryAsBars ? (
            <>
              {/* forecast 막대 빗금 패턴 */}
              <defs>
                <pattern
                  id="lc-bar-hatch"
                  patternUnits="userSpaceOnUse"
                  width="3"
                  height="3"
                  patternTransform="rotate(45)"
                >
                  <rect width="3" height="3" fill="#fff" />
                  <line x1="0" y1="0" x2="0" y2="3" stroke="#2f6be0" strokeWidth="0.8" />
                </pattern>
              </defs>
              {/* history = 채운 막대(잉크블랙) */}
              {historyPts.map((p, i) => (
                <rect
                  key={`hb${i}`}
                  x={p.x - barW / 2}
                  y={p.y}
                  width={barW}
                  height={Math.max(0, baselineY - p.y)}
                  fill="#14181C"
                />
              ))}
              {/* forecast = 빗금 막대(블루 외곽) */}
              {forecastPts.map((p, i) => (
                <rect
                  key={`fb${i}`}
                  x={p.x - barW / 2}
                  y={p.y}
                  width={barW}
                  height={Math.max(0, baselineY - p.y)}
                  fill="url(#lc-bar-hatch)"
                  stroke="#2f6be0"
                  strokeWidth="0.5"
                  opacity="0.85"
                />
              ))}
            </>
          ) : (
            <>
              {historyPath && (
                <path d={historyPath} fill="none" stroke="#14181C" strokeWidth="2" />
              )}
              {forecastPath && (
                <path
                  d={forecastPath}
                  fill="none"
                  stroke="#14181C"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
              )}
              {historyPts.map((p, i) => (
                <circle key={`h${i}`} cx={p.x} cy={p.y} r="2" fill="#14181C" />
              ))}
              {forecastPts.map((p, i) => (
                <circle key={`f${i}`} cx={p.x} cy={p.y} r="2" fill="#2f6be0" />
              ))}
            </>
          )}
          {secondaryPaths && (
            <>
              {secondaryPaths.historyPath && (
                <path d={secondaryPaths.historyPath} fill="none" stroke={SECONDARY_COLOR} strokeWidth="2" />
              )}
              {secondaryPaths.forecastPath && (
                <path
                  d={secondaryPaths.forecastPath}
                  fill="none"
                  stroke={SECONDARY_COLOR}
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
              )}
              {secondaryPaths.historyPts.map((p, i) => (
                <circle key={`sh${i}`} cx={p.x} cy={p.y} r="2" fill={SECONDARY_COLOR} />
              ))}
              {secondaryPaths.forecastPts.map((p, i) => (
                <circle key={`sf${i}`} cx={p.x} cy={p.y} r="2" fill={SECONDARY_COLOR} opacity="0.6" />
              ))}
            </>
          )}
        </svg>

        {/* X축 라벨 — SVG와 같은 래퍼(같은 폭) 안에서, 각 점(마커)과 동일한 toX 좌표(leftPct)에 절대 배치해
            점·연도가 정확히 정렬되게 한다. 좁은 화면에선 중간만 격년으로 솎되(양끝 항상 노출) 좌표는 유지. */}
        {xLabels.length > 0 && (
        <div className="relative mt-xs h-[1.2em] font-label-sm text-label-sm text-on-surface-variant">
          {xLabels.map((x, i) => {
            const isEdge = i === 0 || i === xLabels.length - 1
            const thin = !isEdge && i % 2 === 1
            // 양끝은 안쪽으로 정렬해 잘리지 않게, 중간은 가운데 정렬.
            const translate = i === 0 ? '0' : i === xLabels.length - 1 ? '-100%' : '-50%'
            return (
              <span
                key={i}
                className={`absolute whitespace-nowrap ${thin ? 'hidden sm:inline' : ''}`}
                style={{ left: `${x.leftPct}%`, transform: `translateX(${translate})` }}
              >
                {x.label}
              </span>
            )
          })}
        </div>
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-md gap-y-xs mt-sm">
          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span style={{ display: 'inline-block', width: 10, height: 2, background: '#14181C' }} />
            {seriesLabel || '실적'}
          </span>
          {secondaryPaths && (
            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <span style={{ display: 'inline-block', width: 10, height: 2, background: SECONDARY_COLOR }} />
              {secondaryLabel || '보조'}
            </span>
          )}
          {((data.forecast && data.forecast.length > 0) ||
            (secondary?.forecast && secondary.forecast.length > 0)) && (
            <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 2,
                  background: '#2f6be0',
                }}
              />
              예측
            </span>
          )}
        </div>
      )}
    </div>
  )
}
