# Code Summary — frontend (3차)

> Code Generation Part 2 산출물 요약. 22단계 전부 완료. 게이트(tsc·vitest·vite build·백엔드 py_compile) 통과.

## 생성·수정 파일

### 백엔드 detail 잡 확장 (Step 1~4, 무파괴)
| 파일 | 변경 |
|---|---|
| `app/backend/api/schemas.py` | [확장] `DetailJobResult{domain,target_id,html_url}`, JobStatus.result Union 추가 |
| `app/backend/api/services/job_manager.py` | [확장] succeed/_set 타입에 DetailJobResult |
| `app/backend/api/services/detail_orchestrator.py` | [신규] `run_detail_job`(queued→rendering→done) |
| `app/backend/api/routers/detail.py` | [확장] `POST .../detail`(202 잡) 양 도메인 — 동기 `GET .../detail` 보존 |

### 프론트 신규 (`app/frontend/`)
- **설정**: package.json(^핀)·vite.config.ts(dev proxy+vitest)·tsconfig.json·tailwind.config.ts(DESIGN.md 토큰)·postcss.config.js·index.html
- **기반**: `src/main.tsx`·`api/{types,paths,client}.ts`·`store/index.ts`·`hooks/useJobPolling.ts`·`utils/{mailto,progress}.ts`·`styles/index.css`
- **셸/라우팅**: `app/{route.ts,useRoute.ts}`·`app/containers/{PopupContainer,FullscreenContainer}.tsx`·`App.tsx`
- **화면**: `components/map/{GlobeIntro,MapView,TopBar,Legend,Notification,coords}`·`detail/DetailView`·`report/{ReportView,ReportPickerModal}`·`chat/ChatWidget`·`progress/{ProgressModal,ProgressPanel}`·`ruleset/{RulesetForm,validation}`
- **테스트**: `__tests__/{paths,route,mailto,progress,validation}.test.ts` + `{RulesetForm,ReportView}.test.tsx` + `test/setup.ts`

## 게이트 결과
- `tsc --noEmit`: ✅ 통과(0 에러)
- `vitest run`: ✅ **24/24 통과**(7 파일 — FT-1~5 단위 + FC-3·4 컴포넌트 스모크)
- `vite build`: ✅ 성공(코드 스플리팅: Detail/Report/Ruleset 별도 청크, gzip ~77KB 메인)
- 백엔드 `py_compile` + app 로드: ✅ 통과(detail GET+POST 4라우트)

## 설계 정합
- **iframe embed + chrome만 React**(PIPELINE §5): DetailView·ReportView가 iframe src로 HTML 로드, 액션 버튼 전부 chrome. postMessage 없음.
- **진입 모드 2종**(Q2=A): 화면 컴포넌트 모드 무지, App이 Popup/Fullscreen 컨테이너 선택.
- **잡 3종 공용 폴링**(Q1·Q4): useJobPolling 1곳, mapStepToBars가 kind별 분기(research 5바/report 3단계/detail 단일).
- **mailto 무저장**(Q6=A): to 비움·첨부 안내, SES 첨부는 별도 범위.
- **PS1 룰셋**(Q5=A): 합 100 검증·localStorage 저장(백엔드 API 부재).
- **접근성**: iframe title·focus-visible·Esc·aria-live·reduced-motion.
- **DESIGN.md 토큰**: tailwind.config 시맨틱 매핑, raw hex 없음.

## 남은 작업(Build & Test 단계)
- dev proxy 연동 통합 스모크(FI-1·2, 백엔드 가동 상태)
- frontend-design 2-pass·ui-ux-pro-max 검증(구현 충실도·접근성 보강)
- 실제 mockup 대비 시각 충실도 점검(현재는 구조·토큰 충실, 픽셀 완성도는 보강 여지)

## 비고
- world atlas 지오데이터는 현재 `coords.ts` 간이 좌표 테이블(10개국). 전체 지도 폴리곤은 topojson-client + world-atlas로 확장 가능.
- ChatWidget 대상(domain/id)은 데모상 country/ES 기본 — 실서비스는 지도 선택과 연동(후속).
