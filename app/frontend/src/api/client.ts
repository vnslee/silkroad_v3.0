// API 클라이언트(C2) — fetch 래퍼 + 호출 메서드. 서버상태 라이브러리 없이 경량(Q6=A).
// HTML/PDF·detail GET 은 fetch 하지 않고 paths.*() URL 을 iframe src / anchor 로 직접 사용.
import { paths } from './paths'
import type {
  ChatFlow,
  ChatRequest,
  ChatResponse,
  ChatStreamHandlers,
  CountrySummary,
  Domain,
  ExistenceInfo,
  FxData,
  MapColorData,
  JobCreatedResponse,
  JobStatus,
  RegionDetailSources,
  RegionSummary,
  ReportListResponse,
  ResearchTriggerRequest,
  RulesetPayload,
  RulesetSaveResult,
  RulesetVersionInfo,
} from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    })
  } catch (e) {
    throw new ApiError(0, `네트워크 오류: ${String(e)}`)
  }
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      detail = body?.detail ?? detail
    } catch {
      /* 본문 파싱 실패는 무시 */
    }
    throw new ApiError(resp.status, detail)
  }
  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

// SSE 스트림 파서 — fetch ReadableStream을 읽어 event/data 프레임을 핸들러로 디스패치.
// 프레임 구분은 빈 줄(\n\n). 각 프레임의 `event:`/`data:` 라인을 파싱한다.
async function streamChat(req: ChatRequest, h: ChatStreamHandlers): Promise<void> {
  let resp: Response
  try {
    resp = await fetch(paths.chatStream(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(req),
    })
  } catch (e) {
    h.onError?.(`네트워크 오류: ${String(e)}`)
    return
  }
  if (!resp.ok || !resp.body) {
    h.onError?.(`HTTP ${resp.status}`)
    return
  }
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const dispatch = (frame: string) => {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (!dataLines.length) return
    let data: unknown
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    const d = data as Record<string, unknown>
    if (event === 'token') h.onToken?.(String(d.text ?? ''))
    else if (event === 'status') h.onStatus?.(String(d.tool ?? ''))
    else if (event === 'done') h.onDone(data as ChatResponse)
    else if (event === 'error') h.onError?.(String(d.detail ?? '오류'))
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      if (frame.trim()) dispatch(frame)
    }
  }
  if (buf.trim()) dispatch(buf)
}

export const api = {
  // 카탈로그
  getCountries: () => request<CountrySummary[]>(paths.countries()),
  getRegions: () => request<RegionSummary[]>(paths.regions()),
  getMapColors: () => request<MapColorData>(paths.mapColors()),
  getFx: () => request<FxData>(paths.fx()),
  getExistence: (domain: Domain, id: string) =>
    request<ExistenceInfo>(paths.existence(domain, id)),

  // 상세 데이터 스냅샷 버전 목록(P1/P2 버전 선택)
  getDetailVersions: (domain: Domain, id: string) =>
    request<string[]>(paths.detailVersions(domain, id)),
  // 권역 상세(P2) 3-소스 병합용 원시 internal 데이터(권역 소속국 자산·진출상태).
  getRegionDetailSources: (region: string) =>
    request<RegionDetailSources>(paths.regionDetailSources(region)),

  // 보고서
  listReports: (domain: Domain, id: string) =>
    request<ReportListResponse>(paths.reports(domain, id)),
  // 보고서 JSON(점수 등 데이터). Quick-win 패널이 매력도/유사도 점수 추출에 사용.
  getReportJson: <T = unknown>(domain: Domain, id: string, reportId: string) =>
    request<T>(paths.reportJson(domain, id, reportId)),
  createReport: (domain: Domain, id: string) =>
    request<JobCreatedResponse>(paths.reports(domain, id), { method: 'POST' }),

  // 잡 폴링
  getJob: (jobId: string) => request<JobStatus>(paths.job(jobId)),

  // 리서치(비동기 잡)
  triggerResearch: (domain: Domain, id: string, body?: ResearchTriggerRequest) =>
    request<JobCreatedResponse>(paths.research(domain, id), {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  // 챗봇(동기) — 스트림 미지원 환경 폴백.
  chat: (req: ChatRequest) =>
    request<ChatResponse>(paths.chat(), { method: 'POST', body: JSON.stringify(req) }),
  // 챗봇(SSE 스트림) — 답변이 타이핑되듯 흐른다. EventSource는 POST 불가 →
  // fetch ReadableStream으로 SSE(event:/data:) 프레임을 직접 파싱한다.
  chatStream: (req: ChatRequest, h: ChatStreamHandlers) =>
    streamChat(req, h),
  // 챗봇 흐름·선택지 명세(초기 케이스/관점/퀵프롬프트 칩). 흐름 SoT는 백엔드 chatbot_flow.json.
  getChatFlow: () => request<ChatFlow>(paths.chatFlow()),

  // 룰셋 설정(FR-6) — 편집 가능한 가중치/계수 조회·저장
  getRuleset: () => request<RulesetPayload>(paths.ruleset()),
  saveRuleset: (body: RulesetPayload) =>
    request<RulesetSaveResult>(paths.ruleset(), { method: 'PUT', body: JSON.stringify(body) }),
  getRulesetVersions: () => request<RulesetVersionInfo[]>(paths.rulesetVersions()),
  getRulesetVersion: (version: string) =>
    request<RulesetPayload>(paths.rulesetVersion(version)),
}
