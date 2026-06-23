/**
 * M1 지구본 + 시네마틱 인트로 (U16).
 *
 * intro_spec.md 권장 패턴: vanilla 모듈로 캡슐화, React 가 마운트만.
 * stitch mockup(M1_intro.html)의 three.js 프로시저럴 지구 + D3 평면지도 전환을 이식.
 * CDN 전역 대신 npm import 사용. 공개 API: createGlobe(opts) → { runIntro, skipIntro, destroy }.
 */
import * as THREE from 'three'
import * as d3 from 'd3'
import { feature } from 'topojson-client'

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const ISO_NUM = {
  UK: 826, GB: 826, DE: 276, ES: 724, PL: 616, BR: 76, IN: 356, KR: 410,
  AT: 40, DK: 208, FR: 250, IT: 380, MX: 484, NL: 528, PT: 620,
  CZ: 203, HU: 348, US: 840, CA: 124, AU: 36, JP: 392, NZ: 554, SG: 702,
}
// world-atlas 숫자 id → ISO alpha-2 (육지 클릭용 역매핑). 826=영국은 GB 로.
const NUM_ISO = Object.fromEntries(
  Object.entries(ISO_NUM).filter(([c]) => c !== 'UK').map(([c, n]) => [n, c]),
)
const HQ = { name: 'SEOUL HQ', lonlat: [126.978, 37.5665] }

const DEFAULT_CATALOG = [
  { code: 'GB', country_ko: '영국', capital: [-0.1276, 51.5074], is_baseline: true, region: 'EU' },
  { code: 'DE', country_ko: '독일', capital: [13.405, 52.52], is_baseline: false, region: 'EU' },
  { code: 'ES', country_ko: '스페인', capital: [-3.7038, 40.4168], is_baseline: false, region: 'EU' },
  { code: 'PL', country_ko: '폴란드', capital: [21.0122, 52.2297], is_baseline: false, region: 'EU' },
  { code: 'BR', country_ko: '브라질', capital: [-47.8825, -15.794], is_baseline: false, region: 'LATAM' },
  { code: 'IN', country_ko: '인도', capital: [77.209, 28.614], is_baseline: false, region: 'APAC' },
]

const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t)

// 색 보간(밤의 지구 어두운 톤 → 밝은 평면지도 톤). 크로스페이드 이음새 숨김용.
const _lerp = (a, b, t) => Math.round(a + (b - a) * t)
const lerpRgb = (c1, c2, t) =>
  `rgb(${_lerp(c1[0], c2[0], t)},${_lerp(c1[1], c2[1], t)},${_lerp(c1[2], c2[2], t)})`

/**
 * WebGL 불가 환경 폴백: 3D 지구본 없이 D3 평면지도만 렌더.
 * createGlobe 와 동일한 공개 API({runIntro, skipIntro, destroy})를 반환.
 */
function _flatOnlyFallback(opts) {
  const { canvas, svg, stage, onIntroDone, onSelectCountry, onSelectRegion } = opts
  const CATALOG = opts.countries || DEFAULT_CATALOG
  let disposed = false
  if (canvas) canvas.style.display = 'none'

  let W = innerWidth, H = innerHeight, proj, pathFn, LAND = [], ready = false
  const p = d3.json(TOPO_URL).then((topo) => {
    if (disposed) return
    W = stage.clientWidth || innerWidth
    H = stage.clientHeight || (innerHeight - 56)
    proj = d3.geoNaturalEarth1().scale(W / 5.4).translate([W / 2, H * 0.46]).precision(0.4)
    pathFn = d3.geoPath(proj)
    LAND = feature(topo, topo.objects.countries).features
    ready = true
    _renderFlat({ svg, CATALOG, W, H, proj, pathFn, LAND, onSelectCountry, onSelectRegion })
    svg.style.opacity = '1'
    svg.style.pointerEvents = 'auto'
    if (onIntroDone) onIntroDone()
  })
  return {
    runIntro: () => p,
    skipIntro: () => p,
    destroy: () => { disposed = true },
  }
}

