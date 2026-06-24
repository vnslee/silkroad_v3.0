// ChatWidget(C5, FR-3, L6) — AISea C1 mockup 충실 재현.
// 봇/유저 아바타 + 버블 꼬리 / 라이트 헤더(부제 라벨) / 인라인 선택지 칩(대화 흐름 내) /
// Material Symbols 아이콘 입력 바 / pill FAB. 색·타이포는 DESIGN.md(잉크블랙+라임) 토큰.
// chatOpen은 store 구독(상단바 챗 버튼·FAB가 공유). 텍스트는 i18n(useT)로 한/영 전환.
// 로직(§6.5): 의도(qa/research/report) 기반 트리거·선택지 칩·상세요약 분기·권역 리서치 가드.
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../../api/client'
import type { ChatAction, ChatFlow, ChatResponse, ChatTurn, Domain, JobKind, Perspective } from '../../api/types'
import { useStore, store } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { useT } from '../../i18n/dict'
import { Icon } from '../common/Icon'

interface Pending {
  domain: Domain
  id: string
  missingCodes: string[]
}

// 흐름·선택지 SoT는 백엔드 chatbot_flow.json(GET /api/chat/flow). 아래는 fetch 실패 시
// 폴백 기본값 — 네트워크 오류로 흐름을 못 받아도 챗봇이 정상 동작하도록 한다(회귀 없음).
const FALLBACK_FLOW: ChatFlow = {
  cases: [
    { id: 'addCountry', labelKey: 'chat.case.addCountry', promptKey: 'chat.case.addCountry.prompt' },
    { id: 'explore', labelKey: 'chat.case.explore', promptKey: 'chat.case.explore.prompt' },
    { id: 'ask', labelKey: 'chat.case.ask', promptKey: 'chat.case.ask.prompt' },
  ],
  perspectives: [
    { value: 'business', labelKey: 'chat.perspective.business' },
    { value: 'system', labelKey: 'chat.perspective.system' },
    { value: 'both', labelKey: 'chat.perspective.both' },
  ],
  quickPrompts: ['chat.quick.spain', 'chat.quick.euQuickwin'],
  actionLabels: {
    summary: 'chat.action.summary',
    research: 'chat.action.research',
    re_research: 'chat.action.re_research',
    report: 'chat.action.report',
    re_report: 'chat.action.re_report',
  },
}

// 봇 아바타(원형, 잉크블랙 컨테이너 + smart_toy). 메시지·인라인 칩이 공유한다.
function BotAvatar() {
  return (
    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-container">
      <Icon name="smart_toy" filled className="text-[18px] text-on-primary-container" />
    </div>
  )
}

// 인라인 선택지 행 — 봇 아바타와 정렬해 '봇이 제시한 선택지'로 읽히게 대화 흐름 안에 둔다.
// variant: 'primary'=강조 채움 칩(예/아니오·관점·요약), 'soft'=라임 톤 액션 칩.
function ChipRow({
  children,
  ariaLabel,
}: {
  children: ReactNode
  ariaLabel: string
}) {
  return (
    <div className="flex gap-md">
      <BotAvatar />
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex max-w-[85%] flex-wrap gap-xs pt-0.5"
      >
        {children}
      </div>
    </div>
  )
}

// 강조(채움) 칩 — 잉크블랙 배경. 예/아니오·관점·상세요약 분기처럼 '지금 답해야 할' 선택.
const SOLID_CHIP =
  'rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary shadow-[0_2px_6px_rgba(20,24,28,0.16)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest motion-reduce:transition-none motion-reduce:hover:translate-y-0'
// 보조(아웃라인) 칩 — '아니오'·'요약으로 받기' 같은 약한 대안.
const GHOST_CHIP =
  'rounded-full border border-surface-border bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest'
// 라임 톤 액션 칩 — 상세요약/리서치/보고서 등 보유국 QA 후속 액션.
const ACCENT_CHIP =
  'inline-flex items-center gap-1 rounded-full border border-on-primary-fixed-variant/20 bg-primary-fixed px-md py-xs font-label-md text-label-md text-on-primary-fixed transition-colors hover:bg-primary-fixed-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest'

