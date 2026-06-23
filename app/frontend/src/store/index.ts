// 전역 상태(C12) — 경량(외부 라이브러리 없이 useSyncExternalStore, Q6=A).
// 진입 모드·활성 팝업·진행 중 잡·언어. 컴포넌트는 useStore 셀렉터로 구독.
import { useSyncExternalStore } from 'react'
import type { Domain, JobKind } from '../api/types'

export type Lang = 'ko' | 'en'

export interface JobRef {
  jobId: string
  kind: JobKind
  domain: Domain
  id: string
  label: string
}

interface AppState {
  activePopup: boolean // §5.2 챗봇 위치 규칙
  activeJobs: JobRef[] // §5.3 프로그레스 카드 노출 판단
  lang: Lang
  chatOpen: boolean // FAB·챗 패널이 공유
  // 카탈로그(국가/권역) 갱신 신호. 리서치 완료 시 증가 → 지도가 마커를 재조회한다.
  countriesVersion: number
}

let state: AppState = {
  activePopup: false,
  activeJobs: [],
  lang: 'ko',
  chatOpen: false,
  countriesVersion: 0,
}

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  emit()
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => state,

  setActivePopup: (v: boolean) => setState({ activePopup: v }),
  setLang: (lang: Lang) => setState({ lang }),
  setChatOpen: (chatOpen: boolean) => setState({ chatOpen }),
  toggleChat: () => setState({ chatOpen: !state.chatOpen }),

  addJob(ref: JobRef) {
    if (state.activeJobs.some((j) => j.jobId === ref.jobId)) return
    setState({ activeJobs: [...state.activeJobs, ref] })
  },
  removeJob(jobId: string) {
    setState({ activeJobs: state.activeJobs.filter((j) => j.jobId !== jobId) })
  },
  // 리서치 완료 등으로 카탈로그가 바뀌었을 때 호출 → 구독 중인 지도가 마커를 재조회.
  refreshCountries: () => setState({ countriesVersion: state.countriesVersion + 1 }),
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()))
}
