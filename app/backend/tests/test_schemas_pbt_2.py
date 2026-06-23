"""PBT-02 (2차) — 신규 모델 직렬화 라운드트립.

property: model_validate(model_dump(x)) == x  (Chat*·ResearchTriggerRequest)
"""
from __future__ import annotations

import sys
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.schemas import (  # noqa: E402
    ChatRequest,
    ChatResponse,
    ChatTurn,
    ResearchTriggerRequest,
)
from tests.strategies import chat_roles, domains, member_codes, target_ids  # noqa: E402

opt_str = st.one_of(st.none(), st.text(max_size=20))

chat_turns = st.builds(
    ChatTurn, role=chat_roles, content=st.text(max_size=40)
)


@given(member_codes=member_codes, segment=opt_str)
def test_research_trigger_roundtrip(member_codes, segment):
    x = ResearchTriggerRequest(member_codes=member_codes, segment=segment)
    assert ResearchTriggerRequest.model_validate(x.model_dump()) == x


@given(role=chat_roles, content=st.text(max_size=40))
def test_chat_turn_roundtrip(role, content):
    x = ChatTurn(role=role, content=content)
    assert ChatTurn.model_validate(x.model_dump()) == x


@given(
    domain=domains,
    target_id=target_ids,
    message=st.text(min_size=1, max_size=60),
    history=st.one_of(st.none(), st.lists(chat_turns, max_size=4)),
    member_codes=st.one_of(st.none(), member_codes),
)
def test_chat_request_roundtrip(domain, target_id, message, history, member_codes):
    x = ChatRequest(
        domain=domain,
        target_id=target_id,
        message=message,
        history=history,
        member_codes=member_codes,
    )
    assert ChatRequest.model_validate(x.model_dump()) == x


@given(
    answer=opt_str,
    needs_research=st.booleans(),
    research_suggestion=opt_str,
    missing_codes=member_codes,
)
def test_chat_response_roundtrip(answer, needs_research, research_suggestion, missing_codes):
    x = ChatResponse(
        answer=answer,
        needs_research=needs_research,
        research_suggestion=research_suggestion,
        missing_codes=missing_codes,
    )
    assert ChatResponse.model_validate(x.model_dump()) == x
