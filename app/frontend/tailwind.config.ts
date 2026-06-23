import type { Config } from 'tailwindcss'

// AISea(architecture/design/AISea/AISea.dc.html) 비주얼 언어를 시맨틱 Tailwind 토큰으로 매핑.
// 셸 전반이 시맨틱 클래스(text-on-surface, bg-primary 등)를 쓰므로 hex만 AISea로 리매핑하면
// 손대지 않은 위치도 자동으로 온브랜드가 된다. raw hex 직접 사용은 지양(시맨틱 클래스 우선).
// 팔레트 출처: AISea 블루 #3F6CB4 / 다크 #101622 / 상태 #4F8A6D·#C08A2E·#C0533F.
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
        // ── 면(surface) — 앱 배경 #EEF0F2, 카드 흰색, 옅은 면 #F7F8FA/#F2F5FA ──
        surface: '#ffffff',
        'surface-dim': '#dbe0e6',
        'surface-bright': '#ffffff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f7f8fa',
        'surface-container': '#f2f5fa',
        'surface-container-high': '#e8edf4',
        'surface-container-highest': '#dce6f5',
        'on-surface': '#14171c',
        'on-surface-variant': '#6b7280',
        'inverse-surface': '#101622',
        'inverse-on-surface': '#f2f5fa',
        outline: '#9aa0a8',
        'outline-variant': '#e6e9ec',
        'surface-tint': '#3f6cb4',
        // ── 브랜드/액션 블루 ──
        primary: '#3f6cb4',
        'on-primary': '#ffffff',
        'primary-container': '#101622', // 다크 헤더·CTA 카드·FAB
        'on-primary-container': '#aebdd6',
        'inverse-primary': '#6e97d6',
        secondary: '#3f6cb4',
        'on-secondary': '#ffffff',
        'secondary-container': '#6e97d6',
        'on-secondary-container': '#1c3a66',
        tertiary: '#4f8a6d',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#e9f3ee',
        'on-tertiary-container': '#3c7359',
        error: '#c0533f',
        'on-error': '#ffffff',
        'error-container': '#f7e1dc',
        'on-error-container': '#8c3424',
        // fixed 계열 — 옅은 블루 강조(배지·하이라이트)
        'primary-fixed': '#eaf0f8',
        'primary-fixed-dim': '#cbd9ee',
        'on-primary-fixed': '#1c3a66',
        'on-primary-fixed-variant': '#3f6cb4',
        'secondary-fixed': '#eaf0f8',
        'secondary-fixed-dim': '#cbd9ee',
        'on-secondary-fixed': '#1c3a66',
        'on-secondary-fixed-variant': '#3f6cb4',
        'tertiary-fixed': '#e9f3ee',
        'tertiary-fixed-dim': '#c7e3d6',
        'on-tertiary-fixed': '#2c5544',
        'on-tertiary-fixed-variant': '#3c7359',
        background: '#eef0f2',
        'on-background': '#14171c',
        'surface-variant': '#f2f5fa',
        'surface-light': '#f7f8fa',
        'surface-border': '#e6e9ec',
        'text-primary': '#14171c',
        'text-secondary': '#6b7280',
        'text-disabled': '#9aa0a8',
        'accent-red': '#c0533f',
        // ── 상태색(AISea 진단 신호) ──
        success: '#4f8a6d',
        'success-container': '#e9f3ee',
        warn: '#c08a2e',
        'warn-container': '#f6edda',
        danger: '#c0533f',
        'danger-container': '#f7e1dc',
        // AISea 다크 면(보고서/챗 헤더 그라디언트 보조)
        'aisea-dark': '#101622',
        'aisea-dark-2': '#1f2d45',
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
        // 전체 Pretendard 통일(사용자 요청) — mono 도 Pretendard.
        mono: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', fontWeight: '500' }],
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
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
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
