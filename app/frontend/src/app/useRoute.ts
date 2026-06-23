// hashchange 구독 훅 + 네비게이션 헬퍼.
import { useCallback, useEffect, useState } from 'react'
import { buildHash, HOME, parseHashRoute, type RouteState } from './route'

export function useRoute(): {
  route: RouteState
  navigate: (r: RouteState) => void
  goHome: () => void
} {
  const [route, setRoute] = useState<RouteState>(() =>
    typeof window !== 'undefined' ? parseHashRoute(window.location.hash) : HOME,
  )

  useEffect(() => {
    const onChange = () => setRoute(parseHashRoute(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((r: RouteState) => {
    window.location.hash = buildHash(r)
  }, [])

  const goHome = useCallback(() => {
    window.location.hash = '#/'
  }, [])

  return { route, navigate, goHome }
}
