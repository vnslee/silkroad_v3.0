"""Bedrock 클라이언트 (C8, L2) — anthropic SDK Bedrock 래퍼.

자격증명은 boto3 표준 체인(SigV4) — 별도 API Key 불필요. 리전·모델·백엔드는 config.
백엔드 두 가지:
  - "mantle": AnthropicBedrockMantle(Messages-API Bedrock). `output_config.format` 구조화 출력 지원.
  - "legacy": AnthropicBedrock(bedrock-runtime InvokeModel). Mantle 엔드포인트 미가용 환경용.
    구조화 출력 미지원이라 프롬프트 JSON 계약 + 코드펜스 제거 파싱으로 폴백한다
    (country/region 리서치 프롬프트는 "순수 JSON만 출력"을 강제하므로 안전).
앱 레벨 재시도 없음(Q5=A) — SDK 기본 재시도(429/5xx 2회)만 사용.
"""
from __future__ import annotations

import json
import os
import re
import threading
from typing import List, Optional

from .. import config

_log = config.get_logger("bedrock_client")

# lazy 싱글톤 — import 시점에 SDK·자격증명을 건드리지 않는다(테스트 용이성).
_client = None
_client_lock = threading.Lock()

# ```json ... ``` 코드펜스 제거용(legacy 폴백 파싱).
_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


class BedrockError(RuntimeError):
    """Bedrock 호출 실패(네트워크·자격증명·throttle·파싱)."""


def get_client():
    """anthropic Bedrock 클라이언트 싱글톤. config.BEDROCK_BACKEND로 선택."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = _build_client()
    return _client


def _build_client():
    backend = config.BEDROCK_BACKEND
    try:
        if backend == "api":
            # first-party Anthropic API(웹검색 ✅). ANTHROPIC_API_KEY 필요.
            from anthropic import Anthropic

            if not config.ANTHROPIC_API_KEY:
                raise BedrockError(
                    "ANTHROPIC_API_KEY 미설정 — first-party API(api 백엔드) 사용 시 필수"
                )
            cli = Anthropic(api_key=config.ANTHROPIC_API_KEY)
        elif backend == "aws":
            # Claude Platform on AWS(Anthropic 운영). SigV4 + workspace_id.
            from anthropic import AnthropicAWS

            if not config.ANTHROPIC_AWS_WORKSPACE_ID:
                raise BedrockError(
                    "ANTHROPIC_AWS_WORKSPACE_ID 미설정 — Claude Platform on AWS 사용 시 필수"
                )
            cli = AnthropicAWS(
                aws_region=config.BEDROCK_REGION,
                workspace_id=config.ANTHROPIC_AWS_WORKSPACE_ID,
            )
        elif backend == "mantle":
            from anthropic import AnthropicBedrockMantle

            cli = AnthropicBedrockMantle(aws_region=config.BEDROCK_REGION)
        else:
            from anthropic import AnthropicBedrock

            cli = AnthropicBedrock(aws_region=config.BEDROCK_REGION)
    except ImportError as exc:  # pragma: no cover
        raise BedrockError(
            "anthropic SDK 미설치/미지원 — requirements.txt(anthropic[aws]) 확인"
        ) from exc
    _log.info("LLM 클라이언트 초기화: backend=%s region=%s", backend, config.BEDROCK_REGION)
    return cli


def _supports_output_config() -> bool:
    """구조화 출력(output_config.format) 사용 가능 백엔드인지."""
    return config.BEDROCK_BACKEND in ("api", "aws", "mantle")


# 웹검색 서버툴 정의(딥리서치). Opus 4.6+ 동적 필터링 변형.
# max_uses를 높여 항목별 다각도 fan-out 검색·교차검증을 허용(딥리서치 방법론).
_WEB_SEARCH_MAX_USES = int(os.environ.get("RESEARCH_WEB_SEARCH_MAX_USES", "20"))
_WEB_SEARCH_TOOL = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": _WEB_SEARCH_MAX_USES,
}
# 서버툴 루프가 pause_turn으로 멈출 때 재개 최대 횟수(딥리서치는 반복이 많아 여유 있게).
_MAX_CONTINUATIONS = 8


def generate_structured(
    prompt: str,
    json_schema: dict,
    system: Optional[str] = None,
    *,
    web_search: bool = False,
    effort: Optional[str] = None,
) -> dict:
    """구조화 출력 호출 → 마지막 파싱가능 text 블록 JSON 파싱 → dict.

    aws/mantle 백엔드는 output_config.format(json_schema)로 강제. legacy 백엔드는
    프롬프트의 "순수 JSON만" 계약에 의존하고 코드펜스를 제거해 파싱한다.
    web_search=True면 웹검색 서버툴을 붙여 외부 딥리서치를 수행한다(aws 백엔드 한정).
    서버툴 루프가 pause_turn으로 멈추면 messages를 재전송해 재개한다.
    streaming + get_final_message로 큰 출력의 HTTP 타임아웃을 피한다.
    """
    client = get_client()

    use_web = web_search and config.web_search_supported()
    if web_search and not use_web:
        _log.warning(
            "web_search 요청됐으나 backend=%s 미지원 — 웹검색 없이 진행",
            config.BEDROCK_BACKEND,
        )

    base_kwargs: dict = {
        "model": config.BEDROCK_MODEL,
        "max_tokens": config.RESEARCH_MAX_TOKENS,
    }
    if system:
        base_kwargs["system"] = system
    if use_web:
        base_kwargs["tools"] = [_WEB_SEARCH_TOOL]
    if effort and config.BEDROCK_BACKEND in ("api", "aws"):
        # 딥리서치: 높은 effort + adaptive thinking(웹검색 시 멀티스텝 추론).
        base_kwargs["output_config"] = {"effort": effort}
        base_kwargs["thinking"] = {"type": "adaptive"}
    if _supports_output_config() and not use_web:
        # 구조화 출력은 웹검색(citations) 경로와 충돌 가능 → 웹검색 시엔 프롬프트 JSON 계약에 의존.
        base_kwargs.setdefault("output_config", {})
        base_kwargs["output_config"]["format"] = {
            "type": "json_schema",
            "schema": json_schema,
        }

    messages: list = [{"role": "user", "content": prompt}]
    try:
        for _ in range(_MAX_CONTINUATIONS + 1):
            with client.messages.stream(messages=messages, **base_kwargs) as stream:
                message = stream.get_final_message()
            if getattr(message, "stop_reason", None) == "pause_turn":
                # 서버툴 반복 한도 — assistant 응답을 그대로 붙여 재개(추가 user 메시지 금지).
                messages = messages + [{"role": "assistant", "content": message.content}]
                continue
            break
    except Exception as exc:  # noqa: BLE001 — SDK 예외 다양(자격증명·throttle·네트워크)
        raise BedrockError(f"LLM 구조화 호출 실패: {exc}") from exc

    text = _last_json_text(message)
    if text is None:
        raise BedrockError("구조화 출력에 파싱 가능한 text 블록 없음")
    return _parse_json(text)


def _parse_json(text: str) -> dict:
    """순수 JSON 파싱. 실패 시 코드펜스 제거 후 재시도(legacy 폴백)."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        stripped = _FENCE_RE.sub("", text.strip())
        try:
            return json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise BedrockError(f"구조화 출력 JSON 파싱 실패: {exc}") from exc


