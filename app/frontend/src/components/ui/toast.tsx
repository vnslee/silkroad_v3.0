// Toast(C·공용) — 우하단 스택 토스트. 외부 store + portal로 어디서든 호출 가능.
// 출처 참고: shugar/toast(shadcn) 패턴(스택 transform·hover 펼침·자동 닫힘)을 차용하되,
// 프로젝트 Tailwind v3 + Kinetic Enterprise 팔레트에 맞춰 적응(색·토큰 교체, button-1/spinner-1 의존 제거).
import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import clsx from 'clsx'
import { Icon } from '../common/Icon'

type ToastType = 'message' | 'success' | 'warning' | 'error'

interface Toast {
  id: number
  text: string | ReactNode
  type: ToastType
  measuredHeight?: number
  timeout?: ReturnType<typeof setTimeout>
  remaining?: number
  start?: number
  pause?: () => void
  resume?: () => void
}

let root: ReturnType<typeof createRoot> | null = null
let toastId = 0
const AUTO_MS = 3000

const toastStore = {
  toasts: [] as Toast[],
  listeners: new Set<() => void>(),

  add(text: string | ReactNode, type: ToastType) {
    const id = toastId++
    const toast: Toast = { id, text, type }

    toast.remaining = AUTO_MS
    toast.start = Date.now()
    const close = () => {
      this.toasts = this.toasts.filter((t) => t.id !== id)
      this.notify()
    }
    toast.timeout = setTimeout(close, toast.remaining)
    toast.pause = () => {
      if (!toast.timeout) return
      clearTimeout(toast.timeout)
      toast.timeout = undefined
      toast.remaining! -= Date.now() - toast.start!
    }
    toast.resume = () => {
      if (toast.timeout) return
      toast.start = Date.now()
      toast.timeout = setTimeout(close, toast.remaining)
    }

    this.toasts.push(toast)
    this.notify()
  },

  remove(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  },

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  },

  notify() {
    this.listeners.forEach((fn) => fn())
  },
}

// 타입별 색 — Kinetic 팔레트 시맨틱 토큰만 사용(임의 신규 팔레트 금지).
const TYPE_STYLE: Record<ToastType, string> = {
  message: 'bg-inverse-surface text-inverse-on-surface',
  success: 'bg-accent text-on-accent',
  warning: 'bg-inverse-surface text-inverse-on-surface',
  error: 'bg-error text-on-error',
}
const TYPE_ICON: Record<ToastType, string | null> = {
  message: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [shownIds, setShownIds] = useState<number[]>([])
  const [isHovered, setIsHovered] = useState(false)

  const measureRef = (toast: Toast) => (node: HTMLDivElement | null) => {
    if (node && toast.measuredHeight == null) {
      toast.measuredHeight = node.getBoundingClientRect().height
      toastStore.notify()
    }
  }

  useEffect(() => {
    setToasts([...toastStore.toasts])
    return toastStore.subscribe(() => setToasts([...toastStore.toasts]))
  }, [])

  useEffect(() => {
    const unseen = toasts.filter((t) => !shownIds.includes(t.id)).map((t) => t.id)
    if (unseen.length > 0) {
      requestAnimationFrame(() => setShownIds((prev) => [...prev, ...unseen]))
    }
    // shownIds 의존 제외 의도(새 토스트 등장 시 1회 진입 애니메이션만 트리거).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts])

  const lastVisibleCount = 3
  const lastVisibleStart = Math.max(0, toasts.length - lastVisibleCount)

  // 뒤로 쌓이는 카드 — hover 시 펼치고(실제 높이만큼), 평소엔 살짝 겹쳐(20px·축소) 보이게.
  const getFinalTransform = (index: number, length: number) => {
    if (index === length - 1) return 'none'
    const offset = length - 1 - index
    let translateY = toasts[length - 1]?.measuredHeight || 56
    for (let i = length - 1; i > index; i--) {
      translateY += isHovered ? (toasts[i - 1]?.measuredHeight || 56) + 10 : 20
    }
    const scale = isHovered ? 1 : 1 - 0.05 * offset
    return `translate3d(0, calc(100% - ${translateY}px), ${-offset}px) scale(${scale})`
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
    toastStore.toasts.forEach((t) => t.pause?.())
  }
  const handleMouseLeave = () => {
    setIsHovered(false)
    toastStore.toasts.forEach((t) => t.resume?.())
  }

  const visibleToasts = toasts.slice(lastVisibleStart)
  const containerHeight = visibleToasts.reduce((acc, t) => acc + (t.measuredHeight ?? 56), 0)

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-toast w-[380px]"
      style={{ height: containerHeight }}
    >
      <div
        className="pointer-events-auto relative w-full"
        style={{ height: containerHeight }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {toasts.map((toast, index) => {
          const isVisible = index >= lastVisibleStart
          const iconName = TYPE_ICON[toast.type]
          return (
            <div
              key={toast.id}
              ref={measureRef(toast)}
              className={clsx(
                'absolute bottom-0 right-0 h-fit w-[380px] rounded-xl p-md leading-[21px] shadow-[0_8px_28px_rgba(20,23,28,0.18)]',
                TYPE_STYLE[toast.type],
                isVisible ? 'opacity-100' : 'opacity-0',
                index < lastVisibleStart && 'pointer-events-none',
              )}
              style={{
                transition: 'all .35s cubic-bezier(.25,.75,.6,.98)',
                transform: shownIds.includes(toast.id)
                  ? getFinalTransform(index, toasts.length)
                  : 'translate3d(0, 100%, 150px) scale(1)',
              }}
            >
              <div className="flex items-center justify-between gap-md text-[0.9375rem]">
                <span className="flex items-center gap-sm">
                  {iconName && <Icon name={iconName} className="text-[20px]" />}
                  <span className="font-body-md">{toast.text}</span>
                </span>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => toastStore.remove(toast.id)}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md transition-opacity hover:opacity-70"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function mountContainer() {
  if (root) return
  const el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  root.render(<ToastContainer />)
}

// 어디서든 import해 호출 — 훅 불필요(컴포넌트 밖에서도 사용 가능).
export const toast = {
  message: (text: string | ReactNode) => {
    mountContainer()
    toastStore.add(text, 'message')
  },
  success: (text: string | ReactNode) => {
    mountContainer()
    toastStore.add(text, 'success')
  },
  warning: (text: string | ReactNode) => {
    mountContainer()
    toastStore.add(text, 'warning')
  },
  error: (text: string | ReactNode) => {
    mountContainer()
    toastStore.add(text, 'error')
  },
}
