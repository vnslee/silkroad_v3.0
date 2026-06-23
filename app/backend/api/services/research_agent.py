"""리서치 Agent (C10, L3·L5) — 프롬프트→Bedrock→검증→저장.

domain 인자로 country/region 분기(BR-SYM-1). region은 member 누락 국가를 선행
리서치(Q6=A) 후 권역을 조사한다. progress_cb로 잡 진행 보고.
"""
from __future__ import annotations

from typing import Callable, List, Optional

from pydantic import ValidationError

from .. import config
from . import bedrock_client, prompt_loader, storage_resolver

_log = config.get_logger("research_agent")

# progress_cb(step, message) — research_orchestrator가 JobManager에 위임.
ProgressCb = Optional[Callable[[str, str], None]]


class ResearchError(RuntimeError):
    """리서치 검증 실패(필수 핵심키 누락·items 비어있음 등)."""


class ResearchResult:
    """run 반환값(가벼운 컨테이너)."""

    def __init__(self, domain: str, target_id: str, latest_path, schema_version: str):
        self.domain = domain
        self.target_id = target_id
        self.latest_path = latest_path
        self.schema_version = schema_version


def _validate(domain: str, data: dict) -> str:
    """L3 관대 검증. 필수 핵심키 누락·items 비어있음만 실패. 반환: schema_version."""
    model = prompt_loader.validation_model(domain)
    try:
        obj = model.model_validate(data)
    except ValidationError as exc:
        raise ResearchError(f"스키마 검증 실패: {exc}") from exc

    if domain == "country":
        if not data.get("items"):
            raise ResearchError("items가 비어있음(최소 1개 필요)")
    else:  # region
        countries = data.get("countries") or []
        if not countries:
            raise ResearchError("countries가 비어있음(최소 1개 필요)")
    return getattr(obj, "schema_version", data.get("schema_version", ""))


def _run_country(
    target_id: str, region: str, segment: Optional[str], progress_cb: ProgressCb
) -> ResearchResult:
    if progress_cb:
        progress_cb("calling_bedrock", f"국가 {target_id} 리서치 호출")
    prompt = prompt_loader.load_country_prompt(target_id, region, segment)
    data = bedrock_client.generate_structured(
        prompt, prompt_loader.country_json_schema()
    )
    # code 누락 방어 — 호출 입력 코드로 보정.
    data.setdefault("code", target_id)
    schema_version = _validate("country", data)
    if progress_cb:
        progress_cb("saving", f"국가 {target_id} 저장")
    _, latest = storage_resolver.save_research("country", target_id, data)
    return ResearchResult("country", target_id, latest, schema_version)


def run(
    domain: str,
    target_id: str,
    segment: Optional[str] = None,
    member_codes: Optional[List[str]] = None,
    region: Optional[str] = None,
    progress_cb: ProgressCb = None,
) -> ResearchResult:
    """리서치 수행 엔트리. country/region 분기."""
    if domain == "country":
        return _run_country(target_id, region or "", segment, progress_cb)

    # region: 누락 멤버 국가 선행(Q6=A) 후 권역.
    members = member_codes or []
    for code in members:
        if not storage_resolver.research_exists("country", code):
            if progress_cb:
                progress_cb("calling_bedrock", f"멤버 국가 {code} 선행 리서치")
            _run_country(code, target_id, segment, progress_cb)

    if progress_cb:
        progress_cb("calling_bedrock", f"권역 {target_id} 리서치 호출")
    prompt = prompt_loader.load_region_prompt(target_id, members, segment)
    data = bedrock_client.generate_structured(
        prompt, prompt_loader.region_json_schema()
    )
    data.setdefault("code", target_id)
    schema_version = _validate("region", data)
    if progress_cb:
        progress_cb("saving", f"권역 {target_id} 저장")
    _, latest = storage_resolver.save_research("region", target_id, data)
    return ResearchResult("region", target_id, latest, schema_version)
