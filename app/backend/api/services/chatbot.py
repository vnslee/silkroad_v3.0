"""챗봇 서비스 (C12, L7·L8) — LLM tool-use 에이전트. 무상태(Q5=A).

규칙기반 골격(정규식 의도분류 + 하드코딩 국가별칭 dict + 거대 if-else)을 LLM tool-use
에이전트 루프로 대체한다. LLM이 도구(chat_tools)를 호출해 대상을 식별·조회하고 리서치/보고서를
'제안'하면, 코드가 정책·관점 게이트를 결정적으로 적용해 ChatResponse를 조립한다.

설계 원칙:
- 출력 스키마(ChatResponse)·프론트 칩 흐름은 보존(needs_*/auto_trigger/actions/resolved_*).
- 트리거 가능 여부는 절대 LLM에 맡기지 않는다 — research_policy로 후처리에서 재검증(결정적 게이트).
- 관점 되묻기(senario.md Case2/3)도 결정적 게이트로 유지: 보유 대상 qa인데 관점 미지정이면 되묻는다.
- history는 요청으로 전달(서버 세션 없음).
"""
from __future__ import annotations

from typing import List, Optional

from .. import config
from ..schemas import ChatRequest, ChatResponse, ChatTurn
from . import bedrock_client, chat_tools, chatbot_flow, research_policy, storage_resolver

_log = config.get_logger("chatbot")

# 관점(perspective) → 답변 시 강조할 카테고리 라벨(senario.md).
_PERSPECTIVE_LABEL = {"business": "비즈니스", "system": "시스템", "both": "비즈니스·시스템"}
# 관점 되묻기 문구(senario.md Case2/3). 선택지(비즈니스/시스템/둘 다)는 바로 아래 칩으로
# 노출되므로 문구에 다시 적지 않는다(중복 제거).
_PERSPECTIVE_QUESTION = "어떤 관점으로 설명해 드릴까요?"

# 답변 생성 전 멈추는 신호 tool — 관점 되묻기는 답변을 만들지 않고 즉시 분기한다.
_STOP_TOOLS = {"request_perspective"}


# ── 시스템 프롬프트 ─────────────────────────────────────────────────
_BASE_SYSTEM = (
    "너는 글로벌 오토파이낸스 진출 진단 서비스의 컨설턴트 챗봇이다. "
    "사용자의 질문에 대해 도구(tool)를 사용해 대상을 식별하고 보유 데이터를 조회한 뒤, "
    "간결하고 실무적으로 답한다. 답변은 한국어로 10줄 이내, 핵심만 담는다(senario.md 공통)."
)

# tool 사용 규칙 — 규칙기반 분기를 대체하는 행동 지침.
_TOOL_RULES = (
    "\n\n[도구 사용 규칙]\n"
    "1. 사용자가 구체적 국가/권역을 언급하면 먼저 lookup_target으로 식별하라"
    "(국가→ISO2, 권역→권역코드 변환은 네 지식으로 한다). 구체적 이름이 없으면 "
    "lookup_target을 호출하지 말고 list_available로 보유 목록을 보여주며 어떤 대상인지 되물어라.\n"
    "2. 답변의 사실 근거는 반드시 get_research_summary로 가져온 데이터다. "
    "found=true면 그 데이터로만 답하라. 수치를 지어내지 마라.\n"
    "3. get_research_summary가 found=false(보유 데이터 없음)면: ① 일반 지식으로 개괄 수준의 "
    "잠정 답변을 제공하되, ② 반드시 '이는 보유 데이터가 아닌 일반 지식 기반 잠정 답변이라 "
    "정확도에 한계가 있다'고 명시하고, ③ check_research_policy로 리서치 가능 여부를 확인한 뒤 "
    "가능하면 propose_research로 리서치를 제안하라(불가하면 그 사유를 안내).\n"
    "4. 사용자가 리서치/조사 수행을 원하면 check_research_policy 확인 후 propose_research를, "
    "보고서/리포트 생성을 원하면 propose_report를 호출하라. 이 도구들은 제안만 할 뿐 실제로 "
    "실행하지 않는다(사용자 동의 후 별도 처리).\n"
    "5. 보유 데이터가 있는 대상에 대한 일반 질의인데 답변 관점(비즈니스/시스템/둘다)이 "
    "주어지지 않았다면, 답변을 작성하지 말고 request_perspective를 호출하라. "
    "컨텍스트에 '[관점]'이 주어졌으면 그 관점으로 바로 답하라."
)