def generate_text(
    message: str,
    system: Optional[str] = None,
    context: Optional[str] = None,
    history: Optional[List[dict]] = None,
) -> str:
    """챗봇용 자유 텍스트 호출(구조화 없음, Q4=A). 무상태(history는 인자 전달).

    간단한 답변이므로 CHAT_MODEL(Sonnet)을 쓴다 — 리서치·분류(generate_structured)는
    BEDROCK_MODEL(Opus) 유지.
    """
    client = get_client()
    messages: List[dict] = []
    for turn in history or []:
        messages.append({"role": turn["role"], "content": turn["content"]})
    user_content = message if not context else f"[참고 컨텍스트]\n{context}\n\n[질문]\n{message}"
    messages.append({"role": "user", "content": user_content})
    kwargs = {
        "model": config.CHAT_MODEL,
        "max_tokens": config.RESEARCH_MAX_TOKENS,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system
    try:
        with client.messages.stream(**kwargs) as stream:
            msg = stream.get_final_message()
    except Exception as exc:  # noqa: BLE001
        raise BedrockError(f"Bedrock 텍스트 호출 실패: {exc}") from exc
    text = _first_text(msg)
    if text is None:
        raise BedrockError("텍스트 응답에 text 블록 없음")
    return text


def generate_text_with_suggestions(
    message: str,
    system: Optional[str] = None,
    context: Optional[str] = None,
    history: Optional[List[dict]] = None,
    max_suggestions: int = 3,
) -> tuple:
    """챗봇 답변 + 후속 추천 질문을 한 번의 호출로 생성 → (answer, [suggested_prompts]).

    generate_text와 같은 CHAT_MODEL(Sonnet)·메시지 구성을 쓰되, 출력만 {answer,
    suggested_prompts} 구조로 받는다(추가 LLM 호출 없음). 구조화 출력 지원 백엔드
    (api/aws/mantle)는 output_config.format으로 강제하고, legacy는 프롬프트 JSON 계약 +
    코드펜스 제거 파싱으로 폴백한다. 어떤 단계든 실패하면 (원문 텍스트, []) 폴백 —
    후속칩이 없을 뿐 답변은 항상 살아남는다(회귀 없음)."""
    client = get_client()
    messages: List[dict] = []
    for turn in history or []:
        messages.append({"role": turn["role"], "content": turn["content"]})
    user_content = message if not context else f"[참고 컨텍스트]\n{context}\n\n[질문]\n{message}"
    messages.append({"role": "user", "content": user_content})

    schema = {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "suggested_prompts": {
                "type": "array",
                "items": {"type": "string"},
                "maxItems": max_suggestions,
            },
        },
        "required": ["answer"],
    }
    kwargs: dict = {
        "model": config.CHAT_MODEL,
        "max_tokens": config.RESEARCH_MAX_TOKENS,
        "messages": messages,
    }
    sys_prompt = system or ""
    if _supports_output_config():
        kwargs["output_config"] = {
            "format": {"type": "json_schema", "schema": schema}
        }
    else:
        # legacy: 프롬프트로 JSON 계약을 강제(순수 JSON만 출력).
        sys_prompt = (
            sys_prompt
            + "\n반드시 아래 형식의 순수 JSON만 출력하라(설명·코드펜스 금지): "
            '{"answer": "<답변>", "suggested_prompts": ["<후속질문1>", "..."]}'
        )
    if sys_prompt:
        kwargs["system"] = sys_prompt
    try:
        with client.messages.stream(**kwargs) as stream:
            msg = stream.get_final_message()
    except Exception as exc:  # noqa: BLE001
        raise BedrockError(f"Bedrock 텍스트 호출 실패: {exc}") from exc

    text = _first_text(msg) or _last_json_text(msg)
    if text is None:
        raise BedrockError("텍스트 응답에 text 블록 없음")
    try:
        data = _parse_json(text)
        answer = data.get("answer") or ""
        prompts = data.get("suggested_prompts") or []
        prompts = [str(p) for p in prompts if str(p).strip()][:max_suggestions]
        if answer:
            return answer, prompts
    except BedrockError:
        pass
    # 파싱 실패 폴백: 원문을 답변으로, 후속칩 없음.
    _log.warning("후속칩 JSON 파싱 실패 — 원문 답변 폴백(후속칩 생략)")
    return text, []


