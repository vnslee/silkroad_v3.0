"""AgentCore Gateway WebSearch 클라이언트 — SigV4 서명 MCP(JSON-RPC) 호출.

Gateway는 us-east-1의 MCP 서버(HTTPS JSON-RPC)다. inbound auth가 AWS_IAM이므로
요청마다 SigV4(service=bedrock-agentcore, region=GATEWAY_REGION)로 서명한다 —
Cognito/OAuth 불필요(IAM 키만으로 cross-region 호출).

MCP 라이브러리를 쓰지 않고 requests + botocore SigV4Auth로 JSON-RPC를 직접 만든다
(의존성 0 추가). 오케스트레이션(research_agent)이 티어별 도메인 필터로 직접 호출하는
'선검색(Pattern B)' 경로이며, LLM은 이 도구를 자율 호출하지 않는다.
"""
from __future__ import annotations

import json
import threading
from typing import List, Optional

import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.session import Session as BotocoreSession

from .. import config

_log = config.get_logger("gateway_search")

# MCP 도구명. Gateway가 타깃별로 '<target>___<tool>' 네임스페이스를 붙이므로
# (예: 'WebSearch___WebSearch') 하드코딩하지 않고 tools/list에서 동적 해석한다.
_TOOL_NAME_HINT = "websearch"
_resolved_tool_name: Optional[str] = None
_tool_name_lock = threading.Lock()
# ⚠️ 확인됨(실측): first-party WebSearch 도구의 입력 스키마는 query·maxResults 뿐이며
# 도메인 필터 인자가 없다. 따라서 티어/도메인 강제는 검색이 아니라 호출측(credibility)에서
# 결과를 사후 필터링해 수행한다(아래 web_search의 allowed_domains 파라미터).
# 입력 제약(커넥터 명세): query ≤200자, maxResults 1~25.
_MAX_QUERY_LEN = 200
_MAX_RESULTS_CAP = 25
# cross-region(서울→us-east-1) HTTPS 타임아웃(초).
_HTTP_TIMEOUT = 30

# botocore credentials는 읽기 스레드세이프 — 모듈 1회 생성 후 공유.
_botocore_session = BotocoreSession()
_creds_lock = threading.Lock()
_credentials = None
_rpc_id = 0
_rpc_lock = threading.Lock()


class GatewaySearchError(RuntimeError):
    """Gateway 호출 실패(설정 누락·자격증명·HTTP·JSON-RPC error·파싱)."""


def _get_credentials():
    global _credentials
    if _credentials is None:
        with _creds_lock:
            if _credentials is None:
                creds = _botocore_session.get_credentials()
                if creds is None:
                    raise GatewaySearchError(
                        "AWS 자격증명 없음 — boto3 표준 체인(~/.aws/credentials 등) 확인"
                    )
                _credentials = creds
    return _credentials


def _next_rpc_id() -> int:
    global _rpc_id
    with _rpc_lock:
        _rpc_id += 1
        return _rpc_id


def _gateway_url() -> str:
    if not config.GATEWAY_SEARCH_URL:
        raise GatewaySearchError(
            "GATEWAY_SEARCH_URL 미설정 — provision_gateway.py 출력 env를 export 했는지 확인"
        )
    # AgentCore Gateway의 MCP(JSON-RPC) 엔드포인트는 /mcp 경로다. 루트로 보내면
    # UnknownOperationException이 난다. URL에 경로가 없으면 /mcp를 보장한다.
    url = config.GATEWAY_SEARCH_URL.rstrip("/")
    if not url.endswith("/mcp"):
        url += "/mcp"
    return url


def _signed_post(payload: dict) -> dict:
    """JSON-RPC payload를 SigV4 서명해 Gateway에 POST → JSON-RPC 결과(dict) 반환."""
    url = _gateway_url()
    body = json.dumps(payload)
    req = AWSRequest(
        method="POST",
        url=url,
        data=body,
        # MCP streamable HTTP는 SSE 응답도 허용 — Accept에 두 타입 모두 명시.
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
    )
    # service name은 bedrock-agentcore, region은 게이트웨이 리전(us-east-1).
    SigV4Auth(_get_credentials(), "bedrock-agentcore", config.GATEWAY_REGION).add_auth(req)
    try:
        resp = requests.post(
            url, data=body, headers=dict(req.headers), timeout=_HTTP_TIMEOUT
        )
    except requests.RequestException as exc:
        raise GatewaySearchError(f"Gateway HTTP 호출 실패: {exc}") from exc
    if resp.status_code >= 400:
        raise GatewaySearchError(
            f"Gateway HTTP {resp.status_code}: {resp.text[:300]}"
        )
    try:
        envelope = resp.json()
    except ValueError as exc:
        raise GatewaySearchError(f"Gateway 응답 JSON 파싱 실패: {resp.text[:300]}") from exc
    if isinstance(envelope, dict) and envelope.get("error"):
        raise GatewaySearchError(f"JSON-RPC error: {envelope['error']}")
    return envelope.get("result", {}) if isinstance(envelope, dict) else {}


def _rpc(method: str, params: Optional[dict] = None) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": _next_rpc_id(),
        "method": method,
        "params": params or {},
    }
    return _signed_post(payload)


