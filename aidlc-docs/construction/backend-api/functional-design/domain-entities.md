# Domain Entities & Schemas — backend-api (1차)

API 요청/응답·잡 모델의 도메인 엔티티. Pydantic 모델로 구현(C7). 도메인 = `Literal["country","region"]`.

## 기본 타입
- `Domain = Literal["country", "region"]`
- `TargetId = str` — country: ISO alpha-2 대문자(`ES`,`GB`), region: 권역 코드(`EU`). 검증: `^[A-Z]{2,5}$`
- `ReportId = str` — `RPT_CTR_<CODE>_<NNN>` / `RPT_RGN_<REGION>_<NNN>`

## 카탈로그 엔티티 (FR-1)

### CountrySummary (Q3=A 최소셋)
| 필드 | 타입 | 출처 |
|---|---|---|
| code | str | research `code` |
| name | str | research `country` |
| name_ko | str | None | research `country_ko` |
| region | str | None | research `region` |
| is_baseline | bool | research `is_baseline` (없으면 false) |
| has_detail | bool | detail 캐시 존재 |
| has_report | bool | report 1건 이상 존재 |

### RegionSummary
| 필드 | 타입 | 출처 |
|---|---|---|
| code | str | research `code` |
| name | str | research `region` |
| name_ko | str | None | research `region_ko` |
| baseline_country | str | None | research `baseline_country` |
| has_detail | bool | detail 캐시 존재 |
| has_report | bool | report 존재 |

### ExistenceInfo (Q4=A — 200 + exists 플래그)
| 필드 | 타입 | 의미 |
|---|---|---|
| domain | Domain | |
| target_id | str | |
| exists | bool | 리서치 데이터 보유 여부 |
| has_detail | bool | 상세화면 캐시 |
| has_report | bool | 보고서 보유 |
| can_research | bool | 신규 리서치 가능(1차는 항상 true 신호, 실행은 2차) |
| latest_report_id | str | None | 최신 리포트 ID(있으면) |

## 산출물 참조 엔티티 (FR-4, Q7=A 상대 URL)

### ReportRef
| 필드 | 타입 |
|---|---|
| report_id | str |
| report_type | str (research/엔진 `report_type`) |
| title | str | None |
| generated_at | str | None |
| json_url | str (`/api/{domain}s/{id}/reports/{rid}/json`) |
| html_url | str |
| pdf_url | str (요청 시 생성, 항상 경로 제공) |

### ReportListResponse
- `domain`, `target_id`, `reports: list[ReportRef]`

## 잡 엔티티 (FR-3, Q1·Q2·Q6)

### JobCreatedResponse (202)
- `job_id: str` (UUID)
- `status: "queued"`
- `status_url: str` (`/api/jobs/{job_id}`)

### JobStatus
| 필드 | 타입 | 의미 |
|---|---|---|
| job_id | str | |
| kind | str | "report" |
| status | Literal["queued","running","succeeded","failed"] | |
| step | Literal["queued","generating","rendering","done"] | 진행 단계 (Q1=A) |
| percent | int | 0/40/80/100 고정 매핑 (Q1=A) |
| message | str | None | 사람이 읽는 진행 메시지 |
| result | JobResult | None | 성공 시 |
| error | str | None | 실패 시 |
| params | dict | {domain, target_id} |

### JobResult (Q6=A 완전 통일)
| 필드 | 타입 |
|---|---|
| domain | Domain |
| target_id | str |
| report_id | str |
| json_url | str |
| html_url | str |
| pdf_url | str | None (PDF는 요청 시 생성, 생성 전 null) |

## 상태→퍼센트 매핑 (Q1=A)
| step | status | percent |
|---|---|---|
| queued | queued | 0 |
| generating | running | 40 |
| rendering | running | 80 |
| done | succeeded | 100 |
| (실패) | failed | 마지막 percent 유지 |

## 직렬화 계약 (PBT-02 대상)
모든 모델은 `model_dump()` ↔ `model_validate()` 라운드트립 동치. 선택 필드는 `None` 허용.
