// BarChart 컴포넌트 - 가로/세로 막대 차트
import type { ChartDataItem } from './types'

interface Props {
  data: ChartDataItem[]
  orientation?: 'horizontal' | 'vertical'
  height?: number
  showValues?: boolean
  className?: string
}

export function BarChart({
  data,
  orientation = 'horizontal',
  height = 300,
  showValues = true,
  className = '',
}: Props) {
  const max = Math.max(...data.map((d) => d.value), 1)

  if (orientation === 'horizontal') {
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 text-sm text-right truncate flex-shrink-0">{item.label}</div>
            <div className="flex-1 bg-surface-container-highest rounded-full h-6 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  backgroundColor: item.color || '#14181C',
                }}
              />
              {showValues && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                  {item.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex items-end justify-around gap-2 ${className}`} style={{ height }}>
      {data.map((item, i) => (
        <div key={i} className="flex flex-col items-center flex-1">
          <div className="relative w-full flex-1 flex items-end">
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${(item.value / max) * 100}%`,
                backgroundColor: item.color || '#14181C',
              }}
            >
              {showValues && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-xs font-medium pb-1">
                  {item.value}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-center mt-2 truncate w-full">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
