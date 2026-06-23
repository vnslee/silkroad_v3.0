# Components — frontend (3차)

> Application Design 산출물 ①. 프론트엔드(React+Vite+TS+Tailwind+D3) 컴포넌트 식별·책임·인터페이스. 상세 로직은 Functional Design(3차)에서 정의.
> 결정 근거: 설계 질문 Q1~Q7 = 전부 A. 디자인 SoT(web_design_spec·intro_spec·PIPELINE §1/§5·DESIGN.md·stitch mockup) 무변경.

## 0. 구조 개요 (Q1=A 기능별 + 공통 레이어)

```
app/frontend/
├── index.html
├── package.json
├── vite.config.ts            # dev proxy /api → localhost:8000
├── tailwind.config.ts        # DESIGN.md 토큰 매핑 (C3)
├── tsconfig.json
└── src/
    ├── app/                  # C1 AppShell·Router·진입모드 컨테이너
    ├── api/                  # C2 ApiClient·경로 빌더·TS 타입
    ├── components/
    │   ├── map/              # C4 GlobeIntro·MapView (M1)
    │   ├── chat/             # C5 ChatWidget (C1)
    │   ├── detail/           # C6 DetailView (P1/P2)
    │   ├── report/           # C7 ReportView (PR1/PR2)
    │   ├── ruleset/          # C8 RulesetForm (PS1)
    │   ├── progress/         # C9 ProgressPanel/Modal (PS2)
    │   └── common/           # 공통 chrome·컨테이너(C1 하위)
    ├── hooks/                # C10 useJobPolling 등
    ├── utils/                # C11 mailto·포맷
    ├── store/                # C12 전역 상태(진입모드·활성팝업·잡)
    └── styles/               # 전역 CSS·Tailwind entry
```

## 1. 컴포넌트 목록

### C1. AppShell / Router (`src/app/`)
- **책임**: 최상위 셸. 클라이언트 라우팅(Q3=A, URL hash 딥링크), 진입 모드 컨테이너 선택(Q2=A: `PopupContainer` vs `FullscreenContainer`), 전역 레이아웃(상단 바·Notification 슬롯·챗봇 위젯 슬롯), 딥링크 hash 존재 시 GlobeIntro 스킵 판단.
- **인터페이스**: `<App/>` 루트. 라우트 정의(`/`, `/country/:code/detail`, `/country/:code/report`, `/region/:region/...`, `/ruleset`, mode 쿼리). 모드별 컨테이너로 화면 컴포넌트 래핑.
- **비포함**: 화면 본문 구현(각 화면 컴포넌트), 데이터 fetch(C2/hooks).

### C2. ApiClient (`src/api/`)
- **책임**: 단일 fetch 래퍼 + **경로 빌더 유틸**(country/region 대칭). 1·2차 엔드포인트 전체 매핑. JSON 응답 파싱·에러 정규화. HTML/PDF는 iframe/다운로드용 **URL만 반환**(직접 fetch 안 함).
- **인터페이스(개요, 시그니처는 component-methods-3)**: 카탈로그·존재·detail URL·reports(트리거/목록/json/html·pdf URL)·jobs 폴링·research 트리거·chat. + TS 타입 정의(`CountrySummary`·`RegionSummary`·`ExistenceInfo`·`JobStatus`·`ReportListItem`·`ChatResponse` 등 — 백엔드 schemas.py 대응 수기 정의, Q6=A).
- **비포함**: 서버상태 캐싱 라이브러리(Q6=A 경량, 라이브러리 없이).

### C3. DesignTokens / tailwind.config (`tailwind.config.ts` + `src/styles/`)
- **책임**: DESIGN.md(Kinetic Enterprise) 토큰을 Tailwind **시맨틱 토큰**으로 매핑(색·타이포·간격·elevation·z-index). raw hex 사용 금지(FR-1.4). 컴포넌트는 시맨틱 클래스만 사용.
- **인터페이스**: `theme.extend.{colors, fontFamily, spacing, boxShadow, zIndex}` + 전역 CSS 변수 entry.
- **비포함**: 신규 팔레트 제안(SoT 변경 금지).

### C4. MapView + GlobeIntro (`src/components/map/`) — M1
- **책임(Q7=A 분리)**:
  - **GlobeIntro**: D3 지구본 1회성 시네마틱 인트로(등장·자전 → 펼침 → 착지+UI 페이드인, intro_spec). `prefers-reduced-motion` 시 단축/생략. 완료 콜백으로 MapView 전환.
  - **MapView**: 평면 인터랙티브 지도(드래그/패닝·휠 줌 1~6·국가/권역 포커스 줌·하이라이트·리셋). 마커(진출국 채운 점/예정국 점선 빈 점·발광)·범례(우상단). 라이트 테마(DESIGN.md 팔레트).
  - 상단 바(중앙 CI·타이틀, 우측 한/영·설정, 좌측 메뉴 드롭다운 5항목), Notification(선택 시 페이드아웃), 좌하단 챗봇 위젯 버튼 슬롯.
- **인터페이스**: `<GlobeIntro onDone/>`, `<MapView onSelectCountry/onSelectRegion/>`. 카탈로그(C2)로 마커 데이터 로드.
- **비포함**: 챗봇 본체(C5), 화면 팝업 본문(C6/C7).

