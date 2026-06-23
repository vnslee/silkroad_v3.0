"""Geo 참조 (C5 보조) — 국가 지오/메타(좌표·국가명·권역·ISO numeric) 단일 출처.

storage/data/geo/country_geo.json 을 로드/조회/upsert 한다. 프론트가 정적 테이블로
관리하던 마커 좌표(COUNTRY_COORDS 등)를 백엔드 스토리지로 옮긴 것 — 신규 리서치 국가가
추가되면 research_agent가 여기에 upsert 하고, 카탈로그 API(list_countries)가 이를 병합해
좌표·국가명을 내려주므로 지도 마커가 자동으로 뜬다.

읽기는 mtime 기반 캐시(파일 변경 시 자동 재로드), 쓰기는 atomic replace + 락.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Dict, Optional

from .. import config

_log = config.get_logger("geo_reference")

_lock = threading.Lock()
_cache: Optional[dict] = None
_cache_mtime: float = -1.0


def _empty_doc() -> dict:
    return {
        "schema_version": "1.0",
        "description": "국가 지오/메타 참조 — 마커 좌표·국가명(영/한)·권역·ISO numeric의 단일 출처.",
        "countries": {},
    }


def _load() -> dict:
    """country_geo.json 로드(mtime 캐시). 파일이 없으면 빈 문서."""
    global _cache, _cache_mtime
    path = config.GEO_COUNTRY
    try:
        mtime = path.stat().st_mtime
    except OSError:
        # 파일 없음 — 빈 문서를 캐시(매 호출 stat 회피).
        if _cache is None:
            _cache = _empty_doc()
        return _cache
    if _cache is None or mtime != _cache_mtime:
        try:
            with open(path, encoding="utf-8") as f:
                _cache = json.load(f)
            _cache.setdefault("countries", {})
            _cache_mtime = mtime
        except (OSError, json.JSONDecodeError) as exc:
            _log.warning("country_geo.json 로드 실패(빈 참조로 진행): %s", exc)
            _cache = _empty_doc()
    return _cache


def get_country(code: str) -> Optional[dict]:
    """국가 코드 → geo 엔트리(name·name_ko·region·lon·lat·iso_numeric) 또는 None."""
    return _load().get("countries", {}).get(code.upper())


def all_countries() -> Dict[str, dict]:
    """전체 국가 geo 엔트리 사본(코드→엔트리)."""
    return dict(_load().get("countries", {}))


def upsert_country(
    code: str,
    *,
    name: Optional[str] = None,
    name_ko: Optional[str] = None,
    region: Optional[str] = None,
    lon: Optional[float] = None,
    lat: Optional[float] = None,
    iso_numeric: Optional[str] = None,
) -> dict:
    """국가 geo 엔트리 upsert(부분 갱신). None 인자는 기존 값을 보존한다.

    atomic replace(tmp→os.replace)로 동시성·부분쓰기를 방지하고, 캐시를 무효화한다.
    반환: 병합된 엔트리.
    """
    code = code.upper()
    with _lock:
        # 락 안에서 디스크 원본을 직접 다시 읽어(캐시 의존 X) 최신 상태에 병합.
        path = config.GEO_COUNTRY
        try:
            with open(path, encoding="utf-8") as f:
                doc = json.load(f)
            doc.setdefault("countries", {})
        except (OSError, json.JSONDecodeError):
            doc = _empty_doc()

        entry = dict(doc["countries"].get(code, {}))
        updates = {
            "name": name,
            "name_ko": name_ko,
            "region": region,
            "lon": lon,
            "lat": lat,
            "iso_numeric": iso_numeric,
        }
        for key, val in updates.items():
            if val is not None:
                entry[key] = val
        entry.setdefault("name", code)
        doc["countries"][code] = entry

        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(tmp, path)
        # 캐시 무효화 — 다음 _load()가 새 mtime으로 재로드.
        global _cache, _cache_mtime
        _cache = None
        _cache_mtime = -1.0
        _log.info("country_geo upsert: %s", code)
        return entry
