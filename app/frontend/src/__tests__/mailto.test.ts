// FT-3: buildMailtoUrl — subject/body 인코딩·to 빈값(무저장)·첨부 안내·2000자.
import { describe, expect, it } from 'vitest'
import { buildMailtoUrl } from '../utils/mailto'

const base = {
  domain: 'country' as const,
  targetName: 'Spain',
  reportId: 'RPT_CTR_ES_001',
  createdAt: '2026-06-22',
  summary: '진출 적합',
  htmlUrl: '/api/countries/ES/reports/RPT_CTR_ES_001/html',
  pdfUrl: '/api/countries/ES/reports/RPT_CTR_ES_001/pdf',
}

describe('buildMailtoUrl', () => {
  it('mailto:로 시작하고 to는 비어 있다(무저장)', () => {
    const url = buildMailtoUrl(base)
    expect(url.startsWith('mailto:?')).toBe(true)
    expect(url).not.toMatch(/mailto:[^?]/) // 수신주소 없음
  })

  it('subject에 보고서 ID, body에 첨부 안내가 포함된다', () => {
    const url = buildMailtoUrl(base)
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('RPT_CTR_ES_001')
    expect(decoded).toContain('첨부')
  })

  it('body가 2000자 이내로 절단된다', () => {
    const url = buildMailtoUrl({ ...base, summary: 'x'.repeat(5000) })
    const body = decodeURIComponent(new URL(url).searchParams.get('body') ?? '')
    expect(body.length).toBeLessThanOrEqual(2000)
  })
})
