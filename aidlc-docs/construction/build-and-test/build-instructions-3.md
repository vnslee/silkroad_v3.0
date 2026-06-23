# Build Instructions — frontend (3차)

## Prerequisites
- **Node**: v20.20.2, **npm**: 10.8.2
- **백엔드**: 1·2차 FastAPI(`app/backend`)가 `localhost:8000`에서 실행(연동·통합 스모크 시)
- **위치**: `app/frontend/`

## Build Steps

### 1. 의존성 설치
```bash
cd app/frontend
npm install
```
- 결과: 314 packages 설치(React18·Vite5·TS5·Tailwind3·D3 7·Vitest2·RTL 등 `^`핀 + lock).

### 2. 타입체크
```bash
npm run typecheck   # tsc --noEmit
```

### 3. 프로덕션 빌드
```bash
npm run build       # tsc --noEmit && vite build
```
- 산출물: `dist/`(index.html + assets, 코드 스플리팅: DetailView/ReportView/RulesetForm 별도 청크).

### 4. 개발 서버(연동)
```bash
npm run dev         # vite, http://localhost:5173, /api → :8000 프록시
```

## Verify Build Success
- `tsc --noEmit`: 0 에러
- `vite build`: "built in N s" + dist 청크 출력
- 메인 번들 gzip ~77KB
