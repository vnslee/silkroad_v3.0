"""Report Orchestrator (C3) — generation→rendering 일괄 수행 (L5).

country/region 동일 시퀀스로 외부 대칭 보장(Q5=A: region 자동호출 비대칭을 흡수).
잡 진행은 Job Manager에 콜백으로 보고.
"""
from __future__ import annotations

from pathlib import Path

from .. import config
from ..schemas import JobResult
from . import engine_adapter, storage_resolver
from .job_manager import job_manager

_log = config.get_logger("orchestrator")


def run_report_job(job_id: str, domain: str, target_id: str) -> None:
    """백그라운드 실행 엔트리. 잡 상태를 전이시키며 파이프라인 수행."""
    try:
        job_manager.start(job_id)
        job_manager.set_progress(job_id, "generating", "리포트 데이터 생성 중")
        json_path = engine_adapter.generate_report_json(domain, target_id)

        job_manager.set_progress(job_id, "rendering", "보고서 HTML 렌더링 중")
        html_path = engine_adapter.render_report_html(domain, json_path)

        report_id = Path(json_path).stem
        result = JobResult(
            domain=domain,
            target_id=target_id,
            report_id=report_id,
            json_url=storage_resolver.to_url("report_json", domain, target_id, report_id),
            html_url=storage_resolver.to_url("report_html", domain, target_id, report_id),
            pdf_url=None,
        )
        job_manager.succeed(job_id, result)
        _log.info("job %s succeeded: %s", job_id, report_id)
    except Exception as exc:  # noqa: BLE001 — 잡 실패로 캡처(프로세스 비중단)
        job_manager.fail(job_id, str(exc))
        _log.exception("job %s failed", job_id)
