# NFR Requirements Plan — frontend (3차)

NFR은 **경량**. 1·2차 백엔드 결정 대부분 상속(프론트는 별도 스택). 신규(프론트) 결정만 질문. `[Answer]:`를 채운 뒤 "완료".

## 상속·확정(재질문 안 함)
- **백엔드 무관 상속**: 보안/복원력 opt-out(Security No·Resiliency No), PBT는 **백엔드 전용**(프론트는 경량 Vitest, requirements-3 Q6).
- **확정된 프론트 스택(Application Design·requirements-3)**: React + Vite + TypeScript + Tailwind(DESIGN.md 토큰 매핑) + D3. 서버상태 라이브러리 없이 경량(Q6=A).
- **연동**: Vite dev proxy `/api → localhost:8000`(실제 API 연동, requirements-3 Q2). iframe `src` embed(Q3). mailto 클라이언트 위임(무저장).
- **테스트**: 단위(경로 빌더·parseHashRoute·mailto·mapStepToBars·룰셋 검증) + 컴포넌트 스모크(RTL) + dev proxy 통합 스모크(business-rules-3 FT/FC/FI).
- **접근성·모션·대칭 규칙**: business-rules-3 AR/SR/DR 그대로(키보드·`prefers-reduced-motion`·iframe title·색+텍스트 병행).
- **환경 확인**: Node v20.20.2, npm 10.8.2.

## 산출물 계획 (Mandatory)
- [ ] `nfr-requirements/nfr-requirements-3.md`
- [ ] `nfr-requirements/tech-stack-decisions-3.md`

---

# 질문

## Question 1 — 의존성 버전 핀 정책
프론트 `package.json` 의존성 버전 정책은?

A) **메이저 핀(캐럿 `^`) + 핵심 라이브러리 명시** — React 18·Vite 5·TypeScript 5·Tailwind 3·D3 7·Vitest 2·RTL 등 현재 안정 메이저에 `^`. 재현성은 `package-lock.json`으로 확보 (권장 — npm 관례)

B) **정확 버전 핀(==상당, 캐럿 없음)** — 모든 의존성 고정 버전

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2 — 반응형 기준
반응형 브레이크포인트는? (requirements-3 NFR: 모바일 우선)

A) **Tailwind 기본 브레이크포인트 + DESIGN.md 정합** — sm/md/lg/xl(640/768/1024/1280) 기본 사용, 모바일 우선. 데스크톱 사이드바 없음(상단 메뉴, §5.4). 지도·차트는 컨테이너 반응 (권장)

B) **DESIGN.md 전용 커스텀 브레이크포인트** — 명세가 별도 정의 시 그것 우선

X) Other (please describe after [Answer]: tag below)

[Answer]: A 가빈아니 명세 정의된 것도 참조

## Question 3 — 성능 목표·코드 스플리팅
성능 NFR 수준은? (requirements-3 NFR: 코드 스플리팅·60fps 지향)

A) **경량 목표 + 라우트 기반 스플리팅** — 화면별 lazy import(코드 스플리팅), 지도/차트 60fps 지향(엄격 측정 안 함), iframe lazy. 정량 SLA·번들 예산 게이트는 두지 않음(데모 단계) (권장)

B) **정량 성능 게이트** — 번들 크기 상한·LCP 등 측정 게이트 추가

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4 — 빌드·품질 게이트
CI/품질 게이트 수준은?

A) **로컬 게이트(스크립트)** — `vite build`(번들)·`tsc --noEmit`(타입체크)·`vitest run`(경량 테스트)을 npm 스크립트로. frontend-design 2-pass·ui-ux-pro-max 점검은 구현 단계 수동. 별도 CI 파이프라인은 4차(배포) 범위 (권장)

B) **CI 파이프라인 구성** — GitHub Actions 등 자동화(4차 선행)

X) Other (please describe after [Answer]: tag below)

[Answer]: a

## Question 5 — 브라우저 지원 범위
타깃 브라우저는?

A) **모던 에버그린(Chrome/Edge/Firefox/Safari 최신)** — 폴리필 최소, ES2020+ 타깃. 데모/내부용 (권장)

B) **레거시 포함(IE11 등)** — 폴리필·트랜스파일 강화(부담↑, 비권장)

X) Other (please describe after [Answer]: tag below)

[Answer]: a
