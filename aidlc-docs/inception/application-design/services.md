# Services & Orchestration — backend-api (1차)

## 서비스 정의 요약

| 서비스 | 책임 | 상태 |
|---|---|---|
| Engine Adapter (C2) | 엔진/렌더 in-process 호출 | stateless |
| Report Orchestrator (C3) | generation→rendering 파이프라인 | stateless |
| Job Manager (C4) | 비동기 잡 수명주기 | **stateful** (in-memory dict) |
| Storage Resolver (C5) | 경로·목록·존재·URL | stateless(파일 읽기) |
| PDF Service (C6) | HTML→PDF 변환 | stateless |

## 오케스트레이션 패턴

### 패턴 1 — 동기 조회 (목록·존재·JSON·HTML·PDF·상세화면)
라우터 → resolver/adapter/pdf_service 직접 호출 → 즉시 응답. 잡 불개입.

### 패턴 2 — 상세화면 캐시-우선 (Q6=A, FR-2)
```
GET /detail
 → resolver.latest_detail_html(domain, id)
    ├─ 있음 → 파일 읽어 text/html 반환
    └─ 없음 → adapter.render_detail_html() → 생성본 읽어 반환
```
(PIPELINE §6 (B) 시퀀스와 일치)

### 패턴 3 — 비동기 보고서 생성 (Q2=B 폴링 + Q3=A BackgroundTasks, FR-3)
```
POST /reports
 → job_manager.create_job(kind="report", {domain,id})      # job_id, status=queued
 → BackgroundTasks.add_task(_run, job_id, domain, id)
 → 즉시 202 JobCreatedResponse(job_id, status_url=/api/jobs/{id})

(백그라운드) _run:
 → job_manager.start(job_id)                                # running
 → orchestrator.run_report_pipeline(domain, id, progress_cb=job_manager.set_progress)
      ├─ progress "generation" → adapter.generate_report_json
      └─ progress "rendering"  → adapter.render_report_html
 → 성공: job_manager.succeed(job_id, {report_id, json_url, html_url})
 → 실패: job_manager.fail(job_id, error)

(폴링) GET /api/jobs/{job_id} → job_manager.get_job → JobStatus
```
프론트(3차)는 PS2 프로그레스 화면에서 이 폴링으로 진행 단계를 표시. 완료 후 `result.html_url`을 iframe src로 사용.

### 패턴 4 — PDF (FR-5)
```
GET /reports/{rid}/pdf
 → resolver.report_html_path(domain,id,rid)  (없으면 404)
 → pdf_service.ensure_pdf(html_path)          # 캐시 재사용 or 변환
 → FileResponse(pdf, media_type=application/pdf)
```

## 대칭성 보장 (NFR-2)
- country/region은 **동일 서비스 메서드를 도메인 인자로** 호출. 라우터만 두 벌(경로 prefix 차이), 내부 로직 공유.
- region generation 엔진의 렌더러 자동호출 부재는 **Orchestrator(C3)가 항상 명시적으로 render를 호출**해 흡수(Q5=A). country도 동일 경로를 거치므로(엔진 자동호출 결과는 사용 안 함) 외부에서 완전 대칭.

## 에러 처리 정책 (경량 NFR — NFR Design 생략분 흡수)
| 상황 | 처리 |
|---|---|
| 리서치 데이터 없음 | 409 Conflict + "데이터 없음, 리서치 필요"(2차 트리거 예고) |
| 리포트/산출물 ID 없음 | 404 Not Found |
| 엔진 예외 | 잡: status=failed + error 메시지 / 동기: 500 |
| 잘못된 domain·코드 형식 | 422 (Pydantic/path 검증) |

## 동시성 (Q3=A)
- Job Manager dict 접근은 `threading.Lock` 보호.
- BackgroundTasks는 동일 프로세스 스레드풀 → 1차 부하 수준 충분. 장기적 워커 분리는 범위 밖.
