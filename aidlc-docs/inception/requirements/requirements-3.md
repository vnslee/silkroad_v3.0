# Requirements — 3차: 프론트엔드 (React + Vite)

## Intent 분석 요약
- **User Request**: ROADMAP 3차 진행 — 지도 UI + 8개 화면 + 챗봇 위젯을 React+Vite 앱으로 구현, 1·2차 API 연동.
- **Request Type**: New Feature (프론트엔드 신규 — `app/frontend`는 README만 존재).
- **Scope**: Multiple Components — D3 인트로/지도 + 8화면 컴포넌트 + 챗봇 + iframe embed + API 클라이언트 + 이메일 유틸.
- **Complexity**: Complex (시네마틱 인트로·인터랙티브 지도·비동기 잡 폴링·iframe embed·진입 모드 2종).
- **Project Type**: Brownfield. **의존**: 1차 backend-api(카탈로그·리포트·잡), 2차(리서치·챗봇 API). 디자인 SoT 확정.

## 확인된 환경 / SoT
- **스택**: React + Vite (`app/frontend/`), ROADMAP 확정.
- **디자인 source of truth(임의 변경 금지)**: `architecture/design/design_spec/web_design_spec.md`(8화면·진입모드·6.x 플로우), `intro_spec.md`(D3 지구본 시네마틱 인트로), `architecture/design/stitch/DESIGN.md`(Kinetic Enterprise 팔레트), stitch mockup 8종(`stitch/html/*.html`), `PIPELINE.md` §1/§5(렌더 HTML iframe embed + chrome만 React — 핵심 결정).
- **백엔드 API(가동 중 확인)**: `GET /api/{countries,regions}` 카탈로그·존재, `GET /api/{...}/detail`, 리포트 `POST/GET .../reports[/{id}/{json,html,pdf}]`, 잡 `GET /api/jobs/{id}`, 리서치 `POST .../research`, 챗봇 `POST /api/chat`.
- **스킬 우선순위(CLAUDE.md)**: ① DESIGN.md/mockup/web_design_spec = SoT. ② frontend-design = 구현 충실도·품질 게이트. ③ ui-ux-pro-max = 접근성·차트 검증 보조(현행 유지 — 사용자 확인).

## 결정 사항 (명확화 답변 — 전부 A)
| # | 결정 | 내용 |
|---|------|------|
| Q1 | 화면 범위 | **A 전체** — 8화면(M1·C1·P1·P2·PR1·PR2·PS1·PS2) + D3 지구본 시네마틱 인트로까지 한 차수에. ⚠️ 단일 차수 최대 범위 → Application Design에서 컴포넌트 분해로 관리. |
| Q2 | API 연동 | **A 실제 연동** — Vite dev proxy로 FastAPI(`localhost:8000`)에 붙음. 백엔드 미가동 시 빈 상태/에러 표시. |
| Q3 | 렌더 HTML embed | **A iframe `src`** — API HTML 엔드포인트를 iframe src로 로드(PIPELINE §5 그대로). chrome만 React. |
| Q4 | 지도 라이브러리 | **A D3.js** — intro_spec 지구본 인트로와 동일 스택으로 지도·인트로 통합. |
| Q5 | 스타일링 | **A Tailwind CSS** + DESIGN.md 토큰을 tailwind.config에 매핑(시맨틱 토큰만). mockup과 동일 스택. |
| Q6 | 테스트 | **A 경량** — 핵심 유틸(mailto:·API 경로 빌더) 단위 + 컴포넌트 스모크(Vitest/RTL). PBT는 백엔드 전용 유지. |
| Q7 | 이메일 공유 | **A 포함** — PR1/PR2 [메일 발송] 버튼 + `mailto:` URL 조립 유틸. 서버 발송 없음, 수신주소 무저장. |

## Extension 설정 (1·2차 계승)
- Security: No · Resiliency: No · **PBT: Partial**(백엔드 전용). 프론트는 경량 테스트(Q6=A).

---

## 기능 요구사항 (Functional Requirements)

### FR-1. 앱 셸 · 라우팅 · API 클라이언트
- **FR-1.1** Vite + React + TypeScript 프로젝트(`app/frontend/`), `package.json`·`vite.config`·Tailwind 설정. dev proxy `/api → localhost:8000`.
- **FR-1.2** API 클라이언트 모듈 — 카탈로그/존재/상세/리포트(목록·JSON·HTML·PDF URL)/잡 폴링/리서치 트리거/챗봇. 1·2차 엔드포인트·`to_url` 경로 규칙과 정합. 경로 빌더 유틸은 단위 테스트(Q6).
- **FR-1.3** 진입 모드 2종(팝업/풀사이즈, §5.1) 라우팅·상태 — 동일 화면 콘텐츠, 컨테이너만 차이. URL hash 딥링크(인트로 스킵, intro_spec).
- **FR-1.4** Tailwind config에 Kinetic Enterprise 토큰 매핑(색·타이포·간격·elevation·z-index). raw hex 금지(시맨틱 토큰).

### FR-2. M1 지도 + D3 시네마틱 인트로
- **FR-2.1** D3 지구본 인트로 시퀀스(1단계 등장·자전 → 2단계 펼침 → 3단계 착지 + UI 페이드인, intro_spec). `prefers-reduced-motion` 존중. URL hash 딥링크 시 인트로 생략.
- **FR-2.2** 인터랙티브 지도 — 드래그(회전/패닝)·휠 줌(1~6)·국가/권역 포커스 줌·하이라이트·리셋. 라이트 테마(DESIGN.md 팔레트: 육지 primary-container, 바다 primary-fixed 계열).
- **FR-2.3** 마커·범례 — 진출국(채운 점)/진출예정국(점선 빈 점, 발광), 최우측 상단 범례.
- **FR-2.4** 상단 바(중앙 CI 로고·타이틀, 우측 한/영·설정, 좌측 메뉴 드롭다운 5항목)·Notification 메시지(선택 시 페이드아웃)·좌측 하단 챗봇 위젯 버튼.

