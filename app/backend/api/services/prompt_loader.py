"""프롬프트 로더·검증 모델 (C9, L1) — 명세=실행 단일출처(Q3=A).

architecture/research/ 의 *_prompt.md 본문을 읽어 플레이스홀더({COUNTRY} 등)를 치환하고,
구조화 출력용 느슨 json_schema와 사후 검증용 pydantic 관대 모델을 제공한다.

⚠️ region 프롬프트·스키마·검증 모델은 **잠정 샘플**(EU 기반) — 추후 country 대칭
풀세트로 확장 예정(BR-RGN-1). country와 동형 인터페이스만 우선 보장한다.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from .. import config

_log = config.get_logger("prompt_loader")

# 프롬프트 본문에서 ```...``` 코드펜스 블록을 추출(country_research_prompt.md 1절).
_FENCE_RE = re.compile(r"```(?:[a-zA-Z]*)\n(.*?)```", re.DOTALL)


def _read_prompt_file(name: str) -> str:
    path = config.RESEARCH_SPEC_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"리서치 프롬프트 명세 없음: {path}")
    return path.read_text(encoding="utf-8")


def _extract_prompt_body(raw: str) -> str:
    """명세 마크다운에서 첫 코드펜스(실제 프롬프트 본문)를 추출. 없으면 전체."""
    m = _FENCE_RE.search(raw)
    return m.group(1).strip() if m else raw.strip()


def load_country_prompt(
    country_name: str, region: str, segment: Optional[str] = None
) -> str:
    """country_research_prompt.md 본문 → 플레이스홀더 치환."""
    body = _extract_prompt_body(_read_prompt_file("country_research_prompt.md"))
    return (
        body.replace("{COUNTRY}", country_name)
        .replace("{REGION}", region or "")
        .replace("{SEGMENT}", segment or "개인 신차")
    )


def load_region_prompt(
    region_name: str, member_codes: List[str], segment: Optional[str] = None
) -> str:
    """region_research_prompt.md(잠정) 본문 → 치환. member_codes는 안내로 부가."""
    body = _extract_prompt_body(_read_prompt_file("region_research_prompt.md"))
    members = ", ".join(member_codes) if member_codes else ""
    return (
        body.replace("{REGION}", region_name)
        .replace("{MEMBER_CODES}", members)
        .replace("{SEGMENT}", segment or "개인 신차")
    )


# ── 구조화 출력 json_schema (느슨, Q1=A) ─────────────────────────
# claude-api 제약(numeric/length constraint·재귀 불가) 회피 — 타입·required 위주.
# item 세부(value/unit/timeseries 등)는 프롬프트로 지시, 스키마 미강제.
_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "item": {"type": "string"},
        "category": {"type": "string"},
        "role": {"type": "string"},
        "region": {"type": "string"},
        "tier": {"type": "integer"},
        "source": {"type": "string"},
        "insight": {"type": "string"},
    },
    "required": ["item", "category", "role", "tier", "source", "insight"],
}


def country_json_schema() -> dict:
    """국가 리서치 구조화 출력 스키마(최상위 구조 + item 필수 키만)."""
    return {
        "type": "object",
        "properties": {
            "country": {"type": "string"},
            "country_ko": {"type": "string"},
            "code": {"type": "string"},
            "region": {"type": "string"},
            "is_baseline": {"type": "boolean"},
            "currency": {"type": "string"},
            "schema_version": {"type": "string"},
            "data_year": {"type": "string"},
            "fetched_at": {"type": "string"},
            "overall_insight": {"type": "string"},
            "items": {"type": "array", "items": _ITEM_SCHEMA},
        },
        "required": ["country", "code", "schema_version", "items"],
    }


def region_json_schema() -> dict:
    """권역 리서치 구조화 출력 스키마(잠정, EU 샘플 기반 — 중첩 country)."""
    return {
        "type": "object",
        "properties": {
            "region": {"type": "string"},
            "region_ko": {"type": "string"},
            "code": {"type": "string"},
            "schema_version": {"type": "string"},
            "fetched_at": {"type": "string"},
            "baseline_country": {"type": "string"},
            "countries": {"type": "array", "items": country_json_schema()},
        },
        "required": ["region", "code", "schema_version", "countries"],
    }


# ── 사후 검증 pydantic 모델 (관대한 전체, Clarification=A) ────────
class ResearchItem(BaseModel):
    # 필수 핵심
    item: str
    category: str
    role: str
    region: Optional[str] = None
    tier: int
    source: str
    insight: str
    # 조건부/세부 — Optional (role/항목별로만 존재)
    insight_ai_generated: Optional[bool] = None
    value: Optional[Any] = None
    unit: Optional[str] = None
    direction: Optional[str] = None
    axis: Optional[str] = None
    timeseries: Optional[dict] = None
    similarity_axis: Optional[str] = None
    similarity_weight: Optional[float] = None
    score_dimensions: Optional[dict] = None
    model_config = {"extra": "allow"}  # 미정의 필드 허용(스키마 진화 대비)


class CountryResearch(BaseModel):
    code: str
    country: str
    schema_version: str
    region: Optional[str] = None
    country_ko: Optional[str] = None
    is_baseline: bool = False
    currency: Optional[str] = None
    data_year: Optional[Any] = None
    fetched_at: Optional[str] = None
    overall_insight: Optional[str] = None
    items: List[ResearchItem]
    model_config = {"extra": "allow"}


class RegionResearch(BaseModel):  # 잠정 — 추후 country 대칭 풀세트 확장 예정(BR-RGN-1)
    code: str
    region: str
    schema_version: str
    baseline_country: Optional[str] = None
    countries: List[CountryResearch]
    model_config = {"extra": "allow"}


def validation_model(domain: str):
    """domain → 검증 모델(country=CountryResearch, region=RegionResearch)."""
    return CountryResearch if domain == "country" else RegionResearch


def json_schema_for(domain: str) -> Dict[str, Any]:
    return country_json_schema() if domain == "country" else region_json_schema()
