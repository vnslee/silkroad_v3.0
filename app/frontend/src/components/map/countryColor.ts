// 지도 국가 채색 규칙(FR-2.2) — world-atlas feature 를 4색 중 하나로 분류.
//   운영중(country_status='운영중') → 초록 / 미진출('미진출') → 빨강
//   현대차 해외사업망 국가 → 베이지 / 그 외(둘 다 아님) → 회색
// 식별체계가 3종(atlas feature.name·국가코드 alpha-2·현대 영문명)이라 이름 정규화로 잇는다.

export type LandColorKind = 'operating' | 'notEntered' | 'hyundai' | 'none'

// 4색 팔레트 — Kinetic 톤에 맞춘 차분한 채도.
export const LAND_COLORS: Record<LandColorKind, string> = {
  operating: '#D7E2DC', // 운영중 — 연초록 (R215 G226 B220)
  notEntered: '#E6D8D2', // 미진출 — 연분홍 (R230 G216 B210)
  hyundai: '#E2DDCF', // 현대 해외사업망 — 베이지 (R226 G221 B207)
  none: '#D8DCE0', // 대상 외 — 회색
}

// 이름 정규화: 소문자 + 영문자만(공백·점·괄호·악센트 제거). "Czech Republic"↔"Czechia" 같은
// 표기차는 별도 별칭으로 흡수한다. (마커 좌표 폴백에서 atlas feature.name 매칭에 재사용 — export.)
export function norm(s: string): string {
  // NFD 분해 후 영문자만 남기면 악센트(결합 문자)·공백·점·괄호가 모두 제거된다.
  return s.normalize('NFD').toLowerCase().replace(/[^a-z]/g, '')
}

// country_status 의 ISO alpha-2 → world-atlas feature.name(정규화 전 원문).
// internal_latest.json country_status 키 전체 + 인접 후보국을 커버.
// (마커 좌표 폴백 시 atlas 폴리곤 centroid를 코드에 잇는 용도로도 재사용 — export.)
export const A2_TO_ATLAS_NAME: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States of America',
  AU: 'Australia',
  DE: 'Germany',
  ES: 'Spain',
  PL: 'Poland',
  CZ: 'Czechia',
  HU: 'Hungary',
  FR: 'France',
  IT: 'Italy',
  CA: 'Canada',
  MX: 'Mexico',
  NZ: 'New Zealand',
  JP: 'Japan',
  KR: 'South Korea',
  IN: 'India',
  ID: 'Indonesia',
  CN: 'China',
  NL: 'Netherlands',
  PT: 'Portugal',
  AT: 'Austria',
  DK: 'Denmark',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  // SG(싱가포르)·PR(푸에르토리코)는 110m atlas 에 폴리곤이 없어 채색 불가(마커로만 표현).
}

// 현대 해외사업망 영문명 → atlas feature.name 표기차 별칭(정규화 기준).
// hyundai_worldwide.json 의 영문명이 atlas 와 다른 케이스만 등록.
const HYUNDAI_NAME_ALIASES: Record<string, string> = {
  [norm('Bosnia and Herzegovina')]: norm('Bosnia and Herz.'),
  [norm('Czech Republic')]: norm('Czechia'),
  [norm('North Macedonia')]: norm('Macedonia'),
  [norm('United States')]: norm('United States of America'),
  [norm('Dominican Republic')]: norm('Dominican Rep.'),
  [norm('D.R. Congo')]: norm('Dem. Rep. Congo'),
  [norm('Ivory Coast')]: norm("Côte d'Ivoire"),
  [norm('Central African Republic')]: norm('Central African Rep.'),
}

export interface ColorResolver {
  (featureName: string): LandColorKind
}

// country_status·현대망 데이터로부터 'atlas feature.name → 색종류' 판정기를 만든다.
// 우선순위: 운영중 > 미진출 > 현대망 > 그 외(회색). (우리 진단 상태가 현대망보다 우선.)
export function makeColorResolver(
  countryStatus: Record<string, string>,
  hyundaiCountries: string[],
): ColorResolver {
  // 1) 우리 상태(country_status) — alpha-2 를 atlas 정규화명으로 환산해 색종류 매핑.
  const statusByNorm = new Map<string, LandColorKind>()
  for (const [a2, status] of Object.entries(countryStatus)) {
    const atlasName = A2_TO_ATLAS_NAME[a2]
    if (!atlasName) continue
    const kind: LandColorKind =
      status === '운영중' ? 'operating' : status === '미진출' ? 'notEntered' : 'none'
    if (kind !== 'none') statusByNorm.set(norm(atlasName), kind)
  }

  // 2) 현대 해외사업망 — 정규화명 집합(별칭 적용).
  const hyundaiNorm = new Set<string>()
  for (const name of hyundaiCountries) {
    const n = norm(name)
    hyundaiNorm.add(HYUNDAI_NAME_ALIASES[n] ?? n)
  }

  return (featureName: string): LandColorKind => {
    const n = norm(featureName)
    const status = statusByNorm.get(n)
    if (status) return status // 운영중/미진출 우선
    if (hyundaiNorm.has(n)) return 'hyundai'
    return 'none'
  }
}
