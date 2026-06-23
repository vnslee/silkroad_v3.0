# Unit Test Execution — backend-api (1차)

## Run

### 전체 테스트
```bash
cd /home/participant/silk-road_v1.0/app/backend
python3 -m pytest tests/ -v
```

### 분류별
```bash
# PBT (속성 기반)
python3 -m pytest tests/test_schemas_pbt.py tests/test_resolver_pbt.py -v
# 통합 (TestClient)
python3 -m pytest tests/test_api_integration.py -v
```

## 결과 (실측, 2026-06-21)
- **총 32 테스트, 32 통과, 0 실패** (약 1.3s)
- PBT: 스키마 라운드트립 6종(PBT-02) + resolver 불변식·경계 8종(PBT-03)
- 통합: 18종 — health·목록·존재(200/exists)·422·404·409·산출물·**비동기 생성 플로우(country/region POST→폴링→산출물)**

## PBT 재현성 (PBT-08)
- Hypothesis 기본 shrinking 활성. 실패 시 최소 반례 + seed 출력.
- 특정 seed 재현: `python3 -m pytest tests/test_resolver_pbt.py --hypothesis-seed=<seed>`
- `.hypothesis/` 캐시는 `.gitignore` 처리됨.

## 실패 시
1. 출력의 실패 케이스·shrunk 입력 확인
2. 코드 수정
3. 재실행(통과까지)
