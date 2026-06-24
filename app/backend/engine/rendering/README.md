# Rendering Engine — REMOVED

서버측 Python HTML 렌더링 엔진은 **React 프론트엔드로 완전히 대체**되어 제거되었습니다.

## 현재 아키텍처

```
JSON (generation) → API (JSON 패스스루) → React 컴포넌트 (frontend)
```

- **HTML 생성(rendering)**: ❌ 제거됨 — React 컴포넌트가 직접 렌더링
- **JSON 생성(generation)**: ✅ 유지 (`engine/generation/*_report_engine.py`)
- **PDF 생성**: ✅ 유지 — 단, 렌더링 엔진에 의존하지 않음.
  `api/services/pdf_service.py`가 보고서 HTML(`storage/report/.../html/`)을
  `report-pdf` 스킬 스크립트로 PDF 변환할 뿐이다.

## 제거된 파일 (2026-06-24)

서버측 렌더링이 사라지며 아래 모듈은 모두 삭제되었다(React가 대체):

- `country_report_renderer.py` / `region_report_renderer.py` — PR1/PR2 HTML
- `country_detail_rendering_engine.py` / `region_detail_rendering_engine.py` — P1/P2 HTML
- `render_helpers.py` — 공유 표현/차트/포맷 헬퍼
- `region_geo.py` + `assets/countries-50m.json` — 권역 지도 topojson(프론트는 npm `world-atlas` 사용)
- `templates/*.html` — detail 렌더러용 템플릿

## 프론트엔드 대체 위치

- **보고서**: `app/frontend/src/components/reports/`
- **상세화면**: `app/frontend/src/components/details/`
  - 권역 상세 3-소스 병합: `src/utils/regionDetail.ts`
  - 권역 지도(실제 국경): `src/components/details/regionMapGeo.ts` (world-atlas 50m + d3-geo)
- **차트**: `app/frontend/src/components/charts/`

## API 엔드포인트(JSON)

- 보고서: `GET /api/{countries|regions}/{id}/reports/{report_id}/json`
- 상세화면: `GET /api/{countries|regions}/{id}/detail` (리서치 스냅샷 JSON)
- 권역 병합 소스: `GET /api/regions/{region}/detail-sources` (멤버·status·assets)
