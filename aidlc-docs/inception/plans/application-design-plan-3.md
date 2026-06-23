# Application Design Plan — frontend (3차)

requirements-3 + 1·2차 API + 디자인 SoT(web_design_spec·intro_spec·PIPELINE §1/§5·DESIGN.md·stitch mockup 8종)를 토대로 한 프론트엔드 애플리케이션 설계 계획.
아래 질문에 `[Answer]:`를 채운 뒤 "완료"라고 알려주면 설계 산출물(`application-design/` 3차분)을 생성한다.

> 이 단계는 **컴포넌트 식별·책임·인터페이스(시그니처)·서비스(오케스트레이션)·의존 관계**까지만 다룬다. 상세 상태 전이 로직·잡 폴링 알고리즘·mailto 조립 규칙은 다음 Functional Design에서 정의한다.

## 확인된 사실 (설계 입력)

### 백엔드 API 계약 (1·2차, 전부 `prefix=/api`, 무수정 소비)
- 카탈로그: `GET /api/countries`, `GET /api/regions`, `GET /api/countries/{code}`(존재), `GET /api/regions/{region}`(존재)
- 상세: `GET /api/countries/{code}/detail`, `GET /api/regions/{region}/detail` (HTML)
- 보고서: `POST /api/{countries/{code}|regions/{region}}/reports`(202 잡 트리거), `GET .../reports`(목록), `GET .../reports/{report_id}/{json|html|pdf}`
- 잡: `GET /api/jobs/{job_id}` (status/step/percent 폴링)
- 리서치: `POST /api/countries/{code}/research`, `POST /api/regions/{region}/research` (202 비동기 잡)
- 챗봇: `POST /api/chat` (동기, ChatResponse)
- 잡 트리거 응답: `{job_id, status, status_url}` → 프론트는 `status_url`/`jobs/{id}` 폴링

### 디자인 SoT (변경 금지)
- 8화면: M1(지도)·C1(챗봇)·P1(국가상세)·P2(권역상세)·PR1(국가보고서)·PR2(권역보고서)·PS1(룰셋)·PS2(프로그레스)
- 진입 모드 2종(§5.1): **팝업 모드**(M1 위 오버레이, 챗봇/버튼 진입) / **풀사이즈 모드**(전체 점유, 상단 메뉴 진입). 콘텐츠 동일, 컨테이너만 차이.
- 챗봇 위치(§5.2): 다른 팝업 있으면 좌측 하단, 없으면 정중앙. 자동 노출 안 함.
- 프로그레스(§5.3): 생성 중 & PS2 비활성 → 우측 상단 카드. 상세보기 → PS2 정중앙.
- embed(§5.5/PIPELINE §5): P1/P2/PR1/PR2 본문은 **iframe `src`로 API HTML embed**, chrome(헤더·버튼)만 React. 액션 버튼 전부 chrome 담당. postMessage 브리지 불필요.
- 인트로(intro_spec): D3 지구본 3단계(등장·자전 → 펼침 → 착지+UI 페이드인). URL hash 딥링크 시 생략. `prefers-reduced-motion` 존중.
- 스타일: Tailwind + DESIGN.md(Kinetic Enterprise) 토큰 매핑(시맨틱 토큰만, raw hex 금지).

## 식별된 컴포넌트 (초안 — 질문으로 확정)

### 기반 레이어
1. **AppShell / Router** (`app/frontend/src/app/`) — 라우팅·진입 모드 컨테이너(팝업 오버레이 vs 풀사이즈)·URL hash 딥링크·전역 레이아웃(상단 바)
2. **ApiClient** (`src/api/`) — fetch 래퍼 + **경로 빌더 유틸**(카탈로그·존재·상세 URL·리포트 목록/json/html/pdf URL·잡 폴링·리서치 트리거·챗봇). 도메인(country/region) 대칭. 경로 빌더는 단위 테스트 대상(Q6).
3. **DesignTokens / tailwind.config** — DESIGN.md 토큰을 Tailwind 시맨틱 토큰으로 매핑(색·타이포·간격·elevation·z-index)

### 화면/기능 컴포넌트
4. **MapView (M1)** + **GlobeIntro** — D3 지구본 인트로 시퀀스 + 인터랙티브 지도(드래그/줌/포커스/마커/범례) + 상단 바·Notification·챗봇 위젯 버튼
5. **ChatWidget (C1)** — 위젯 버튼·대화창·질문 칩·`POST /api/chat`·needs_research 분기(§6.5)·리서치 트리거+잡 폴링·위치 규칙(§5.2)
6. **DetailView (P1/P2)** — 상세 HTML iframe embed + chrome(헤더·[시뮬레이션]·[보고서]·[보고서 생성])·진입 모드 래핑
7. **ReportView (PR1/PR2)** — 보고서 HTML iframe embed + chrome(헤더·메타·[PDF]·[메일 발송])
8. **RulesetForm (PS1)** — 룰셋 3패널 폼(가중치 슬라이더·임계 계수·출처 계수)·풀사이즈
9. **ProgressPanel / ProgressModal (PS2)** — 잡 폴링 기반 5바 프로그레스 + 우측 상단 카드형(§5.3)
10. **mailto util** (`src/utils/`) — 보고서 메타·요약·링크 → `mailto:` URL 조립(무저장·첨부 안내). 단위 테스트 대상(Q6).

