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

  it('지도 멤버 = 리서치 데이터 보유국 9개(CZ·HU·DE 제외), 운영중 3개', () => {
    // 멤버 12개 중 리서치 items 없는 CZ·HU·DE는 지도에서 제외(데이터 없는 국가 비표시).
    expect(data.map.members).toHaveLength(9)
    expect(data.map.members.some((m) => m.code === 'DE')).toBe(false)
    // 운영중 4개(DE/FR/IT/GB) 중 DE 제외 → 지도엔 FR/IT/GB 3개.
    expect(data.map.members.filter((m) => m.status === '운영중')).toHaveLength(3)
  })

  it('기진출 국가 = 운영중 4개(DE/FR/IT/GB), 자산 포함', () => {
    expect(data.entered_countries).toHaveLength(4)
    const de = data.entered_countries.find((c) => c.code === 'DE')
    expect(de?.type).toBe('JV')
    expect(de?.products.length).toBeGreaterThan(0)
    // 회귀: DE는 리서치 스냅샷 countries[]에 없지만 member_names(geo)로 이름이 채워져야 한다.
    // 이름 폴백이 코드를 두 번 찍던 "DE DE" 버그 방지 — 한글명은 코드가 아니고, 영문명은 한글명과 다름.
    expect(de?.name_ko).toBe('독일')
    expect(de?.name_ko).not.toBe('DE')
    expect(de?.name_en).toBe('Germany')
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
    // 영문명이 병합돼야 한다(영어 모드에서 "폴란드 PL" 혼용 회귀 방지).
    // member_names에 영문명이 있는 후보는 name_en이 채워진다.
    const withEn = data.candidate_countries.filter((c) => c.name_en)
    expect(withEn.length).toBeGreaterThan(0)
  })

  it('시계열 추세 행에도 영문명이 병합된다(영어 모드 혼용 회귀 방지)', () => {
    const withEn = data.trends.filter((tr) => tr.name_en)
    expect(withEn.length).toBeGreaterThan(0)
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
    expect(noReport.map.members).toHaveLength(9) // 리서치 보유국만(보고서 무관)
  })

  // ── A: 시계열 추세(상세화면 전용, 보고서 미사용)
  it('trends — 시계열 보유 멤버국만, 시장규모·EV·CAGR 추출', () => {
    expect(data.trends.length).toBeGreaterThan(0)
    const at = data.trends.find((t) => t.code === 'AT')
    expect(at).toBeTruthy()
    expect(at!.market?.history.length).toBeGreaterThanOrEqual(2)
    expect(at!.market?.forecast.length).toBeGreaterThan(0) // forecast도 추출
    expect(at!.ev?.history.length).toBeGreaterThanOrEqual(2)
    // CAGR은 수치(상승 시장이면 양수)
    expect(typeof at!.market?.cagr).toBe('number')
    expect(at!.market!.cagr!).toBeGreaterThan(0)
  })

  it('trends — 시장규모 KRW 정규화(fx 있으면 양수, 없으면 null)', () => {
    const at = data.trends.find((t) => t.code === 'AT')
    expect(at!.market_krw_bn).not.toBeNull()
    expect(at!.market_krw_bn!).toBeGreaterThan(0)
    // 보고서(fx) 없으면 정규화 불가 → null
    const noReport = buildRegionDetail(snapshot as any, sources as any, null)
    const atNo = noReport.trends.find((t) => t.code === 'AT')
    expect(atNo?.market_krw_bn ?? null).toBeNull()
  })

  it('지도 멤버에 market_krw_bn 전달(버블용)', () => {
    const at = data.map.members.find((m) => m.code === 'AT')
    expect(at).toBeTruthy()
    expect(at!.market_krw_bn).not.toBeNull()
  })

  // ── B: 자산 재사용 매핑(상세화면 전용)
  it('asset_reuse — 기진출 거점별 유사도 Top3 후보 매핑', () => {
    // 기진출 4국 중 솔루션 보유국만(후보 있을 때). 각 매핑은 후보 Top3 이하.
    expect(data.asset_reuse.length).toBeGreaterThan(0)
    for (const r of data.asset_reuse) {
      expect(r.matches.length).toBeGreaterThan(0)
      expect(r.matches.length).toBeLessThanOrEqual(3)
      // 유사도 내림차순
      const sims = r.matches.map((m) => m.similarity)
      expect([...sims].sort((a, b) => b - a)).toEqual(sims)
    }
  })

  it('asset_reuse — 보고서(후보) 없으면 빈 배열', () => {
    const noReport = buildRegionDetail(snapshot as any, sources as any, null)
    expect(noReport.asset_reuse).toHaveLength(0)
  })
})
