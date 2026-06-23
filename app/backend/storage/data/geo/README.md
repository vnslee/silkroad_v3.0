# geo — 국가 지오/메타 참조

`country_geo.json` 은 지도 마커 좌표·국가명(영/한)·권역·ISO numeric의 **단일 출처**다.
프론트가 정적 테이블(`coords.ts`)로 관리하던 좌표를 백엔드 스토리지로 옮긴 것.

## 스키마

```json
{
  "schema_version": "1.0",
  "countries": {
    "NG": {
      "name": "Nigeria",        // world-atlas 표기 영문명(마커 매칭·표기)
      "name_ko": "나이지리아",   // 한글 국가명
      "region": "AFRICA",       // EU|NORTH_AMERICA|SOUTH_AMERICA|APAC|MIDDLE_EAST|AFRICA
      "lon": 8.68,              // 대표 중심 경도(마커 좌표)
      "lat": 9.08,              // 대표 중심 위도
      "iso_numeric": "566"      // ISO 3166-1 numeric(권역 폴리곤 매칭용, 선택)
    }
  }
}
```

## 자동 갱신

신규 국가 리서치 시 `services/research_agent.py` 가 국가 메타를 해석(`_resolve_country_meta`:
기존 geo 우선, 없으면 경량 LLM 호출)해 여기에 **upsert** 한다(`services/geo_reference.py`).
카탈로그 API(`/api/countries`)가 이 좌표를 `lon`/`lat` 로 내려주므로, 진출후보국이 추가되면
세계지도 마커가 **수동 등록 없이 자동으로** 표시된다.

수정은 `geo_reference.upsert_country()` 를 통하면 atomic replace + 캐시 무효화가 보장된다.
직접 편집해도 되며(읽기는 mtime 캐시라 자동 반영), 형식만 위 스키마를 지킨다.
