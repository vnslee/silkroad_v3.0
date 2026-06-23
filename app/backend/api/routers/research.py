"""Research 라우터 (C13, FR-4.1) — 리서치 트리거(비동기 잡).

country/region 대칭: 동일 헬퍼를 도메인 인자로 호출, 라우트만 두 벌(BR-SYM-1).
잡은 1차 JobManager·폴링(/api/jobs/{id})을 그대로 재사용.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, BackgroundTasks, HTTPException, Path

from ..config import TARGET_ID_PATTERN
from ..schemas import JobCreatedResponse, ResearchTriggerRequest
from ..services import research_policy, storage_resolver
from ..services.job_manager import job_manager
from ..services.research_orchestrator import run_research_job

router = APIRouter(prefix="/api", tags=["research"])


def _validate_member_codes(codes) -> None:
    # VR-3: member_codes는 각 VR-2(^[A-Z]{2,5}$) 충족.
    for c in codes or []:
        if not re.fullmatch(TARGET_ID_PATTERN, c):
            raise HTTPException(status_code=422, detail=f"member_code 형식 오류: {c}")


# ── country 리서치 ──────────────────────────────────────────────
@router.post(
    "/countries/{code}/research", response_model=JobCreatedResponse, status_code=202
)
def trigger_country_research(
    bg: BackgroundTasks,
    code: str = Path(..., pattern=TARGET_ID_PATTERN),
    body: ResearchTriggerRequest = ResearchTriggerRequest(),
) -> JobCreatedResponse:
    target = code.upper()
    # 정책: 보유국 재수행 또는 보유 권역 소속국 신규 추가만 허용.
    allowed, reason = research_policy.country_research_allowed(target)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)
    job_id = job_manager.create_job(
        "research", {"domain": "country", "target_id": target}
    )
    bg.add_task(
        run_research_job,
        job_id,
        "country",
        target,
        body.segment,
        None,
        None,
    )
    return JobCreatedResponse(
        job_id=job_id,
        status="queued",
        status_url=storage_resolver.job_status_url(job_id),
    )


# ── region 리서치 ───────────────────────────────────────────────
@router.post(
    "/regions/{region}/research", response_model=JobCreatedResponse, status_code=202
)
def trigger_region_research(
    bg: BackgroundTasks,
    region: str = Path(..., pattern=TARGET_ID_PATTERN),
    body: ResearchTriggerRequest = ResearchTriggerRequest(),
) -> JobCreatedResponse:
    target = region.upper()
    # 정책: 권역 신규 리서치/추가는 지원하지 않는다(보유 권역만 운용).
    allowed, reason = research_policy.research_allowed("region", target)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)
    members = [c.upper() for c in body.member_codes]
    _validate_member_codes(members)
    job_id = job_manager.create_job(
        "research", {"domain": "region", "target_id": target}
    )
    bg.add_task(
        run_research_job,
        job_id,
        "region",
        target,
        body.segment,
        members,
        None,
    )
    return JobCreatedResponse(
        job_id=job_id,
        status="queued",
        status_url=storage_resolver.job_status_url(job_id),
    )