def _first_text(message) -> Optional[str]:
    """응답 content 블록에서 첫 text 블록 추출(챗봇 자유 텍스트용)."""
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return getattr(block, "text", None)
    return None


def _last_json_text(message) -> Optional[str]:
    """응답에서 JSON 파싱이 되는 마지막 text 블록을 추출.

    웹검색 서버툴 사용 시 content에 server_tool_use·web_search_tool_result·중간 설명
    text가 섞이므로, '첫 text'가 최종 JSON이 아닐 수 있다. 뒤에서부터 검사해 최종
    구조화 출력을 안정적으로 집어낸다. JSON으로 파싱되는 게 없으면 마지막 text 폴백.
    """
    texts = [
        getattr(b, "text", None)
        for b in (getattr(message, "content", []) or [])
        if getattr(b, "type", None) == "text" and getattr(b, "text", None)
    ]
    if not texts:
        return None
    for text in reversed(texts):
        stripped = _FENCE_RE.sub("", text.strip())
        try:
            json.loads(stripped)
            return text
        except json.JSONDecodeError:
            continue
    return texts[-1]


# ── 챗봇 tool-use 에이전트 루프 (C12) ───────────────────────────────
# 규칙기반 골격(정규식 의도분류 + 별칭 dict + if-else)을 대체. LLM이 도구를 호출하며
# 대상 식별·조회·제안을 수행한다. legacy 백엔드 호환(output_config 미사용, tools만).
def _all_text(message) -> str:
    """응답의 모든 text 블록을 이어붙여 최종 답변으로 반환."""
    return "".join(
        getattr(b, "text", "") or ""
        for b in (getattr(message, "content", []) or [])
        if getattr(b, "type", None) == "text"
    )


def _call_sig(call: dict) -> str:
    """tool 호출의 동일성 서명(name + 정규화한 input). 중복 호출(무진전) 감지용."""
    try:
        payload = json.dumps(call.get("input") or {}, ensure_ascii=False, sort_keys=True)
    except (TypeError, ValueError):
        payload = str(call.get("input"))
    return f"{call.get('name')}::{payload}"


