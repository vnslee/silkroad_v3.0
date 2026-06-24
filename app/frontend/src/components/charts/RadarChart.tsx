// RadarChart 컴포넌트 - 레이더/거미줄 차트
import { useMemo } from 'react'
import type { RadarChartData, RadarAxis } from './types'

interface Props {
  data: RadarChartData[]
  axes: RadarAxis[]
  size?: number
  className?: string
}

export function RadarChart({ data, axes, size = 300, className = '' }: Props) {
  const { polygons, axisLines, labels } = useMemo(() => {
    const center = 50
    const radius = 40
    const angleStep = (2 * Math.PI) / axes.length

    const polarToCartesian = (angle: number, value: number, max: number) => {
      const r = (value / max) * radius
      return {
        x: center + r * Math.cos(angle - Math.PI / 2),
        y: center + r * Math.sin(angle - Math.PI / 2),
      }
    }

    // Axis lines and labels
    const axisLines = axes.map((axis, i) => {
      const angle = angleStep * i
      const end = polarToCartesian(angle, axis.max, axis.max)
      return {
        x1: center,
        y1: center,
        x2: end.x,
        y2: end.y,
      }
    })

    const labels = axes.map((axis, i) => {
      const angle = angleStep * i
      const labelPos = polarToCartesian(angle, axis.max * 1.15, axis.max)
      return {
        x: labelPos.x,
        y: labelPos.y,
        text: axis.name,
      }
    })

    // Data polygons
    const polygons = data.map((dataset) => {
      const points = dataset.scores
        .map((score, i) => {
          const angle = angleStep * i
          const pos = polarToCartesian(angle, score, axes[i]?.max || 100)
          return `${pos.x},${pos.y}`
        })
        .join(' ')
      return {
        points,
        color: dataset.color,
        label: dataset.label,
      }
    })

    return { polygons, axisLines, labels }
  }, [data, axes])

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" className="w-full" style={{ maxWidth: size, maxHeight: size }}>
        {/* Background circles */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx="50"
            cy="50"
            r={40 * scale}
            fill="none"
            stroke="#e6e3db"
            strokeWidth="0.2"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#d3cfc4"
            strokeWidth="0.2"
          />
        ))}

        {/* Data polygons */}
        {polygons.map((polygon, i) => (
          <g key={i}>
            <polygon
              points={polygon.points}
              fill={polygon.color}
              fillOpacity="0.2"
              stroke={polygon.color}
              strokeWidth="0.4"
            />
          </g>
        ))}

        {/* Axis labels */}
        {labels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontSize="3"
            fill="#3a4048"
            dominantBaseline="middle"
          >
            {label.text}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-4">
        {data.map((dataset, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dataset.color }}></div>
            <span className="text-xs">{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
