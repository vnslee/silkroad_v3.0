// LineChart — 시계열 추이 (AISea: 과거 실선 + 예측 점선 + 원형 마커)
// 스타일: viewBox 320x160, 과거 잉크블랙 #14181C / 예측 블루 #2f6be0.
import { useMemo } from 'react'
import type { TimeseriesData } from './types'

interface Props {
  data: TimeseriesData
  title?: string
  height?: number
  showLegend?: boolean
  /** 범례 라벨(기본: 실적/예측) */
  seriesLabel?: string
  className?: string
}

const VIEW_W = 320
const VIEW_H = 160
const PAD = 10

export function LineChart({
  data,
  title,
  height = 160,
  showLegend = true,
  seriesLabel,
  className = '',
}: Props) {
  const { historyPath, forecastPath, historyPts, forecastPts, xLabels } = useMemo(() => {
    const all = [...data.history, ...(data.forecast || [])]
    if (all.length === 0) {
      return { historyPath: '', forecastPath: '', historyPts: [], forecastPts: [], xLabels: [] }
    }

    const values = all.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1

    const xStep = (VIEW_W - PAD * 2) / (all.length - 1 || 1)
    const toX = (i: number) => PAD + i * xStep
    const toY = (v: number) => PAD + (1 - (v - min) / span) * (VIEW_H - PAD * 2)

    const histPts = data.history.map((p, i) => ({ x: toX(i), y: toY(p.value) }))
    const foreSrc = data.forecast || []
    // 예측선은 과거 마지막 점에서 이어지도록 시작점을 공유.
    const forePts = foreSrc.map((p, i) => ({
      x: toX(data.history.length - 1 + i + 1),
      y: toY(p.value),
    }))
    const foreWithJoin =
      histPts.length && forePts.length ? [histPts[histPts.length - 1], ...forePts] : forePts

    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    return {
      historyPath: toPath(histPts),
      forecastPath: toPath(foreWithJoin),
      historyPts: histPts,
      forecastPts: forePts,
      xLabels: all.map((p) => p.year.toString()),
    }
  }, [data])

  return (
    <div className={className}>
      {title && (
        <h4 className="font-label-md text-label-md text-on-surface-variant mb-md">{title}</h4>
      )}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          style={{ maxHeight: height }}
          role="img"
          aria-label={title || '시계열 추이 차트'}
        >
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
        </svg>
      </div>

      {/* X축 라벨 */}
      {xLabels.length > 0 && (
        <div className="flex justify-between mt-xs px-[10px] font-label-sm text-label-sm text-on-surface-variant">
          {xLabels.map((label, i) => (
            <span key={i} className={i % 2 === 1 ? 'hidden sm:inline' : ''}>
              {label}
            </span>
          ))}
        </div>
      )}

      {showLegend && (
        <div className="flex flex-wrap gap-x-md gap-y-xs mt-sm">
          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span style={{ display: 'inline-block', width: 10, height: 2, background: '#14181C' }} />
            {seriesLabel || '실적'}
          </span>
          {data.forecast && data.forecast.length > 0 && (
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
