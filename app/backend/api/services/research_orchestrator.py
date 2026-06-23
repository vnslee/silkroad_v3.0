"""Research Orchestrator (C11, L6) — 리서치 잡 백그라운드 실행.

1차 JobManager·폴링을 그대로 재사용(Q1=A). 상태 전이:
queued → calling_bedrock(40) → saving(80) → done(100).
보고서 orchestrator(run_report_job)와 동형 구조.
"""
from __future__ import annotations

from typing import List, Optional

from .. import config
from ..schemas import ResearchJobResult
from . import prompt_loader, research_agent, storage_resolver
from .job_manager import job_manager

_log = config.get_logger("research_orchestrator")


def run_research_job(
    job_id: str,
    domain: str,
    target_id: str,
    segment: Optional[str] = None,
    member_codes: Optional[List[str]] = None,
    region: Optional[str] = None,
) -> None:
    """백그라운드 실행 엔트리. 잡 상태를 전이시키며 리서치 수행."""
    try:
        job_manager.start(job_id)
        # country 잡만 분야 agent 프로그레스바(market/regulatory/system/product)를 쓴다.
        # region 잡은 '멤버 선행 → 권역 종합' 흐름이라 agent 평균식이 맞지 않으므로
        # step 기반 진행률(_STEP_PERCENT)을 쓴다(init_agents 생략).
        if domain == "country":
            job_manager.init_agents(
                job_id, [(k, prompt_loader.FIELD_LABELS[k]) for k in prompt_loader.FIELDS]
            )
        job_manager.set_progress(job_id, "calling_bedrock", "리서치 시작")

        def progress(step: str, message: str, percent: Optional[int] = None) -> None:
            job_manager.set_progress(job_id, step, message, percent=percent)

        def agent_progress(key: str, status: str, percent: int) -> None:
            job_manager.set_agent_progress(job_id, key, status, percent)

        result = research_agent.run(
            domain,
            target_id,
            segment=segment,
            member_codes=member_codes,
            region=region,
            progress_cb=progress,
            agent_cb=agent_progress,
        )
        job_manager.succeed(
            job_id,
            ResearchJobResult(
                domain=domain,
                target_id=target_id,
                latest_url=storage_resolver.to_url("detail", domain, target_id),
                schema_version=result.schema_version,
            ),
        )
        _log.info("research job %s succeeded: %s/%s", job_id, domain, target_id)
    except Exception as exc:  # noqa: BLE001 — 잡 실패로 캡처(프로세스 비중단)
        job_manager.fail(job_id, str(exc))
        _log.exception("research job %s failed", job_id)
