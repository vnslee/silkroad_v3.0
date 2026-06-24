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

/** 멤버국 국경을 size 영역에 fit 한 path/라벨 좌표를 만든다. 매칭 0이면 null. */
export function buildRegionMapGeometry(
  members: RegionMapMember[],
  width = 320,
  height = 280,
  pad = 14,
): RegionMapGeometry | null {
  const matched: { member: RegionMapMember; feat: GeoJSON.Feature }[] = []
  for (const m of members) {
    const name = CODE_TOPONAME[m.code] ?? CODE_TOPONAME[m.code.toUpperCase()]
    if (!name) continue
    const feat = FEATURE_BY_NAME.get(norm(name))
    if (feat) matched.push({ member: m, feat })
  }
  if (matched.length === 0) return null

  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: matched.map((x) => x.feat),
  }
  const projection = d3
    .geoMercator()
    .fitExtent([[pad, pad], [width - pad, height - pad]], fc)
  const path = d3.geoPath(projection)

  const shapes: RegionMapShape[] = []
  for (const { member, feat } of matched) {
    const d = path(feat)
    if (!d) continue
    const c = path.centroid(feat)
    shapes.push({ code: member.code, d, label: [c[0], c[1]] })
  }
  return { shapes, viewBox: `0 0 ${width} ${height}`, width, height }
}
