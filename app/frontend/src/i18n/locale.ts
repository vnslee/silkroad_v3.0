// 보고서·상세 콘텐츠 언어 선택 헬퍼(C12) — store(lang) 기반.
// UI 라벨 사전은 dict.ts(useT), 여기는 백엔드 JSON의 ko/en 데이터 필드 선택을 담당한다.
// 정책: en이 비어있거나 없으면 한국어로 조용히 폴백(사용자 확정).
import { createContext, useContext } from 'react'
import { useStore } from '../store'
import type { Lang } from '../store'

/** ko/en 두 값 중 lang에 맞는 것을 고른다. en이 비면 ko 폴백. */
export function pickLang<T>(lang: Lang, ko: T, en: T | null | undefined): T {
  if (lang === 'en' && en !== null && en !== undefined && en !== '') return en
  return ko
}

/**
 * {ko,en} dict 또는 문자열을 lang에 맞춰 텍스트로 변환(React child로 객체 렌더 방지).
 * - 문자열: 그대로
 * - {ko,en}: lang 우선, 비면 반대 언어 폴백
 * - 그 외: String() 안전 변환
 */
export function locText(value: unknown, lang: Lang = 'ko'): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const ko = typeof o.ko === 'string' ? o.ko : ''
    const en = typeof o.en === 'string' ? o.en : ''
    if (lang === 'en') return en || ko
    return ko || en
  }
  return String(value)
}

// ── LangContext — 보고서/상세 트리 전체에 lang을 공급(prop-drilling 회피) ──
// 진입 컴포넌트(ReportView/DetailView)가 store.lang을 읽어 Provider로 감싸고,
// 하위 탭/서브 컴포넌트는 useLang()으로 읽는다. Provider 밖에선 store를 직접 구독.
const LangContext = createContext<Lang | null>(null)

export const LangProvider = LangContext.Provider

/** 보고서/상세 컴포넌트용 — Provider가 있으면 그 값, 없으면 store 구독. */
export function useLang(): Lang {
  const ctx = useContext(LangContext)
  // Provider가 없을 때만 store 구독(훅 규칙 — 항상 호출하고 ctx 우선).
  const storeLang = useStore((s) => s.lang)
  return ctx ?? storeLang
}
