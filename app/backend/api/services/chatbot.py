"""챗봇 서비스 (C12, L7·L8) — §6.5 분기. 무상태(Q5=A).

데이터 보유 시 Bedrock 텍스트 답변, 없으면 needs_research 신호만 반환(직접 트리거
안 함 — 프론트가 동의 후 research API 호출). history는 요청으로 전달(서버 세션 없음).
"""
from __future__ import annotations

import re
from typing import List, Optional

from .. import config
from ..schemas import ChatResponse, ChatTurn
from . import bedrock_client, research_policy, storage_resolver

_log = config.get_logger("chatbot")

# 결정적 국가명→ISO alpha-2 매핑(한글·영문). LLM 분류가 실패/흔들려도 질문 텍스트에서
# 대상을 직접 잡아 'ES 폴백' 버그를 막는다. 주요 진출 검토국을 폭넓게 수록(데이터 미보유국도
# 포함 — 인식되면 '데이터 없음 → 리서치 트리거' 경로로 자연스럽게 흐른다).
_COUNTRY_ALIASES: dict[str, str] = {
    # ── 유럽 ──
    "스페인": "ES", "spain": "ES", "españa": "ES",
    "독일": "DE", "germany": "DE", "deutschland": "DE",
    "프랑스": "FR", "france": "FR",
    "이탈리아": "IT", "italy": "IT", "italia": "IT",
    "영국": "GB", "uk": "GB", "united kingdom": "GB", "britain": "GB", "england": "GB",
    "네덜란드": "NL", "netherlands": "NL", "holland": "NL",
    "폴란드": "PL", "poland": "PL",
    "포르투갈": "PT", "portugal": "PT",
    "오스트리아": "AT", "austria": "AT",
    "덴마크": "DK", "denmark": "DK",
    "벨기에": "BE", "belgium": "BE",
    "스위스": "CH", "switzerland": "CH",
    "스웨덴": "SE", "sweden": "SE",
    "노르웨이": "NO", "norway": "NO",
    "핀란드": "FI", "finland": "FI",
    "아일랜드": "IE", "ireland": "IE",
    "그리스": "GR", "greece": "GR",
    "체코": "CZ", "czech": "CZ", "czechia": "CZ",
    "헝가리": "HU", "hungary": "HU",
    "루마니아": "RO", "romania": "RO",
    "터키": "TR", "튀르키예": "TR", "turkey": "TR", "türkiye": "TR",
    "러시아": "RU", "russia": "RU",
    "우크라이나": "UA", "ukraine": "UA",
    # ── 북미 ──
    "미국": "US", "usa": "US", "united states": "US", "america": "US",
    "캐나다": "CA", "canada": "CA",
    "멕시코": "MX", "mexico": "MX", "méxico": "MX",
    "푸에르토리코": "PR", "puerto rico": "PR",
    # ── 남미 ──
    "브라질": "BR", "brazil": "BR",
    "아르헨티나": "AR", "argentina": "AR",
    "칠레": "CL", "chile": "CL",
    "콜롬비아": "CO", "colombia": "CO",
    "페루": "PE", "peru": "PE",
    # ── 아시아·태평양 ──
    "중국": "CN", "china": "CN",
    "일본": "JP", "japan": "JP",
    "한국": "KR", "korea": "KR", "대한민국": "KR", "south korea": "KR",
    "인도": "IN", "india": "IN",
    "인도네시아": "ID", "indonesia": "ID",
    "베트남": "VN", "vietnam": "VN",
    "태국": "TH", "thailand": "TH",
    "말레이시아": "MY", "malaysia": "MY",
    "필리핀": "PH", "philippines": "PH",
    "싱가포르": "SG", "singapore": "SG",
    "호주": "AU", "australia": "AU",
    "뉴질랜드": "NZ", "new zealand": "NZ",
    "대만": "TW", "taiwan": "TW",
    "홍콩": "HK", "hong kong": "HK",
    # ── 중동 ──
    "사우디": "SA", "사우디아라비아": "SA", "saudi": "SA", "saudi arabia": "SA",
    "아랍에미리트": "AE", "uae": "AE", "에미리트": "AE", "두바이": "AE", "dubai": "AE",
    "이스라엘": "IL", "israel": "IL",
    "카타르": "QA", "qatar": "QA",
    # ── 아프리카 (개별 국가 — 데이터 없으면 리서치 트리거) ──
    "나이지리아": "NG", "nigeria": "NG",
    "케냐": "KE", "kenya": "KE",
    "남아공": "ZA", "남아프리카공화국": "ZA", "south africa": "ZA",
    "이집트": "EG", "egypt": "EG",
    "모로코": "MA", "morocco": "MA",
    "가나": "GH", "ghana": "GH",
    "에티오피아": "ET", "ethiopia": "ET",
    "탄자니아": "TZ", "tanzania": "TZ",
}

