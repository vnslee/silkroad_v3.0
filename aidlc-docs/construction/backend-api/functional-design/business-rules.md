# Business Rules & PBT Properties — backend-api (1차)

## 검증 규칙 (Validation)

| ID | 규칙 |
|---|---|
| VR-1 | `domain`은 `country`/`region`만 허용(그 외 422) |
| VR-2 | `target_id`는 `^[A-Z]{2,5}$`(소문자 입력은 대문자 정규화 후 검증). 위반 422 |
| VR-3 | `report_id`는 도메인 패턴 일치(`RPT_CTR_*`/`RPT_RGN_*`). 불일치 404 |
| VR-4 | 생성 트리거는 리서치 데이터 존재 필수. 없으면 409(데이터없음) |
| VR-5 | 산출물(json/html/pdf) 조회는 해당 파일 존재 필수. 없으면 404 |

## 에러 매핑 (HTTP)

| 상황 | 상태 | 비고 |
|---|---|---|
| 리서치 데이터 없음(생성/상세 렌더 시) | 409 | "리서치 필요"(2차 트리거 예고) |
| 리포트/산출물 ID 없음 | 404 | |
| domain/code/report_id 형식 오류 | 422 | Pydantic/path 검증 |
| 잡 ID 없음 | 404 | |
| 엔진 예외(동기 경로) | 500 | |
| 엔진 예외(잡 경로) | job status=failed | HTTP는 생성 트리거 시 이미 202 |
| 조회 대상 없음(exists:false) | **200** | Q4=A — 정상 응답 + 플래그 |

## 대칭 규칙 (NFR-2)
- BR-SYM-1: country/region 라우트는 동일 형태(prefix만 `countries`/`regions`).
- BR-SYM-2: JobResult 스키마는 도메인 무관 동일(Q6=A).
- BR-SYM-3: 생성 시퀀스는 항상 generation→rendering(Orchestrator). region 엔진 자동호출 비대칭은 외부 비노출.

## 채번/경로 규칙 (NFR-1, CLAUDE.md 준수)
- BR-PATH-1: API는 storage 경로/네이밍을 결정하지 않고 엔진/Resolver 규칙을 따른다.
- BR-PATH-2: JSON·HTML·PDF는 각각 `data/`·`html/`·`pdf/`로 분리(섞지 않음).
- BR-PATH-3: 채번은 엔진이 수행(Resolver는 조회만). NNN은 3자리 zero-pad, 대상별 독립.

## 캐시 규칙
- BR-CACHE-1: 상세화면은 캐시 우선(Q6=A) — 있으면 재렌더 안 함.
- BR-CACHE-2: 보고서 생성은 항상 신규(Q4 Application=A, 증분 채번) — 캐시 재사용 안 함.
- BR-CACHE-3: PDF는 캐시 우선(있으면 재변환 안 함, ensure_pdf 멱등).

---

# PBT 속성 식별 (PBT-01)

| 컴포넌트 | 속성 | 카테고리 | 강제? |
|---|---|---|---|
| Schemas (C7) | 모든 모델 `model_validate(model_dump(x)) == x` | Round-trip | **PBT-02 강제** |
| Resolver to_url (L4) | 동일 입력→동일 URL, 항상 `/api/` 시작, 도메인 복수형 정확 | Invariant | **PBT-03 강제** |
| Resolver report_id 파싱 (L3) | `parse(format(rid)) == rid`, NNN 항상 3자리 | Round-trip/Invariant | **PBT-02·03 강제** |
| target_id 정규화 (VR-2) | `normalize(normalize(x)) == normalize(x)` (대문자화 멱등) | Idempotence | advisory(PBT-04) |
| Job 상태 머신 (L5·L6) | 전이 단방향, percent 단조 비감소 | Invariant | advisory |
| PDF ensure_pdf (L7) | 반복 호출 같은 경로, 두 번째 호출 재변환 없음 | Idempotence | advisory |

## 생성기 (PBT-07, 강제)
- `domain` 생성기: `sampled_from(["country","region"])`
- `target_id` 생성기: 정규식 `[A-Z]{2,5}`에 맞는 도메인 텍스트(랜덤 raw string 금지)
- `nnn` 생성기: 1..999 정수 → 3자리 포맷
- 도메인 모델 생성기: 각 Pydantic 모델 필드 제약 준수(예: status는 enum 값만, percent는 0..100)

## 재현성 (PBT-08, 강제)
- Hypothesis 기본 shrinking 활성(비활성 금지).
- CI/실행 시 실패 seed 로깅. `@settings`로 deadline 등 조정 가능하나 shrinking 유지.

## 프레임워크 (PBT-09, 강제)
- **Hypothesis** (Python) — requirements.txt에 핀. NFR Requirements 단계에서 버전 확정.

## 비강제(advisory) 처리
PBT Partial 모드 → PBT-04(멱등)·PBT-05(오라클)·PBT-06(스테이트풀)·PBT-10(상보)은 advisory. 위 표의 advisory 속성은 가능하면 테스트로 작성하되 미충족이 블로킹은 아님.
