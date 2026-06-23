"""Storage Resolver (C5) — storage 경로·목록·존재·채번조회·URL 변환의 단일 해석점.

CLAUDE.md 경로 규칙 준수. 파일 읽기 위주(쓰기는 엔진이 수행).
- L1 카탈로그 스캔 / L3 채번 조회 / L4 URL 변환 (functional-design)
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import List, Optional

from .. import config
from ..schemas import (
    CountrySummary,
    ExistenceInfo,
    MapColorData,
    RegionSummary,
    ReportRef,
)

_NNN_RE = re.compile(r"_(\d{3})$")


# ── 내부 헬퍼 ───────────────────────────────────────────────────
def _research_dir(domain: str, target_id: str) -> Path:
    return config.RESEARCH_DIR / domain / target_id


def research_latest_path(domain: str, target_id: str) -> Optional[Path]:
    """리서치 입력 경로 단일 해석점: <ID>_latest.json 우선, 없으면 <ID>_*.json 최신본.

    engine_adapter 등 다른 컴포넌트도 이 헬퍼를 재사용해 'exists 판정'과
    '실제 생성 입력'의 비대칭(리뷰 M1)을 방지한다.
    """
    d = _research_dir(domain, target_id)
    latest = d / f"{target_id}_latest.json"
    if latest.exists():
        return latest
    cands = sorted(d.glob(f"{target_id}_*.json"))
    return cands[-1] if cands else None


def research_versions(domain: str, target_id: str) -> list:
    """리서치 스냅샷 버전 목록(최신순). `<ID>_latest.json` 포인터는 제외하고
    `<ID>_<TS>.json` 의 <TS> 부분만 반환한다. 상세화면 버전 선택용(P1/P2)."""
    d = _research_dir(domain, target_id)
    if not d.is_dir():
        return []
    prefix = f"{target_id}_"
    versions = []
    for p in d.glob(f"{target_id}_*.json"):
        stem = p.stem  # <ID>_<TS>
        if stem == f"{target_id}_latest":
            continue
        ver = stem[len(prefix):]
        if ver:
            versions.append(ver)
    return sorted(versions, reverse=True)


def _load_latest_research(domain: str, target_id: str) -> Optional[dict]:
    """research_latest_path가 가리키는 JSON을 로드."""
    path = research_latest_path(domain, target_id)
    if path is None:
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _has_detail(domain: str, target_id: str) -> bool:
    d = config.DETAIL_DIR / domain / target_id / "html"
    return d.is_dir() and any(d.glob("*.html"))


def _report_data_dir(domain: str, target_id: str) -> Path:
    return config.REPORT_DIR / domain / target_id / "data"


def _report_html_dir(domain: str, target_id: str) -> Path:
    return config.REPORT_DIR / domain / target_id / "html"


def _has_report(domain: str, target_id: str) -> bool:
    d = _report_data_dir(domain, target_id)
    return d.is_dir() and any(d.glob("RPT_*.json"))


# ── 존재·목록 (FR-1) ────────────────────────────────────────────
def research_exists(domain: str, target_id: str) -> bool:
    d = _research_dir(domain, target_id)
    if not d.is_dir():
        return False
    return (d / f"{target_id}_latest.json").exists() or any(
        d.glob(f"{target_id}_*.json")
    )


def _country_status_map() -> dict:
    """internal_latest.json 의 country_status(진출 상태) 로드. 실패 시 빈 dict."""
    try:
        with open(config.INTERNAL_LATEST, encoding="utf-8") as f:
            return json.load(f).get("country_status", {}) or {}
    except (OSError, ValueError):
        return {}


def _hyundai_country_names() -> List[str]:
    """현대차 해외사업망 국가 영문명 목록(권역 무관, 평탄화). 실패 시 빈 리스트."""
    try:
        with open(config.HYUNDAI_WORLDWIDE, encoding="utf-8") as f:
            regions = json.load(f).get("regions", {}) or {}
    except (OSError, ValueError):
        return []
    names: List[str] = []
    for region in regions.values():
        for c in region.get("countries", []) or []:
            en = c.get("en")
            if en:
                names.append(en)
    return names


def map_color_data() -> MapColorData:
    """지도 채색 데이터(country_status + 현대 해외사업망 국가명)를 한 번에 제공."""
    return MapColorData(
        country_status=_country_status_map(),
        hyundai_countries=_hyundai_country_names(),
    )


def list_countries() -> List[CountrySummary]:
    base = config.RESEARCH_DIR / "country"
    out: List[CountrySummary] = []
    if not base.is_dir():
        return out
    status_map = _country_status_map()
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        code = d.name
        data = _load_latest_research("country", code) or {}
        resolved_code = data.get("code", code)
        out.append(
            CountrySummary(
                code=resolved_code,
                name=data.get("country", code),
                name_ko=data.get("country_ko"),
                region=data.get("region"),
                is_baseline=bool(data.get("is_baseline", False)),
                has_detail=_has_detail("country", code),
                has_report=_has_report("country", code),
                status=status_map.get(resolved_code),
            )
        )
    return out


def list_regions() -> List[RegionSummary]:
    base = config.RESEARCH_DIR / "region"
    out: List[RegionSummary] = []
    if not base.is_dir():
        return out
    for d in sorted(p for p in base.iterdir() if p.is_dir()):
        code = d.name
        data = _load_latest_research("region", code) or {}
        out.append(
            RegionSummary(
                code=data.get("code", code),
                name=data.get("region", code),
                name_ko=data.get("region_ko"),
                baseline_country=data.get("baseline_country"),
                has_detail=_has_detail("region", code),
                has_report=_has_report("region", code),
            )
        )
    return out


def latest_report_id(domain: str, target_id: str) -> Optional[str]:
    """최신 리포트 ID — 파일명만으로 판정(JSON 파싱 불필요)."""
    data_dir = _report_data_dir(domain, target_id)
    if not data_dir.is_dir():
        return None
    ids = [jp.stem for jp in data_dir.glob("RPT_*.json")]
    if not ids:
        return None
    return max(ids, key=lambda rid: parse_nnn(rid) or 0)


def existence_info(domain: str, target_id: str) -> ExistenceInfo:
    latest_id = latest_report_id(domain, target_id)
    return ExistenceInfo(
        domain=domain,
        target_id=target_id,
        exists=research_exists(domain, target_id),
        has_detail=_has_detail(domain, target_id),
        has_report=latest_id is not None,
        can_research=True,
        latest_report_id=latest_id,
    )


# ── 채번 조회 (L3) ──────────────────────────────────────────────
def parse_nnn(report_id: str) -> Optional[int]:
    """RPT_CTR_ES_001 → 1. 패턴 불일치 시 None."""
    m = _NNN_RE.search(report_id)
    return int(m.group(1)) if m else None


def list_reports(domain: str, target_id: str) -> List[ReportRef]:
    """report/<domain>/<id>/data/RPT_*.json 목록을 NNN 오름차순으로."""
    data_dir = _report_data_dir(domain, target_id)
    out: List[ReportRef] = []
    if not data_dir.is_dir():
        return out
    for jp in data_dir.glob("RPT_*.json"):
        rid = jp.stem
        meta = {}
        try:
            with open(jp, encoding="utf-8") as f:
                meta = json.load(f)
        except (OSError, json.JSONDecodeError):
            pass
        out.append(
            ReportRef(
                report_id=rid,
                report_type=meta.get("report_type"),
                title=meta.get("title"),
                generated_at=meta.get("generated_at"),
                json_url=to_url("report_json", domain, target_id, rid),
                html_url=to_url("report_html", domain, target_id, rid),
                pdf_url=to_url("report_pdf", domain, target_id, rid),
            )
        )
    out.sort(key=lambda r: parse_nnn(r.report_id) or 0)
    return out


def report_json_path(domain: str, target_id: str, report_id: str) -> Optional[Path]:
    p = _report_data_dir(domain, target_id) / f"{report_id}.json"
    return p if p.exists() else None


def report_html_path(domain: str, target_id: str, report_id: str) -> Optional[Path]:
    p = _report_html_dir(domain, target_id) / f"{report_id}.html"
    return p if p.exists() else None


def latest_detail_html(domain: str, target_id: str) -> Optional[Path]:
    """detail 캐시 최신본(파일명 정렬 최댓값)."""
    d = config.DETAIL_DIR / domain / target_id / "html"
    if not d.is_dir():
        return None
    cands = sorted(d.glob("*.html"))
    return cands[-1] if cands else None


def detail_versions(domain: str, target_id: str) -> list:
    """상세화면 버전 목록 = 렌더된 detail HTML 파일 ID(`DTL_<ID>_NNN`), 최신순.
    리서치 타임스탬프가 아닌 렌더 결과물 ID를 버전 선택값으로 노출한다(P1/P2)."""
    d = config.DETAIL_DIR / domain / target_id / "html"
    if not d.is_dir():
        return []
    ids = [p.stem for p in d.glob("*.html") if p.stem]
    return sorted(ids, reverse=True)


def detail_html_by_id(domain: str, target_id: str, version_id: str) -> Optional[Path]:
    """버전 ID(`DTL_<ID>_NNN`)에 해당하는 캐시 detail HTML 경로. 없으면 None.
    파일명 검증으로 경로 탈출(../) 방지 — stem 매칭만 허용."""
    d = config.DETAIL_DIR / domain / target_id / "html"
    if not d.is_dir():
        return None
    for p in d.glob("*.html"):
        if p.stem == version_id:
            return p
    return None


# ── URL 변환 (L4, Q7=A 상대 URL) ────────────────────────────────
def to_url(
    kind: str,
    domain: str,
    target_id: str,
    report_id: Optional[str] = None,
) -> str:
    """산출물 종류 → 상대 URL. 항상 /api 로 시작(순수 함수)."""
    base = f"{config.API_PREFIX}/{config.domain_plural(domain)}/{target_id}"
    if kind == "detail":
        return f"{base}/detail"
    if kind == "report_json":
        return f"{base}/reports/{report_id}/json"
    if kind == "report_html":
        return f"{base}/reports/{report_id}/html"
    if kind == "report_pdf":
        return f"{base}/reports/{report_id}/pdf"
    raise ValueError(f"unknown url kind: {kind}")


def job_status_url(job_id: str) -> str:
    """잡 상태 폴링 URL(명시적 — to_url 인자 오버로딩 회피)."""
    return f"{config.API_PREFIX}/jobs/{job_id}"


# ── 리서치 저장 (L4, FR-1.3) ────────────────────────────────────
def _research_ts(data: dict) -> str:
    """타임스탬프 결정: fetched_at(콜론 압축) 우선, 없으면 생성 시각.

    fetched_at='2026-06-21T12:00' → '2026-06-21T1200'(파일명 안전화).
    """
    fa = data.get("fetched_at")
    if isinstance(fa, str) and fa.strip():
        # 콜론 제거 + 초/소수 절단(YYYY-MM-DDTHHMM 형태로 정규화)
        ts = fa.replace(":", "").replace(" ", "T")
        return ts[:15]  # 'YYYY-MM-DDTHHMM'
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M")


def save_research(domain: str, target_id: str, data: dict) -> "tuple[Path, Path]":
    """리서치 JSON을 기존 네이밍·경로 규칙(CLAUDE.md, PIPELINE §2)으로 저장.

    storage/data/research/<domain>/<id>/<id>_<ts>.json 작성 후
    같은 폴더 <id>_latest.json 포인터를 동일 내용으로 갱신.
    반환: (작성 경로, latest 경로).
    """
    d = _research_dir(domain, target_id)
    d.mkdir(parents=True, exist_ok=True)
    ts = _research_ts(data)
    path = d / f"{target_id}_{ts}.json"
    latest = d / f"{target_id}_latest.json"
    blob = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(blob, encoding="utf-8")
    latest.write_text(blob, encoding="utf-8")
    return path, latest
