// 권역 상세(P2) 지도 지오메트리 — 실제 국경 폴리곤을 권역 멤버에 맞춰 클로즈업.
// 백엔드 region_geo.py(순수 Python topojson 디코더)와 동치: world-atlas 50m + d3-geo로
// 멤버국 국경 path 를 만들고, 멤버 bbox 에 fit 한다. 진출상태별 fill 은 호출측 주입.
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import worldData from 'world-atlas/countries-50m.json'
import type { Topology } from 'topojson-specification'
import { norm } from '../map/countryColor'

// 국가코드(ISO A2) → world-atlas feature.name. 권역 멤버 매칭용.
// 백엔드 region_geo.CODE_TOPONAME 와 동일 집합(region 멤버 전체 커버).
const CODE_TOPONAME: Record<string, string> = {
  ES: 'Spain', PL: 'Poland', DE: 'Germany', FR: 'France', IT: 'Italy',
  GB: 'United Kingdom', UK: 'United Kingdom', AT: 'Austria', DK: 'Denmark',
  CZ: 'Czechia', HU: 'Hungary', NL: 'Netherlands', PT: 'Portugal',
  BE: 'Belgium', SE: 'Sweden', NO: 'Norway', FI: 'Finland', IE: 'Ireland',
  CH: 'Switzerland', RO: 'Romania', GR: 'Greece', SK: 'Slovakia',
  US: 'United States of America', CA: 'Canada', MX: 'Mexico', PR: 'Puerto Rico',
  BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia', PE: 'Peru',
  AU: 'Australia', NZ: 'New Zealand', JP: 'Japan', KR: 'South Korea',
  SG: 'Singapore', IN: 'India', CN: 'China', VN: 'Vietnam',
  ID: 'Indonesia', TH: 'Thailand', MY: 'Malaysia', PH: 'Philippines',
}

// 정규화 atlas name → GeoJSON feature(모듈 로드 시 1회). 50m=상세화면 클로즈업 해상도.
const FEATURE_BY_NAME: Map<string, GeoJSON.Feature> = (() => {
  const topo = worldData as unknown as Topology
  const fc = feature(topo, topo.objects.countries as never) as unknown as {
    features: GeoJSON.Feature[]
  }
  const m = new Map<string, GeoJSON.Feature>()
  for (const f of fc.features) {
    const nm = (f.properties as { name?: string } | undefined)?.name
    if (nm) m.set(norm(nm), f)
  }
  return m
})()

export interface RegionMapMember {
  code: string
  status: string
}

export interface RegionMapShape {
  code: string
  /** SVG path d (projection 좌표계). */
  d: string
  /** 본토 라벨 위치(projection 좌표계). */
  label: [number, number]
}

export interface RegionMapGeometry {
  shapes: RegionMapShape[]
  /** d3 projection 출력에 맞춘 viewBox "0 0 W H". */
  viewBox: string
  width: number
  height: number
}

// 한 국가 feature 에서 '본토'(가장 큰 단일 폴리곤)만 추출한다.
// US(알래스카·하와이)·ES(카나리아 제도)·FR(해외영토)처럼 한 국가 안에 본토와
// 멀리 떨어진 영토가 MultiPolygon 으로 함께 들어 있으면, fit/bbox 가 그 영토까지
// 감싸 본토가 작게 보인다. 본토만 fit 기준으로 쓰면 지도가 본토 중심으로 확대된다
// (그리기용 path 는 전체 폴리곤을 그대로 쓰므로 섬·영토도 보이긴 한다).
function mainlandFeature(feat: GeoJSON.Feature): GeoJSON.Feature {
  const g = feat.geometry
  if (!g || g.type !== 'MultiPolygon') return feat
  let best: GeoJSON.Position[][] | null = null
  let bestArea = -1
  for (const poly of g.coordinates) {
    const area = d3.geoArea({ type: 'Polygon', coordinates: poly } as GeoJSON.Polygon)
    if (area > bestArea) {
      bestArea = area
      best = poly
    }
  }
  if (!best) return feat
  return { ...feat, geometry: { type: 'Polygon', coordinates: best } }
}