# 권역명→권역 코드 매핑(보유 권역 + 대륙 별칭). 프론트 지도 권역(MapView REGIONS6)과
# 동일한 코드 체계(EU/NA/SA/APAC/ME/AF)를 따른다. 데이터 미보유 권역(AF/ME 등)도 매핑해
# '권역 인식 → 멤버 국가 지정 → 리서치 트리거' 경로로 흐르게 한다.
_REGION_ALIASES: dict[str, str] = {
    "유럽연합": "EU", "유럽": "EU", "europe": "EU", "european union": "EU", "eu": "EU",
    "북미": "NA", "north america": "NA", "na": "NA",
    "남미": "SA", "남아메리카": "SA", "latin america": "SA", "south america": "SA",
    "latam": "SA",
    "아시아태평양": "APAC", "아시아·태평양": "APAC", "아시아": "APAC", "asia pacific": "APAC",
    "apac": "APAC", "asia": "APAC",
    "중동": "ME", "middle east": "ME", "me": "ME",
    "아프리카": "AF", "africa": "AF", "af": "AF",
}


def _match_alias(message: str) -> Optional[tuple]:
    """질문 텍스트에서 국가/권역명을 직접 매칭. 국가 우선, 가장 긴 별칭 우선.

    LLM 분류를 보강하는 결정적 폴백 — Bedrock 오류·found=false 시에도 대상을 잡는다.
    """
    low = message.lower()
    # 가장 긴 별칭부터 검사(부분 문자열 오탐 최소화).
    for alias in sorted(_COUNTRY_ALIASES, key=len, reverse=True):
        if alias in low:
            return "country", _COUNTRY_ALIASES[alias]
    for alias in sorted(_REGION_ALIASES, key=len, reverse=True):
        if alias in low:
            return "region", _REGION_ALIASES[alias]
    return None


def extract_member_codes(message: str) -> List[str]:
    """메시지에서 언급된 모든 국가 코드를 추출(권역 리서치 멤버 후보).

    권역 리서치는 포함할 멤버 국가가 필요하다. "아프리카 권역 중 나이지리아·케냐·남아공"
    처럼 권역 + 여러 국가를 함께 말하면 그 국가들을 멤버로 잡는다. 등장 순서 보존·중복 제거.
    """
    low = message.lower()
    found: List[str] = []
    for alias in sorted(_COUNTRY_ALIASES, key=len, reverse=True):
        if alias in low:
            code = _COUNTRY_ALIASES[alias]
            if code not in found:
                found.append(code)
    return found

_SYSTEM = (
    "너는 글로벌 오토파이낸스 진출 진단 서비스의 컨설턴트 챗봇이다. "
    "제공된 참고 컨텍스트(국가/권역 리서치 요약)에 근거해 간결하고 실무적으로 답하라. "
    "근거 없는 수치를 지어내지 말고, 모르면 모른다고 답하라."
)

# 대상(target) 추출 — 사용자 메시지에서 어떤 국가/권역에 대한 질문인지 식별.
_RESOLVE_SYSTEM = (
    "너는 사용자의 질문에서 '어떤 국가 또는 권역에 대한 질문인지'를 식별하는 분류기다. "
    "국가는 ISO 3166-1 alpha-2 대문자 코드(예: 스페인→ES, 독일→DE, 이탈리아→IT)로, "
    "권역은 권역 코드(예: 유럽→EU, 북미→NA, 아시아태평양→APAC, 남미→SA, 중동→ME, 아프리카→AF)로 반환하라. "
    "질문에 명시적 국가/권역이 없으면 found=false 로 답하라. "
    "국가와 권역이 모두 언급되면 더 구체적인 국가를 우선한다. "
    "단, '권역 리서치'·'권역 분석'처럼 권역 단위 작업을 명시하면 권역을 우선한다."
)

