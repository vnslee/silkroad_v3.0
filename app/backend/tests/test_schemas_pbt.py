"""PBT-02 — Pydantic 모델 직렬화 라운드트립.

property: model_validate(model_dump(x)) == x  (모든 유효 입력)
"""
from __future__ import annotations

import sys
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

# app/backend 를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.schemas import (  # noqa: E402
    CountrySummary,
    ExistenceInfo,
    JobResult,
    JobStatus,
    RegionSummary,
    ReportRef,
)
from tests.strategies import domains, target_ids  # noqa: E402

opt_str = st.one_of(st.none(), st.text(max_size=20))


@given(
    code=target_ids,
    name=st.text(max_size=30),
    name_ko=opt_str,
    region=opt_str,
    is_baseline=st.booleans(),
    has_detail=st.booleans(),
    has_report=st.booleans(),
)
def test_country_summary_roundtrip(code, name, name_ko, region, is_baseline, has_detail, has_report):
    x = CountrySummary(
        code=code, name=name, name_ko=name_ko, region=region,
        is_baseline=is_baseline, has_detail=has_detail, has_report=has_report,
    )
    assert CountrySummary.model_validate(x.model_dump()) == x


@given(
    code=target_ids, name=st.text(max_size=30), name_ko=opt_str,
    baseline_country=opt_str, has_detail=st.booleans(), has_report=st.booleans(),
)
def test_region_summary_roundtrip(code, name, name_ko, baseline_country, has_detail, has_report):
    x = RegionSummary(
        code=code, name=name, name_ko=name_ko,
        baseline_country=baseline_country, has_detail=has_detail, has_report=has_report,
    )
    assert RegionSummary.model_validate(x.model_dump()) == x


@given(
    domain=domains, target_id=target_ids, exists=st.booleans(),
    has_detail=st.booleans(), has_report=st.booleans(),
    can_research=st.booleans(), latest=opt_str,
)
def test_existence_info_roundtrip(domain, target_id, exists, has_detail, has_report, can_research, latest):
    x = ExistenceInfo(
        domain=domain, target_id=target_id, exists=exists, has_detail=has_detail,
        has_report=has_report, can_research=can_research, latest_report_id=latest,
    )
    assert ExistenceInfo.model_validate(x.model_dump()) == x


@given(
    domain=domains, target_id=target_ids, report_id=st.text(max_size=20),
    json_url=st.text(max_size=40), html_url=st.text(max_size=40),
    pdf_url=opt_str,
)
def test_job_result_roundtrip(domain, target_id, report_id, json_url, html_url, pdf_url):
    x = JobResult(
        domain=domain, target_id=target_id, report_id=report_id,
        json_url=json_url, html_url=html_url, pdf_url=pdf_url,
    )
    assert JobResult.model_validate(x.model_dump()) == x


@given(
    job_id=st.text(min_size=1, max_size=32),
    status=st.sampled_from(["queued", "running", "succeeded", "failed"]),
    step=st.sampled_from(["queued", "generating", "rendering", "done"]),
    percent=st.integers(min_value=0, max_value=100),
    message=opt_str,
)
def test_job_status_roundtrip(job_id, status, step, percent, message):
    x = JobStatus(
        job_id=job_id, status=status, step=step, percent=percent, message=message,
    )
    assert JobStatus.model_validate(x.model_dump()) == x


@given(
    report_id=st.text(min_size=1, max_size=20),
    json_url=st.text(max_size=40), html_url=st.text(max_size=40), pdf_url=st.text(max_size=40),
)
def test_report_ref_roundtrip(report_id, json_url, html_url, pdf_url):
    x = ReportRef(report_id=report_id, json_url=json_url, html_url=html_url, pdf_url=pdf_url)
    assert ReportRef.model_validate(x.model_dump()) == x
