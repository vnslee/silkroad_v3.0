// 룰셋 저장 성공 팝업 — 새 버전·스냅샷 파일명 안내. PopupContainer 패턴(overlay·dialog·Esc·포커스).
import { useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import type { RulesetSaveResult } from '../../api/types'
import { useT } from '../../i18n/dict'

interface Props {
  result: RulesetSaveResult
  onClose: () => void
}

export function SaveSuccessModal({ result, onClose }: Props) {
  const t = useT()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-popup flex items-center justify-center bg-on-surface/40 p-md backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ruleset-save-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-xl bg-surface-container-lowest p-xl shadow-[0_24px_48px_rgba(0,32,78,0.24)]"
      >
        <div className="mb-md flex items-center gap-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon name="check_circle" className="text-[28px]" />
          </span>
          <h2 id="ruleset-save-title" className="text-headline-sm text-on-surface">
            {t('rs.saved.title')}
          </h2>
        </div>

        <p className="mb-md text-body-md text-on-surface-variant">
          {t('rs.saved.desc')}
        </p>

        <dl className="mb-lg space-y-xs rounded-md bg-surface-container px-md py-sm text-body-sm">
          <div className="flex justify-between gap-md">
            <dt className="text-on-surface-variant">{t('rs.saved.version')}</dt>
            <dd className="font-medium text-on-surface">v{result.version}</dd>
          </div>
          <div className="flex justify-between gap-md">
            <dt className="shrink-0 text-on-surface-variant">{t('rs.saved.snapshot')}</dt>
            <dd className="truncate font-mono text-on-surface" title={result.snapshot_file}>
              {result.snapshot_file}
            </dd>
          </div>
          <div className="flex justify-between gap-md">
            <dt className="shrink-0 text-on-surface-variant">{t('rs.saved.savedAt')}</dt>
            <dd className="text-on-surface">{result.updated_at}</dd>
          </div>
        </dl>

        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded bg-primary px-lg py-sm text-on-primary"
          >
            {t('rs.saved.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
