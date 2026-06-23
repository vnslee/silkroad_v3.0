# Business Logic Model — frontend (3차)

> Functional Design 산출물 ②. 라우트 상태머신·잡 폴링 알고리즘·step→바 매핑·챗봇 분기·mailto 조립·인트로 시퀀스. 기술-무관 로직.

## L1. 인트로 → 지도 시퀀스 (Q7=A, intro_spec)
```
App mount
  hash = window.location.hash
  if isDeepLink(hash):                  # 화면 라우트 hash 존재
      render MapView 직접 (인트로 스킵)
      route = parseHashRoute(hash)       # 딥링크 화면까지 복원
  else:
      render GlobeIntro
        if prefers-reduced-motion: 단축(즉시 착지) 또는 생략
        3단계: 등장·자전(~1.6s) → 펼침(~2.0s) → 착지+UI 페이드인
        onDone → MapView + Notification 노출
  진입 경로(A 챗봇 / B 지도클릭 / C 메뉴) 대기; 경로 진행 시 Notification 페이드아웃
```

## L2. 라우트 상태머신 (Q3=A 라우팅, Q8=A mode 쿼리)
- URL 형식: `#/{domain}/{id}/{screen}?mode={popup|fullscreen}` (예 `#/country/ES/report?mode=popup`)
- `parseHashRoute(hash) → RouteState`. `mode` 기본값: 경로 A/B 진입 시 `popup`, 경로 C(메뉴) 진입 시 `fullscreen`.
- 화면 전환 = `RouteState` 갱신 → AppShell이 (컨테이너 래퍼 + 화면 컴포넌트) 재구성. 화면 컴포넌트는 mode 무지(Q2=A), 컨테이너만 `mode`로 선택.

```
map ──select(B)──▶ detail(popup) ──[보고서 생성]──▶ progress ──done──▶ report(popup)
 │                                  └──[보고서](목록 선택, Q5=B)──▶ report
 ├──chat(A)──▶ detail/report(popup)
 └──menu(C)──▶ detail/report/ruleset(fullscreen)
report ──[닫기/뒤로]──▶ 직전 화면 또는 map
```

## L3. 잡 폴링 알고리즘 (Q2=A, 공용 useJobPolling — 3 kind)
```
useJobPolling(jobId, {intervalMs=1500, onDone, onError}):
  if jobId == null: return idle
  setInterval(intervalMs):
    s = GET /api/jobs/{jobId}
    state ← {status, step, percent, result, error}
    if status in ('done','failed'):
        clearInterval
        status=='done' → onDone(result);  status=='failed' → onError(error)
    on network error: retryCount++; if retryCount>3 → onError; else 계속
  cleanup(unmount): clearInterval         # 타이머 누수 방지
```
- 보고서·상세·리서치 3 kind 공용. 소비처(C5 ChatWidget·C9 Progress)가 `kind`로 결과 해석.

## L4. JobStep → PS2 바 매핑 (Q1 확정: kind별 분기)

### L4.1 `research` 잡 (시장·규제·상품·시스템 4 agent + 결과 생성)
- 백엔드 step: `queued → calling_bedrock → saving → done`. **per-agent 세분 step 없음**.
- 표현: 5바(시장/규제/상품/시스템/결과 생성, mockup PS2 그대로).
  - `percent`를 5구간으로 보간: 0–20–40–60–80–100 → 시장→규제→상품→시스템→결과 순차 채움(근사).
  - `calling_bedrock` 구간 = 4 agent 바 진행, `saving` = 결과 생성 바.
- **한계 명시**: 실제 agent별 완료 신호가 백엔드에 없으므로 바는 percent 비례 근사. 정밀 표시가 필요하면 백엔드 `JobStep`에 agent 단계 추가(상세 잡 확장과 함께 검토).

### L4.2 `detail` 잡 (상세화면 렌더 — ★백엔드 확장)
- step(확장): `queued → rendering → done`.
- 표현: 단일 "상세화면 생성" 진행 바(또는 간이 스피너). PS2 5바 형식 대신 단순 진행.

