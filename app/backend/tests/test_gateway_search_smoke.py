"""실 Gateway WebSearch 스모크 — @pytest.mark.bedrock.

GATEWAY_SEARCH_URL + IAM 자격증명(us-east-1 cross-region)·게이트웨이 READY 필요.
기본 수집 제외(마커). 실행: pytest -m bedrock
provision_gateway.py로 게이트웨이를 만들고 env를 export한 뒤 실행한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import config  # noqa: E402
from api.services import credibility, gateway_search  # noqa: E402


@pytest.mark.bedrock
def test_list_tools_has_websearch():
    if not config.GATEWAY_SEARCH_URL:
        pytest.skip("GATEWAY_SEARCH_URL 미설정 — provision_gateway.py 후 env export 필요")
    tools = gateway_search.list_tools()
    names = {t.get("name") for t in tools}
    # Gateway가 '<target>___WebSearch'로 네임스페이스를 붙이므로 부분 매치로 확인.
    assert any("websearch" in (n or "").lower() for n in names), f"WebSearch 없음: {names}"
    # 동적 해석이 실제 도구명을 집어내는지.
    assert "websearch" in gateway_search._resolve_tool_name().lower()


@pytest.mark.bedrock
def test_web_search_returns_normalized_sources():
    if not config.GATEWAY_SEARCH_URL:
        pytest.skip("GATEWAY_SEARCH_URL 미설정")
    domains = credibility.allowed_domains("T1") + credibility.allowed_domains("T2")
    out = gateway_search.web_search(
        "Hyundai Capital auto finance Portugal market",
        max_results=3,
        allowed_domains=domains,
    )
    assert isinstance(out, list)
    if out:  # 결과가 있으면 정규화 키를 갖춰야 한다.
        first = out[0]
        assert set(first) >= {"title", "url", "snippet", "published_date"}
        assert first["url"]
