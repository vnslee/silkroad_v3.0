# Business Rules & PBT Properties — research-chatbot (2차)

## 검증 규칙 (Validation)
| ID | 규칙 |
|---|---|
| VR-1 | `domain`은 country/region만(422) |
| VR-2 | `target_id`는 `^[A-Z]{2,5}$`(대문자 정규화, 위반 422) — 1차 규칙 재사용 |
| VR-3 | region 리서치의 `member_codes`는 각 VR-2 충족 |
| VR-4 | 리서치 결과: 필수 핵심키(code·schema_version·items) 존재 + items≥1. 위반 → 잡 failed (Clarification=A 관대) |
| VR-5 | 챗봇 message 비어있지 않음(422) |

## 에러 매핑
| 상황 | 처리 |
|---|---|
| Bedrock 호출 실패(네트워크/자격증명/throttle) | 리서치 잡: status=failed+error / 챗봇: 502 |
| 구조화출력 JSON 파싱·검증 실패 | 리서치 잡 failed (재시도 없음, Q5=A) |
| target_id/domain 형식 오류 | 422 |
| 잡 ID 없음 | 404 (1차 재사용) |
| 챗봇 데이터 없음 | **200 + needs_research**(정상 분기) |

## 대칭 규칙 (NFR-1)
- BR-SYM-1: ResearchAgent는 domain 인자 분기, 라우터만 두 벌(countries/regions).
- BR-SYM-2: region 코드·스키마는 잠정이나 인터페이스 대칭(country와 동형 메서드).

## Bedrock/계약 규칙
- BR-BR-1: 모델 `anthropic.claude-opus-4-8`, 리전 ap-northeast-2(config). 자격증명 boto3 체인.
- BR-BR-2: 구조화출력 느슨 스키마(Q1), 사후 pydantic 관대 검증(Clarification=A).
- BR-BR-3: 앱 재시도 없음(Q5). SDK 기본 재시도(429/5xx)만.
- BR-PATH-1: 저장은 기존 네이밍·경로 규칙(PIPELINE §2). JSON만(HTML/PDF 분리 무관).

## region 잠정 규칙 (Q4)
- BR-RGN-1: region 프롬프트·스키마·관련 코드에 **"잠정 샘플 — 추후 country 대칭 풀세트 확장 예정"** 코멘트 명시(필수).
- BR-RGN-2: region 리서치는 member 누락 국가 선행(Q6) 후 권역.

## 1차 무파괴 (NFR-3)
- BR-COMPAT-1: JobStep enum 확장은 후방호환(기존 보고서 잡 step 불변).
- BR-COMPAT-2: config·schemas·storage_resolver는 추가만, 기존 시그니처 유지.

---

# PBT 속성 식별 (PBT-01)
| 컴포넌트 | 속성 | 카테고리 | 강제? |
|---|---|---|---|
| schemas(C7확장) | ChatRequest/Response·ResearchTriggerRequest 라운드트립 | Round-trip | **PBT-02** |
| PromptLoader 치환 | 모든 플레이스홀더 치환 후 `{COUNTRY}` 등 잔존 없음 | Invariant | **PBT-03** |
| StorageResolver save_research | 저장 경로 = 기존 규칙(`<id>_<ts>.json`), id round-trip | Invariant | **PBT-03** |
| target_id 정규화 | normalize(normalize(x))==normalize(x) | Idempotence | advisory |
| 검증 모델 | 유효 데이터는 통과, 필수키 누락은 실패 | Invariant | advisory |
| step→percent | 리서치 step 단조 비감소(40→80→100) | Invariant | advisory |

## 생성기 (PBT-07)
- `domain`: sampled_from(country/region)
- `target_id`: `[A-Z]{2,5}`
- `member_codes`: list of target_id
- ChatRequest 생성기: 필드 제약 준수(role enum 등)

## 재현성·프레임워크 (PBT-08·09)
- Hypothesis(1차 설치본), shrinking 유지·seed 로깅. (PBT-09 충족, requirements.txt에 이미 핀)

## 테스트 — 실 Bedrock (Q8=B)
- 리서치 Agent·BedrockClient 통합 테스트는 **실제 Bedrock 호출**(네트워크·자격증명 의존). 스모크 수준(1회 country 리서치 end-to-end).
- PBT(프롬프트치환·스키마검증·저장경로)는 Bedrock 미호출(순수 로직).
