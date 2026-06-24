// ExpandableSearch — 평소엔 원형 검색 아이콘, 클릭/포커스 시 입력창으로 펼쳐지는
// 검색 박스. MicroExpander와 동일한 spring 확장 모션(motion/react)을 공유하되,
// 펼친 상태에 native <input>을 담아 실제 검색을 받는다. 아이콘은 Material Symbols.
import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils'
import { Icon } from '../common/Icon'

/** 자동완성 후보 1건. */
export interface SearchSuggestion {
  /** 안정 식별자(국가 코드 등). */
  id: string
  /** 주 라벨(예: 한글 국가명). */
  label: string
  /** 보조 라벨(예: 영문명·코드). */
  sub?: string
  /** 좌측 표식(예: 국기 이모지). */
  prefix?: string
}

interface ExpandableSearchProps {
  value: string
  onChange: (value: string) => void
  /** Enter 또는 제출 시(후보 미선택 시 폴백). */
  onSubmit: () => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  /** 현재 입력에 대한 자동완성 후보(상위에서 필터링해 전달). 비우면 드롭다운 미표시. */
  suggestions?: SearchSuggestion[]
  /** 후보 선택(클릭 또는 ↑↓+Enter) 시. */
  onSelectSuggestion?: (s: SearchSuggestion) => void
}

export function ExpandableSearch({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel = 'Search',
  className,
  suggestions = [],
  onSelectSuggestion,
}: ExpandableSearchProps) {
  const [open, setOpen] = React.useState(false)
  // 키보드 하이라이트 인덱스(-1 = 미선택).
  const [activeIdx, setActiveIdx] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const rootRef = React.useRef<HTMLFormElement>(null)

  const showList = open && value.trim().length > 0 && suggestions.length > 0

  // 펼쳐지면 입력창에 포커스.
  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // 후보 목록이 바뀌면 하이라이트 초기화.
  React.useEffect(() => {
    setActiveIdx(-1)
  }, [value])

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

  // 후보 선택 처리(공통).
  const pick = (s: SearchSuggestion) => {
    onSelectSuggestion?.(s)
    setActiveIdx(-1)
  }

  return (
    <motion.form
      ref={rootRef}
      onSubmit={(e) => {
        e.preventDefault()
        // 하이라이트된 후보가 있으면 그걸 선택, 없으면 폴백(onSubmit).
        if (showList && activeIdx >= 0 && suggestions[activeIdx]) pick(suggestions[activeIdx])
        else onSubmit()
      }}
      // 마우스 오버 시 펼침, 떼면 접힘 — 단 입력값이 있거나 입력창 포커스 중이면 유지.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        // 입력값이 없으면 접는다 — 자동 포커스가 걸려 있어도 blur 후 닫음(타이핑 중이면 마우스를 올려둔 상태이므로 유지됨).
        if (!value.trim()) {
          inputRef.current?.blur()
          setOpen(false)
        }
      }}
      className={cn(
        'relative flex h-[38px] items-center rounded-full',
        'border border-surface-border bg-surface-container-lowest',
        'focus-within:border-primary',
        // 드롭다운이 보일 때만 overflow 허용(접힘 모션 중엔 잘림 유지).
        showList ? 'overflow-visible' : 'overflow-hidden',
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
                if (e.key === 'Escape') {
                  if (value.trim()) onChange('')
                  else setOpen(false)
                  setActiveIdx(-1)
                } else if (showList && e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveIdx((i) => (i + 1) % suggestions.length)
                } else if (showList && e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
                }
              }}
              role="combobox"
              aria-expanded={showList}
              aria-controls="country-search-listbox"
              aria-autocomplete="list"
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

      {/* 자동완성 드롭다운 — 입력값+후보가 있을 때만. 폼 하단에 앵커. */}
      {showList && (
        <ul
          id="country-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-popup max-h-[300px] overflow-y-auto rounded-[14px] border border-surface-border bg-surface-container-lowest p-1 shadow-[0_16px_44px_rgba(20,23,28,0.16)]"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIdx
            return (
              <li key={s.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  // onMouseDown으로 처리 — input blur로 드롭다운이 닫히기 전에 선택되도록.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(s)
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    'flex w-full items-center gap-sm rounded-[10px] px-md py-sm text-left transition-colors',
                    active ? 'bg-primary/10' : 'hover:bg-surface-container',
                  )}
                >
                  {s.prefix && <span className="shrink-0 text-[16px] leading-none">{s.prefix}</span>}
                  <span className="min-w-0 flex-1 truncate font-body-sm text-[13px] text-on-surface">{s.label}</span>
                  {s.sub && <span className="shrink-0 font-label-sm text-label-sm text-outline">{s.sub}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </motion.form>
  )
}
