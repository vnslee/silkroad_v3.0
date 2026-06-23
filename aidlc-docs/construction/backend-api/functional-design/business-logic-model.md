# Business Logic Model — backend-api (1차)

기술 비종속 핵심 로직. 인프라/HTTP 세부는 제외.

## L1. 카탈로그 조회 (Storage Resolver)

### list_countries / list_regions
```
research/<domain>/ 하위 디렉토리 스캔
 → 각 <ID>에 대해 <ID>_latest.json(없으면 <ID>_*.json 최신) 로드
 → Summary 엔티티로 매핑(code/name/name_ko/region/is_baseline)
 → has_detail = detail/<domain>/<ID>/html 에 *.html 존재
 → has_report = report/<domain>/<ID>/data 에 RPT_*.json 존재
 → code 오름차순 정렬 반환
```

### existence_info(domain, target_id)  (Q4=A)
```
exists = research_exists(domain, target_id)
has_detail / has_report = 캐시·리포트 스캔
latest_report_id = list_reports 최대 NNN의 ID (없으면 None)
can_research = True  # 1차는 항상 true 신호(실행은 2차)
→ ExistenceInfo (HTTP 200, exists=false여도 200)
```

## L2. 상세화면 캐시-우선 (Q6=A 패턴)
```
latest = latest_detail_html(domain, target_id)   # detail/.../html/*.html 중 최신(파일명 TS 정렬)
if latest exists: return read(latest)
else:
    research_exists? 아니면 409
    path = adapter.render_detail_html(domain, target_id)  # 항상 latest 리서치
    return read(path)
```

## L3. 채번 조회 (Resolver) — 엔진 채번과 정합
```
list_reports: report/<domain>/<id>/data/RPT_*.json glob
 → 파일명에서 NNN 파싱, 정렬
next_nnn = max(NNN)+1 (조회용; 실제 채번은 엔진이 수행)
report_json_path/html_path: report_id로 경로 조립, 존재 확인(없으면 None→404)
```
> **불변식(PBT-03)**: report_id 파싱→재조립이 동일(round-trip). NNN은 항상 3자리 zero-pad. 목록은 NNN 오름차순 단조.

## L4. URL 변환 (Q7=A) — to_url
```
detail:        /api/{domain}s/{id}/detail
report json:   /api/{domain}s/{id}/reports/{rid}/json
report html:   /api/{domain}s/{id}/reports/{rid}/html
report pdf:    /api/{domain}s/{id}/reports/{rid}/pdf
job status:    /api/jobs/{job_id}
```
> `{domain}s`: country→countries, region→regions (라우터 prefix와 일치).
> **불변식(PBT-03)**: 동일 입력 → 동일 URL(순수 함수), 항상 `/api/`로 시작.

## L5. 보고서 생성 오케스트레이션 (Orchestrator + Job)

### 잡 상태 머신 (Q1=A)
```
create_job → QUEUED(step=queued,0%)
start      → RUNNING(step=generating,40%)
  adapter.generate_report_json(domain,id)  # latest 리서치(Q5=A) + internal_latest
set_progress(rendering) → RUNNING(step=rendering,80%)
  adapter.render_report_html(domain, json_path)
succeed(result) → SUCCEEDED(step=done,100%, result=JobResult)
  (예외 발생 시) fail(error) → FAILED(step 유지, error 메시지)
```

### 시퀀스 (country/region 동일 — 대칭)
```
POST /reports
 → create_job(kind=report, {domain,target_id})
 → BackgroundTasks: run(job_id)
 → 202 JobCreatedResponse(job_id, status_url)

run(job_id):
 start → generate_report_json → set_progress(rendering)
       → render_report_html → to_url(json/html)
       → succeed({domain,target_id,report_id,json_url,html_url,pdf_url=None})
 except: fail(str(e))
```
> region 엔진은 렌더러 자동호출 안 함 → Orchestrator가 항상 명시 render 호출(Q5=A 흡수). country도 동일 경로(엔진 자동호출 산출물은 무시하고 동일 흐름).

## L6. 잡 저장 (Q2=A)
```
JobManager: dict[job_id → JobStatus], threading.Lock
무기한 보관(프로세스 생존 동안), 개수 제한 없음
get_job(id): 없으면 None → 라우터에서 404
```
> **상태 전이 불변식(PBT-03 advisory)**: status는 queued→running→{succeeded|failed} 단방향. percent 단조 비감소(실패 전까지).

## L7. PDF (ensure_pdf)
```
pdf_path = html_path.parent.parent / "pdf" / (html_stem + ".pdf")
if pdf_path exists: return pdf_path           # 재사용
else: html_to_pdf(html_path, pdf_path); return pdf_path
```
> **멱등(advisory PBT-04)**: ensure_pdf 반복 호출 시 같은 경로 반환(이미 있으면 재변환 안 함).
