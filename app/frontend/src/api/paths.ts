// 경로 빌더(순수 함수, 단위 테스트 대상 FT-1). 백엔드 라우트와 1:1.
// country↔region 대칭: domain → 복수형(countries/regions), 코드는 대문자 정규화(VR-3).
import type { Domain } from './types'

const API = '/api'

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

  existence: (domain: Domain, id: string) => base(domain, id),

  detail: (domain: Domain, id: string, version?: string) =>
    version ? `${base(domain, id)}/detail?version=${encodeURIComponent(version)}` : `${base(domain, id)}/detail`,
  detailVersions: (domain: Domain, id: string) => `${base(domain, id)}/detail/versions`,

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
  ruleset: () => `${API}/ruleset`,
  rulesetVersions: () => `${API}/ruleset/versions`,
  rulesetVersion: (version: string) => `${API}/ruleset/versions/${encodeURIComponent(version)}`,
}
