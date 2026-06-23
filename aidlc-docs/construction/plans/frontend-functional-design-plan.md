# Functional Design Plan — frontend (3차)

Application Design(3차) 산출물 5종을 토대로 한 상세 설계 계획. 아래 질문에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 산출물(`construction/frontend/functional-design/`)을 생성한다.

> 이 단계는 **상태 전이·잡 폴링 알고리즘·챗봇 분기 로직·mailto 조립 규칙·폼 검증·API 타입 정합·라우트 상태머신** 등 기술-무관 상세 로직을 정의한다. UI는 frontend-components 문서로 별도 정리(컴포넌트 계층·props/state·상호작용·폼 검증·API 연동점).

## 확인된 백엔드 계약 (schemas.py 실측 — TS 타입 1:1 대조 기준)
- **JobStep** = `"queued" | "generating" | "rendering" | "calling_bedrock" | "saving" | "done"` (보고서·리서치 공용 enum)
- **JobState**(status) = queued/running/done/failed 류, `JobStatus{job_id, kind, status, step, percent(0~), message?, result?, error?, params}`
- **JobResult**(보고서) = `{domain, target_id, report_id, json_url, html_url, pdf_url?}` / **ResearchJobResult** = `{domain, target_id, latest_url?, schema_version?}`
- **ChatRequest** = `{domain, target_id, message, history?: ChatTurn[], member_codes?}` · **ChatTurn** = `{role:'user'|'assistant', content}`
- **ChatResponse** = `{answer?, needs_research:bool, research_suggestion?, missing_codes: string[]}`
- **CountrySummary** = `{code, name, name_ko?, region?, is_baseline, has_detail, has_report}` · **RegionSummary** = `{code, name, name_ko?, baseline_country?, has_detail, has_report}`
- **ExistenceInfo** = `{domain, target_id, exists, has_detail, has_report, can_research, latest_report_id?}`
- **ReportRef** = `{report_id, ...}` · **ReportListResponse** = `{domain, target_id, reports: ReportRef[]}`
- **JobCreatedResponse** = `{job_id, status, status_url}`

> 핵심 정합점: ① 챗봇 분기 신호는 `needs_research` + `missing_codes`(2차 §6.5.2: 권역의 누락 멤버국). ② 보고서 완료 시 `result.report_id`/`html_url`/`pdf_url`로 PR 이동. ③ `JobStep` 6값을 PS2 5개 바에 매핑해야 함.

## 산출물 계획 (Mandatory)
- [ ] `functional-design/domain-entities-3.md` — 프론트 뷰모델·TS 타입(schemas.py 1:1)·라우트 상태·잡 참조 엔티티
- [ ] `functional-design/business-logic-model-3.md` — 라우트 상태머신·잡 폴링 알고리즘·step→바 매핑·챗봇 분기·mailto 조립·인트로 시퀀스
- [ ] `functional-design/business-rules-3.md` — 검증(가중치 합·코드 형식)·에러 매핑·접근성/모션 규칙·대칭·경량 테스트(단위/스모크) 속성
- [ ] `functional-design/frontend-components-3.md` — 컴포넌트 계층·props/state·상호작용 흐름·폼 검증·API 연동점

---

# 질문

## Question 1 — JobStep → PS2 5개 바 매핑
백엔드 `JobStep`(queued/generating/rendering/calling_bedrock/saving/done)과 PS2의 5개 바(시장/규제/상품/시스템/결과 생성, FR-7.1)는 1:1이 아니다. 매핑 방식은?

A) **단계 기반 근사 매핑 + percent 보간** — `JobStep`을 굵직한 phase(준비→생성(generating)→렌더(rendering)→완료)로 보고, `percent`(0~100)로 5개 바를 비례 채움. 5개 바는 "표현상 분할"이고 실제 진행은 percent가 주도 (권장 — 백엔드가 5개 세부 step을 주지 않으므로)

B) **5개 바를 step에 강제 1:1** — step이 5개 미만이라 일부 바는 즉시 완료/대기로 표시

X) Other (please describe after [Answer]: tag below)

[Answer]: X → **확정: 잡 3종 모델 + PS2 kind별 분기**. 잡 종류 = ① 리서치 잡(국가/권역): 시장·규제·상품·시스템 4 agent 서치 → 데이터 생성 ② 상세화면 렌더링 잡(국가/권역 P1/P2) ③ 보고서 데이터 생성+렌더링 잡(PR1/PR2): 데이터 생성 → 렌더링 → 완료. 권역의 데이터 없는 국가는 ①프로세스 선행. useJobPolling은 3종 공용, PS2 표현만 `kind`별 분기.
> **범위 변경(중요)**: 상세화면 렌더링은 현재 백엔드에서 동기 `GET .../detail`로 처리됨(잡 아님). 이를 **202 비동기 폴링 잡으로 확장**(신규 트리거 엔드포인트 + detail orchestrator + JobStep 보강) — 사용자 결정. 따라서 3차 범위가 "백엔드 무수정"에서 **백엔드 소규모 확장 포함**으로 변경됨(execution-plan-3·application-design-3 정합 갱신).
> 백엔드 `JobStep`은 per-agent 세분 단계를 직접 주지 않으므로, 리서치 4 agent 바는 step/percent 보간으로 근사하거나 백엔드 JobStep에 agent 단계를 추가(확장 시). FD에서 매핑 산식 확정.