export function ChatWidget() {
  const t = useT()
  const open = useStore((s) => s.chatOpen)
  const activePopup = useStore((s) => s.activePopup)
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: 'assistant', content: t('chat.greeting') },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  // 흐름·선택지 명세(초기 케이스/관점/퀵프롬프트 칩). 백엔드 GET /api/chat/flow에서 받되,
  // 실패 시 폴백 기본값으로 동작. 마운트 시 1회 fetch.
  const [flow, setFlow] = useState<ChatFlow>(FALLBACK_FLOW)
  // 보유국 QA 답변과 함께 받은 후속 추천 질문(탐색용 칩). 다음 질문 전송 시 초기화.
  const [suggestions, setSuggestions] = useState<string[]>([])
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

  // 흐름 명세 1회 fetch — 실패 시 폴백 기본값 유지(회귀 없음).
  useEffect(() => {
    api
      .getChatFlow()
      .then((f) => setFlow(f))
      .catch(() => {
        /* 폴백 FALLBACK_FLOW 유지 */
      })
  }, [])

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

  // 실제 API 호출 + 응답 처리(SSE 스트림). send(새 질문)와 관점 칩 재전송이 공유한다.
  // perspective가 있으면 사용자 버블을 추가하지 않고(이미 질문은 보냈으므로) 그 관점으로만 답한다.
  // 토큰은 스트리밍 버블에 누적하고, done 이벤트의 플래그로 칩·트리거를 분기한다(기존 로직 보존).
  async function runChat(text: string, history: ChatTurn[], perspective?: Perspective) {
    setTyping(true)
    setActions([])
    setSummaryAsk(null)
    setPerspectiveAsk(null)
    setSuggestions([])
    // 스트리밍 버블 — 첫 토큰 도착 시 생성하고 이후 델타를 누적한다.
    let streamingIdx = -1
    let acc = ''
    const ensureBubble = () => {
      if (streamingIdx >= 0) return
      setTyping(false)
      setTurns((prev) => {
        streamingIdx = prev.length
        return [...prev, { role: 'assistant', content: '' }]
      })
    }
    const appendToken = (chunk: string) => {
      ensureBubble()
      acc += chunk
      setTurns((prev) => {
        if (streamingIdx < 0 || streamingIdx >= prev.length) return prev
        const next = [...prev]
        next[streamingIdx] = { role: 'assistant', content: acc }
        return next
      })
    }

    const onDone = (resp: ChatResponse) => {
      // 백엔드가 식별한 대상을 다음 턴 대상으로 반영(ES 고정 버그 방지, §6.5).
      const resolved =
        resp.resolved_domain && resp.resolved_target_id
          ? { domain: resp.resolved_domain, id: resp.resolved_target_id }
          : target
      if (resolved.domain !== target.domain || resolved.id !== target.id) {
        setTarget(resolved)
      }

      // 답변 텍스트 확정 — done.answer가 스트림 누적과 다르면 done 값을 신뢰(권위).
      // 스트림 토큰이 없었는데 done.answer가 있으면 새 버블로 표시.
      if (resp.answer && resp.answer !== acc) {
        if (streamingIdx >= 0) {
          setTurns((prev) => {
            const next = [...prev]
            next[streamingIdx] = { role: 'assistant', content: resp.answer as string }
            return next
          })
        } else {
          pushAssistant(resp.answer)
        }
      } else if (!resp.answer && streamingIdx >= 0 && !acc) {
        // 답변 없는 분기(관점/트리거 등)인데 빈 버블이 생겼으면 제거.
        setTurns((prev) => prev.filter((_, i) => i !== streamingIdx))
      }
      setTyping(false)

      // 어디에도 안 걸리는 차단성 응답(needs_* 모두 false·answer 없음)은 제안 문구를 표시.
      const willHandleSuggestion =
        resp.needs_perspective || resp.auto_trigger || resp.needs_research || resp.needs_report
      if (!resp.answer && resp.research_suggestion && !willHandleSuggestion) {
        pushAssistant(resp.research_suggestion)
      }

      // 관점 선택 필요(senario.md) → 질문을 보관하고 관점 칩 노출.
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
        setPending({ domain: resolved.domain, id: resolved.id, missingCodes: resp.missing_codes })
        if (resp.research_suggestion) pushAssistant(resp.research_suggestion)
      }

      // 보유국 QA → 선택지 칩 + 후속 추천 질문.
      setActions(resp.actions ?? [])
      setSuggestions(resp.suggested_prompts ?? [])
    }

    await api.chatStream(
      { domain: target.domain, target_id: target.id, message: text, history, perspective },
      {
        onToken: appendToken,
        onDone,
        onError: (detail) => {
          if (streamingIdx < 0) pushAssistant(`${t('chat.error')}${detail}`)
        },
      },
    )
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

  // ── FAB (잉크블랙 pill + 라임 아바타) ──
  if (!open) {
    return (
      <button
        type="button"
        aria-label={t('chat.openAria')}
        onClick={() => store.setChatOpen(true)}
        className="absolute bottom-[26px] right-[78px] z-chat flex h-[52px] animate-aisea-slide items-center gap-sm rounded-full bg-primary pl-[8px] pr-[20px] text-on-primary shadow-[0_10px_30px_rgba(20,23,28,0.28)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inverse-primary text-primary">
          <Icon name="smart_toy" filled className="text-[20px]" />
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

        {/* 헤더 — 라이트 표면 + 아바타 + 부제 라벨(C1 mockup) */}
        <div className="flex flex-none items-center justify-between border-b border-surface-border px-lg py-md">
          <div className="flex items-center gap-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container">
              <Icon name="smart_toy" filled className="text-[22px] text-on-primary-container" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold leading-tight text-primary">
                {t('chat.title')}
              </h2>
              <p className="mt-0.5 flex items-center gap-xs font-label-sm text-label-sm uppercase tracking-widest text-text-secondary">
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-success" />
                {t('chat.online')}
              </p>
            </div>
          </div>
          <button
            onClick={() => store.setChatOpen(false)}
            aria-label={t('chat.close')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-variant hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* 대화 영역 */}
        <div
          ref={scrollRef}
          aria-live="polite"
          className="flex flex-1 flex-col gap-lg overflow-y-auto bg-surface-light p-lg"
        >
          {turns.map((turn, i) =>
            turn.role === 'user' ? (
              <div key={i} className="flex max-w-[85%] flex-row-reverse gap-md self-end">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container">
                  <Icon name="person" filled className="text-[18px] text-on-secondary-container" />
                </div>
                <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-md py-sm font-body-sm text-[13.5px] leading-relaxed text-on-primary shadow-[0_4px_8px_rgba(20,24,28,0.12)]">
                  {turn.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex max-w-[85%] gap-md">
                <BotAvatar />
                <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-surface-border bg-surface-container-lowest px-md py-sm font-body-sm text-[13.5px] leading-relaxed text-on-surface shadow-[0_4px_8px_rgba(20,24,28,0.05)]">
                  {turn.content}
                </div>
              </div>
            ),
          )}
          {typing && (
            <div className="flex gap-md">
              <BotAvatar />
              <div className="flex items-center gap-[5px] rounded-2xl rounded-tl-sm border border-surface-border bg-surface-container-lowest px-lg py-md shadow-[0_4px_8px_rgba(20,24,28,0.05)]">
                <span className="h-2 w-2 rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite' }} />
                <span className="h-2 w-2 rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite .2s' }} />
                <span className="h-2 w-2 rounded-full bg-outline" style={{ animation: 'aisea-pulse 1s infinite .4s' }} />
              </div>
            </div>
          )}
          {/* 선택지는 모두 대화 흐름 안(봇 아바타와 정렬)에 인라인으로 노출한다. */}

          {/* 초기 선택지(senario.md Case1/2/3) — 첫 화면, 인사말 아래 대화 흐름에 노출 */}
          {turns.length <= 1 && !typing && !activeJob && (
            <ChipRow ariaLabel={t('chat.case.ask')}>
              {flow.cases.map((c) => (
                <button key={c.id} onClick={() => send(t(c.promptKey))} className={ACCENT_CHIP}>
                  {t(c.labelKey)}
                </button>
              ))}
            </ChipRow>
          )}

          {/* 예/아니오 확인(미보유국 리서치 등). 거절 시 보유국 한정 안내. */}
          {pending && !activeJob && !summaryAsk && (
            <ChipRow ariaLabel={t('chat.research.fallbackPrompt')}>
              <button className={SOLID_CHIP} onClick={() => startResearch(pending)}>
                {t('chat.research.yes')}
              </button>
              <button
                className={GHOST_CHIP}
                onClick={() => {
                  setPending(null)
                  pushAssistant(t('chat.research.declined'))
                }}
              >
                {t('chat.research.no')}
              </button>
            </ChipRow>
          )}

          {/* 관점 선택(senario.md): 비즈니스 / 시스템 / 둘 다 */}
          {perspectiveAsk && !activeJob && !pending && (
            <ChipRow ariaLabel={t('chat.perspective.ask')}>
              {flow.perspectives.map((p) => (
                <button key={p.value} className={SOLID_CHIP} onClick={() => onPerspective(p.value)}>
                  {t(p.labelKey)}
                </button>
              ))}
            </ChipRow>
          )}

          {/* 상세 요약 분기: 상세 화면 / 요약 */}
          {summaryAsk && !activeJob && (
            <ChipRow ariaLabel={t('chat.summary.ask').replace('{id}', summaryAsk.id)}>
              <button className={SOLID_CHIP} onClick={() => onSummaryChoice(true)}>
                {t('chat.summary.openDetail')}
              </button>
              <button className={GHOST_CHIP} onClick={() => onSummaryChoice(false)}>
                {t('chat.summary.getSummary')}
              </button>
            </ChipRow>
          )}

          {/* 선택지 칩(보유국 QA): 상세요약 / 리서치(재)수행 / 보고서(재)생성 */}
          {actions.length > 0 && !pending && !summaryAsk && !perspectiveAsk && !activeJob && (
            <ChipRow ariaLabel={t('chat.action.summary')}>
              {actions.map((a) => (
                <button key={a} onClick={() => onAction(a)} className={ACCENT_CHIP}>
                  {t(flow.actionLabels[a])}
                </button>
              ))}
            </ChipRow>
          )}

          {/* 후속 추천 질문(senario.md 틀 안) — 탐색용 보조 칩. 클릭 시 그대로 재질문. */}
          {suggestions.length > 0 && !pending && !summaryAsk && !perspectiveAsk && !activeJob && (
            <ChipRow ariaLabel={t('chat.suggestions.aria')}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => send(s)} className={GHOST_CHIP}>
                  {s}
                </button>
              ))}
            </ChipRow>
          )}
        </div>

        {/* 하단: 퀵프롬프트 + 입력 (C1 mockup: 입력 바 우측에 send 아이콘, 푸터 disclaimer) */}
        <div className="flex-none border-t border-surface-border bg-surface-container-lowest px-lg py-md shadow-[0_-4px_12px_rgba(20,24,28,0.04)]">
          {turns.length <= 1 && (
            <div className="mb-md flex flex-wrap gap-xs">
              {flow.quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(t(q))}
                  className="rounded-full border border-surface-border bg-surface-container px-md py-xs font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest"
                >
                  {t(q)}
                </button>
              ))}
            </div>
          )}
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              className="h-[48px] w-full rounded-full border border-surface-border bg-surface-light pl-lg pr-[52px] font-body-sm text-[13.5px] text-on-surface outline-none transition-colors placeholder:text-text-disabled focus:border-primary focus:ring-1 focus:ring-primary"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              aria-label={t('chat.inputAria')}
            />
            <button
              type="submit"
              aria-label={t('chat.send')}
              disabled={!input.trim()}
              className="absolute right-[6px] top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_2px_4px_rgba(20,24,28,0.16)] transition-colors hover:bg-primary-container disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest"
            >
              <Icon name="send" className="text-[18px]" />
            </button>
          </form>
          <p className="mt-sm text-center font-label-sm text-label-sm text-text-disabled">
            {t('chat.disclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
