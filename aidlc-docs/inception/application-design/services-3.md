# Services & Orchestration — frontend (3차)

> Application Design 산출물 ③. 프론트 오케스트레이션 패턴(화면 전환·잡 흐름·챗봇 분기·진입 모드)과 에러 정책. 상세 상태머신은 Functional Design(3차).

## S1. 진입 모드 전환 (§5.1, Q2=A)
- **원칙**: 화면 컴포넌트(C6/C7/C8)는 모드를 모른다. 라우트 상태의 `mode`에 따라 C1(AppShell)이 컨테이너를 선택.
  - `mode='popup'` → `PopupContainer`(M1 지도 위 오버레이, 지도 반투명, 우상단 닫기)
  - `mode='fullscreen'` → `FullscreenContainer`(전체 점유, 상단 메뉴 유지, 닫기 대신 메뉴/뒤로)
- **진입 경로별 모드**(web_design_spec §6.2~6.4):
  - 경로 A(챗봇)·B(지도 클릭) → 팝업 모드
  - 경로 C(상단 메뉴 드롭다운) → 풀사이즈 모드
- embed되는 iframe HTML은 양 모드 동일(PIPELINE §5).

## S2. 보고서 생성 잡 흐름 (FR-4.3·7, §5.3)
```
DetailView [보고서 생성]
  → ApiClient.createReport(domain,id)        // POST .../reports → 202 {job_id,status_url}
  → store.addJob({jobId, domain, id, kind:'report'})
  → useJobPolling(jobId)                      // GET /api/jobs/{id} 폴링
      ├─ PS2 활성: ProgressModal 5바 갱신
      └─ PS2 비활성: ProgressPanel 우상단 카드(전체 %)  → 상세보기 → ProgressModal 정중앙
  → status='done': result.report_id 확보 → [보고서 보기] 활성
  → ReportView(domain,id,reportId)            // iframe src=report html URL
```
- 5개 바(시장/규제/상품/시스템/결과 생성) ← 잡 step→bar 매핑(`mapStepToBars`, 산식은 FD).

## S3. 챗봇 + 리서치 분기 (§6.5, FR-3, Q4=A 공용 폴링)
```
ChatWidget.sendMessage → ApiClient.chat()      // 동기 ChatResponse
  ├─ needs_research=false: reply/chips 렌더
  └─ needs_research=true:
        "리서치 진행하시겠어요?" 칩 노출
          → 수락: ApiClient.triggerResearch(domain,id)  // 202
                  → store.addJob({kind:'research'})
                  → useJobPolling → done 시 "완료" 안내 → 기존 답변 흐름 복귀
          → 거절: 보유 정보 한도 내 답변
```
- 챗봇 멀티턴은 **무상태**(클라이언트가 history 전달 — 2차 설계 계승).
- 위치(§5.2): store.activePopup → 좌하단 / 정중앙.

## S4. 상세화면 표시 (FR-4, PIPELINE §1)
```
지도/챗봇/메뉴에서 대상 선택
  → (선택적) ApiClient.getExistence(domain,id) 로 존재 확인
  → DetailView: iframe src = paths.detail(domain,id)
      ├─ 200: HTML embed (백엔드가 없으면 엔진 렌더 후 제공)
      └─ 로딩/빈/에러: chrome 레벨 상태 표시
```
- 상세화면은 보고서 라인과 독립(리서치 JSON만 있으면 표시 — PIPELINE §1).

## S5. 보고서 부가 액션 (FR-5)
- **PDF**: anchor href = `paths.reportPdf(...)` 다운로드(백엔드 변환 산출물).
- **메일**: `buildMailtoUrl({reportName, summary, htmlUrl, pdfUrl})` → `window.location.href`. 서버 발송 없음, 수신주소 무저장, 첨부 안내 문구 포함(FR-5.3).

## S6. 인트로 → 지도 전환 (Q7=A, intro_spec)
```
App mount → isDeepLink(hash)?
  ├─ No: <GlobeIntro onDone={()=>showMap()}/>   // 3단계 시퀀스 (reduced-motion 단축)
  └─ Yes: 곧바로 <MapView/>                       // 인트로 스킵
showMap → Notification 노출 → 진입 경로 대기
```

## 에러 정책
| 상황 | 처리 |
|---|---|
| 백엔드 미가동/네트워크 | 화면별 빈 상태·재시도 안내(Q2 requirements: 백엔드 없을 때 빈/에러 표시) |
| 404 detail/report HTML | iframe 대신 "데이터 없음/생성 필요" chrome 메시지 |
| 잡 status='failed' | ProgressModal 실패 표시 + 재시도 액션, store에서 잡 제거 |
| chat 422/오류 | 챗봇 버블에 오류 메시지, 입력 유지 |
| 룰셋 저장(Q5=A) | 백엔드 API 부재 → localStorage/placeholder + "후속 연동" 안내 |
| PDF 미생성 | [PDF] 비활성 또는 생성 안내 |

## 오케스트레이션 책임 경계 (PIPELINE §5)
- **chrome(React)**: 헤더·메타·모든 액션 버튼([보고서 생성]·[시뮬레이션]·[PDF]·[메일 발송]·[룰셋 설정])·진입 모드 래핑·로딩/에러.
- **콘텐츠(iframe HTML)**: 표·차트·탭 본문(렌더 엔진 산출물). 버튼 로직 없음. postMessage 브리지 불필요.
