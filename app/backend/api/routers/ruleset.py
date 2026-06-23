"""Ruleset 라우터 (FR-6) — internal_latest.json의 편집 가능한 가중치/계수 조회·저장.

보고서 생성 엔진이 실제로 읽어 계산에 쓰는 internal_latest.json 키만 노출·편집한다.
- values{biz_attractiveness, it_readiness, report_blend}
- similarity_item_weights (항목별 weight만)
- tier_weights
- decision_thresholds

⚠️ quick_win_rules·maintenance_rate는 엔진 산식이 읽지 않으므로(퀵윈은 report_blend의 w_biz/w_it만
사용, maintenance는 maintenance_cost_annual 사용) 화면에 노출하지 않는다. 값은 JSON에 보존하되 미편집.

PUT은 위 키만 부분 갱신(merge)하고 나머지(country_assets·baseline_scoring·fx 등)는 보존한다.
편집 불가 키를 건드리지 않으므로 데이터 계약 안전(엔진 무수정).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Path as PathParam

from .. import config
from ..schemas import RulesetPayload, RulesetSaveResult, RulesetVersionInfo

router = APIRouter(prefix="/api/ruleset", tags=["ruleset"])

_log = config.get_logger("ruleset")

# 화면이 다루는 similarity_item_weights 항목의 메타(axis)는 보존하고 weight만 편집한다.
_SIM_NOTE_KEY = "_note"

# internal_v<ver>_<YYYY-MM-DD>.json 파싱 — ver는 1.2 / 1.10 등 dotted numeric.
_SNAPSHOT_RE = re.compile(r"^internal_v(?P<ver>\d+(?:\.\d+)*)_(?P<date>\d{4}-\d{2}-\d{2})\.json$")
# 버전 경로 파라미터 검증(경로 traversal 방어) — 숫자.숫자 형태만.
_VERSION_PATTERN = r"^\d+(\.\d+)*$"


def _bump_version(current: str | None) -> str:
    """컨피그 버전 minor +1 (예: '1.3' → '1.4'). 파싱 불가 시 '1.0'."""
    if not current:
        return "1.0"
    parts = str(current).split(".")
    try:
        major = int(parts[0])
        minor = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        return str(current)
    return f"{major}.{minor + 1}"


def _snapshot_path(version: str, date_str: str) -> Path:
    """internal_v<ver>_<YYYY-MM-DD>.json — 기존 스냅샷 네이밍 컨벤션."""
    return config.INTERNAL_LATEST.parent / f"internal_v{version}_{date_str}.json"


def _load_internal() -> dict:
    path: Path = config.INTERNAL_LATEST
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"internal 룰셋 파일 없음: {path}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"internal 룰셋 파싱 실패: {e}")


def _extract_payload(data: dict) -> RulesetPayload:
    """internal_latest.json → 편집 대상 부분만 추려 응답 모델로."""
    values = data.get("values", {}) or {}
    sim = data.get("similarity_item_weights", {}) or {}
    # similarity_item_weights는 {항목: {axis, weight}} 구조 — weight만 노출(axis 보존은 PUT에서).
    sim_weights = {
        k: float(v.get("weight", 0.0))
        for k, v in sim.items()
        if isinstance(v, dict) and "weight" in v
    }
    sim_axes = {
        k: str(v.get("axis", ""))
        for k, v in sim.items()
        if isinstance(v, dict) and "weight" in v
    }
    return RulesetPayload(
        version=data.get("version"),
        updated_at=data.get("updated_at"),
        biz_attractiveness={k: float(v) for k, v in (values.get("biz_attractiveness", {}) or {}).items()},
        it_readiness={k: float(v) for k, v in (values.get("it_readiness", {}) or {}).items()},
        report_blend={k: float(v) for k, v in (values.get("report_blend", {}) or {}).items()},
        similarity_item_weights=sim_weights,
        similarity_item_axes=sim_axes,
        tier_weights={k: float(v) for k, v in (data.get("tier_weights", {}) or {}).items() if not k.startswith("_")},
        decision_thresholds={k: float(v) for k, v in (data.get("decision_thresholds", {}) or {}).items() if not k.startswith("_")},
    )


def _version_key(ver: str) -> tuple:
    """'1.10' > '1.9'가 되도록 숫자 튜플로 정렬키 생성."""
    try:
        return tuple(int(p) for p in ver.split("."))
    except ValueError:
        return (0,)


# 현재 화면이 편집하는 키 — 이 중 하나라도 있으면 '호환 스키마'로 본다.
# 구버전 스냅샷(옛 weights.category_weights 구조)은 이 키가 없어 목록에서 제외.
_EDITABLE_KEYS = ("values", "tier_weights", "similarity_item_weights", "decision_thresholds")


def _is_compatible(data: dict) -> bool:
    return any(k in data for k in _EDITABLE_KEYS)


def _scan_versions() -> List[RulesetVersionInfo]:
    """internal 디렉토리의 스냅샷 파일들을 스캔 → 버전 목록(최신순).

    현재 화면 키(values/tier_weights 등)를 가진 **호환 스키마 스냅샷만** 노출한다.
    구버전(옛 weights 구조)은 화면에서 편집 불가라 제외. 현재 latest와 version이
    일치하는 항목에 is_latest=True. 같은 버전이 여러 날짜면 최신 날짜가 앞에 온다.
    """
    latest: Optional[dict] = None
    try:
        latest = _load_internal()
    except HTTPException:
        latest = None
    latest_version = str((latest or {}).get("version") or "") or None

    out: List[RulesetVersionInfo] = []
    seen_files = set()
    for f in config.INTERNAL_LATEST.parent.glob("internal_v*.json"):
        m = _SNAPSHOT_RE.match(f.name)
        if not m:
            continue
        try:
            with open(f, "r", encoding="utf-8") as fh:
                snap = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue
        if not _is_compatible(snap):
            continue  # 구버전 스키마 — 화면 편집 불가, 드롭다운 제외
        out.append(
            RulesetVersionInfo(
                version=m.group("ver"),
                date=m.group("date"),
                file=f.name,
                is_latest=(latest_version is not None and m.group("ver") == latest_version),
            )
        )
        seen_files.add(f.name)

    # 현재 latest는 항상 선택 가능해야 한다. 일치하는 호환 스냅샷이 목록에 없으면
    # latest를 합성 항목으로 추가(file은 internal_latest.json, date는 updated_at의 날짜).
    if latest is not None and latest_version and not any(v.is_latest for v in out):
        updated = str(latest.get("updated_at") or "")
        date = updated[:10] if len(updated) >= 10 else ""
        if config.INTERNAL_LATEST.name not in seen_files:
            out.append(
                RulesetVersionInfo(
                    version=latest_version,
                    date=date,
                    file=config.INTERNAL_LATEST.name,
                    is_latest=True,
                )
            )

    # 버전 desc, 같은 버전이면 날짜 desc
    out.sort(key=lambda v: (_version_key(v.version), v.date), reverse=True)
    return out


def _load_snapshot(version: str) -> dict:
    """주어진 버전의 스냅샷 JSON 로드. 같은 버전이 여러 날짜면 최신 날짜 사용."""
    candidates = [
        f for f in config.INTERNAL_LATEST.parent.glob(f"internal_v{version}_*.json")
        if _SNAPSHOT_RE.match(f.name)
    ]
    if not candidates:
        raise HTTPException(status_code=404, detail=f"버전 스냅샷 없음: v{version}")
    # 파일명 날짜 desc → 최신 우선
    candidates.sort(key=lambda f: f.name, reverse=True)
    try:
        with open(candidates[0], "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 파싱 실패: {e}")
    if not _is_compatible(data):
        raise HTTPException(status_code=422, detail=f"호환되지 않는 구버전 스냅샷: v{version}")
    return data


@router.get("", response_model=RulesetPayload)
def get_ruleset() -> RulesetPayload:
    """편집 가능한 룰셋 값 조회(현재 latest)."""
    return _extract_payload(_load_internal())


@router.get("/versions", response_model=List[RulesetVersionInfo])
def list_versions() -> List[RulesetVersionInfo]:
    """저장된 버전 스냅샷 목록(최신순). 드롭다운용."""
    return _scan_versions()


@router.get("/versions/{version}", response_model=RulesetPayload)
def get_ruleset_version(version: str = PathParam(..., pattern=_VERSION_PATTERN)) -> RulesetPayload:
    """특정 버전 스냅샷의 편집 대상 값 조회. 드롭다운 선택 시 화면 로드용."""
    return _extract_payload(_load_snapshot(version))


@router.put("", response_model=RulesetSaveResult)
def update_ruleset(payload: RulesetPayload) -> RulesetSaveResult:
    """룰셋 부분 갱신 — 노출 키만 덮어쓰고 나머지는 보존.

    저장 시:
    1) 버전 minor +1 → 2) internal_v<ver>_<날짜>.json 스냅샷 신규 생성 →
    3) internal_latest.json 도 같은 내용으로 갱신(atomic). research 디렉토리의
    스냅샷+latest 컨벤션과 동일 — 이력 보관·롤백 가능.
    """
    data = _load_internal()

    values = data.setdefault("values", {})
    if payload.biz_attractiveness:
        values["biz_attractiveness"] = dict(payload.biz_attractiveness)
    if payload.it_readiness:
        values["it_readiness"] = dict(payload.it_readiness)
    if payload.report_blend:
        values["report_blend"] = dict(payload.report_blend)

    # similarity_item_weights — 기존 axis/_note 보존, weight만 갱신.
    if payload.similarity_item_weights:
        sim = data.setdefault("similarity_item_weights", {})
        for name, weight in payload.similarity_item_weights.items():
            entry = sim.get(name)
            if isinstance(entry, dict):
                entry["weight"] = float(weight)
            else:
                sim[name] = {"axis": payload.similarity_item_axes.get(name, ""), "weight": float(weight)}

    if payload.tier_weights:
        tw = data.setdefault("tier_weights", {})
        for k, v in payload.tier_weights.items():
            tw[k] = float(v)

    if payload.decision_thresholds:
        dt = data.setdefault("decision_thresholds", {})
        for k, v in payload.decision_thresholds.items():
            dt[k] = float(v)

    now = datetime.now(timezone.utc).astimezone()
    new_version = _bump_version(data.get("version"))
    data["version"] = new_version
    data["updated_at"] = now.isoformat(timespec="seconds")

    # 1) 새 버전 스냅샷 생성(이미 같은 날 동일 버전이 있으면 그대로 덮어씀)
    snapshot = _snapshot_path(new_version, now.strftime("%Y-%m-%d"))
    _atomic_write(snapshot, data)
    # 2) latest 포인터 갱신
    _atomic_write(config.INTERNAL_LATEST, data)
    _log.info("ruleset saved: version=%s snapshot=%s latest=%s", new_version, snapshot, config.INTERNAL_LATEST)

    return RulesetSaveResult(
        ruleset=_extract_payload(data),
        version=new_version,
        snapshot_file=snapshot.name,
        updated_at=data["updated_at"],
    )


def _atomic_write(path: Path, data: dict) -> None:
    """임시 파일에 쓰고 교체(부분 쓰기로 인한 파손 방지)."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)
