"""챗봇 에이전트 도구(tool) 정의 + 실행 핸들러 (C12 보조).

규칙기반 골격(정규식 의도분류 + 하드코딩 국가별칭 dict)을 대체한다. LLM이 tool-use로
대상을 식별·조회하고 리서치/보고서를 '제안'한다. 모든 tool은 **읽기 전용**이며, propose_*도
실제 트리거하지 않고 신호만 남긴다(실제 실행은 프론트가 동의 칩 후 REST 호출).

설계 원칙:
- 대상 식별: LLM이 국가명→ISO2 / 권역명→권역코드를 자체 지식으로 변환해 lookup_target에 넘긴다.
  핸들러는 TARGET_ID_PATTERN으로 검증해 환각 코드를 거른다(별칭 dict 없이 환각 가드 유지).
- 정책 가드: check_research_policy는 research_policy 단일 판정점을 그대로 노출. 단, 실제 게이트는
  호출부(chatbot.handle_agent)의 후처리에서 재검증한다 — LLM이 안 부르고 제안해도 코드가 막는다.
- country↔region 대칭: 모든 tool이 domain을 받아 양쪽을 동일 분기로 처리.
"""
from __future__ import annotations

import re
from typing import List

from .. import config
from . import research_policy, storage_resolver

_log = config.get_logger("chat_tools")

# 토큰 절약: 컨텍스트 요약에 포함할 score/gate item 최대 개수(chatbot._summarize와 동일 정책).
_SUMMARY_ITEM_CAP = 12
# 관점(perspective) → 리서치 item.category 필터. chatbot._PERSPECTIVE_CATEGORIES와 동일.
_PERSPECTIVE_CATEGORIES = {
    "business": {"business", "shared"},
    "system": {"it", "shared"},
    "both": {"business", "it", "shared"},
}