# '권역' 단위 작업 명시 신호 — 이때는 함께 언급된 개별 국가보다 권역을 우선한다.
_REGION_INTENT_RE = re.compile(r"권역|region")

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
    """사용자 메시지에서 (domain, target_id)를 식별. 식별 실패 시 None.

    LLM 분류를 시도하되, 실패(Bedrock 오류·found=false·형식 불일치)하면 질문 텍스트의
    결정적 국가/권역명 매칭으로 폴백한다. 둘 다 실패할 때만 None(라우터가 프론트 target
    으로 폴백) — 이로써 LLM이 흔들려도 'ES 고정' 버그가 재발하지 않는다.

    '권역 리서치/분석'처럼 권역 단위 작업을 명시하면 함께 언급된 개별 국가보다 권역을
    우선한다(결정적 — LLM의 '국가 우선' 경향에 좌우되지 않게 선처리)."""
    # 권역 단위 작업 명시 + 권역명 매칭 → 권역 우선(결정적).
    if _REGION_INTENT_RE.search(message.lower()):
        low = message.lower()
        for alias in sorted(_REGION_ALIASES, key=len, reverse=True):
            if alias in low:
                _log.info("권역 의도 감지 — 권역 우선: %s", _REGION_ALIASES[alias])
                return "region", _REGION_ALIASES[alias]
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
        if out.get("found"):
            domain = out.get("domain")
            target_id = (out.get("target_id") or "").upper()
            if domain in ("country", "region") and target_id:
                return domain, target_id
    except bedrock_client.BedrockError as exc:
        _log.warning("LLM 대상 추출 실패 — 결정적 매칭으로 폴백: %s", exc)

    # 결정적 폴백: 질문 텍스트에서 국가/권역명 직접 매칭(ES 고정 버그 방지).
    matched = _match_alias(message)
    if matched:
        _log.info("결정적 매칭으로 대상 식별: %s", matched)
    return matched


# 후속 질문(직전 대상을 이어감) 신호어 — 명시 대상 없이도 직전 대상 유지.
_FOLLOWUP_RE = re.compile(
    r"(거기|그곳|그\s*나라|그\s*국가|위\s*나라|해당\s*국가|방금|아까|이어서|"
    r"그럼|그러면|더|추가로|자세히|상세|보고서|리포트|report|"
    r"there|that country|it\b|more detail|continue)"
)


def continues_prior_target(
    message: str, history: Optional[List[ChatTurn]] = None
) -> bool:
    """명시 대상이 없어도 직전 대상을 이어가는 후속 질문인지 판정.

    대화 이력이 있고(이미 한 번 답변함) + 후속 신호어가 있으면 True → 라우터가
    프론트의 직전 target을 유지한다. 첫 턴(이력 없음)에서는 False → 되묻기."""
    has_prior = bool(history and any(t.role == "assistant" for t in history))
    if not has_prior:
        return False
    return bool(_FOLLOWUP_RE.search(message.lower()))


def ask_for_target() -> ChatResponse:
    """대상 국가를 식별하지 못했을 때 되묻는 응답(ES 등으로 임의 답변 금지).

    보유 국가 목록을 함께 안내해 사용자가 고르도록 한다."""
    countries = storage_resolver.list_countries()
    names = ", ".join((c.name_ko or c.name) for c in countries) or "(없음)"
    return ChatResponse(
        intent="qa",
        exists=False,
        answer=(
            "어느 국가에 대해 알려드릴까요? 국가명을 말씀해 주시면 진단을 도와드립니다.\n"
            "(대륙·권역 전체보다 구체적인 국가를 지정해 주세요. 예: 나이지리아, 남아공)\n\n"
            f"현재 보유 중인 국가 데이터: {names}\n"
            "목록에 없는 국가는 리서치를 통해 새로 조사할 수 있어요."
        ),
    )


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