def _agent_system(perspective: Optional[str]) -> str:
    """에이전트 시스템 프롬프트 조립 — 기본 톤 + tool 규칙 + 보유 목록 + senario.md 틀."""
    countries = storage_resolver.list_countries()
    regions = storage_resolver.list_regions()
    owned = (
        "\n\n[현재 보유 데이터] "
        f"국가({len(countries)}): {', '.join(c.code for c in countries) or '없음'} / "
        f"권역: {', '.join(r.code for r in regions) or '없음'}"
    )
    system = _BASE_SYSTEM + _TOOL_RULES + owned
    if perspective:
        system += (
            f"\n\n이번 답변은 '{_PERSPECTIVE_LABEL.get(perspective, perspective)}' "
            "관점에 집중해 답하라."
        )
    scenario = chatbot_flow.load_scenario()
    if scenario:
        system += f"\n\n[챗봇 시나리오]\n{scenario}"
    return system


def _build_messages(req: ChatRequest) -> list:
    """history + 현재 질문 → Anthropic messages 배열. 관점·멤버 힌트를 현재 질문에 주입."""
    messages: list = []
    for turn in req.history or []:
        messages.append({"role": turn.role, "content": turn.content})
    hints: List[str] = []
    if req.perspective:
        hints.append(f"[관점] {_PERSPECTIVE_LABEL.get(req.perspective, req.perspective)}")
    if req.member_codes:
        hints.append(f"[멤버 후보] {', '.join(c.upper() for c in req.member_codes)}")
    content = req.message if not hints else f"{chr(10).join(hints)}\n\n{req.message}"
    messages.append({"role": "user", "content": content})
    return messages


# ── tool_trace → ChatResponse 결정적 조립 ───────────────────────────
def _last_lookup(trace: List[dict]) -> Optional[dict]:
    """trace에서 마지막으로 성공한 lookup_target 결과(error 없는)를 반환."""
    for t in reversed(trace):
        if t["name"] == "lookup_target":
            r = t.get("result") or {}
            if not r.get("error") and r.get("target_id"):
                return r
    return None


def _blocked_suffix() -> str:
    return " 보유 중인 국가 정보로만 답변드릴 수 있어요."


