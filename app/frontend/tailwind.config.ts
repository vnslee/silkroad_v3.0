import type { Config } from 'tailwindcss'

// AISea(architecture/design/stitch/DESIGN.md) 비주얼 언어를 시맨틱 Tailwind 토큰으로 매핑.
// 셸 전반이 시맨틱 클래스(text-on-surface, bg-primary 등)를 쓰므로 hex만 리매핑하면
// 손대지 않은 위치도 자동으로 온브랜드가 된다. raw hex 직접 사용은 지양(시맨틱 클래스 우선).
// 팔레트 출처(DESIGN.md): 잉크블랙 primary #14181C / 라임그린 accent #C8F051 / 베이지 배경 #EDEBE4.
// 핵심: 라임그린은 밝아 텍스트 대비가 약하므로 '면(fill) 액션'(accent)에만 쓰고,
//       텍스트·제목·보더 강조는 잉크블랙(primary)으로 둔다(접근성).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // 반응형 그리드(Mobile 4 / Tablet 8 / Desktop 12 컬럼) — 유지.
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        // ── 면(surface) — 앱 배경 베이지 #EDEBE4, 카드 흰색, 베이지 톤 위계 ──
        surface: '#EDEBE4',
        'surface-dim': '#dcd9cf',
        'surface-bright': '#fbf9f4',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f7f6f1',
        'surface-container': '#f2f0e9',
        'surface-container-high': '#ebe9e1',
        'surface-container-highest': '#e6e3db',
        'on-surface': '#14181C',
        'on-surface-variant': '#3a4048',
        'inverse-surface': '#14181C',
        'inverse-on-surface': '#EDEBE4',
        outline: '#9AA0A6',
        'outline-variant': '#E6E3DB',
        'surface-tint': '#C8F051',
        // ── 브랜드/액션 — 잉크블랙 primary + 라임그린 accent ──
        primary: '#14181C',
        'on-primary': '#ffffff',
        'primary-container': '#1f262d',
        'on-primary-container': '#d7dadd',
        'inverse-primary': '#C8F051',
        // accent: 라임그린 — 버튼·선택 등 '면 액션'에만(텍스트는 on-accent 잉크블랙)
        accent: '#C8F051',
        'on-accent': '#14181C',
        'accent-container': '#eef9c9',
        'on-accent-container': '#2c3500',
        // secondary: 잉크 그레이(보조 액션·링크). 라임그린 대비 약점 회피.
        secondary: '#3a4048',
        'on-secondary': '#ffffff',
        'secondary-container': '#dfe2e5',
        'on-secondary-container': '#1b2026',
        tertiary: '#4d000a',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#750015',
        'on-tertiary-container': '#ff7576',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        // fixed 계열 — 라임그린 옅은 강조(배지·하이라이트)
        'primary-fixed': '#eef9c9',
        'primary-fixed-dim': '#dcf2a3',
        'on-primary-fixed': '#2c3500',
        'on-primary-fixed-variant': '#404d00',
        'secondary-fixed': '#dfe2e5',
        'secondary-fixed-dim': '#c3c8cd',
        'on-secondary-fixed': '#14181C',
        'on-secondary-fixed-variant': '#3a4048',
        'tertiary-fixed': '#ffdad8',
        'tertiary-fixed-dim': '#ffb3b1',
        'on-tertiary-fixed': '#410007',
        'on-tertiary-fixed-variant': '#92001c',
        background: '#EDEBE4',
        'on-background': '#14181C',
        'surface-variant': '#e6e3db',
        'surface-light': '#F7F6F1',
        'surface-border': '#E6E3DB',
        'text-primary': '#14181C',
        'text-secondary': '#3a4048',
        'text-disabled': '#9AA0A6',
        'accent-red': '#E63946',
        // ── 지역색(AISea) — 지도·엠블럼·차트 권역 구분 ──
        'region-na': '#4F8BFF',
        'region-sa': '#34D399',
        'region-me': '#FBBF24',
        'region-eu': '#C8F051',
        'region-apac': '#FB7185',
        // ── 상태색(진단 신호) — 데이터 의미색, 테마와 무관하게 보존 ──
        success: '#137333',
        'success-container': '#e6f4ea',
        warn: '#b06000',
        'warn-container': '#fef7e0',
        danger: '#c5221f',
        'danger-container': '#fce8e6',
      },
      fontFamily: {
        // 본문: 라틴/숫자 Hanken Grotesk, 한글 Pretendard 자동 fallback.
        sans: ['Hanken Grotesk', 'Pretendard', 'system-ui', 'sans-serif'],
        // 제목/강조: AISea Space Grotesk(테크 무드) → Hanken → Pretendard fallback.
        display: ['Space Grotesk', 'Hanken Grotesk', 'Pretendard', 'sans-serif'],
        mono: ['Hanken Grotesk', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // 유체 타이포(fluid type) — 화면 너비 360~1440px 구간에서 폰트가 부드럽게 스케일.
        // clamp(최소 0.85배, 뷰포트 선형 보간, 최대 1.15배). lineHeight도 1.x 비율로 풀어 동반 스케일.
        // 보고서(PR1/PR2)·상세화면(P1/P2)이 이 토큰을 쓰므로 해상도에 자동 반응한다.
        'display-lg': ['clamp(40.8px, calc(36px + 1.333vw), 55.2px)', { lineHeight: '1.17', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['clamp(27.2px, calc(24px + 0.889vw), 36.8px)', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg-mobile': ['clamp(20.4px, calc(18px + 0.667vw), 27.6px)', { lineHeight: '1.33', fontWeight: '700' }],
        'headline-md': ['clamp(20.4px, calc(18px + 0.667vw), 27.6px)', { lineHeight: '1.33', fontWeight: '600' }],
        'body-lg': ['clamp(15.3px, calc(13.5px + 0.5vw), 20.7px)', { lineHeight: '1.56', fontWeight: '400' }],
        'body-md': ['clamp(13.6px, calc(12px + 0.444vw), 18.4px)', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['clamp(11.9px, calc(10.5px + 0.389vw), 16.1px)', { lineHeight: '1.43', fontWeight: '400' }],
        'label-md': ['clamp(10.2px, calc(9px + 0.333vw), 13.8px)', { lineHeight: '1.33', letterSpacing: '0.05em', fontWeight: '600' }],
        'label-sm': ['clamp(9.35px, calc(8.25px + 0.306vw), 12.65px)', { lineHeight: '1.27', fontWeight: '500' }],
      },
      spacing: {
        // 4px 베이스 증분(DESIGN.md)
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        gutter: '24px',
        'margin-mobile': '16px',
        'margin-desktop': '48px',
      },
      borderRadius: {
        // AISea는 16~30px로 더 둥글다(현 8/12px → 상향).
        sm: '0.5rem', // 8px
        DEFAULT: '0.75rem', // 12px
        md: '1rem', // 16px
        lg: '1.25rem', // 20px
        xl: '1.875rem', // 30px
        full: '9999px',
      },
      zIndex: {
        map: '0',
        chrome: '10',
        overlay: '20',
        popup: '30',
        chat: '40',
        toast: '50',
      },
    },
  },
  plugins: [],
} satisfies Config