### FR-3. C1 챗봇 위젯/팝업
- **FR-3.1** 위젯 버튼 클릭 시에만 노출(자동 X). 위치 규칙(§5.2): 다른 팝업 있으면 좌측 하단, 없으면 정중앙.
- **FR-3.2** 대화/답변창 + 제한 질문 칩(말풍선/칩 클릭). `POST /api/chat` 연동 — needs_research 분기 시 "리서치 진행?" 칩 흐름(§6.5), 리서치 트리거(`POST .../research`)·잡 폴링.

### FR-4. P1/P2 상세화면 (iframe embed + chrome)
- **FR-4.1** 상세 HTML(`/api/{...}/detail`)을 iframe src로 embed. 없으면 백엔드가 렌더(엔진) — 프론트는 로딩/빈 상태 처리.
- **FR-4.2** chrome — P1: 국기·국가명·영문명 헤더 + [시뮬레이션]·[보고서]·[보고서 생성]. P2: 권역명 헤더 + [시뮬레이션]·[보고서]·[보고서 생성]. 진입 모드 2종 래핑.
- **FR-4.3** [보고서 생성] → `POST .../reports` 잡 트리거 → PS2/프로그레스 패널로 진행 표시 → 완료 시 [보고서 보기]로 PR1/PR2.

### FR-5. PR1/PR2 보고서 (iframe embed + chrome + 이메일)
- **FR-5.1** 보고서 HTML(`/api/{...}/reports/{id}/html`)을 iframe src로 embed. (엔진 산출 HTML이 탭·표·차트 본문 포함.)
- **FR-5.2** chrome — 헤더(국기/지구본·이름·권역·비교국), 우측 상단 메타(보고서 ID·생성일시·스냅샷일자) + [PDF 다운로드](`/reports/{id}/pdf`) + [메일 발송].
- **FR-5.3** [메일 발송] → `mailto:` URL 조립 유틸(제목·본문에 보고서 메타·요약·HTML/PDF 링크 인코딩). 서버 발송 없음, 수신주소 수집·저장 안 함(무저장). mailto 첨부 미지원 → 본문 링크 + 첨부 안내. 단위 테스트(Q6).

### FR-6. PS1 룰셋 설정
- **FR-6.1** 룰셋 ID 드롭다운 + [저장]. 3패널: ① 카테고리 가중치 슬라이더(시장/규제/환경/시스템, 합 100%) ② 임계값 신뢰도 계수(이식 임계·시스템 게이트 0~100) ③ 출처 신뢰도 계수(Tier1/2/3, 0~1.0). 진입 모드 풀사이즈.
- (백엔드 룰셋 저장 API는 1·2차 범위 밖일 수 있음 — Application Design에서 연동 가능 여부 확인. 미존재 시 클라이언트 폼·검증까지.)

### FR-7. PS2 프로그레스 + 패널
- **FR-7.1** 보고서 생성 잡 진행을 잡 폴링(`GET /api/jobs/{id}`)으로 표시. 5개 프로그레스 바(시장/규제/상품/시스템/결과 생성), 우측 하단 [보고서 보기].
- **FR-7.2** 진행 중이고 PS2 비활성 시 우측 상단 카드형 프로그레스(국가/권역·전체 0~100%·상세보기) — 상세보기 → PS2 정중앙(§5.3). 진행 없으면 미노출.

---

## 비기능 요구사항 (NFR — 개요, 상세는 NFR Requirements 단계)
- **반응형**: 모바일 우선 → 태블릿 → 데스크톱(DESIGN.md 브레이크포인트·그리드). 데스크톱 사이드바 없음(상단 메뉴).
- **접근성**: 키보드 포커스 가시화, `aria-label`, `prefers-reduced-motion`(D3 인트로·모션 필수), iframe title, 색+아이콘/텍스트 병행(ui-ux-pro-max 체크리스트).
- **성능**: 코드 스플리팅(라우트/화면별), 차트·지도 60fps 지향, iframe lazy 가능.
- **품질 게이트**: 빌드·타입체크, Vitest 경량 테스트, frontend-design 2-pass(토큰 이식 → mockup 충실도).

## FR ↔ 화면 추적성
| 화면 | FR |
|---|---|
| 앱 셸·API·라우팅 | FR-1 |
| M1 + D3 인트로 | FR-2 |
| C1 챗봇 | FR-3 |
| P1·P2 | FR-4 |
| PR1·PR2 | FR-5 |
| PS1 | FR-6 |
| PS2·프로그레스 | FR-7 |

## 범위 메모
- Q1=A로 8화면 전체 + D3 인트로가 한 차수에 포함 → **작업량 큼**. Application Design에서 컴포넌트·우선순위로 분해하고, Code Generation에서 단계적 생성(셸→지도/인트로→상세/보고서 embed→챗봇→PS1/PS2)으로 관리.
- 백엔드 미구현 가능 항목(PS1 룰셋 저장 API 등)은 Application Design에서 식별 — 미존재 시 클라이언트 측까지만 구현하고 후속 연동 표시.
