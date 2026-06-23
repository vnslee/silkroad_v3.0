"""Job Manager (C4) — 비동기 잡 수명주기 (L6).

in-memory dict + threading.Lock. 무기한 보관(프로세스 생존 동안, FD-Q2=A).
상태 전이: queued → running → {succeeded | failed} (단방향).
step→percent 고정 매핑(Q1=A).
"""
from __future__ import annotations

import threading
import uuid
from typing import Dict, Optional, Union

from ..schemas import DetailJobResult, JobResult, JobStatus, ResearchJobResult

# step → percent 고정 매핑. 보고서 잡(generating/rendering)·리서치 잡(calling_bedrock/saving) 공용.
_STEP_PERCENT = {
    "queued": 0,
    "generating": 40,
    "rendering": 80,
    "calling_bedrock": 40,
    "saving": 80,
    "done": 100,
}


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobStatus] = {}
        self._lock = threading.Lock()

    def create_job(self, kind: str, params: Dict[str, str]) -> str:
        job_id = uuid.uuid4().hex
        with self._lock:
            self._jobs[job_id] = JobStatus(
                job_id=job_id,
                kind=kind,
                status="queued",
                step="queued",
                percent=_STEP_PERCENT["queued"],
                params=dict(params),
            )
        return job_id

    def start(self, job_id: str) -> None:
        self._set(job_id, status="running", step="generating")

    def set_progress(self, job_id: str, step: str, message: Optional[str] = None) -> None:
        self._set(job_id, step=step, message=message)

    def succeed(
        self, job_id: str, result: Union[JobResult, ResearchJobResult, DetailJobResult]
    ) -> None:
        self._set(job_id, status="succeeded", step="done", result=result)

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.status = "failed"
            job.error = error

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        with self._lock:
            return self._jobs.get(job_id)

    # ── 내부 ────────────────────────────────────────────────
    def _set(
        self,
        job_id: str,
        *,
        status: Optional[str] = None,
        step: Optional[str] = None,
        message: Optional[str] = None,
        result: Optional[Union[JobResult, ResearchJobResult, DetailJobResult]] = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            if status is not None:
                job.status = status  # type: ignore[assignment]
            if step is not None:
                job.step = step  # type: ignore[assignment]
                job.percent = _STEP_PERCENT.get(step, job.percent)
            if message is not None:
                job.message = message
            if result is not None:
                job.result = result


# 프로세스 전역 단일 인스턴스
job_manager = JobManager()
