// 룰셋 폼 검증(VR-1·2) — 순수 함수, 단위 테스트 대상(FT-5).

/** 합이 1.0(=100%)이어야 하는 가중치 그룹의 합. 부동소수 오차 흡수 위해 반올림. */
export function sumWeights(group: Record<string, number>): number {
  const total = Object.values(group).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  return Math.round(total * 1000) / 1000
}

/** 합이 1.0(±0.001)인지. biz_attractiveness·it_readiness·report_blend·similarity_item_weights·quick_win.weights 검증용. */
export function isSumOne(group: Record<string, number>): boolean {
  return Math.abs(sumWeights(group) - 1) < 0.001
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
