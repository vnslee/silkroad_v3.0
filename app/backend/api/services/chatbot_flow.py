"""챗봇 흐름·시나리오 명세 로더 — 명세=실행 단일출처(prompt_loader 패턴 동일).

architecture/chatbot/ 의 두 SoT를 런타임에 읽는다:
  - chatbot_flow.json — 흐름·선택지 구조(i18n 키). GET /api/chat/flow로 프론트에 노출.
  - senario.md       — 케이스·관점·보고서 서술. 후속 추천칩 생성 시 LLM 시스템 프롬프트에 주입.

둘 다 자주 바뀌지 않으므로 모듈 레벨 1회 캐시한다(룰셋처럼 매 요청 재로딩하지 않음).
파일이 없거나 깨지면 load_flow는 명확한 에러를 던지고, 프론트는 자체 폴백 상수로 동작한다.
"""
from __future__ import annotations

import json
from typing import Optional

from .. import config

_log = config.get_logger("chatbot_flow")

# 모듈 레벨 1회 캐시(자주 안 바뀜).
_flow_cache: Optional[dict] = None
_scenario_cache: Optional[str] = None


def load_flow() -> dict:
    """chatbot_flow.json 로드(1회 캐시). 파일 없음/파싱 실패는 예외."""
    global _flow_cache
    if _flow_cache is None:
        path = config.CHATBOT_SPEC_DIR / "chatbot_flow.json"
        if not path.exists():
            raise FileNotFoundError(f"챗봇 흐름 명세 없음: {path}")
        _flow_cache = json.loads(path.read_text(encoding="utf-8"))
        _log.info("챗봇 흐름 로드: %s", path)
    return _flow_cache


def load_scenario() -> str:
    """senario.md 본문 로드(1회 캐시). 후속 추천칩 LLM 시스템 프롬프트 주입용.

    파일이 없으면 빈 문자열(후속칩 생성은 틀 없이도 동작 — 회귀 없음)."""
    global _scenario_cache
    if _scenario_cache is None:
        path = config.CHATBOT_SPEC_DIR / "senario.md"
        if path.exists():
            _scenario_cache = path.read_text(encoding="utf-8").strip()
        else:
            _log.warning("챗봇 시나리오 명세 없음(후속칩 틀 생략): %s", path)
            _scenario_cache = ""
    return _scenario_cache