### 공통/상태
11. **JobPolling hook** (`src/hooks/`) — `GET /api/jobs/{id}` 폴링 추상화(보고서 생성·리서치 공용)
12. **EntryMode / 전역 상태** — 진입 모드·활성 팝업·진행 중 잡 상태(프로그레스 카드 노출 판단)

## 산출물 계획 (Mandatory)
- [ ] `application-design/components-3.md` — 컴포넌트 정의·책임·인터페이스
- [ ] `application-design/component-methods-3.md` — 메서드/훅/유틸 시그니처 + API 엔드포인트 매핑 표
- [ ] `application-design/services-3.md` — 오케스트레이션(잡 폴링·챗봇 분기·보고서 생성 흐름·진입 모드 전환)·에러 정책
- [ ] `application-design/component-dependency-3.md` — 의존 매트릭스·통신 패턴(mermaid)·데이터 흐름
- [ ] `application-design/application-design-3.md` — 통합 문서

---

# 설계 질문

## Question 1 — 폴더/컴포넌트 구조
프론트 소스 구조(컴포넌트 조직)는?

A) **기능(화면)별 구조 + 공통 레이어 분리** — `src/{app(셸·라우팅), api(클라이언트·경로빌더), components(화면별: map/chat/detail/report/ruleset/progress), hooks, utils, styles}`. 화면별 응집 + api/hooks/utils 공유 (권장)

B) **타입별 구조** — `src/{components, pages, services, utils}` 평면 분류

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — 진입 모드(팝업/풀사이즈) 구현
§5.1 진입 모드 2종을 어떻게 구현할까? (콘텐츠 동일, 컨테이너만 차이)

A) **모드-무관 화면 컴포넌트 + 모드 래퍼 분리** — P1/P2/PR1/PR2/PS1 화면 컴포넌트는 모드를 모르고, 바깥의 `<PopupContainer>`/`<FullscreenContainer>` 래퍼가 사이즈·오버레이·닫기 방식만 결정. 라우팅 상태에 모드 플래그 (권장 — PIPELINE §5 "embed HTML 동일, 컨테이너만 차이"와 정합)

B) **화면 컴포넌트가 모드 prop을 받아 내부 분기**

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question 3 — 라우팅·딥링크 방식
화면 전환·URL 딥링크(intro_spec 딥링크 시 인트로 생략)는?

A) **클라이언트 라우팅 + URL hash 딥링크** — react-router(또는 경량 라우터)로 화면/모드/대상코드를 URL에 반영(`#/country/ES/report?mode=popup` 등). hash 존재 시 GlobeIntro 생략 (권장)

B) **상태 기반 전환만(URL 미반영)** — 전역 상태로 화면 전환, 딥링크는 쿼리만 최소 처리

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4 — 잡 폴링 추상화 범위
보고서 생성·리서치 둘 다 202 잡 + `GET /api/jobs/{id}` 폴링이다. 공용화 수준은?

A) **단일 `useJobPolling` 훅 + 잡 종류(kind) 무관 공용** — status/step/percent 폴링 로직 1곳, 소비처(ProgressPanel·ChatWidget)가 결과 해석. 1·2차 JobManager가 이미 kind 공용 (권장)

B) **보고서/리서치 별도 폴링 훅** — 각 흐름 전용

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5 — PS1 룰셋 저장 백엔드 연동
PS1 룰셋 저장 API는 1·2차 범위에 **없다**(라우트 미존재 확인). 이번 차수 처리는?

A) **클라이언트 폼·검증까지만 구현 + 저장은 후속 표시** — 3패널 폼·합 100% 검증·로컬 상태까지. 저장 버튼은 "후속 연동" placeholder(또는 localStorage 임시). 백엔드 룰셋 저장 API는 범위 밖 (권장 — requirements-3 FR-6.1 단서와 정합)

B) **이번 차수에 백엔드 룰셋 저장 엔드포인트도 추가** — 3차 범위를 백엔드까지 확장(범위 증가)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6 — API 클라이언트 타입/상태관리
API 응답 타입·서버 상태 관리는?

A) **경량 — TS 타입 수기 정의 + fetch 래퍼 + 화면 로컬 상태/커스텀 훅** (별도 서버상태 라이브러리 없이; Q6 경량 테스트 기조와 정합) (권장)

B) **TanStack Query 등 서버상태 라이브러리 도입** — 캐싱·재요청 자동화(의존성·러닝커브 추가)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7 — 지도와 인트로 D3 통합 경계
M1 지도와 GlobeIntro(둘 다 D3, Q4=A)의 컴포넌트 경계는?

A) **GlobeIntro(인트로 전용) → 완료 시 MapView(평면 지도)로 전환, 둘 다 D3지만 별도 컴포넌트** — 인트로는 1회성 시퀀스, 지도는 상시 인터랙션. 딥링크 시 GlobeIntro 스킵하고 MapView 직접 (권장)

B) **단일 컴포넌트가 인트로→지도 연속 처리** — 한 D3 캔버스에서 모드 전환

X) Other (please describe after [Answer]: tag below)

[Answer]: A
