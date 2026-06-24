// MapView(C4, FR-2.2·2.3) — AISea 평면 인터랙티브 지도(드래그/줌/포커스/마커/범례) + 상단바.
// 마커=카탈로그 API + world atlas 정적 지오데이터(Q7=A). 좌표 매칭은 간이 lon/lat 테이블.
// AISea 블루 펄스 마커 + 옅은 매력도 톤 채색. (레이아웃 탭/플로팅 패널은 제거.)
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-110m.json'
import type { Topology } from 'topojson-specification'
import { api } from '../../api/client'
import type { CountrySummary, MapColorData, RegionSummary } from '../../api/types'
import { store, useStore } from '../../store'
import { useT, translate } from '../../i18n/dict'
import { TopBar } from './TopBar'
import { Legend } from './Legend'
import { LAND_COLORS, makeColorResolver, type ColorResolver } from './countryColor'
import { toast } from '../ui/toast'

interface Props {
  onSelectCountry: (code: string) => void
  onSelectRegion: (region: string) => void
  /** 인트로 지구본 → 지도 줌인 모핑 진입 여부(App에서 전달). reduced-motion이면 false. */
  enterAnim?: boolean
  /** 진입 모핑 시작 배율. 인트로(지구본)=3.4로 깊게, CI 로고 복귀=1.5로 얕게 줌아웃. */
  enterScale?: number
  /** 상세 팝업 포커스 대상. 지정 시 뒤 지도가 해당 국가/권역으로 확대, null이면 기본 배율로 복귀. */
  focus?: { domain: 'country' | 'region'; id: string } | null
}

interface Marker {
  code: string
  name: string
  nameKo?: string
  lon: number
  lat: number
  // established=기진출국(네이비 고정 링) / candidate=진출후보국(블루 펄스). AISea mockup 2종 구분.
  status: 'established' | 'candidate'
}

// 권역 정의(AISea mockup REGIONS6 기반, 미주 통합으로 남·북미를 'na'로 합쳐 5개). key=대륙 분류 키,
// fill=hover 채움색, dark=툴팁 배경, code=백엔드 권역 라우트 코드(데이터 있는 권역만 매칭, ME/AF는 데이터 없을 수 있음).
interface Region6 {
  key: string
  label: string
  fill: string
  dark: string
  code: string
}
// 지역색(AISea): NA(미주) #4F8BFF / ME #FBBF24 / EU #C8F051 / APAC #FB7185.
// fill=hover 채움(연한 파스텔), dark=툴팁 배경(어두운 톤, 흰 텍스트 대비).
// 미주(Americas) 통합: 남·북미는 단일 권역 'na'(미주, code NA)로 묶는다.
const REGIONS6: Region6[] = [
  { key: 'na', label: '미주', fill: '#CBDDFF', dark: '#1f4ea8', code: 'NA' },
  { key: 'eu', label: '유럽', fill: '#E4F6B8', dark: '#5c6f12', code: 'EU' },
  { key: 'me', label: '중동', fill: '#FDEABF', dark: '#946a08', code: 'ME' },
  { key: 'ap', label: '아시아·태평양', fill: '#FED2D8', dark: '#bc3a4d', code: 'APAC' },
  { key: 'af', label: '아프리카', fill: '#E2DED5', dark: '#3a4048', code: 'AF' },
]
const REGION_BY_KEY: Record<string, Region6> = Object.fromEntries(REGIONS6.map((r) => [r.key, r]))
// 백엔드 권역코드(NA/EU/APAC…) → 분류 키(na/eu/ap…). 팝업 포커스 시 해당 권역 육지 묶음 찾기용.
const REGION_KEY_BY_CODE: Record<string, string> = Object.fromEntries(
  REGIONS6.map((r) => [r.code, r.key]),
)

// 경위도 centroid로 육지를 권역에 분류(mockup continentOf 기반).
// 미주(Americas) 통합: 남·북미(서반구 아메리카 대륙)는 모두 'na'(미주)로 귀속.
function classifyRegion(lon: number, lat: number): string {
  if (lon >= 34 && lon <= 63 && lat >= 12 && lat <= 43) return 'me'
  if (lon >= -25 && lon <= 45 && lat >= 36) return 'eu'
  if (lat < 37 && lon >= -20 && lon <= 52) return 'af'
  if (lon <= -30 && lat < 13) return 'na' // 구 남미 → 미주
  if (lon >= -170 && lon <= -30 && lat >= 12) return 'na'
  return 'ap'
}

