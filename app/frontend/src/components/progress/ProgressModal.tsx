// ProgressModal(C9/PS2, FR-7.1) — AISea PS2: 전체 진행(굵은 바) + 단계별 바 + 보고서 열기.
// 잡 폴링/단계 매핑 로직은 useJobPolling·mapStepToBars로 불변. 표현만 AISea.
import type { JobKind } from '../../api/types'
import { useJobPolling } from '../../hooks/useJobPolling'
import { mapStepToBars, overallPercent } from '../../utils/progress'

interface Props {
  jobId: string
  kind: JobKind
  title?: string
  onMinimize?: () => void
  onViewReport?: (reportId: string) => void
}

export function ProgressModal({ jobId, kind, title, onMinimize, onViewReport }: Props) {
  const { step, percent, status, result } = useJobPolling(jobId)
  const bars = step ? mapStepToBars(kind, step, percent) : []
  const total = overallPercent(percent)
  const reportId =
    result && 'report_id' in result ? (result as { report_id: string }).report_id : null
  const done = status === 'succeeded'

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-md border-b border-surface-border px-lg py-md">
        <div className="flex-1">
          <div className="font-label-md text-label-md font-semibold tracking-[0.08em] text-primary">
            GENERATING REPORT
          </div>
          <div className="mt-[3px] font-headline-md text-[18px] font-bold">{title ?? '보고서 생성'}</div>
        </div>
        {onMinimize && (
          <button
            onClick={onMinimize}
            aria-label="최소화"
            title="최소화"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            ▢
          </button>
        )}
      </div>

      <div className="px-lg py-md">
        {/* 전체 진행 */}
        <div className="mb-xs flex items-end justify-between">
          <span className="font-body-sm text-body-sm text-on-surface-variant">전체 진행률</span>
          <span className="mono text-[30px] font-bold leading-none text-primary">{total}%</span>
        </div>
        <div className="mb-lg h-[10px] overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-inverse-primary transition-all duration-300"
            style={{ width: `${total}%` }}
          />
        </div>

        {/* 단계별 바 */}
        <div className="flex flex-col gap-md">
          {bars.map((b) => {
            const barDone = b.state === 'done'
            return (
              <div key={b.key}>
                <div className="mb-xs flex items-center justify-between">
                  <span className="flex items-center gap-sm font-body-sm text-[13px]">
                    <span className={barDone ? 'text-success' : 'text-outline'}>
                      {barDone ? '✓' : b.state === 'active' ? '◷' : '○'}
                    </span>
                    {b.label}
                  </span>
                  <span className="mono font-label-md text-[12px] text-outline">{b.percent}%</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-surface-container">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barDone ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* 완료 시 보고서 열기 */}
        {done && reportId && onViewReport && (
          <button
            onClick={() => onViewReport(reportId)}
            className="mt-lg w-full rounded-[12px] bg-primary py-md text-center font-body-md text-[14px] font-bold text-on-primary shadow-[0_6px_18px_rgba(63,108,180,0.32)] transition-colors hover:bg-inverse-primary"
          >
            보고서 열기 →
          </button>
        )}
        {status === 'failed' && (
          <p className="mt-md font-body-sm text-body-sm text-on-error-container">
            진행 중 오류가 발생했습니다.
          </p>
        )}
      </div>
    </div>
  )
}
