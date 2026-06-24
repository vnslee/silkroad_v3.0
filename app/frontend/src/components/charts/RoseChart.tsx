// RoseChart 컴포넌트 — 로즈(나이팅게일/polar area) 차트
// 각 항목을 동일 각도의 쐐기(wedge)로 그리고, 점유율(value)을 반지름으로 인코딩한다.
// 경쟁 금융사 Top5 점유율 시각화에 사용(CountryDetail P1).
import { useMemo } from 'react'
import type { RoseChartDatum } from './types'

interface Props {
  data: RoseChartDatum[]
  size?: number
  className?: string
}

// Kinetic Enterprise 팔레트 기반 세그먼트 색(accent 라임 → secondary 그레이 그라데이션).
// 순위가 높을수록(점유율 큼) 진한 강조색을 부여한다.
const SEGMENT_COLORS = ['#C8F051', '#aede3f', '#8fbf3a', '#6f8f44', '#3a4048']

// SVG 좌표계(viewBox 0~100, 중심 50,50)에서 극좌표 → 직교좌표.
function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  }
}

export function RoseChart({ data, size = 280, className = '' }: Props) {
  const { wedges, rings } = useMemo(() => {
    const cx = 50
    const cy = 50
    const maxR = 42
    const innerR = 14 // 가운데 뚫린 도넛형 안쪽 반지름.
    const n = Math.max(data.length, 1)
    const angleStep = (2 * Math.PI) / n
    const maxValue = Math.max(...data.map((d) => d.value), 0) || 1

    const wedges = data.map((d, i) => {
      const start = angleStep * i
      const end = angleStep * (i + 1)
      // 바깥 반지름은 sqrt 스케일 — 면적이 value에 비례하도록(반지름 선형은 면적을 과장).
      // innerR~maxR 구간에 매핑해 가운데를 비운다.
      const outerR = innerR + (maxR - innerR) * Math.sqrt(d.value / maxValue)
      const o1 = polar(cx, cy, outerR, start)
      const o2 = polar(cx, cy, outerR, end)
      const i1 = polar(cx, cy, innerR, end)
      const i2 = polar(cx, cy, innerR, start)
      // 환형 쐐기: 바깥 호(시계방향) → 안쪽 호(반시계방향).
      const path =
        `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 0 1 ${o2.x} ${o2.y} ` +
        `L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 0 0 ${i2.x} ${i2.y} Z`
      return {
        path,
        color: d.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        title: `${i + 1}. ${d.label} — ${d.display ?? `${d.value}%`}`,
      }
    })

    // 배경 가이드 링(점유율 눈금 느낌) — 도넛 바깥 구간만.
    const rings = [0.5, 1].map((s) => innerR + (maxR - innerR) * s)

    return { wedges, rings }
  }, [data])

  return (
    <div className={className}>
      <svg
        viewBox="0 0 100 100"
        className="w-full mx-auto"
        style={{ maxWidth: size, maxHeight: size }}
        role="img"
        aria-label="경쟁 금융사 점유율 로즈 차트"
      >
        {/* 배경 가이드 링 */}
        {rings.map((r, i) => (
          <circle key={i} cx="50" cy="50" r={r} fill="none" stroke="#e6e3db" strokeWidth="0.2" />
        ))}

        {/* 쐐기 */}
        {wedges.map((w, i) => (
          <path key={i} d={w.path} fill={w.color} fillOpacity="0.85">
            <title>{w.title}</title>
          </path>
        ))}
      </svg>

      {/* 범례 — 색·금융사명·점유율 */}
      <ul className="flex flex-col gap-1 mt-3">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: d.color ?? SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
              aria-hidden
            />
            <span className="font-label-md text-label-md text-primary font-bold shrink-0">
              {i + 1}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface truncate">{d.label}</span>
            <span className="ml-auto font-label-md text-label-md text-secondary font-semibold whitespace-nowrap shrink-0">
              {d.display ?? `${d.value}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
