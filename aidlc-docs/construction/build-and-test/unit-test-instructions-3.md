# Unit Test Instructions — frontend (3차)

## 실행
```bash
cd app/frontend
npm test            # vitest run
npm run test:watch  # 워치 모드
```

## 범위 (경량 — Q6, PBT는 백엔드 전용)
| 파일 | 대상 | 속성 |
|---|---|---|
| `paths.test.ts` | FT-1 경로 빌더 | country↔region 대칭·코드 대문자·엔드포인트 정확 |
| `route.test.ts` | FT-2 라우트 | parseHashRoute/buildHash 왕복·mode 쿼리·딥링크 판정 |
| `mailto.test.ts` | FT-3 buildMailtoUrl | to 빈값(무저장)·첨부 안내·2000자 절단 |
| `progress.test.ts` | FT-4 mapStepToBars | kind별 바·percent 보간 단조 |
| `validation.test.ts` | FT-5 룰셋 검증 | 합100 판정·clamp |
| `RulesetForm.test.tsx` | FC-4 컴포넌트 | 저장 활성·3패널 렌더 |
| `ReportView.test.tsx` | FC-3 컴포넌트 | iframe title·액션 버튼 |

## 결과 (2026-06-22)
- **24 passed (7 files)**, ~3.9s. 0 실패.

## 비고
- ChatWidget/ProgressModal 스모크는 fetch/타이머(폴링) 의존이라 단위에서 제외 → 통합 스모크(integration)로 검증.