# ── 의도 감지 (qa / research / report) ──────────────────────────
# 보고서 생성은 사용자가 '보고서/리포트 생성·만들어'를 명시할 때만 트리거(요구사항).
_REPORT_RE = re.compile(
    r"(보고서|리포트|report).*(생성|제작|만들|작성|뽑|발행|재생성|다시\s*생성)"
    r"|(생성|제작|만들|작성|뽑|발행|재생성|다시\s*생성).*(보고서|리포트|report)"
)
# 리서치 수행/재수행 명시 의도.
_RESEARCH_RE = re.compile(
    r"(리서치|조사|research).*(해|수행|진행|시작|돌려|재수행|다시|업데이트|갱신|새로)"
    r"|(재수행|다시|업데이트|갱신|새로).*(리서치|조사|research)"
)


def _detect_intent(message: str) -> str:
    """메시지에서 사용자 의도 분류: report > research > qa(기본)."""
    low = message.lower()
    if _REPORT_RE.search(low):
        return "report"
    if _RESEARCH_RE.search(low):
        return "research"
    return "qa"


def _answer_existing(
    domain: str,
    target_id: str,
    message: str,
    history: Optional[List[ChatTurn]],
) -> str:
    """보유 데이터 기반 LLM 텍스트 답변(내부 데이터로만)."""
    data = storage_resolver._load_latest_research(domain, target_id) or {}
    ctx = _summarize(data)
    hist = [{"role": t.role, "content": t.content} for t in (history or [])]
    return bedrock_client.generate_text(
        message, system=_SYSTEM, context=ctx, history=hist
    )


def _qa_actions(domain: str, exists: bool, has_report: bool) -> List[str]:
    """보유 대상 QA 답변에 함께 노출할 선택지(상세요약/리서치 재수행/보고서).

    정책: 권역(region)은 재리서치를 제공하지 않는다(권역 리서치 전면 제외).
    국가는 보유국이므로 재리서치 허용.
    """
    if not exists:
        return []
    actions = ["summary"]
    if domain == "country":
        actions.append("re_research")  # 보유국 재리서치 허용
    actions.append("re_report" if has_report else "report")
    return actions


def _region_research_blocked(target_id: str, exists: bool, has_report: bool) -> ChatResponse:
    """권역 리서치 요청을 정중히 거절(트리거 없음). 보유 권역이면 보고서 선택지는 유지."""
    return ChatResponse(
        intent="qa",
        exists=exists,
        has_report=has_report,
        needs_research=False,
        research_suggestion=(
            "권역 단위 신규 리서치는 현재 지원하지 않습니다. "
            "보유 중인 권역(EU·북미·남미·아시아태평양) 정보로 답변드리거나, "
            "권역 내 개별 국가의 리서치를 도와드릴 수 있어요."
        ),
        actions=_qa_actions("region", exists, has_report) if exists else [],
    )


def _country_research_blocked(target_id: str) -> ChatResponse:
    """보유 권역 밖 국가의 신규 리서치 요청을 거절(트리거 없음)."""
    _allowed, reason = research_policy.country_research_allowed(target_id)
    return ChatResponse(
        intent="qa",
        exists=False,
        needs_research=False,
        research_suggestion=(
            (reason or f"'{target_id}'는 신규 리서치할 수 없습니다.")
            + " 보유 중인 국가 정보로만 답변드릴 수 있어요."
        ),
        actions=[],
    )


