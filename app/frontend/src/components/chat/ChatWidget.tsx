// ChatWidget(C5, FR-3, L6) — AISea C1 충실 재현.
// 다크 헤더 / 버블(유저=블루·봇=흰 카드) / 퀵프롬프트 칩 / 둥근 입력 바 / 다크 pill FAB.
// chatOpen은 store 구독(상단바 챗 버튼·FAB가 공유). 텍스트는 i18n(useT)로 한/영 전환.
// 로직(§6.5): 의도(qa/research/report) 기반 트리거·선택지 칩·상세요약 분기·권역 리서치 가드.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { ChatAction, ChatTurn, Domain, JobKind, Perspective } from '../../api/types'
import { useStore, store } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { useT } from '../../i18n/dict'

interface Pending {
  domain: Domain
  id: string
  missingCodes: string[]
}

// 칩 동작 키 → i18n 라벨 키.
const ACTION_LABEL_KEY: Record<ChatAction, string> = {
  summary: 'chat.action.summary',
  research: 'chat.action.research',
  re_research: 'chat.action.re_research',
  report: 'chat.action.report',
  re_report: 'chat.action.re_report',
}

const QUICK_PROMPT_KEYS = ['chat.quick.spain', 'chat.quick.euQuickwin']

// 초기 선택지(senario.md Case1/2/3) — 라벨 키 → 보낼 프롬프트 키.
const CASE_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'chat.case.addCountry', prompt: 'chat.case.addCountry.prompt' },
  { label: 'chat.case.explore', prompt: 'chat.case.explore.prompt' },
  { label: 'chat.case.ask', prompt: 'chat.case.ask.prompt' },
]

// 관점 선택 칩(senario.md — 비즈니스/시스템/Both).
const PERSPECTIVES: { value: Perspective; key: string }[] = [
  { value: 'business', key: 'chat.perspective.business' },
  { value: 'system', key: 'chat.perspective.system' },
  { value: 'both', key: 'chat.perspective.both' },
]

