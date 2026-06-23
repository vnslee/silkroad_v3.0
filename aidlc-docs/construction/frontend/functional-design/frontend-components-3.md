# Frontend Components — frontend (3차)

> Functional Design 산출물 ④. 컴포넌트 계층·props/state·상호작용 흐름·폼 검증·API 연동점. Application Design의 C1~C12를 UI 관점으로 상세화.

## 1. 컴포넌트 계층
```
<App> (C1 AppShell/Router)
├── <GlobeIntro> (C4)               # 딥링크 아니면
└── <MapView> (C4)                   # M1 — 상시
    ├── <TopBar> (메뉴 드롭다운·한영·설정)
    ├── <Legend>
    ├── <Notification>
    ├── <ChatWidgetButton> → <ChatWidget> (C5)
    └── <ModeContainer>              # 라우트 mode로 선택 (Q2=A)
        ├── <PopupContainer> | <FullscreenContainer>
        └── 화면(mode 무지):
            ├── <DetailView> (C6, P1/P2)
            ├── <ReportView> (C7, PR1/PR2)
            ├── <RulesetForm> (C8, PS1)
            └── <ProgressModal> (C9, PS2)
    └── <ProgressPanel> (C9, 우상단 카드 — 전역 잡 있으면)
    └── <ReportPickerModal> (C7 보조, Q5=B 목록 선택)
```

## 2. 컴포넌트별 props / state / API 연동점

### C4 GlobeIntro / MapView
- **GlobeIntro** props: `{onDone, reducedMotion}`. state: 시퀀스 단계. API: 없음.
- **MapView** props: `{markers, onSelectCountry, onSelectRegion}`. state: 회전·줌·포커스. API: `getCountries`/`getRegions`(마커, Q7=A) + 정적 world atlas 지오데이터.
- 상호작용: 드래그=회전/패닝, 휠=줌(1~6), 마커/영역 클릭→`onSelect*`→라우트 detail(popup).

### C5 ChatWidget (P1/P2 무관, 전역)
- props: `{}`(전역 store 구독). state: `ChatSession{target, turns}`(무상태 보관, Q4=A), 입력값, 진행 중 리서치 jobId.
- API: `POST /api/chat`(L6), needs_research 시 `POST .../research` + `useJobPolling`.
- 상호작용: 위젯 버튼 클릭 시 노출(자동 X), 질문 칩/직접 입력, "리서치 진행" 예/아니오 칩. 위치: store.activePopup → 좌하단/정중앙(§5.2).
- 폼 검증: VR-5(빈 메시지·target 확인).

### C6 DetailView (P1/P2)
- props: `{domain, code, mode}`. state: iframe 로드 상태, detail 잡 상태(확장 시).
- API: iframe src=`paths.detail(domain,code)`; has_detail=false면 `triggerDetailRender`(★확장 202) + 폴링(L8); [보고서 생성]=`createReport`; [보고서]=`listReports`→Q5=B 목록 모달.
- chrome: 헤더(P1 국기·국가명·영문 / P2 권역명) + [시뮬레이션]·[보고서]·[보고서 생성]. iframe title 필수(AR-2).

### C7 ReportView (PR1/PR2) + ReportPickerModal
- **ReportView** props: `{domain, code, reportId, mode}`. state: iframe 로드, 메일 핸들러.
- API: iframe src=`paths.reportHtml(...)`; [PDF]=anchor `paths.reportPdf(...)`; [메일 발송]=`buildMailtoUrl`(L7).
- **ReportPickerModal**(Q5=B) props: `{domain, code, reports: ReportRef[], onPick}`. `listReports` 결과 목록 표시→선택→ReportView. (없으면 [보고서 생성] 유도)
- chrome: 헤더(국기/지구본·이름·권역·비교국) + 우상단 메타(ID·생성일시·스냅샷) + [PDF]·[메일 발송].

### C8 RulesetForm (PS1)
- props: `{}`. state: `RulesetForm` 엔티티(가중치·임계·출처).
- 폼 검증: VR-1(합 100)·VR-2(범위). [저장]: localStorage/placeholder + "후속 연동"(Q5 Application Design).
- 3패널: ① 가중치 슬라이더(시장/규제/환경/시스템) ② 임계 계수 ③ 출처 계수(Tier1/2/3). 풀사이즈.

### C9 ProgressModal / ProgressPanel (PS2)
- **ProgressModal** props: `{jobId, kind, onViewReport}`. state: `useJobPolling` 결과 → `mapStepToBars(kind,...)`(L4).
  - kind='research' → 5바(시장/규제/상품/시스템/결과 생성). kind='report' → 데이터 생성→렌더→완료. kind='detail' → 단일 진행.
  - 우하단 [보고서 보기](report 잡 done 시).
- **ProgressPanel**(카드) props: `{}`(store.activeJobs 구독). 진행 중 & PS2 비활성 → 우상단 카드(대상·전체 percent·상세보기). 상세보기→ProgressModal 정중앙(§5.3). 없으면 미렌더.

### C1 AppShell / ModeContainer
- props: route. state: `RouteState`, store(EntryMode·activePopup·activeJobs·lang).
- `<PopupContainer onClose>`: M1 위 오버레이(지도 반투명), 우상단 닫기·Esc·포커스 트랩(AR-3).
- `<FullscreenContainer>`: 전체 점유, 상단 메뉴 유지, 뒤로.

## 3. 상호작용 흐름 (요약)
1. **B 경로**: 지도 마커 클릭 → `#/country/ES/detail?mode=popup` → DetailView(팝업) iframe
2. **보고서**: DetailView [보고서 생성] → report 잡 → ProgressModal/Panel → 완료 → ReportView
3. **A 경로**: 챗봇 위젯 → 질의 → (needs_research) → 리서치 잡 → 완료 → 답변
4. **C 경로**: 상단 메뉴 → `?mode=fullscreen` → 풀사이즈 화면
5. **메일**: ReportView [메일 발송] → mailto 작성창 / 챗봇 완료 시 [메일 작성 열기] 칩

## 4. API 연동점 매핑
| 컴포넌트 | 엔드포인트 |
|---|---|
| MapView | `GET /api/countries`, `GET /api/regions` |
| DetailView | `GET .../detail`(iframe), `POST .../detail`(★확장 잡), `POST .../reports`, `GET .../reports` |
| ReportView | `GET .../reports/{id}/html`(iframe), `.../pdf`(anchor) |
| ChatWidget | `POST /api/chat`, `POST .../research` |
| Progress | `GET /api/jobs/{id}` (useJobPolling) |
| RulesetForm | (백엔드 저장 API 부재 — localStorage) |

## 5. 백엔드 확장 요청 (이 FD가 트리거 — Code Generation에서 구현)
- **상세화면 렌더 비동기 잡화**: `POST /api/countries/{code}/detail`·`POST /api/regions/{region}/detail`(202) + detail orchestrator(1·2차 동형) + `JobStep`/결과 모델(`DetailJobResult{html_url}`). 기존 동기 `GET .../detail`은 캐시 즉시 반환 용도로 유지(이중 경로).
- (별도 범위) PDF SES 첨부 발송: 3차 제외, 신규 요구사항으로 분리.
