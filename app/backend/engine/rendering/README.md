# Rendering Engine

## Status: DEPRECATED (HTML 생성 기능)

이 디렉토리의 Python HTML 렌더링 엔진은 **React 프론트엔드로 대체**되었습니다.

### 변경 사항 (2026-06-23)

- **HTML 생성**: ❌ 더 이상 사용하지 않음 → React 컴포넌트가 직접 렌더링
- **JSON 생성**: ✅ 계속 사용 (`generation/*_report_engine.py`)
- **PDF 생성**: ✅ 필요 시 유지 (HTML→PDF 변환용)

### 아키텍처 변경

**이전 (Python 렌더링)**:
```
JSON (generation) → Python (rendering) → HTML → iframe (frontend)
```

**현재 (React 렌더링)**:
```
JSON (generation) → API → React 컴포넌트 (frontend)
```

### 파일 상태

- ✅ **유지**: `generation/` - 보고서 JSON 생성 엔진
- ⚠️ **참조용**: `rendering/` - PDF 생성 시 필요할 수 있음
  - `country_report_renderer.py` - PR1 HTML (PDF용)
  - `region_report_renderer.py` - PR2 HTML (PDF용)
  - `country_detail_rendering_engine.py` - P1 HTML (사용 안 함)
  - `region_detail_rendering_engine.py` - P2 HTML (사용 안 함)
  - `render_helpers.py` - 공유 헬퍼 (사용 안 함)

### 프론트엔드 컴포넌트

React 컴포넌트는 다음 위치에 있습니다:

- **보고서**: `app/frontend/src/components/reports/`
  - `CountryReport.tsx` (PR1)
  - `RegionReport.tsx` (PR2)
  
- **상세화면**: `app/frontend/src/components/details/`
  - `CountryDetail.tsx` (P1)
  - `RegionDetail.tsx` (P2)

- **차트**: `app/frontend/src/components/charts/`
  - `LineChart.tsx`, `BarChart.tsx`, `RadarChart.tsx`

### API 엔드포인트

프론트엔드는 다음 JSON 엔드포인트를 사용합니다:

- 보고서: `GET /api/{countries|regions}/{id}/reports/{report_id}/json`
- 상세화면: `GET /api/{countries|regions}/{id}/detail` (리서치 JSON 반환)

### 디자인 커스터마이징

디자인 변경은 이제 다음 방법으로 가능합니다:

1. **React 컴포넌트 직접 수정** (`app/frontend/src/components/`)
2. **Tailwind CSS 클래스 변경** (인라인 스타일)
3. **차트 라이브러리 교체** (현재는 SVG 직접 렌더링)
4. **색상/타이포그래피** (`utils/format.ts` 헬퍼 함수)

Python 코드를 수정할 필요가 없습니다!

### 마이그레이션 노트

Python 렌더러를 완전히 제거하려면:

1. PDF 생성 로직을 React→PDF로 전환 (예: Puppeteer, Playwright)
2. `rendering/*.py` 파일 삭제
3. `app/backend/api/services/pdf_service.py` 업데이트

현재는 PDF 생성 경로가 HTML 렌더러에 의존하므로 보존되었습니다.