### C5. ChatWidget (`src/components/chat/`) — C1
- **책임**: 위젯 버튼(클릭 시에만 노출, 자동 X) + 대화/답변창 + 제한 질문 칩. `POST /api/chat`(동기) 호출. needs_research 분기(§6.5) → "리서치 진행?" 칩 → research 트리거(202) → useJobPolling(C10)로 진행 → 완료 후 답변 복귀. 위치 규칙(§5.2): 다른 팝업 있으면 좌하단, 없으면 정중앙(C12 활성팝업 상태 구독).
- **인터페이스**: `<ChatWidget/>`. 멀티턴은 무상태(클라이언트가 이전 메시지 전달 — 2차 설계 계승). 
- **비포함**: 리서치 잡 폴링 로직 자체(C10 위임).

### C6. DetailView (`src/components/detail/`) — P1/P2
- **책임**: 상세 HTML을 **iframe `src`로 embed**(Q3 embed=A). chrome(헤더: P1 국기·국가명·영문명 / P2 권역명, 버튼: [시뮬레이션]·[보고서]·[보고서 생성]). [보고서 생성] → reports 트리거(202) → C9 프로그레스. iframe title·로딩/빈 상태 처리. 진입 모드 래핑은 C1 컨테이너가 담당(C6는 모드-무관, Q2=A).
- **인터페이스**: `<DetailView domain code/>`. iframe src = C2 detail URL.
- **비포함**: 진입 모드 사이즈/오버레이(C1 컨테이너).

### C7. ReportView (`src/components/report/`) — PR1/PR2
- **책임**: 보고서 HTML iframe `src` embed. chrome(헤더: 국기/지구본·이름·권역·비교국, 우상단 메타: 보고서 ID·생성일시·스냅샷일자 + [PDF 다운로드]·[메일 발송]). [PDF]=pdf URL 다운로드, [메일 발송]=mailto util(C11). 모드-무관(Q2=A).
- **인터페이스**: `<ReportView domain code reportId/>`. iframe src = C2 report html URL.
- **비포함**: mailto URL 조립 로직(C11 위임), PDF 변환(백엔드).

### C8. RulesetForm (`src/components/ruleset/`) — PS1
- **책임**: 룰셋 ID 드롭다운 + 3패널 폼(① 카테고리 가중치 슬라이더 합 100% ② 임계값 신뢰 계수 0~100 ③ 출처 신뢰 계수 Tier1/2/3 0~1.0) + 합 100% 검증. **저장은 클라이언트까지만**(Q5=A): 백엔드 룰셋 저장 API 부재 → [저장]은 후속 연동 placeholder(또는 localStorage 임시), UI에 "후속 연동" 표시. 풀사이즈 모드 진입.
- **인터페이스**: `<RulesetForm/>`. 초기값은 (가능 시) internal 룰셋 구조 참고, 없으면 폼 기본값.
- **비포함**: 백엔드 저장 엔드포인트(범위 밖).

### C9. ProgressPanel / ProgressModal (`src/components/progress/`) — PS2
- **책임**: 보고서 생성 잡 진행 표시. **ProgressModal(PS2)**: 5개 프로그레스 바(시장/규제/상품/시스템/결과 생성)·우하단 [보고서 보기]. **ProgressPanel(카드형)**: PS2 비활성 & 생성 중이면 우상단 카드(국가/권역·전체 0~100%·상세보기) → 상세보기 시 PS2 정중앙(§5.3). 진행 없으면 미노출. useJobPolling(C10) 구독.
- **인터페이스**: `<ProgressModal jobId/>`, `<ProgressPanel/>`(전역 잡 상태 C12 구독). [보고서 보기] → C7 ReportView 라우팅.
- **비포함**: 폴링 로직(C10), 보고서 본문(C7).

### C10. useJobPolling hook (`src/hooks/`)
- **책임(Q4=A 단일 공용)**: `GET /api/jobs/{id}` 폴링 추상화 — 잡 종류(보고서 생성·리서치) 무관. status/step/percent 반환, terminal(done/failed) 시 중단. 소비처(C5·C9)가 결과 해석.
- **인터페이스**: `useJobPolling(jobId, {interval, onDone, onError}) → {status, step, percent, result}`.

### C11. mailto util (`src/utils/`)
- **책임**: 보고서 메타·요약·HTML/PDF 링크 → `mailto:` URL 조립(제목·본문 인코딩). 무저장(수신주소 수집 안 함), mailto 첨부 미지원 → 본문 링크 + 첨부 안내(FR-5.3). 단위 테스트 대상(Q6).
- **인터페이스**: `buildMailtoUrl(meta) → string`. 순수 함수.

### C12. 전역 상태 store (`src/store/`)
- **책임**: 진입 모드(팝업/풀사이즈)·활성 팝업 존재 여부(C5 위치 규칙·§5.2)·진행 중 잡 목록(C9 카드 노출 판단·§5.3)·언어(한/영). 경량(Context/zustand 등 — Functional Design에서 확정, Q6=A 기조).
- **인터페이스**: 셀렉터/액션(상세는 component-methods-3).

## 2. 화면 ↔ 컴포넌트 ↔ FR 추적성
| 화면/기능 | 컴포넌트 | FR |
|---|---|---|
| 앱 셸·라우팅 | C1 | FR-1.1·1.3 |
| API 클라이언트·경로빌더 | C2 | FR-1.2 |
| Tailwind 토큰 | C3 | FR-1.4 |
| M1 + D3 인트로 | C4 | FR-2 |
| C1 챗봇 | C5 | FR-3 |
| P1·P2 | C6 | FR-4 |
| PR1·PR2 | C7 | FR-5 |
| PS1 | C8 | FR-6 |
| PS2·프로그레스 | C9 | FR-7 |
| 잡 폴링(공용) | C10 | FR-4.3·7.1·3.2 |
| mailto | C11 | FR-5.3 |
| 전역 상태 | C12 | FR-1.3·3.1·7.2 |