def _tool_use_blocks(message) -> List[dict]:
    """응답 content에서 tool_use 블록만 추출 → [{id, name, input}]."""
    out: List[dict] = []
    for b in getattr(message, "content", []) or []:
        if getattr(b, "type", None) == "tool_use":
            out.append(
                {
                    "id": getattr(b, "id", None),
                    "name": getattr(b, "name", None),
                    "input": getattr(b, "input", None) or {},
                }
            )
    return out


def _serialize_content(message) -> list:
    """assistant 응답 content를 다음 요청에 재전송할 dict 형태로 직렬화.

    text·tool_use 블록만 보낸다(thinking 등 기타 블록은 생략 — 챗봇 루프엔 불필요).
    """
    blocks: list = []
    for b in getattr(message, "content", []) or []:
        btype = getattr(b, "type", None)
        if btype == "text":
            blocks.append({"type": "text", "text": getattr(b, "text", "") or ""})
        elif btype == "tool_use":
            blocks.append(
                {
                    "type": "tool_use",
                    "id": getattr(b, "id", None),
                    "name": getattr(b, "name", None),
                    "input": getattr(b, "input", None) or {},
                }
            )
    return blocks


def run_agent(
    messages: list,
    tools: List[dict],
    system: str,
    tool_executor,
    max_iters: Optional[int] = None,
    stop_on: Optional[set] = None,
) -> "tuple[str, list]":
    """tool-use 에이전트 루프 → (최종 답변 텍스트, tool_trace).

    stop_reason=="tool_use"면 모든 tool_use 블록을 tool_executor(name, input)로 실행하고
    tool_result를 user 메시지로 붙여 재호출한다. end_turn이면 최종 text를 반환한다.
    tool_trace = [{name, input, result}] — 호출부가 needs_research 등 플래그 조립에 쓴다.
    legacy 호환: output_config 미사용, tools만 전달. max_iters로 무한 루프를 막는다.

    stop_on: 이 집합에 속한 tool이 호출되면 그 즉시 루프를 멈춘다(tool_result 미전송).
    관점 되묻기(request_perspective)처럼 '답변 생성 전 분기'가 필요한 신호 tool에 쓴다 —
    불필요한 최종 답변 생성을 막아 토큰을 아낀다.

    messages는 호출부가 넘긴 리스트를 변형하지 않도록 복사해 쓴다.
    """
    client = get_client()
    iters = max_iters or config.CHAT_AGENT_MAX_ITERS
    stop_on = stop_on or set()
    convo = list(messages)
    trace: List[dict] = []
    seen_sigs: set = set()  # 무진전(중복 도구 호출) 감지 — 같은 호출 반복 시 루프 조기 종료.
    kwargs: dict = {
        "model": config.CHAT_MODEL,
        "max_tokens": config.CHAT_MAX_TOKENS,
        "system": system,
        "tools": tools,
    }
    try:
        for _ in range(iters):
            with client.messages.stream(messages=convo, **kwargs) as stream:
                message = stream.get_final_message()
            if getattr(message, "stop_reason", None) != "tool_use":
                return _all_text(message), trace
            calls = _tool_use_blocks(message)
            # 조기 종료 신호 tool — 실행 결과를 돌려주지 않고 즉시 멈춘다.
            stop_calls = [c for c in calls if c["name"] in stop_on]
            if stop_calls:
                for call in stop_calls:
                    trace.append({"name": call["name"], "input": call["input"], "result": None})
                return _all_text(message), trace
            # 무진전 감지: 이번 턴의 모든 도구 호출이 이미 본 동일 호출이면(같은 name+input)
            # 같은 되묻기/조회가 반복되는 것이므로 더 돌리지 않고 현재 텍스트로 종료한다.
            # (max_iters까지 같은 preamble을 반복 생성하는 현상 방지 — 6번 반복 버그.)
            if calls and all(_call_sig(c) in seen_sigs for c in calls):
                _log.info("에이전트 루프 무진전(중복 도구 호출) — 조기 종료")
                return _all_text(message), trace
            for c in calls:
                seen_sigs.add(_call_sig(c))
            # tool_use → 실행하고 tool_result를 붙여 재호출.
            convo.append({"role": "assistant", "content": _serialize_content(message)})
            results = []
            for call in calls:
                result = tool_executor(call["name"], call["input"])
                trace.append({"name": call["name"], "input": call["input"], "result": result})
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            convo.append({"role": "user", "content": results})
        # 반복 한도 초과 — 마지막 메시지 텍스트라도 반환(빈 문자열일 수 있음).
        _log.warning("에이전트 루프 max_iters(%d) 초과 — 부분 답변 반환", iters)
        return _all_text(message), trace
    except Exception as exc:  # noqa: BLE001 — SDK 예외 다양
        raise BedrockError(f"에이전트 루프 실패: {exc}") from exc


