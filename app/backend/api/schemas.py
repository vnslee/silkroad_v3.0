"""Pydantic 모델 — 요청/응답·잡 상태 (C7).

Python 3.9 호환: `from __future__ import annotations` + typing.Optional/Literal 사용.
모든 모델은 model_dump() ↔ model_validate() 라운드트립 동치(PBT-02).
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field

Domain = Literal["country", "region"]
JobState = Literal["queued", "running", "succeeded", "failed"]
# 리서치 잡 step(calling_bedrock/result_gen/saving)을 추가. 기존 보고서 잡 step은 불변(BR-COMPAT-1).
JobStep = Literal[
    "queued", "generating", "rendering", "calling_bedrock",
    "members_progress", "region_synth",  # region 리서치 전용 단계
    "result_gen", "saving", "done",
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
    # 지도 마커 좌표(geo 참조). 좌표가 있으면 프론트가 마커를 자동 표시한다.
    lon: Optional[float] = None
    lat: Optional[float] = None
    # 진출형태(internal_latest.json country_assets[code].type): 단독법인·JV. 기진출국만, 미진출국은 None.
    entry_mode: Optional[str] = None
    # 진출국 사용 솔루션(country_assets[code].solution). 기진출국만, 미진출국은 None.
    solution: Optional[str] = None
    # 진출연도(country_assets[code].since). 기진출국만. 값이 없거나 None일 수 있음.
    since: Optional[int] = None


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


class FxData(BaseModel):
    """환율 스냅샷(internal_latest.json fx 블록). 기준통화 KRW, 각 통화 1단위당 KRW 환산율."""
    base: str = "KRW"
    as_of: Optional[str] = None
    rates: Dict[str, float] = Field(default_factory=dict)
    note: Optional[str] = None


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


class AgentProgress(BaseModel):
    """분야 agent(상품·규제·시스템·시장)별 진행률 — 리서치 잡 프로그레스바 per-agent 표시."""

    key: str  # market | regulatory | system | product
    label: str
    status: JobState = "queued"
    percent: int = 0


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
    # 리서치 잡의 분야 agent별 진행률. 보고서/상세 잡은 빈 리스트(BR-COMPAT).
    agents: List[AgentProgress] = Field(default_factory=list)


# ── 리서치 (FR-1·4) ─────────────────────────────────────────────
class ResearchTriggerRequest(BaseModel):
    """region 리서치 POST body. country는 body 불필요(segment만 선택)."""

    member_codes: List[str] = Field(default_factory=list)
    segment: Optional[str] = None


# ── 챗봇 (FR-3) ─────────────────────────────────────────────────
class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


# 답변 관점(senario.md): business=비즈니스, system=시스템, both=둘 다.
Perspective = Literal["business", "system", "both"]


class ChatRequest(BaseModel):
    domain: Domain
    target_id: str
    message: str
    history: Optional[List[ChatTurn]] = None
    member_codes: Optional[List[str]] = None
    # 답변 관점(senario.md). 미지정이면 챗봇이 먼저 관점을 되묻는다(needs_perspective).
    perspective: Optional[Perspective] = None


ChatIntent = Literal["qa", "research", "report"]
# 챗봇 액션 칩 키(프론트가 선택지로 노출). summary=상세요약, research=리서치 수행,
# re_research=리서치 재수행, report=보고서 생성, re_report=보고서 재생성.
ChatAction = Literal["summary", "research", "re_research", "report", "re_report"]


class ChatResponse(BaseModel):
    answer: Optional[str] = None
    needs_research: bool = False
    needs_report: bool = False
    # 관점(비즈니스/시스템/Both) 선택이 필요함(senario.md). 프론트가 관점 칩을 노출하고
    # 사용자가 고른 perspective를 같은 질문과 함께 재전송한다.
    needs_perspective: bool = False
    # auto_trigger=True면 사용자의 명시적 의도(보유국 재리서치·보유국 보고서 생성)이므로
    # 프론트가 확인 없이 즉시 트리거. False면(데이터 없음 등) 사용자에게 먼저 묻는다.
    auto_trigger: bool = False
    research_suggestion: Optional[str] = None
    missing_codes: List[str] = Field(default_factory=list)
    # 질문에서 식별한 대상(§6.5) — 프론트가 리서치/보고서 트리거 대상으로 사용.
    resolved_domain: Optional[Domain] = None
    resolved_target_id: Optional[str] = None
    # 대상 상태 + 노출할 선택지(상세요약/리서치/보고서). 프론트가 칩으로 렌더.
    intent: ChatIntent = "qa"
    exists: bool = False
    has_report: bool = False
    actions: List[ChatAction] = Field(default_factory=list)
    # 보유국 QA 답변과 함께 LLM이 제안한 후속 질문(senario.md 케이스·관점·보고서 틀 안에서만).
    # 프론트가 탐색용 칩으로 노출하고 클릭 시 그대로 재질문한다. 비어 있으면 노출 안 함.
    suggested_prompts: List[str] = Field(default_factory=list)


# ── 챗봇 흐름 명세 (GET /api/chat/flow) ─────────────────────────
# 흐름·선택지 SoT(architecture/chatbot/chatbot_flow.json)를 프론트에 노출. 텍스트는
# 담지 않고 i18n 키만 — 프론트가 dict.ts로 한/영 변환한다. 흐름을 바꿀 때 JSON만 고치면
# 프론트/백엔드 양쪽에 반영된다(소스 하드코딩 제거).
class FlowCase(BaseModel):
    id: str
    labelKey: str
    promptKey: str


class FlowPerspective(BaseModel):
    value: Perspective
    labelKey: str


class ChatFlowResponse(BaseModel):
    version: Optional[str] = None
    cases: List[FlowCase] = Field(default_factory=list)
    perspectives: List[FlowPerspective] = Field(default_factory=list)
    quickPrompts: List[str] = Field(default_factory=list)
    actionLabels: Dict[str, str] = Field(default_factory=dict)


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
