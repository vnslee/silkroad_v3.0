"""Job Manager (C4) — 비동기 잡 수명주기 (L6).

in-memory dict + threading.Lock. 무기한 보관(프로세스 생존 동안, FD-Q2=A).
상태 전이: queued → running → {succeeded | failed} (단방향).
step→percent 고정 매핑(Q1=A).
"""
from __future__ import annotations

import threading
import uuid
from typing import Dict, Optional, Union

from ..schemas import (
    AgentProgress,
    DetailJobResult,
    JobResult,
    JobStatus,
    ResearchJobResult,
)

# step → percent 고정 매핑. 보고서/상세 잡과, agents[]가 없는 리서치 잡(권역 종합 등)용.
# agents[]가 있는 리서치 잡은 _recompute_research_percent로 4 agent 평균(0~80) + 단계(80~100).
_STEP_PERCENT = {
    "queued": 0,
    "generating": 40,
    "rendering": 80,
    "calling_bedrock": 40,
    "members_progress": 55,  # region: 멤버 국가 선행 조사 구간(progress가 명시 percent 전달)
    "region_synth": 70,      # region: 권역 종합 리서치 진입
    "result_gen": 85,
    "saving": 90,
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

    def set_progress(
        self,
        job_id: str,
        step: str,
        message: Optional[str] = None,
        *,
        percent: Optional[int] = None,
    ) -> None:
        self._set(job_id, step=step, message=message, percent=percent)

    def init_agents(self, job_id: str, agents: list) -> None:
        """리서치 잡의 분야 agent 목록 초기화. agents: [(key, label), ...]."""
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job.agents = [
                AgentProgress(key=k, label=lbl, status="queued", percent=0)
                for k, lbl in agents
            ]
            self._recompute_research_percent(job)

    def set_agent_progress(
        self, job_id: str, key: str, status: str, percent: int
    ) -> None:
        """분야 agent 한 개의 상태/진행률 갱신(스레드 안전 — 4개 워커가 동시 호출)."""
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            for a in job.agents:
                if a.key == key:
                    a.status = status  # type: ignore[assignment]
                    a.percent = max(0, min(100, percent))
                    break
            self._recompute_research_percent(job)

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
        percent: Optional[int] = None,
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
            # 명시 percent가 오면 step 고정 매핑보다 우선(region 멤버 진행 구간 등).
            if percent is not None:
                job.percent = max(0, min(100, percent))
            if message is not None:
                job.message = message
            if result is not None:
                job.result = result
            # agents[]가 있는 리서치 잡은 step 고정 매핑 대신 agent 평균식으로 덮어쓴다.
            # (region 잡은 agents가 없으므로 위 step/percent가 그대로 유지된다.)
            if job.agents:
                self._recompute_research_percent(job)

    def _recompute_research_percent(self, job: JobStatus) -> None:
        """전체 percent = 4 agent 평균 × 0.8 + 후속단계(result_gen/saving/done) × 0.2.

        반드시 self._lock 보유 상태에서 호출(내부 헬퍼)."""
        if not job.agents:
            return
        avg = sum(a.percent for a in job.agents) / len(job.agents)
        # 후속 단계 비중(0~100): result_gen 50, saving 80, done 100, 그 외 0.
        tail = {"result_gen": 50, "saving": 80, "done": 100}.get(job.step, 0)
        job.percent = int(round(avg * 0.8 + tail * 0.2))


# 프로세스 전역 단일 인스턴스
job_manager = JobManager()
