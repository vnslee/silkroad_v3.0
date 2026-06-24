"""Catalog 라우터 (FR-1) — 국가/권역 목록·존재 확인."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Path

from ..config import TARGET_ID_PATTERN
from ..schemas import CountrySummary, ExistenceInfo, MapColorData, RegionSummary
from ..services import storage_resolver

router = APIRouter(prefix="/api", tags=["catalog"])

# 주의: Path(...) 인스턴스를 모듈 변수로 공유하면 FastAPI가 첫 파라미터명을
# 각인해 다른 파라미터로 누출된다. 반드시 파라미터마다 새 인스턴스를 쓴다.


@router.get("/countries", response_model=List[CountrySummary])
def get_countries() -> List[CountrySummary]:
    return storage_resolver.list_countries()


@router.get("/regions", response_model=List[RegionSummary])
def get_regions() -> List[RegionSummary]:
    return storage_resolver.list_regions()


@router.get("/map-colors", response_model=MapColorData)
def get_map_colors() -> MapColorData:
    # 지도 국가 채색 원천(country_status + 현대 해외사업망). 프론트가 색을 결정.
    return storage_resolver.map_color_data()


@router.get("/countries/{code}", response_model=ExistenceInfo)
def get_country(code: str = Path(..., pattern=TARGET_ID_PATTERN)) -> ExistenceInfo:
    # 데이터 없어도 200 + exists:false (Q4=A)
    return storage_resolver.existence_info("country", code.upper())


@router.get("/regions/{region}", response_model=ExistenceInfo)
def get_region(region: str = Path(..., pattern=TARGET_ID_PATTERN)) -> ExistenceInfo:
    return storage_resolver.existence_info("region", region.upper())


@router.get("/regions/{region}/detail-sources")
def get_region_detail_sources(region: str = Path(..., pattern=TARGET_ID_PATTERN)):
    # P2 상세화면이 3-소스 병합(리서치+퀵윈 보고서+internal)을 프론트에서 수행하기 위한
    # 원시 internal 데이터(권역 소속국 자산·진출상태). 엔진/렌더러 미사용 — JSON 패스스루.
    return storage_resolver.region_detail_sources(region.upper())
