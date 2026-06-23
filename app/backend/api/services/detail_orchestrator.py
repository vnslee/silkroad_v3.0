"""Detail Orchestrator (3차 확장) — 상세화면 렌더링 잡 백그라운드 실행.

1차/2차 orchestrator(run_report_job·run_research_job)와 동형 구조.
상태 전이: queued → rendering(80) → done(100).
기존 동기 GET /api/{...}/detail(캐시 즉시 반환)은 보존하고, 비동기 폴링용 잡 경로만 추가한다.
"""
from __future__ import annotations

from fastapi import HTTPException

from .. import config
from ..schemas import DetailJobResult
from . import engine_adapter, storage_resolver
from .job_manager import job_manager

_log = config.get_logger("detail_orchestrator")


def run_detail_job(job_id: str, domain: str, target_id: str) -> None:
    """백그라운드 실행 엔트리. 잡 상태를 전이시키며 상세화면 HTML을 렌더한다."""
    try:
        job_manager.start(job_id)
        job_manager.set_progress(job_id, "rendering", "상세화면 HTML 렌더링 중")

        # 리서치 데이터 없으면 렌더 불가(동기 GET의 409와 동일 의미를 잡 실패로).
        if not storage_resolver.research_exists(domain, target_id):
            raise HTTPException(
                status_code=409,
                detail=f"{domain} '{target_id}' 리서치 데이터 없음 — 리서치 필요",
            )

        engine_adapter.render_detail_html(domain, target_id)

        result = DetailJobResult(
            domain=domain,
            target_id=target_id,
            html_url=storage_resolver.to_url("detail", domain, target_id),
        )
        job_manager.succeed(job_id, result)
        _log.info("detail job %s succeeded: %s/%s", job_id, domain, target_id)
    except Exception as exc:  # noqa: BLE001 — 잡 실패로 캡처(프로세스 비중단)
        job_manager.fail(job_id, str(exc))
        _log.exception("detail job %s failed", job_id)
