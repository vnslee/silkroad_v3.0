// PR1 전체 국가 렌더 — 각 국가 보고서로 5개 탭 마운트, 어느 데이터에서 throw 되는지 검출
import { describe, it } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { CountryReport } from '../components/reports/CountryReport'

const fixtures = import.meta.glob('./_fixtures/*.json', { eager: true })

describe('PR1 전체 국가 렌더 스모크', () => {
  for (const [path, mod] of Object.entries(fixtures)) {
    const code = path.split('/').pop()!.replace('.json', '')
    const data = (mod as any).default ?? mod
    it(`${code} — 5개 탭 렌더`, () => {
      const { getAllByRole } = render(<CountryReport data={data} />)
      const tabs = getAllByRole('tab')
      for (const tab of tabs) {
        fireEvent.click(tab)
      }
      cleanup()
    })
  }
})
