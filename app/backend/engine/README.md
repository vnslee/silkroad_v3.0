# Engine

핵심 비즈니스 로직을 처리하는 엔진 모듈입니다. 국가(country)·권역(region) 진단 보고서 리포트 **JSON 생성** 파이프라인을 구성합니다.

> **HTML 렌더링은 제거됨**: 서버측 Python HTML 렌더링(보고서 PR1/PR2·상세화면 P1/P2)은 React 프론트엔드로 완전히 대체되었습니다. 엔진은 이제 리포트 JSON 생성(`generation/`)만 담당합니다. 상세는 [`rendering/README.md`](rendering/README.md) 참조.

## 파이프라인

```
generation (리서치 JSON → 리포트 JSON) → API (JSON 패스스루) → React 컴포넌트
```

| 폴더 | 파일 | 역할 |
|------|------|------|
| `generation/` | `country_report_engine.py` | 국가 리서치 JSON을 받아 단일국 진단 리포트(TCO·스코어링) JSON 생성. `report/country/<CODE>/data/`에 `RPT_CTR_<CODE>_<NNN>.json` 출력 |
| `generation/` | `region_report_engine.py` | 권역 리서치 JSON을 받아 권역 진단 리포트(퀵윈 스코어링·랭킹) JSON 생성. `report/region/<REGION>/data/`에 `RPT_RGN_<REGION>_<NNN>.json` 출력 |

> `rendering/`은 더 이상 HTML을 생성하지 않습니다(엔진 모듈 삭제). PDF는 `api/services/pdf_service.py`가 보고서 HTML을 `report-pdf` 스킬로 변환하며, 렌더링 엔진에 의존하지 않습니다.

## 실행

```bash
# 국가 진단 리포트 JSON 생성 — 인자는 국가 리서치 JSON 경로
python3 generation/country_report_engine.py <country_research_json>

# 권역 진단 리포트 JSON 생성 — 인자는 권역 리서치 JSON 경로
python3 generation/region_report_engine.py <region_research_json>
```

> 보고서 출력물: `report/<country|region>/<ID>/data/RPT_{CTR|RGN}_<ID>_<NNN>.json`
> 화면(보고서 PR1/PR2·상세화면 P1/P2)은 프론트엔드 React 컴포넌트가 이 JSON으로 직접 렌더합니다(`app/frontend/src/components/`).
