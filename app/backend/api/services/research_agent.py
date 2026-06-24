"""리서치 Agent (C10, L3·L5) — 프롬프트→LLM(웹검색 딥리서치)→검증→저장.

domain 인자로 country/region 분기(BR-SYM-1). country는 상품·규제·시스템·시장 4개 분야
agent를 병렬로 돌려(각자 웹검색 딥리서치 + 전문가 페르소나) items[]를 만들고, 5번째
단계에서 overall_insight를 합성해 병합한다. region은 member 누락 국가를 선행 리서치
(Q6=A) 후 권역을 조사하며, 각 멤버 국가도 동일한 4-agent 파이프라인을 탄다.

progress_cb(step, message) — 잡 단계 전이 보고.
agent_cb(key, status, percent) — 분야 agent별 진행률 보고(프로그레스바 per-agent 표시).
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, List, Optional

from pydantic import ValidationError

from .. import config
from . import (
    bedrock_client,
    credibility,
    gateway_search,
    geo_reference,
    prompt_loader,
    storage_resolver,
)

_log = config.get_logger("research_agent")

# 국가 메타(국가명·한글명·권역·통화·대표좌표) 해석용 경량 스키마.
_COUNTRY_META_SCHEMA = {
    "type": "object",
    "properties": {
        "country": {"type": "string"},
        "country_ko": {"type": "string"},
        "region": {"type": "string"},
        "currency": {"type": "string"},
        "lon": {"type": "number"},
        "lat": {"type": "number"},
        "iso_numeric": {"type": "string"},
    },
    "required": ["country", "country_ko", "region", "lon", "lat"],
}
# region 값은 프론트 지도 권역 분류 키와 정합해야 한다(MapView REGIONS6 / geo region).
_REGION_ENUM = ("EU", "NORTH_AMERICA", "SOUTH_AMERICA", "APAC", "MIDDLE_EAST", "AFRICA")

# progress_cb(step, message) — research_orchestrator가 JobManager에 위임.
# progress_cb(step, message, percent=None) — percent 명시 시 step 매핑 대신 직접 사용.
ProgressCb = Optional[Callable[..., None]]
# agent_cb(key, status, percent) — 분야 agent별 진행률(JobManager.set_agent_progress).
AgentCb = Optional[Callable[[str, str, int], None]]

# 딥리서치 effort(웹검색 + adaptive thinking).
_RESEARCH_EFFORT = "high"

# 분야별 선검색 질의 템플릿({country}=영문 국가명). 필드 페르소나 범위에 맞춰 fan-out.
_FIELD_QUERIES = {
    "market": [
        "{country} auto finance market size penetration rate",
        "{country} new car sales auto loan APR interest rate",
        "{country} captive auto finance market share EV residual value",
    ],
    "regulatory": [
        "{country} auto finance license foreign ownership regulation",
        "{country} consumer credit law repossession collection rules",
        "{country} data localization financial services regulation",
    ],
    "system": [
        "{country} credit bureau payment infrastructure auto finance",
        "{country} digital lending dealer financing platform maturity",
    ],
    "product": [
        "{country} car loan lease rental fleet financing mix",
        "{country} auto leasing vs installment purchase share",
    ],
}
# 선검색 단계 캡 — 쿼리당 결과 수(넓게 받아 코드가 티어로 거른다). WebSearch 도구는
# 도메인 필터 인자가 없어(실측), 넓게 검색→사후 티어 태깅·필터하는 구조다.
_PREFETCH_RESULTS_PER_QUERY = 15


def _prefetch_sources(field: str, country_name: str, region: str) -> list:
    """Gateway WebSearch로 분야별 선검색 → 신뢰 티어 출처만 태깅·디둡해 반환.

    쿼리당 1회 넓게 검색하고, 결과를 실제 도메인의 신뢰 티어(T1/T2/T3)로 태깅한다.
    어느 티어 목록에도 없는 도메인은 제외(티어 강제 = 코드 소유). 호출 실패는 비치명.
    """
    templates = _FIELD_QUERIES.get(field, [])
    by_url: dict = {}
    for tmpl in templates:
        query = tmpl.format(country=country_name)
        try:
            results = gateway_search.web_search(
                query, max_results=_PREFETCH_RESULTS_PER_QUERY
            )
        except gateway_search.GatewaySearchError as exc:
            _log.warning("선검색 실패(field=%s, q=%r): %s", field, query, exc)
            continue
        for r in results:
            url = (r.get("url") or "").strip()
            if not url or url in by_url:
                continue
            tier_int = credibility.tier_of_domain(url)
            if tier_int is None:
                continue  # 어느 티어에도 없는 도메인 → 제외(티어 강제)
            r = dict(r)
            r["tier"] = tier_int
            by_url[url] = r
    sources = list(by_url.values())
    sources.sort(key=lambda s: s.get("tier", 9))  # 신뢰도 높은(tier 낮은) 순
    _log.info("분야 %s 선검색: %d개 검증 출처", field, len(sources))
    return sources


def _apply_tier_policy(items: list, sources: list) -> list:
    """LLM이 만든 items의 tier를 인용 출처 기준으로 보정하고, T3 단독 지지 item은 FLAG.

    - source 문자열에 검증 출처 URL이 포함되면 그 출처의 tier로 item.tier를 보정.
    - 인용 출처가 단독 인용 불가(T3=tier≥3)뿐이면 estimated:true·so_what="조사 필요"로
      플래그(삭제하지 않음 — 스키마의 FLAG 의미와 일치).
    """
    if not items:
        return items
    src_by_url = {(s.get("url") or "").strip(): s for s in sources if s.get("url")}
    for it in items:
        if not isinstance(it, dict):
            continue
        cited = it.get("source") or ""
        matched_tiers = [
            s["tier"] for url, s in src_by_url.items() if url and url in cited
        ]
        if matched_tiers:
            best = min(matched_tiers)  # 가장 신뢰도 높은 인용 출처
            it["tier"] = best
            # 단독 인용 가능 출처(T1/T2)가 하나도 없으면 FLAG.
            if not any(credibility.is_citable_alone(t) for t in matched_tiers):
                it["estimated"] = True
                if not it.get("so_what"):
                    it["so_what"] = "조사 필요"
    return items


class ResearchError(RuntimeError):
    """리서치 검증 실패(필수 핵심키 누락·items 비어있음 등)."""


class ResearchResult:
    """run 반환값(가벼운 컨테이너)."""

    def __init__(self, domain: str, target_id: str, latest_path, schema_version: str):
        self.domain = domain
        self.target_id = target_id
        self.latest_path = latest_path
        self.schema_version = schema_version


def _validate(domain: str, data: dict) -> str:
    """L3 관대 검증. 필수 핵심키 누락·items 비어있음만 실패. 반환: schema_version."""
    model = prompt_loader.validation_model(domain)
    try:
        obj = model.model_validate(data)
    except ValidationError as exc:
        raise ResearchError(f"스키마 검증 실패: {exc}") from exc

    if domain == "country":
        if not data.get("items"):
            raise ResearchError("items가 비어있음(최소 1개 필요)")
    else:  # region
        countries = data.get("countries") or []
        if not countries:
            raise ResearchError("countries가 비어있음(최소 1개 필요)")
    return getattr(obj, "schema_version", data.get("schema_version", ""))


def _run_field(field: str, target_id: str, region: str, segment: Optional[str]) -> list:
    """단일 분야 agent — 딥리서치로 자기 담당 items[]만 반환.

    gateway 모드: 코드가 티어별 도메인 필터로 선검색 → 검증 출처를 프롬프트에 주입 →
    LLM은 검색 없이 그 출처만 인용 → 사후 tier 보정·T3 FLAG. server_tool 모드: 기존
    Anthropic 웹검색 서버툴 경로(web_search=True) 유지.
    """
    gateway = config.gateway_search_enabled()
    sources = _prefetch_sources(field, target_id, region) if gateway else None
    prompt = prompt_loader.load_country_field_prompt(
        field, target_id, region, segment, sources=sources
    )
    data = bedrock_client.generate_structured(
        prompt,
        prompt_loader.country_json_schema(),
        web_search=not gateway,  # gateway 모드면 모델 자율 검색 끔(코드가 이미 검색)
        effort=_RESEARCH_EFFORT,
    )
    items = data.get("items") or []
    if not isinstance(items, list):
        raise ResearchError(f"분야 {field} 출력의 items가 배열이 아님")
    if gateway:
        items = _apply_tier_policy(items, sources or [])
    return items


def _resolve_country_meta(target_id: str, region: str) -> dict:
    """국가 코드 → 메타(국가명·한글명·권역·통화·대표좌표) 해석.

    우선순위: ① 기존 geo 참조(있으면 그대로 신뢰) → ② 경량 LLM 호출(웹검색 없이 모델
    상식만). LLM 실패 시 코드/인자만으로 최소 폴백. 좌표는 지도 마커 자동 표시에 쓰인다.
    """
    geo = geo_reference.get_country(target_id) or {}
    # geo에 좌표·이름이 이미 다 있으면 LLM 호출 생략(비용 절감).
    if geo.get("lon") is not None and geo.get("lat") is not None and geo.get("name_ko"):
        return {
            "country": geo.get("name") or target_id,
            "country_ko": geo.get("name_ko"),
            "region": region or geo.get("region") or "",
            "currency": geo.get("currency"),
            "lon": geo.get("lon"),
            "lat": geo.get("lat"),
            "iso_numeric": geo.get("iso_numeric"),
        }

    prompt = (
        f"ISO alpha-2 국가코드 '{target_id}'에 대한 메타데이터를 JSON으로만 출력하라.\n"
        f"- country: 영문 국가명(world-atlas 표기, 예: 'United Kingdom', 'Nigeria')\n"
        "- country_ko: 한글 국가명\n"
        f"- region: 다음 중 하나로만 분류 {list(_REGION_ENUM)}\n"
        "- currency: ISO 4217 통화코드(예: NGN)\n"
        "- lon, lat: 국가 대표 중심 경도·위도(지도 마커용, 소수점 도 단위)\n"
        "- iso_numeric: ISO 3166-1 numeric 3자리 문자열(예: '566')\n"
        "추측이 불가능하면 합리적 근사값을 쓰되 좌표는 반드시 채운다. 순수 JSON만 출력."
    )
    meta: dict = {}
    try:
        meta = bedrock_client.generate_structured(prompt, _COUNTRY_META_SCHEMA)
    except bedrock_client.BedrockError as exc:
        _log.warning("국가 %s 메타 해석 실패(폴백 사용): %s", target_id, exc)

    # geo(있으면) > LLM > 인자/코드 순으로 병합. region 인자가 명시되면 최우선.
    resolved_region = region or meta.get("region") or geo.get("region") or ""
    if resolved_region not in _REGION_ENUM and meta.get("region") in _REGION_ENUM:
        resolved_region = meta["region"]
    return {
        "country": geo.get("name") or meta.get("country") or target_id,
        "country_ko": geo.get("name_ko") or meta.get("country_ko"),
        "region": resolved_region,
        "currency": geo.get("currency") or meta.get("currency"),
        "lon": geo.get("lon") if geo.get("lon") is not None else meta.get("lon"),
        "lat": geo.get("lat") if geo.get("lat") is not None else meta.get("lat"),
        "iso_numeric": geo.get("iso_numeric") or meta.get("iso_numeric"),
    }


def _run_country_multi_agent(
    target_id: str,
    region: str,
    segment: Optional[str],
    progress_cb: ProgressCb = None,
    agent_cb: AgentCb = None,
) -> ResearchResult:
    """국가 리서치 — 상품·규제·시스템·시장 4개 분야 agent 병렬 딥리서치 → 병합.

    각 분야는 웹검색 기반 외부 딥리서치를 수행하고 자기 items[]만 출력한다.
    병합 후 5번째 단계에서 overall_insight를 합성해 최상위 메타와 함께 country JSON을 만든다.
    """
    if progress_cb:
        progress_cb("calling_bedrock", f"국가 {target_id} 4개 분야 딥리서치")

    fields = list(prompt_loader.FIELDS)
    if agent_cb:
        for f in fields:
            agent_cb(f, "queued", 0)

    merged_items: list = []
    errors: list = []
    # 4개 분야를 병렬 실행. 각 워커는 시작 시 running, 완료 시 succeeded/failed 보고.
    with ThreadPoolExecutor(max_workers=len(fields)) as pool:
        future_to_field = {}
        for f in fields:
            if agent_cb:
                agent_cb(f, "running", 10)
            future_to_field[pool.submit(_run_field, f, target_id, region, segment)] = f
        for fut in as_completed(future_to_field):
            f = future_to_field[fut]
            try:
                items = fut.result()
                merged_items.extend(items)
                if agent_cb:
                    agent_cb(f, "succeeded", 100)
                _log.info("분야 %s 완료: %d items", f, len(items))
            except Exception as exc:  # noqa: BLE001 — 한 분야 실패가 전체를 죽이지 않게
                errors.append((f, str(exc)))
                if agent_cb:
                    # 실패는 0%로 표기(완료 아님). 100%로 두면 실패인데 완료처럼 보임.
                    agent_cb(f, "failed", 0)
                _log.warning("분야 %s 실패: %s", f, exc)

    if not merged_items:
        raise ResearchError(f"모든 분야 리서치 실패: {errors}")

    # 5번째 단계: overall_insight 합성(웹검색 불필요 — 조사된 항목만 근거).
    if progress_cb:
        progress_cb("result_gen", f"국가 {target_id} 종합 인사이트 생성")
    overall_insight = ""
    try:
        oi = bedrock_client.generate_structured(
            prompt_loader.build_overall_insight_prompt(target_id, merged_items, segment),
            prompt_loader.overall_insight_schema(),
        )
        overall_insight = oi.get("overall_insight", "")
    except bedrock_client.BedrockError as exc:
        _log.warning("overall_insight 생성 실패(빈 값으로 진행): %s", exc)

    # 국가 메타 해석(국가명·한글명·권역·통화·대표좌표) — 마커 자동 표시 + 카탈로그 표기용.
    meta = _resolve_country_meta(target_id, region)
    data = {
        "code": target_id,
        "country": meta.get("country") or target_id,
        "country_ko": meta.get("country_ko"),
        "region": meta.get("region") or region or "",
        "currency": meta.get("currency"),
        "is_baseline": False,
        "schema_version": "1.0",
        "fetched_by": "ai",
        "overall_insight": overall_insight,
        "items": merged_items,
    }
    schema_version = _validate("country", data)
    if progress_cb:
        progress_cb("saving", f"국가 {target_id} 저장")
    _, latest = storage_resolver.save_research("country", target_id, data)
    # geo 참조에 upsert — 다음 카탈로그 조회부터 지도 마커가 자동으로 뜬다.
    try:
        geo_reference.upsert_country(
            target_id,
            name=data["country"],
            name_ko=data.get("country_ko"),
            region=data.get("region") or None,
            lon=meta.get("lon"),
            lat=meta.get("lat"),
            iso_numeric=meta.get("iso_numeric"),
        )
    except Exception as exc:  # noqa: BLE001 — geo upsert 실패가 리서치 성공을 무르게 하지 않게
        _log.warning("국가 %s geo upsert 실패(마커 자동표시 누락 가능): %s", target_id, exc)
    return ResearchResult("country", target_id, latest, schema_version)


def run(
    domain: str,
    target_id: str,
    segment: Optional[str] = None,
    member_codes: Optional[List[str]] = None,
    region: Optional[str] = None,
    progress_cb: ProgressCb = None,
    agent_cb: AgentCb = None,
) -> ResearchResult:
    """리서치 수행 엔트리. country/region 분기 — 둘 다 4-agent 딥리서치 파이프라인."""
    if domain == "country":
        return _run_country_multi_agent(
            target_id, region or "", segment, progress_cb, agent_cb
        )

    # region: 누락 멤버 국가 선행(Q6=A) — 각 멤버도 4-agent 파이프라인. 진행률은 step
    # 기반이며 멤버 선행 조사는 40~70% 구간을 멤버 수로 분할한다. 내부 country 파이프라인이
    # 자기 step(calling_bedrock/result_gen 등)을 그대로 보고하면 권역 percent를 덮어써
    # 진행이 튀므로(40↔85 역행), 멤버 조사 동안엔 progress_cb를 래핑해 members_progress로
    # 고정하고 percent는 해당 멤버의 하위 구간 안에서만 움직이게 한다.
    members = member_codes or []
    missing = [c for c in members if not storage_resolver.research_exists("country", c)]
    n = max(1, len(missing))
    # 국가 내부 step → 멤버 하위 구간 내 진척도(0~1) 근사.
    _inner_frac = {"calling_bedrock": 0.1, "result_gen": 0.6, "saving": 0.85, "done": 1.0}
    for idx, code in enumerate(missing):
        lo = 40 + int(30 * idx / n)
        hi = 40 + int(30 * (idx + 1) / n)
        if progress_cb:
            progress_cb(
                "members_progress",
                f"멤버 국가 {code} 선행 딥리서치 ({idx + 1}/{len(missing)})",
                lo,
            )

        def _member_progress(step: str, message: str, percent=None, *, _lo=lo, _hi=hi):
            # 내부 step을 members_progress 구간 안의 percent로 환산(권역 잡 percent 보존).
            frac = _inner_frac.get(step, 0.1)
            mapped = _lo + int((_hi - _lo) * frac)
            if progress_cb:
                progress_cb("members_progress", message, mapped)

        # agent_cb(분야 바)는 region 잡엔 agents[]가 없어 무시되므로 그대로 넘겨도 무해.
        _run_country_multi_agent(code, target_id, segment, _member_progress, agent_cb)

    if progress_cb:
        # 권역 종합 리서치 진입(70%). 단일 LLM 호출이라 내부 세분 진행은 없다.
        progress_cb("region_synth", f"권역 {target_id} 종합 리서치", 70)
    gateway = config.gateway_search_enabled()
    # 권역 레벨 선검색 — market 질의 템플릿을 권역명으로 재사용(저충실도, region 명세 잠정).
    region_sources = (
        _prefetch_sources("market", target_id, target_id) if gateway else None
    )
    prompt = prompt_loader.load_region_prompt(
        target_id, members, segment, sources=region_sources
    )
    data = bedrock_client.generate_structured(
        prompt,
        prompt_loader.region_json_schema(),
        web_search=not gateway,
        effort=_RESEARCH_EFFORT,
    )
    data.setdefault("code", target_id)
    schema_version = _validate("region", data)
    if progress_cb:
        progress_cb("saving", f"권역 {target_id} 저장")
    _, latest = storage_resolver.save_research("region", target_id, data)
    return ResearchResult("region", target_id, latest, schema_version)
