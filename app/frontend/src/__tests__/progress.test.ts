// FT-4: mapStepToBars — kind별 바 구성·percent 보간 단조 증가.
import { describe, expect, it } from 'vitest'
import { mapStepToBars } from '../utils/progress'

describe('mapStepToBars', () => {
  it('research는 5개 바(시장/규제/상품/시스템/결과)', () => {
    const bars = mapStepToBars('research', 'calling_bedrock', 0)
    expect(bars.map((b) => b.key)).toEqual(['market', 'regulation', 'product', 'system', 'result'])
  })

  it('report는 데이터→렌더→완료 3바', () => {
    const bars = mapStepToBars('report', 'generating', 0)
    expect(bars.map((b) => b.key)).toEqual(['data', 'render', 'done'])
  })

  it('detail은 단일 바', () => {
    const bars = mapStepToBars('detail', 'rendering', 50)
    expect(bars).toHaveLength(1)
  })

  it('done이면 모든 바 100%', () => {
    const bars = mapStepToBars('research', 'done', 100)
    expect(bars.every((b) => b.percent === 100 && b.state === 'done')).toBe(true)
  })

  it('percent 증가 시 채워진 총량이 단조 증가', () => {
    const total = (p: number) =>
      mapStepToBars('research', 'calling_bedrock', p).reduce((a, b) => a + b.percent, 0)
    expect(total(20)).toBeLessThanOrEqual(total(60))
    expect(total(60)).toBeLessThanOrEqual(total(100))
  })
})