## Question 2 — 잡 폴링 간격·종료·정리
`useJobPolling` 폴링 정책은?

A) **고정 간격(예 1.5초) + terminal(done/failed) 중단 + 언마운트 정리** — 일정 간격 폴, 완료/실패 시 중단, 컴포넌트 언마운트 시 타이머 해제. 네트워크 오류 시 몇 회 재시도 후 error (권장)

B) **지수 백오프** — 간격을 점증(복잡, 진행 표시엔 과함)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3 — 챗봇 분기: needs_research + missing_codes 해석
`ChatResponse.needs_research=true`일 때 리서치 트리거 흐름(§6.5)은? (country vs region·missing_codes)

A) **domain별 분기 + missing_codes 활용** — country면 해당 코드 research 트리거, region이면 `missing_codes`(누락 멤버국)를 region research POST의 `member_codes`로 전달(2차 §6.5.2 정합). 트리거 후 useJobPolling, 완료 시 챗봇이 안내 후 답변 흐름 복귀 (권장)

B) **domain 무관 단순 트리거** — missing_codes 무시하고 대상만 research

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4 — 챗봇 멀티턴 history 관리
챗봇 대화 이력(`ChatRequest.history`)은? (2차 설계=무상태)

A) **클라이언트 보관·매 요청 전달** — ChatWidget 로컬 상태에 ChatTurn[] 유지, 매 chat 요청에 history 동봉(서버 무상태 — 2차 설계 계승). 세션 한정(새로고침 시 초기화) (권장)

B) **localStorage 영속** — 새로고침에도 이력 유지(무저장 원칙과 긴장)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5 — 보고서 [보고서] 버튼: 기존 보고서 선택 정책
DetailView [보고서] 클릭 시 기존 보고서가 여러 개일 수 있다(`ReportListResponse.reports[]`). 어떤 것을 열까?

A) **최신 1건 자동 열기** — reports 목록에서 최신(또는 `ExistenceInfo.latest_report_id`) 자동 선택해 PR 이동. 없으면 [보고서 생성] 흐름. 목록 선택 UI는 후속 (권장 — mockup은 단일 보고서 표시 중심)

B) **목록 모달 후 사용자 선택** — reports[] 목록을 보여주고 고르게(추가 UI)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 6 — mailto 본문 템플릿 내용
`buildMailtoUrl` 본문(body)에 담을 내용은? (FR-5.3, 첨부 미지원)

A) **메타 + 요약 + 링크 + 첨부 안내** — 제목="[silk-road] {국가/권역}명 진단 보고서", 본문=보고서 ID·생성일시·핵심 요약 1~2줄 + HTML 링크 + PDF 링크 + "PDF는 링크에서 내려받으세요(메일 첨부 미지원)" 안내. 수신주소 비움(무저장) (권장)

B) **링크만 최소** — 제목 + HTML/PDF 링크만

X) Other (please describe after [Answer]: tag below)

[Answer]: X → **확정: 3차는 mailto(링크+첨부 안내), SES 첨부 발송은 별도 범위로 분리**. mailto는 첨부 미지원(명세 §6.6·ROADMAP 무저장 원칙)이므로 3차 프론트는 본문에 HTML/PDF 링크 + "다운로드 후 첨부" 안내(원래 Q6-A)로 구현해 SoT 유지. PDF 첨부를 위한 서버 발송(SES/IAM/CFN)은 백엔드·인프라 작업이자 무저장/PII 원칙 변경이므로 신규 요구사항으로 등록해 1·2차(API)·4차(인프라)에서 별도 진행. [메일 발송] 버튼은 추후 mailto→서버발송으로 교체 가능하게 설계.

## Question 7 — 지도 마커 데이터 소스
M1 지도 마커(진출국/예정국, FR-2.3)의 데이터는?

A) **카탈로그 API 기반** — `GET /api/countries`의 `is_baseline`/`has_detail`/`has_report` 등으로 진출/예정 상태 구분, 좌표는 프론트 정적 지오데이터(world atlas) + 코드 매칭 (권장)

B) **별도 좌표·상태 정적 JSON을 프론트에 둠** — API와 무관하게 프론트 데이터로(동기화 부담)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 8 — 라우트 ↔ 진입 모드 표현
URL에 진입 모드(팝업/풀사이즈)를 어떻게 표현할까? (Q3=A 라우팅 + §5.1)

A) **쿼리 파라미터 `?mode=popup|fullscreen`** — 경로는 화면/대상, 모드는 쿼리. 딥링크 공유 시 모드까지 복원. 기본값 규칙(경로 A/B=popup, C=fullscreen)은 진입 시 설정 (권장)

B) **경로 세그먼트로 표현** — `/popup/country/ES/...` 식(경로 복잡)

X) Other (please describe after [Answer]: tag below)

[Answer]: A