def _assemble(trace: List[dict], final_text: str, req: ChatRequest) -> ChatResponse:
    """tool_trace + 최종 답변 → ChatResponse. 정책·관점 게이트를 결정적으로 적용.

    우선순위: 보고서 제안 > 리서치 제안 > 관점 되묻기 > 일반 답변(qa).
    트리거 허용 여부는 research_policy로 재검증(LLM 판단 무시)."""
    names = {t["name"] for t in trace}
    lookup = _last_lookup(trace)
    # 이번 턴에 구체적 대상을 식별하지 못했고(LLM이 list_available로 "어떤 국가/권역?"을
    # 되묻는 중), 리서치/보고서 제안도 없는 경우다. 이때 직전 기본 대상(req.target_id, 예: 초기
    # ES)을 대상으로 삼아 관점 게이트를 걸면, 사용자가 아직 대상도 답하지 않았는데 "어떤 관점?"으로
    # 되물어 되묻기 답변 말풍선이 사라지는 버그가 생긴다(senario.md 탐색 진입). 이 경우 LLM의
    # 되묻기 답변을 그대로 흘리고 perspective·actions 게이트를 적용하지 않는다.
    asked_to_choose = (
        lookup is None
        and "list_available" in names
        and "propose_research" not in names
        and "propose_report" not in names
    )
    if lookup:
        domain = lookup["domain"]
        target = lookup["target_id"]
        exists = bool(lookup.get("exists"))
        has_report = bool(lookup.get("has_report"))
    else:
        # lookup 없음 — 프론트가 보낸 직전 대상 유지(대화 연속성).
        domain = req.domain
        target = req.target_id.upper()
        exists = storage_resolver.research_exists(domain, target)
        has_report = storage_resolver.latest_report_id(domain, target) is not None

    resp = ChatResponse(
        resolved_domain=domain,
        resolved_target_id=target,
        exists=exists,
        has_report=has_report,
    )

    # ── 보고서 생성 제안 ──
    if "propose_report" in names:
        if exists:
            resp.intent = "report"
            resp.needs_report = True
            resp.auto_trigger = True
            resp.research_suggestion = (
                f"{target} 진단 보고서를 {'재생성' if has_report else '생성'}합니다."
            )
            resp.actions = ["re_report" if has_report else "report"]
            return resp
        # 미보유 → 보고서 전에 리서치 필요.
        allowed, reason = research_policy.research_allowed(domain, target)
        resp.intent = "research"
        if allowed:
            resp.needs_research = True
            resp.research_suggestion = (
                f"{target} 보유 데이터가 없어 보고서를 만들 수 없습니다. 먼저 리서치를 진행할까요?"
            )
            resp.actions = ["research"]
        else:
            resp.research_suggestion = (reason or f"'{target}'는 리서치할 수 없습니다.") + _blocked_suffix()
        return resp

    # ── 리서치 수행 제안 ──
    if "propose_research" in names:
        allowed, reason = research_policy.research_allowed(domain, target)
        resp.intent = "research"
        if not allowed:
            # 정책 거부 — 잠정답(있으면) 유지하고 거절 사유 안내.
            resp.research_suggestion = (reason or f"'{target}'는 리서치할 수 없습니다.") + _blocked_suffix()
            if final_text:
                resp.answer = final_text
            return resp
        resp.needs_research = True
        if exists:
            resp.auto_trigger = True  # 보유국 재리서치 = 명시 요청 → 즉시 트리거.
            resp.research_suggestion = f"{target} 리서치를 재수행합니다."
            resp.actions = ["re_research"] if domain == "country" else []
        else:
            resp.research_suggestion = "외부 리서치를 진행할까요?"
            resp.actions = ["research"]
        return resp

    # ── 대상 되묻기(탐색 진입) ──
    # 이번 턴에 대상을 식별하지 못했고 LLM이 list_available로 "어떤 국가/권역?"을 되묻는 중이면,
    # 스테일한 기본 대상(req.target_id)에 관점 게이트를 걸지 말고 되묻기 답변을 그대로 흘린다.
    # (안 그러면 사용자가 대상도 답하기 전에 "어떤 관점?"으로 되물어 답변 말풍선이 사라진다.)
    if asked_to_choose:
        resp.intent = "qa"
        resp.answer = final_text or None
        return resp

    # ── 관점 되묻기(결정적 게이트, senario.md Case2/3) ──
    # 보유 대상 qa인데 관점 미지정이면 답변 전에 되묻는다(LLM이 request_perspective를
    # 안 불렀어도 강제). 답변은 싣지 않는다.
    if exists and not req.perspective:
        resp.intent = "qa"
        resp.needs_perspective = True
        resp.research_suggestion = _PERSPECTIVE_QUESTION
        return resp

    # ── 일반 답변(qa) ──
    resp.intent = "qa"
    resp.answer = final_text or None
    if exists:
        resp.actions = _qa_actions(domain, True, has_report)
    return resp


# ── 후속 추천 질문(senario.md 틀 안) ───────────────────────────────
def _generate_followups(domain: str, target_id: str, answer: str) -> List[str]:
    """보유 대상 qa 답변에 이어질 후속 질문 2~3개를 경량 생성. 실패 시 [](회귀 없음).

    senario.md 틀 안에서만 제안하도록 _suggestion_directive를 프롬프트에 주입한다.
    답변 스트림 품질 보존을 위해 답변 생성과 분리된 별도 경량 호출."""
    try:
        prompt = (
            f"방금 '{target_id}'({domain})에 대해 아래와 같이 답했다:\n{answer}\n\n"
            "사용자가 이어서 물어볼 만한 짧은 후속 질문 2~3개를, 사용자가 그대로 보내도 "
            "말이 되는 1인칭 질문 형태로 한 줄에 하나씩만 출력하라(번호·기호·설명 없이)."
        )
        text = bedrock_client.generate_text(prompt, system=_suggestion_directive())
        lines = [ln.strip(" -•\t") for ln in (text or "").splitlines() if ln.strip()]
        return lines[:3]
    except Exception as exc:  # noqa: BLE001 — 후속칩 실패는 무시(답변은 이미 전달됨).
        _log.warning("후속칩 생성 실패(생략): %s", exc)
        return []


def _attach_followups(resp: ChatResponse) -> None:
    """qa + 보유 + 답변 있음일 때만 후속칩을 단다(관점 되묻기·트리거 응답엔 안 단다)."""
    if (
        resp.intent == "qa"
        and resp.exists
        and resp.answer
        and not resp.needs_perspective
        and resp.resolved_domain
        and resp.resolved_target_id
    ):
        resp.suggested_prompts = _generate_followups(
            resp.resolved_domain, resp.resolved_target_id, resp.answer
        )


