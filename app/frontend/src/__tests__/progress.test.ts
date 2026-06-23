// FT-4: mapStepToBars — kind별 바 구성·percent 보간 단조 증가.
import { describe, expect, it } from 'vitest'
import { mapStepToBars } from '../utils/progress'

describe('mapStepToBars', () => {
  it('research는 5개 바(시장/규제/상품/시스템/결과)', () => {
    const bars = mapStepToBars('research', 'calling_bedrock', 0)
    expect(bars.map((b) => b.key)).toEqual(['market', 'regulatory', 'product', 'system', 'result'])
  })

  it('agents[]가 있으면 분야별 실제 진행률을 반영', () => {
    const bars = mapStepToBars('research', 'calling_bedrock', 30, [
      { key: 'market', label: '시장', status: 'succeeded', percent: 100 },
      { key: 'regulatory', label: '규제', status: 'running', percent: 40 },
      { key: 'system', label: '시스템', status: 'queued', percent: 0 },
      { key: 'product', label: '상품', status: 'running', percent: 10 },
    ])
    const market = bars.find((b) => b.key === 'market')!
    const regulatory = bars.find((b) => b.key === 'regulatory')!
    expect(market.percent).toBe(100)
    expect(market.state).toBe('done')
    expect(regulatory.percent).toBe(40)
    expect(regulatory.state).toBe('active')
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
