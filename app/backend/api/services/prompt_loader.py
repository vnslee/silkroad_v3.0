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


def _load_schema_spec(name: str) -> str:
    """스키마 명세 .md 전체를 프롬프트 주입용으로 로드(출력이 스키마 규칙을 따르도록)."""
    return _read_prompt_file(name).strip()


# 딥리서치 방법론 디렉티브 — 각 분야 agent의 웹검색이 따라야 할 조사 원칙.
# (deep-research 스킬의 핵심 원칙을 런타임 웹검색 agent에 이식: fan-out → 교차검증 →
#  1차 출처 우선 → 인용 → 환각 금지.)
_DEEP_RESEARCH_DIRECTIVE = (
    "\n\n[딥리서치 수행 원칙 — 웹검색 시 반드시 준수]\n"
    "1. 단발 검색 금지: 항목별로 질의를 여러 각도(공식 통계/감독기관/협회·컨설팅 리포트/"
    "업계 매체)로 fan-out 해 충분히 검색한다.\n"
    "2. 교차 검증: 핵심 수치·게이트 판정은 최소 2개 이상의 독립 출처로 대조하고, 출처가 "
    "엇갈리면 더 신뢰도 높은(tier 낮은) 출처를 채택하고 insight에 불일치를 명시한다.\n"
    "3. 1차 출처 우선: 법령·관보·감독기관·중앙은행·통계청(tier1)을 최우선으로 찾는다. "
    "tier는 출처 신뢰도이며 점수에 곱하지 않는다.\n"
    "4. 인용: 각 항목의 source에 기관·문서명을 구체적으로 적는다. NEWS는 스키마의 출처 "
    "화이트리스트 안에서만 채택하고 url·pub_date를 채운다.\n"
    "5. 환각 금지: 화이트리스트/신뢰 출처로 확인되지 않으면 지어내지 말고 estimated:true·"
    "tier 상향 또는 so_what=\"조사 필요\"로 표기한다.\n"
    "6. 최신성: 가급적 최근 데이터를 쓰고 data_year를 명확히 한다."
)


def _schema_binding(schema_md: str) -> str:
    """출력이 스키마 명세를 그대로 따르도록 강제하는 바인딩 블록."""
    return (
        "\n\n[데이터 스키마 — 모든 항목은 아래 스키마 정의를 정확히 따른다]\n"
        "각 item의 필드명·enum 값·role별 추가 필드(score/gate/context)·유사도 6개 item의 "
        "similarity_axis/similarity_weight/score_dimensions·timeseries 구조·NEWS value 구조와 "
        "출처 화이트리스트를 아래 명세 그대로 준수하라.\n"
        "```\n" + schema_md + "\n```"
    )


def load_country_prompt(
    country_name: str, region: str, segment: Optional[str] = None
) -> str:
    """country_research_prompt.md 본문 → 플레이스홀더 치환(단일 통짜 호출용, 후방호환)."""
    body = _extract_prompt_body(_read_prompt_file("country_research_prompt.md"))
    return (
        body.replace("{COUNTRY}", country_name)
        .replace("{REGION}", region or "")
        .replace("{SEGMENT}", segment or "개인 신차")
    )


# ── 4-Agent 분야별 딥리서치 (상품·규제·시스템·시장) ─────────────────
# 각 분야 agent는 동일한 공통 명세(조사 항목 규칙·NEWS 규칙·tier·timeseries·순위배열)를
# 공유하되, 자기 담당 그룹의 items[]만 출력한다. 유사도 채점 6개 item은 similarity_axis
# 값으로 소유 agent를 결정(축 기준 분배) — 한 item이 두 agent에 걸치는 충돌을 막는다.
FIELDS = ("market", "regulatory", "system", "product")

FIELD_LABELS = {
    "market": "시장",
    "regulatory": "규제",
    "system": "시스템",
    "product": "상품",
}

