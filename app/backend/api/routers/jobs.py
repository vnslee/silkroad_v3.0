"""Jobs 라우터 (FR-3.2) — 잡 상태 폴링."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from ..schemas import JobStatus
from ..services.job_manager import job_manager

router = APIRouter(prefix="/api", tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str = Path(...)) -> JobStatus:
    job = job_manager.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="잡 없음")
    return job
