# Application Design (통합) — frontend (3차)

> Application Design 산출물 ⑤(통합). components-3·component-methods-3·services-3·component-dependency-3을 요약 통합. 상세는 각 문서 참조.

## 1. 개요
ROADMAP 3차 — `app/frontend/`에 React+Vite+TS+Tailwind+D3 클라이언트를 신규 구현한다. 1·2차 backend API(`prefix=/api`)를 **무수정 소비**하고, web_design_spec 8화면 + D3 지구본 인트로를 구현한다. 디자인 SoT(web_design_spec·intro_spec·PIPELINE §1/§5·DESIGN.md·stitch mockup 8종)는 변경하지 않는다.

## 2. 설계 결정 (Q1~Q7 = 전부 A)
| # | 결정 | 적용 |
|---|---|---|
| Q1 | 기능(화면)별 구조 + 공통 레이어 | `src/{app,api,components/*,hooks,utils,store,styles}` |
| Q2 | 모드-무관 화면 + 래퍼 분리 | C1이 Popup/Fullscreen 컨테이너 선택, 화면은 모드 무지 |
| Q3 | 클라이언트 라우팅 + URL hash 딥링크 | 화면/모드/대상 URL 반영, 딥링크 시 인트로 스킵 |
| Q4 | 단일 `useJobPolling` 공용 | 보고서·리서치 잡 폴링 1곳(C10) |
| Q5 | PS1 룰셋 저장 클라이언트까지만 | 폼·검증·localStorage/placeholder, 백엔드 저장 API 범위 밖 |
| Q6 | 경량(TS 타입+fetch+로컬 훅) | 서버상태 라이브러리 없이 |
| Q7 | GlobeIntro/MapView 분리 | 인트로 1회성, 지도 상시 — 둘 다 D3 |

## 3. 컴포넌트 (12종)
- **기반**: C1 AppShell/Router · C2 ApiClient(+경로빌더·TS타입) · C3 Tailwind 토큰
- **화면**: C4 GlobeIntro/MapView(M1) · C5 ChatWidget(C1) · C6 DetailView(P1/P2) · C7 ReportView(PR1/PR2) · C8 RulesetForm(PS1) · C9 Progress(PS2)
- **공통**: C10 useJobPolling · C11 mailto util · C12 전역 Store

자세한 책임·인터페이스: `components-3.md`, 시그니처·엔드포인트 매핑: `component-methods-3.md`.

## 4. 핵심 오케스트레이션 (services-3.md)
- **진입 모드**(S1): 경로 A/B=팝업, 경로 C=풀사이즈. iframe HTML 동일, 컨테이너만 차이.
- **보고서 생성**(S2): createReport(202) → useJobPolling → ProgressPanel/Modal → done → ReportView.
- **챗봇·리서치**(S3): chat → needs_research → triggerResearch(202) → 폴링 → 복귀.
- **embed**(S4/S5): detail·report HTML은 iframe src로 브라우저 직접 로드, PDF는 anchor, 메일은 mailto.
- **인트로**(S6): 딥링크 아니면 GlobeIntro → MapView.

## 5. 책임 경계 (PIPELINE §5 — 핵심)
- **chrome(React)**: 헤더·메타·모든 액션 버튼·진입 모드 래핑·로딩/에러.
- **콘텐츠(iframe HTML)**: 표/차트/탭 본문(렌더 엔진 산출). postMessage 브리지 불필요.

## 6. 의존 구조 (component-dependency-3.md)
- C2(ApiClient)·C3(토큰)·C11(mailto)은 leaf. C10은 C2만 의존. C1이 최상위 조립자. **순환 의존 없음**.
- 빌드 순서: 스캐폴드→C2→C1/C12→C4→C6/C7→C5/C10/C9→C8/C11→테스트.

## 7. 백엔드 영향
- **소규모 확장(Functional Design 3차에서 확정)** — 카탈로그·보고서·리서치·잡 폴링·챗봇은 1·2차로 충족. **상세화면 렌더링은 비동기 폴링 잡으로 백엔드 확장**(`POST .../detail` 202 + detail orchestrator, 1·2차 동형; 기존 동기 `GET .../detail`은 보존). PS1 룰셋 저장은 미존재 → 클라이언트까지만(Q5=A). PDF SES 첨부 발송은 3차 제외(별도 범위).
- 상세는 `construction/frontend/functional-design/frontend-components-3.md` §5(백엔드 확장 요청) 참조.

## 8. 다음 단계 (Functional Design 3차 입력)
- 라우트 상태머신·진입 모드 전환 규칙 상세
- 잡 step → 5개 프로그레스 바 매핑 산식, 폴링 간격·terminal 처리
- 챗봇 §6.5 분기 상태·history 전달 포맷
- mailto URL 조립 규칙(제목/본문 템플릿·인코딩·첨부 안내)
- API 경로 빌더 계약(country↔region 대칭) + TS 타입 schemas.py 1:1 대조
- PBT는 백엔드 전용 유지, 프론트는 경량(C2 경로빌더·C11 mailto 단위 + 컴포넌트 스모크)
