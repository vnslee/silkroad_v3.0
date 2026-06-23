"""챗봇 분기 통합 테스트 — 데이터 없음=needs_research(Bedrock 미호출)·422.

실 Bedrock 호출 없이 분기 로직만 검증한다. 데이터 보유 분기는 Bedrock에 의존하므로
여기서는 '없음' 분기(needs_research)와 입력 검증(422)만 다룬다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.services import bedrock_client, chatbot  # noqa: E402


def _fail_if_called(*args, **kwargs):  # Bedrock 호출 감지용
    raise AssertionError("Bedrock이 호출되면 안 됨(데이터 없음 분기)")


def test_chat_no_data_country_in_region_needs_research(monkeypatch):
    # 보유 권역(EU) 내 미보유국(DE) → 리서치 제안, Bedrock 미호출.
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "DE", "진출 어때요?")
    assert resp.needs_research is True
    assert resp.answer is None
    assert resp.research_suggestion


def test_chat_country_outside_region_blocked(monkeypatch):
    # 보유 권역 밖 국가(NG=아프리카) → 정책상 리서치 차단(트리거 없음).
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "NG", "진출 어때요?")
    assert resp.needs_research is False
    assert resp.answer is None
    assert resp.actions == []
    assert resp.research_suggestion  # 거절 안내 문구


def test_chat_region_research_blocked(monkeypatch):
    # 권역 신규 리서치는 정책상 전면 제외 → needs_research False, 트리거 없음.
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("region", "ZZ", "권역 리서치 해줘", member_codes=[])
    assert resp.needs_research is False
    assert "research" not in resp.actions


def test_chat_endpoint_empty_message_422(client):
    r = client.post(
        "/api/chat",
        json={"domain": "country", "target_id": "ES", "message": "   "},
    )
    assert r.status_code == 422


def test_chat_endpoint_bad_target_422(client):
    r = client.post(
        "/api/chat",
        json={"domain": "country", "target_id": "toolong123", "message": "hi"},
    )
    assert r.status_code == 422


# ── 의도 분기 (qa / research / report) ───────────────────────────


def test_intent_detection():
    assert chatbot._detect_intent("독일 시장 어때?") == "qa"
    assert chatbot._detect_intent("스페인 보고서 만들어줘") == "report"
    assert chatbot._detect_intent("프랑스 리서치 다시 해줘") == "research"
    assert chatbot._detect_intent("이탈리아 진단 보고서 생성") == "report"


def test_report_intent_missing_data_needs_research(monkeypatch):
    # 보유 권역 내 미보유국(DE)에 보고서 요청 → 보고서 트리거 금지, 리서치 먼저 제안.
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "DE", "DE 보고서 만들어줘")
    assert resp.needs_report is False
    assert resp.needs_research is True
    assert resp.auto_trigger is False
    assert resp.actions == ["research"]


def test_report_intent_outside_region_blocked(monkeypatch):
    # 보유 권역 밖 국가(NG) 보고서 요청 → 리서치도 막혀 트리거 없음.
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "NG", "NG 보고서 만들어줘")
    assert resp.needs_report is False
    assert resp.needs_research is False
    assert resp.actions == []


def test_report_intent_existing_auto_triggers():
    # 보유국(ES)에 보고서 생성 명시 → 즉시 트리거(auto_trigger) + 보고서 존재 시 재생성.
    resp = chatbot.handle("country", "ES", "ES 보고서 생성해줘")
    assert resp.needs_report is True
    assert resp.auto_trigger is True
    assert resp.exists is True
    assert resp.has_report is True
    assert resp.actions == ["re_report"]


def test_research_intent_existing_auto_triggers():
    # 보유국 리서치 재수행 명시 → 즉시 트리거.
    resp = chatbot.handle("country", "ES", "ES 리서치 다시 해줘")
    assert resp.needs_research is True
    assert resp.auto_trigger is True
    assert resp.actions == ["re_research"]


def test_qa_existing_returns_actions(monkeypatch):
    # 보유국 일반 질의 → 내부 데이터로 답변 + 선택지 칩(상세요약/재리서치/보고서).
    monkeypatch.setattr(bedrock_client, "generate_text", lambda *a, **k: "답변입니다.")
    resp = chatbot.handle("country", "ES", "ES 금리 어때?")
    assert resp.intent == "qa"
    assert resp.answer == "답변입니다."
    assert "summary" in resp.actions
    assert "re_research" in resp.actions
    # ES는 보고서 보유 → re_report 노출.
    assert "re_report" in resp.actions


def test_qa_missing_no_answer_offers_research(monkeypatch):
    # 보유 권역 내 미보유국(DE) 일반 질의 → 임의 답변 금지, 리서치 의도 질의.
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "DE", "DE 금리 어때?")
    assert resp.answer is None
    assert resp.needs_research is True
    assert resp.auto_trigger is False
    assert resp.actions == ["research"]