# ── tool 스키마 (Anthropic Messages API tools 포맷) ─────────────────
# input_schema는 JSON Schema. LLM이 이 정의를 보고 도구를 호출한다.
TOOLS: List[dict] = [
    {
        "name": "lookup_target",
        "description": (
            "사용자가 말한 국가/권역을 식별한다. 국가는 ISO 3166-1 alpha-2 대문자 코드"
            "(스페인→ES, 독일→DE, 이탈리아→IT), 권역은 권역 코드(유럽→EU, 북미→NA, "
            "남미→SA, 아시아태평양→APAC, 중동→ME, 아프리카→AF)로 변환해 호출하라. "
            "반환값으로 보유 데이터/보고서 존재 여부와 소속 권역을 알 수 있다. "
            "구체적 국가/권역명이 질문에 없으면 이 도구를 호출하지 말고 list_available로 되물어라."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "식별한 국가 ISO2 코드 또는 권역 코드(대문자).",
                },
                "kind": {
                    "type": "string",
                    "enum": ["country", "region"],
                    "description": "country=국가, region=권역.",
                },
            },
            "required": ["name", "kind"],
        },
    },
    {
        "name": "get_research_summary",
        "description": (
            "보유 중인 국가/권역 리서치 데이터 요약을 가져온다. 답변의 유일한 사실 근거다. "
            "found=false면 보유 데이터가 없다는 뜻이며, 이때는 일반 지식 기반 잠정 답변 모드로 전환하라. "
            "perspective를 지정하면 해당 관점(business=비즈니스, system=시스템, both=둘 다)의 항목만 요약한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "enum": ["country", "region"]},
                "target_id": {"type": "string", "description": "국가/권역 코드(대문자)."},
                "perspective": {
                    "type": "string",
                    "enum": ["business", "system", "both"],
                },
            },
            "required": ["domain", "target_id"],
        },
    },
    {
        "name": "list_available",
        "description": (
            "현재 보유 중인 국가/권역 목록을 가져온다. 사용자가 구체적 대상을 말하지 않았거나 "
            "'어떤 나라들이 있어?'처럼 보유 목록을 물을 때 사용한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "kind": {
                    "type": "string",
                    "enum": ["country", "region", "both"],
                    "description": "조회할 종류. 기본 both.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "region_members_status",
        "description": (
            "권역 소속 국가 목록과 각 국가의 데이터 보유 여부를 가져온다. 권역 단위 질문이나 "
            "'권역 내 퀵윈 가능한 국가'를 다룰 때 사용한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "region": {"type": "string", "description": "권역 코드(대문자, 예 EU)."}
            },
            "required": ["region"],
        },
    },
    {
        "name": "check_research_policy",
        "description": (
            "특정 국가/권역을 신규/재리서치할 수 있는지 정책을 확인한다. 리서치를 제안하기 전에 "
            "반드시 호출하라. 권역 신규 리서치는 금지, 국가는 보유국 재수행 또는 보유 권역 소속국만 허용된다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "enum": ["country", "region"]},
                "target_id": {"type": "string", "description": "국가/권역 코드(대문자)."},
            },
            "required": ["domain", "target_id"],
        },
    },
    {
        "name": "propose_research",
        "description": (
            "사용자에게 리서치 수행을 제안한다(실제 실행은 하지 않음 — 사용자 동의 후 별도 처리). "
            "보유 데이터가 없어 답을 보강해야 하거나, 사용자가 리서치/조사를 요청할 때 호출한다. "
            "권역의 경우 포함할 멤버 국가 코드를 member_codes로 넘길 수 있다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "enum": ["country", "region"]},
                "target_id": {"type": "string", "description": "국가/권역 코드(대문자)."},
                "member_codes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "권역 리서치 시 포함할 멤버 국가 코드(선택).",
                },
                "reason": {"type": "string", "description": "제안 사유(짧게)."},
            },
            "required": ["domain", "target_id"],
        },
    },
    {
        "name": "propose_report",
        "description": (
            "사용자에게 진단 보고서 생성을 제안한다(실제 실행은 하지 않음 — 사용자 동의 후 별도 처리). "
            "사용자가 보고서/리포트 생성·발행을 요청할 때 호출한다."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "enum": ["country", "region"]},
                "target_id": {"type": "string", "description": "국가/권역 코드(대문자)."},
            },
            "required": ["domain", "target_id"],
        },
    },
    {
        "name": "request_perspective",
        "description": (
            "보유 데이터가 있는 국가/권역에 대한 일반 질의(qa)인데 사용자가 답변 관점을 "
            "지정하지 않았을 때, 답변을 생성하지 말고 이 도구를 호출하라. 그러면 사용자에게 "
            "비즈니스/시스템/둘다 중 어떤 관점으로 설명할지 되묻는다(senario.md). "
            "단, 컨텍스트에 이미 관점이 주어졌거나 사용자가 직접 관점을 말했다면 호출하지 말고 그 관점으로 답하라."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string", "enum": ["country", "region"]},
                "target_id": {"type": "string", "description": "국가/권역 코드(대문자)."},
            },
            "required": ["domain", "target_id"],
        },
    },
]


# ── 실행 핸들러 ─────────────────────────────────────────────────────
def _valid_code(code: str) -> bool:
    """대상 코드 형식 검증(환각 가드). TARGET_ID_PATTERN과 동일한 규칙."""
    return bool(re.fullmatch(config.TARGET_ID_PATTERN, code or ""))


def _summarize_research(domain: str, target_id: str, perspective: str | None) -> dict:
    """리서치 JSON → 요약 dict. 없으면 {found:false}. _summarize 로직과 동치(토큰 절약)."""
    data = storage_resolver._load_latest_research(domain, target_id)
    if not data:
        return {"found": False}
    cats = _PERSPECTIVE_CATEGORIES.get(perspective or "")
    parts: List[str] = []
    oi = data.get("overall_insight")
    if oi:
        parts.append(f"[종합] {oi}")
    picked = 0
    for it in data.get("items") or []:
        if cats is not None and it.get("category") not in cats:
            continue
        if it.get("role") in ("score", "gate"):
            seg = f"- {it.get('item')}: {it.get('value', '')} {it.get('unit', '')}".rstrip()
            ins = it.get("insight")
            if ins:
                seg += f" — {ins}"
            parts.append(seg)
            picked += 1
            if picked >= _SUMMARY_ITEM_CAP:
                break
    return {"found": True, "summary": "\n".join(parts)}


