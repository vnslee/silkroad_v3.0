// ProgressPanel(C9, FR-7.2·§5.3) — AISea 우상단 진행 카드(스피너/✓ · 진행 바 · 액션).
// 상세보기 → ProgressModal(PS2) 정중앙. 진행 없으면 미렌더. 잡 폴링 로직은 ProgressModal/훅이 담당.
// 패널 전체 숨김/보임 토글 제공 — 숨겨도 Card를 CSS hidden으로 마운트 유지해 폴링이 계속 돈다.
import { useState } from 'react'
import { useStore, store, type JobRef } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { overallPercent } from '../../utils/progress'
import { ProgressModal } from './ProgressModal'

export function ProgressPanel() {
  const jobs = useStore((s) => s.activeJobs)
  const [openJobId, setOpenJobId] = useState<string | null>(null)
  // 패널 전체 숨김/보임 — 카드 상세보기(모달)와는 별개의 패널 레벨 토글.
  const [hidden, setHidden] = useState(false)

  if (jobs.length === 0) return null

  const openJob = jobs.find((j) => j.jobId === openJobId)

  // 보고서로 이동(잡 정리 + 모달 닫기 + 해시 이동). Card 완료 시·모달 '보고서 열기' 공용.
  const openReport = (job: (typeof jobs)[number], reportId: string) => {
    store.removeJob(job.jobId)
    setOpenJobId(null)
    window.location.hash = `#/${job.domain}/${job.id}/report/${reportId}?mode=popup`
  }

  return (
    <>
      {/* 우상단 카드 — PS2(모달) 비활성 시. */}
      {!openJob &&
        (hidden ? (
          // 숨김 상태: 최신 잡 상태가 반영된 작은 플로팅 버튼(완료 시 ✓) + 화면에서 감춘 Card(폴링 유지).
          <>
            <HiddenPill jobCount={jobs.length} onShow={() => setHidden(false)} />
            {/* 폴링 유지를 위해 마운트만 하고 화면에서는 감춘다 */}
            <div className="hidden">
              <Card onOpen={(id) => setOpenJobId(id)} onHide={() => setHidden(true)} onViewReport={openReport} />
            </div>
          </>
        ) : (
          <Card onOpen={(id) => setOpenJobId(id)} onHide={() => setHidden(true)} onViewReport={openReport} />
        ))}

      {/* PS2 모달 — 정중앙 */}
      {openJob && (
        <div className="fixed inset-0 z-popup flex items-center justify-center bg-[rgba(20,23,28,0.34)] p-md backdrop-blur-[1.5px]">
          <div className="relative w-full max-w-[560px] animate-aisea-op overflow-hidden rounded-[18px] bg-surface-container-lowest shadow-[0_24px_70px_rgba(20,23,28,0.3)]">
            <ProgressModal
              jobId={openJob.jobId}
              kind={openJob.kind}
              title={openJob.label}
              onMinimize={() => setOpenJobId(null)}
              onViewReport={(reportId) => openReport(openJob, reportId)}
            />
          </div>
        </div>
      )}
    </>
  )
}

// 숨김 상태 플로팅 알약 — 최신 잡 상태를 폴링해 진행 중이면 스피너, 완료/실패면 ✓/! 로 표시.
function HiddenPill({ jobCount, onShow }: { jobCount: number; onShow: () => void }) {
  const jobs = useStore((s) => s.activeJobs)
  const job = jobs[jobs.length - 1]
  const { status } = useJobPolling(job?.jobId ?? null)
  const done = status === 'succeeded'
  const failed = status === 'failed'

  return (
    <button
      onClick={onShow}
      aria-label={`진행 패널 보이기 (${jobCount}건)`}
      className="animate-aisea-slide fixed right-lg top-[72px] z-toast flex items-center gap-xs rounded-full border border-surface-border bg-surface-container-lowest px-md py-sm shadow-[0_12px_36px_rgba(20,23,28,0.14)] transition-colors hover:bg-surface-container"
    >
      {done ? (
        <span className="flex h-[16px] w-[16px] flex-none items-center justify-center rounded-full bg-success text-[10px] text-on-primary">
          ✓
        </span>
      ) : failed ? (
        <span className="flex h-[16px] w-[16px] flex-none items-center justify-center rounded-full bg-error text-[10px] text-on-primary">
          !
        </span>
      ) : (
        <span className="h-[16px] w-[16px] flex-none animate-aisea-spin rounded-full border-[2.5px] border-surface-border border-t-primary" />
      )}
      <span className="font-body-sm text-[13px] font-bold">
        {done ? '생성 완료' : failed ? '오류 발생' : '진행 상황'}
      </span>
      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
        {jobCount}
      </span>
    </button>
  )
}

