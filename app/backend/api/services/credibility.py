"""출처 신뢰도 3티어 로직 (Gateway 선검색 동반) — 도메인↔티어 매핑 단일 출처.

source_tiers.json(config.CREDIBILITY_TIERS)의 도메인 목록을 읽어:
  - 티어별 allowed_domains(WebSearch 도메인 필터 입력)를 제공하고,
  - URL 호스트 → 신뢰 티어(T1/T2/T3) → 리서치 스키마 정수 tier(1~4)로 환산하며,
  - 단독 인용 가능 여부(T3는 교차검증 전용)를 판정한다.

3 신뢰 티어 ↔ 정수 tier 매핑은 **이 모듈에만** 둔다(internal_latest.json.tier_weights와
드리프트 방지). 점수 가중은 tier_weights가 소유하고, 여긴 "어떤 출처가 어느 티어인가"만 안다.
"""
from __future__ import annotations

import json
import threading
from typing import Dict, List, Optional
from urllib.parse import urlparse

from .. import config

_log = config.get_logger("credibility")

# 신뢰 티어 → 리서치 스키마 정수 tier(country_research_schema.md: 1=공식/법령 … 4=AI추정).
# T3는 저신뢰(3·4)를 병합한 개념이며 대표 정수로 3을 부여한다.
_TIER_TO_INT = {"T1": 1, "T2": 2, "T3": 3}
# 단독 인용 가능 티어(T3는 교차검증 전용 → 단독 인용 금지).
_CITABLE_ALONE = {"T1", "T2"}
_TIER_ORDER = ("T1", "T2", "T3")

_cache: Optional[Dict[str, List[str]]] = None
_cache_lock = threading.Lock()


def _load() -> Dict[str, List[str]]:
    """source_tiers.json의 tiers 블록을 로드(프로세스 1회 캐시). 실패 시 빈 매핑."""
    global _cache
    if _cache is None:
        with _cache_lock:
            if _cache is None:
                try:
                    raw = json.loads(config.CREDIBILITY_TIERS.read_text(encoding="utf-8"))
                    tiers = raw.get("tiers") or {}
                    _cache = {t: [d.lower() for d in tiers.get(t, [])] for t in _TIER_ORDER}
                except Exception as exc:  # noqa: BLE001 — 파일 없음/깨짐도 비치명(빈 매핑)
                    _log.warning("source_tiers.json 로드 실패(빈 매핑 사용): %s", exc)
                    _cache = {t: [] for t in _TIER_ORDER}
    return _cache


def load_tiers() -> Dict[str, List[str]]:
    """티어명 → 도메인 목록(소문자) 사본."""
    return {t: list(v) for t, v in _load().items()}


def allowed_domains(tier: str) -> List[str]:
    """해당 티어의 도메인 목록(WebSearch 도메인 필터 입력용).

    선행 '*.' 와일드카드는 제거한 bare 도메인으로 반환한다(필터 API는 호스트 접미사 매칭).
    """
    out: List[str] = []
    for d in _load().get(tier, []):
        out.append(d[2:] if d.startswith("*.") else d)
    return out


def tiers_in_order() -> tuple:
    """검색 순서대로의 티어명(T1 → T2 → T3)."""
    return _TIER_ORDER


def _host(url: str) -> str:
    """URL → 소문자 호스트(스킴 없으면 보정)."""
    if not url:
        return ""
    parsed = urlparse(url if "://" in url else f"//{url}", scheme="")
    host = (parsed.netloc or parsed.path).lower().strip()
    # 포트·경로 제거, 선행 www. 정규화.
    host = host.split("/")[0].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def _matches(host: str, pattern: str) -> bool:
    """호스트가 도메인 패턴에 매치하는지(접미사/와일드카드)."""
    pat = pattern[2:] if pattern.startswith("*.") else pattern
    return host == pat or host.endswith("." + pat)


def trust_tier_of(url: str) -> Optional[str]:
    """URL → 신뢰 티어명(T1/T2/T3) 또는 None(어느 목록에도 없음). 더 높은 티어 우선."""
    host = _host(url)
    if not host:
        return None
    mapping = _load()
    for tier in _TIER_ORDER:  # T1 먼저 — 한 도메인이 복수 티어에 있으면 상위 채택
        for pattern in mapping.get(tier, []):
            if _matches(host, pattern):
                return tier
    return None


def tier_of_domain(url: str) -> Optional[int]:
    """URL → 리서치 스키마 정수 tier(1~3) 또는 None(미분류 도메인)."""
    tier = trust_tier_of(url)
    return _TIER_TO_INT[tier] if tier else None


def is_citable_alone(tier) -> bool:
    """단독 인용 가능 여부. 신뢰 티어명('T1'..) 또는 정수 tier 모두 허용. T3/3·4=False."""
    if isinstance(tier, str):
        return tier in _CITABLE_ALONE
    if isinstance(tier, int):
        return tier <= 2
    return False
