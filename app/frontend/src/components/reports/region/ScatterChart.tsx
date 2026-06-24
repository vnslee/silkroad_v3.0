// 매력도 × IT 유사도 2축 산점도 — mockup 04_region_report.html SVG 구조 그대로.
// x: 매력도(0~100) → 40~400px, y: IT 유사도(0~100) → 260~20px(위가 큼).

export interface ScatterPoint {
  country: string
  attractiveness: number
  it_similarity: number // raw (0~100)
  is_baseline?: boolean
}

const PLOT_X0 = 40
const PLOT_W = 360
const PLOT_Y0 = 20
const PLOT_H = 240

function px(attr: number): number {
  return PLOT_X0 + (Math.max(0, Math.min(100, attr)) / 100) * PLOT_W
}
function py(it: number): number {
  return PLOT_Y0 + PLOT_H - (Math.max(0, Math.min(100, it)) / 100) * PLOT_H
}

export function ScatterChart({ points }: { points: ScatterPoint[] }) {
  return (
    <>
      <svg viewBox="0 0 420 300" className="w-full" role="img" aria-label="매력도 × IT 유사도 산점도">
        <rect x="40" y="20" width="360" height="240" fill="#f7f6f1" stroke="#e6e3db" />
        <rect x="220" y="20" width="180" height="120" fill="#e9f3ee" opacity="0.4" />
        <line x1="220" y1="20" x2="220" y2="260" stroke="#e6e3db" strokeDasharray="3,3" />
        <line x1="40" y1="140" x2="400" y2="140" stroke="#e6e3db" strokeDasharray="3,3" />
        {/* Quadrant labels */}
        <text x="130" y="40" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">② 단기 진출</text>
        <text x="130" y="54" textAnchor="middle" fontSize="9" fill="#9aa0a6">IT↑ · 매력도↓</text>
        <text x="310" y="40" textAnchor="middle" fontSize="10" fill="#4f8a6d" fontWeight="700">① 퀵윈 최적</text>
        <text x="310" y="54" textAnchor="middle" fontSize="9" fill="#4f8a6d">IT↑ · 매력도↑</text>
        <text x="130" y="245" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">④ 후순위</text>
        <text x="130" y="258" textAnchor="middle" fontSize="9" fill="#9aa0a6">IT↓ · 매력도↓</text>
        <text x="310" y="245" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">③ 중장기</text>
        <text x="310" y="258" textAnchor="middle" fontSize="9" fill="#9aa0a6">IT↓ · 매력도↑</text>
        {/* Axis labels */}
        <text x="220" y="285" textAnchor="middle" fontSize="11" fill="#3a4048">매력도 →</text>
        <text x="20" y="140" textAnchor="middle" fontSize="11" fill="#3a4048" transform="rotate(-90 20 140)">IT 유사도 →</text>
        {/* Points */}
        {points.map((p) => {
          const cx = px(p.attractiveness)
          const cy = py(p.it_similarity)
          if (p.is_baseline) {
            return (
              <g key={p.country}>
                <circle cx={cx} cy={cy} r="9" fill="#FFFFFF" stroke="#2f6be0" strokeWidth="2.5" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fill="#2f6be0" fontWeight="bold">★</text>
                <text x={cx + 12} y={cy + 4} fontSize="11" fill="#2f6be0" fontWeight="600">{p.country} (B)</text>
              </g>
            )
          }
          return (
            <g key={p.country}>
              <circle cx={cx} cy={cy} r="7" fill="#c0533f" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x={cx + 12} y={cy + 4} fontSize="11" fill="#14181C" fontWeight="600">{p.country}</text>
            </g>
          )
        })}
      </svg>

      <div className="mt-md p-sm bg-surface-light border border-surface-border rounded-md">
        <div className="grid grid-cols-2 gap-xs text-label-sm">
          <div className="flex items-start gap-xs">
            <span className="font-bold" style={{ color: '#4f8a6d' }}>①</span>
            <span>퀵윈 최적 — 즉시 진출 1순위</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">②</span>
            <span>단기 진출 — 시스템 빠르나 시장 작음(거점·실험)</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">③</span>
            <span>중장기 — 시장은 매력, 시스템 새로 짜야</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">④</span>
            <span>후순위/보류 — 둘 다 약함</span>
          </div>
        </div>
        <div className="mt-sm pt-xs border-t border-surface-border flex items-center gap-md text-label-sm text-text-secondary flex-wrap">
          <span className="flex items-center gap-xs">
            <span className="inline-block w-3 h-3 rounded-full border border-white" style={{ background: '#c0533f' }} />
            <span>후보국</span>
          </span>
          <span className="flex items-center gap-xs">
            <span
              className="inline-block w-3 h-3 rounded-full bg-white border-2"
              style={{ borderColor: '#2f6be0', fontSize: '8px', lineHeight: '8px', textAlign: 'center', color: '#2f6be0' }}
            >
              ★
            </span>
            <span>기준국 (비교용)</span>
          </span>
          <span className="flex items-center gap-xs">
            <span className="inline-block w-2 h-2 rounded-full opacity-60" style={{ background: '#9aa0a6' }} />
            <span>킬스위치 탈락 (제외)</span>
          </span>
        </div>
      </div>
    </>
  )
}
