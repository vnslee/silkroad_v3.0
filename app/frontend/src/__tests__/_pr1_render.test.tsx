// PR1 전체 탭 렌더 스모크 — 실제 보고서 JSON으로 각 탭 마운트, 런타임 에러 검출
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CountryReport } from '../components/reports/CountryReport'
import fixture from './_pr1_fixture.json'

describe('PR1 CountryReport 렌더', () => {
  it('모든 탭이 에러 없이 렌더된다', () => {
    const { getAllByRole, container } = render(<CountryReport data={fixture as any} />)
    const tabs = getAllByRole('tab')
    expect(tabs.length).toBe(5)
    // 5개 탭 순회 클릭 — 렌더 중 throw 되면 테스트 실패
    for (const tab of tabs) {
      fireEvent.click(tab)
      expect(container.querySelector('svg, table, p')).toBeTruthy()
    }
  })
})
