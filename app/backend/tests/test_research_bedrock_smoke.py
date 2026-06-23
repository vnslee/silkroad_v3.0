"""실 Bedrock country 리서치 스모크(Q8=B) — @pytest.mark.bedrock.

네트워크·자격증명·모델 액세스에 의존하므로 기본 수집에서 제외(마커).
실행: pytest -m bedrock
생성물은 tmp_path로 격리해 실제 storage를 오염시키지 않고 자동 정리한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import config  # noqa: E402
from api.services import research_agent  # noqa: E402


@pytest.mark.bedrock
def test_country_research_end_to_end(tmp_path, monkeypatch):
    # 생성물 격리(실제 storage 오염 방지)
    monkeypatch.setattr(config, "RESEARCH_DIR", tmp_path / "research")

    result = research_agent.run(
        "country", "PT", segment="개인 신차", region="EU"
    )
    assert result.domain == "country"
    assert result.target_id == "PT"
    assert result.latest_path.exists()
    assert result.schema_version
