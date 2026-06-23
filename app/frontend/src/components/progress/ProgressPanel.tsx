// ProgressPanel(C9, FR-7.2·§5.3) — AISea 우상단 진행 카드(스피너/✓ · 진행 바 · 액션).
// 상세보기 → ProgressModal(PS2) 정중앙. 진행 없으면 미렌더. 잡 폴링 로직은 ProgressModal/훅이 담당.
import { useState } from 'react'
import { useStore, store } from '../../store'
import type { JobRef } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { overallPercent } from '../../utils/progress'
import { ProgressModal } from './ProgressModal'
import { Icon } from '../common/Icon'

export function ProgressPanel() {
  const jobs = useStore((s) => s.activeJobs)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  if (jobs.length === 0) return null

  const openJob = jobs.find((j) => j.jobId === openJobId)

  // 보고서 열기 — 잡 제거 후 리포트 라우트로 이동(카드·PS2 모달 공용).
  const viewReport = (job: { jobId: string; domain: string; id: string }, reportId: string) => {
    store.removeJob(job.jobId)
    setOpenJobId(null)
    window.location.hash = `#/${job.domain}/${job.id}/report/${reportId}?mode=popup`
  }

  // 닫기(주로 실패한 잡 정리) — 잡 제거 후 모달도 닫는다. 이후 시뮬레이션 버튼 재실행 가능.
  const dismiss = (jobId: string) => {
    store.removeJob(jobId)
    setOpenJobId(null)
  }

  return (
    <>
      {/* 우상단 카드 — PS2(모달) 비활성 시. 잡이 여럿이면 첫 잡 카드 + 외 N건. */}
      {/* 완료 시 카드의 [보고서 열기]는 모달을 거치지 않고 바로 보고서로 이동(중복 모달 방지). */}
      {!openJob && (
        <Card
          onOpen={(id) => setOpenJobId(id)}
          onViewReport={(job, reportId) => viewReport(job, reportId)}
          onDismiss={dismiss}
        />
      )}

      {/* PS2 모달 — 정중앙 */}
      {openJob && (
        <div className="fixed inset-0 z-progress flex items-center justify-center bg-[rgba(20,23,28,0.34)] p-md backdrop-blur-[1.5px]">
          <div className="relative w-full max-w-[560px] animate-aisea-op overflow-hidden rounded-[18px] bg-surface-container-lowest shadow-[0_24px_70px_rgba(20,23,28,0.3)]">
            <ProgressModal
              jobId={openJob.jobId}
              kind={openJob.kind}
              title={openJob.label}
              onMinimize={() => setOpenJobId(null)}
              onViewReport={(reportId) => viewReport(openJob, reportId)}
              onDismiss={() => dismiss(openJob.jobId)}
            />
          </div>
        </div>
      )}
    </>
  )
}

// 진행 카드 — 첫(최신) 잡의 진행률을 폴링해 표시.
function Card({
  onOpen,
  onViewReport,
  onDismiss,
}: {
  onOpen: (jobId: string) => void
  onViewReport: (job: JobRef, reportId: string) => void
  onDismiss: (jobId: string) => void
}) {
  const jobs = useStore((s) => s.activeJobs)
  const job = jobs[jobs.length - 1]
  const { percent, status, result } = useJobPolling(job?.jobId ?? null)
  const pct = overallPercent(percent)
  const done = status === 'succeeded'
  const failed = status === 'failed'
  const reportId =
    result && 'report_id' in result ? (result as { report_id: string }).report_id : null

  if (!job) return null

  return (
    <div className="fixed right-lg top-[72px] z-progress w-[288px] animate-aisea-slide rounded-[15px] border border-surface-border bg-surface-container-lowest p-md shadow-[0_12px_36px_rgba(20,23,28,0.14)]">
      <div className="mb-md flex items-center gap-sm">
        {done ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-success text-[12px] text-on-primary">
            ✓
          </span>
        ) : failed ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-error-container text-on-error-container">
            <Icon name="error" filled className="text-[15px] leading-none" />
          </span>
        ) : (
          <span className="h-[18px] w-[18px] animate-aisea-spin rounded-full border-[2.5px] border-surface-border border-t-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-body-sm text-[13.5px] font-bold">{job.label}</div>
          <div className={`font-label-sm text-label-sm ${failed ? 'text-error' : 'text-outline'}`}>
            {done ? '생성 완료' : failed ? '생성 실패' : '보고서 생성 중…'}
          </div>
        </div>
        {/* 닫기 — 실패 시 카드를 정리하고 시뮬레이션 버튼을 다시 누를 수 있게 한다. */}
        {failed && (
          <button
            onClick={() => onDismiss(job.jobId)}
            aria-label="닫기"
            title="닫기"
            className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" className="text-[18px] leading-none" />
          </button>
        )}
      </div>
      {failed ? (
        <>
          <p className="mb-md font-body-sm text-[13px] text-on-surface-variant">
            보고서 생성 중 오류가 발생했습니다. 닫고 다시 시도하세요.
          </p>
          <button
            onClick={() => onDismiss(job.jobId)}
            className="w-full rounded-[10px] bg-primary-fixed py-sm text-center font-body-sm text-[13px] font-semibold text-primary transition-opacity hover:opacity-90"
          >
            닫기
          </button>
        </>
      ) : (
        <>
          <div className="mb-md flex items-center gap-sm">
            <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-surface-container">
              <div
                className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`mono text-[13px] font-bold ${done ? 'text-success' : 'text-primary'}`}>{pct}%</span>
          </div>
          <button
            onClick={() => (done && reportId ? onViewReport(job, reportId) : onOpen(job.jobId))}
            className={`w-full rounded-[10px] py-sm text-center font-body-sm text-[13px] font-semibold transition-opacity hover:opacity-90 ${
              done ? 'bg-success text-on-primary' : 'bg-primary-fixed text-primary'
            }`}
          >
            {done ? '보고서 열기 →' : '상세 보기'}
          </button>
        </>
      )}
    </div>
  )
}
