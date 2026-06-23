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


def test_chat_no_data_country_needs_research(monkeypatch):
    # 존재하지 않는 국가 → needs_research, Bedrock 미호출
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("country", "ZZ", "진출 어때요?")
    assert resp.needs_research is True
    assert resp.answer is None
    assert resp.research_suggestion


def test_chat_no_data_region_asks_members(monkeypatch):
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("region", "ZZ", "권역 분석", member_codes=[])
    assert resp.needs_research is True
    assert "국가" in (resp.research_suggestion or "")


def test_chat_region_partial_missing(monkeypatch, client):
    # 권역 자체는 없지만 member 누락 분기 — needs_research + 미호출
    monkeypatch.setattr(bedrock_client, "generate_text", _fail_if_called)
    resp = chatbot.handle("region", "ZZ", "비교", member_codes=["ZZ"])
    assert resp.needs_research is True


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
