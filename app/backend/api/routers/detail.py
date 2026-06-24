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


@router.get("/countries/{code}/detail/versions", response_model=List[str])
def list_country_detail_versions(code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.detail_versions("country", code.upper())


@router.get("/regions/{region}/detail/versions", response_model=List[str])
def list_region_detail_versions(region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> List[str]:
    return storage_resolver.detail_versions("region", region.upper())


@router.get("/countries/{code}/detail")
def get_country_detail(
    code: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    # React 프론트엔드는 JSON을 요청 — 리서치 데이터 직접 반환
    research_path = storage_resolver.research_latest_path("country", code.upper())
    if research_path is None or not research_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"country '{code.upper()}' 리서치 데이터 없음",
        )
    return Response(content=research_path.read_text(encoding="utf-8"), media_type="application/json")


@router.get("/regions/{region}/detail")
def get_region_detail(
    region: str = Path(..., pattern=TARGET_ID_PATTERN), version: Optional[str] = None
) -> Response:
    # React 프론트(P2)는 리서치 스냅샷 JSON을 받아 클라이언트에서 3-소스 병합(buildRegionDetail)을
    # 수행한다. 별도 detail-sources(원시 internal)·reports(퀵윈 보고서)를 함께 받아 합치므로
    # 여기선 country와 동일하게 리서치 스냅샷 원본을 그대로 반환한다(서버측 병합 엔진 불필요).
    research_path = storage_resolver.research_latest_path("region", region.upper())
    if research_path is None or not research_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"region '{region.upper()}' 리서치 데이터 없음",
        )
    return Response(content=research_path.read_text(encoding="utf-8"), media_type="application/json")

# 상세화면은 React가 직접 렌더하므로 별도 비동기 HTML 렌더 잡(POST .../detail)은 두지 않는다.
# 프론트는 리서치 데이터 존재(GET .../detail)만 확인하고 바로 컴포넌트를 그린다.
