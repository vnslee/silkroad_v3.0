// 풀사이즈 모드 컨테이너(§5.1) — AISea 풀 모달(inset 0 + 상단 스트립 + "← 지도로").
import { useEffect } from 'react'

interface Props {
  onBack: () => void
  /** 상단 스트립 태그 배지(예: '국가 진단 보고서'). */
  tag?: string
  tagClass?: string
  title?: string
  children: React.ReactNode
}

export function FullscreenContainer({ onBack, tag, tagClass = 'bg-primary', title, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <section className="fixed inset-0 z-overlay flex flex-col bg-surface-container-lowest" aria-label={title}>
      {/* 상단 스트립 — 지도로 · 태그 배지 · 타이틀 */}
      <div className="flex h-[58px] shrink-0 items-center border-b border-surface-border px-lg">
        <div className="flex min-w-0 items-center gap-md">
          <button
            type="button"
            onClick={onBack}
            aria-label="지도로 돌아가기"
            className="flex items-center gap-xs rounded-lg bg-surface-container px-md py-sm font-label-md text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            ← 지도로
          </button>
          {tag && (
            <span
              className={`rounded-md px-sm py-[3px] font-label-md text-label-md uppercase tracking-wide text-on-primary ${tagClass}`}
            >
              {tag}
            </span>
          )}
          {title && (
            <span className="truncate font-headline-md text-[16px] font-bold text-on-surface">
              {title}
            </span>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-light">{children}</div>
    </section>
  )
}