def handle(
    domain: str,
    target_id: str,
    message: str,
    history: Optional[List[ChatTurn]] = None,
    member_codes: Optional[List[str]] = None,
) -> ChatResponse:
    """챗봇 1턴 처리. §6.5 분기 + 의도(qa/research/report) 기반 트리거·선택지 노출.

    원칙:
    - 기본은 내부 보유 데이터로만 답변(qa).
    - 보유국에 리서치 재수행/보고서 생성을 명시하면 즉시 트리거(auto_trigger=True).
    - 미보유국은 리서치 의도를 먼저 묻고(needs_research), 사용자가 거절하면 보유국
      정보에 한해서만 답변(프론트가 안내) — 없는 국가를 임의로 답하지 않는다.
    - 보고서 생성은 '국가 + 보고서 생성' 명시일 때만 트리거.
    """
    exists = storage_resolver.research_exists(domain, target_id)
    has_report = storage_resolver.latest_report_id(domain, target_id) is not None
    intent = _detect_intent(message)

    if domain == "region" and member_codes:
        missing = [
            c for c in member_codes
            if not storage_resolver.research_exists("country", c)
        ]
    else:
        missing = []

    # 부분 데이터 — 권역은 있으나 일부 멤버 누락. 정책상 권역 리서치는 제외하므로
    # 트리거하지 않고, 보유 정보로 답하거나 개별 국가 리서치를 안내한다.
    if domain == "region" and exists and missing:
        return _region_research_blocked(target_id, exists, has_report)

    # ── 보고서 생성 의도 ──
    if intent == "report":
        if exists and not missing:
            verb = "재생성" if has_report else "생성"
            return ChatResponse(
                intent="report",
                exists=True,
                has_report=has_report,
                needs_report=True,
                auto_trigger=True,
                research_suggestion=f"{target_id} 진단 보고서를 {verb}합니다.",
                actions=["re_report" if has_report else "report"],
            )
        # 미보유 → 보고서 전에 리서치 필요. 단, 정책상 막힌 대상은 리서치를 제안하지 않는다.
        if domain == "region":
            return _region_research_blocked(target_id, exists, has_report)
        allowed, _reason = research_policy.country_research_allowed(target_id)
        if not allowed:
            return _country_research_blocked(target_id)
        return ChatResponse(
            intent="research",
            exists=False,
            needs_research=True,
            research_suggestion=(
                f"{target_id} 보유 데이터가 없어 보고서를 만들 수 없습니다. "
                "먼저 외부 리서치를 진행할까요?"
            ),
            actions=["research"],
        )

    # ── 리서치 수행/재수행 의도 ──
    if intent == "research":
        # 정책: 권역 리서치는 신규·재수행 모두 제외. 보유 권역이면 보고서 선택지만 유지.
        if domain == "region":
            return _region_research_blocked(target_id, exists, has_report)
        if exists and not missing:
            return ChatResponse(
                intent="research",
                exists=True,
                has_report=has_report,
                needs_research=True,
                auto_trigger=True,  # 보유국 재리서치 = 명시 요청 → 즉시 트리거.
                research_suggestion=f"{target_id} 리서치를 재수행합니다.",
                actions=["re_research"],
            )
        # 미보유 국가 신규 리서치 — 보유 권역 소속만 허용(정책).
        allowed, _reason = research_policy.country_research_allowed(target_id)
        if not allowed:
            return _country_research_blocked(target_id)
        return ChatResponse(
            intent="research",
            exists=False,
            needs_research=True,
            research_suggestion="외부 리서치를 진행할까요?",
            actions=["research"],
        )

    # ── 일반 질의(qa) ──
    if exists and not missing:
        answer = _answer_existing(domain, target_id, message, history)
        return ChatResponse(
            intent="qa",
            exists=True,
            has_report=has_report,
            answer=answer,
            actions=_qa_actions(domain, True, has_report),
        )

    # 미보유 일반 질의 → 임의 답변 금지.
    # 정책: 권역은 신규 리서치 제외 → 거절 안내. 국가는 보유 권역 소속만 리서치 제안.
    if domain == "region":
        return _region_research_blocked(target_id, exists, has_report)
    allowed, _reason = research_policy.country_research_allowed(target_id)
    if not allowed:
        return _country_research_blocked(target_id)
    sug = (
        f"'{target_id}' 보유 정보가 없습니다. 외부 리서치를 진행할까요? "
        "(원치 않으시면 보유 중인 국가 정보로만 답변드릴 수 있어요.)"
    )
    return ChatResponse(
        intent="research",
        exists=False,
        needs_research=True,
        research_suggestion=sug,
        actions=["research"],
    )