def _lookup_target(name: str, kind: str) -> dict:
    """국가/권역 코드 → 상태 조회. 형식 불량이면 error(환각 코드 차단)."""
    code = (name or "").upper()
    if kind not in ("country", "region") or not _valid_code(code):
        return {"error": "invalid_target", "hint": "구체적 국가/권역명이 필요합니다."}
    exists = storage_resolver.research_exists(kind, code)
    has_report = storage_resolver.latest_report_id(kind, code) is not None
    region = research_policy.region_of_country(code) if kind == "country" else code
    owned_regions = research_policy.existing_region_codes()
    return {
        "domain": kind,
        "target_id": code,
        "exists": exists,
        "has_report": has_report,
        "region": region,
        "in_owned_region": bool(region and region in owned_regions),
    }


def _list_available(kind: str) -> dict:
    """보유 국가/권역 목록(코드+이름)."""
    out: dict = {}
    if kind in ("country", "both"):
        out["countries"] = [
            {"code": c.code, "name": c.name_ko or c.name}
            for c in storage_resolver.list_countries()
        ]
    if kind in ("region", "both"):
        out["regions"] = [
            {"code": r.code, "name": r.name_ko or r.name}
            for r in storage_resolver.list_regions()
        ]
    return out


def _region_members_status(region: str) -> dict:
    """권역 소속국 + 각국 데이터 보유 여부."""
    code = (region or "").upper()
    if not _valid_code(code):
        return {"error": "invalid_target"}
    src = storage_resolver.region_detail_sources(code)
    members = src.get("members", [])
    names = src.get("member_names", {})
    rows = [
        {
            "code": m,
            "name": (names.get(m) or {}).get("name_ko") or (names.get(m) or {}).get("name") or m,
            "exists": storage_resolver.research_exists("country", m),
        }
        for m in members
    ]
    return {"region": code, "members": rows}


def _check_policy(domain: str, target_id: str) -> dict:
    """리서치 정책 판정(단일 판정점 노출)."""
    code = (target_id or "").upper()
    allowed, reason = research_policy.research_allowed(domain, code)
    return {"allowed": allowed, "reason": reason}


def execute_tool(name: str, tool_input: dict) -> dict:
    """tool 이름 + input → 실행 결과 dict. 알 수 없는 tool은 error.

    propose_research/propose_report는 부수효과 없음 — 호출 사실만 echo(신호용).
    호출부가 tool_trace에서 이 호출을 보고 needs_research/needs_report 플래그를 조립한다.
    """
    tool_input = tool_input or {}
    try:
        if name == "lookup_target":
            return _lookup_target(tool_input.get("name", ""), tool_input.get("kind", ""))
        if name == "get_research_summary":
            return _summarize_research(
                tool_input.get("domain", ""),
                (tool_input.get("target_id", "") or "").upper(),
                tool_input.get("perspective"),
            )
        if name == "list_available":
            return _list_available(tool_input.get("kind", "both"))
        if name == "region_members_status":
            return _region_members_status(tool_input.get("region", ""))
        if name == "check_research_policy":
            return _check_policy(
                tool_input.get("domain", ""), tool_input.get("target_id", "")
            )
        if name in ("propose_research", "propose_report", "request_perspective"):
            # 신호 tool — 실행 없음. LLM에 '접수됐다'고만 알린다(request_perspective는
            # stop_on으로 루프가 즉시 멈춰 이 결과가 LLM에 전달되지 않는다).
            return {"acknowledged": True}
    except Exception as exc:  # noqa: BLE001 — tool 실행 실패는 LLM에 error로 돌려준다.
        _log.warning("tool 실행 실패 name=%s: %s", name, exc)
        return {"error": "tool_failed", "detail": str(exc)}
    return {"error": "unknown_tool", "name": name}
