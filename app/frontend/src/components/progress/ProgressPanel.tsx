// ProgressPanel(C9, FR-7.2·§5.3) — AISea 우상단 진행 카드(스피너/✓ · 진행 바 · 액션).
// 상세보기 → ProgressModal(PS2) 정중앙. 진행 없으면 미렌더. 잡 폴링 로직은 ProgressModal/훅이 담당.
import { useState } from 'react'
import { useStore, store } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { overallPercent } from '../../utils/progress'
import { ProgressModal } from './ProgressModal'

export function ProgressPanel() {
  const jobs = useStore((s) => s.activeJobs)
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  if (jobs.length === 0) return null

  const openJob = jobs.find((j) => j.jobId === openJobId)

  return (
    <>
      {/* 우상단 카드 — PS2(모달) 비활성 시. 잡이 여럿이면 첫 잡 카드 + 외 N건. */}
      {!openJob && <Card onOpen={(id) => setOpenJobId(id)} />}

      {/* PS2 모달 — 정중앙 */}
      {openJob && (
        <div className="fixed inset-0 z-popup flex items-center justify-center bg-[rgba(20,23,28,0.34)] p-md backdrop-blur-[1.5px]">
          <div className="relative w-full max-w-[560px] animate-aisea-op overflow-hidden rounded-[18px] bg-surface-container-lowest shadow-[0_24px_70px_rgba(20,23,28,0.3)]">
            <ProgressModal
              jobId={openJob.jobId}
              kind={openJob.kind}
              title={openJob.label}
              onMinimize={() => setOpenJobId(null)}
              onViewReport={(reportId) => {
                store.removeJob(openJob.jobId)
                setOpenJobId(null)
                window.location.hash = `#/${openJob.domain}/${openJob.id}/report/${reportId}?mode=popup`
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

// 진행 카드 — 첫(최신) 잡의 진행률을 폴링해 표시.
function Card({ onOpen }: { onOpen: (jobId: string) => void }) {
  const jobs = useStore((s) => s.activeJobs)
  const job = jobs[jobs.length - 1]
  const { percent, status } = useJobPolling(job?.jobId ?? null)
  const pct = overallPercent(percent)
  const done = status === 'succeeded'

  if (!job) return null

  return (
    <div className="fixed right-lg top-[72px] z-overlay w-[288px] animate-aisea-slide rounded-[15px] border border-surface-border bg-surface-container-lowest p-md shadow-[0_12px_36px_rgba(20,23,28,0.14)]">
      <div className="mb-md flex items-center gap-sm">
        {done ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-success text-[12px] text-on-primary">
            ✓
          </span>
        ) : (
          <span className="h-[18px] w-[18px] animate-aisea-spin rounded-full border-[2.5px] border-surface-border border-t-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-body-sm text-[13.5px] font-bold">{job.label}</div>
          <div className="font-label-sm text-label-sm text-outline">
            {done ? '생성 완료' : '보고서 생성 중…'}
          </div>
        </div>
      </div>
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
        onClick={() => onOpen(job.jobId)}
        className={`w-full rounded-[10px] py-sm text-center font-body-sm text-[13px] font-semibold transition-opacity hover:opacity-90 ${
          done ? 'bg-success text-on-primary' : 'bg-primary-fixed text-primary'
        }`}
      >
        {done ? '보고서 열기 →' : '상세 보기'}
      </button>
    </div>
  )
}
