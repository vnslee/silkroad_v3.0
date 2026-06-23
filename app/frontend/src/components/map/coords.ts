// 국가 코드 → 대표 좌표[lon, lat]. 마커 배치용 간이 테이블(Q7=A).
// research 보유 국가 전체. 확장 시 world-atlas 중심 계산으로 대체 가능.
// (data/research/country/<CODE> 가 추가되면 여기에 좌표를 등록해야 지도에 마커가 뜬다.)
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  AR: [-63.62, -38.42], // Argentina
  AT: [14.55, 47.52], // Austria
  BR: [-51.93, -14.24], // Brazil
  CA: [-106.35, 56.13], // Canada
  CL: [-71.54, -35.68], // Chile
  CN: [104.2, 35.86], // China
  DK: [9.5, 56.26], // Denmark
  ES: [-3.75, 40.46], // Spain
  FR: [2.21, 46.23], // France
  GB: [-3.44, 55.38], // United Kingdom
  ID: [113.92, -0.79], // Indonesia
  IN: [78.96, 20.59], // India
  IT: [12.57, 41.87], // Italy
  MX: [-102.55, 23.63], // Mexico
  NL: [5.29, 52.13], // Netherlands
  PL: [19.15, 51.92], // Poland
  PR: [-66.59, 18.22], // Puerto Rico
  PT: [-8.22, 39.4], // Portugal
}

// ISO alpha-2 → world-atlas(countries-110m) numeric id(ISO 3166-1 numeric).
// 권역 폴리곤 색칠 시 feature.id(숫자)와 국가코드를 잇는 매핑. research 보유국 기준.
export const COUNTRY_NUMERIC: Record<string, string> = {
  AT: '040', // Austria
  BR: '076', // Brazil
  DK: '208', // Denmark
  ES: '724', // Spain
  GB: '826', // United Kingdom
  IT: '380', // Italy
  MX: '484', // Mexico
  NL: '528', // Netherlands
  PL: '616', // Poland
  PT: '620', // Portugal
}

// 권역 코드 → 폴리곤 채움/테두리 색. DESIGN.md Kinetic Enterprise 팔레트 계열.
// 진출 권역만 지도 상에서 별도 색으로 강조한다(web_design_spec 5-4 권역 분기).
// 6개 권역(북미·남미·유럽·중동·아태·아프리카) — AISea mockup REGIONS6 색 계열.
export const REGION_FILL: Record<string, { fill: string; stroke: string }> = {
  EU: { fill: '#c9d2ee', stroke: '#3a4c9a' }, // 유럽
  NORTH_AMERICA: { fill: '#bfd0ec', stroke: '#2c4c86' }, // 북아메리카
  SOUTH_AMERICA: { fill: '#c8e0d2', stroke: '#2e6b4e' }, // 남아메리카
  ASIA: { fill: '#cbc7ec', stroke: '#5a4c9a' }, // 아시아·태평양
  MIDDLE_EAST: { fill: '#ead9b8', stroke: '#8a6a1e' }, // 중동
  AFRICA: { fill: '#ebcfc2', stroke: '#8a4a24' }, // 아프리카
}

// 권역 코드 → world-atlas(countries-110m) 국가명 집합. 권역 단위 하이라이트/클릭 영역 계산용.
// 백엔드 country.region(보유국만)이 아니라 "대륙 전체"를 권역으로 묶기 위해 국가명 기반으로 정의한다.
// 국가명은 world-atlas properties.name 표기를 따른다(예: 'United States of America', 'Czechia').
export const REGION_COUNTRY_NAMES: Record<string, string[]> = {
  // 유럽권역(EU 데모) — 지리적 유럽 전반(영국·스위스·노르딕 포함)
  EU: [
    'Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia',
    'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
    'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Lithuania', 'Luxembourg', 'Macedonia',
    'Moldova', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia',
    'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
  ],
  NORTH_AMERICA: ['United States of America', 'Canada', 'Mexico'],
  SOUTH_AMERICA: [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay',
    'Peru', 'Suriname', 'Uruguay', 'Venezuela',
  ],
  // 아시아·태평양 — 동·동남·남아시아 + 오세아니아
  ASIA: [
    'Bangladesh', 'Cambodia', 'China', 'India', 'Indonesia', 'Japan', 'Laos', 'Malaysia',
    'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Pakistan', 'Philippines', 'South Korea',
    'Sri Lanka', 'Taiwan', 'Thailand', 'Vietnam', 'Australia', 'New Zealand', 'Papua New Guinea',
  ],
  // 중동 — 서아시아·아라비아 반도(world-atlas properties.name 표기)
  MIDDLE_EAST: [
    'Saudi Arabia', 'United Arab Emirates', 'Turkey', 'Iran', 'Iraq', 'Israel', 'Jordan',
    'Kuwait', 'Oman', 'Qatar', 'Lebanon', 'Yemen', 'Syria', 'Bahrain',
  ],
  // 아프리카 — 북아프리카 + 사하라 이남
  AFRICA: [
    'South Africa', 'Egypt', 'Morocco', 'Nigeria', 'Kenya', 'Algeria', 'Ethiopia', 'Tanzania',
    'Ghana', 'Angola', 'Tunisia', 'Libya', 'Sudan', 'Mozambique', 'Zambia', 'Zimbabwe',
    'Uganda', 'Cameroon', "Côte d'Ivoire", 'Senegal', 'Mali', 'Namibia', 'Botswana', 'Madagascar',
  ],
}
