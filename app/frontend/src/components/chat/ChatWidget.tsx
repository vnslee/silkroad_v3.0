// ChatWidget(C5, FR-3, L6) — AISea C1 충실 재현.
// 다크 헤더 / 버블(유저=블루·봇=흰 카드) / 퀵프롬프트 칩 / 둥근 입력 바 / 다크 pill FAB.
// chatOpen은 store 구독(상단바 챗 버튼·FAB가 공유). API/needs_research/리서치+폴링 로직 불변(§5.2).
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { ChatTurn, Domain } from '../../api/types'
import { useStore, store } from '../../store'
import { useJobPolling } from '../../hooks/useJobPolling'
import { useT } from '../../i18n/dict'

interface Pending {
  domain: Domain
  id: string
  missingCodes: string[]
}

// 퀵프롬프트 — i18n 키로 정의(렌더 시 t()로 현재 언어 표시).
const QUICK_PROMPT_KEYS = ['chat.quick.spain', 'chat.quick.euQuickwin']

export function ChatWidget() {
  const t = useT()
  const open = useStore((s) => s.chatOpen)
  const activePopup = useStore((s) => s.activePopup)
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: 'assistant', content: t('chat.greeting') },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [target] = useState<{ domain: Domain; id: string }>({ domain: 'country', id: 'ES' })
  const [pending, setPending] = useState<Pending | null>(null)
  const [researchJob, setResearchJob] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = () => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 30)
  }
  useEffect(scrollToEnd, [turns, typing])

  useJobPolling(researchJob, {
    onDone: () => {
      store.removeJob(researchJob ?? '')
      setResearchJob(null)
      pushAssistant(t('chat.research.done'))
      setPending(null)
    },
    onError: (msg) => {
      setResearchJob(null)
      pushAssistant(`${t('chat.research.error')}${msg}`)
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
    setTyping(true)
    try {
      const resp = await api.chat({
        domain: target.domain,
        target_id: target.id,
        message: text,
        history: next,
      })
      if (resp.answer) pushAssistant(resp.answer)
      else setTyping(false)
      if (resp.needs_research) {
        // 백엔드가 질문에서 식별한 대상 우선(§6.5), 없으면 기존 target 폴백.
        setPending({
          domain: resp.resolved_domain ?? target.domain,
          id: resp.resolved_target_id ?? target.id,
          missingCodes: resp.missing_codes,
        })
        pushAssistant(resp.research_suggestion ?? t('chat.research.fallbackPrompt'))
      }
    } catch (e) {
      pushAssistant(`${t('chat.error')}${String(e)}`)
    }
  }

  function startResearch() {
    if (!pending) return
    const body = pending.domain === 'region' ? { member_codes: pending.missingCodes } : undefined
    api
      .triggerResearch(pending.domain, pending.id, body)
      .then((job) => {
        setResearchJob(job.job_id)
        store.addJob({
          jobId: job.job_id,
          kind: 'research',
          domain: pending.domain,
          id: pending.id,
          label: `${pending.id}${t('chat.jobLabel')}`,
        })
        pushAssistant(t('chat.research.started'))
      })
      .catch((e) => pushAssistant(`${t('chat.research.triggerError')}${String(e)}`))
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
        className={`pointer-events-auto flex animate-aisea-op flex-col overflow-hidden rounded-[18px] border border-surface-border bg-surface-container-lowest shadow-[0_24px_70px_rgba(20,23,28,0.26)] ${box}`}
      >
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
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-[14px] px-md py-sm font-body-sm text-[13.5px] leading-relaxed ${
                  t.role === 'user'
                    ? 'bg-primary text-on-primary'
                    : 'border border-surface-border bg-surface-container-lowest text-on-surface'
                }`}
              >
                {t.content}
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
          {pending && !researchJob && (
            <div className="flex gap-sm">
              <button
                className="rounded-full bg-primary px-md py-sm font-label-md text-label-md text-on-primary"
                onClick={startResearch}
              >
                {t('chat.research.yes')}
              </button>
              <button
                className="rounded-full bg-surface-container px-md py-sm font-label-md text-label-md text-on-surface-variant"
                onClick={() => setPending(null)}
              >
                {t('chat.research.no')}
              </button>
            </div>
          )}
        </div>

        {/* 하단: 퀵프롬프트 + 입력 */}
        <div className="flex-none border-t border-surface-border bg-surface-container-lowest px-md py-sm">
          {turns.length <= 1 && (
            <div className="mb-sm flex flex-wrap gap-xs">
              {QUICK_PROMPT_KEYS.map((key) => {
                const q = t(key)
                return (
                  <button
                    key={key}
                    onClick={() => send(q)}
                    className="rounded-[9px] bg-primary-fixed px-md py-xs font-body-sm text-[12px] font-medium leading-snug text-primary transition-colors hover:bg-primary-fixed-dim"
                  >
                    {q}
                  </button>
                )
              })}
            </div>
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
