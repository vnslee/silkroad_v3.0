"""챗봇 서비스 (C12, L7·L8) — §6.5 분기. 무상태(Q5=A).

데이터 보유 시 Bedrock 텍스트 답변, 없으면 needs_research 신호만 반환(직접 트리거
안 함 — 프론트가 동의 후 research API 호출). history는 요청으로 전달(서버 세션 없음).
"""
from __future__ import annotations

from typing import List, Optional

from .. import config
from ..schemas import ChatResponse, ChatTurn
from . import bedrock_client, storage_resolver

_log = config.get_logger("chatbot")

_SYSTEM = (
    "너는 글로벌 오토파이낸스 진출 진단 서비스의 컨설턴트 챗봇이다. "
    "제공된 참고 컨텍스트(국가/권역 리서치 요약)에 근거해 간결하고 실무적으로 답하라. "
    "근거 없는 수치를 지어내지 말고, 모르면 모른다고 답하라."
)

# 대상(target) 추출 — 사용자 메시지에서 어떤 국가/권역에 대한 질문인지 식별.
_RESOLVE_SYSTEM = (
    "너는 사용자의 질문에서 '어떤 국가 또는 권역에 대한 질문인지'를 식별하는 분류기다. "
    "국가는 ISO 3166-1 alpha-2 대문자 코드(예: 스페인→ES, 독일→DE, 이탈리아→IT)로, "
    "권역은 권역 코드(예: 유럽→EU, 북미→NA, 아시아태평양→APAC, 남미→SA)로 반환하라. "
    "질문에 명시적 국가/권역이 없으면 found=false 로 답하라. "
    "국가와 권역이 모두 언급되면 더 구체적인 국가를 우선한다."
)

_RESOLVE_SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "domain": {"type": "string", "enum": ["country", "region"]},
        "target_id": {"type": "string"},
    },
    "required": ["found"],
}


def resolve_target(
    message: str,
    history: Optional[List[ChatTurn]] = None,
) -> Optional[tuple]:
    """사용자 메시지에서 (domain, target_id)를 LLM으로 추출. 식별 실패 시 None.

    후보(보유 데이터) 목록을 프롬프트에 제공해 코드 정확도를 높인다. Bedrock 오류·
    형식 불일치는 None 으로 흡수(라우터가 프론트 target_id로 폴백)."""
    countries = storage_resolver.list_countries()
    regions = storage_resolver.list_regions()
    country_lines = ", ".join(f"{c.code}({c.name_ko or c.name})" for c in countries)
    region_lines = ", ".join(f"{r.code}({r.name_ko or r.name})" for r in regions)
    recent = ""
    if history:
        recent = "\n".join(f"{t.role}: {t.content}" for t in history[-4:])
    prompt = (
        f"[보유 국가] {country_lines}\n"
        f"[보유 권역] {region_lines}\n"
        f"[최근 대화]\n{recent}\n\n"
        f"[현재 질문]\n{message}\n\n"
        "위 질문이 가리키는 국가/권역을 식별해 JSON으로만 답하라. "
        "보유 목록에 없어도 표준 코드로 추론해 반환하라."
    )
    try:
        out = bedrock_client.generate_structured(
            prompt, _RESOLVE_SCHEMA, system=_RESOLVE_SYSTEM
        )
    except bedrock_client.BedrockError as exc:
        _log.warning("대상 추출 실패(폴백): %s", exc)
        return None
    if not out.get("found"):
        return None
    domain = out.get("domain")
    target_id = (out.get("target_id") or "").upper()
    if domain not in ("country", "region") or not target_id:
        return None
    return domain, target_id


def _summarize(data: dict) -> str:
    """L8 컨텍스트 요약 — overall_insight + 핵심 score/gate items(토큰 절약)."""
    parts: List[str] = []
    oi = data.get("overall_insight")
    if oi:
        parts.append(f"[종합] {oi}")
    items = data.get("items") or []
    picked = 0
    for it in items:
        if it.get("role") in ("score", "gate"):
            seg = f"- {it.get('item')}: {it.get('value', '')} {it.get('unit', '')}".rstrip()
            ins = it.get("insight")
            if ins:
                seg += f" — {ins}"
            parts.append(seg)
            picked += 1
            if picked >= 12:  # 핵심 N개만(토큰 절약)
                break
    return "\n".join(parts)


def handle(
    domain: str,
    target_id: str,
    message: str,
    history: Optional[List[ChatTurn]] = None,
    member_codes: Optional[List[str]] = None,
) -> ChatResponse:
    """챗봇 1턴 처리. §6.5 분기."""
    exists = storage_resolver.research_exists(domain, target_id)

    if domain == "region" and member_codes:
        missing = [
            c
            for c in member_codes
            if not storage_resolver.research_exists("country", c)
        ]
    else:
        missing = []

    # 부분 데이터(§6.5.2) — 권역은 있으나 일부 멤버 누락.
    if domain == "region" and exists and missing:
        return ChatResponse(
            needs_research=True,
            missing_codes=missing,
            research_suggestion="일부 국가 정보가 부족합니다. 리서치를 진행할까요?",
        )

    # 보유 → LLM 답변.
    if exists and not missing:
        data = storage_resolver._load_latest_research(domain, target_id) or {}
        ctx = _summarize(data)
        hist = [{"role": t.role, "content": t.content} for t in (history or [])]
        answer = bedrock_client.generate_text(
            message, system=_SYSTEM, context=ctx, history=hist
        )
        return ChatResponse(answer=answer)

    # 없음(§6.5.1/6.5.2).
    sug = "외부 리서치를 진행할까요?"
    if domain == "region":
        sug += " 포함할 국가를 알려주세요."
    return ChatResponse(needs_research=True, research_suggestion=sug)
