"""Detail 라우터 (FR-2, L2) — 상세화면 데이터(JSON).

상세화면은 React 컴포넌트(CountryDetail/RegionDetail)가 그린다. 이 라우터는 그 입력
JSON(리서치 스냅샷)만 제공한다 — 서버측 HTML 렌더는 없다.
리서치 데이터 없으면 404.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Path, Response

from ..config import TARGET_ID_PATTERN
from ..services import storage_resolver

router = APIRouter(prefix="/api", tags=["detail"])

# Path(...) 인스턴스는 파라미터마다 새로 생성(공유 시 파라미터명 누출).


# 버전 목록 = 리서치 스냅샷 타임스탬프(<TS>), 최신순. 상세화면은 React가 리서치 JSON을 직접
# 렌더하므로 '버전 = 리서치 스냅샷'이 맞다(과거 렌더 HTML ID는 화면 데이터와 무관해 사용 안 함).
@router.get("/countries/{code}/detail/versions", response_model=List[str])
def list_country_detail_versions(code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.research_versions("country", code.upper())


@router.get("/regions/{region}/detail/versions", response_model=List[str])
def list_region_detail_versions(region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.research_versions("region", region.upper())


def _detail_response(domain: str, target_id: str, version: Optional[str]) -> Response:
    """리서치 스냅샷 JSON 반환. version 지정 시 해당 `<ID>_<TS>.json`, 없으면 latest.
    version이 지정됐는데 해당 스냅샷이 없으면 404(조용히 latest로 대체하지 않음)."""
    if version:
        research_path = storage_resolver.research_version_path(domain, target_id, version)
        if research_path is None:
            raise HTTPException(
                status_code=404,
                detail=f"{domain} '{target_id}' 버전 '{version}' 리서치 데이터 없음",
            )
    else:
        research_path = storage_resolver.research_latest_path(domain, target_id)
        if research_path is None or not research_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"{domain} '{target_id}' 리서치 데이터 없음",
            )
    return Response(content=research_path.read_text(encoding="utf-8"), media_type="application/json")


@router.get("/countries/{code}/detail")
def get_country_detail(
    code: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    # React 프론트엔드는 JSON을 요청 — 버전 지정 시 해당 스냅샷, 없으면 latest.
    return _detail_response("country", code.upper(), version)


@router.get("/regions/{region}/detail")
def get_region_detail(
    region: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    # React 프론트(P2)는 리서치 스냅샷 JSON을 받아 클라이언트에서 3-소스 병합(buildRegionDetail)을
    # 수행한다. 별도 detail-sources(원시 internal)·reports(퀵윈 보고서)를 함께 받아 합치므로
    # 여기선 country와 동일하게 리서치 스냅샷 원본을 그대로 반환한다(서버측 병합 엔진 불필요).
    return _detail_response("region", region.upper(), version)

# 상세화면은 React가 직접 렌더하므로 별도 비동기 HTML 렌더 잡(POST .../detail)은 두지 않는다.
# 프론트는 리서치 데이터 존재(GET .../detail)만 확인하고 바로 컴포넌트를 그린다.
