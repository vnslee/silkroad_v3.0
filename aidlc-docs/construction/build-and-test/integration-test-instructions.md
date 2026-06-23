# Integration Test Instructions — backend-api (1차)

## 목적
API 라우터 ↔ 서비스 ↔ 엔진 ↔ storage 산출물 흐름 검증. 단일 유닛이라 "유닛 간"보다 **레이어 간 + 엔진 연동** 통합이 핵심.

## 환경
- 별도 서비스 기동 불필요. `fastapi.testclient.TestClient`로 in-process 실행(httpx).
- 기존 리서치 데이터(country 10개국, region EU) 사용.

## 시나리오

### S1. 카탈로그 → 존재 확인 (Router→Resolver→storage)
- `GET /api/countries` → 10개국, ES 포함
- `GET /api/countries/ES` → exists:true / `GET /api/countries/ZZ` → 200 exists:false
- `GET /api/countries/es1` → 422 (패턴 위반)

### S2. 상세화면 캐시-우선 (Router→Resolver→Adapter→detail 렌더러)
- `GET /api/countries/ES/detail` → 200 text/html (캐시 hit)

### S3. 비동기 보고서 생성 end-to-end (Router→Job→Orchestrator→Engine gen+render→storage)
- `POST /api/countries/GB/reports` → 202 + job_id
- `GET /api/jobs/{job_id}` → succeeded / done / 100% + result.html_url
- `GET {html_url}` → 200 text/html
- **region 대칭**: `POST /api/regions/EU/reports` 동일 흐름(라우트 충돌 회귀 검증)
- 테스트는 생성 산출물(JSON/HTML/PDF)을 정리해 부수효과 없음

### S4. 산출물 조회·에러
- `GET .../reports/RPT_CTR_ES_001/json` → 200 application/json
- `GET .../reports/RPT_CTR_ES_999/json` → 404
- `GET .../reports/RPT_RGN_ES_001/json`(prefix 불일치) → 404
- `POST /api/countries/ZZ/reports`(데이터 없음) → 409
- `GET /api/jobs/nonexistent` → 404

## 실행
```bash
cd /home/participant/silk-road_v1.0/app/backend
python3 -m pytest tests/test_api_integration.py -v
```

## 실서버 수동 검증(선택)
```bash
uvicorn app.backend.api.main:app --port 8000
curl localhost:8000/health
curl localhost:8000/api/countries
# OpenAPI: http://localhost:8000/docs
```
실측: /health·/api/countries(10)·/api/regions/EU·/docs(200) 정상.

## 결과
모든 시나리오 통과(32/32). 부수 산출물 정리 확인(git status 클린).
