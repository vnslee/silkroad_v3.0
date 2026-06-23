# NFR Requirements — frontend (3차)

> Functional Design(3차)을 토대로 한 비기능 요구사항(경량). 보안/복원력 opt-out·PBT 백엔드 전용 상속. 결정: Q1~Q5 = A(Q2는 DESIGN.md 그리드 정합 보강).

## 1. 성능 (Performance) — Q3=A
- **코드 스플리팅**: 화면별 lazy import(React.lazy/Suspense) — 라우트 기반 분할(map/detail/report/ruleset/progress). 초기 번들 최소화.
- **지도·차트**: 60fps 지향(D3 렌더·전환). 엄격 측정·SLA 게이트는 두지 않음(데모 단계).
- **iframe**: lazy 로딩 가능(`loading="lazy"`). 상세/보고서 HTML은 브라우저 직접 로드(JS fetch 미경유).
- **정량 게이트 없음**: 번들 예산·LCP 측정 게이트 미설정(B 미채택).

## 2. 반응형 (Responsive) — Q2=A + DESIGN.md 정합
- **모바일 우선**. Tailwind 기본 브레이크포인트 사용(sm 640·md 768·lg 1024·xl 1280) + **DESIGN.md 3단계 그리드 정합**:
  - Mobile: 4컬럼, 16px 거터, 16px 사이드 마진
  - Tablet: 8컬럼, 24px 거터, 32px 사이드 마진
  - Desktop: 12컬럼, 24px 거터, 48px 사이드 마진
- 모바일 전용 타이포 변형(`headline-lg-mobile` 등) 적용. 사이드바 없음(상단 메뉴 드롭다운, §5.4).
- 지도·차트·iframe·팝업은 컨테이너 기준 반응. 4px 베이스 증분 스페이싱(DESIGN.md).

## 3. 접근성 (Accessibility / Usability) — business-rules-3 AR 상속
- `prefers-reduced-motion` 존중(GlobeIntro·지도·전환 모션 단축/생략) — **필수**(AR-1).
- iframe `title`(AR-2), 키보드 포커스 가시화·팝업 포커스 트랩·Esc 닫기(AR-3), `aria-label`·색+아이콘/텍스트 병행(AR-4·5), `aria-live` 잡 진행 알림(AR-6).
- ui-ux-pro-max 체크리스트로 검증(보강 전용, 팔레트 교체 금지).

## 4. 신뢰성 (Reliability) — business-rules-3 ER 상속
- 백엔드 미가동/네트워크 오류 → 화면별 빈 상태·재시도(requirements-3 Q2). 잡 폴링 네트워크 오류 3회 재시도 후 error.
- 잡 실패(failed) 명시 표시 + 재트리거. 404 HTML → "없음/생성 필요" chrome 메시지.

## 5. 보안 (Security)
- **Security Baseline opt-out 상속**(별도 인증/권한 없음, 내부·데모).
- mailto **무저장**(수신주소 수집·저장 안 함, PII 최소). report_id 등은 백엔드가 검증(1차 H1 패턴) — 프론트는 URL 빌드만.
- iframe 격리로 렌더 HTML 스타일/스크립트 충돌 차단(같은 출처 dev proxy).

## 6. 유지보수 (Maintainability) — Q4=A
- **로컬 품질 게이트**(npm 스크립트): `build`(vite)·`typecheck`(tsc --noEmit)·`test`(vitest run)·`lint`(선택).
- frontend-design 2-pass(토큰 이식→mockup 충실도)·ui-ux-pro-max 점검은 구현 단계 수동.
- CI 파이프라인은 4차(배포) 범위(B 미채택).
- 컴포넌트 기능별 구조(Application Design Q1)·시맨틱 토큰만(raw hex 금지, DR-1).

## 7. 호환성 (Compatibility) — Q5=A
- **모던 에버그린 브라우저**(Chrome/Edge/Firefox/Safari 최신), ES2020+ 타깃. 폴리필 최소. 레거시(IE11) 미지원.

## 8. 테스트 (Testing) — requirements-3 Q6 상속
- **PBT는 백엔드 전용 유지**(프론트 미적용).
- 프론트 경량: 단위(Vitest, FT-1~5: 경로빌더·parseHashRoute·mailto·mapStepToBars·룰셋검증) + 컴포넌트 스모크(RTL, FC-1~4) + dev proxy 통합 스모크(FI-1~2). business-rules-3 참조.

## 9. 스코프 밖 (명시)
- PDF SES 첨부 발송(별도 범위), CI 자동화(4차), 정량 성능 SLA, 룰셋 저장 백엔드 API(미존재).
