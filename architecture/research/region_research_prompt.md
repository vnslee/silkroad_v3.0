# AI 리서치 — 권역(region) 조사 프롬프트 (잠정 v0.1)

> ⚠️ **잠정 샘플 명세** — EU 샘플(`storage/data/research/region/EU/EU_latest.json`) 기반으로
> country 대칭 인터페이스만 우선 맞춘 초안이다. **추후 country 풀세트(`country_research_prompt.md`)와
> 대칭되는 권역 고유 항목(권역 퀵윈·랭킹 입력 등)으로 확장 예정**(BR-RGN-1).
> 엔진/렌더러의 권역 산식이 요구하는 필드가 더 있으면 이 명세를 우선 갱신한다.
>
> 치환 플레이스홀더: `{REGION}`(권역명), `{MEMBER_CODES}`(멤버 국가 코드 목록), `{SEGMENT}`(타깃 세그먼트).

---

## 1. 리서치 프롬프트 (그대로 사용)

```
역할: 너는 20년차 글로벌 오토파이낸스 진출 컨설턴트다.
대상 권역: {REGION}  (EU | NORTH_AMERICA | SOUTH_AMERICA | APAC)
권역 멤버 국가(ISO alpha-2): {MEMBER_CODES}
타깃 세그먼트: {SEGMENT}  (예: 개인 신차 / B2B 리스)

아래 지침에 따라 권역 진단용 JSON을 지정된 스키마로만 출력하라.
설명·마크다운·코드펜스 없이 순수 JSON만.

[권역 구성 원칙]
- 권역 JSON은 멤버 국가별 country 객체 배열(countries)을 중첩으로 담는다.
- 각 country 객체는 country_research_prompt.md의 country JSON 구조를 그대로 따른다
  (country, country_ko, code, region, is_baseline, currency, schema_version,
   data_year, fetched_at, overall_insight, items[]).
- 멤버 국가별 items는 country 프롬프트의 [조사 항목]·[각 항목 규칙]을 동일 적용한다.
  (시장·매력도 / 게이트 / IT·유사도 / 회수·규제 / 특화요건 / 리스 손익 / 서술·배경 / NEWS)

[권역 최상위 필드]
- region        : 권역명(영문 코드 EU 등)
- region_ko     : 권역 한글명
- code          : 권역 코드({REGION}와 동일, 대문자)
- schema_version: "1.0"
- fetched_at    : 시스템이 주입(비워둬도 됨)
- baseline_country: 권역 베이스라인 국가 코드(유사도 base_score 기준국)
- countries     : 멤버 국가 country 객체 배열({MEMBER_CODES} 전체)

[베이스라인·유사도]
- baseline_country는 권역의 시스템 기준국(B국)으로 한 곳을 지정한다.
- 각 country의 유사도 디멘전 채점(score_dimensions)은 country 프롬프트 규칙 10을
  그대로 따르되, base_score는 baseline_country 기준으로 일관되게 부여한다.

[출력 형식]
region_research_schema.md 의 region JSON 구조를 그대로 따른다.
순수 JSON만 출력. 코드펜스·설명 금지.

[저장 경로]
생성된 region JSON은 아래 경로에 저장한다:
  app/backend/storage/data/research/region/{권역코드}/{권역코드}_{타임스탬프}.json
- {타임스탬프}: ISO 8601 YYYY-MM-DDTHHMM.
- 동일 폴더의 {권역코드}_latest.json 포인터를 갱신한다.
```

---

## 2. 책임 경계
- **region.json** (이 프롬프트) — 멤버 국가별 외부 조사 사실값(country와 동형).
- **internal.json** (사람 관리) — 권역 퀵윈 룰셋·가중치. 조사 대상 아님.
- **엔진**(`region_report_engine.py`) — 권역 퀵윈 스코어링·랭킹 계산.
> country↔region 대칭 유지: country 명세가 갱신되면 이 명세도 대칭으로 확장한다.