_FIELD_PERSONAS = {
    "market": (
        "너는 20년차 글로벌 오토파이낸스 시장분석 전문가다. 시장 규모·성장률·금융 이용률·"
        "금리(APR)·신차 판매·세제·캡티브/금융사 점유율·EV 보급률 및 잔가 리스크, 경쟁 구도와 "
        "외부 뉴스 이슈를 1차 출처 기반으로 깊이 있게 조사한다."
    ),
    "regulatory": (
        "너는 글로벌 자동차금융 규제·라이선스 전문 변호사다. 진입 게이트(외국인 지분·외환/배당 "
        "송금·데이터 현지화·국가신용등급·라이선스 취득/체제·금리 상한·최저자본금), 회수·추심·"
        "충당금·연체 분류 규제, 의무보험·신용생명보험·끼워팔기·AI 신용평가 등 특화 규제를 "
        "법령·관보·감독기관 출처로 깊이 있게 조사한다."
    ),
    "system": (
        "너는 오토파이낸스 IT/디지털 아키텍트다. 솔루션 벤더·유형, 디지털 채널·딜러 성숙도, "
        "신용정보(CB)·결제/정산 인프라, 데이터 국외이전 제한 등 IT·유사도 항목을 깊이 있게 조사한다."
    ),
    "product": (
        "너는 오토론·리스 상품기획 전문가다. 할부·리스·렌탈·플릿 등 구매 패턴과 상품별 비중, "
        "상품 관점의 베이스라인 유사도를 깊이 있게 조사한다."
    ),
}

# 분야별 담당 범위(프롬프트에 그대로 주입). 유사도 6개 item의 소유는 similarity_axis 기준.
_FIELD_SCOPE = {
    "market": (
        "[담당 범위] '■ 시장·매력도' 그룹 전체, '■ 리스 손익(EV/잔가)' 전체, "
        "'■ 서술·배경(context)' 전체, '■ 외부 이슈 스캔(NEWS)'.\n"
        "[제외] '구매 패턴(할부·리스 비중)' 항목은 상품 전문가가 담당하므로 출력하지 말 것."
    ),
    "regulatory": (
        "[담당 범위] '■ 게이트(진입 가부)' 그룹 전체, '■ 회수·규제(상품/리스크)' 그룹 전체, "
        "'■ 특화요건' 그룹 전체, '규제기관 식별'(context). 유사도 채점 항목 중 "
        "'라이선스 체제(세그먼트별)'(similarity_axis=regulatory), '데이터 현지화 의무'"
        "(similarity_axis=regulatory), '차량회수 절차 용이성'(similarity_axis=risk)도 "
        "score_dimensions와 함께 담당."
    ),
    "system": (
        "[담당 범위] '■ IT·유사도(베이스라인 대비)' 그룹 전체. 유사도 채점 항목 중 "
        "'솔루션 유형'(similarity_axis=system), '디지털 채널 성숙도'(similarity_axis=system)는 "
        "score_dimensions와 함께 담당."
    ),
    "product": (
        "[담당 범위] 유사도 채점 항목 '구매 패턴(할부·리스 비중)'(similarity_axis=product)을 "
        "score_dimensions와 함께 담당하고, 할부·리스·렌탈·플릿 상품 비중에 대한 보조 서술"
        "(category=business, role=context) 항목을 1개 이상 출력한다."
    ),
}

_FIELD_OUTPUT_CONTRACT = (
    "\n\n[분야 출력 계약 — 위 출력 형식보다 우선]\n"
    "1. 너는 위 [담당 범위]에 해당하는 항목만 출력한다. 다른 분야 항목은 다른 전문가가 "
    "담당하므로 절대 출력하지 말 것(중복 금지).\n"
    "2. 출력은 items 배열만 담은 순수 JSON 객체다: {\"items\": [ {...}, ... ]}.\n"
    "3. country·code·region·overall_insight 등 최상위 메타는 출력하지 말 것(시스템이 병합 시 주입).\n"
    "4. 코드펜스·설명 없이 순수 JSON만 출력."
)


