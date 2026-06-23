// 헤더용 드롭다운 — 대상(국가/권역) 교체·버전 선택 공용. mockup 헤더 톤에 맞춘 인라인 선택.
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export interface SelectOption {
  value: string
  label: string
  sub?: string
}

interface Props {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  /** 트리거에 표시할 커스텀 노드(국가명 등). 없으면 현재 선택 label. */
  trigger?: React.ReactNode
  ariaLabel: string
  align?: 'left' | 'right'
}

export function HeaderSelect({ options, value, onChange, trigger, ariaLabel, align = 'left' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-xs rounded-lg px-xs py-0.5 text-left transition-colors hover:bg-surface-variant"
      >
        {trigger ?? <span className="font-body-md">{current?.label ?? value}</span>}
        <Icon name="expand_more" className="text-[18px] text-on-surface-variant" />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute top-full z-chrome mt-xs max-h-72 w-56 overflow-auto rounded-lg border border-surface-border bg-surface-container-lowest py-xs shadow-[0_4px_12px_rgba(0,32,78,0.12)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                className={`flex w-full flex-col px-md py-sm text-left transition-colors hover:bg-surface-variant ${
                  o.value === value ? 'bg-surface-container' : ''
                }`}
                onClick={() => {
                  setOpen(false)
                  if (o.value !== value) onChange(o.value)
                }}
              >
                <span className="font-body-md text-on-surface">{o.label}</span>
                {o.sub && <span className="font-label-sm text-label-sm text-text-secondary">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
