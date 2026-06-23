// 한/영 언어 선택 드롭다운 — TopBar의 밋밋한 '한/EN' pill을 대체.
// 드롭다운 형태(pill 트리거 + 깃발 + 체크)는 외부 레퍼런스를 채택하되,
// 색·라운드·폰트는 Kinetic Enterprise 토큰으로 적응시키고 전역 store(lang)에 연결한다.
// 이 앱은 ko/en 2개 언어만 지원하므로 항목도 2개로 한정(store Lang = 'ko' | 'en').
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { store, useStore, type Lang } from '@/store'

interface LanguageOption {
  code: Lang
  label: string
  flag: string
}

const LANGUAGES: LanguageOption[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
]

export function LanguageSelectorDropdown() {
  const lang = useStore((s) => s.lang)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Esc로 닫기 — 키보드 접근성.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative inline-block flex-none" ref={dropdownRef}>
      {/* 트리거 — Kinetic 토큰 pill. 선택 깃발 + 라벨 + 셰브론. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={lang === 'ko' ? '언어 선택: 한국어' : 'Language: English'}
        className={cn(
          'flex h-[38px] items-center gap-xs rounded-[9px] border border-surface-border px-md',
          'bg-surface-container-lowest text-[13px] font-semibold text-on-surface-variant',
          'transition-colors hover:bg-surface-container',
          open && 'bg-surface-container',
        )}
      >
        <span className="text-[13px] leading-none">{selected.flag}</span>
        <span>{selected.label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-outline transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* 메뉴 — TopBar 드롭다운과 동일한 aisea-pop 등장 + Kinetic 카드 토큰. */}
      {open && (
        <ul
          role="listbox"
          aria-label="언어 선택"
          className={cn(
            'absolute right-0 top-[calc(100%+4px)] z-popup w-32 animate-aisea-pop overflow-hidden',
            'rounded-[10px] border border-surface-border bg-surface-container-lowest p-[4px]',
            'shadow-[0_12px_32px_rgba(20,23,28,0.14)]',
          )}
        >
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    store.setLang(l.code)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-xs rounded-[7px] px-sm py-1.5 text-left',
                    'font-body-sm text-[13px] transition-colors',
                    active
                      ? 'font-semibold text-primary'
                      : 'text-text-primary hover:bg-surface-container',
                  )}
                >
                  <span className="text-[13px] leading-none">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