### L4.3 `report` 잡 (보고서 데이터 생성+렌더링)
- 백엔드 step: `queued → generating → rendering → done`.
- 표현: 데이터 없으면 리서치(L4.1) 선행 표시 → `generating`(보고서 데이터 생성) → `rendering`(보고서 HTML) → 완료. 5바 중 "결과 생성"을 렌더 단계로.
- `mapStepToBars(kind, step, percent) → ProgressBar[]` 가 kind별 분기.

## L5. 보고서 생성 흐름 (S2 상세)
```
DetailView [보고서 생성]
  → createReport(domain,id)           # POST .../reports → 202 {job_id}
  → store.addJob({jobId, kind:'report', domain, id, label})
  → 라우트 progress 또는 ProgressPanel 카드(§5.3)
  → useJobPolling(jobId)
       PS2 활성 → ProgressModal(L4.3 바)
       PS2 비활성 → 우상단 카드(전체 percent) → 상세보기 → PS2 정중앙
  → onDone(result: JobResult)
       store.removeJob; reportId = result.report_id
       [보고서 보기] → route report(domain,id,reportId)
  → onError → 실패 표시 + 재시도
```

## L6. 챗봇 분기 흐름 (Q3=A, Q4=A, §6.5)
```
sendMessage(text):
  session.turns.push({role:'user', content:text})
  resp = POST /api/chat {domain, target_id, message:text, history:session.turns, member_codes?}
  if resp.answer: session.turns.push({role:'assistant', content:resp.answer}); 렌더
  if resp.needs_research:
      "리서치(시장조사) 진행할까요?" 칩 제시 (resp.research_suggestion 활용)
      [예]:
         if domain=='country': triggerResearch('country', id)
         if domain=='region' : triggerResearch('region', id, {member_codes: resp.missing_codes})  # 누락 멤버국
         store.addJob({kind:'research', ...}); useJobPolling
         onDone → "리서치 완료. 다시 답변드릴게요." → 직전 질문 재질의(또는 안내)
      [아니오]: 보유 정보 한도 답변
```
- history는 클라이언트 세션 보관(무상태, 새로고침 시 초기화).

## L7. mailto 조립 (Q6=A — 3차는 mailto, SES는 별도 범위)
```
buildMailtoUrl({domain, targetName, reportId, createdAt, summary, htmlUrl, pdfUrl}):
  subject = `[Silk Road] ${targetName} 진출 진단 보고서 — ${reportId}`
  body = [
    `${targetName} 진단 보고서를 공유합니다.`,
    `· 보고서 ID: ${reportId}`,
    createdAt ? `· 생성일시: ${createdAt}` : null,
    `· 요약: ${summary}`,            # 판정/핵심 점수 1~2줄
    ``,
    `▶ 보고서(HTML): ${htmlUrl}`,
    pdfUrl ? `▶ PDF: ${pdfUrl}` : null,
    ``,
    `※ 메일 첨부는 지원되지 않습니다. PDF가 필요하면 위 링크에서 내려받아 첨부해 주세요.`,
  ].filter(Boolean).join('\n')
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  # to 비움(무저장), body ~2000자 이내 (초과 시 summary 절단)
```
- 챗봇 완료 시점 공유(§6.6 B): 동일 `buildMailtoUrl` → [메일 작성 열기] 칩.
- **확장 포인트**: [메일 발송] 핸들러를 `sendMail()` 인터페이스로 추상화 → 후속 SES 서버발송으로 교체 가능(별도 범위).

## L8. 상세화면 표시 (S4, detail 잡 확장 반영)
```
대상 선택 → (선택) getExistence
  has_detail==true → iframe src = detail URL (즉시 로드)
  has_detail==false & exists(리서치 있음):
      triggerDetailRender(domain,id)   # ★ POST .../detail 202 (확장) → useJobPolling(kind:'detail')
      onDone(DetailJobResult.html_url) → iframe src 로드
  exists==false → "리서치 필요" → 챗봇 리서치 흐름 유도
```
