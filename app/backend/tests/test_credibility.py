"""신뢰도 티어·MCP 파싱·티어정책 유닛 테스트(네트워크 없음 — 기본 수집 포함)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.services import credibility, gateway_search, research_agent  # noqa: E402


# ── credibility: 도메인 → 티어 ──────────────────────────────────
def test_trust_tier_official_and_secondary():
    assert credibility.trust_tier_of("https://www.reuters.com/world/x") == "T2"
    assert credibility.tier_of_domain("https://reuters.com/x") == 2
    # 서브도메인 접미사 매칭(T1).
    assert credibility.trust_tier_of("https://data.ecb.europa.eu/y") == "T1"
    assert credibility.tier_of_domain("https://eba.europa.eu/z") == 1


def test_unknown_domain_is_none():
    assert credibility.trust_tier_of("https://some-random-blog.xyz/a") is None
    assert credibility.tier_of_domain("https://some-random-blog.xyz/a") is None


def test_citable_alone_t3_excluded():
    # T3(=정수 3) 단독 인용 금지, T1/T2 허용.
    assert credibility.is_citable_alone("T1") is True
    assert credibility.is_citable_alone("T2") is True
    assert credibility.is_citable_alone("T3") is False
    assert credibility.is_citable_alone(1) is True
    assert credibility.is_citable_alone(2) is True
    assert credibility.is_citable_alone(3) is False


def test_allowed_domains_strip_wildcard():
    t1 = credibility.allowed_domains("T1")
    # 선행 '*.' 제거된 bare 도메인.
    assert "gov" in t1
    assert all(not d.startswith("*.") for d in t1)


# ── gateway_search: MCP 결과 파싱(shape 편차 흡수) ──────────────
def test_parse_structured_content():
    res = {"structuredContent": {"results": [
        {"title": "T", "url": "http://x", "snippet": "s", "publishedDate": "2026-01-01"}
    ]}}
    out = gateway_search._parse_mcp_content(res)
    assert out == [{"title": "T", "url": "http://x", "snippet": "s",
                    "published_date": "2026-01-01"}]


def test_parse_json_in_text_block():
    res = {"content": [{"type": "text",
                        "text": '{"results":[{"title":"A","link":"http://y","summary":"z"}]}'}]}
    out = gateway_search._parse_mcp_content(res)
    assert out[0]["title"] == "A"
    assert out[0]["url"] == "http://y"
    assert out[0]["snippet"] == "z"


def test_parse_plain_text_and_empty():
    assert gateway_search._parse_mcp_content(
        {"content": [{"type": "text", "text": "plain"}]}
    ) == [{"title": "", "url": "", "snippet": "plain", "published_date": ""}]
    assert gateway_search._parse_mcp_content({}) == []


def test_host_in_postfilter():
    # WebSearch 도구가 도메인 필터를 지원하지 않아 사후 필터(_host_in)가 티어 강제를 담당.
    doms = ["gov.uk", "reuters.com", "*.europa.eu"]
    assert gateway_search._host_in("https://www.gov.uk/x", doms) is True
    assert gateway_search._host_in("https://www.reuters.com/y", doms) is True
    # 와일드카드/접미사 — 서브도메인 매치.
    assert gateway_search._host_in("https://data.ecb.europa.eu/z", doms) is True
    # gov.uk 패턴은 .gov 도메인(state.gov)을 매치하지 않는다(접미사 정확).
    assert gateway_search._host_in("https://www.state.gov/a", doms) is False
    assert gateway_search._host_in("https://random-blog.xyz/z", doms) is False
    assert gateway_search._host_in("", doms) is False


def test_gateway_url_appends_mcp(monkeypatch):
    # MCP 엔드포인트는 /mcp 경로 — 루트 URL이면 자동 보강.
    from api import config
    monkeypatch.setattr(config, "GATEWAY_SEARCH_URL", "https://gw.example.com")
    assert gateway_search._gateway_url() == "https://gw.example.com/mcp"
    monkeypatch.setattr(config, "GATEWAY_SEARCH_URL", "https://gw.example.com/mcp")
    assert gateway_search._gateway_url() == "https://gw.example.com/mcp"


# ── research_agent: 티어 정책(인용 보정 + T3 단독 FLAG) ─────────
def test_apply_tier_policy_corrects_and_flags():
    sources = [
        {"url": "https://reuters.com/a", "tier": 2},
        {"url": "https://en.wikipedia.org/b", "tier": 3},
    ]
    items = [
        {"item": "x", "source": "per https://reuters.com/a", "tier": 4},
        {"item": "y", "source": "only https://en.wikipedia.org/b", "tier": 1},
        {"item": "z", "source": "no url match", "tier": 2},
    ]
    out = research_agent._apply_tier_policy(items, sources)
    # T2 인용 → tier 2로 보정, FLAG 없음.
    assert out[0]["tier"] == 2
    assert "estimated" not in out[0]
    # T3 단독 인용 → tier 3 + FLAG.
    assert out[1]["tier"] == 3
    assert out[1]["estimated"] is True
    assert out[1]["so_what"] == "조사 필요"
    # 매칭 출처 없음 → 무변경.
    assert out[2]["tier"] == 2
    assert "estimated" not in out[2]
