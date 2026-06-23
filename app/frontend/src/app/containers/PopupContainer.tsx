// 팝업 모드 컨테이너(§5.1) — AISea 통합 모달 프레임(스크림 + inset 카드 + 상단 스트립).
// 화면 컴포넌트는 모드 무지(Q2=A); 컨테이너만 사이즈/노출/외곽 크롬 결정.
// 고정 높이를 줘서 자식의 h-full(iframe·flex)이 0으로 접히지 않게 한다. Esc·포커스 트랩(AR-3).
import { useEffect, useRef } from 'react'

interface Props {
  onClose: () => void
  /** 상단 스트립 태그 배지(예: '국가 정보'). */
  tag?: string
  /** 태그 배지 배경색 클래스(기본 bg-primary). */
  tagClass?: string
  title?: string
  children: React.ReactNode
}

export function PopupContainer({ onClose, tag, tagClass = 'bg-primary', title, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-popup animate-aisea-pop bg-[rgba(20,23,28,0.34)] backdrop-blur-[1.5px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      {/* 콘텐츠 — AISea inset 카드(6% 7%), 바깥 클릭 닫힘 방지(stopPropagation) */}
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-[6%_7%] flex flex-col overflow-hidden rounded-[20px] bg-surface-container-lowest shadow-[0_30px_90px_rgba(20,23,28,0.34)]"
      >
        {/* 상단 스트립 — 태그 배지 · 타이틀 · 닫기 */}
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-surface-border bg-surface-container-lowest px-lg">
          <div className="flex min-w-0 items-center gap-md">
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
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-container"
            >
              <span className="text-[17px] leading-none">✕</span>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-surface-light">{children}</div>
      </div>
    </div>
  )
}
