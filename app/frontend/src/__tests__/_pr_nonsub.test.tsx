// 비구독(권역 확산) 국가 — 요약/결정트리 탭 우측 패널이 빈 구독료표 대신
// 구축비용·기간을 보여주는지 검증. 실 데이터(PR_002, baseline_system_expansion + is_subscription=false).
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CountryReport } from '../components/reports/CountryReport'
import fixture from './_pr_nonsub_fixture.json'

describe('비구독 권역확산국 — 결정 패널', () => {
  it('요약 탭: 구독료 빈 메시지 없이 구축비용·기간을 노출', () => {
    const { getByText, queryByText } = render(<CountryReport data={fixture as any} />)
    // 빈 구독료표 메시지가 사라져야 한다(버그 재현 방지)
    expect(queryByText('구독료 구간 데이터가 없습니다.')).toBeNull()
    // 비구독 패널 라벨이 노출돼야 한다
    expect(getByText('예상 구축비용')).toBeTruthy()
    expect(getByText('예상 구축기간')).toBeTruthy()
  })

  it('시스템 결정 트리 탭: 패널 제목이 "구축비용·기간"이고 빈 메시지 없음', () => {
    const { getAllByRole, getAllByText, queryByText } = render(<CountryReport data={fixture as any} />)
    const decisionTab = getAllByRole('tab').find((t) => t.textContent?.includes('시스템 결정 트리'))!
    fireEvent.click(decisionTab)
    expect(queryByText('구독료 구간 데이터가 없습니다.')).toBeNull()
    expect(getAllByText('구축비용·기간').length).toBeGreaterThan(0)
    expect(getAllByText('예상 구축비용').length).toBeGreaterThan(0)
  })
})
