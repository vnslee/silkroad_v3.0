# Business Rules — frontend (3차)

> Functional Design 산출물 ③. 검증 규칙·에러 매핑·접근성/모션·대칭·경량 테스트 속성.

## VR. 검증 규칙
| ID | 규칙 | 적용처 |
|---|---|---|
| VR-1 | 룰셋 카테고리 가중치 합 = 100(±0) 아니면 [저장] 비활성 + 경고 | C8 RulesetForm |
| VR-2 | 임계값 신뢰 계수 0~100, 출처 계수 0~1.0 범위 클램프 | C8 |
| VR-3 | 국가 코드 = ISO alpha-2 대문자(영국=GB), 권역 코드 대문자 — 경로 빌더에서 정규화 | C2 paths |
| VR-4 | mailto body ≤ ~2000자 — 초과 시 summary 절단(링크/안내는 보존) | C11 |
| VR-5 | chat 요청 전 message 비어있지 않음, target(domain·id) 존재 | C5 |
| VR-6 | 폴링 jobId 형식 검증 후 GET(빈/널이면 idle) | C10 |

## ER. 에러 매핑 (사용자 메시지)
| 백엔드/상황 | 프론트 처리 |
|---|---|
| `GET .../detail` 409 (리서치 없음) | "리서치 데이터 없음 — 챗봇에서 리서치를 진행하세요" + 챗봇 유도 |
| detail 잡(확장) failed | PS2/카드 실패 표시 + [다시 시도] |
| `report`/`research` 잡 status='failed' | ProgressModal 실패 + error 메시지 + 재트리거 |
| 보고서 HTML/PDF 404 | iframe 대신 "보고서 없음/생성 필요" chrome 메시지 |
| chat 422/오류 | 챗봇 버블 오류 표시, 입력 보존 |
| 백엔드 미가동/네트워크 | 화면별 빈 상태 + 재시도(requirements Q2: 빈/에러 표시) |
| PDF 미생성(pdf_url 없음) | [PDF] 비활성 |
| 룰셋 [저장] (API 부재, Q5) | localStorage 저장 + "백엔드 연동은 후속" 안내 |

## AR. 접근성·모션 규칙 (NFR 선반영, ui-ux-pro-max 체크리스트)
| ID | 규칙 |
|---|---|
| AR-1 | `prefers-reduced-motion` 시 GlobeIntro·지도 모션·전환 애니메이션 단축/생략 |
| AR-2 | 모든 iframe에 `title` 속성(상세/보고서 내용 설명) |
| AR-3 | 키보드 포커스 가시화(focus-visible), 팝업 열림 시 포커스 트랩·Esc 닫기 |
| AR-4 | 액션 버튼·칩 `aria-label`, 상태는 색+아이콘/텍스트 병행(색 단독 금지) |
| AR-5 | 지도 마커/범례 색 의미를 텍스트 범례로 병행 |
| AR-6 | 라이브 영역(`aria-live`)으로 잡 진행/완료 알림 |

## SR. 대칭 규칙 (country ↔ region)
| ID | 규칙 |
|---|---|
| SR-1 | 모든 경로 빌더·API 호출·화면(Detail/Report/Progress)은 `domain` 인자로 country/region 대칭 처리 |
| SR-2 | region 전용: 멤버국(`member_codes`/`missing_codes`) 추가 흐름(리서치 트리거·갭) |
| SR-3 | 잡 3종(research/detail/report) 모두 양 도메인 지원 |

## DR. 디자인 SoT 준수 규칙
| ID | 규칙 |
|---|---|
| DR-1 | raw hex 금지 — DESIGN.md 토큰의 Tailwind 시맨틱 클래스만 사용 |
| DR-2 | iframe 내부(렌더 HTML)는 chrome이 건드리지 않음(postMessage 브리지 없음, PIPELINE §5) |
| DR-3 | 액션 버튼은 전부 React chrome 담당, iframe 내부엔 버튼 로직 없음 |
| DR-4 | 진입 모드 2종은 컨테이너 차이만 — embed HTML·화면 콘텐츠 동일(§5.1) |
| DR-5 | mockup/web_design_spec/intro_spec 임의 변경 금지(검증·보강만) |

## 경량 테스트 속성 (Q6=A 프론트 경량, PBT는 백엔드 전용 유지)
### 단위 테스트 (Vitest, 순수 함수)
| TID | 대상 | 속성 |
|---|---|---|
| FT-1 | `paths.*` 경로 빌더 | country→countries/region→regions 복수형·코드 대문자 정규화, 모든 엔드포인트 정확 |
| FT-2 | `parseHashRoute` / mode 기본값 | hash→RouteState 왕복, mode 쿼리 파싱, 딥링크 판정 |
| FT-3 | `buildMailtoUrl` | subject/body 인코딩, to 빈값(무저장), 첨부 안내 포함, ~2000자 절단(VR-4) |
| FT-4 | `mapStepToBars(kind,step,percent)` | kind별(research 5바/detail 단일/report) 매핑·percent 보간 단조 증가 |
| FT-5 | 룰셋 가중치 검증 | 합 100 판정(VR-1), 범위 클램프(VR-2) |

### 컴포넌트 스모크 (Vitest + RTL)
| TID | 대상 | 확인 |
|---|---|---|
| FC-1 | ChatWidget | needs_research 응답 → 리서치 칩 렌더 |
| FC-2 | ProgressModal | kind별 바 구성 렌더(research 5바 / report 단계) |
| FC-3 | DetailView/ReportView | iframe title 존재, 액션 버튼 렌더 |
| FC-4 | RulesetForm | 합≠100 시 [저장] 비활성 |

### 통합 스모크 (dev proxy, 백엔드 가동 시)
| TID | 흐름 |
|---|---|
| FI-1 | 카탈로그 → DetailView iframe 로드 |
| FI-2 | [보고서 생성] → 폴링 → 완료 → ReportView |
