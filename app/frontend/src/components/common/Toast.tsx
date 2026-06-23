// Toast — 일시적 전역 안내(예: 데이터 없는 권역 클릭). store.toast 단일 슬롯을 구독해
// 화면 하단 중앙에 프로스티드 pill로 표시하고, 일정 시간 뒤 자동으로 닫힌다.
// AISea 맵 배너 칩과 동일한 흰 프로스티드 카드 언어를 따르되, 좌측 아이콘 배지로 톤을 구분한다.
// 모션은 prefers-reduced-motion을 존중(애니메이션 비활성 시 즉시 표시/제거).
import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { store, useStore, type ToastTone } from '../../store'
import { Icon } from './Icon'

const DURATION_MS = 3200 // 자동 닫힘 시간

// 톤별 아이콘 배지 스타일 — Kinetic Enterprise 시맨틱 토큰만 사용.
const TONE: Record<ToastTone, { icon: string; badge: string }> = {
  info: { icon: 'info', badge: 'bg-secondary-fixed text-on-secondary-fixed-variant' },
  error: { icon: 'error', badge: 'bg-error-container text-on-error-container' },
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  const reduce = useReducedMotion()

  // 토스트가 바뀔 때마다 자동 닫힘 타이머 재설정(언마운트/교체 시 정리).
  useEffect(() => {
    if (!toast) return
    const id = toast.id
    const timer = window.setTimeout(() => store.dismissToast(id), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const tone = toast ? TONE[toast.tone] : TONE.info

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-xl z-toast flex justify-center px-lg"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.7 }}
            className="pointer-events-auto flex max-w-[min(92vw,440px)] items-center gap-sm rounded-full border border-surface-border bg-[rgba(255,255,255,0.92)] py-2 pl-2 pr-md shadow-[0_10px_34px_rgba(20,23,28,0.16)] backdrop-blur-[10px]"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${tone.badge}`}
              aria-hidden
            >
              <Icon name={tone.icon} filled className="text-[18px] leading-none" />
            </span>
            <span className="font-body-md text-body-md font-medium text-on-surface">
              {toast.message}
            </span>
            <button
              onClick={() => store.dismissToast(toast.id)}
              aria-label="닫기"
              className="ml-xs grid h-7 w-7 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="close" className="text-[18px] leading-none" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
