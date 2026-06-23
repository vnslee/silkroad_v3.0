// ReportPickerModal(C7 보조, Q5=B) — 보고서 다건 시 목록에서 사용자 선택.
import type { ReportRef } from '../../api/types'

interface Props {
  reports: ReportRef[]
  onPick: (reportId: string) => void
  onClose: () => void
}

export function ReportPickerModal({ reports, onPick, onClose }: Props) {
  return (
    <div className="p-lg">
      <h3 className="mb-md text-headline-md text-on-surface">보고서 선택</h3>
      {reports.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">생성된 보고서가 없습니다.</p>
      ) : (
        <ul className="space-y-sm">
          {reports.map((r) => (
            <li key={r.report_id}>
              <button
                className="flex w-full items-center justify-between rounded border border-surface-border px-md py-sm text-left hover:bg-surface-container"
                onClick={() => onPick(r.report_id)}
              >
                <span className="text-body-md">{r.title ?? r.report_id}</span>
                <span className="text-body-sm text-on-surface-variant">{r.generated_at ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="mt-md text-body-sm text-secondary hover:underline" onClick={onClose}>
        닫기
      </button>
    </div>
  )
}
