"""Pydantic 모델 — 요청/응답·잡 상태 (C7).

Python 3.9 호환: `from __future__ import annotations` + typing.Optional/Literal 사용.
모든 모델은 model_dump() ↔ model_validate() 라운드트립 동치(PBT-02).
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field

Domain = Literal["country", "region"]
JobState = Literal["queued", "running", "succeeded", "failed"]
# 리서치 잡 step(calling_bedrock/saving)을 추가. 기존 보고서 잡 step은 불변(BR-COMPAT-1).
JobStep = Literal[
    "queued", "generating", "rendering", "calling_bedrock", "saving", "done"
]


# ── 카탈로그 (FR-1) ─────────────────────────────────────────────
class CountrySummary(BaseModel):
    code: str
    name: str
    name_ko: Optional[str] = None
    region: Optional[str] = None
    is_baseline: bool = False
    has_detail: bool = False
    has_report: bool = False
    # 진출 상태(internal_latest.json country_status): 운영중·준비중·미진출. 없으면 None.
    status: Optional[str] = None


class RegionSummary(BaseModel):
    code: str
    name: str
    name_ko: Optional[str] = None
    baseline_country: Optional[str] = None
    has_detail: bool = False
    has_report: bool = False


# ── 지도 채색 데이터 (FR-2.2) ─────────────────────────────────────
# 지도 국가 채색용 원천: country_status(우리 진단 대상국 상태) + 현대차 해외사업망.
# 프론트는 이 둘로 국가별 색을 정한다(운영중=초록 / 미진출=빨강 / 현대망=베이지 / 그 외=회색).
class MapColorData(BaseModel):
    # internal_latest.json country_status: {ISO alpha-2: '운영중'|'미진출'|...}
    country_status: Dict[str, str] = Field(default_factory=dict)
    # 현대차 해외사업망 국가 영문명 목록(world-atlas feature.name 매칭용).
    hyundai_countries: List[str] = Field(default_factory=list)


class ExistenceInfo(BaseModel):
    domain: Domain
    target_id: str
    exists: bool
    has_detail: bool = False
    has_report: bool = False
    can_research: bool = True
    latest_report_id: Optional[str] = None


# ── 산출물 참조 (FR-4) ──────────────────────────────────────────
class ReportRef(BaseModel):
    report_id: str
    report_type: Optional[str] = None
    title: Optional[str] = None
    generated_at: Optional[str] = None
    json_url: str
    html_url: str
    pdf_url: str


class ReportListResponse(BaseModel):
    domain: Domain
    target_id: str
    reports: List[ReportRef] = Field(default_factory=list)


# ── 잡 (FR-3) ───────────────────────────────────────────────────
class JobResult(BaseModel):
    domain: Domain
    target_id: str
    report_id: str
    json_url: str
    html_url: str
    pdf_url: Optional[str] = None


class ResearchJobResult(BaseModel):
    """리서치 잡 성공 결과. 보고서 JobResult와 별개(리서치는 리포트 채번 없음)."""

    domain: Domain
    target_id: str
    latest_url: Optional[str] = None
    schema_version: Optional[str] = None


class DetailJobResult(BaseModel):
    """상세화면 렌더링 잡 성공 결과(3차 확장). 보고서 채번 없이 detail HTML URL만."""

    domain: Domain
    target_id: str
    html_url: Optional[str] = None


class JobCreatedResponse(BaseModel):
    job_id: str
    status: JobState = "queued"
    status_url: str


class JobStatus(BaseModel):
    job_id: str
    kind: str = "report"
    status: JobState
    step: JobStep
    percent: int = 0
    message: Optional[str] = None
    # 보고서 잡=JobResult, 리서치 잡=ResearchJobResult, 상세화면 잡=DetailJobResult.
    result: Optional[Union[JobResult, ResearchJobResult, DetailJobResult]] = None
    error: Optional[str] = None
    params: Dict[str, str] = Field(default_factory=dict)


# ── 리서치 (FR-1·4) ─────────────────────────────────────────────
class ResearchTriggerRequest(BaseModel):
    """region 리서치 POST body. country는 body 불필요(segment만 선택)."""

    member_codes: List[str] = Field(default_factory=list)
    segment: Optional[str] = None


# ── 챗봇 (FR-3) ─────────────────────────────────────────────────
class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    domain: Domain
    target_id: str
    message: str
    history: Optional[List[ChatTurn]] = None
    member_codes: Optional[List[str]] = None


class ChatResponse(BaseModel):
    answer: Optional[str] = None
    needs_research: bool = False
    research_suggestion: Optional[str] = None
    missing_codes: List[str] = Field(default_factory=list)
    # 질문에서 식별한 대상(§6.5) — 프론트가 리서치 트리거 대상으로 사용.
    resolved_domain: Optional[Domain] = None
    resolved_target_id: Optional[str] = None


# ── 룰셋 설정 (FR-6) ────────────────────────────────────────────
class RulesetPayload(BaseModel):
    """internal_latest.json에서 보고서 엔진이 실제로 쓰는 가중치/계수만 노출.

    GET 응답이자 PUT 요청 본문(같은 형태). 비어 있는 dict는 PUT에서 미변경으로 본다.
    similarity_item_axes는 읽기 전용 메타(weight 저장 시 axis 보존용).
    ※ quick_win_rules·maintenance_rate는 엔진 산식 미사용이라 노출하지 않는다(router 주석 참조).
    """

    version: Optional[str] = None
    updated_at: Optional[str] = None
    # values.* (각 합=1.0 권장 — 프론트에서 검증·정규화)
    biz_attractiveness: Dict[str, float] = Field(default_factory=dict)
    it_readiness: Dict[str, float] = Field(default_factory=dict)
    report_blend: Dict[str, float] = Field(default_factory=dict)
    # similarity_item_weights: 항목명 → weight (axis는 메타로 분리 보존)
    similarity_item_weights: Dict[str, float] = Field(default_factory=dict)
    similarity_item_axes: Dict[str, str] = Field(default_factory=dict)
    tier_weights: Dict[str, float] = Field(default_factory=dict)
    decision_thresholds: Dict[str, float] = Field(default_factory=dict)


class RulesetSaveResult(BaseModel):
    """PUT /api/ruleset 응답 — 저장된 룰셋 + 생성된 버전 스냅샷 메타."""

    ruleset: RulesetPayload
    version: str
    snapshot_file: str  # 새로 생성된 internal_v<ver>_<날짜>.json 파일명
    updated_at: str


class RulesetVersionInfo(BaseModel):
    """버전 스냅샷 목록 항목 — 드롭다운 표시·선택용."""

    version: str
    date: str  # 스냅샷 파일명의 YYYY-MM-DD
    file: str
    is_latest: bool = False
