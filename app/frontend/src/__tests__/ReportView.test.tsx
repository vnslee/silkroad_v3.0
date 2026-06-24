// FC-3: ReportView — reportId 지정 시 헤더 액션 버튼(PDF·메일) 렌더.
// (구버전 iframe 전제 제거 — 본문은 React 컴포넌트로 직접 렌더링한다.)
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportView from '../components/report/ReportView'

beforeEach(() => {
  // 카탈로그/보고서 목록/보고서 JSON 모두 빈 OK 응답으로 목킹.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ domain: 'country', target_id: 'ES', reports: [] }), { status: 200 })),
  )
})

describe('ReportView', () => {
  it('reportId 지정 시 헤더 액션 버튼(PDF·메일 발송) 렌더', () => {
    render(<ReportView domain="country" code="ES" reportId="RPT_CTR_ES_001" mode="popup" />)
    // reportId가 selected를 초기화하므로 헤더 chrome(액션 버튼)이 즉시 렌더된다.
    expect(screen.getByRole('button', { name: /메일 발송/ })).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })
})
