# Code Generation Plan — frontend (3차)

Code Generation의 **단일 출처(SoT)**. Part 2에서 단계 순서대로 실행, 각 단계 완료 시 `[x]`.

## 컨텍스트
- **Brownfield. Workspace Root**: `/home/participant/silk-road_v1.0`
- **Unit**: frontend. `app/frontend/`에 React+Vite+TS+Tailwind+D3 앱 **신규**. + 백엔드 detail 잡 **소규모 확장**(FD 결정).
- **의존**: 1차 backend-api(완료)·2차 research-chatbot(완료). 기존 엔진·1·2차 핵심 무파괴(detail은 동기 GET 보존하며 추가).
- **환경**: Node v20.20.2·npm 10.8.2.

## 설계 입력
- Application Design 3차: `inception/application-design/*-3.md` (C1~C12·의존·서비스)
- Functional Design 3차: `construction/frontend/functional-design/*-3.md` (TS 타입·L1~L8·VR/ER/AR/SR/DR·컴포넌트·백엔드 확장 요청)
- NFR 3차: `construction/frontend/nfr-requirements/*-3.md` (스택·버전핀·게이트·반응형·접근성)
- 디자인 SoT: web_design_spec·intro_spec·DESIGN.md·stitch mockup 8종·PIPELINE §1/§5

## 산출물 구조
```
app/frontend/
├── index.html · package.json · vite.config.ts · tsconfig.json
├── tailwind.config.ts · postcss.config.js
└── src/
    ├── main.tsx · App.tsx                 # C1
    ├── app/router.tsx · containers/{PopupContainer,FullscreenContainer}.tsx
    ├── api/{client.ts,paths.ts,types.ts}  # C2
    ├── store/index.ts                      # C12
    ├── hooks/useJobPolling.ts              # C10
    ├── utils/mailto.ts · utils/progress.ts # C11 + mapStepToBars
    ├── components/
    │   ├── map/{GlobeIntro,MapView,TopBar,Legend,Notification}.tsx  # C4
    │   ├── chat/ChatWidget.tsx             # C5
    │   ├── detail/DetailView.tsx           # C6
    │   ├── report/{ReportView,ReportPickerModal}.tsx  # C7
    │   ├── ruleset/RulesetForm.tsx         # C8
    │   └── progress/{ProgressModal,ProgressPanel}.tsx # C9
    ├── styles/index.css
    └── __tests__/                          # Vitest
app/backend/api/                            # [확장] detail 잡
├── schemas.py            # [확장] DetailJobResult, JobStep 'rendering' 재사용
├── services/detail_orchestrator.py  # [신규] run_detail_job
└── routers/detail.py     # [확장] POST .../detail (202 잡) — 기존 GET 보존
```

---

## 실행 단계 (번호화)

### A. 백엔드 detail 잡 확장 (FD 결정 — 먼저)
- [x] **Step 1 — schemas.py 확장**: `DetailJobResult{domain,target_id,html_url}`, JobStatus.result Union·job_manager 타입에 추가. JobStep은 기존 `rendering` 재사용. (무파괴) ✅
- [x] **Step 2 — services/detail_orchestrator.py [신규]**: `run_detail_job(job_id, domain, target_id)` — research_exists 확인·render_detail_html·progress(queued→rendering→done)·DetailJobResult. orchestrator 동형. ✅
- [x] **Step 3 — routers/detail.py 확장**: `POST .../detail`(202 잡) 양 도메인 추가, 동기 `GET .../detail` 보존. ✅
- [x] **Step 4 — main.py 확인 + py_compile**: detail 라우터 기등록 확인, py_compile OK, app 로드 시 GET+POST 4라우트 검증. ✅

