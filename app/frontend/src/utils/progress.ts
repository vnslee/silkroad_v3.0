// 잡 step/percent → PS2 프로그레스 바 매핑(L4). kind별 분기(Q1 확정).
// 리서치 잡은 백엔드가 분야 agent별 실제 진행률(agents[])을 주면 그걸 직접 바에 반영하고,
// 없으면(권역 종합 등) percent 보간으로 폴백한다.
import type { AgentProgress, JobKind, JobState, JobStep } from '../api/types'

export interface ProgressBar {
  key: string
  label: string
  percent: number
  state: 'pending' | 'active' | 'done' | 'failed'
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

// 백엔드 agent key(market/regulatory/system/product)와 정합. 마지막 '결과 생성'은
// agent가 아니라 후속 합성 단계라 step 기반으로 채운다.
const RESEARCH_BARS = [
  { key: 'market', label: '시장' },
  { key: 'regulatory', label: '규제' },
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

// 권역 리서치 잡 단계 바(분야 agent가 아니라 '멤버 선행 → 권역 종합 → 저장' 흐름).
// 권역 잡은 agents[]가 없고 step 기반 percent로 진행하므로 percent 구간으로 채운다.
const REGION_BARS = [
  { key: 'members', label: '멤버 국가 조사', start: 40, end: 70 },
  { key: 'synth', label: '권역 종합', start: 70, end: 90 },
  { key: 'save', label: '저장', start: 90, end: 100 },
]

// 권역 리서치 step/percent → 구간 기반 바. 각 바는 [start,end] 구간을 0~100%로 환산.
function regionBars(percent: number): ProgressBar[] {
  return REGION_BARS.map(({ key, label, start, end }) => {
    const local = Math.max(0, Math.min(100, ((percent - start) / (end - start)) * 100))
    const state: ProgressBar['state'] = local >= 100 ? 'done' : local > 0 ? 'active' : 'pending'
    return { key, label, percent: Math.round(local), state }
  })
}

// 권역 리서치 잡인지 — region 전용 step으로 판별(country 잡은 이 step을 쓰지 않음).
function isRegionStep(step: JobStep): boolean {
  return step === 'members_progress' || step === 'region_synth'
}

// 백엔드 agent 상태 → 바 상태. 실패는 별도 표기(완료로 오인 금지).
function agentState(status: JobState, percent: number): ProgressBar['state'] {
  if (status === 'failed') return 'failed'
  if (status === 'succeeded') return 'done'
  if (status === 'running' && percent > 0) return 'active'
  return 'pending'
}

// 리서치 잡: agents[]가 있으면 4개 분야 바를 실제 진행률로 채우고, '결과 생성' 바는
// step(result_gen/saving/done)으로 채운다. agents가 없으면 percent 보간 폴백.
function researchBars(
  step: JobStep,
  percent: number,
  agents?: AgentProgress[],
): ProgressBar[] {
  if (!agents || agents.length === 0) return fillSequential(RESEARCH_BARS, percent)
  const byKey = new Map(agents.map((a) => [a.key, a]))
  return RESEARCH_BARS.map((bar) => {
    if (bar.key === 'result') {
      const tail = step === 'done' ? 100 : step === 'saving' ? 80 : step === 'result_gen' ? 50 : 0
      return {
        ...bar,
        percent: tail,
        state: tail >= 100 ? 'done' : tail > 0 ? 'active' : 'pending',
      }
    }
    const a = byKey.get(bar.key)
    if (!a) return { ...bar, percent: 0, state: 'pending' as const }
    return { ...bar, percent: a.percent, state: agentState(a.status, a.percent) }
  })
}

export function mapStepToBars(
  kind: JobKind,
  step: JobStep,
  percent: number,
  agents?: AgentProgress[],
  domain?: 'country' | 'region',
): ProgressBar[] {
  // 권역 리서치 잡은 분야 agent가 아니라 '멤버 선행 → 권역 종합 → 저장' 흐름이라
  // 별도 바를 쓴다. domain이 오면 그걸 신뢰하고, 없으면 region 전용 step으로 추정한다.
  const isRegion =
    kind === 'research' && (domain === 'region' || (domain === undefined && isRegionStep(step)))

  // done 은 어떤 kind든 전체 완료로 표현
  if (step === 'done') {
    const labels =
      kind === 'research'
        ? isRegion ? REGION_BARS : RESEARCH_BARS
        : kind === 'report' ? REPORT_BARS : DETAIL_BARS
    return labels.map((l) => ({ key: l.key, label: l.label, percent: 100, state: 'done' as const }))
  }
  if (isRegion) return regionBars(percent)
  if (kind === 'research') return researchBars(step, percent, agents)
  if (kind === 'report') return fillSequential(REPORT_BARS, percent)
  return fillSequential(DETAIL_BARS, percent)
}

// 전체 진행률(카드용) — 백엔드 percent 그대로.
export function overallPercent(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)))
}
