"""챗봇 에이전트 분기 통합 테스트 — tool_trace → ChatResponse 게이트(Bedrock 미호출)·422.

실 Bedrock 호출 없이 결정적 게이트(_assemble)와 입력 검증(422)만 검증한다. 대상 식별·답변
생성은 LLM tool-use에 의존하므로, 여기서는 tool_trace를 직접 주입해 플래그 조립 규칙
(정책·관점·트리거)을 검증한다. handle_agent 경로는 run_agent를 monkeypatch해 확인한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.schemas import ChatRequest  # noqa: E402
from api.services import bedrock_client, chatbot  # noqa: E402


def _req(message, domain="country", target_id="ES", perspective=None):
    return ChatRequest(
        domain=domain, target_id=target_id, message=message, perspective=perspective
    )


def _lookup(target_id, exists, has_report, domain="country"):
    return {
        "name": "lookup_target",
        "input": {},
        "result": {
            "domain": domain,
            "target_id": target_id,
            "exists": exists,
            "has_report": has_report,
        },
    }


def _sig(name):
    return {"name": name, "input": {}, "result": {}}


# ── 입력 검증 (422) ─────────────────────────────────────────────────
def test_chat_endpoint_empty_message_422(client):
    r = client.post(
        "/api/chat", json={"domain": "country", "target_id": "ES", "message": "   "}
    )
    assert r.status_code == 422


def test_chat_endpoint_bad_target_422(client):
    r = client.post(
        "/api/chat",
        json={"domain": "country", "target_id": "toolong123", "message": "hi"},
    )
    assert r.status_code == 422


# ── 관점 되묻기 게이트 (senario.md Case2/3) ─────────────────────────
def test_qa_existing_asks_perspective_first():
    # 보유국 일반 질의 + 관점 미선택 → 답변 전에 관점 되묻기(결정적 게이트).
    trace = [_lookup("ES", True, True)]
    resp = chatbot._assemble(trace, "스페인 답변", _req("ES 금리 어때?"))
    assert resp.intent == "qa"
    assert resp.needs_perspective is True
    assert resp.answer is None


def test_explore_without_target_streams_question_not_perspective():
    # 탐색 진입("진출 검토 국가/권역 조사") — 구체적 대상 없음 → LLM이 list_available로
    # 되묻는다. 스테일한 기본 대상(ES)에 관점 게이트를 걸지 말고 되묻기 답변을 그대로 흘려야 한다.
    trace = [_sig("list_available")]
    resp = chatbot._assemble(
        trace, "어떤 국가나 권역을 알려주시겠어요?", _req("진출을 검토 중인 국가나 권역을 조사하고 싶어요.")
    )
    assert resp.intent == "qa"
    assert resp.needs_perspective is False
    assert resp.answer == "어떤 국가나 권역을 알려주시겠어요?"


def test_explore_without_target_no_list_available_still_reasks():
    # 회귀: 모델이 list_available를 안 부르고 곧장 끝내도(또는 무진전 조기 종료), 스테일한
    # 기본 대상(ES)에 관점 게이트를 걸지 말고 되묻기 답변을 흘려야 한다. 과거엔 list_available
    # 호출이 없으면 가드가 풀려 "어떤 관점?"이 바로 나왔다.
    resp = chatbot._assemble(
        [], "어떤 국가/권역을 조사할까요?", _req("진출 검토 중인 국가나 권역을 조사하고 싶어요.")
    )
    assert resp.needs_perspective is False
    assert resp.answer == "어떤 국가/권역을 조사할까요?"
    # 대상 미정 → stale 기본 대상을 다음 턴에 물려주지 않는다.
    assert resp.resolved_target_id is None


def test_explore_without_target_empty_text_falls_back_to_ask():
    # 무진전 조기 종료로 최종 텍스트가 비어도 결정적 되묻기 문구로 폴백(빈 말풍선 방지).
    resp = chatbot._assemble([], "", _req("조사 좀 하고 싶은데요"))
    assert resp.needs_perspective is False
    assert resp.answer  # 비어 있지 않아야 한다.


def test_grounded_summary_without_lookup_resolves_target():
    # lookup_target 없이 get_research_summary(found=true)로 답한 경우 → 그 대상으로 확정.
    # 관점 미지정이면 그 대상(EU)에 대해 관점 되묻기가 정상 작동해야 한다(stale ES 아님).
    trace = [
        {
            "name": "get_research_summary",
            "input": {"domain": "region", "target_id": "EU"},
            "result": {"found": True, "summary": "..."},
        }
    ]
    resp = chatbot._assemble(trace, "유럽 답변", _req("유럽 권역 퀵윈 알려줘", domain="region", target_id="ES"))
    assert resp.resolved_target_id == "EU"
    assert resp.resolved_domain == "region"
    assert resp.needs_perspective is True  # 관점 미지정 → 되묻기.


def test_qa_existing_with_perspective_returns_answer_and_actions():
    # 보유국 + 관점 지정 → 데이터 답변 + 선택지 칩(요약/재리서치/보고서).
    trace = [_lookup("ES", True, True)]
    resp = chatbot._assemble(trace, "답변입니다.", _req("ES 금리 어때?", perspective="business"))
    assert resp.intent == "qa"
    assert resp.answer == "답변입니다."
    assert "summary" in resp.actions
    assert "re_research" in resp.actions
    assert "re_report" in resp.actions  # ES는 보고서 보유 → re_report.


# ── 리서치 제안 게이트 (정책 재검증) ────────────────────────────────
def test_research_existing_auto_triggers():
    # 보유국 리서치 재수행 제안 → 즉시 트리거(auto_trigger).
    trace = [_lookup("ES", True, True), _sig("propose_research")]
    resp = chatbot._assemble(trace, "", _req("ES 리서치 다시 해줘"))
    assert resp.needs_research is True
    assert resp.auto_trigger is True
    assert resp.actions == ["re_research"]


def test_research_country_outside_region_blocked():
    # 보유 권역 밖 국가(KE=아프리카) 리서치 제안 → 정책상 차단(needs_research False).
    trace = [_lookup("KE", False, False), _sig("propose_research")]
    resp = chatbot._assemble(trace, "케냐 잠정답", _req("케냐 리서치", target_id="KE"))
    assert resp.needs_research is False
    assert resp.research_suggestion  # 거절 사유 안내.


def test_research_region_blocked():
    # 권역 신규 리서치는 전면 제외 → needs_research False.
    trace = [_lookup("AF", False, False, domain="region"), _sig("propose_research")]
    resp = chatbot._assemble(trace, "", _req("아프리카 리서치", domain="region", target_id="AF"))
    assert resp.needs_research is False
    assert "research" not in resp.actions


def test_research_missing_in_owned_region_offers_confirm():
    # 보유 권역(EU) 내 미보유국(DE) 리서치 제안 → 확인 칩(auto 아님).
    trace = [_lookup("DE", False, False), _sig("propose_research")]
    resp = chatbot._assemble(trace, "", _req("DE 리서치", target_id="DE"))
    assert resp.needs_research is True
    assert resp.auto_trigger is False
    assert resp.actions == ["research"]


# ── 보고서 제안 게이트 ──────────────────────────────────────────────
def test_report_existing_auto_triggers():
    trace = [_lookup("ES", True, True), _sig("propose_report")]
    resp = chatbot._assemble(trace, "", _req("ES 보고서 생성해줘"))
    assert resp.needs_report is True
    assert resp.auto_trigger is True
    assert resp.actions == ["re_report"]


def test_report_missing_needs_research_first():
    # 보유 권역 내 미보유국(DE) 보고서 요청 → 보고서 전 리서치 제안.
    trace = [_lookup("DE", False, False), _sig("propose_report")]
    resp = chatbot._assemble(trace, "", _req("DE 보고서 만들어줘", target_id="DE"))
    assert resp.needs_report is False
    assert resp.needs_research is True
    assert resp.actions == ["research"]


def test_report_outside_region_blocked():
    trace = [_lookup("KE", False, False), _sig("propose_report")]
    resp = chatbot._assemble(trace, "", _req("KE 보고서", target_id="KE"))
    assert resp.needs_report is False
    assert resp.needs_research is False


# ── handle_agent 경로 (run_agent monkeypatch) ───────────────────────
def test_handle_agent_assembles_from_trace(monkeypatch):
    # run_agent를 가짜 trace로 대체 → handle_agent가 게이트를 적용하는지 확인.
    trace = [_lookup("ES", True, True), _sig("propose_report")]
    monkeypatch.setattr(bedrock_client, "run_agent", lambda *a, **k: ("", trace))
    resp = chatbot.handle_agent(_req("ES 보고서 만들어줘"))
    assert resp.intent == "report"
    assert resp.needs_report is True
    assert resp.auto_trigger is True
    assert resp.resolved_target_id == "ES"


# ── 에이전트 루프 무진전(중복 도구 호출) 조기 종료 (6번 반복 버그) ──────
class _Block:
    def __init__(self, type, text=None, name=None, id=None, input=None):
        self.type = type
        self.text = text
        self.name = name
        self.id = id
        self.input = input


class _Msg:
    def __init__(self, content, stop_reason):
        self.content = content
        self.stop_reason = stop_reason


class _Stream:
    def __init__(self, msg):
        self._msg = msg
        self.text_stream = []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def get_final_message(self):
        return self._msg


class _FakeMessages:
    """매 호출 같은 tool_use(같은 name+input)를 돌려주는 가짜 — 무진전 상황 재현."""

    def __init__(self):
        self.calls = 0

    def stream(self, **kwargs):
        self.calls += 1
        msg = _Msg(
            [
                _Block("text", text="조사를 진행할까요?"),
                _Block("tool_use", name="list_available", id=f"t{self.calls}", input={"kind": "both"}),
            ],
            stop_reason="tool_use",
        )
        return _Stream(msg)


class _FakeClient:
    def __init__(self):
        self.messages = _FakeMessages()


def test_run_agent_stops_on_no_progress(monkeypatch):
    # 같은 도구를 같은 인자로 반복 호출하면 max_iters(6)까지 돌지 말고 조기 종료해야 한다.
    fake = _FakeClient()
    monkeypatch.setattr(bedrock_client, "get_client", lambda: fake)
    text, trace = bedrock_client.run_agent(
        [{"role": "user", "content": "조사하고 싶어요"}],
        tools=[],
        system="sys",
        tool_executor=lambda name, inp: {"ok": True},
        max_iters=6,
    )
    # 첫 턴은 실행(seen에 등록), 둘째 턴이 동일 호출이라 조기 종료 → 호출 2회로 끝나야 한다.
    assert fake.messages.calls == 2
    assert text == "조사를 진행할까요?"
    assert len(trace) == 1  # 도구는 한 번만 실제 실행됨.