// 진행 카드 — 첫(최신) 잡의 진행률을 폴링해 표시. 여러 잡이면 '외 N건' 표기.
function Card({
  onOpen,
  onHide,
  onViewReport,
}: {
  onOpen: (jobId: string) => void
  onHide: () => void
  onViewReport: (job: JobRef, reportId: string) => void
}) {
  const jobs = useStore((s) => s.activeJobs)
  const job = jobs[jobs.length - 1]
  const { percent, status, result } = useJobPolling(job?.jobId ?? null)
  const pct = overallPercent(percent)
  const done = status === 'succeeded'
  const failed = status === 'failed'
  const extra = jobs.length - 1
  // 완료된 보고서 잡이면 result에서 report_id 추출 — 카드에서 바로 보고서로 이동(중간 모달 생략).
  const reportId =
    result && 'report_id' in result ? (result as { report_id: string }).report_id : null
  const canOpenReport = done && job?.kind === 'report' && !!reportId

  if (!job) return null

  return (
    <div className="fixed right-lg top-[72px] z-toast w-[288px] animate-aisea-slide rounded-[15px] border border-surface-border bg-surface-container-lowest p-md shadow-[0_12px_36px_rgba(20,23,28,0.14)]">
      <div className="mb-md flex items-center gap-sm">
        {done ? (
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-success text-[12px] text-on-primary">
            ✓
          </span>
        ) : failed ? (
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-error text-[12px] text-on-primary">
            !
          </span>
        ) : (
          <span className="h-[18px] w-[18px] flex-none animate-aisea-spin rounded-full border-[2.5px] border-surface-border border-t-primary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-body-sm text-[13.5px] font-bold">
            {job.label}
            {extra > 0 && <span className="text-outline"> 외 {extra}건</span>}
          </div>
          <div className={`font-label-sm text-label-sm ${failed ? 'text-on-error-container' : 'text-outline'}`}>
            {failed ? '오류 발생' : done ? '생성 완료' : '보고서 생성 중…'}
          </div>
        </div>
        {/* 패널 숨기기 */}
        <button
          onClick={onHide}
          aria-label="진행 패널 숨기기"
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <span className="text-[15px] leading-none">–</span>
        </button>
        {/* 토스트 닫기 — 잡 제거(완료/실패 후 정리). */}
        <button
          onClick={() => store.removeJob(job.jobId)}
          aria-label="진행 패널 닫기"
          className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <span className="text-[15px] leading-none">×</span>
        </button>
      </div>
      <div className="mb-md flex items-center gap-sm">
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              failed ? 'bg-error' : done ? 'bg-success' : 'bg-primary'
            }`}
            style={{ width: `${failed ? 100 : pct}%` }}
          />
        </div>
        <span className={`mono text-[13px] font-bold ${done ? 'text-success' : failed ? 'text-on-error-container' : 'text-primary'}`}>
          {pct}%
        </span>
      </div>
      <button
        onClick={() => (canOpenReport ? onViewReport(job, reportId!) : onOpen(job.jobId))}
        className={`w-full rounded-[10px] py-sm text-center font-body-sm text-[13px] font-semibold transition-opacity hover:opacity-90 ${
          done ? 'bg-success text-on-primary' : 'bg-primary-fixed text-primary'
        }`}
      >
        {canOpenReport ? '보고서 열기 →' : done ? '결과 보기 →' : '상세 보기'}
      </button>
    </div>
  )
}