// 국가코드 → 권역코드. internal_latest.json 의 country_to_region 정의(SoT)에 맞춤.
// 권역: EU·NA·SA·APAC 4개. BR→SA 는 프론트에서 추가(백엔드 country_to_region 엔 아직 SA 없음).
// hover(권역 묶음 하이라이트)는 이 4개 권역 전부 사용. 클릭 내비는 BASELINE_REGIONS 만.
const CODE_REGION = {
  // EU
  ES: 'EU', PL: 'EU', CZ: 'EU', HU: 'EU', DE: 'EU', FR: 'EU', IT: 'EU', GB: 'EU', UK: 'EU',
  // NA
  US: 'NA', CA: 'NA', MX: 'NA',
  // SA (프론트 추가)
  BR: 'SA',
  // APAC
  AU: 'APAC', NZ: 'APAC', JP: 'APAC', KR: 'APAC', SG: 'APAC',
}
// baseline(P2 권역 보고서) 보유 권역만 클릭 내비 가능 — region_baselines: EU/NA/APAC.
const BASELINE_REGIONS = new Set(['EU', 'NA', 'APAC'])
// 권역 hover 시 빈 곳에 띄울 표시명.
const REGION_NAMES = { EU: 'EUROPE', NA: 'NORTH AMERICA', SA: 'SOUTH AMERICA', APAC: 'ASIA PACIFIC' }
// 권역 라벨 표시 위치(경위도). 빈 바다 쪽에 두어 대륙을 안 가리게 — 레퍼런스 구도.
// ⚠️ 지도가 frontLon(인도 중심)으로 회전돼 있어 아메리카는 화면 가장자리로 밀림.
// → NA·SA 라벨을 대륙 안쪽/동쪽으로 당겨 화면 안에 들어오게.
const REGION_LABEL_LONLAT = {
  EU: [15, 58], NA: [-75, 48], SA: [-58, -20], APAC: [140, 8],
}
/** 국가코드 → 권역코드(hover 묶음용. 없으면 null). */
function _regionOf(code) {
  return CODE_REGION[code] || null
}

/** 평면 SVG 렌더(폴백·정상 경로 공용 코어). */
function _renderFlat({ svg, CATALOG, W, H, proj, pathFn, LAND, onSelectCountry, onSelectRegion }) {
  const sel = d3.select(svg).attr('viewBox', `0 0 ${W} ${H}`)
  sel.selectAll('*').remove()
  const defs = sel.append('defs')
  const og = defs.append('radialGradient').attr('id', 'fm-ocean')
    .attr('cx', '38%').attr('cy', '34%').attr('r', '82%')
  ;[['0%', '#eaf2fb'], ['55%', '#cfe0f5'], ['100%', '#a9c6e8']]
    .forEach((s) => og.append('stop').attr('offset', s[0]).attr('stop-color', s[1]))
  sel.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#fm-ocean)')
  sel.append('path').attr('class', 'graticule').attr('d', pathFn(d3.geoGraticule10()))
  const activeIds = new Set(CATALOG.filter((d) => d.is_baseline).map((d) => ISO_NUM[d.code]))
  const regionOfFeature = (d) => { const c = NUM_ISO[d.id]; return c ? _regionOf(c) : null }
  const landSel = sel.append('g').selectAll('path').data(LAND).enter().append('path')
    .attr('class', 'country-land')
    .classed('region-active', (d) => activeIds.has(d.id))
    .attr('data-region', (d) => regionOfFeature(d) || null)
    .attr('d', pathFn)
  // 육지(권역 영역) 클릭 → 권역 정보(P2). 매핑된 국가의 region 으로 분기(§6.3).
  if (onSelectRegion || onSelectCountry) {
    landSel
      .style('cursor', (d) => (NUM_ISO[d.id] ? 'pointer' : 'default'))
      // 마우스오버: 같은 권역 전체 하이라이트(국가 단위 아님).
      .on('mouseenter', (event, d) => {
        const region = regionOfFeature(d)
        if (region) landSel.classed('region-hover', (x) => regionOfFeature(x) === region)
        else d3.select(event.currentTarget).classed('region-hover', true)
      })
      .on('mouseleave', () => landSel.classed('region-hover', false))
      .on('click', (event, d) => {
        const c = NUM_ISO[d.id]; if (!c) return
        const region = _regionOf(c)
        if (region && BASELINE_REGIONS.has(region) && onSelectRegion) onSelectRegion(region)
        else if (onSelectCountry) onSelectCountry(c)
      })
  }
  const mkG = sel.append('g')
  CATALOG.map((d) => ({ ...d, xy: proj(d.capital) })).forEach((d) => {
    if (!d.xy) return
    const g = mkG.append('g').attr('transform', `translate(${d.xy[0]},${d.xy[1]})`)
    g.append('circle').attr('r', d.is_baseline ? 6 : 6)
      .attr('fill', d.is_baseline ? '#2F79D9' : '#fff')
      .attr('stroke', '#2F79D9').attr('stroke-width', d.is_baseline ? 0 : 1.5)
    g.append('text').attr('class', 'mk-label').attr('y', -15)
      .attr('text-anchor', 'middle').style('opacity', 1).text(d.country_ko)
    if (onSelectCountry) {
      g.style('cursor', 'pointer').on('click', () => onSelectCountry(d.code))
      g.append('circle').attr('r', 16).attr('fill', 'transparent')
    }
  })
}

