// AppShell(C1) — 라우팅·진입 모드 컨테이너 선택·전역 레이아웃·딥링크 인트로 스킵(L1·L2).
import { lazy, Suspense, useEffect, useState } from 'react'
import { useRoute } from './app/useRoute'
import { isDeepLink } from './app/route'
import { PopupContainer } from './app/containers/PopupContainer'
import { FullscreenContainer } from './app/containers/FullscreenContainer'
import { GlobeIntro } from './components/map/GlobeIntro'
import { MapView } from './components/map/MapView'
import { ChatWidget } from './components/chat/ChatWidget'
import { ProgressPanel } from './components/progress/ProgressPanel'

// 라우트 화면 코드 스플리팅(NFR Q3=A)
const DetailView = lazy(() => import('./components/detail/DetailView'))
const ReportView = lazy(() => import('./components/report/ReportView'))
const RulesetForm = lazy(() => import('./components/ruleset/RulesetForm'))

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

export default function App() {
  const { route, navigate, goHome } = useRoute()
  // 인트로(지구본) 스킵 조건: ① 딥링크 진입 ② CI/로고로 지도 복귀(skipIntro 플래그) — 둘 다 지도부터.
  // ⚠️ 이니셜라이저는 순수해야 한다(부수효과 금지). StrictMode(dev)는 useState 이니셜라이저를
  //    2번 호출하므로, 여기서 removeItem 하면 1차 호출이 플래그를 지워 2차 호출이 false를 반환 →
  //    skipIntro가 무시되고 지구본이 다시 뜬다. 플래그 소비는 아래 useEffect로 분리.
  const [introDone, setIntroDone] = useState(() => {
    if (typeof window === 'undefined') return false
    if (isDeepLink(window.location.hash)) return true
    return sessionStorage.getItem('skipIntro') === '1'
  })

  // skipIntro 플래그 소비(1회성) — 마운트 후 제거. 이니셜라이저 밖이라 StrictMode 이중 호출 영향 없음.
  useEffect(() => {
    if (typeof window !== 'undefined') sessionStorage.removeItem('skipIntro')
  }, [])
  // 인트로를 실제로 본 경우에만 지도 줌인 모핑(딥링크·reduced-motion 진입은 정적)
  const [mapEnter, setMapEnter] = useState(false)

  if (!introDone) {
    return (
      <GlobeIntro
        reducedMotion={prefersReducedMotion()}
        onDone={() => {
          if (!prefersReducedMotion()) setMapEnter(true)
          setIntroDone(true)
        }}
      />
    )
  }

  // 화면(모드 무지) — 컨테이너가 모드로 래핑(Q2=A)
  const overlay = route.screen !== 'map' && (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-xl font-body-md text-on-surface-variant">
          로딩 중…
        </div>
      }
    >
      {route.screen === 'detail' && route.domain && route.id && (
        <DetailView domain={route.domain} code={route.id} mode={route.mode} />
      )}
      {route.screen === 'report' && route.domain && route.id && (
        <ReportView domain={route.domain} code={route.id} reportId={route.reportId} mode={route.mode} />
      )}
      {route.screen === 'ruleset' && <RulesetForm />}
    </Suspense>
  )

  // AISea 모달 상단 스트립 — route 기준 태그/타이틀(P1=국가 정보·PR1=국가 진단 보고서 등)
  const frame = modalFrame(route)

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView
        enterAnim={mapEnter}
        onSelectCountry={(code) => navigate({ screen: 'detail', domain: 'country', id: code, mode: 'popup' })}
        onSelectRegion={(region) => navigate({ screen: 'detail', domain: 'region', id: region, mode: 'popup' })}
      />

      {overlay && route.mode === 'popup' && (
        <PopupContainer onClose={goHome} tag={frame.tag} tagClass={frame.tagClass} title={frame.title}>
          {overlay}
        </PopupContainer>
      )}
      {overlay && route.mode === 'fullscreen' && (
        <FullscreenContainer onBack={goHome} tag={frame.tag} tagClass={frame.tagClass} title={frame.title}>
          {overlay}
        </FullscreenContainer>
      )}

      <ProgressPanel />
      <ChatWidget />
    </div>
  )
}

// route → 모달 스트립 태그/타이틀. 데이터(국가명 등)는 뷰 자체 헤더가 담당하므로 여기선 분류 라벨만.
function modalFrame(route: ReturnType<typeof useRoute>['route']): {
  tag: string
  tagClass: string
  title: string
} {
  if (route.screen === 'ruleset') return { tag: '룰셋 설정', tagClass: 'bg-text-secondary', title: '진단 룰셋 설정' }
  const isCountry = route.domain === 'country'
  if (route.screen === 'report')
    return {
      tag: isCountry ? '국가 진단 보고서' : '권역 진단 보고서',
      tagClass: 'bg-primary',
      title: isCountry ? '국가 진단 보고서' : '권역 진단 보고서',
    }
  // detail
  return {
    tag: isCountry ? '국가 정보' : '권역 정보',
    tagClass: 'bg-primary',
    title: isCountry ? '국가 상세' : '권역 상세',
  }
}
