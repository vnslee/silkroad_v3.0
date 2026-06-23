// ExpandableSearch — 평소엔 원형 검색 아이콘, 클릭/포커스 시 입력창으로 펼쳐지는
// 검색 박스. MicroExpander와 동일한 spring 확장 모션(motion/react)을 공유하되,
// 펼친 상태에 native <input>을 담아 실제 검색을 받는다. 아이콘은 Material Symbols.
import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils'
import { Icon } from '../common/Icon'

interface ExpandableSearchProps {
  value: string
  onChange: (value: string) => void
  /** Enter 또는 제출 시. */
  onSubmit: () => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

export function ExpandableSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel = 'Search',
  className,
}: ExpandableSearchProps) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rootRef = React.useRef<HTMLFormElement>(null)

  // 펼쳐지면 입력창에 포커스.
  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // 바깥 클릭 시 접기(단, 입력값이 있으면 유지).
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node) && !value.trim()) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, value])

  return (
    <motion.form
      ref={rootRef}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className={cn(
        'relative flex h-[38px] items-center overflow-hidden rounded-full',
        'border border-surface-border bg-surface-container-lowest',
        'focus-within:border-primary',
        className,
      )}
      initial={false}
      animate={{ width: open ? 232 : 38 }}
      transition={{ type: 'spring', stiffness: 150, damping: 20, mass: 0.8 }}
    >
      {/* 검색 아이콘 = 토글 버튼(접힘 시) / 제출 버튼(펼침 시) */}
      <button
        type={open ? 'submit' : 'button'}
        onClick={() => {
          if (!open) setOpen(true)
        }}
        aria-label={ariaLabel}
        className="grid h-[38px] w-[38px] shrink-0 place-items-center text-outline transition-colors hover:text-primary"
      >
        <Icon name="search" className="text-[20px]" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="field"
            className="flex min-w-0 flex-1 items-center pr-xs"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.1, duration: 0.24, ease: 'easeOut' } }}
            exit={{ opacity: 0, x: -4, transition: { duration: 0.1 } }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !value.trim()) setOpen(false)
              }}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="w-full bg-transparent font-body-sm text-[13px] text-on-surface outline-none placeholder:text-outline"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                aria-label="clear"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  )
}
