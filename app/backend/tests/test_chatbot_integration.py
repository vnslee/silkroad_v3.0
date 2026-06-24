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
