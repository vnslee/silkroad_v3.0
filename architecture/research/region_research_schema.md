# 권역(region) 리서치 JSON 스키마 (잠정 v0.1)

> ⚠️ **잠정 샘플 스키마** — EU 샘플 기반. country 중첩 구조만 우선 정의했다.
> **추후 country 풀세트와 대칭되는 권역 고유 필드로 확장 예정**(BR-RGN-1).
> country 항목 정의의 단일 출처는 `country_research_schema.md`이며, 권역은 이를 중첩 재사용한다.

## 최상위 구조

```json
{
  "region": "EU",
  "region_ko": "유럽연합",
  "code": "EU",
  "schema_version": "1.0",
  "fetched_at": "2026-06-21T12:00",
  "fetched_by": "ai",
  "baseline_country": "DE",
  "countries": [ /* country 객체 배열 — country_research_schema.md 구조 */ ]
}
```

## 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `region` | string | ✅ | 권역 영문 코드(EU 등) |
| `region_ko` | string | | 권역 한글명 |
| `code` | string | ✅ | 권역 코드(`region`과 동일, 대문자) |
| `schema_version` | string | ✅ | 스키마 버전("1.0") |
| `fetched_at` | string | | 시스템 주입(YYYY-MM-DDTHHMM) |
| `baseline_country` | string | | 권역 베이스라인 국가 코드(유사도 base_score 기준) |
| `countries` | array | ✅ | 멤버 국가 country 객체 배열(비어있으면 검증 실패) |

## 중첩 country 객체

각 `countries[]` 원소는 `country_research_schema.md`의 country JSON 구조를 그대로 따른다
(최상위: `country`·`country_ko`·`code`·`region`·`is_baseline`·`currency`·`schema_version`·
`data_year`·`fetched_at`·`overall_insight`·`items[]`). item 규칙도 country와 동일.

## 검증 규칙(사후, 관대)
- 필수 핵심키: `region`·`code`·`schema_version`·`countries`(≥1) 존재. 위반 → 잡 failed.
- 중첩 country는 `code`·`country`·`schema_version`·`items`(≥1) 필수.
- 조건부/세부 필드 누락은 통과(`extra: allow`로 스키마 진화 수용).

> **확장 TODO**: 권역 레벨 퀵윈 입력·랭킹 메타(엔진 요구 시)를 country 대칭으로 추가.
