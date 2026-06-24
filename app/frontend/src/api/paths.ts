// 경로 빌더(순수 함수, 단위 테스트 대상 FT-1). 백엔드 라우트와 1:1.
// country↔region 대칭: domain → 복수형(countries/regions), 코드는 대문자 정규화(VR-3).
import type { Domain } from './types'

// API base 경로 — 프록시 prefix 자동 감지.
// 포트 프록시 환경(`/ports/5173/...` CloudFront, `/ports/8000/app/...` code-editor)처럼
// 경로 prefix가 붙으면 `/api` 절대경로가 prefix 밖으로 나가 403/404가 난다.
// 현재 페이지 경로에서 prefix를 추출해 `/api` 앞에 붙인다(루트 서빙·dev 서버에선 빈 문자열).
//   ① `/ports/<port>/...`  → prefix `/ports/<port>` (preview 프록시가 /api→백엔드로 넘김)
//   ② `/app/...`           → prefix `` (앱이 /app 하위 서빙되는 경우)
//   ③ 루트 서빙             → prefix ``
function detectApiBase(): string {
  if (typeof window === 'undefined') return '/api'
  const path = window.location.pathname
  // ① 포트 프록시: `/ports/<port>` 까지를 prefix 로.
  const portsMatch = path.match(/^(\/ports\/\d+)(\/|$)/)
  if (portsMatch) return `${portsMatch[1]}/api`
  // ② `/app/` 마커 앞부분을 prefix 로(`/x/y/app/...` → `/x/y`).
  const idx = path.indexOf('/app/')
  const prefix = idx > 0 ? path.slice(0, idx) : ''
  return `${prefix}/api`
}

const API = detectApiBase()

export function domainPlural(domain: Domain): 'countries' | 'regions' {
  return domain === 'country' ? 'countries' : 'regions'
}

function normId(id: string): string {
  return id.trim().toUpperCase()
}

function base(domain: Domain, id: string): string {
  return `${API}/${domainPlural(domain)}/${normId(id)}`
}

export const paths = {
  countries: () => `${API}/countries`,
  regions: () => `${API}/regions`,
  mapColors: () => `${API}/map-colors`,
  fx: () => `${API}/fx`,

  existence: (domain: Domain, id: string) => base(domain, id),

  detail: (domain: Domain, id: string, version?: string) =>
    version ? `${base(domain, id)}/detail?version=${encodeURIComponent(version)}` : `${base(domain, id)}/detail`,
  detailVersions: (domain: Domain, id: string) => `${base(domain, id)}/detail/versions`,
  // 권역 상세(P2) 3-소스 병합용 원시 internal 데이터(권역 소속국 자산·진출상태).
  regionDetailSources: (region: string) => `${API}/regions/${normId(region)}/detail-sources`,

  reports: (domain: Domain, id: string) => `${base(domain, id)}/reports`,
  reportJson: (domain: Domain, id: string, reportId: string) =>
    `${base(domain, id)}/reports/${reportId}/json`,
  reportHtml: (domain: Domain, id: string, reportId: string) =>
    `${base(domain, id)}/reports/${reportId}/html`,
  reportPdf: (domain: Domain, id: string, reportId: string) =>
    `${base(domain, id)}/reports/${reportId}/pdf`,

  job: (jobId: string) => `${API}/jobs/${jobId}`,
  research: (domain: Domain, id: string) => `${base(domain, id)}/research`,
  chat: () => `${API}/chat`,
  chatStream: () => `${API}/chat/stream`,
  chatFlow: () => `${API}/chat/flow`,
  ruleset: () => `${API}/ruleset`,
  rulesetVersions: () => `${API}/ruleset/versions`,
  rulesetVersion: (version: string) => `${API}/ruleset/versions/${encodeURIComponent(version)}`,
}
