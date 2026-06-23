// 잡 step/percent → PS2 프로그레스 바 매핑(L4). kind별 분기(Q1 확정).
// 백엔드 JobStep 은 per-agent 세분 단계를 주지 않으므로 percent 보간으로 근사한다.
import type { JobKind, JobStep } from '../api/types'

export interface ProgressBar {
  key: string
  label: string
  percent: number
  state: 'pending' | 'active' | 'done'
}

// percent(0~100)를 N개 바에 순차 비례 채움(근사). 각 바는 1/N 구간을 담당.
function fillSequential(labels: { key: string; label: string }[], percent: number): ProgressBar[] {
  const n = labels.length
  const seg = 100 / n
  return labels.map((l, i) => {
    const start = i * seg
    const local = Math.max(0, Math.min(100, ((percent - start) / seg) * 100))
    const state: ProgressBar['state'] = local >= 100 ? 'done' : local > 0 ? 'active' : 'pending'
    return { ...l, percent: Math.round(local), state }
  })
}

const RESEARCH_BARS = [
  { key: 'market', label: '시장' },
  { key: 'regulation', label: '규제' },
  { key: 'product', label: '상품' },
  { key: 'system', label: '시스템' },
  { key: 'result', label: '결과 생성' },
]

const REPORT_BARS = [
  { key: 'data', label: '보고서 데이터 생성' },
  { key: 'render', label: '렌더링' },
  { key: 'done', label: '완료' },
]

const DETAIL_BARS = [{ key: 'render', label: '상세화면 생성' }]

export function mapStepToBars(kind: JobKind, step: JobStep, percent: number): ProgressBar[] {
  // done 은 어떤 kind든 전체 완료로 표현
  if (step === 'done') {
    const labels = kind === 'research' ? RESEARCH_BARS : kind === 'report' ? REPORT_BARS : DETAIL_BARS
    return labels.map((l) => ({ ...l, percent: 100, state: 'done' as const }))
  }
  if (kind === 'research') return fillSequential(RESEARCH_BARS, percent)
  if (kind === 'report') return fillSequential(REPORT_BARS, percent)
  return fillSequential(DETAIL_BARS, percent)
}

// 전체 진행률(카드용) — 백엔드 percent 그대로.
export function overallPercent(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)))
}
