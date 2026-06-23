"""Reports 라우터 (FR-3·4·5) — 보고서 생성 트리거(비동기 잡)·목록·JSON/HTML/PDF.

country/region 대칭: 동일 헬퍼를 도메인 인자로 호출, 라우트만 두 벌.
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path
from fastapi.responses import FileResponse, Response

import re

from ..config import REPORT_ID_PATTERN, REPORT_ID_PREFIX, TARGET_ID_PATTERN
from ..schemas import JobCreatedResponse, ReportListResponse
from ..services import pdf_service, storage_resolver
from ..services.job_manager import job_manager
from ..services.orchestrator import run_report_job

router = APIRouter(prefix="/api", tags=["reports"])

# Path(...) 인스턴스는 파라미터마다 새로 생성(모듈 공유 시 파라미터명 누출).


def _validate_report_id(domain: str, report_id: str) -> None:
    # 전체 형식 강제(경로 traversal 방어) + 도메인↔prefix 일치
    if not re.fullmatch(REPORT_ID_PATTERN, report_id) or not report_id.startswith(
        REPORT_ID_PREFIX[domain]
    ):
        raise HTTPException(status_code=404, detail=f"리포트 ID 형식 불일치: {report_id}")


# ── 생성 트리거 (FR-3) ──────────────────────────────────────────
def _trigger(domain: str, target_id: str, bg: BackgroundTasks) -> JobCreatedResponse:
    if not storage_resolver.research_exists(domain, target_id):
        raise HTTPException(
            status_code=409,
            detail=f"{domain} '{target_id}' 리서치 데이터 없음 — 리서치 필요",
        )
    job_id = job_manager.create_job("report", {"domain": domain, "target_id": target_id})
    bg.add_task(run_report_job, job_id, domain, target_id)
    return JobCreatedResponse(
        job_id=job_id,
        status="queued",
        status_url=storage_resolver.job_status_url(job_id),
    )


# ── 목록 (FR-4) ─────────────────────────────────────────────────
def _list(domain: str, target_id: str) -> ReportListResponse:
    return ReportListResponse(
        domain=domain,
        target_id=target_id,
        reports=storage_resolver.list_reports(domain, target_id),
    )


# ── 산출물 (FR-4·5) ─────────────────────────────────────────────
def _json(domain: str, target_id: str, report_id: str) -> Response:
    _validate_report_id(domain, report_id)
    p = storage_resolver.report_json_path(domain, target_id, report_id)
    if p is None:
        raise HTTPException(status_code=404, detail="리포트 JSON 없음")
    return Response(content=p.read_text(encoding="utf-8"), media_type="application/json")


def _html(domain: str, target_id: str, report_id: str) -> Response:
    _validate_report_id(domain, report_id)
    p = storage_resolver.report_html_path(domain, target_id, report_id)
    if p is None:
        raise HTTPException(status_code=404, detail="보고서 HTML 없음")
    return Response(content=p.read_text(encoding="utf-8"), media_type="text/html")


def _pdf(domain: str, target_id: str, report_id: str) -> FileResponse:
    _validate_report_id(domain, report_id)
    p = storage_resolver.report_html_path(domain, target_id, report_id)
    if p is None:
        raise HTTPException(status_code=404, detail="보고서 HTML 없음(PDF 변환 불가)")
    try:
        pdf_path = pdf_service.ensure_pdf(p)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"PDF 변환 실패: {exc}")
    return FileResponse(
        path=str(pdf_path), media_type="application/pdf", filename=pdf_path.name
    )


# ── country 라우트 ──────────────────────────────────────────────
@router.post("/countries/{code}/reports", response_model=JobCreatedResponse, status_code=202)
def trigger_country_report(bg: BackgroundTasks, code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> JobCreatedResponse:
    return _trigger("country", code.upper(), bg)


@router.get("/countries/{code}/reports", response_model=ReportListResponse)
def list_country_reports(code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> ReportListResponse:
    return _list("country", code.upper())


@router.get("/countries/{code}/reports/{report_id}/json")
def country_report_json(code: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> Response:
    return _json("country", code.upper(), report_id)


@router.get("/countries/{code}/reports/{report_id}/html")
def country_report_html(code: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> Response:
    return _html("country", code.upper(), report_id)


@router.get("/countries/{code}/reports/{report_id}/pdf")
def country_report_pdf(code: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> FileResponse:
    return _pdf("country", code.upper(), report_id)


# ── region 라우트 ───────────────────────────────────────────────
@router.post("/regions/{region}/reports", response_model=JobCreatedResponse, status_code=202)
def trigger_region_report(bg: BackgroundTasks, region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> JobCreatedResponse:
    return _trigger("region", region.upper(), bg)


@router.get("/regions/{region}/reports", response_model=ReportListResponse)
def list_region_reports(region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> ReportListResponse:
    return _list("region", region.upper())


@router.get("/regions/{region}/reports/{report_id}/json")
def region_report_json(region: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> Response:
    return _json("region", region.upper(), report_id)


@router.get("/regions/{region}/reports/{report_id}/html")
def region_report_html(region: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> Response:
    return _html("region", region.upper(), report_id)


@router.get("/regions/{region}/reports/{report_id}/pdf")
def region_report_pdf(region: str = Path(..., pattern=TARGET_ID_PATTERN), report_id: str = Path(...)) -> FileResponse:
    return _pdf("region", region.upper(), report_id)
