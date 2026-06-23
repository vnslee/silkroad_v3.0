// FT-5: 룰셋 가중치 검증 — 합 1.0 판정·범위 클램프.
import { describe, expect, it } from 'vitest'
import { clamp, isSumOne, sumWeights } from '../components/ruleset/validation'

describe('ruleset validation', () => {
  it('합 1.0이면 valid', () => {
    expect(isSumOne({ a: 0.5, b: 0.3, c: 0.2 })).toBe(true)
  })
  it('합 1.0이 아니면 invalid', () => {
    expect(isSumOne({ a: 0.5, b: 0.3, c: 0.3 })).toBe(false)
    expect(sumWeights({ a: 0.5, b: 0.3, c: 0.3 })).toBe(1.1)
  })
  it('부동소수 오차 흡수 (0.4+0.35+0.25=1.0)', () => {
    expect(isSumOne({ similarity: 0.4, attractiveness: 0.35, ease: 0.25 })).toBe(true)
  })
  it('clamp 범위 제한', () => {
    expect(clamp(120, 0, 100)).toBe(100)
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(0.7, 0, 1)).toBe(0.7)
    expect(clamp(NaN, 0, 1)).toBe(0)
  })
})
