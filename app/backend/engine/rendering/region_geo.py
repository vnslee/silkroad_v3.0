#!/usr/bin/env python3
"""권역 지도(실제 국경) 생성 — 순수 Python topojson 디코더 + equirectangular 투영.

world-atlas countries-50m.json(quantized TopoJSON)을 의존성 없이 디코딩해
권역 소속 국가들의 국경을 SVG path 로 만들고, 그 권역 bounding box 에 맞춰
클로즈업(viewBox)한다. 진출상태별 색은 호출측에서 fill 로 주입.

region_detail_rendering_engine.region_map() 이 사용. d3/shapely 등 외부 의존성 0.
"""
import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_TOPO_PATH = os.path.join(_BASE, "assets", "countries-50m.json")

# 국가코드(ISO A2) → world-atlas properties.name. 권역 멤버 매칭용.
CODE_TOPONAME = {
    "ES": "Spain", "PL": "Poland", "DE": "Germany", "FR": "France", "IT": "Italy",
    "GB": "United Kingdom", "UK": "United Kingdom", "AT": "Austria", "DK": "Denmark",
    "CZ": "Czechia", "HU": "Hungary", "NL": "Netherlands", "PT": "Portugal",
    "BE": "Belgium", "SE": "Sweden", "NO": "Norway", "FI": "Finland", "IE": "Ireland",
    "CH": "Switzerland", "RO": "Romania", "GR": "Greece", "SK": "Slovakia",
    "US": "United States of America", "CA": "Canada", "MX": "Mexico",
    "PR": "Puerto Rico",
    "BR": "Brazil", "AR": "Argentina", "CL": "Chile", "CO": "Colombia", "PE": "Peru",
    "AU": "Australia", "NZ": "New Zealand", "JP": "Japan", "KR": "South Korea",
    "SG": "Singapore", "IN": "India", "CN": "China", "VN": "Vietnam",
    "ID": "Indonesia", "TH": "Thailand", "MY": "Malaysia", "PH": "Philippines",
}

_topo_cache = None


def _load_topo():
    global _topo_cache
    if _topo_cache is None:
        with open(_TOPO_PATH, encoding="utf-8") as f:
            _topo_cache = json.load(f)
    return _topo_cache


def _decode_arc(arc, scale, translate):
    """quantized delta-encoded arc → [(lon, lat), ...] 절대 좌표."""
    x = y = 0
    out = []
    for dx, dy in arc:
        x += dx
        y += dy
        out.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
    return out


def _arcs_to_rings(arcs_idx, arcs):
    """폴리곤 ring 인덱스 배열 → 좌표 ring 리스트. 음수 인덱스는 역방향 arc."""
    rings = []
    for ring in arcs_idx:
        coords = []
        for ai in ring:
            if ai < 0:
                seg = arcs[~ai][::-1]  # ~ai = -ai-1, 역방향
            else:
                seg = arcs[ai]
            if coords and coords[-1] == seg[0]:
                coords.extend(seg[1:])
            else:
                coords.extend(seg)
        rings.append(coords)
    return rings


def _geometry_rings(geom, arcs):
    """Polygon/MultiPolygon geometry → [ring, ...] (모든 폴리곤의 외곽+홀)."""
    rings = []
    t = geom["type"]
    if t == "Polygon":
        rings.extend(_arcs_to_rings(geom["arcs"], arcs))
    elif t == "MultiPolygon":
        for poly in geom["arcs"]:
            rings.extend(_arcs_to_rings(poly, arcs))
    return rings


def region_paths(member_codes):
    """권역 멤버 국가코드 리스트 → {code: [ring(lonlat), ...]}.

    멤버 중 topojson 에 있는 국가만 반환(코드→name 매칭 실패 시 제외).
    """
    topo = _load_topo()
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]
    arcs = [_decode_arc(a, scale, translate) for a in topo["arcs"]]
    geoms = topo["objects"]["countries"]["geometries"]

    want = {}  # toponame → code
    for code in member_codes:
        name = CODE_TOPONAME.get(code) or CODE_TOPONAME.get(code.upper())
        if name:
            want[name] = code

    result = {}
    for g in geoms:
        name = (g.get("properties") or {}).get("name")
        if name in want:
            result[want[name]] = _geometry_rings(g, arcs)
    return result


def _ring_area(ring):
    """ring의 절대 면적(shoelace) — 본토 판별용."""
    a = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def build_region_map_svg(member_codes, fill_of, code_label=True, pad=0.12):
    """권역 클로즈업 국경 SVG 생성.

    member_codes: 권역 소속 국가코드 리스트
    fill_of(code) -> (fill, fg): 국가별 채움색·라벨 글자색
    반환: (svg_inner, view_box_str) — svg 내부 path/label 문자열과 viewBox.
    좌표 없으면 (None, None).

    해외영토(프랑스령 기아나 등)가 bbox·라벨을 왜곡하지 않도록:
    bbox 는 각국 '본토(최대 면적 ring)' 기준으로 계산하고, 라벨도 본토 centroid 에 둔다.
    (path 자체는 모든 ring 을 그려 섬·영토도 표시.)
    """
    paths = region_paths(member_codes)
    if not paths:
        return None, None

    parts = []
    centroids = {}
    mainland_xs, mainland_ys = [], []  # bbox 기준: 본토만
    for code, rings in paths.items():
        fill, fg = fill_of(code)
        rings = [r for r in rings if r]
        if not rings:
            continue
        # path: 모든 ring 그림
        d = []
        for ring in rings:
            pts = [f"{lon:.2f},{-lat:.2f}" for lon, lat in ring]
            d.append("M" + "L".join(pts) + "Z")
        parts.append(
            f'<path d="{"".join(d)}" fill="{fill}" stroke="#ffffff" '
            f'stroke-width="0.18" stroke-linejoin="round"/>'
        )
        # 본토 = 최대 면적 ring → bbox·centroid 기준
        main = max(rings, key=_ring_area)
        mxs = [lon for lon, _ in main]
        mys = [-lat for _, lat in main]
        mainland_xs.extend(mxs)
        mainland_ys.extend(mys)
        centroids[code] = (sum(mxs) / len(mxs), sum(mys) / len(mys), fg)

    minx, maxx = min(mainland_xs), max(mainland_xs)
    miny, maxy = min(mainland_ys), max(mainland_ys)
    w = maxx - minx or 1
    h = maxy - miny or 1
    px, py = w * pad, h * pad
    vb = f"{minx - px:.2f} {miny - py:.2f} {w + 2 * px:.2f} {h + 2 * py:.2f}"
    # stroke-width 는 path 에서 고정(0.18)으로 — bbox 변동과 무관하게 일정한 국경선.

    if code_label:
        fs = max(w, h) * 0.035
        for code, (cx, cy, fg) in centroids.items():
            parts.append(
                f'<text x="{cx:.2f}" y="{cy + fs * 0.35:.2f}" text-anchor="middle" '
                f'font-size="{fs:.2f}" font-weight="700" fill="{fg}" '
                f'paint-order="stroke" stroke="rgba(255,255,255,0.85)" '
                f'stroke-width="{fs * 0.12:.3f}">{code}</text>'
            )

    return "".join(parts), vb
