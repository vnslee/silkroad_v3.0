# Requirements Clarification — 3차: 프론트엔드 (React + Vite)

ROADMAP 3차 범위를 확정하기 위한 명확화 질문입니다. 각 질문의 `[Answer]:` 태그 뒤에 letter(예: A)를 채워주세요. 옵션이 안 맞으면 마지막 "Other"를 고르고 설명을 적어주세요. 다 되면 "완료"라고 알려주세요.

> 설계 SoT(`web_design_spec.md`·`intro_spec.md`·`DESIGN.md`·stitch mockup 8종·`PIPELINE.md` §1/§5)는 이미 확정 — 임의 변경하지 않습니다. 아래는 **구현 방식·범위**에 대한 결정입니다.

---

## Question 1
3차에서 구현할 **화면 범위**는 어디까지인가요? (web_design_spec 8화면 + D3 인트로)

A) 전체 8화면(M1 지도·C1 챗봇·P1·P2·PR1·PR2·PS1·PS2) + D3 지구본 시네마틱 인트로까지 한 번에

B) 핵심 흐름 우선(M1 지도 + C1 챗봇 + P1/P2 상세 + PR1/PR2 보고서 embed) — PS1 룰셋/PS2 프로그레스·D3 인트로는 후속 차수

C) MVP 골격만(M1 지도 + 1·2차 API 연동 확인용 최소 P1/PR1) — 나머지 전체 후속

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
1·2차 백엔드 API와의 **연동 방식**은? (현재 FastAPI가 `/api/...`로 JSON·HTML·잡 폴링 제공)

A) 실제 API 연동 — Vite dev proxy로 FastAPI(localhost:8000)에 붙여 카탈로그·리포트·리서치·챗봇 호출. 백엔드 미가동 시 빈 상태/에러 표시

B) 실제 API 연동 + mock 폴백 — API 클라이언트 추상화 후 백엔드 없을 때 목업 데이터로 화면 확인 가능(개발 편의)

C) 우선 mock 데이터로 화면만 — API 연동은 후속(백엔드 의존 최소화)

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 3
렌더 HTML(상세화면 P1/P2·보고서 PR1/PR2) **embed 방식**은? (PIPELINE §5는 iframe 권장)

A) PIPELINE §5 그대로 — iframe embed(`src`로 API의 HTML 엔드포인트 로드), chrome(헤더·버튼)만 React. 스타일 격리

B) iframe(`srcdoc`) — API로 HTML 문자열을 받아 srcdoc 주입(별도 정적 서빙 불필요)

C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
**지도(M1)** 구현 라이브러리는? (web_design_spec은 인터랙티브 지도, intro_spec은 D3 지구본 인트로)

A) D3.js — intro_spec의 지구본 시네마틱 인트로와 동일 스택으로 지도·인트로 통합(명세 충실, 구현 부담↑)

B) 경량 지도 라이브러리(react-simple-maps 등) + D3는 인트로 전용 — 지도 인터랙션 구현 단순화

C) 이번 차수는 지도 placeholder(국가/권역 선택 UI만) — 풀 인터랙티브 지도·D3 인트로는 후속

D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
**스타일링** 방식은? (DESIGN.md=Kinetic Enterprise 팔레트, stitch mockup이 Tailwind 유틸 사용)

A) Tailwind CSS + DESIGN.md 토큰을 tailwind.config에 매핑(시맨틱 토큰만 사용) — mockup과 동일 스택

B) CSS Modules / 일반 CSS에 DESIGN.md 토큰을 CSS 변수로

C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
**테스트** 범위는? (1·2차는 PBT Partial 강제 — PBT-02·03·07·08·09)

A) 프론트 경량 — 핵심 유틸(mailto: URL 조립, API 클라이언트 경로 빌더) 단위 테스트 + 컴포넌트 스모크(Vitest/RTL). PBT는 백엔드 전용 유지

B) 단위 테스트 최소(빌드·타입체크 게이트 위주) — 컴포넌트 테스트는 후속

C) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 7
**이메일 공유**(횡단 기능, ROADMAP §횡단 / web_design_spec §6.6) 이번 차수 포함 여부는?

A) 포함 — PR1/PR2 [메일 발송] 버튼 + `mailto:` URL 조립 유틸(서버 발송 없음, 수신주소 무저장). 3차가 주 구현처

B) 후속 차수로 분리 — 3차는 보고서 표시까지만

C) Other (please describe after [Answer]: tag below)

[Answer]: A
