/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev proxy: /api → FastAPI(localhost:8000) (requirements-3 Q2=A)
export default defineConfig({
  plugins: [react()],
  resolve: {
    // shadcn 관례 — `@/`를 src 루트에 매핑(components/ui·lib/utils 등). 기존 상대경로 import는 그대로 동작.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // base 상대경로(`./`) — 자산을 index.html 위치 기준 상대로 참조한다.
  // code-editor 포트 프록시(`/ports/8000/app/` 처럼 경로 prefix가 붙는 환경)에서도
  // 자산 URL이 현재 경로를 따라가도록 보장(절대경로 `/app/`는 prefix 밖으로 나가 404).
  base: './',
  server: {
    // 원격/프록시 도메인(CloudFront 등)으로 dev 서버에 접속할 때 호스트 차단 해제.
    // 로컬 데모/터널 환경 편의용 — 프로덕션은 nginx(Dockerfile)로 서빙하므로 영향 없음.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // preview(프로덕션 빌드 서빙) — CloudFront 등 프록시 환경에서 dev 서버의 /@vite/* 특수 경로
  // 404 문제를 피하기 위해 빌드 산출물을 정적 서빙. dev와 동일하게 /api 프록시·호스트 허용.
  preview: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
