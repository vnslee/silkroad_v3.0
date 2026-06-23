# Component Methods — frontend (3차)

> Application Design 산출물 ②. 메서드/훅/유틸 **시그니처와 입출력**(TypeScript 의사 시그니처). 상세 비즈니스 규칙·상태 전이는 Functional Design(3차).

## C2. ApiClient — 엔드포인트 매핑 (전부 `prefix=/api`)

### 경로 빌더 (순수 함수, 단위 테스트 대상 — Q6)
| 함수 | 반환 | 매핑 |
|---|---|---|
| `paths.countries()` | `/api/countries` | GET 카탈로그 |
| `paths.regions()` | `/api/regions` | GET 카탈로그 |
| `paths.countryExistence(code)` | `/api/countries/{code}` | GET 존재 |
| `paths.regionExistence(region)` | `/api/regions/{region}` | GET 존재 |
| `paths.detail(domain, id)` | `/api/{countries\|regions}/{id}/detail` | GET HTML (iframe src) |
| `paths.reports(domain, id)` | `/api/.../{id}/reports` | POST 트리거 / GET 목록 |
| `paths.reportJson(domain, id, rid)` | `.../reports/{rid}/json` | GET |
| `paths.reportHtml(domain, id, rid)` | `.../reports/{rid}/html` | GET (iframe src) |
| `paths.reportPdf(domain, id, rid)` | `.../reports/{rid}/pdf` | GET (다운로드) |
| `paths.job(jobId)` | `/api/jobs/{jobId}` | GET 폴링 |
| `paths.research(domain, id)` | `/api/.../{id}/research` | POST 트리거 |
| `paths.chat()` | `/api/chat` | POST |

> `domain` = `'country' | 'region'`. 빌더가 `country→countries`, `region→regions` 복수형·대문자 코드 정규화를 담당(대칭).

### 호출 메서드 (async)
```ts
type Domain = 'country' | 'region'

getCountries(): Promise<CountrySummary[]>
getRegions(): Promise<RegionSummary[]>
getExistence(domain: Domain, id: string): Promise<ExistenceInfo>
listReports(domain: Domain, id: string): Promise<ReportListItem[]>
createReport(domain: Domain, id: string): Promise<JobCreated>         // 202 → {job_id,status,status_url}
getJob(jobId: string): Promise<JobStatus>                              // {status,step,percent,result?}
triggerResearch(domain: Domain, id: string, body?: ResearchTrigger): Promise<JobCreated>
chat(req: ChatRequest): Promise<ChatResponse>
// HTML/PDF·detail은 fetch 안 하고 paths.*() URL만 반환 → iframe src / anchor download
```

### TS 타입 (백엔드 schemas.py 대응 수기 정의 — Q6=A)
- `CountrySummary{code,country,country_ko,region,exists}` · `RegionSummary{code,region,region_ko,exists}`
- `ExistenceInfo{exists, latest_path?, ...}` · `ReportListItem{report_id, created_at, ...}`
- `JobCreated{job_id,status,status_url}` · `JobStatus{status:'queued'|'running'|'done'|'failed', step, percent, result?}`
- `ChatRequest{message, history?, target?}` · `ChatResponse{reply, needs_research?, research_target?, chips?}`
> 정확한 필드는 Functional Design에서 schemas.py와 1:1 대조 확정.

## C1. AppShell / Router
```ts
parseHashRoute(hash: string): RouteState        // {screen, domain?, id?, reportId?, mode}
isDeepLink(hash: string): boolean                // true → GlobeIntro 스킵
<App/>                                           // 라우트→(컨테이너 래퍼 + 화면 컴포넌트)
<PopupContainer onClose>{children}</PopupContainer>       // M1 위 오버레이·우상단 닫기
<FullscreenContainer>{children}</FullscreenContainer>     // 전체 점유·상단 메뉴 유지
```

## C4. GlobeIntro / MapView
```ts
<GlobeIntro onDone: () => void reducedMotion: boolean/>   // 3단계 시퀀스, reduced-motion 단축
<MapView markers: MapMarker[]
         onSelectCountry: (code) => void
         onSelectRegion: (region) => void/>
focusTarget(domain, id): void                    // 포커스 줌·하이라이트
resetView(): void                                // 줌/회전 리셋
```

## C5. ChatWidget
```ts
<ChatWidget/>
sendMessage(text: string): Promise<void>         // chat() 호출 → 응답/칩 렌더
onChipClick(chip): void                          // 질문 칩 / "리서치 진행" 분기
startResearch(domain, id): void                  // triggerResearch → useJobPolling → 완료 후 복귀
// 위치: store 활성팝업 구독 → 좌하단/정중앙 (§5.2)
```

## C6. DetailView
```ts
<DetailView domain: Domain code: string mode: EntryMode/>
// iframe src = paths.detail(domain, code); title 필수(접근성)
onGenerateReport(): void                         // createReport → store 잡 등록 → C9
onOpenReport(): void                             // listReports 최신 → C7 라우팅
onSimulate(): void                               // [시뮬레이션] (스코프 내 동작 정의는 FD)
```

## C7. ReportView
```ts
<ReportView domain: Domain code: string reportId: string mode: EntryMode/>
// iframe src = paths.reportHtml(...)
onDownloadPdf(): void                            // anchor → paths.reportPdf(...)
onSendMail(): void                               // buildMailtoUrl(meta) → window.location
```

## C8. RulesetForm
```ts
<RulesetForm/>
validateWeights(weights): {ok: boolean, sum: number}   // 합 100% 검증
onSave(): void                                   // Q5=A: localStorage/placeholder, "후속 연동" 표시
```

## C9. ProgressPanel / ProgressModal
```ts
<ProgressModal jobId: string onViewReport: () => void/>   // 5바 + [보고서 보기]
<ProgressPanel/>                                  // store 진행중 잡 구독; 없으면 null 렌더
mapStepToBars(step, percent): BarState[]          // 잡 step → 5개 바 진행 (매핑은 FD)
```

## C10. useJobPolling
```ts
useJobPolling(
  jobId: string | null,
  opts?: {intervalMs?: number, onDone?: (r) => void, onError?: (e) => void}
): {status, step, percent, result, error}
// terminal(done/failed) 도달 시 폴링 중단; jobId=null 시 idle
```

## C11. mailto util
```ts
buildMailtoUrl(input: {
  subject: string,
  reportName: string,
  summary: string,
  htmlUrl: string,
  pdfUrl: string,
}): string
// "mailto:?subject=...&body=..." encodeURIComponent; 첨부 안내 문구 포함; 수신주소 미포함(무저장)
```

## C12. 전역 상태
```ts
useEntryMode(): EntryMode                         // 'popup' | 'fullscreen'
useActivePopup(): boolean                         // C1 위치 규칙(§5.2)
useActiveJobs(): JobRef[]                          // C9 카드 노출(§5.3)
addJob(ref) / removeJob(id) / setLang('ko'|'en')
```
