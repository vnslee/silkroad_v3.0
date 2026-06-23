"""PBT-03 — save_research 경로 규칙 불변식(tmp 격리).

property: 저장 경로 = <id>_<ts>.json, latest 포인터 = <id>_latest.json,
         두 파일 내용 동일, 도메인/id round-trip(읽으면 같은 dict).
config.RESEARCH_DIR를 tmp로 monkeypatch해 실제 storage 오염 방지.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import config  # noqa: E402
from api.services import storage_resolver  # noqa: E402
from tests.strategies import domains, target_ids  # noqa: E402

_fetched_at = st.one_of(
    st.none(),
    st.just("2026-06-21T12:00"),
    st.just("2026-01-02T0900"),
)


@settings(max_examples=40, suppress_health_check=[HealthCheck.function_scoped_fixture])
@given(domain=domains, target_id=target_ids, fetched_at=_fetched_at)
def test_save_research_paths(tmp_path, monkeypatch, domain, target_id, fetched_at):
    monkeypatch.setattr(config, "RESEARCH_DIR", tmp_path / "research")

    data = {"code": target_id, "schema_version": "1.0", "items": [{"item": "x"}]}
    if fetched_at is not None:
        data["fetched_at"] = fetched_at

    path, latest = storage_resolver.save_research(domain, target_id, data)

    # 경로 규칙: 같은 폴더, <id>_<ts>.json / <id>_latest.json
    assert path.parent == latest.parent
    assert latest.name == f"{target_id}_latest.json"
    assert path.name.startswith(f"{target_id}_") and path.name.endswith(".json")
    assert path.name != latest.name

    # 내용 동일 + round-trip
    loaded = json.loads(path.read_text(encoding="utf-8"))
    assert loaded == data
    assert json.loads(latest.read_text(encoding="utf-8")) == data

    # research_exists가 저장본을 인지
    assert storage_resolver.research_exists(domain, target_id)
