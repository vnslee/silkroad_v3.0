"""리서치 정책 (C5 보조) — 무엇을 리서치 트리거할 수 있는지의 단일 판정점.

운영 정책(2026-06 결정):
- **권역(region) 신규 추가·리서치는 전면 금지** — 권역 축은 보유한 것(EU/NA/SA/APAC)만
  운용한다. 신규 권역을 만드는 리서치 경로를 제거한다.
- **국가(country) 리서치는 두 경우만 허용**:
  ① 이미 데이터를 보유한 국가의 재수행, 또는
  ② 보유 권역에 속한 국가의 신규 추가.
  보유 권역 밖(예: 아프리카 AF) 국가는 차단한다.

판정 소스는 사내 룰셋의 country_to_region(스코어링 진실의 소스)과 geo 참조(보강)이며,
'보유 권역'은 storage_resolver.list_regions()로 동적으로 구한다(하드코딩 회피).
"""
from __future__ import annotations

import json
from typing import Optional, Set, Tuple

from .. import config
from . import geo_reference, storage_resolver

_log = config.get_logger("research_policy")

# geo 참조의 권역 표기 → 사내/스토리지 권역 코드 정규화.
_GEO_REGION_ALIAS = {
    "AFRICA": "AF",
    "NORTH_AMERICA": "NA",
    "SOUTH_AMERICA": "SA",
    "EU": "EU",
    "APAC": "APAC",
}


def _load_country_to_region() -> dict:
    """internal_latest.json의 country_to_region(국가코드→권역코드). 실패 시 {}."""
    try:
        with open(config.INTERNAL_LATEST, encoding="utf-8") as f:
            return json.load(f).get("country_to_region", {}) or {}
    except (OSError, json.JSONDecodeError):
        return {}


def existing_region_codes() -> Set[str]:
    """현재 보유 중인 권역 코드 집합(스토리지에 디렉터리가 있는 권역)."""
    return {r.code for r in storage_resolver.list_regions()}


def region_of_country(code: str) -> Optional[str]:
    """국가 코드 → 권역 코드. 사내 매핑 우선, 없으면 geo 참조(정규화). 미상이면 None."""
    code = code.upper()
    c2r = _load_country_to_region()
    if code in c2r:
        return c2r[code]
    geo = geo_reference.get_country(code) or {}
    region = geo.get("region")
    if region:
        return _GEO_REGION_ALIAS.get(region, region)
    return None


# ── 정책 판정 ───────────────────────────────────────────────────
def region_research_allowed() -> bool:
    """권역 리서치/추가는 정책상 항상 금지."""
    return False


def country_research_allowed(code: str) -> Tuple[bool, Optional[str]]:
    """국가 리서치 허용 여부 + 거부 사유(허용 시 None).

    허용: ① 보유국 재수행  ② 보유 권역 소속 국가의 신규 추가.
    """
    code = code.upper()
    # ① 이미 보유 → 재수행 허용.
    if storage_resolver.research_exists("country", code):
        return True, None
    # ② 보유 권역 소속이면 신규 추가 허용.
    region = region_of_country(code)
    existing = existing_region_codes()
    if region and region in existing:
        return True, None
    if region:
        reason = (
            f"'{code}'는 보유 권역({', '.join(sorted(existing)) or '없음'}) 밖의 "
            f"국가(소속 권역 {region})라 신규 리서치할 수 없습니다."
        )
    else:
        reason = (
            f"'{code}'는 보유 권역({', '.join(sorted(existing)) or '없음'})에 속하지 않아 "
            "신규 리서치할 수 없습니다."
        )
    return False, reason


def research_allowed(domain: str, target_id: str) -> Tuple[bool, Optional[str]]:
    """도메인 공통 진입점 — (허용 여부, 거부 사유)."""
    if domain == "region":
        return False, "권역 신규 리서치는 현재 지원하지 않습니다(보유 권역만 운용)."
    return country_research_allowed(target_id)
