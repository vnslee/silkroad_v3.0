"""Engine Adapter (C2) — 기존 엔진/렌더러를 in-process로 호출하는 얇은 래퍼.

기존 엔진은 무수정. 엔진의 CWD 의존성은 절대경로 주입으로 흡수한다.
유일하게 engine/ 에 의존하는 컴포넌트(다른 서비스는 이를 통해 간접 사용).
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .. import config
from . import storage_resolver

config.ensure_engine_on_path()

_log = config.get_logger("engine_adapter")


class EngineError(RuntimeError):
    """엔진 로드/생성/렌더 실패."""


def generate_report_json(domain: str, target_id: str) -> str:
    """generation 엔진 호출 → 리포트 JSON 절대경로 반환.

    country: CountryReportEngine.generate_type1_report / save_type1_report
    region:  RegionReportEngine.generate_type2_report / save_type2_report
    """
    # exists 판정과 동일한 단일 해석점 사용(리뷰 M1: latest/glob 비대칭 방지)
    research_path = storage_resolver.research_latest_path(domain, target_id)
    if research_path is None or not Path(research_path).exists():
        raise EngineError(f"리서치 데이터 없음: {domain}/{target_id}")

    internal = str(config.INTERNAL_LATEST)
    output_base = str(config.REPORT_DIR)

    if domain == "country":
        from country_report_engine import CountryReportEngine  # type: ignore

        engine = CountryReportEngine(str(research_path), internal, output_base)
        if not engine.load_country_data():
            raise EngineError("country 리서치 데이터 로드 실패")
        engine.load_internal_data()
        report = engine.generate_type1_report()
        path = engine.save_type1_report(report)
    else:
        from region_report_engine import RegionReportEngine  # type: ignore

        engine = RegionReportEngine(str(research_path), internal, output_base)
        if not engine.load_region_data():
            raise EngineError("region 리서치 데이터 로드 실패")
        engine.load_internal_data()
        report = engine.generate_type2_report()
        path = engine.save_type2_report(report)

    _log.info("generated report json: %s", path)
    return str(path)


def render_report_html(domain: str, report_json_path: str) -> str:
    """report renderer 호출 → HTML 절대경로 반환.

    region 엔진은 렌더러를 자동 호출하지 않으므로 여기서 항상 명시 렌더(Q5=A 흡수).
    country도 동일 경로를 거친다(외부 대칭).
    """
    if domain == "country":
        from country_report_renderer import CountryReportRenderer  # type: ignore

        renderer = CountryReportRenderer(report_json_path)
    else:
        from region_report_renderer import RegionReportRenderer  # type: ignore

        renderer = RegionReportRenderer(report_json_path)

    if not renderer.load_report():
        raise EngineError(f"리포트 JSON 로드 실패: {report_json_path}")
    html_path = renderer.save_html()
    _log.info("rendered report html: %s", html_path)
    return str(html_path)


def render_detail_html(domain: str, target_id: str, version: Optional[str] = None) -> str:
    """detail 렌더러 함수형 render() 호출 → 출력 HTML 절대경로 반환(self-locate)."""
    if domain == "country":
        import country_detail_rendering_engine as cdr  # type: ignore

        return str(cdr.render(target_id, version))
    import region_detail_rendering_engine as rdr  # type: ignore

    return str(rdr.render(target_id, version))