### B. 프론트 스캐폴드 + 기반 레이어
- [x] **Step 5 — 프로젝트 스캐폴드**: package.json(^핀)·vite.config.ts(dev proxy+vitest)·tsconfig.json·index.html·main.tsx·test/setup.ts. ✅
- [x] **Step 6 — Tailwind 토큰 매핑**: tailwind.config.ts(DESIGN.md 색·타이포+mobile·spacing 4px·radius·zIndex)·postcss·styles/index.css(focus-visible·reduced-motion). raw hex 금지. ✅
- [x] **Step 7 — api/types.ts**: schemas.py 1:1 TS 타입(JobKind 3종·DetailJobResult 포함). ✅
- [x] **Step 8 — api/paths.ts + client.ts**: 경로 빌더(대칭·정규화) + fetch 래퍼(ApiError) + 메서드(catalog·existence·triggerDetail·reports·getJob·research·chat). ✅
- [x] **Step 9 — store/index.ts**: useSyncExternalStore 경량(activePopup·activeJobs·lang). ✅
- [x] **Step 10 — hooks/useJobPolling.ts**: 1.5s·terminal 중단·언마운트 정리·3회 재시도. 3 kind 공용. ✅
- [x] **Step 11 — utils/{mailto.ts,progress.ts}**: buildMailtoUrl(무저장·첨부안내·2000자) + mapStepToBars(kind별). ✅

### C. 앱 셸 + 라우팅
- [x] **Step 12 — route.ts·useRoute·App.tsx·컨테이너**: hash 라우팅·parseHashRoute/buildHash·mode 쿼리·딥링크 판정 + PopupContainer(포커스·Esc)/FullscreenContainer. App에 lazy 코드 스플리팅. ✅

### D. 화면 컴포넌트
- [x] **Step 13 — map/ (GlobeIntro·MapView·TopBar·Legend·Notification·coords)**: D3 인트로 3단계(reduced-motion)·평면 지도(줌/마커/범례)·상단바(메뉴/한영)·Notification·챗봇 슬롯. 마커=카탈로그+coords. ✅
- [x] **Step 14 — detail/DetailView**: iframe embed + chrome([시뮬레이션]·[보고서]·[보고서 생성])·detail 잡 폴링(has_detail=false 시)·로딩/빈/에러. ✅
- [x] **Step 15 — report/ (ReportView·ReportPickerModal)**: iframe embed + chrome(메타·[PDF]·[메일 발송])·목록 모달 선택(Q5=B)·mailto. ✅
- [x] **Step 16 — chat/ChatWidget**: 위젯 버튼·대화·칩·POST chat·needs_research 분기(domain·missing_codes)·리서치+폴링·위치 규칙(§5.2)·무상태 history. ✅
- [x] **Step 17 — progress/ (ProgressModal·ProgressPanel)**: kind별 바·우상단 카드(§5.3)·[보고서 보기]. ✅
- [x] **Step 18 — ruleset/ (RulesetForm·validation)**: 3패널·합100 검증·localStorage 저장·풀사이즈. ✅

### E. 테스트 + 게이트 + 문서
- [x] **Step 19 — 단위 테스트(Vitest)**: FT-1~5(paths·route·mailto·progress·validation) — 21 단위. ✅
- [x] **Step 20 — 컴포넌트 스모크(RTL)**: RulesetForm·ReportView(iframe title·버튼) — 3 스모크. ✅ (ChatWidget/ProgressModal은 fetch/타이머 의존이라 Build&Test 통합 스모크로 이전)
- [x] **Step 21 — 게이트**: 백엔드 py_compile+app 로드 OK / 프론트 tsc(0에러)·vitest(24/24)·vite build(성공, 코드 스플리팅) 전부 통과. ✅
- [x] **Step 22 — 코드 요약 문서**: code-summary-3.md 작성. ✅

> 빌드/테스트 **실행**(npm install·vite build·vitest·dev proxy 스모크)은 Build & Test 단계.

## FR 추적성
| FR | Step |
|---|---|
| FR-1 앱셸·API·토큰 | 5,6,7,8,9,12 |
| FR-2 M1+D3 인트로 | 13 |
| FR-3 챗봇 | 10,16 |
| FR-4 P1/P2 (+detail 잡) | 1,2,3,14 |
| FR-5 PR1/PR2+메일 | 11,15 |
| FR-6 PS1 룰셋 | 18 |
| FR-7 PS2 프로그레스 | 10,11,17 |
| 테스트(경량) | 19,20 |

## 총 22단계. 백엔드 확장 4(detail 잡) + 프론트 신규 ~30파일. 기존 엔진·1·2차 핵심 무파괴(detail 동기 GET 보존).