def stream_agent(
    messages: list,
    tools: List[dict],
    system: str,
    tool_executor,
    max_iters: Optional[int] = None,
    stop_on: Optional[set] = None,
):
    """tool-use 에이전트 루프를 스트리밍 실행하는 제너레이터(SSE용).

    run_agent와 같은 루프지만, 각 턴의 텍스트 델타를 실시간으로 yield해 답변이 타이핑되듯
    흐르게 한다(time-to-first-token 단축). 이벤트 종류:
      {"type": "status", "tool": <name>}  — 도구 호출 직전(분석 중 표시)
      {"type": "token", "text": <delta>}  — 답변 텍스트 델타
      {"type": "final", "text": <full>, "trace": [...]}  — 종료(플래그 조립용)

    텍스트 델타는 들어오는 대로 흘린다 — 단, 도구 호출로 끝나는 턴의 텍스트는 답변이 아니라
    preamble(예: "조회해 드릴게요…")이므로, 그 턴에 텍스트를 흘렸으면 reset 이벤트를 보내
    프론트가 그 버블을 버리게 한다(답변이 끊겼다 새 버블로 다시 쓰이는 현상 방지). 최종 답변은
    도구 호출이 없는 마지막 턴에 흐른다. stop_on tool이 호출되면 토큰 없이 즉시 final로 종료한다.
      {"type": "reset"}                   — 직전까지 흘린 preamble 토큰을 버리라는 신호
    """
    client = get_client()
    iters = max_iters or config.CHAT_AGENT_MAX_ITERS
    stop_on = stop_on or set()
    convo = list(messages)
    trace: List[dict] = []
    seen_sigs: set = set()  # 무진전(중복 도구 호출) 감지 — run_agent와 동일 정책.
    kwargs: dict = {
        "model": config.CHAT_MODEL,
        "max_tokens": config.CHAT_MAX_TOKENS,
        "system": system,
        "tools": tools,
    }
    try:
        for _ in range(iters):
            turn_had_text = False
            with client.messages.stream(messages=convo, **kwargs) as stream:
                for delta in stream.text_stream:
                    if delta:
                        turn_had_text = True
                        yield {"type": "token", "text": delta}
                message = stream.get_final_message()
            if getattr(message, "stop_reason", None) != "tool_use":
                yield {"type": "final", "text": _all_text(message), "trace": trace}
                return
            calls = _tool_use_blocks(message)
            stop_calls = [c for c in calls if c["name"] in stop_on]
            if stop_calls:
                # 관점 되묻기 등 — 흘린 preamble은 답변이 아니므로 버블을 버린다.
                if turn_had_text:
                    yield {"type": "reset"}
                for call in stop_calls:
                    trace.append({"name": call["name"], "input": call["input"], "result": None})
                yield {"type": "final", "text": _all_text(message), "trace": trace}
                return
            # 무진전 감지: 이번 턴의 모든 도구 호출이 이미 본 동일 호출이면 같은 되묻기/조회가
            # 반복되는 것이므로 종료한다. 이때 방금 흘린 텍스트가 곧 보여줄 답변(되묻기 문구)이므로
            # reset하지 않고 그대로 둔다(같은 문구 6번 반복 버그 방지).
            if calls and all(_call_sig(c) in seen_sigs for c in calls):
                _log.info("에이전트 스트림 무진전(중복 도구 호출) — 조기 종료")
                yield {"type": "final", "text": _all_text(message), "trace": trace}
                return
            # 도구 호출 턴 — 방금 흘린 텍스트는 답변이 아닌 preamble이므로 프론트가 버블을 버리게 한다.
            if turn_had_text:
                yield {"type": "reset"}
            for c in calls:
                seen_sigs.add(_call_sig(c))
            convo.append({"role": "assistant", "content": _serialize_content(message)})
            results = []
            for call in calls:
                yield {"type": "status", "tool": call["name"]}
                result = tool_executor(call["name"], call["input"])
                trace.append({"name": call["name"], "input": call["input"], "result": result})
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            convo.append({"role": "user", "content": results})
        _log.warning("에이전트 스트림 max_iters(%d) 초과", iters)
        yield {"type": "final", "text": _all_text(message), "trace": trace}
    except Exception as exc:  # noqa: BLE001
        raise BedrockError(f"에이전트 스트림 실패: {exc}") from exc
