// FC-4: RulesetForm — GET /api/ruleset 로 값을 불러와 그룹을 렌더하고,
// 합≠100% 그룹이 있으면 [저장]이 비활성된다.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import RulesetForm from '../components/ruleset/RulesetForm'
import type { RulesetPayload, RulesetSaveResult } from '../api/types'

function makePayload(overrides: Partial<RulesetPayload> = {}): RulesetPayload {
  return {
    version: '1.3',
    updated_at: '2026-06-21T00:00:00+09:00',
    biz_attractiveness: { a: 0.6, b: 0.4 },
    it_readiness: { x: 0.5, y: 0.5 },
    report_blend: { w_biz: 0.6, w_it: 0.4 },
    similarity_item_weights: { s1: 0.5, s2: 0.5 },
    similarity_item_axes: { s1: 'system', s2: 'risk' },
    tier_weights: { tier1: 1.0, tier2: 0.85 },
    decision_thresholds: { expansion_min_score: 70, hq_build_min_score: 50 },
    ...overrides,
  }
}

// 라우트 인지 stub: /versions → 목록, /versions/<v> → 버전 payload, 그 외 → latest payload.
function stubFetch(payload: RulesetPayload, versionPayloads: Record<string, RulesetPayload> = {}) {
  const versions = Object.keys(versionPayloads).map((v, i) => ({
    version: v,
    date: '2026-06-22',
    file: `internal_v${v}_2026-06-22.json`,
    is_latest: i === 0,
  }))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url)
      const m = u.match(/\/ruleset\/versions\/([\d.]+)$/)
      if (m) return new Response(JSON.stringify(versionPayloads[m[1]] ?? payload), { status: 200 })
      if (u.endsWith('/ruleset/versions')) return new Response(JSON.stringify(versions), { status: 200 })
      return new Response(JSON.stringify(payload), { status: 200 })
    }),
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('RulesetForm', () => {
  it('값을 불러오면 가중치 그룹 legend가 렌더된다', async () => {
    stubFetch(makePayload())
    render(<RulesetForm />)
    await waitFor(() => expect(screen.getByText(/사업매력도 항목 가중치/)).toBeInTheDocument())
    expect(screen.getByText(/유사도 항목 가중치/)).toBeInTheDocument()
    expect(screen.getByText(/출처 신뢰 계수/)).toBeInTheDocument()
    expect(screen.getByText(/시스템 결정 임계값/)).toBeInTheDocument()
  })

  it('모든 합=1.0 그룹이 유효하면 저장 버튼 활성', async () => {
    stubFetch(makePayload())
    render(<RulesetForm />)
    const save = await screen.findByRole('button', { name: '저장' })
    await waitFor(() => expect(save).toBeEnabled())
  })

  it('합≠1.0 그룹이 있으면 저장 버튼 비활성', async () => {
    stubFetch(makePayload({ biz_attractiveness: { a: 0.6, b: 0.6 } }))
    render(<RulesetForm />)
    const save = await screen.findByRole('button', { name: '저장' })
    await waitFor(() => expect(save).toBeDisabled())
  })

  it('저장 성공 시 버전·스냅샷 팝업이 뜬다', async () => {
    // GET → RulesetPayload, PUT → RulesetSaveResult 로 응답 분기
    const saveResult: RulesetSaveResult = {
      ruleset: makePayload({ version: '1.4', updated_at: '2026-06-22T18:00:00+09:00' }),
      version: '1.4',
      snapshot_file: 'internal_v1.4_2026-06-22.json',
      updated_at: '2026-06-22T18:00:00+09:00',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = init?.method === 'PUT' ? saveResult : makePayload()
        return new Response(JSON.stringify(body), { status: 200 })
      }),
    )
    render(<RulesetForm />)
    const save = await screen.findByRole('button', { name: '저장' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    // 팝업(dialog)·버전·스냅샷 파일명 노출
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('룰셋이 저장되었습니다')
    expect(dialog).toHaveTextContent('v1.4')
    expect(dialog).toHaveTextContent('internal_v1.4_2026-06-22.json')

    // 확인 클릭 시 닫힘
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('헤더에 타임스탬프(updated_at)를 표시하지 않는다', async () => {
    stubFetch(makePayload({ updated_at: '2026-06-21T00:00:00+09:00' }))
    render(<RulesetForm />)
    await waitFor(() => expect(screen.getByText(/사업매력도 항목 가중치/)).toBeInTheDocument())
    expect(screen.queryByText(/2026-06-21T00:00:00/)).not.toBeInTheDocument()
  })

  it('버전 선택 시 해당 버전 값이 화면에 로드된다', async () => {
    // latest=1.4(tier2 0.85), 과거 1.3(tier2 0.50)
    stubFetch(makePayload({ version: '1.4' }), {
      '1.4': makePayload({ version: '1.4', tier_weights: { tier1: 1.0, tier2: 0.85 } }),
      '1.3': makePayload({ version: '1.3', tier_weights: { tier1: 1.0, tier2: 0.5 } }),
    })
    render(<RulesetForm />)
    // 드롭다운 등장 대기
    const select = (await screen.findByLabelText('룰셋 버전 선택')) as HTMLSelectElement
    await waitFor(() => expect(screen.getByRole('option', { name: 'v1.3' })).toBeInTheDocument())

    // tier2 입력값이 0.85(현재 latest). 행마다 슬라이더+숫자 2개라, 숫자 입력('… 값')으로 조회.
    const tier2Input = screen.getByLabelText('출처 신뢰 계수 (Tier) Tier 2 · 신뢰 출처 값') as HTMLInputElement
    expect(tier2Input.value).toBe('0.85')

    // 1.3 선택 → tier2 0.5 로 로드
    fireEvent.change(select, { target: { value: '1.3' } })
    await waitFor(() => {
      const t2 = screen.getByLabelText('출처 신뢰 계수 (Tier) Tier 2 · 신뢰 출처 값') as HTMLInputElement
      expect(t2.value).toBe('0.5')
    })
    // 과거 버전 안내 배지
    expect(screen.getByText(/과거 버전/)).toBeInTheDocument()
  })
})
