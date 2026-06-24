// 권역 상세(P2) 3-소스 병합 유틸 — 실 EU 데이터로 백엔드 build_detail_data와 동치 검증.
// 픽스처: _fixtures/region/{EU_snapshot,EU_sources,EU_report}.json (실데이터 복사).
import { describe, it, expect } from 'vitest'
import { buildRegionDetail } from '../utils/regionDetail'
import snapshot from './_fixtures/region/EU_snapshot.json'
import sources from './_fixtures/region/EU_sources.json'
import report from './_fixtures/region/EU_report.json'

describe('buildRegionDetail (EU 3-소스 병합)', () => {
  const data = buildRegionDetail(snapshot as any, sources as any, report as any)

  it('메타 — region/code 보존', () => {
    expect(data.code).toBe('EU')
    expect(data.region).toBeTruthy()
  })

  it('지도 멤버 = 권역 소속국 12개, 운영중 4개', () => {
    expect(data.map.members).toHaveLength(12)
    expect(data.map.members.filter((m) => m.status === '운영중')).toHaveLength(4)
  })

  it('기진출 국가 = 운영중 4개(DE/FR/IT/GB), 자산 포함', () => {
    expect(data.entered_countries).toHaveLength(4)
    const de = data.entered_countries.find((c) => c.code === 'DE')
    expect(de?.type).toBe('JV')
    expect(de?.products.length).toBeGreaterThan(0)
  })

  it('후보국 = 퀵윈 보고서 랭킹 행(비제외), 점수·판정 포함', () => {
    expect(data.candidate_countries.length).toBeGreaterThan(0)
    // 모든 후보는 rank·종합점수가 있어야 한다(excluded 행은 제외됨).
    for (const c of data.candidate_countries) {
      expect(c.quick_win_rank).not.toBeNull()
      expect(typeof c.composite_score).toBe('number')
    }
    // rank 오름차순 정렬은 컴포넌트가 하지만, 병합 결과에 rank가 유효한지 확인.
    const ranks = data.candidate_countries.map((c) => c.quick_win_rank)
    expect(new Set(ranks).size).toBe(ranks.length) // 중복 rank 없음
  })

  it('KPI = 후보 수·퀵윈 수·킬스위치 탈락 수 일관', () => {
    expect(data.kpi.candidates).toBe(data.candidate_countries.length)
    expect(data.kpi.quickwin).toBe(
      data.candidate_countries.filter((c) => c.quick_win).length,
    )
    expect(data.kpi.killswitch_failed).toBeGreaterThanOrEqual(0)
  })

  it('보고서 없으면 후보·KPI는 0, 기진출/지도는 유지', () => {
    const noReport = buildRegionDetail(snapshot as any, sources as any, null)
    expect(noReport.candidate_countries).toHaveLength(0)
    expect(noReport.kpi.candidates).toBe(0)
    expect(noReport.entered_countries).toHaveLength(4) // internal만으로 산출
    expect(noReport.map.members).toHaveLength(12)
  })
})
