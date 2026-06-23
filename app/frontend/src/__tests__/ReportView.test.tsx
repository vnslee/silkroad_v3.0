// FC-3: ReportView — reportId 지정 시 iframe title·액션 버튼 렌더.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReportView from '../components/report/ReportView'

beforeEach(() => {
  // listReports는 reportId 지정 시 호출되지 않지만, 안전하게 목킹
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ domain: 'country', target_id: 'ES', reports: [] }), { status: 200 })),
  )
})

describe('ReportView', () => {
  it('reportId 지정 시 iframe(title)과 액션 버튼 렌더', () => {
    render(<ReportView domain="country" code="ES" reportId="RPT_CTR_ES_001" mode="popup" />)
    expect(screen.getByTitle(/본문/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /메일 발송/ })).toBeInTheDocument()
    // PDF 다운로드 링크(anchor)
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })
})