# ── 진입점: 동기 / 스트림 ───────────────────────────────────────────
def handle_agent(req: ChatRequest) -> ChatResponse:
    """챗봇 1턴 처리(동기) — tool-use 에이전트 루프 → ChatResponse.

    POST /api/chat가 호출. 스트림(POST /api/chat/stream)과 같은 엔진·게이트를 공유하되
    최종 답변을 한 번에 반환한다(스트림 미지원 클라이언트 폴백)."""
    system = _agent_system(req.perspective)
    messages = _build_messages(req)
    final_text, trace = bedrock_client.run_agent(
        messages, chat_tools.TOOLS, system, chat_tools.execute_tool, stop_on=_STOP_TOOLS
    )
    resp = _assemble(trace, final_text, req)
    _attach_followups(resp)
    return resp


def stream_agent(req: ChatRequest):
    """챗봇 1턴 처리(스트림) — bedrock_client.stream_agent 이벤트를 그대로 중계하는 제너레이터.

    yield하는 이벤트(라우터가 SSE 프레임으로 직렬화):
      {"type": "status", "tool": <name>}   — 도구 호출 중(분석 표시)
      {"type": "token", "text": <delta>}   — 답변 토큰(타이핑 효과)
      {"type": "reset"}                     — 도구 preamble 토큰 폐기 신호(버블 비움)
      {"type": "done", "response": <ChatResponse dict>}  — 종료(플래그·칩)

    관점 되묻기(needs_perspective)면 답변 토큰을 흘리지 않는다 — request_perspective가
    stop_on으로 루프를 답변 전에 멈추기 때문. 만약 토큰이 일부 새어도 done의 플래그가
    최종 결정이며, 프론트가 done에서 버블을 정리한다."""
    system = _agent_system(req.perspective)
    messages = _build_messages(req)
    final_text = ""
    trace: List[dict] = []
    for ev in bedrock_client.stream_agent(
        messages, chat_tools.TOOLS, system, chat_tools.execute_tool, stop_on=_STOP_TOOLS
    ):
        if ev["type"] == "token":
            yield {"type": "token", "text": ev["text"]}
        elif ev["type"] == "reset":
            yield {"type": "reset"}
        elif ev["type"] == "status":
            yield {"type": "status", "tool": ev["tool"]}
        elif ev["type"] == "final":
            final_text = ev.get("text", "")
            trace = ev.get("trace", [])
    resp = _assemble(trace, final_text, req)
    _attach_followups(resp)
    yield {"type": "done", "response": resp.model_dump()}


# ── 보존·재사용 헬퍼 (기존 동작 유지) ───────────────────────────────
def _qa_actions(domain: str, exists: bool, has_report: bool) -> List[str]:
    """보유 대상 qa 답변에 함께 노출할 선택지(상세요약/리서치 재수행/보고서).

    정책: 권역(region)은 재리서치를 제공하지 않는다(권역 리서치 전면 제외).
    국가는 보유국이므로 재리서치 허용."""
    if not exists:
        return []
    actions = ["summary"]
    if domain == "country":
        actions.append("re_research")  # 보유국 재리서치 허용
    actions.append("re_report" if has_report else "report")
    return actions


def _suggestion_directive() -> str:
    """후속 추천칩 생성 지침 — senario.md 케이스·관점·보고서 틀 안에서만 제안하도록 제약."""
    scenario = chatbot_flow.load_scenario()
    base = (
        "너는 글로벌 오토파이낸스 진출 진단 서비스 챗봇의 후속 질문 제안기다. "
        "후속 질문은 챗봇 시나리오의 케이스·관점(비즈니스/시스템/Both)·보고서 흐름 안에서, "
        "지금 다루는 대상 국가/권역에 대해 자연스럽게 더 깊이 들어가는 짧은 질문이어야 한다. "
        "시나리오 밖 주제는 제안하지 마라."
    )
    if scenario:
        base += f"\n\n[챗봇 시나리오]\n{scenario}"
    return base


def ask_for_target() -> ChatResponse:
    """대상 국가를 식별하지 못했을 때 되묻는 응답(임의 답변 금지). 보유 목록 안내.

    에이전트가 list_available로 대화 중 처리하므로 평소엔 쓰이지 않으나, 라우터의
    방어적 폴백 경로를 위해 보존한다."""
    countries = storage_resolver.list_countries()
    names = ", ".join((c.name_ko or c.name) for c in countries) or "(없음)"
    return ChatResponse(
        intent="qa",
        exists=False,
        answer=(
            "어느 국가에 대해 알려드릴까요? 국가명을 말씀해 주시면 진단을 도와드립니다.\n\n"
            f"현재 보유 중인 국가 데이터: {names}\n"
            "목록에 없는 국가는 리서치를 통해 새로 조사할 수 있어요."
        ),
    )
