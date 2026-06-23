"""PBT-07 도메인 생성기 — 재사용 가능한 Hypothesis strategies.

원시 타입(raw string 등) 대신 도메인 제약을 존중하는 생성기를 제공한다.
"""
from __future__ import annotations

from hypothesis import strategies as st

# domain
domains = st.sampled_from(["country", "region"])

# target_id: ^[A-Z]{2,5}$ (TARGET_ID_PATTERN 준수)
target_ids = st.text(alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ", min_size=2, max_size=5)

# NNN: 1..999
nnns = st.integers(min_value=1, max_value=999)

# member_codes: target_id 리스트(권역 멤버 국가, PBT-07)
member_codes = st.lists(target_ids, min_size=0, max_size=5)

# chat role enum
chat_roles = st.sampled_from(["user", "assistant"])


@st.composite
def report_ids(draw, domain=None):
    """RPT_CTR_<CODE>_<NNN> / RPT_RGN_<REGION>_<NNN>."""
    d = domain or draw(domains)
    prefix = "RPT_CTR" if d == "country" else "RPT_RGN"
    code = draw(target_ids)
    nnn = draw(nnns)
    return f"{prefix}_{code}_{nnn:03d}"
