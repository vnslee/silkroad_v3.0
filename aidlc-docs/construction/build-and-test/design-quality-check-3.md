# Design Quality Check — frontend (3차)

frontend-design 스킬(2-pass) + ui-ux-pro-max(접근성·차트) 점검. 디자인 SoT(DESIGN.md·mockup) 무변경.

## Pass 1 — 토큰 이식 (mockup → tailwind.config)
- DESIGN.md "Kinetic Enterprise" 색·타이포·간격을 `tailwind.config.ts` 시맨틱 토큰으로 1:1 이식.
- mockup 사용 클래스(`text-primary`·`bg-secondary`·`bg-surface-container-lowest`·`rounded-full`·`text-label-md`·`shadow-*`)와 토큰 일치 확인.
- **raw hex 없음**(DR-1) — 컴포넌트는 시맨틱 클래스만 사용.
- ✅ 신규 팔레트/폰트 발명 없음(SoT 준수).

## Pass 2 — mockup 대비 충실도
| 화면 | 충실도 | 비고 |
|---|---|---|
| M1 지도 | 구조 충실(상단바·범례·챗봇 버튼·Notification) | mockup 픽셀 완성도는 보강 여지(지도 폴리곤은 coords 간이) |
| C1 챗봇 | 구조 충실(위치 규칙§5.2·칩·말풍선) | — |
| P1/P2 상세 | **chrome만 React**, 본문=iframe(엔진 HTML) | PIPELINE §5 정합 — 본문 시각은 detail 렌더러 책임 |
| PR1/PR2 보고서 | **chrome만 React**(헤더·메타·버튼), 본문=iframe | 레이더 차트·점수 지표·탭은 report 렌더러 HTML(iframe 내부) |
| PS1 룰셋 | 3패널·슬라이더·검증 구조 충실 | — |
| PS2 프로그레스 | 전체바 + 개별바(kind별) 구조 충실 | mockup의 5바와 정합(research kind) |

> **핵심**: P1/P2/PR1/PR2의 데이터 시각화(차트·표)는 iframe 내부 = 렌더 엔진 standalone HTML이 담당(PIPELINE §5·web_design_spec §5.5). 프론트는 chrome만 — 따라서 차트 충실도는 기존 렌더러(1·2차 산출) 책임이고 3차 프론트 범위 밖.

## 품질 게이트 (quality floor)
| 항목 | 상태 |
|---|---|
| 반응형(모바일~데스크톱) | ✅ Tailwind 브레이크포인트 + DESIGN.md 3단계 그리드(margin-mobile/desktop) |
| 키보드 포커스 가시성 | ✅ `:focus-visible` outline(index.css), 팝업 Esc·포커스 |
| `prefers-reduced-motion` | ✅ index.css 전역 단축 + GlobeIntro 즉시 onDone |
| iframe title | ✅ DetailView·ReportView title 속성 |
| aria-live / aria-label | ✅ 챗봇·Notification·프로그레스·버튼 |
| 색+텍스트 병행 | ✅ 범례(진출/예정), 상태 텍스트 |
| CSS specificity 충돌 | ✅ 유틸 클래스 기반(섹션/요소 셀렉터 충돌 없음) |

## ui-ux-pro-max 보강
- 차트 점검(charts.csv)은 **iframe 내부 렌더 HTML 대상** — 보고서 렌더러(report_render_req.md)가 nature→차트 매핑 보유. 3차 프론트는 embed만 하므로 본 차수 점검 대상 아님(렌더러 검증은 1·2차/별도).
- 접근성 체크리스트는 위 품질 게이트로 충족.

## 남은 보강(후속 권장, 차단 아님)
- mockup 픽셀 충실도(여백·아이콘·머티리얼 심볼) 정밀 이식.
- 지도 전체 폴리곤(world-atlas topojson) — 현재 마커+coords 간이.
- 브라우저 수동 워크플로우 확인(인트로→지도→상세→보고서→메일).
