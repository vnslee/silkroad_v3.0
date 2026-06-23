// FT-1: 경로 빌더 — country↔region 대칭·코드 대문자 정규화·엔드포인트 정확.
import { describe, expect, it } from 'vitest'
import { paths, domainPlural } from '../api/paths'

describe('paths 경로 빌더', () => {
  it('domainPlural: country→countries, region→regions', () => {
    expect(domainPlural('country')).toBe('countries')
    expect(domainPlural('region')).toBe('regions')
  })

  it('코드를 대문자로 정규화한다', () => {
    expect(paths.detail('country', 'es')).toBe('/api/countries/ES/detail')
    expect(paths.existence('region', 'eu')).toBe('/api/regions/EU')
  })

  it('보고서 URL을 정확히 만든다', () => {
    expect(paths.reportHtml('country', 'ES', 'RPT_CTR_ES_001')).toBe(
      '/api/countries/ES/reports/RPT_CTR_ES_001/html',
    )
    expect(paths.reportPdf('region', 'EU', 'RPT_RGN_EU_001')).toBe(
      '/api/regions/EU/reports/RPT_RGN_EU_001/pdf',
    )
  })

  it('잡·리서치·챗봇 경로', () => {
    expect(paths.job('abc123')).toBe('/api/jobs/abc123')
    expect(paths.research('country', 'PT')).toBe('/api/countries/PT/research')
    expect(paths.chat()).toBe('/api/chat')
  })
})
