// 라우트 상태머신(L2) — URL hash 딥링크 + mode 쿼리(Q3=A·Q8=A). 순수 함수(테스트 FT-2).
// 형식: #/{domain}/{id}/{screen}?mode={popup|fullscreen}  (예: #/country/ES/report?mode=popup)
import type { Domain } from '../api/types'

export type EntryMode = 'popup' | 'fullscreen'
export type ScreenId = 'map' | 'detail' | 'report' | 'ruleset'

export interface RouteState {
  screen: ScreenId
  domain?: Domain
  id?: string
  reportId?: string
  mode: EntryMode
}

export const HOME: RouteState = { screen: 'map', mode: 'fullscreen' }

function parseDomain(s: string | undefined): Domain | undefined {
  if (s === 'country' || s === 'countries') return 'country'
  if (s === 'region' || s === 'regions') return 'region'
  return undefined
}

// 화면 라우트(map 제외)가 hash에 있으면 딥링크 → 인트로 생략(intro_spec).
export function isDeepLink(hash: string): boolean {
  const r = parseHashRoute(hash)
  return r.screen !== 'map'
}

export function parseHashRoute(hash: string): RouteState {
  const raw = hash.replace(/^#/, '')
  const [pathPart, queryPart] = raw.split('?')
  const segs = pathPart.split('/').filter(Boolean)

  const query = new URLSearchParams(queryPart ?? '')
  const modeRaw = query.get('mode')
  const mode: EntryMode = modeRaw === 'popup' ? 'popup' : 'fullscreen'

  if (segs.length === 0) return { ...HOME }

  // #/ruleset
  if (segs[0] === 'ruleset') return { screen: 'ruleset', mode }

  // #/{domain}/{id}/{screen}
  const domain = parseDomain(segs[0])
  if (domain && segs[1]) {
    const id = segs[1].toUpperCase()
    const screen = (segs[2] as ScreenId) ?? 'detail'
    const reportId = segs[3]
    if (screen === 'report') return { screen: 'report', domain, id, reportId, mode }
    if (screen === 'detail') return { screen: 'detail', domain, id, mode }
  }
  return { ...HOME }
}

export function buildHash(r: RouteState): string {
  if (r.screen === 'map') return '#/'
  if (r.screen === 'ruleset') return `#/ruleset?mode=${r.mode}`
  const dp = r.domain === 'country' ? 'country' : 'region'
  const tail = r.screen === 'report' && r.reportId ? `/report/${r.reportId}` : `/${r.screen}`
  return `#/${dp}/${r.id}${tail}?mode=${r.mode}`
}
