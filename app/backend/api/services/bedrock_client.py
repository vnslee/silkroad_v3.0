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
    """챗봇용 자유 텍스트 호출(구조화 없음, Q4=A). 무상태(history는 인자 전달)."""
    client = get_client()
    messages: List[dict] = []
    for turn in history or []:
        messages.append({"role": turn["role"], "content": turn["content"]})
    user_content = message if not context else f"[참고 컨텍스트]\n{context}\n\n[질문]\n{message}"
    messages.append({"role": "user", "content": user_content})
    kwargs = {
        "model": config.BEDROCK_MODEL,
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
