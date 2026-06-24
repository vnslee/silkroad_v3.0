// 통화 표시 유틸 — 외화 금액을 한화(KRW)로 환산해 크게, 원본 통화를 작게 병기.
// 환율은 /api/fx(internal_latest.json fx) → rates[통화] = 통화 1단위당 KRW.
//
// KRW 표기 규칙(사용자 결정):
//   · 1억 이상     → '6.3억원'  (억 단위, 소수점 1자리)
//   · 1만~1억 미만 → '507만원'  (만 단위, 만 미만 절사)
//   · 1만 미만     → '₩8,540'   (원 단위 그대로 — '0만원' 방지)
import type { FxData } from '../api/types'

/** 통화 기호 ↔ ISO 코드 매핑(원본 문자열 파싱·표기용). */
const SYMBOL_TO_CODE: Record<string, string> = {
  '€': 'EUR',
  '£': 'GBP',
  '$': 'USD',
  '₩': 'KRW',
}
const CODE_TO_SYMBOL: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  KRW: '₩',
}

/** 원본 통화 라벨(기호 있으면 '€1,234', 없으면 '1,234 PLN'). 소수 단가(€24.70)는 2자리 유지. */
export function formatOriginal(value: number, currency: string): string {
  // 정수면 콤마만, 소수가 있으면 2자리(단가 €4.94 등 정밀도 보존).
  const isInt = Number.isInteger(value)
  const n = isInt
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sym = CODE_TO_SYMBOL[currency]
  return sym ? `${sym}${n}` : `${n} ${currency}`
}

/** 외화 1단위 → KRW 환산. fx 없거나 통화 미정의면 null(환산 불가). */
export function toKRW(value: number, currency: string, fx: FxData | null): number | null {
  if (value == null || isNaN(value)) return null
  if (currency === 'KRW') return value
  const rate = fx?.rates?.[currency]
  if (!rate || isNaN(rate)) return null
  return value * rate
}

/**
 * KRW 금액을 한국식 단위로 표기.
 *   1천만↑ → '0.6억원'·'6.3억원'(억, 소수1자리) / 1만~1천만 → '507만원'(만 미만 절사) / 그 미만 → '₩8,540'
 *   ※ 천만원대는 '6,090만원'보다 '0.6억원'이 읽기 좋다는 결정에 따라 억 단위 임계를 1천만으로 둠.
 */
export function formatKRW(krw: number): string {
  if (krw == null || isNaN(krw)) return '—'
  const sign = krw < 0 ? '-' : ''
  const abs = Math.abs(krw)
  const EOK = 1e8
  const EOK_MIN = 1e7 // 1천만 이상이면 억 단위(소수1자리)로 표기
  const MAN = 1e4
  if (abs >= EOK_MIN) {
    // 억 단위 소수점 1자리(예: 5,220만 → 0.5억원, 6.34억 → 6.3억원).
    const eok = abs / EOK
    return `${sign}${eok.toFixed(1)}억원`
  }
  if (abs >= MAN) {
    // 만 단위, 만 미만 절사(내림).
    const man = Math.floor(abs / MAN)
    return `${sign}${man.toLocaleString('en-US')}만원`
  }
  // 1만 미만 — 원 단위 그대로.
  return `${sign}₩${Math.round(abs).toLocaleString('en-US')}`
}

/**
 * 외화 금액 → '한화(환산) + 원본 통화' 두 줄 표기용 문자열 쌍.
 * 환산 불가(fx 없음/통화 미정의)면 krw=null → 원본만 표시.
 */
export interface MoneyParts {
  krw: string | null // 한화 표기(환산 불가 시 null)
  original: string // 원본 통화 표기
}
export function moneyParts(
  value: number | null | undefined,
  currency: string,
  fx: FxData | null,
): MoneyParts {
  if (value == null || isNaN(value)) return { krw: null, original: '—' }
  const krw = toKRW(value, currency, fx)
  return {
    krw: krw == null ? null : formatKRW(krw),
    original: formatOriginal(value, currency),
  }
}

/** 차트 축 등 한 줄 압축용: 한화 단독(환산 불가 시 원본). */
export function krwCompact(
  value: number | null | undefined,
  currency: string,
  fx: FxData | null,
): string {
  if (value == null || isNaN(value)) return '—'
  const krw = toKRW(value, currency, fx)
  return krw == null ? formatOriginal(value, currency) : formatKRW(krw)
}

/**
 * 자유서술 문자열에서 '첫 통화·금액'을 추출(권역 신차가격 등).
 *   예) '약 €36,000 (turismos…)'        → {value:36000, currency:'EUR'}
 *       '약 £35,000~40,000 (…)'           → {value:35000, currency:'GBP'}
 *       '약 35,000 EUR (…)'               → {value:35000, currency:'EUR'}
 *       '약 PLN 145,000 (€33,000~34,000)' → {value:145000, currency:'PLN'}
 * 못 찾으면 null.
 */
export function parseFirstAmount(text: string): { value: number; currency: string } | null {
  if (!text) return null
  // 패턴 후보를 등장 위치 순으로 모아 가장 앞선 것을 택한다.
  const candidates: { idx: number; value: number; currency: string }[] = []
  const pushNum = (raw: string): number => Number(raw.replace(/,/g, ''))

  // 1) 기호 + 숫자  (€36,000 / £35,000 / $1,200 / ₩1,000)
  for (const m of text.matchAll(/([€£$₩])\s?(\d[\d,]*)/g)) {
    candidates.push({ idx: m.index ?? 0, value: pushNum(m[2]), currency: SYMBOL_TO_CODE[m[1]] })
  }
  // 2) 코드 + 숫자  (EUR 36,000 / PLN 145,000)
  for (const m of text.matchAll(/\b([A-Z]{3})\s?(\d[\d,]*)/g)) {
    candidates.push({ idx: m.index ?? 0, value: pushNum(m[2]), currency: m[1] })
  }
  // 3) 숫자 + 코드  (35,000 EUR)
  for (const m of text.matchAll(/(\d[\d,]*)\s?([A-Z]{3})\b/g)) {
    candidates.push({ idx: m.index ?? 0, value: pushNum(m[1]), currency: m[2] })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.idx - b.idx)
  const first = candidates[0]
  if (isNaN(first.value)) return null
  return { value: first.value, currency: first.currency }
}