def load_country_field_prompt(
    field: str,
    country_name: str,
    region: str,
    segment: Optional[str] = None,
) -> str:
    """분야(market/regulatory/system/product)별 딥리서치 프롬프트.

    공통 명세(조사 항목·규칙)를 공유하되, 페르소나·담당 범위·출력 계약으로 자기 분야
    items[]만 출력하도록 스코프한다."""
    if field not in _FIELD_PERSONAS:
        raise ValueError(f"unknown research field: {field}")
    common = _extract_prompt_body(_read_prompt_file("country_research_prompt.md"))
    schema_md = _load_schema_spec("country_research_schema.md")
    persona = _FIELD_PERSONAS[field]
    scope = _FIELD_SCOPE[field]
    prompt = (
        f"{persona}\n\n{scope}\n\n"
        f"--- 아래는 전체 조사 명세다. 위 담당 범위에 해당하는 항목만 조사·출력하라 ---\n\n"
        f"{common}"
        f"{_DEEP_RESEARCH_DIRECTIVE}"
        f"{_schema_binding(schema_md)}"
        f"{_FIELD_OUTPUT_CONTRACT}"
    )
    return (
        prompt.replace("{COUNTRY}", country_name)
        .replace("{REGION}", region or "")
        .replace("{SEGMENT}", segment or "개인 신차")
    )


_OVERALL_INSIGHT_SCHEMA = {
    "type": "object",
    "properties": {"overall_insight": {"type": "string"}},
    "required": ["overall_insight"],
}


def overall_insight_schema() -> dict:
    return dict(_OVERALL_INSIGHT_SCHEMA)


def build_overall_insight_prompt(
    country_name: str, items: list, segment: Optional[str] = None
) -> str:
    """병합된 items[]를 근거로 overall_insight(진출 전략 4~6문장)만 생성하는 프롬프트.

    새 수치를 지어내지 말고 조사된 항목 값만 근거로 교차 해석(비용/난이도 드라이버,
    매력도↔IT유사도 불일치, 다크호스/리스크 플래그)을 녹인다."""
    lines = []
    for it in items:
        if it.get("role") in ("score", "gate"):
            seg = f"- [{it.get('category')}/{it.get('role')}] {it.get('item')}: " \
                  f"{it.get('value', '')} {it.get('unit', '')}".rstrip()
            ins = it.get("insight")
            if ins:
                seg += f" — {ins}"
            lines.append(seg)
    summary = "\n".join(lines[:40])  # 토큰 절약(핵심 score/gate 위주)
    return (
        "너는 20년차 글로벌 오토파이낸스 진출 컨설턴트다. "
        f"대상 국가: {country_name}, 타깃 세그먼트: {segment or '개인 신차'}.\n"
        "아래는 시장·규제·시스템·상품 4개 분야 전문가가 조사한 핵심 항목이다.\n\n"
        f"{summary}\n\n"
        "이 항목들만 근거로 진출 전략 관점의 종합 인사이트를 4~6문장으로 작성하라. "
        "교차 해석을 녹여라: (1) 비용/난이도 드라이버 (2) 비즈니스 매력도와 IT 유사도가 "
        "엇갈리는 지점과 함의 (3) 다크호스/리스크 플래그. "
        "★ 새 수치를 지어내지 말 것. 순수 JSON {\"overall_insight\": \"...\"} 만 출력."
    )


def load_region_prompt(
    region_name: str, member_codes: List[str], segment: Optional[str] = None
) -> str:
    """region_research_prompt.md(잠정) 본문 → 치환. member_codes는 안내로 부가.

    권역도 딥리서치 디렉티브 + 권역/국가 스키마 명세를 함께 주입해, 중첩 country 객체가
    country 스키마 규칙을 그대로 따르도록 강제한다."""
    body = _extract_prompt_body(_read_prompt_file("region_research_prompt.md"))
    region_schema = _load_schema_spec("region_research_schema.md")
    country_schema = _load_schema_spec("country_research_schema.md")
    members = ", ".join(member_codes) if member_codes else ""
    prompt = (
        f"{body}"
        f"{_DEEP_RESEARCH_DIRECTIVE}"
        f"{_schema_binding(region_schema)}"
        "\n\n[중첩 country 객체는 아래 country 스키마를 그대로 따른다]\n"
        "```\n" + country_schema + "\n```"
    )
    return (
        prompt.replace("{REGION}", region_name)
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
