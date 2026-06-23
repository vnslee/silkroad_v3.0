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
        if backend == "mantle":
            from anthropic import AnthropicBedrockMantle

            cli = AnthropicBedrockMantle(aws_region=config.BEDROCK_REGION)
        else:
            from anthropic import AnthropicBedrock

            cli = AnthropicBedrock(aws_region=config.BEDROCK_REGION)
    except ImportError as exc:  # pragma: no cover
        raise BedrockError("anthropic SDK 미설치 — requirements.txt 확인") from exc
    _log.info("Bedrock 클라이언트 초기화: backend=%s region=%s", backend, config.BEDROCK_REGION)
    return cli


def _supports_output_config() -> bool:
    """구조화 출력(output_config.format) 사용 가능 백엔드인지."""
    return config.BEDROCK_BACKEND == "mantle"


def generate_structured(
    prompt: str,
    json_schema: dict,
    system: Optional[str] = None,
) -> dict:
    """구조화 출력 호출 → 첫 text 블록 JSON 파싱 → dict.

    mantle 백엔드는 output_config.format(json_schema)로 강제. legacy 백엔드는
    프롬프트의 "순수 JSON만" 계약에 의존하고 코드펜스를 제거해 파싱한다.
    streaming + get_final_message로 큰 출력의 HTTP 타임아웃을 피한다.
    """
    client = get_client()
    kwargs = {
        "model": config.BEDROCK_MODEL,
        "max_tokens": config.RESEARCH_MAX_TOKENS,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    if _supports_output_config():
        kwargs["output_config"] = {
            "format": {"type": "json_schema", "schema": json_schema}
        }
    try:
        with client.messages.stream(**kwargs) as stream:
            message = stream.get_final_message()
    except Exception as exc:  # noqa: BLE001 — SDK 예외 다양(자격증명·throttle·네트워크)
        raise BedrockError(f"Bedrock 구조화 호출 실패: {exc}") from exc

    text = _first_text(message)
    if text is None:
        raise BedrockError("구조화 출력에 text 블록 없음")
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
    """응답 content 블록에서 첫 text 블록 추출."""
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            return getattr(block, "text", None)
    return None
