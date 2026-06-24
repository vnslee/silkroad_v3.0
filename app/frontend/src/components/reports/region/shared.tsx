// 권역 보고서(PR2) 공통 헬퍼 — 국가 표기·플래그·밴드 색·소스 플래그 배지.
// mockup 04_region_report.html 의 raw hex / 클래스를 그대로 옮겼다.
import { useT } from '../../../i18n/dict'

/** 평가 후보 9개국 + 기준국 한글명 매핑 (JSON엔 영문명만 있음). */
export const COUNTRY_KO: Record<string, string> = {
  AR: '아르헨티나',
  AT: '오스트리아',
  AU: '호주',
  BR: '브라질',
  CA: '캐나다',
  CL: '칠레',
  CN: '중국',
  DE: '독일',
  DK: '덴마크',
  ES: '스페인',
  FR: '프랑스',
  GB: '영국',
  ID: '인도네시아',
  IN: '인도',
  IT: '이탈리아',
  JP: '일본',
  KR: '대한민국',
  MX: '멕시코',
  NL: '네덜란드',
  NZ: '뉴질랜드',
  PL: '폴란드',
  PR: '푸에르토리코',
  PT: '포르투갈',
  SG: '싱가포르',
  US: '미국',
}

export function countryKo(code: string, fallback?: string): string {
  return COUNTRY_KO[code] ?? fallback ?? code
}

/**
 * 매력도·IT 축 이름 한→영 매핑 (백엔드 weights/contributions/axes 키는 한글뿐 .en 없음).
 * 키는 region 리포트 JSON에서 추출(GDP 성장률·경쟁강도 등). 미등록 키는 원문 폴백.
 */
const AXIS_EN: Record<string, string> = {
  'GDP 성장률': 'GDP growth',
  '자동차 판매대수': 'Car sales volume',
  시장규모: 'Market size',
  '오토금융 성장률(CAGR)': 'Auto finance growth (CAGR)',
  '금융 이용률': 'Finance penetration',
  금융이용유형: 'Finance usage type',
  경쟁강도: 'Competition intensity',
  '디지털 채널 성숙도': 'Digital channel maturity',
  데이터현지화: 'Data localization',
  '라이선스 종류': 'License type',
  '솔루션 유형': 'Solution type',
  '차량회수 절차': 'Vehicle repossession process',
}

/** 축 이름 표시 — en이면 매핑(없으면 원문), 그 외 한글 원문 그대로. */
export function axisLabel(lang: 'ko' | 'en', axis: string): string {
  if (lang === 'en') return AXIS_EN[axis] ?? axis
  return axis
}

/**
 * 임의 스칼라값을 표시 문자열로 안전 변환 — null/undefined면 '—'(리서치 데이터 필드
 * 누락 시 화면에 "undefined"가 그대로 노출되던 회귀 방지). 빈 String(...) 대체용.
 */
export function dash(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

/** flagcdn 국기 URL. width 변형 지원(w80/w160). */
export function flagUrl(code: string, w: 80 | 160 = 80): string {
  return `https://flagcdn.com/w${w}/${code.toLowerCase()}.png`
}

/** 국기 이미지 — 로드 실패 시 숨김. */
export function Flag({ code, className = 'w-5 h-4' }: { code: string; className?: string }) {
  return (
    <img
      src={flagUrl(code)}
      className={`${className} object-cover rounded-sm shrink-0`}
      alt=""
      loading="lazy"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
      }}
    />
  )
}

/**
 * 순위/스코어 막대 색 (mockup quickwin·attractiveness 막대 체계).
 *   ≥60 blue(#2f6be0) · ≥50 amber(#c08a2e) · 그 미만 red(#c0533f)
 * mockup은 0~100 매력도와 10점 구간 퀵윈에 동일 임계를 쓴다.
 */
export function scoreBarColor(score: number): string {
  if (score >= 60) return '#2f6be0'
  if (score >= 50) return '#c08a2e'
  return '#c0533f'
}

/** 퀵윈 10점 구간 색 (mockup 전체순위/퀵윈 표): ≥60 blue · ≥40 amber · <40 red */
export function quickwinBandColor(band: number): string {
  if (band >= 60) return '#2f6be0'
  if (band >= 40) return '#c08a2e'
  return '#c0533f'
}

/** IT 유사도 히트맵 밴드 색 (배경/글자). mockup band legend 와 동일. */
export function itBandStyle(band: number): { bg: string; fg: string } {
  if (band >= 90) return { bg: '#2f5c46', fg: '#FFFFFF' }
  if (band >= 80) return { bg: '#4f8a6d', fg: '#FFFFFF' }
  if (band >= 70) return { bg: '#6fa98c', fg: '#FFFFFF' }
  if (band >= 60) return { bg: '#c7e2d3', fg: '#2f5c46' }
  if (band >= 50) return { bg: '#fbf3e2', fg: '#8a6a1e' }
  if (band >= 40) return { bg: '#c08a2e', fg: '#FFFFFF' }
  return { bg: '#c0533f', fg: '#FFFFFF' }
}

/** 정규화 막대 색 (매력도 산식 상세): ≥60 green · ≥40 amber · <40 red */
export function normBarColor(norm: number): string {
  if (norm >= 60) return '#4f8a6d'
  if (norm >= 40) return '#c08a2e'
  return '#c0533f'
}

export type SourceFlag = 'CALC' | 'EXT' | 'NEWS' | 'AI' | 'INT'

// 라벨은 i18n 키로 보관(SourcePill 에서 useT 로 해석) — 색만 여기서 고정.
const FLAG_META: Record<string, { bg: string; fg: string; labelKey: string }> = {
  CALC: { bg: '#e9f3ee', fg: '#4f8a6d', labelKey: 'rsrc.calc' },
  EXT: { bg: '#eef0f2', fg: '#3a4048', labelKey: 'rsrc.ext' },
  NEWS: { bg: '#fbf3e2', fg: '#c08a2e', labelKey: 'rsrc.news' },
  AI: { bg: '#e3edff', fg: '#2f6be0', labelKey: 'rsrc.ai' },
  INT: { bg: '#e3edff', fg: '#2f6be0', labelKey: 'rsrc.int' },
}

/** 소스 플래그 pill (mockup engine_msg 배지). suffix 로 "· 2축" 등 부가 텍스트. */
export function SourcePill({ flag, suffix }: { flag: string; suffix?: string }) {
  const t = useT()
  const meta = FLAG_META[flag]
  const m = meta
    ? { bg: meta.bg, fg: meta.fg, label: t(meta.labelKey) }
    : { bg: '#eef0f2', fg: '#3a4048', label: flag }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)] font-semibold tracking-wide"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

/** 섹션 제목 + 소스 pill 묶음 (반복되는 카드 헤더). */
export function SectionHeader({
  title,
  pills,
  className = '',
}: {
  title: string
  pills?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center gap-sm mb-md border-b border-surface-border pb-sm ${className}`}>
      <h2 className="font-headline-md text-headline-md text-primary m-0">{title}</h2>
      {pills}
    </div>
  )
}