export function MapView({
  onSelectCountry,
  onSelectRegion,
  enterAnim = false,
  enterScale = 3.4,
  focus = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<{
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  } | null>(null)
  // 줌 변환을 적용할 현재 <g>. 데이터 늦은 도착으로 effect가 재빌드되면 g가 새로 생기는데,
  // zoom 핸들러는 이 ref로 '살아있는 g'를 가리켜 진행 중 트랜지션이 죽은 g를 갱신하지 않게 한다.
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const enteredOnce = useRef(false) // 진입 줌 애니메이션 1회 가드(검색·팝업 재렌더 시 재실행 방지)
  // 빌드 effect가 만든 '포커스 줌' 함수를 보관 — 팝업 진입/종료 effect가 이 함수를 호출한다.
  // (projection·zoom·rest 등 빌드 effect 내부 값에 접근해야 하므로 ref 경유.)
  const focusFnRef = useRef<((f: Props['focus']) => void) | null>(null)
  // 진입 모핑이 안착(또는 정적 진입 완료)한 뒤에만 포커스 복귀(null)를 허용 — 진행 중 끊김 방지.
  const restReadyRef = useRef(false)
  const focusRef = useRef<Props['focus']>(null)
  focusRef.current = focus
  // 진입 모핑 완료 여부 — 완료 후 재빌드는 desiredRef(아래)를 즉시 반영해 위치를 잃지 않게 한다.
  const entryDoneRef = useRef(false)
  // '지도가 있어야 할 목표 줌'. 데이터 늦은 도착으로 재빌드돼도 이 값을 새 g에 즉시 적용 →
  // 포커스/복귀 상태가 항상 일관(작게 굳거나 안 돌아오는 문제 해소). null=아직 미정(최초).
  const desiredRef = useRef<d3.ZoomTransform | null>(null)
  const [countries, setCountries] = useState<CountrySummary[]>([])
  const [regions, setRegions] = useState<RegionSummary[]>([])
  const [mapColors, setMapColors] = useState<MapColorData | null>(null)
  const [notif, setNotif] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lang = useStore((s) => s.lang)
  const langRef = useRef(lang)
  langRef.current = lang
  const t = useT()
  // 리서치 완료 시 증가 → 카탈로그(마커) 재조회 트리거.
  const countriesVersion = useStore((s) => s.countriesVersion)
  // hover 툴팁(권역 라벨 / 국가명) — 화면 좌표 기준 HTML 오버레이. bg=툴팁 배경색(권역/마커별).
  const [tip, setTip] = useState<{ x: number; y: number; text: string; bg: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getCountries(), api.getRegions()])
      .then(([c, r]) => {
        if (cancelled) return
        setCountries(c)
        setRegions(r)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
    // countriesVersion 변경(리서치 완료) 시 재조회 → 신규 국가 마커 자동 표시.
  }, [countriesVersion])

  // 지도 채색 데이터(country_status + 현대 해외사업망) — 실패해도 지도는 중립색으로 동작.
  useEffect(() => {
    api.getMapColors().then(setMapColors).catch(() => setMapColors(null))
  }, [])

  // atlas feature.name → 색종류 판정기. 데이터 없으면 전부 회색(none).
  const colorOf = useMemo<ColorResolver>(
    () =>
      mapColors
        ? makeColorResolver(mapColors.country_status, mapColors.hyundai_countries)
        : () => 'none',
    [mapColors],
  )

  const markers = useMemo<Marker[]>(
    () =>
      // 카탈로그(getCountries)는 리서치 보유국 ∪ internal.json 진출국을 모두 포함한다
      // (백엔드 list_countries에서 union). 따라서 독일(DE JV)·체코·일본 등 리서치 폴더가
      // 없는 internal-only 국가도 여기에 포함돼 마커가 찍힌다 — 별도 보강 로직 불필요.
      countries
        .map((c) => {
          // 좌표는 백엔드 geo(API)가 단일 출처 — 폴백·누락 보장도 백엔드 resolve_coords가 담당.
          // null 가드는 구버전 캐시 응답 등 예외적 좌표 누락에 대한 안전망으로만 남긴다.
          const lon = c.lon
          const lat = c.lat
          if (lon == null || lat == null) return null
          // 기진출국(established) = 운영중(country_status) 또는 권역 기준국(is_baseline).
          //   그 외(미진출·진출예정 등) = 진출후보국(candidate). AISea mockup 2종 구분.
          //   ※ 기준국이 아니어도 운영중이면 기진출 마커로 표시(예: CA — NA 운영중, 기준국은 US).
          const isEstablished = c.status === '운영중' || c.is_baseline
          const status: Marker['status'] = isEstablished ? 'established' : 'candidate'
          const m: Marker = {
            code: c.code,
            name: c.name,
            nameKo: c.name_ko ?? undefined,
            lon,
            lat,
            status,
          }
          return m
        })
        .filter((m): m is Marker => m !== null),
    [countries],
  )

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current)
    svg.selectAll('*').remove()
    const width = 960
    const height = 500

    const topo = worldData as unknown as Topology
    const countriesGeo = feature(topo, topo.objects.countries as never) as unknown as {
      features: GeoJSON.Feature[]
    }
    // 남극 제외 — 지도 하단이 잘려 보이지 않도록(AISea 동일). 투영을 viewBox에 맞춰 전체가 들어오게 fitExtent.
    countriesGeo.features = countriesGeo.features.filter(
      (f) => (f.properties as { name?: string } | undefined)?.name !== 'Antarctica',
    )
    const fc = { type: 'FeatureCollection', features: countriesGeo.features } as GeoJSON.FeatureCollection
    const projection = d3
      .geoNaturalEarth1()
      .fitExtent(
        [
          [12, 8],
          [width - 12, height - 8],
        ],
        fc as never,
      )

    const g = svg.append('g')
    gRef.current = g
    const path = d3.geoPath(projection)

    // hover 툴팁 위치 계산 — SVG 컨테이너 기준 화면 좌표. bg=툴팁 배경색.
    const showTip = (e: MouseEvent, text: string, bg: string) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text, bg })
    }
    // 마커 툴팁 라벨 — 한/영 토글에 따라 국가명 표시(한글 없으면 영문 폴백).
    const markerLabel = (d: Marker): string =>
      langRef.current === 'ko' ? d.nameKo ?? d.name : d.name

    // 권역 hover 툴팁 라벨 — 권역명만 표시(현재 언어, langRef).
    // effect가 lang에 의존하지 않으므로 t() 대신 translate(key, langRef.current) 사용.
    const regionTipText = (regKey: string): string =>
      translate(`region.${regKey}`, langRef.current)

    // 각 육지 feature의 권역키를 centroid 경위도로 1회 계산해 캐시(mockup continentOf).
    const featRegion = new Map<GeoJSON.Feature, string>()
    for (const f of countriesGeo.features) {
      const c = d3.geoCentroid(f as never)
      featRegion.set(f, classifyRegion(c[0], c[1]))
    }

    // 국가별 기본색 — country_status(운영중=초록/미진출=빨강) + 현대망(베이지) + 그 외(회색).
    // feature.name 으로 색종류를 판정해 캐시(매 페인트마다 재계산 방지).
    const featBaseFill = (d: GeoJSON.Feature): string => {
      const name = (d.properties as { name?: string } | undefined)?.name ?? ''
      return LAND_COLORS[colorOf(name)]
    }

    // 육지 폴리곤 — 평소 국가별 상태색. hover/click은 권역 단위(mockup 방식).
    // hover 시 같은 권역 육지 전체를 권역색으로 덮고 '권역 · OO' 툴팁, click 시 권역 진입.
    const land = g
      .selectAll<SVGPathElement, GeoJSON.Feature>('path.land')
      .data(countriesGeo.features)
      .join('path')
      .attr('class', 'land')
      .attr('d', path as never)
      .attr('fill', featBaseFill)
      .attr('stroke', '#EDEBE4')
      .attr('stroke-width', 0.6)
      .style('cursor', 'pointer')

    // 권역 강조 페인트 — reg=hover 권역키(null이면 각 국가의 상태색으로 복귀).
    const paintRegion = (reg: string | null) => {
      const info = reg ? REGION_BY_KEY[reg] : null
      land.attr('fill', (d) => (info && featRegion.get(d) === reg ? info.fill : featBaseFill(d)))
    }

    land
      .on('mouseenter', function (e: MouseEvent, d) {
        const reg = featRegion.get(d) ?? 'ap'
        const info = REGION_BY_KEY[reg]
        paintRegion(reg)
        if (info) {
          setTip({
            x: e.clientX - (svgRef.current?.getBoundingClientRect().left ?? 0),
            y: e.clientY - (svgRef.current?.getBoundingClientRect().top ?? 0),
            text: regionTipText(reg),
            bg: info.dark,
          })
        }
      })
      .on('mousemove', function (e: MouseEvent, d) {
        const reg = featRegion.get(d) ?? 'ap'
        const info = REGION_BY_KEY[reg]
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect && info)
          setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: regionTipText(reg), bg: info.dark })
      })
      .on('mouseleave', () => {
        paintRegion(null)
        setTip(null)
      })
      .on('click', (_e: MouseEvent, d) => {
        const reg = featRegion.get(d) ?? 'ap'
        // 아프리카(af)·중동(me)은 진단 미대상 — hover는 되지만 상세 팝업은 막고 toast 안내.
        if (reg === 'af' || reg === 'me') {
          toast.warning('미대상 권역입니다.')
          return
        }
        const info = REGION_BY_KEY[reg]
        setNotif(false)
        onSelectRegion(info?.code ?? reg.toUpperCase())
      })

    // 마커 — AISea 블루 펄스 링 + 흰 점
    const node = g
      .selectAll('g.marker')
      .data(markers)
      .join('g')
      .attr('class', 'marker')
      .attr(
        'transform',
        (d) => `translate(${projection([d.lon, d.lat])?.[0] ?? 0},${projection([d.lon, d.lat])?.[1] ?? 0})`,
      )
      .attr('cursor', 'pointer')
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.name} 선택`)
      .on('mouseenter', (e: MouseEvent, d) =>
        showTip(e, markerLabel(d), d.status === 'established' ? '#14181C' : '#5c6f12'),
      )
      .on('mousemove', (e: MouseEvent, d) =>
        showTip(e, markerLabel(d), d.status === 'established' ? '#14181C' : '#5c6f12'),
      )
      .on('mouseleave', () => setTip(null))
      .on('click', (_e, d) => {
        setNotif(false)
        onSelectCountry(d.code)
      })

    // 마커 r 스케일 — viewBox(960×500)가 화면으로 ~2배 늘어나므로 r을 0.5배로 줄여
    // mockup(컨테이너 실치수 렌더)의 체감 크기에 맞춘다. stroke도 동일 비율 축소.
    const MS = 0.5

    // ── A. ripple — 마커 뒤에 퍼지는 '두껍고 투명한' 링(은은). 마커별 시작 시점을 랜덤하게
    //   흩뿌려 일제히 터지지 않게 한다(코드 해시 기반 → 리렌더에도 안정). pointer-events:none으로 비간섭.
    const rippleDelay = (code: string): string => {
      let h = 0
      for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0
      return `-${(((h % 1000) / 1000) * 2.4).toFixed(2)}s` // 0~한 주기(2.4s) 사이로 분산
    }
    node
      .insert('circle', ':first-child')
      .attr('class', 'map-ripple')
      .attr('r', 5 * MS)
      .attr('fill', 'none')
      .attr('stroke', (d) => (d.status === 'established' ? 'rgba(20,24,28,0.9)' : '#7CB518'))
      .attr('stroke-width', 5 * MS) // 두꺼운 링 — CSS opacity가 낮아 은은하게 퍼짐
      .style('animation-delay', (d) => rippleDelay(d.code))

    // ── 기진출국(established): 잉크블랙 3중 고정 링(펄스 없음, 안정) ──
    const established = node.filter((d) => d.status === 'established')
    // 외곽 후광(반투명)
    established.append('circle').attr('r', 8 * MS).attr('fill', 'rgba(20,24,28,0.15)')
    // 메인 원(잉크블랙 + 흰 테두리)
    established
      .append('circle')
      .attr('r', 5 * MS)
      .attr('fill', '#14181C')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.8 * MS)
    // 중심 흰 점
    established.append('circle').attr('r', 1.8 * MS).attr('fill', '#fff')

    // ── 진출후보국(candidate): 라임그린 핀(잉크 테두리로 대비 보강) ──
    //   펄스 링은 위 staggered ripple(map-ripple)이 담당하므로 동시 펄스 링은 제거(이중 링 방지).
    const candidate = node.filter((d) => d.status === 'candidate')
    candidate
      .append('circle')
      .attr('r', 4 * MS)
      .attr('fill', '#C8F051')
      .attr('stroke', '#14181C')
      .attr('stroke-width', 1.5 * MS)

    // 줌/패닝(1~6배) — translateExtent로 지도 영역 밖(공백)으로 끌려나가지 않게 제한.
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      // 항상 '살아있는 g'(gRef)에 변환 적용 — 재빌드로 g가 교체돼도 진행 중 트랜지션이 끊기지 않음.
      .on('zoom', (e) => gRef.current?.attr('transform', e.transform.toString()))
    svg.call(zoom)
    zoomRef.current = { svg, zoom }

    // 기본(정지) 배율 — 전체 핏(1배)보다 살짝 확대해 지도를 조금 더 크게 보여준다.
    const RESTING_SCALE = 1.2
    const cx = width / 2
    const cy = height / 2
    const rest = d3.zoomIdentity.translate(cx, cy).scale(RESTING_SCALE).translate(-cx, -cy)

    // viewBox 좌표 bounds → 줌 transform. minK로 '확대감'을 보장(큰 권역도 최소한 확대),
    // maxK로 과확대 방지. 중심은 화면 가로 35%(우측 팝업 회피) — 국가 포커스와 일관.
    const transformForBounds = (
      b: [[number, number], [number, number]],
      minK: number,
      maxK: number,
    ): d3.ZoomTransform => {
      const [[x0, y0], [x1, y1]] = b
      const bw = Math.max(1, x1 - x0)
      const bh = Math.max(1, y1 - y0)
      const fitK = 0.7 * Math.min(width / bw, height / bh) // 0.7=주변 맥락 남기는 여백
      const k = Math.max(minK, Math.min(maxK, fitK)) // 작은 권역=fit, 큰 권역=최소 minK 확대
      const tcx = (x0 + x1) / 2
      const tcy = (y0 + y1) / 2
      return d3.zoomIdentity.translate(width * 0.35, cy).scale(k).translate(-tcx, -tcy)
    }

    // ── 팝업 포커스 줌 — 국가=마커 좌표 중심 확대, 권역=해당 권역 육지 bounds로 fit, null=rest 복귀.
    //   상세 팝업이 오른쪽을 덮으므로 대상을 화면 왼쪽으로 살짝 치우치게(왼쪽 1/3 지점) 둔다.
    // target만 계산(부수효과 없음) — 국가=마커 중심 확대, 권역=육지 bounds fit, null/실패=rest.
    const computeTarget = (f: Props['focus']): d3.ZoomTransform => {
      if (f?.domain === 'country') {
        const m = markers.find((mk) => mk.code === f.id.toUpperCase())
        const p = m ? projection([m.lon, m.lat]) : null
        if (p) {
          const k = 2.6
          // 대상을 화면 가로 35% 지점에 두어 우측 팝업과 겹치지 않게.
          return d3.zoomIdentity.translate(width * 0.35, cy).scale(k).translate(-p[0], -p[1])
        }
      } else if (f?.domain === 'region') {
        const key = REGION_KEY_BY_CODE[f.id.toUpperCase()] ?? f.id.toLowerCase()
        const feats = countriesGeo.features.filter((ft) => featRegion.get(ft) === key)
        if (feats.length) {
          // 권역 소속 육지들의 화면 bounds 합집합 → 그 영역이 들어오게 fit.
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
          for (const ft of feats) {
            const bb = path.bounds(ft as never)
            x0 = Math.min(x0, bb[0][0]); y0 = Math.min(y0, bb[0][1])
            x1 = Math.max(x1, bb[1][0]); y1 = Math.max(y1, bb[1][1])
          }
          // minK=1.8: 미주·APAC처럼 큰 권역도 최소 1.8배 확대돼 '이동'이 아닌 '확대'로 보이게.
          if (Number.isFinite(x0)) return transformForBounds([[x0, y0], [x1, y1]], 1.8, 4)
        }
      }
      return rest
    }

    // ── 팝업 포커스 줌 ── focus 변경 시 호출. 목표를 desiredRef에 기록하고 그쪽으로 트랜지션.
    focusFnRef.current = (f) => {
      const z = zoomRef.current
      if (!z) return
      // 포커스/복귀가 한 번이라도 적용되면 진입 모핑은 끝난 것으로 간주 — 게이트를 연다.
      // (진입 줌을 클릭으로 가로채 .on('end')가 안 불려도 복귀가 막히지 않도록.)
      restReadyRef.current = true
      entryDoneRef.current = true
      const target = computeTarget(f)
      desiredRef.current = target // 재빌드 시 이 목표를 즉시 반영(위치 유실 방지)
      // 포커스(확대)는 줌만 단독으로 보이므로 길고 부드럽게(팝업이 그 뒤에 뜸). 복귀(f=null)는 빠르게.
      const dur = f ? 1400 : 700
      z.svg.transition().duration(dur).ease(d3.easeCubicInOut).call(z.zoom.transform, target)
    }

    // ── 진입 모핑(최초 1회만 — 검색·팝업 재렌더 시 재실행 금지) ──
    // enterScale배(확대 상태, 인트로=3.4·CI복귀=1.3) → 1배로 줌아웃해 전체 지도를 펼쳐 보여준
    // 뒤 → 1.2배로 살짝 다시 줌인해 안착. 자연스러운 2단계 모션.
    // ⚠️ 새 g에는 마지막 transform을 즉시 반영해야(없으면 변환 0,0,1로 깜빡임).
    if (enterAnim && !enteredOnce.current) {
      enteredOnce.current = true
      // 1단계(줌아웃) 속도: 얕은 줌아웃(CI복귀, enterScale 작음)은 빠르게, 깊은 줌아웃(인트로)은 느리게.
      const zoomOutMs = enterScale <= 2 ? 550 : 1100
      const start = d3.zoomIdentity.translate(cx, cy).scale(enterScale).translate(-cx, -cy)
      svg.call(zoom.transform, start)
      svg
        .transition() // 1단계: enterScale배 → 1배(전체 핏)로 줌아웃
        .duration(zoomOutMs)
        .ease(d3.easeCubicOut)
        .call(zoom.transform, d3.zoomIdentity)
        .transition() // 2단계: 1배 → 1.2배로 천천히 줌인, 끝에서 살짝 오버슈트해 '쫀득하게' 안착
        .duration(1200)
        .ease(d3.easeBackOut.overshoot(1.5))
        .call(zoom.transform, rest)
        .on('end', () => {
          restReadyRef.current = true
          entryDoneRef.current = true
          if (!desiredRef.current) desiredRef.current = rest
          // 진입 중 팝업이 이미 열려 있었다면(딥링크 등) 안착 직후 포커스 적용.
          if (focusRef.current) focusFnRef.current?.(focusRef.current)
        })
    } else if (entryDoneRef.current) {
      // 진입 완료 후 데이터 늦은 도착으로 재빌드 → 새 g에 '있어야 할 목표'(desiredRef)를 즉시 반영.
      // 현재(애니메이션 중간) transform을 읽어 굳히면 작은 배율로 멈추는 버그가 생기므로 목표 기준.
      svg.call(zoom.transform, desiredRef.current ?? rest)
    } else if (enteredOnce.current) {
      // 진입 모핑이 아직 진행 중인데 재빌드 → 진행 중 트랜지션이 이어서 새 g를 갱신하도록 둔다.
      const cur = d3.zoomTransform(svg.node() as SVGSVGElement)
      g.attr('transform', cur.toString())
    } else {
      // 딥링크·reduced-motion·최초 정적 진입 → 정지 배율을 즉시 적용(애니메이션 없음).
      svg.call(zoom.transform, rest)
      restReadyRef.current = true
      entryDoneRef.current = true
      desiredRef.current = rest
    }
  }, [markers, colorOf, onSelectCountry, onSelectRegion, enterAnim, enterScale])

  // 팝업 포커스 — focus 변경 시 빌드 effect가 만든 줌 함수 호출.
  // 진입 모핑 진행 중(restReadyRef=false)에 focus==null이면(=아직 팝업 안 연 최초 상태) 미뤄
  // 진입 줌이 끊기지 않게 한다. focus가 있으면(클릭) 진입을 가로채고 즉시 포커스(팝업 우선).
  // markers 갱신(늦은 데이터)으로 재실행돼도 현재 focus 기준으로 다시 맞춰주므로 안전(멱등).
  useEffect(() => {
    if (focus == null && !restReadyRef.current) return
    focusFnRef.current?.(focus)
  }, [focus, markers])

  const zoomBy = (k: number) => {
    const z = zoomRef.current
    if (z) z.svg.transition().duration(300).call(z.zoom.scaleBy, k)
  }

  return (
    <div
      className="relative h-full w-full"
      style={{ background: 'radial-gradient(120% 120% at 50% 0%, #f4f2ea 0%, #e3e0d6 100%)' }}
    >
      <TopBar
        countries={countries}
        regions={regions}
        onMap
        onGoMap={() => {
          window.location.hash = '#/'
          setNotif(true)
        }}
      />

      <svg
        ref={svgRef}
        viewBox="0 0 960 500"
        className="h-full w-full"
        aria-label={t('map.aria')}
      />

      {/* hover 툴팁 — 권역 라벨('권역 · OO') / 국가명(한·영). 배경색은 권역/마커별(mockup). */}
      {tip && (
        <div
          className="pointer-events-none absolute z-chrome -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg px-md py-xs text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(20,23,28,0.24)]"
          style={{ left: tip.x, top: tip.y, background: tip.bg }}
        >
          {tip.text}
        </div>
      )}

      {/* 안내 칩(AISea) — 텍스트 + 챗봇 열기 링크 (헤더 아래로 충분히 내림) */}
      {notif && (
        <div className="absolute left-1/2 top-[84px] z-chrome flex -translate-x-1/2 items-center gap-sm rounded-[14px] border border-surface-border bg-[rgba(255,255,255,0.92)] px-md py-sm shadow-[0_8px_28px_rgba(20,23,28,0.08)] backdrop-blur-[10px]">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {t('map.bannerLead')}
          </span>
          <button
            onClick={() => store.setChatOpen(true)}
            className="font-body-sm text-body-sm font-semibold text-primary transition-opacity hover:opacity-80"
          >
            {t('map.bannerAsk')}
          </button>
        </div>
      )}

      {/* 줌 + 범례 */}
      <div className="absolute bottom-lg right-lg z-chrome flex flex-col gap-sm">
        <button
          onClick={() => zoomBy(1.4)}
          aria-label={t('map.zoomIn')}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-surface-border bg-surface-container-lowest text-[19px] text-on-surface-variant shadow-[0_4px_14px_rgba(20,23,28,0.07)]"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(0.7)}
          aria-label={t('map.zoomOut')}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-surface-border bg-surface-container-lowest text-[21px] text-on-surface-variant shadow-[0_4px_14px_rgba(20,23,28,0.07)]"
        >
          −
        </button>
      </div>
      <Legend />

      {error && (
        <div className="absolute inset-x-0 bottom-0 z-chrome bg-error-container p-sm text-center font-body-sm text-body-sm text-on-error-container">
          데이터를 불러오지 못했습니다. 백엔드가 실행 중인지 확인하세요.
        </div>
      )}
    </div>
  )
}
