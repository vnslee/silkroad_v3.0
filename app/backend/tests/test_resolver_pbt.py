"""PBT-03 — Storage Resolver 불변식.

- to_url: 동일 입력 → 동일 URL(순수), 항상 /api 시작, 도메인 복수형 정확
- report_id 파싱: parse_nnn(format(nnn)) == nnn, NNN 3자리
"""
from __future__ import annotations

import sys
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.services import storage_resolver as sr  # noqa: E402
from tests.strategies import domains, nnns, report_ids, target_ids  # noqa: E402


@given(domain=domains, target_id=target_ids, report_id=st.text(min_size=1, max_size=20))
def test_to_url_report_json_deterministic_and_prefixed(domain, target_id, report_id):
    u1 = sr.to_url("report_json", domain, target_id, report_id)
    u2 = sr.to_url("report_json", domain, target_id, report_id)
    assert u1 == u2  # 순수 함수
    assert u1.startswith("/api/")  # 항상 /api
    plural = "countries" if domain == "country" else "regions"
    assert f"/api/{plural}/{target_id}" in u1
    assert u1.endswith("/json")


@given(domain=domains, target_id=target_ids)
def test_to_url_detail(domain, target_id):
    u = sr.to_url("detail", domain, target_id)
    assert u.startswith("/api/")
    assert u.endswith(f"/{target_id}/detail")


@given(nnn=nnns)
def test_parse_nnn_roundtrip(nnn):
    # NNN 포맷(3자리) → 파싱 → 원래 값
    rid = f"RPT_CTR_ES_{nnn:03d}"
    assert sr.parse_nnn(rid) == nnn


@given(report_id=report_ids())
def test_parse_nnn_on_generated_ids(report_id):
    # 생성된 유효 report_id는 항상 NNN 파싱 가능, 1..999
    val = sr.parse_nnn(report_id)
    assert val is not None
    assert 1 <= val <= 999


import pytest  # noqa: E402


@pytest.mark.parametrize(
    "rid,expected",
    [
        ("ABC", None),                 # 숫자 suffix 없음
        ("RPT_CTR_ES", None),          # NNN 없음
        ("RPT_CTR_ES_12", None),       # 2자리 — _NNN(정확히 3자리) 패턴 불일치
        ("RPT_CTR_ES_1234", None),     # 4자리 — _(\d{3})$ 는 '_' 다음 정확히 3자리+끝만 매칭 → None
        ("RPT_CTR_ES_001", 1),         # 정상
        ("RPT_RGN_EU_010", 10),        # 정상(region)
    ],
)
def test_parse_nnn_boundaries(rid, expected):
    # 동어반복 대신 명시적 경계 예제로 parse_nnn 동작을 직접 고정
    assert sr.parse_nnn(rid) == expected
