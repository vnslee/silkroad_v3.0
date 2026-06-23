// useJobPolling(C10, L3) — 잡 폴링 추상화. 3 kind(research/detail/report) 공용.
// 고정 간격(1.5s) + terminal(succeeded/failed) 중단 + 언마운트 정리 + 네트워크 3회 재시도(Q2=A).
import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { JobResultUnion, JobState, JobStep } from '../api/types'

const INTERVAL_MS = 1500
const MAX_RETRY = 3

export interface JobPollingState {
  status: JobState | 'idle'
  step: JobStep | null
  percent: number
  result: JobResultUnion | null
  error: string | null
}

const IDLE: JobPollingState = {
  status: 'idle',
  step: null,
  percent: 0,
  result: null,
  error: null,
}

interface Options {
  onDone?: (result: JobResultUnion | null) => void
  onError?: (error: string) => void
  intervalMs?: number
}

export function useJobPolling(jobId: string | null, opts: Options = {}): JobPollingState {
  const [state, setState] = useState<JobPollingState>(IDLE)
  // 콜백은 ref 로 최신값 유지(폴링 effect 재시작 방지)
  const cbRef = useRef(opts)
  cbRef.current = opts

  useEffect(() => {
    if (!jobId) {
      setState(IDLE)
      return
    }
    let cancelled = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      try {
        const job = await api.getJob(jobId)
        if (cancelled) return
        retry = 0
        setState({
          status: job.status,
          step: job.step,
          percent: job.percent,
          result: job.result ?? null,
          error: job.error ?? null,
        })
        if (job.status === 'succeeded') {
          cbRef.current.onDone?.(job.result ?? null)
          return // 폴링 중단
        }
        if (job.status === 'failed') {
          cbRef.current.onError?.(job.error ?? '잡 실패')
          return // 폴링 중단
        }
        timer = setTimeout(tick, opts.intervalMs ?? INTERVAL_MS)
      } catch (e) {
        if (cancelled) return
        retry += 1
        if (retry > MAX_RETRY) {
          const msg = e instanceof ApiError ? e.message : String(e)
          setState((s) => ({ ...s, status: 'failed', error: msg }))
          cbRef.current.onError?.(msg)
          return
        }
        timer = setTimeout(tick, opts.intervalMs ?? INTERVAL_MS)
      }
    }

    setState({ ...IDLE, status: 'queued' })
    tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  return state
}
