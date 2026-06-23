# Integration Test Instructions — frontend (3차)

dev proxy로 프론트(5173)↔백엔드(8000) 실제 연동 스모크.

## 준비
```bash
# 터미널 1 — 백엔드
cd app/backend && uvicorn api.main:app --host 127.0.0.1 --port 8000
# 터미널 2 — 프론트
cd app/frontend && npm run dev   # http://localhost:5173
```

## 스모크 시나리오 & 결과 (2026-06-22 실행)
| ID | 시나리오 | 결과 |
|---|---|---|
| FI-1 | `GET /api/countries`(proxy 경유) | ✅ 200, 10개국 카탈로그 |
| FI-2 | 상세 HTML `GET .../detail`(iframe src) | ✅ 200, standalone HTML 반환 |
| FI-3 | **상세 렌더 잡(신규 확장)** `POST .../detail`(202) → 폴링 | ✅ queued→done, kind=detail, html_url 반환 |
| FI-4 | 보고서 생성 `POST .../reports`(202) → 폴링 | ✅ succeeded, report_id=RPT_CTR_ES_002, html_url |
| FI-5 | Vite root `GET /` | ✅ 200 |

## 정리
- 스모크로 생성된 `RPT_CTR_ES_002`(data·html) 삭제 — storage 원상 복구(001만 유지).
- 서버 종료.

## 수동 확인(브라우저, 권장)
- 인트로(딥링크 아닐 때) → 지도 → 마커 클릭 → DetailView iframe(팝업) → [보고서 생성] → ProgressModal → [보고서 보기] → ReportView → [메일 발송](mailto 작성창).
- 챗봇 위젯 → 질의 → needs_research 시 리서치 칩(백엔드 Bedrock 환경 필요).