/** 멤버국 국경을 size 영역에 fit 한 path/라벨 좌표를 만든다. 매칭 0이면 null. */
export function buildRegionMapGeometry(
  members: RegionMapMember[],
  width = 320,
  height = 280,
  pad = 6,
): RegionMapGeometry | null {
  const matched: { member: RegionMapMember; feat: GeoJSON.Feature }[] = []
  for (const m of members) {
    const name = CODE_TOPONAME[m.code] ?? CODE_TOPONAME[m.code.toUpperCase()]
    if (!name) continue
    const feat = FEATURE_BY_NAME.get(norm(name))
    if (feat) matched.push({ member: m, feat })
  }
  if (matched.length === 0) return null

  // fit·bbox 계산은 "본토급" 멤버의 "본토 폴리곤"만 사용한다.
  // ① 멤버 단위: PR(푸에르토리코)처럼 본토에서 멀리 떨어진 작은 멤버국이 끼면
  //    bbox 가 거대해져 본토가 작게 보인다 → 최대 면적의 8% 미만 멤버는 fit 제외.
  // ② 국가 내부: US(알래스카·하와이)·ES(카나리아)처럼 한 국가 안의 원거리 영토도
  //    같은 문제를 일으킨다 → mainlandFeature 로 본토 폴리곤만 fit 기준으로 쓴다.
  // 어느 경우든 path/라벨은 전체 폴리곤으로 그대로 그린다(영토도 보이긴 함).
  // 큰 멤버가 1개뿐이면 전체로 폴백.
  const areas = matched.map((x) => d3.geoArea(x.feat))
  const maxArea = Math.max(...areas, 0)
  const major = matched.filter((_, i) => areas[i] >= maxArea * 0.08)
  const fitFc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (major.length > 0 ? major : matched).map((x) => mainlandFeature(x.feat)),
  }

  const projection = d3
    .geoMercator()
    .fitExtent([[pad, pad], [width - pad, height - pad]], fitFc)
  const path = d3.geoPath(projection)

  const shapes: RegionMapShape[] = []
  for (const { member, feat } of matched) {
    const d = path(feat)
    if (!d) continue
    // 라벨은 본토 폴리곤 중심에 둔다 — 원거리 영토(알래스카 등)에 끌려 바다로 나가지 않게.
    const c = path.centroid(mainlandFeature(feat))
    shapes.push({ code: member.code, d, label: [c[0], c[1]] })
  }

  // fitExtent 만으로는 영역 종횡비와 권역 bbox 비율이 다르면 한 축으로만 채워져
  // 큰 letterbox 여백이 남는다(가로로 넓은 패널 + 세로로 긴 권역 등).
  // ① 실제 그려진 path 들의 합집합 bbox 로 콘텐츠 박스를 구하고,
  // ② 그 박스를 영역(width×height) 종횡비에 맞춰 짧은 축으로 확장해
  //    preserveAspectRatio="meet" 로도 letterbox 없이 영역을 꽉 채우게 한다.
  const b = path.bounds(fitFc) // [[x0,y0],[x1,y1]] — 본토급 멤버 기준
  let bx = b[0][0] - pad
  let by = b[0][1] - pad
  let bw = b[1][0] - b[0][0] + pad * 2
  let bh = b[1][1] - b[0][1] + pad * 2

  // 영역 종횡비에 맞춰 콘텐츠 박스를 확장(중앙 기준) → meet 여백 제거.
  const areaRatio = width / height
  const boxRatio = bw / bh
  if (boxRatio < areaRatio) {
    // 박스가 영역보다 세로로 긺 → 가로를 넓혀 비율을 맞춘다.
    const newW = bh * areaRatio
    bx -= (newW - bw) / 2
    bw = newW
  } else {
    // 박스가 영역보다 가로로 넓음 → 세로를 넓혀 비율을 맞춘다.
    const newH = bw / areaRatio
    by -= (newH - bh) / 2
    bh = newH
  }
  return {
    shapes,
    viewBox: `${bx} ${by} ${bw} ${bh}`,
    width: bw,
    height: bh,
  }
}