export function ChatWidget() {
  const t = useT()
  const open = useStore((s) => s.chatOpen)
  const activePopup = useStore((s) => s.activePopup)
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: 'assistant', content: t('chat.greeting') },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  // 초기 대상은 스페인이지만, 백엔드가 질문에서 식별한 대상(resolved_*)으로 매 턴 갱신한다.
  // (이전엔 고정이라 어떤 질문이든 ES 데이터로만 답하는 버그가 있었음 — §6.5)
  const [target, setTarget] = useState<{ domain: Domain; id: string }>({ domain: 'country', id: 'ES' })
  const [pending, setPending] = useState<Pending | null>(null)
  // 현재 노출 중인 선택지 칩(상세요약/리서치/보고서). resp.actions로 세팅.
  const [actions, setActions] = useState<ChatAction[]>([])
  // 상세 요약 분기 대기 — 사용자가 '상세 화면' vs '요약' 중 선택.
  const [summaryAsk, setSummaryAsk] = useState<{ domain: Domain; id: string } | null>(null)
  // 관점 선택 대기(senario.md) — 직전 질문을 보관했다가 관점 선택 시 그 관점으로 재전송.
  const [perspectiveAsk, setPerspectiveAsk] = useState<string | null>(null)
  // 챗봇 상단 진행 팝업: 리서치/보고서 트리거 시 잡 진행률을 챗봇 위에 표시.
  const [activeJob, setActiveJob] = useState<
    { jobId: string; kind: JobKind; label: string } | null
  >(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 30)
  }
  useEffect(scrollToEnd, [turns, typing])

  // 진행 중 잡 폴링 — 완료/실패 시 챗봇 안내. 잡 카드는 제거하지 않고(우상단 진행 패널이
  // 완료 상태·상세 바를 계속 보여주도록) 사용자가 패널에서 직접 닫는다.
  useJobPolling(activeJob?.jobId ?? null, {
    onDone: (result) => {
      const job = activeJob
      setActiveJob(null)
      if (job?.kind === 'research') {
        pushAssistant(t('chat.research.done'))
        setPending(null)
        // 신규/갱신 국가가 카탈로그에 반영됐으므로 지도가 마커를 재조회하도록 신호.
        store.refreshCountries()
      } else if (job?.kind === 'report') {
        const reportId =
          result && 'report_id' in result ? (result as { report_id: string }).report_id : null
        pushAssistant(
          reportId
            ? t('chat.report.doneShare').replace('{id}', reportId)
            : t('chat.report.done'),
        )
      }
    },
    onError: (msg) => {
      const kind = activeJob?.kind
      setActiveJob(null)
      pushAssistant(`${kind === 'report' ? t('chat.report.error') : t('chat.research.error')}${msg}`)
    },
  })

  function pushAssistant(content: string) {
    setTyping(false)
    setTurns((t) => [...t, { role: 'assistant', content }])
  }

  async function send(text: string) {
    if (!text.trim()) return
    const next: ChatTurn[] = [...turns, { role: 'user', content: text }]
    setTurns(next)
    setInput('')
    // 새 질문이므로 관점 선택은 매 턴 다시 묻는다(senario.md).
    await runChat(text, next, undefined)
  }

  // 실제 API 호출 + 응답 처리. send(새 질문)와 관점 칩 재전송이 공유한다.
  // perspective가 있으면 사용자 버블을 추가하지 않고(이미 질문은 보냈으므로) 그 관점으로만 답한다.
  async function runChat(text: string, history: ChatTurn[], perspective?: Perspective) {
    setTyping(true)
    setActions([])
    setSummaryAsk(null)
    setPerspectiveAsk(null)
    try {
      const resp = await api.chat({
        domain: target.domain,
        target_id: target.id,
        message: text,
        history,
        perspective,
      })
      // 백엔드가 질문에서 식별한 대상을 다음 턴 대상으로 반영(ES 고정 버그 방지, §6.5).
      const resolved =
        resp.resolved_domain && resp.resolved_target_id
          ? { domain: resp.resolved_domain, id: resp.resolved_target_id }
          : target
      if (resolved.domain !== target.domain || resolved.id !== target.id) {
        setTarget(resolved)
      }
      if (resp.answer) pushAssistant(resp.answer)
      else setTyping(false)

      // 관점 선택 필요(senario.md) → 질문을 보관하고 관점 칩 노출. 선택 시 그 관점으로 재전송.
      if (resp.needs_perspective) {
        setPerspectiveAsk(text)
        if (resp.research_suggestion) pushAssistant(resp.research_suggestion)
        return
      }

      // 명시적 의도(보유국 재리서치/보고서 생성) → 확인 없이 즉시 트리거.
      if (resp.auto_trigger && resp.needs_report) {
        if (resp.research_suggestion) pushAssistant(resp.research_suggestion)
        startReport(resolved.domain, resolved.id)
      } else if (resp.auto_trigger && resp.needs_research) {
        if (resp.research_suggestion) pushAssistant(resp.research_suggestion)
        startResearch({ domain: resolved.domain, id: resolved.id, missingCodes: resp.missing_codes })
      } else if (resp.needs_research || resp.needs_report) {
        // 확인 필요(미보유국 등) → 제안 문구 + 예/아니오 칩.
        setPending({
          domain: resolved.domain,
          id: resolved.id,
          missingCodes: resp.missing_codes,
        })
        if (resp.research_suggestion) pushAssistant(resp.research_suggestion)
      }

      // 보유국 QA → 선택지 칩 노출(상세요약/리서치 재수행/보고서).
      setActions(resp.actions ?? [])
    } catch (e) {
      pushAssistant(`${t('chat.error')}${String(e)}`)
    }
  }

  function startResearch(p: Pending) {
    // 정책: 권역 신규 리서치는 지원하지 않는다(보유 권역만 운용). 방어적 가드 — 백엔드도 403.
    if (p.domain === 'region') {
      setPending(null)
      setActions([])
      pushAssistant(t('chat.research.regionBlocked'))
      return
    }
    api
      .triggerResearch(p.domain, p.id, undefined)
      .then((job) => {
        setPending(null)
        setActions([])
        const label = `${p.id}${t('chat.jobLabel')}`
        setActiveJob({ jobId: job.job_id, kind: 'research', label })
        store.addJob({ jobId: job.job_id, kind: 'research', domain: p.domain, id: p.id, label })
        pushAssistant(t('chat.research.startedTop'))
      })
      .catch((e) => pushAssistant(`${t('chat.research.triggerError')}${String(e)}`))
  }

  function startReport(domain: Domain, id: string) {
    api
      .createReport(domain, id)
      .then((job) => {
        setActions([])
        const label = `${id}${t('chat.reportLabel')}`
        setActiveJob({ jobId: job.job_id, kind: 'report', label })
        store.addJob({ jobId: job.job_id, kind: 'report', domain, id, label })
        pushAssistant(t('chat.report.started'))
      })
      .catch((e) => pushAssistant(`${t('chat.report.triggerError')}${String(e)}`))
  }

  // 선택지 칩 클릭 처리.
  function onAction(action: ChatAction) {
    setActions([])
    if (action === 'summary') {
      // 상세 화면 vs 요약 — 사용자에게 추가 질의(요구사항).
      setSummaryAsk({ domain: target.domain, id: target.id })
      pushAssistant(t('chat.summary.ask').replace('{id}', target.id))
      return
    }
    if (action === 'research' || action === 're_research') {
      startResearch({ domain: target.domain, id: target.id, missingCodes: [] })
      return
    }
    if (action === 'report' || action === 're_report') {
      startReport(target.domain, target.id)
    }
  }

  // 관점 칩 선택(senario.md) → 보관한 질문을 그 관점으로 재전송(사용자 버블 추가 없음).
  function onPerspective(p: Perspective) {
    const text = perspectiveAsk
    setPerspectiveAsk(null)
    if (!text) return
    runChat(text, turns, p)
  }

  // 상세 요약 분기: 상세 화면 열기 / 챗봇에서 요약 받기.
  function onSummaryChoice(openDetail: boolean) {
    const ask = summaryAsk
    setSummaryAsk(null)
    if (!ask) return
    if (openDetail) {
      store.setChatOpen(false)
      window.location.hash = `#/${ask.domain}/${ask.id}/detail?mode=popup`
    } else {
      send(t('chat.summary.request').replace('{id}', ask.id))
    }
  }

  // ── FAB (다크 pill) ──
  if (!open) {
    return (
      <button
        type="button"
        aria-label={t('chat.openAria')}
        onClick={() => store.setChatOpen(true)}
        className="absolute bottom-[26px] right-[78px] z-chat flex h-[52px] animate-aisea-slide items-center gap-md rounded-full bg-primary-container pl-[18px] pr-[20px] text-on-primary shadow-[0_10px_30px_rgba(20,23,28,0.28)] transition-colors hover:bg-primary"
      >
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary">
          <span className="block h-[11px] w-[13px] rounded-[4px] border-2 border-white" />
        </span>
        <span className="font-body-md text-[14px] font-semibold">{t('chat.fab')}</span>
      </button>
    )
  }

  // 위치 — 팝업 활성 시 좌하단(§5.2), 아니면 중앙
  const wrap = activePopup
    ? 'items-end justify-start p-lg'
    : 'items-center justify-center'
  const box = activePopup
    ? 'h-[54%] min-h-[440px] w-[30%] min-w-[340px]'
    : 'h-[62%] min-h-[520px] max-h-[90%] w-[46%] min-w-[420px]'

  return (
    <div className={`pointer-events-none absolute inset-0 z-chat flex ${wrap}`}>
      <div
        role="dialog"
        aria-label={t('chat.aria')}
        className={`pointer-events-auto relative flex animate-aisea-op flex-col overflow-hidden rounded-[18px] border border-surface-border bg-surface-container-lowest shadow-[0_24px_70px_rgba(20,23,28,0.26)] ${box}`}
      >
        {/* 진행 상황은 우상단 메인 프로그레스 패널(ProgressPanel)에서 상세 표시한다. */}

        {/* 헤더 (다크) */}
        <div className="flex flex-none items-center gap-md bg-primary-container px-md py-md text-on-primary">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary">
            <span className="block h-[11px] w-[13px] rounded-[4px] border-2 border-white" />
          </div>
          <div className="flex-1">
            <div className="font-body-md text-[14px] font-bold">{t('chat.title')}</div>
            <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-primary-container">
              <span className="inline-block h-[6px] w-[6px] rounded-full bg-success" />
              {t('chat.online')}
            </div>
          </div>
          <button
            onClick={() => store.setChatOpen(false)}
            aria-label={t('chat.close')}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-on-primary-container transition-colors hover:bg-white/10"
          >
            <span className="text-[16px] leading-none">✕</span>
          </button>
        </div>

        {/* 대화 영역 */}
        <div
          ref={scrollRef}
          aria-live="polite"
          className="flex flex-1 flex-col gap-md overflow-y-auto bg-surface-light p-lg"
        >
          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-[14px] px-md py-sm font-body-sm text-[13.5px] leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-primary text-on-primary'
                    : 'border border-surface-border bg-surface-container-lowest text-on-surface'
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-[4px] rounded-[14px] border border-surface-border bg-surface-container-lowest px-md py-md">
                <span className="h-[6px] w-[6px] rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite' }} />
                <span className="h-[6px] w-[6px] rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite .2s' }} />
                <span className="h-[6px] w-[6px] rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite .4s' }} />
              </div>
            </div>
          )}
          {/* 예/아니오 확인(미보유국 리서치 등). 거절 시 보유국 한정 안내. */}
          {pending && !activeJob && !summaryAsk && (
            <div className="flex gap-sm">
              <button
                className="rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary"
                onClick={() => startResearch(pending)}
              >
                {t('chat.research.yes')}
              </button>
              <button
                className="rounded-full bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant"
                onClick={() => {
                  setPending(null)
                  pushAssistant(t('chat.research.declined'))
                }}
              >
                {t('chat.research.no')}
              </button>
            </div>
          )}

          {/* 관점 선택(senario.md): 비즈니스 / 시스템 / 둘 다 */}
          {perspectiveAsk && !activeJob && !pending && (
            <div className="flex flex-wrap gap-sm">
              {PERSPECTIVES.map((p) => (
                <button
                  key={p.value}
                  className="rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary"
                  onClick={() => onPerspective(p.value)}
                >
                  {t(p.key)}
                </button>
              ))}
            </div>
          )}

          {/* 상세 요약 분기: 상세 화면 / 요약 */}
          {summaryAsk && !activeJob && (
            <div className="flex gap-sm">
              <button
                className="rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary"
                onClick={() => onSummaryChoice(true)}
              >
                {t('chat.summary.openDetail')}
              </button>
              <button
                className="rounded-full bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant"
                onClick={() => onSummaryChoice(false)}
              >
                {t('chat.summary.getSummary')}
              </button>
            </div>
          )}

          {/* 선택지 칩(보유국 QA): 상세요약 / 리서치(재)수행 / 보고서(재)생성 */}
          {actions.length > 0 && !pending && !summaryAsk && !perspectiveAsk && !activeJob && (
            <div className="flex flex-wrap gap-xs">
              {actions.map((a) => (
                <button
                  key={a}
                  onClick={() => onAction(a)}
                  className="rounded-full border border-primary/30 bg-primary-fixed px-md py-xs font-label-md text-label-md text-primary transition-colors hover:bg-primary-fixed-dim"
                >
                  {t(ACTION_LABEL_KEY[a])}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 하단: 퀵프롬프트 + 입력 */}
        <div className="flex-none border-t border-surface-border bg-surface-container-lowest px-md py-sm">
          {turns.length <= 1 && (
            <>
              {/* 초기 선택지(senario.md Case1/2/3) */}
              <div className="mb-sm flex flex-wrap gap-xs">
                {CASE_PROMPTS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => send(t(c.prompt))}
                    className="rounded-full border border-primary/30 bg-primary-fixed px-md py-xs font-label-md text-label-md text-primary transition-colors hover:bg-primary-fixed-dim"
                  >
                    {t(c.label)}
                  </button>
                ))}
              </div>
              <div className="mb-sm flex flex-wrap gap-xs">
                {QUICK_PROMPT_KEYS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(t(q))}
                    className="rounded-[9px] bg-primary-fixed px-md py-xs font-body-sm text-[12px] font-medium leading-snug text-primary transition-colors hover:bg-primary-fixed-dim"
                  >
                    {t(q)}
                  </button>
                ))}
              </div>
            </>
          )}
          <form
            className="flex items-center gap-sm rounded-[12px] bg-surface-container py-[5px] pl-md pr-[5px]"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              className="flex-1 bg-transparent font-body-sm text-[13.5px] text-on-surface outline-none placeholder:text-outline"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              aria-label={t('chat.inputAria')}
            />
            <button
              type="submit"
              aria-label={t('chat.send')}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-primary text-[15px] text-on-primary transition-colors hover:bg-inverse-primary"
            >
              ↑
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
