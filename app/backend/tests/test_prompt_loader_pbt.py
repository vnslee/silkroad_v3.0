"""PBT-03 — 프롬프트 치환 불변식.

property: 치환 후 플레이스홀더({COUNTRY}·{REGION}·{SEGMENT}·{MEMBER_CODES})가 잔존하지 않는다.
Bedrock 미호출(순수 로직).
"""
from __future__ import annotations

import sys
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.services import prompt_loader  # noqa: E402
from tests.strategies import member_codes, target_ids  # noqa: E402

_names = st.text(
    alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ", min_size=1, max_size=20
)
_PLACEHOLDERS = ("{COUNTRY}", "{REGION}", "{SEGMENT}", "{MEMBER_CODES}")


@given(country=_names, region=target_ids, segment=st.one_of(st.none(), _names))
def test_country_prompt_no_placeholders(country, region, segment):
    out = prompt_loader.load_country_prompt(country, region, segment)
    for ph in _PLACEHOLDERS:
        assert ph not in out, f"{ph} 잔존"


@given(region=_names, codes=member_codes, segment=st.one_of(st.none(), _names))
def test_region_prompt_no_placeholders(region, codes, segment):
    out = prompt_loader.load_region_prompt(region, codes, segment)
    for ph in _PLACEHOLDERS:
        assert ph not in out, f"{ph} 잔존"


def test_json_schema_shape():
    # 구조화 스키마는 최상위 required·item required를 가진다.
    cs = prompt_loader.country_json_schema()
    assert "items" in cs["properties"] and "code" in cs["required"]
    rs = prompt_loader.region_json_schema()
    assert "countries" in rs["properties"] and "code" in rs["required"]
