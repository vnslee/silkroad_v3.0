// AppShell(C1) — 라우팅·진입 모드 컨테이너 선택·전역 레이아웃·딥링크 인트로 스킵(L1·L2).
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRoute } from './app/useRoute'
import { isDeepLink } from './app/route'
import { PopupContainer } from './app/containers/PopupContainer'
import { FullscreenContainer } from './app/containers/FullscreenContainer'
import { GlobeIntro } from './components/map/GlobeIntro'
import { MapView } from './components/map/MapView'
import { ChatWidget } from './components/chat/ChatWidget'
import { ProgressPanel } from './components/progress/ProgressPanel'
import { LanguageSelectorDropdown } from './components/ui/language-selector-dropdown'
import { useT } from './i18n/dict'

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
  const t = useT()
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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('skipIntro')
      sessionStorage.removeItem('mapAnim')
    }
  }, [])
  // 지도 줌아웃→줌인 진입 모핑 여부. 인트로를 실제로 본 경우(아래 onDone) 또는 CI 로고로
  // 인트로를 스킵하되 모션은 원하는 경우(mapAnim 플래그) true. 딥링크·reduced-motion은 정적.
  const [mapEnter, setMapEnter] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('mapAnim') === '1' && !prefersReducedMotion()
  })
  // 진입 줌아웃 시작 배율: CI 로고 복귀(mapAnim)=1.3으로 얕게, 인트로(지구본)=3.4로 깊게.
  const [mapEnterScale, setMapEnterScale] = useState(() => {
    if (typeof window === 'undefined') return 3.4
    return sessionStorage.getItem('mapAnim') === '1' ? 1.3 : 3.4
  })

  // MapView에 넘기는 콜백은 안정 참조여야 한다 — 매 렌더 새 함수면 MapView 빌드 effect가 재실행돼
  // (deps에 포함) 진행 중인 확대 트랜지션이 끊긴다. navigate는 useRoute에서 이미 안정.
  const selectCountry = useCallback(
    (code: string) => navigate({ screen: 'detail', domain: 'country', id: code, mode: 'popup' }),
    [navigate],
  )
  const selectRegion = useCallback(
    (region: string) => navigate({ screen: 'detail', domain: 'region', id: region, mode: 'popup' }),
    [navigate],
  )

  // 팝업은 지도 확대(focus 줌)가 끝난 뒤에 띄운다 — '지역으로 확대되는 모습'을 먼저 보여주려고.
  // 단, 지연은 '지도에서 새로 진입(지도 확대가 실제로 일어남)'할 때만. 이미 팝업이 떠 있는 상태의
  // 전환(상세↔보고서, 같은 지역 detail→report)은 지도 확대가 없으므로 즉시 띄운다.
  // fullscreen·ruleset(지도 안 보임)·reduced-motion도 즉시. 닫힘은 항상 즉시.
  // ⚠️ 훅은 introDone early-return 앞에서 호출해야 함(훅 순서 고정).
  const isPopupDetail =
    route.mode === 'popup' && (route.screen === 'detail' || route.screen === 'report')
  const [popupReady, setPopupReady] = useState(false)
  const popupOpenRef = useRef(false) // 직전 프레임에 팝업이 떠 있었는지 — 전환 vs 신규진입 구분
  useEffect(() => {
    if (!isPopupDetail) {
      setPopupReady(true)
      popupOpenRef.current = false // 닫힘 → 다음 진입은 신규(지연 대상)
      return
    }
    // 이미 팝업이 열려 있던 중의 전환(상세↔보고서 등) 또는 reduced-motion → 지연 없이 즉시.
    if (popupOpenRef.current || prefersReducedMotion()) {
      setPopupReady(true)
      popupOpenRef.current = true
      return
    }
    // 지도에서 새로 진입 → 확대를 먼저 보여주고 그 뒤 팝업.
    setPopupReady(false)
    const tid = window.setTimeout(() => {
      setPopupReady(true)
      popupOpenRef.current = true
    }, 1300) // focus 줌(1400ms) 거의 끝날 때
    return () => window.clearTimeout(tid)
  }, [isPopupDetail, route.screen, route.domain, route.id])

  if (!introDone) {
    return (
      <GlobeIntro
        reducedMotion={prefersReducedMotion()}
        onDone={() => {
          if (!prefersReducedMotion()) {
            setMapEnter(true)
            setMapEnterScale(3.4) // 인트로 경로는 깊게 줌아웃
          }
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

  // AISea 모달 상단 스트립 — route 기준 태그/타이틀(P1=국가 정보·PR1=국가 진단 보고서 등). 한/영 번역.
  const frame = modalFrame(route, t)
  // 룰셋 화면은 TopBar 없이 단독으로 뜨므로, 컨테이너 상단 스트립에 한/영 토글을 얹는다.
  const headerExtra = route.screen === 'ruleset' ? <LanguageSelectorDropdown /> : undefined

  // 팝업(상세/보고서) 진입 시 뒤 지도를 해당 국가/권역으로 확대. 닫히면(map/ruleset) null → 복귀.
  const focus =
    route.mode === 'popup' &&
    (route.screen === 'detail' || route.screen === 'report') &&
    route.domain &&
    route.id
      ? { domain: route.domain, id: route.id }
      : null

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView
        enterAnim={mapEnter}
        enterScale={mapEnterScale}
        focus={focus}
        onSelectCountry={selectCountry}
        onSelectRegion={selectRegion}
      />

      {overlay && route.mode === 'popup' && popupReady && (
        <PopupContainer onClose={goHome} tag={frame.tag} tagClass={frame.tagClass} title={frame.title} headerExtra={headerExtra}>

          {overlay}
        </PopupContainer>
      )}
      {overlay && route.mode === 'fullscreen' && (
        <FullscreenContainer onBack={goHome} tag={frame.tag} tagClass={frame.tagClass} title={frame.title} headerExtra={headerExtra}>
          {overlay}
        </FullscreenContainer>
      )}

      <ProgressPanel />
      <ChatWidget />
    </div>
  )
}

// route → 모달 스트립 태그/타이틀. 데이터(국가명 등)는 뷰 자체 헤더가 담당하므로 여기선 분류 라벨만.
// 라벨은 t()로 한/영 번역(shell.* 키).
function modalFrame(
  route: ReturnType<typeof useRoute>['route'],
  t: (key: string) => string,
): {
  tag: string
  tagClass: string
  title: string
} {
  if (route.screen === 'ruleset')
    return { tag: t('shell.tag.ruleset'), tagClass: 'bg-text-secondary', title: t('shell.title.ruleset') }
  const isCountry = route.domain === 'country'
  if (route.screen === 'report')
    return {
      tag: isCountry ? t('shell.tag.countryReport') : t('shell.tag.regionReport'),
      tagClass: 'bg-primary',
      title: isCountry ? t('shell.title.countryReport') : t('shell.title.regionReport'),
    }
  // detail
  return {
    tag: isCountry ? t('shell.tag.countryDetail') : t('shell.tag.regionDetail'),
    tagClass: 'bg-primary',
    title: isCountry ? t('shell.title.countryDetail') : t('shell.title.regionDetail'),
  }
}
