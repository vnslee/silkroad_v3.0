// 매력도 × IT 유사도 2축 산점도 — mockup 04_region_report.html SVG 구조 그대로.
// x: 매력도(0~100) → 40~400px, y: IT 유사도(0~100) → 260~20px(위가 큼).
import { useT } from '../../../i18n/dict'

export interface ScatterPoint {
  country: string
  attractiveness: number
  it_similarity: number // raw (0~100)
  is_baseline?: boolean
  is_top1?: boolean // 매력도(퀵윈) 순위 1위 — 강조 색
}

// 후보국 점 색 — 1위는 라임그린으로 강조, 나머지는 기본 코럴.
const POINT_COLOR = '#c0533f'
const TOP1_COLOR = '#4f8a6d'

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
  const t = useT()
  return (
    <>
      <svg viewBox="0 0 420 300" className="w-full" role="img" aria-label={t('rsc.aria')}>
        <rect x="40" y="20" width="360" height="240" fill="#f7f6f1" stroke="#e6e3db" />
        <rect x="220" y="20" width="180" height="120" fill="#e9f3ee" opacity="0.4" />
        <line x1="220" y1="20" x2="220" y2="260" stroke="#e6e3db" strokeDasharray="3,3" />
        <line x1="40" y1="140" x2="400" y2="140" stroke="#e6e3db" strokeDasharray="3,3" />
        {/* Quadrant labels */}
        <text x="130" y="40" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">{t('rsc.q2')}</text>
        <text x="130" y="54" textAnchor="middle" fontSize="9" fill="#9aa0a6">{t('rsc.q2sub')}</text>
        <text x="310" y="40" textAnchor="middle" fontSize="10" fill="#4f8a6d" fontWeight="700">{t('rsc.q1')}</text>
        <text x="310" y="54" textAnchor="middle" fontSize="9" fill="#4f8a6d">{t('rsc.q1sub')}</text>
        <text x="130" y="245" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">{t('rsc.q4')}</text>
        <text x="130" y="258" textAnchor="middle" fontSize="9" fill="#9aa0a6">{t('rsc.q4sub')}</text>
        <text x="310" y="245" textAnchor="middle" fontSize="10" fill="#9aa0a6" fontWeight="600">{t('rsc.q3')}</text>
        <text x="310" y="258" textAnchor="middle" fontSize="9" fill="#9aa0a6">{t('rsc.q3sub')}</text>
        {/* Axis labels */}
        <text x="220" y="285" textAnchor="middle" fontSize="11" fill="#3a4048">{t('rsc.axisX')}</text>
        <text x="20" y="140" textAnchor="middle" fontSize="11" fill="#3a4048" transform="rotate(-90 20 140)">{t('rsc.axisY')}</text>
        {/* Points — 기준국(B)은 비교용 마커를 그리지 않는다(후보국만 표시). */}
        {points
          .filter((p) => !p.is_baseline)
          .map((p) => {
            const cx = px(p.attractiveness)
            const cy = py(p.it_similarity)
            return (
              <g key={p.country}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={p.is_top1 ? 8.5 : 7}
                  fill={p.is_top1 ? TOP1_COLOR : POINT_COLOR}
                  stroke="#FFFFFF"
                  strokeWidth={p.is_top1 ? 2 : 1.5}
                />
                <text x={cx + 12} y={cy + 4} fontSize="11" fill="#14181C" fontWeight={p.is_top1 ? 700 : 600}>
                  {p.country}{p.is_top1 ? ' ★' : ''}
                </text>
              </g>
            )
          })}
      </svg>

      <div className="mt-md p-sm bg-surface-light border border-surface-border rounded-md">
        <div className="grid grid-cols-2 gap-xs text-label-sm">
          <div className="flex items-start gap-xs">
            <span className="font-bold" style={{ color: '#4f8a6d' }}>①</span>
            <span>{t('rsc.legend.q1')}</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">②</span>
            <span>{t('rsc.legend.q2')}</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">③</span>
            <span>{t('rsc.legend.q3')}</span>
          </div>
          <div className="flex items-start gap-xs">
            <span className="font-bold text-text-secondary">④</span>
            <span>{t('rsc.legend.q4')}</span>
          </div>
        </div>
        <div className="mt-sm pt-xs border-t border-surface-border flex items-center gap-md text-label-sm text-text-secondary flex-wrap">
          <span className="flex items-center gap-xs">
            <span className="inline-block w-3 h-3 rounded-full border border-white" style={{ background: TOP1_COLOR }} />
            <span>{t('rsc.legend.top1')}</span>
          </span>
          <span className="flex items-center gap-xs">
            <span className="inline-block w-3 h-3 rounded-full border border-white" style={{ background: POINT_COLOR }} />
            <span>{t('rsc.legend.candidate')}</span>
          </span>
          <span className="flex items-center gap-xs">
            <span className="inline-block w-2 h-2 rounded-full opacity-60" style={{ background: '#9aa0a6' }} />
            <span>{t('rsc.legend.excluded')}</span>
          </span>
        </div>
      </div>
    </>
  )
}
