# Performance Test Instructions — backend-api (1차)

> NFR Requirements(Q5=A): **목표만 문서화, 강제 부하 테스트는 1차 범위 밖.** 본 단계는 목표치와 관찰 결과만 기록한다.

## 성능 목표 (비강제)
| 항목 | 목표 |
|---|---|
| 조회 API(목록·존재·산출물 read) | < 1s |
| 상세화면 캐시 hit | < 1s |
| 보고서 생성(잡) | 비동기 — HTTP 즉시 202, 실제 생성 수 초 |
| PDF 변환 | weasyprint 의존(수 초) |

## 관찰 결과 (실측, TestClient/로컬)
- 전체 테스트 32종 ~1.3s.
- country 보고서 생성(generation+rendering): ~수십 ms (ES/GB 기준, 로컬 파일).
- PDF 변환: ~4s (weasyprint, 폰트 인스턴싱 경고는 무해).
- 조회·존재·목록: 즉시(<100ms 체감).

## 향후(부하 테스트)
- 4차 배포 후 필요 시 `k6`/`locust`로 동시 사용자·생성 잡 큐 포화 측정.
- 멀티 인스턴스 시 in-memory 잡 상태 공유 저장소 도입 검토(현재 단일 프로세스).

## 상태
1차 목표 충족(조회 즉시, 생성 비동기). 강제 SLA 없음.
