# Tech Stack Decisions — frontend (3차)

> 프론트엔드 기술 스택 확정·버전 정책·근거. 환경: Node v20.20.2, npm 10.8.2.

## 1. 핵심 스택 (requirements-3·Application Design 확정)
| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **React 18** | ROADMAP 확정·mockup React화 |
| 빌드 | **Vite 5** | ROADMAP 확정·dev proxy·빠른 HMR·코드 스플리팅 |
| 언어 | **TypeScript 5** | 타입 안전(schemas.py 1:1 타입), Q6 경량 |
| 스타일 | **Tailwind CSS 3** | mockup 동일 스택, DESIGN.md 토큰 매핑(시맨틱) |
| 지도/인트로 | **D3 7** | intro_spec 지구본·지도 통합(Q4=A) |
| 라우팅 | **react-router 6**(또는 경량) | URL hash 딥링크·mode 쿼리(Q3=A·Q8=A) |
| 테스트 | **Vitest 2 + @testing-library/react** | Vite 네이티브·경량(Q6) |
| 서버상태 | **없음(fetch + 커스텀 훅)** | 경량(Application Design Q6=A), 라이브러리 미도입 |

## 2. 버전 핀 정책 — Q1=A
- **메이저 핀(캐럿 `^`)** + `package-lock.json`으로 재현성 확보. (정확 핀 B 미채택)
- 예시(`package.json` dependencies/devDependencies):
  ```jsonc
  {
    "dependencies": {
      "react": "^18", "react-dom": "^18",
      "react-router-dom": "^6",
      "d3": "^7"
    },
    "devDependencies": {
      "vite": "^5", "@vitejs/plugin-react": "^4",
      "typescript": "^5",
      "tailwindcss": "^3", "postcss": "^8", "autoprefixer": "^10",
      "vitest": "^2", "@testing-library/react": "^16", "@testing-library/jest-dom": "^6",
      "jsdom": "^25",
      "@types/react": "^18", "@types/react-dom": "^18", "@types/d3": "^7"
    }
  }
  ```
  > 정확한 minor는 설치 시점 최신 안정으로 lock에 고정. world atlas 지오데이터(`topojson`/`world-atlas` 등)는 마커 구현 시 확정(Q7=A).

## 3. 빌드·게이트 (npm 스크립트) — Q4=A
```jsonc
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "preview": "vite preview"
}
```
- 게이트: `build`(번들)·`typecheck`·`test`. CI 자동화는 4차.

## 4. dev proxy (vite.config) — requirements-3 Q2=A
```ts
server: { proxy: { '/api': 'http://localhost:8000' } }
```
- 백엔드 미가동 시 화면별 빈 상태/에러(요구사항).

## 5. Tailwind 토큰 매핑 (DESIGN.md → tailwind.config) — Q2·DR-1
- `theme.extend`: colors(Kinetic Enterprise 시맨틱), fontFamily(Hanken Grotesk), fontSize(display/headline/body/label + mobile 변형), spacing(4px 베이스), borderRadius(8px 표준·12px 오버레이), boxShadow(elevation), zIndex.
- 그리드: 컨테이너/그리드 유틸로 4/8/12 컬럼 반응(DESIGN.md). raw hex 금지.

## 6. 브라우저 타깃 — Q5=A
- 모던 에버그린, ES2020+. Vite 기본 esbuild 타깃. 폴리필 최소.

## 7. 미채택 / 스코프 밖
- TanStack Query 등 서버상태 라이브러리(경량 기조), 정량 성능 게이트, CI 파이프라인(4차), SES 메일(별도 범위), Redux 등 대형 상태관리(경량 store로 충분).
