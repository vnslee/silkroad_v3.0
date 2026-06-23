// FT-2: parseHashRoute/buildHash 왕복·mode 쿼리·딥링크 판정.
import { describe, expect, it } from 'vitest'
import { buildHash, isDeepLink, parseHashRoute } from '../app/route'

describe('route 파서', () => {
  it('빈 hash → map(home)', () => {
    expect(parseHashRoute('').screen).toBe('map')
    expect(parseHashRoute('#/').screen).toBe('map')
  })

  it('detail 라우트 + mode 쿼리', () => {
    const r = parseHashRoute('#/country/ES/detail?mode=popup')
    expect(r).toMatchObject({ screen: 'detail', domain: 'country', id: 'ES', mode: 'popup' })
  })

  it('report 라우트 + reportId', () => {
    const r = parseHashRoute('#/region/EU/report/RPT_RGN_EU_001?mode=fullscreen')
    expect(r).toMatchObject({
      screen: 'report',
      domain: 'region',
      id: 'EU',
      reportId: 'RPT_RGN_EU_001',
      mode: 'fullscreen',
    })
  })

  it('mode 미지정 시 기본 fullscreen', () => {
    expect(parseHashRoute('#/country/ES/detail').mode).toBe('fullscreen')
  })

  it('isDeepLink: 화면 라우트는 true, map은 false', () => {
    expect(isDeepLink('#/country/ES/report?mode=popup')).toBe(true)
    expect(isDeepLink('#/')).toBe(false)
  })

  it('buildHash ↔ parseHashRoute 왕복', () => {
    const r = parseHashRoute('#/country/ES/report/RPT_CTR_ES_001?mode=popup')
    const back = parseHashRoute(buildHash(r))
    expect(back).toMatchObject(r)
  })
})
