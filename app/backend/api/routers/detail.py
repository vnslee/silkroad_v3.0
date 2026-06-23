"""Detail 라우터 (FR-2, L2) — 상세화면 HTML(캐시 우선).

캐시(detail/.../html) 있으면 반환, 없으면 렌더 후 반환(Q6=A).
리서치 데이터 없으면 409.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path, Response

from ..config import TARGET_ID_PATTERN
from ..schemas import JobCreatedResponse
from ..services import engine_adapter, storage_resolver
from ..services.detail_orchestrator import run_detail_job
from ..services.job_manager import job_manager

router = APIRouter(prefix="/api", tags=["detail"])

# Path(...) 인스턴스는 파라미터마다 새로 생성(공유 시 파라미터명 누출).


def _detail_html(domain: str, target_id: str, version: Optional[str] = None) -> str:
    # version 미지정 → 최신 캐시본 반환.
    if version is None:
        cached = storage_resolver.latest_detail_html(domain, target_id)
        if cached is not None:
            return cached.read_text(encoding="utf-8")
    else:
        # version = 렌더 ID(DTL_<ID>_NNN). 해당 캐시 HTML을 그대로 반환(재렌더 아님).
        snap = storage_resolver.detail_html_by_id(domain, target_id, version)
        if snap is not None:
            return snap.read_text(encoding="utf-8")
        raise HTTPException(
            status_code=404,
            detail=f"{domain} '{target_id}' 상세화면 버전 '{version}' 없음",
        )
    if not storage_resolver.research_exists(domain, target_id):
        raise HTTPException(
            status_code=409,
            detail=f"{domain} '{target_id}' 리서치 데이터 없음 — 리서치 필요",
        )
    try:
        out_path = engine_adapter.render_detail_html(domain, target_id, version)
    except (Exception, SystemExit) as exc:  # detail 렌더러는 데이터 손상 시 SystemExit 발생
        raise HTTPException(status_code=500, detail=f"상세화면 렌더 실패: {exc}")
    from pathlib import Path as _P

    return _P(out_path).read_text(encoding="utf-8")


@router.get("/countries/{code}/detail/versions", response_model=List[str])
def list_country_detail_versions(code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.detail_versions("country", code.upper())


@router.get("/regions/{region}/detail/versions", response_model=List[str])
def list_region_detail_versions(region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.detail_versions("region", region.upper())


@router.get("/countries/{code}/detail")
def get_country_detail(
    code: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    html = _detail_html("country", code.upper(), version)
    return Response(content=html, media_type="text/html")


@router.get("/regions/{region}/detail")
def get_region_detail(
    region: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    html = _detail_html("region", region.upper(), version)
    return Response(content=html, media_type="text/html")


# ── 비동기 렌더링 잡 트리거 (3차 확장) ──────────────────────────
# 동기 GET(캐시 즉시 반환)은 위에 보존. 프론트가 진행률 폴링이 필요할 때 사용.
def _trigger_detail(domain: str, target_id: str, bg: BackgroundTasks) -> JobCreatedResponse:
    if not storage_resolver.research_exists(domain, target_id):
        raise HTTPException(
            status_code=409,
            detail=f"{domain} '{target_id}' 리서치 데이터 없음 — 리서치 필요",
        )
    job_id = job_manager.create_job("detail", {"domain": domain, "target_id": target_id})
    bg.add_task(run_detail_job, job_id, domain, target_id)
    return JobCreatedResponse(
        job_id=job_id,
        status="queued",
        status_url=storage_resolver.job_status_url(job_id),
    )


@router.post("/countries/{code}/detail", response_model=JobCreatedResponse, status_code=202)
def trigger_country_detail(
    bg: BackgroundTasks, code: str = Path(..., pattern=TARGET_ID_PATTERN)
) -> JobCreatedResponse:
    return _trigger_detail("country", code.upper(), bg)


@router.post("/regions/{region}/detail", response_model=JobCreatedResponse, status_code=202)
def trigger_region_detail(
    bg: BackgroundTasks, region: str = Path(..., pattern=TARGET_ID_PATTERN)
) -> JobCreatedResponse:
    return _trigger_detail("region", region.upper(), bg)