def list_tools() -> List[dict]:
    """MCP tools/list — 게이트웨이가 노출하는 도구 목록(스모크 테스트용)."""
    result = _rpc("tools/list")
    tools = result.get("tools")
    return tools if isinstance(tools, list) else []


def _resolve_tool_name() -> str:
    """tools/list에서 WebSearch 도구의 실제 이름을 해석(1회 캐시).

    Gateway 네임스페이스 접두사('<target>___WebSearch')를 흡수한다. 이름에 'websearch'가
    포함된 첫 도구를 채택하고, 없으면 단일 도구일 때 그걸 쓴다.
    """
    global _resolved_tool_name
    if _resolved_tool_name is None:
        with _tool_name_lock:
            if _resolved_tool_name is None:
                tools = list_tools()
                names = [t.get("name", "") for t in tools if t.get("name")]
                match = next(
                    (n for n in names if _TOOL_NAME_HINT in n.lower()), None
                )
                if match is None and len(names) == 1:
                    match = names[0]
                if match is None:
                    raise GatewaySearchError(
                        f"WebSearch 도구를 찾지 못함(tools/list={names})"
                    )
                _resolved_tool_name = match
    return _resolved_tool_name


def web_search(
    query: str,
    *,
    max_results: int = 10,
    allowed_domains: Optional[List[str]] = None,
) -> List[dict]:
    """WebSearch 커넥터 호출 → 정규화된 출처 리스트.

    각 출처: {"title", "url", "snippet", "published_date"}. 빈 결과면 빈 리스트.

    allowed_domains가 주어지면 **사후 필터링**으로 해당 도메인 결과만 남긴다(도구 자체는
    도메인 필터 인자를 지원하지 않으므로 — 위 주석 참조). 필터로 다 걸러질 수 있으니,
    티어 강제가 필요한 호출측은 max_results를 넉넉히 줘 검색 폭을 확보하는 게 좋다.
    """
    q = (query or "").strip()[:_MAX_QUERY_LEN]
    if not q:
        return []
    n = max(1, min(int(max_results), _MAX_RESULTS_CAP))
    arguments = {"query": q, "maxResults": n}
    result = _rpc(
        "tools/call", {"name": _resolve_tool_name(), "arguments": arguments}
    )
    rows = _parse_mcp_content(result)
    if allowed_domains:
        rows = [r for r in rows if _host_in(r.get("url", ""), allowed_domains)]
    return rows


def _host_in(url: str, domains: List[str]) -> bool:
    """url 호스트가 domains 중 하나의 접미사 매치인지(사후 도메인 필터)."""
    from urllib.parse import urlparse

    if not url:
        return False
    host = (urlparse(url if "://" in url else f"//{url}").netloc or "").lower()
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    for d in domains:
        d = (d[2:] if d.startswith("*.") else d).lower()
        if host == d or host.endswith("." + d):
            return True
    return False


def _parse_mcp_content(result: dict) -> List[dict]:
    """MCP tools/call 결과 → 정규화 출처 리스트(방어적).

    MCP 결과 shape 편차를 흡수한다:
      - result.structuredContent (구조화 배열/객체)
      - result.content = [{"type":"text","text": "<JSON 또는 산문>"}, ...]
        · text가 JSON(results 배열/객체)이면 파싱, 아니면 snippet으로 취급.
    옵션 필드 누락에 예외를 던지지 않는다.
    """
    if not isinstance(result, dict):
        return []

    # 1) 구조화 콘텐츠 우선.
    structured = result.get("structuredContent")
    rows = _coerce_rows(structured)

    # 2) content 블록 순회.
    if not rows:
        for block in result.get("content") or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text" and block.get("text"):
                parsed = _try_json(block["text"])
                if parsed is not None:
                    rows.extend(_coerce_rows(parsed))
                else:
                    # JSON 아님 — 단일 텍스트 스니펫.
                    rows.append({"snippet": block["text"]})
            elif block.get("type") in ("json", "resource") and block.get("json"):
                rows.extend(_coerce_rows(block["json"]))

    out: List[dict] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                "title": _first(r, "title", "name", "heading") or "",
                "url": _first(r, "url", "link", "uri", "source") or "",
                "snippet": _first(r, "snippet", "text", "summary", "description", "content")
                or "",
                "published_date": _first(r, "published_date", "publishedDate", "pub_date", "date")
                or "",
            }
        )
    return out


def _coerce_rows(obj) -> List:
    """구조화 객체에서 결과 배열을 끄집어낸다(results/items/data 키 또는 자체가 배열)."""
    if obj is None:
        return []
    if isinstance(obj, list):
        return list(obj)
    if isinstance(obj, dict):
        for key in ("results", "items", "data", "webSearchResults", "documents"):
            v = obj.get(key)
            if isinstance(v, list):
                return list(v)
        # 단일 결과 객체로 보이면 그대로 1행.
        if any(k in obj for k in ("url", "link", "title")):
            return [obj]
    return []


def _try_json(text: str):
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None


def _first(d: dict, *keys: str):
    for k in keys:
        v = d.get(k)
        if v:
            return v
    return None