/**
 * @param {object} opts
 *   canvas: WebGL 캔버스, svg: 평면지도 SVG, stage: 컨테이너 div
 *   countries: 마커 카탈로그(없으면 DEFAULT_CATALOG)
 *   reducedMotion: true 면 인트로 생략하고 바로 평면
 *   onIntroDone: 인트로 완료 콜백(UI 페이드인용)
 */
export function createGlobe(opts) {
  const { canvas, svg, stage, onIntroDone, onSelectCountry, onSelectRegion } = opts
  const CATALOG = opts.countries || DEFAULT_CATALOG
  const reducedMotion = opts.reducedMotion ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  let disposed = false
  const timers = []
  const setT = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id }

  // ── THREE.js (WebGL 미지원 환경 graceful 폴백) ──
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(innerWidth, innerHeight)
    renderer.setClearColor(0x020611, 1)
  } catch (e) {
    // WebGL 불가(헤드리스·비활성 브라우저) → 3D 인트로 생략, 평면지도만.
    return _flatOnlyFallback(opts)
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200)

  // 별 — 먼 구 껍질(반경 60~95)에 배치(카메라 근처 큰 네모 방지) + 별마다 랜덤 크기/밝기.
  // PointsMaterial은 size가 균일해 환공포 느낌 → 셰이더로 per-vertex 크기·밝기 다양화.
  ;(function () {
    const n = 2600
    const pos = new Float32Array(n * 3)
    const siz = new Float32Array(n)
    const alp = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const r = 60 + Math.random() * 35
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
      // 대부분 작고 가끔 큰 별(제곱으로 작은 쪽에 치우치게).
      const t = Math.random()
      siz[i] = 0.6 + t * t * 4.5
      alp[i] = 0.4 + Math.random() * 0.6
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float aSize; attribute float aAlpha; varying float vA;
        void main(){ vA=aAlpha;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_PointSize=aSize*(120.0/-mv.z);
          gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `
        varying float vA;
        void main(){
          // 원형 별 + 부드러운 가장자리(네모 방지).
          float d=length(gl_PointCoord-vec2(0.5));
          float a=smoothstep(0.5,0.08,d)*vA;
          gl_FragColor=vec4(1.0,1.0,1.0,a); }`,
    })
    scene.add(new THREE.Points(geo, mat))
  })()

  const earthVert = `
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vViewPos;
    void main(){ vNormal=normalize(normalMatrix*normal); vUv=uv;
      vViewPos=-(modelViewMatrix*vec4(position,1.0)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`
  const earthFrag = `
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vViewPos;
    uniform float uTime; uniform vec3 uSunDir; uniform float uReveal;
    uniform sampler2D uDay; uniform sampler2D uNight;
    void main(){
      vec3 n=normalize(vNormal);
      vec3 sun=normalize(uSunDir);
      vec3 viewDir=normalize(vViewPos);
      vec3 dayTex=texture2D(uDay,vUv).rgb;
      vec3 nightTex=texture2D(uNight,vUv).rgb;
      // ── 밤의 지구(레퍼런스): 깊은 블루 바다 + 어두운 대륙 + 도시광(주황) + 시안 림. ──
      // 육지/바다 분리: 밝기 낮음 + 파란기 = 바다.
      float lum=dot(dayTex,vec3(0.299,0.587,0.114));
      float blueish=smoothstep(-0.04,0.02,dayTex.b-dayTex.r);
      float dark=1.0-smoothstep(0.16,0.42,lum);
      float oceanMask=clamp(blueish*dark*1.4,0.0,1.0);
      // 바다: 깊고 차분한 딥블루(채도 낮춰 쨍한 파랑 제거). 밤이라 전반적으로 어둡게.
      vec3 oceanTop=vec3(0.03,0.10,0.22);
      vec3 oceanBot=vec3(0.01,0.04,0.11);
      float lat=1.0-abs(vUv.y-0.5)*2.0;
      vec3 oceanCol=mix(oceanBot,oceanTop,smoothstep(0.05,0.95,lat));
      // 육지: 어두운 청록 실루엣으로 가라앉힘(사막 황토색 뜨는 것 방지).
      // 원본은 윤곽 살짝만 — 밝기 차이로 대륙 경계가 은은히 보이는 정도.
      float landLum=dot(dayTex,vec3(0.299,0.587,0.114));
      vec3 landCol=mix(vec3(0.03,0.07,0.12), vec3(0.09,0.15,0.20), smoothstep(0.1,0.6,landLum));
      vec3 baseCol=mix(landCol,oceanCol,oceanMask);
      // 도시 불빛(밤면의 주인공): night 텍스처 → 따뜻한 주황/앰버. 강하게.
      float cityLum=dot(nightTex,vec3(0.3,0.59,0.11));
      vec3 cityCol=vec3(1.0,0.64,0.30)*pow(cityLum,0.6)*6.0;    // 주황빛 도시광 강조
      // 낮면 살짝(가장자리 림쪽 햇빛): 대부분 밤, 일부만 낮.
      float NdotL=dot(n,sun);
      float dayFactor=smoothstep(0.15,0.9,NdotL);              // 좁은 낮면
      vec3 sunlitCol=mix(baseCol, mix(dayTex*1.1, oceanCol*2.2, oceanMask), dayFactor*0.6);
      vec3 col=sunlitCol + cityCol*(1.0-dayFactor*0.6);        // 밤면에 도시광
      // 대기 산란(터미네이터 시안 글로우) — 낮/밤 경계가 빛남.
      float term=smoothstep(-0.5,0.3,NdotL)*(1.0-smoothstep(0.3,0.9,NdotL));
      col+=vec3(0.10,0.40,0.70)*term*0.6;
      // 가장자리: 어둡게 하지 않고 오히려 살짝 시안빛 더해 대기 글로우와 자연스럽게 이어지게.
      float rim=1.0-max(dot(viewDir,n),0.0);
      col+=pow(rim,3.0)*vec3(0.06,0.22,0.40);
      gl_FragColor=vec4(col*uReveal,1.0);
    }`
  const atmVert = `varying vec3 vNormal; varying vec3 vWorldN;
    void main(){
      vNormal=normalize(normalMatrix*normal);          // view-space (림 계산)
      vWorldN=normalize(mat3(modelMatrix)*normal);     // world-space (태양 방향 비교)
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`
  const atmFrag = `varying vec3 vNormal; varying vec3 vWorldN;
    uniform float uReveal; uniform vec3 uSunDir;
    void main(){
      float d=dot(vNormal,vec3(0.0,0.0,1.0));
      // 레퍼런스: 날카로운 선 없이 우주로 부드럽게 번져 사라지는 글로우.
      // 코어 라인 제거 → 부드러운 falloff 하나만. 지수 낮춰 폭넓게 번지게.
      float edge=clamp(1.0-d,0.0,1.0);
      float halo=pow(edge,4.5);                        // 가파른 falloff → 얇고 표면에 붙는 글로우
      halo*=halo*(3.0-2.0*halo);                       // smoothstep → 부드럽게
      // 광원 방향: 태양 향한 쪽만 밝고 반대쪽은 거의 사라짐(균일함 깨기).
      float sunLit=clamp(dot(normalize(vWorldN),normalize(uSunDir))*0.5+0.5,0.0,1.0);
      float lit=mix(0.06,1.0,smoothstep(0.0,1.0,sunLit));
      float top=clamp(vNormal.y*0.5+0.5,0.0,1.0);
      vec3 lo=vec3(0.07,0.38,0.66);
      vec3 hi=vec3(0.32,0.80,1.0);
      vec3 tint=mix(lo,hi,top);
      vec3 col=tint*halo*1.1*lit;                       // 불투명도(강도) 대폭 낮춤
      gl_FragColor=vec4(col*uReveal,1.0);}`

  const earthGroup = new THREE.Group()
  scene.add(earthGroup)
  earthGroup.position.y = -0.15
  // 초기 정면을 유럽·아시아(유라시아) 쪽으로 회전 — 아프리카 정중앙 비중 줄임.
  earthGroup.rotation.y = -3.3
  earthGroup.rotation.x = 0.12

  // 실제 지구 텍스처(주간 Blue Marble + 야간 도시광). 로드 전엔 단색 placeholder.
  const blank = new THREE.DataTexture(new Uint8Array([12, 40, 90, 255]), 1, 1, THREE.RGBAFormat)
  blank.needsUpdate = true
  const nightBlank = new THREE.DataTexture(new Uint8Array([4, 10, 24, 255]), 1, 1, THREE.RGBAFormat)
  nightBlank.needsUpdate = true
  // uReveal: 텍스처 로드 전 0(숨김) → 로드 완료 시 1로 페이드인(파란 단색 구 깜빡임 방지).
  const uReveal = { value: 0 }
  let texLoaded = 0
  const earthUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.35, 0.25, 1.0).normalize() },
    uDay: { value: blank },
    uNight: { value: nightBlank },
    uReveal,
  }
  ;(function loadEarthTextures() {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const done = () => { texLoaded += 1 }
    loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace; earthUniforms.uDay.value = t; done()
    })
    loader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace; earthUniforms.uNight.value = t; done()
    })
  })()
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 80, 80),
    new THREE.ShaderMaterial({ uniforms: earthUniforms, vertexShader: earthVert, fragmentShader: earthFrag }),
  )
  earthGroup.add(earthMesh)
  const atmMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { uReveal, uSunDir: earthUniforms.uSunDir },
      vertexShader: atmVert, fragmentShader: atmFrag,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
    }),
  )
  earthGroup.add(atmMesh)

  const CAM_FROM = new THREE.Vector3(0, 1.1, 4.2), CAM_TO = new THREE.Vector3(0, 0.5, 2.9)
  const LOOK_FROM = new THREE.Vector3(0, -0.2, 0), LOOK_TO = new THREE.Vector3(0, -0.1, 0)
  camera.position.copy(CAM_FROM)

  // 전환 다이브인(globe 룩 불변 — 카메라 모션만). 지구본이 화면을 꽉 채울 때까지 가속 줌.
  // 반경 1 구가 세로·가로 모두를 덮는 카메라 거리를 화면비로 계산(고정 z는 넓은 화면서 가로 못 덮음).
  // PerspectiveCamera FOV는 세로 기준 → 가로(aspect>1)는 유효 반각이 좁아 더 가까이 가야 덮인다.
  // 거리 d 에서 화면에 꽉 차려면: 세로 d_v=1/sin(fovV/2), 가로 d_h=1/sin(fovH/2). 더 가까운(큰 덮음) 쪽 채택 후 여유.
  function zoomDistForFill() {
    const fovV = (camera.fov * Math.PI) / 180
    const aspect = camera.aspect || innerWidth / innerHeight
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)
    const dV = 1 / Math.sin(fovV / 2)
    const dH = 1 / Math.sin(fovH / 2)
    // 가로·세로 모두 꽉 차려면 더 가까운(작은) 거리. ×0.92로 살짝 더 들여 가장자리 여백 제거.
    return Math.min(dV, dH) * 0.92
  }
  const ZOOM_TO = new THREE.Vector3(0, 0.05, zoomDistForFill())
  let zooming = false, zoomStart = 0, ZOOM_FROM = null
  const ZOOM_MS = 1300
  // 다이브 종료 시 평면지도가 "그 자리에서 펴지게" — globe 정면 경도를 평면 중심에 맞춤.
  // SphereGeometry+equirectangular 매핑상 rotation.y=0이면 정면 u=0.25(경도 -90).
  let frontLon = null
  const FRONT_LON_ADJ = 0              // 실측 보정(필요시): D3 구체 중심을 three.js 정면에 맞춤
  const FRONT_LAT = 0                  // D3 구체 시작 위도(three.js 정면 위도에 맞춤)
  function frontLonOf(rotY) {
    let u = 0.25 + rotY / (2 * Math.PI)
    u -= Math.floor(u)                 // 0..1
    return -180 + u * 360 + FRONT_LON_ADJ
  }

  let camT = 0, camDone = false, autoRotate = true, lastT = 0
  renderer.setAnimationLoop((t) => {
    if (disposed) return
    const dt = Math.min((t - lastT) / 1000, 0.05); lastT = t
    earthUniforms.uTime.value = t * 0.001
    // 텍스처 2장 다 로드되면 부드럽게 페이드인(로드 전 단색 구 깜빡임 방지)
    if (texLoaded >= 2 && uReveal.value < 1) uReveal.value = Math.min(uReveal.value + dt * 1.8, 1)
    if (zooming) {
      // 지구로 다이브인: 줌이 끝까지 계속 움직이는 동안 페이드가 겹쳐 평면으로 인계.
      // 정지 구간 없이(멈춰 보이는 '렉' 방지) 카메라가 멈추기 전에 전환이 끝난다.
      const zp = Math.min((t - zoomStart) / ZOOM_MS, 1)
      const e = zp * zp   // easeIn(가속): 표면을 향해 파고듦
      camera.position.lerpVectors(ZOOM_FROM, ZOOM_TO, e)
      camera.lookAt(0, -0.05, 0)
    } else if (!camDone) {
      camT = Math.min(camT + dt * 0.32, 1)
      const e = easeOut(camT)
      camera.position.lerpVectors(CAM_FROM, CAM_TO, e)
      camera.lookAt(new THREE.Vector3().lerpVectors(LOOK_FROM, LOOK_TO, e))
      if (camT >= 1) { camDone = true; camera.lookAt(0, -0.1, 0) }
    }
    if (autoRotate) earthGroup.rotation.y += dt * 0.085
    renderer.render(scene, camera)
  })

  // ── D3 평면지도 ──
  let LAND = [], flatReady = false, proj, pathFn, F = null
  let W = innerWidth, H = innerHeight

  d3.json(TOPO_URL).then((topo) => {
    if (disposed) return
    W = stage.clientWidth || innerWidth
    H = stage.clientHeight || (innerHeight - 56)
    proj = d3.geoNaturalEarth1().scale(W / 5.4).translate([W / 2, H * 0.46]).precision(0.4)
    pathFn = d3.geoPath(proj)
    LAND = feature(topo, topo.objects.countries).features
    flatReady = true
  })

  function renderFlat() {
    if (!F) return
    F.ocean.attr('d', pathFn({ type: 'Sphere' }))
    F.grat.attr('d', pathFn(d3.geoGraticule10()))
    F.land.attr('d', pathFn)
    F.arcs.forEach((a) => a.sel.attr('d', pathFn(a.line)))
    F.markers.forEach((m) => {
      const xy = proj(m.capital)
      if (xy) m.node.setAttribute('transform', `translate(${xy[0]},${xy[1]})`)
    })
  }

  function buildFlatSVG() {
    // 다이브로 넘어온 경우: globe 정면 경도를 평면 중심으로 회전 → 같은 대륙이 같은 자리에서 펴짐.
    if (frontLon != null && proj) {
      proj.rotate([-frontLon, 0]).translate([W / 2, H * 0.46])
      pathFn = d3.geoPath(proj)
    }
    const sel = d3.select(svg).attr('viewBox', `0 0 ${W} ${H}`)
    sel.selectAll('*').remove()
    const defs = sel.append('defs')
    const og = defs.append('radialGradient').attr('id', 'fm-ocean')
      .attr('cx', '38%').attr('cy', '34%').attr('r', '82%')
    ;[['0%', '#eaf2fb'], ['55%', '#cfe0f5'], ['100%', '#a9c6e8']]
      .forEach((s) => og.append('stop').attr('offset', s[0]).attr('stop-color', s[1]))
    const mf = defs.append('filter').attr('id', 'mkGlow')
      .attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%')
    mf.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'b')
    const fm2 = mf.append('feMerge'); fm2.append('feMergeNode').attr('in', 'b'); fm2.append('feMergeNode').attr('in', 'SourceGraphic')

    F = {}
    // 레이어: 바다(sphere) → 위경도선 → 육지 → 아크 → 마커 (대기광은 three.js 가 담당)
    F.ocean = sel.append('path').attr('class', 'ocean-sphere')
      .attr('fill', 'url(#fm-ocean)').attr('stroke', 'rgba(58,117,196,0.35)').attr('stroke-width', 1)
    F.grat = sel.append('path').attr('class', 'graticule')

    const activeIds = new Set(CATALOG.filter((d) => d.is_baseline).map((d) => ISO_NUM[d.code]))
    // 각 육지에 권역코드 부여(NUM_ISO→국가코드→권역). 권역 없는 나라는 null.
    const regionOfFeature = (d) => { const c = NUM_ISO[d.id]; return c ? _regionOf(c) : null }
    F.land = sel.append('g').selectAll('path').data(LAND).enter().append('path')
      .attr('class', 'country-land')
      .classed('region-active', (d) => activeIds.has(d.id))
      .attr('data-region', (d) => regionOfFeature(d) || null)
    if (onSelectRegion || onSelectCountry) {
      F.land
        .style('cursor', (d) => (NUM_ISO[d.id] ? 'pointer' : 'default'))
        // 마우스오버: 같은 권역 전체를 하이라이트(국가 단위 아님) + 권역명 라벨 표시.
        .on('mouseenter', (event, d) => {
          const region = regionOfFeature(d)
          if (region) {
            F.land.classed('region-hover', (x) => regionOfFeature(x) === region)
            showRegionLabel(region)
          } else {
            d3.select(event.currentTarget).classed('region-hover', true)
          }
        })
        .on('mouseleave', () => { F.land.classed('region-hover', false); hideRegionLabel() })
        .on('click', (event, d) => {
          const c = NUM_ISO[d.id]; if (!c) return
          const region = _regionOf(c)
          // baseline 보유 권역만 P2 권역보고서로. SA·MX 등은 국가(P1) 폴백.
          if (region && BASELINE_REGIONS.has(region) && onSelectRegion) onSelectRegion(region)
          else if (onSelectCountry) onSelectCountry(c)
        })
    }

    const arcG = sel.append('g').attr('id', 'arc-layer')
    F.arcs = CATALOG.map((d) => {
      const line = { type: 'LineString', coordinates: [HQ.lonlat, d.capital] }
      const sel2 = arcG.append('path')
        .attr('class', 'arc ' + (d.is_baseline ? 'base' : 'cand'))
        .attr('id', 'arc-' + d.code).style('opacity', 0)
      return { sel: sel2, line, code: d.code }
    })

    const mkG = sel.append('g').attr('id', 'marker-layer')
    const all = CATALOG.concat([{ code: 'HQ', country_ko: HQ.name, capital: HQ.lonlat, is_hq: true }])
    F.markers = []
    all.forEach((d) => {
      // 바깥 g: 위치(translate). markerDrop 애니메이션 transform 이 위치를 안 덮게 분리.
      const pos = mkG.append('g').attr('id', 'mk-' + d.code)
      const g = pos.append('g').attr('class', 'mk')
      if (d.is_hq || d.is_baseline) g.append('circle').attr('class', 'pulse')
      g.append('circle').attr('r', 12).attr('fill', 'none').attr('stroke', '#2F79D9')
        .attr('stroke-opacity', 0.3).attr('filter', 'url(#mkGlow)')
      g.append('circle').attr('r', d.is_hq ? 7 : 6)
        .attr('fill', (d.is_hq || d.is_baseline) ? '#2F79D9' : '#fff')
        .attr('stroke', '#2F79D9').attr('stroke-width', (d.is_hq || d.is_baseline) ? 0 : 1.5)
      g.append('text').attr('class', 'mk-label').attr('x', 0).attr('y', -15)
        .attr('text-anchor', 'middle').text(d.is_hq ? 'SEOUL HQ' : d.country_ko)
      if (!d.is_hq && onSelectCountry) {
        g.style('cursor', 'pointer').on('click', () => onSelectCountry(d.code))
        g.append('circle').attr('r', 16).attr('fill', 'transparent')
      }
      F.markers.push({ node: pos.node(), capital: d.capital })
    })

    // 권역명 라벨(hover 시 빈 곳에 표시) — 마커보다 위 레이어.
    F.regionLabel = sel.append('text').attr('class', 'region-label')
      .attr('text-anchor', 'middle').style('opacity', 0)
    renderFlat()
  }

  // 권역 hover 시: 권역 라벨 위치(경위도)를 화면 좌표로 투영해 표시.
  function showRegionLabel(region) {
    if (!F || !F.regionLabel) return
    const name = REGION_NAMES[region]; if (!name) return
    const ll = REGION_LABEL_LONLAT[region]; if (!ll) return
    const xy = proj(ll); if (!xy) return
    F.regionLabel.attr('x', xy[0]).attr('y', xy[1]).text(name).style('opacity', 1)
  }
  function hideRegionLabel() {
    if (F && F.regionLabel) F.regionLabel.style('opacity', 0)
  }

  function animateMarkers() {
    const order = ['HQ'].concat(CATALOG.map((d) => d.code))
    order.forEach((code, i) => {
      const delay = 150 + i * 240
      setT(() => {
        const pos = document.getElementById('mk-' + code)
        const mk = pos && pos.querySelector('.mk')
        if (!mk) return
        // 애니메이션은 안쪽 .mk 에만 — 바깥 위치 translate 보존.
        mk.style.animation = 'markerDrop 0.55s cubic-bezier(.34,1.56,.64,1) forwards'
        setT(() => { const lbl = mk.querySelector('.mk-label'); if (lbl) lbl.style.animation = 'labelFade 0.4s ease forwards' }, 320)
      }, delay)
      if (code !== 'HQ') {
        setT(() => {
          const arc = document.getElementById('arc-' + code)
          if (!arc) return
          arc.style.opacity = '1'
          arc.style.transition = 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)'
          arc.style.strokeDashoffset = '0'
        }, delay + 80)
      }
    })
  }

  function transitionToFlat() {
    if (disposed) return
    // v2.0: 평면지도는 외부(MapView)가 담당 → 자체 SVG 펼침 단계 제거.
    // 밤의 지구로 다이브인 한 뒤 지구를 페이드아웃하고 onIntroDone 으로 인계.
    // ① 자전 멈추고 다이브 시작. 도착 거리는 현재 화면비로 재계산(리사이즈 대응).
    autoRotate = false
    camDone = true
    ZOOM_TO.z = zoomDistForFill()
    ZOOM_FROM = camera.position.clone()
    zoomStart = performance.now()
    zooming = true
    // ② 줌이 화면을 꽉 채우는 후반부에 페이드를 겹쳐, 카메라가 계속 움직이는 동안 평면으로 인계.
    //    가속 줌이라 ~70%에 거의 꽉 참 → 곧바로 페이드 시작, 빠르게 인계(정지 프레임=렉 느낌 제거).
    //    흰 틈 방지: 페이드 완료 전에 인계 → MapView 가 깔린 위에서 캔버스가 마저 사라짐.
    let handedOff = false
    const dur = ZOOM_MS, t0 = performance.now()
    ;(function fade() {
      if (disposed) return
      const raw = Math.min((performance.now() - t0) / dur, 1)
      const p = Math.max(0, (raw - 0.75) / 0.25)   // 75% 지점(화면 꽉 참)부터 페이드 시작
      earthGroup.children.forEach((m) => {
        if (!m.material) return
        m.material.transparent = true
        m.material.opacity = Math.max(0, 1 - easeOut(p))
      })
      if (!handedOff && raw >= 0.82) {
        handedOff = true
        canvas.style.transition = 'opacity .4s'; canvas.style.opacity = '0'
        if (onIntroDone) onIntroDone()   // MapView 로 인계(캔버스는 위에서 마저 페이드)
      }
      if (raw < 1) requestAnimationFrame(fade)
      else { autoRotate = false; zooming = false; renderer.setAnimationLoop(null) }
    })()
  }

  // ── 공개 API ──
  function runIntro() {
    if (reducedMotion) { skipIntro(); return }
    setT(transitionToFlat, 3200)
    // onIntroDone 은 다이브 페이드 종료 시 transitionToFlat 내부에서 호출(중복 타이머 제거).
  }

  function skipIntro() {
    // 딥링크/reduced-motion: 인트로 없이 바로 인계(평면지도는 MapView 담당).
    camDone = true; autoRotate = false
    const tryFlat = () => {
      if (disposed) return
      renderer.setAnimationLoop(null)
      canvas.style.opacity = '0'
      if (onIntroDone) onIntroDone()
    }
    tryFlat()
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
  }
  window.addEventListener('resize', onResize)

  function destroy() {
    disposed = true
    timers.forEach(clearTimeout)
    window.removeEventListener('resize', onResize)
    renderer.setAnimationLoop(null)
    renderer.dispose()
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()) }
    })
  }

  return { runIntro, skipIntro, destroy }
}
