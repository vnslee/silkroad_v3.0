// 포맷팅 유틸리티 함수들 (Python render_helpers.py 이식)

/**
 * 숫자를 K/M/B 단위로 포맷
 */
export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '—'

  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(decimals) + 'B'
  }
  if (abs >= 1_000_000) {
    return (value / 1_000_000).toFixed(decimals) + 'M'
  }
  if (abs >= 1_000) {
    return (value / 1_000).toFixed(decimals) + 'K'
  }
  return value.toFixed(decimals)
}

/**
 * 통화 포맷 (EUR, USD 등)
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'EUR',
  compact = true
): string {
  if (value === null || value === undefined || isNaN(value)) return '—'

  if (compact) {
    return `${currency} ${formatNumber(value)}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * 퍼센트 포맷
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

/**
 * 날짜 포맷
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  } catch {
    return dateString
  }
}

/**
 * 스코어에 따른 색상 반환 (0-100) — mockup 퀵윈 순위 색 체계와 일치.
 *   ≥70 green(#137333) · ≥55 blue(#1967d2) · ≥45 amber(#b06000) · 그 미만 red(#c5221f)
 */
export function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) return '#747782'

  if (score >= 70) return '#137333' // 퀵윈(green)
  if (score >= 55) return '#1967d2' // 선별 후보(blue)
  if (score >= 45) return '#b06000' // 기회 탐색(amber)
  return '#c5221f' // 관망(red)
}

/**
 * 값의 방향성에 따른 색상 (up=green, down=red)
 */
export function getDirectionColor(direction: 'up' | 'down' | 'neutral' | undefined): string {
  if (direction === 'up') return '#137333'
  if (direction === 'down') return '#c5221f'
  return '#434751'
}

/**
 * Source tier 배지 색상
 */
export function getSourceTierBadge(tier: number): { bg: string; fg: string; label: string } {
  const badges = {
    1: { bg: '#e3edff', fg: '#2f6be0', label: '1차' },
    2: { bg: '#e9f3ee', fg: '#4f8a6d', label: '2차' },
    3: { bg: '#fbf3e2', fg: '#c08a2e', label: '3차' },
    4: { bg: '#eef0f2', fg: '#3a4048', label: '4차' },
  }
  return badges[tier as keyof typeof badges] || badges[4]
}

/**
 * Flag 배지 스타일 (EXT, INT, CALC, AI 등)
 */
export function getFlagBadge(flag: string): { bg: string; fg: string; label: string } {
  const badges: Record<string, { bg: string; fg: string; label: string }> = {
    EXT: { bg: '#eef0f2', fg: '#3a4048', label: '외부조사' },
    INT: { bg: '#e3edff', fg: '#2f6be0', label: '내부자료' },
    CALC: { bg: '#e9f3ee', fg: '#4f8a6d', label: '계산값' },
    AI: { bg: '#e3edff', fg: '#2f6be0', label: 'AI 인사이트' },
    NEWS: { bg: '#fbf3e2', fg: '#c08a2e', label: '외부이슈' },
  }
  return badges[flag] || { bg: '#eef0f2', fg: '#3a4048', label: flag }
}
