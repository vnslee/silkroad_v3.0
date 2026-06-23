#!/usr/bin/env python3
"""권역(region) 상세화면 렌더링 엔진 (P2)

- 권역 리서치 데이터(data/research/region/<REGION>/<REGION>_latest.json)를 입력으로 받아,
  웹 디자인 스펙(architecture/design/stitch/html/P2.html, "권역 정보")에 맞춘
  완성형 standalone HTML 상세화면으로 렌더링한다.
- 구성(스펙 §4 P2): 권역명 → KPI 카드 → 기진출 국가 리스트 →
  진출 예정국 quick-win 순위(유사도/난이도/종합점수) → 권역 차트.
- 데이터 주도(region-agnostic) — 어떤 권역 리서치 데이터든 동일 로직으로 렌더.
- 입력: data/research/region/<REGION>/<REGION>_latest.json
- 출력: detail/region/<REGION>/html/DTL_<REGION>_<nnn>.html (생성마다 순번 증가)

⚠️ 권역 리서치 데이터·스키마는 잠정(ROADMAP 2차에서 정식화). 상세는 storage/detail/README.md.
스코어링/계산은 일절 하지 않고 "표현"만 담당한다 (관심사 분리).
포맷·차트 헬퍼는 region_report_rendering_engine(rre)을 재사용한다.
"""
import json, os, sys, glob

BASE = os.path.dirname(os.path.abspath(__file__))
# engine/rendering → app/backend  (storage가 위치한 backend 루트)
BACKEND = os.path.dirname(os.path.dirname(BASE))
STORAGE = os.path.join(BACKEND, "storage")
DATA = os.path.join(STORAGE, "data")
DETAIL = os.path.join(STORAGE, "detail")

# 같은 rendering/ 폴더의 포맷·차트 헬퍼 재사용 (중복 작성 금지)
sys.path.insert(0, BASE)
import render_helpers as rre  # noqa: E402
import region_geo  # noqa: E402  실제 국경 지도(topojson) 생성

TPL_PATH = os.path.join(BASE, "templates", "region_detail_template.html")


# ─────────────────────────────────────────────────────────────────────────────
# 어댑터 (3-소스 병합) — 렌더 입력(kpis/entered/candidate/items)을 세 소스에서 조립.
#   A. 리서치 스냅샷(<REGION>_latest.json)  B. 권역 퀵윈 보고서(report/region/.../data)
#   C. 사내 룰셋(internal_latest.json)
# 계산은 하지 않는다 — 이미 산출된 값을 읽어 표현용 dict로 매핑할 뿐(관심사 분리).
# ─────────────────────────────────────────────────────────────────────────────
# 리서치/보고서 레이어 코드 → 사내설정 코드 (드리프트 별칭). 예: UK(리서치) → GB(사내).
_CODE_ALIAS = {"UK": "GB"}


def alias(code):
    return _CODE_ALIAS.get(code, code)


def load_internal():
    """사내 룰셋(country_status·country_assets 등) 로드. 실패 시 {} (그레이스풀)."""
    path = os.path.join(DATA, "internal", "internal_latest.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def load_latest_report(region):
    """권역 퀵윈 보고서 중 최신(최대 순번) JSON 로드. 없으면 {} (그레이스풀).

    region-agnostic — report/region/<region>/data 의 RPT_RGN_<region>_NNN.json 중
    순번이 가장 큰 파일을 고른다(_latest 심볼릭 없음 → 순번 max).
    """
    rptdir = os.path.join(STORAGE, "report", "region", region, "data")
    best, best_n = None, -1
    for p in glob.glob(os.path.join(rptdir, f"RPT_RGN_{region}_*.json")):
        stem = os.path.splitext(os.path.basename(p))[0]
        suf = stem.rsplit("_", 1)[-1]
        if suf.isdigit() and int(suf) > best_n:
            best, best_n = p, int(suf)
    if best is None:
        return {}
    try:
        with open(best, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _num(v):
    """None/비숫자 → 0 (score_color·bar·round 보호)."""
    return v if isinstance(v, (int, float)) else 0


def _country_names(gb_code, snapshot):
    """국가명(한글·영문) 해석 — ① 스냅샷(별칭 고려) ② country 리서치 파일 ③ 코드 폴백."""
    # ① 스냅샷 countries[] — 스냅샷 코드는 UK 표기일 수 있어 alias로 비교
    for c in snapshot.get("countries", []):
        if alias(c.get("code", "")) == gb_code:
            return c.get("country_ko", ""), c.get("country", ""), c.get("code", gb_code)
    # ② country 리서치 파일(data/research/country/<CODE>) — DE처럼 없을 수도 있음
    cf = os.path.join(DATA, "research", "country", gb_code, f"{gb_code}_latest.json")
    try:
        with open(cf, encoding="utf-8") as f:
            d = json.load(f)
        return d.get("country_ko", ""), d.get("country", ""), gb_code
    except Exception:
        # ③ 코드 폴백
        return gb_code, gb_code, gb_code


def build_entered(snapshot, internal):
    """기진출 국가 = 해당 권역(country_to_region) 중 사내 상태가 '운영중'인 것.

    진실의 소스는 internal(country_status·country_to_region) — 리서치 스냅샷에
    없는 국가(FR·DE 등)도 포함된다. 솔루션은 기준국 등 자산 등록국만 노출.
    """
    region = snapshot.get("code", "")
    status = internal.get("country_status", {})
    assets = internal.get("country_assets", {})
    c2r = internal.get("country_to_region", {})
    rows = []
    for gb, reg in c2r.items():
        if reg != region or status.get(gb) != "운영중":
            continue
        name_ko, name_en, disp = _country_names(gb, snapshot)
        a = assets.get(gb, {})
        rows.append({
            "code": disp,
            "name_ko": name_ko,
            "name_en": name_en,
            "status": status.get(gb, "-"),
            "solution": a.get("solution", "—"),
            "products": a.get("products", []),
            "since": a.get("since", "—"),  # country_assets[*].since
        })
    return rows


def _quadrant_label(band):
    b = _num(band)
    if b >= 60:
        return "선별 후보"
    if b >= 40:
        return "기회 탐색"
    return "관망"


def build_candidates(report, snapshot):
    """진출 예정국 후보 = 퀵윈 보고서의 랭킹된(비제외) 행. 점수는 보고서 산출값 재사용."""
    rows = (report.get("tabs", {}).get("quickwin", {}) or {}).get("rows", [])
    ko = {c.get("code"): c.get("country_ko", "") for c in snapshot.get("countries", [])}
    out = []
    for r in rows:
        if r.get("excluded") or r.get("rank") is None:
            continue  # baseline·killswitch 탈락 행 제외
        code = r.get("country", "")
        out.append({
            "quick_win_rank": r.get("rank"),
            "code": code,
            "name_ko": ko.get(code) or r.get("country_name", ""),
            "similarity": _num(r.get("it_similarity")),
            "attractiveness": _num(r.get("attractiveness")),
            "composite_score": _num(r.get("quickwin_raw")),
            "quick_win": _num(r.get("quickwin_band")) >= 70,
            "quadrant": _quadrant_label(r.get("quickwin_band")),
        })
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 상단 KPI 3카드 (mockup) — 분석 후보국 / Quick-win 최우선 / 킬스위치 탈락
# ─────────────────────────────────────────────────────────────────────────────
def kpi_cards(data):
    candidates = data.get("candidate_countries", [])
    n_candidates = len(candidates)
    n_quickwin = sum(1 for r in candidates if r.get("quick_win"))
    # 킬스위치 탈락 — 보고서 executive_summary 우선, 없으면 quickwin rows의 killswitch_excluded 카운트
    es = _executive(data)
    failed = (es.get("core_conclusion") or {}).get("killswitch_failed_count")
    if not isinstance(failed, int):
        rows = (data.get("_report", {}).get("tabs", {}).get("quickwin", {}) or {}).get("rows", [])
        failed = sum(1 for r in rows if r.get("killswitch_excluded"))

    def card(value, label, color):
        return (
            '<div class="bg-surface-container-lowest border border-surface-border rounded-[14px] '
            'p-md text-center">'
            f'<div class="font-mono text-[34px] font-bold leading-none" style="color:{color}">{value}</div>'
            f'<div class="font-body-md text-[14px] text-[#6B7280] mt-[6px]">{rre.esc(label)}</div></div>')

    return ('<div class="grid grid-cols-3 gap-sm">'
            + card(n_candidates, "분석 후보국", "#3F6CB4")
            + card(n_quickwin, "Quick-win 최우선", "#4F8A6D")
            + card(failed, "킬스위치 탈락", "#14171C")
            + '</div>')


# ─────────────────────────────────────────────────────────────────────────────
# 보고서 생성 CTA — 다크 카드 (mockup, 가로 배치)
# ─────────────────────────────────────────────────────────────────────────────
def report_cta(data):
    en = data.get("region", data.get("code", ""))
    ko = data.get("region_ko", "")
    name = ko or en
    return (
        '<div class="bg-primary rounded-2xl p-lg text-white flex items-center justify-between gap-lg flex-wrap">'
        '<div><div class="font-headline-md text-[15px] font-bold">권역 진단 보고서</div>'
        f'<div class="font-body-sm text-[12.5px] mt-[6px] leading-[1.5]" style="color:#AEB6C4">'
        f'{rre.esc(name)} 권역 비교 진단 및 Quick-win 매트릭스를 생성합니다.</div></div>'
        '<div class="flex gap-[9px] shrink-0">'
        '<div class="rounded-[11px] px-[18px] py-[11px] font-body-sm text-[13.5px] font-semibold whitespace-nowrap cursor-pointer" '
        'style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)">기존 보고서</div>'
        '<div class="rounded-[11px] px-[18px] py-[11px] font-body-md text-[14px] font-bold whitespace-nowrap cursor-pointer" '
        'style="background:#3F6CB4;box-shadow:0 6px 18px rgba(63,108,180,.4)">새 보고서 생성 →</div>'
        '</div></div>')


# ─────────────────────────────────────────────────────────────────────────────
# 빌더
# ─────────────────────────────────────────────────────────────────────────────
# 권역별 도형 추상화 지도 좌표 — viewBox 0..100 기준 대략적 지리 위치.
# 좌표 없는 권역은 region_map에서 격자(grid) 폴백 → region-agnostic.
_MAP_COORDS = {
    "EU": {
        "GB": (20, 26), "DK": (44, 18), "NL": (37, 35), "DE": (50, 40),
        "PL": (68, 32), "CZ": (60, 47), "HU": (72, 53), "AT": (57, 57),
        "FR": (30, 55), "IT": (52, 70), "ES": (22, 76), "PT": (10, 74),
    },
}
# 진출상태 → (노드 색, 글자색, 범례 라벨)  — Kinetic Enterprise 토큰만 사용
_MAP_STATE = {
    "운영중":  ("#3f6cb4", "#ffffff", "운영중"),   # secondary
    "준비중":  ("#6e97d6", "#101622", "준비중"),   # secondary-container
    "_미진출": ("#eef0f2", "#3b3f46", "미진출/후보"),  # surface-variant / on-surface-variant
}


def _region_card(region, svg_inner, view_box, aria, extra_class=""):
    """권역 지도 카드 chrome(제목·범례·컨테이너)을 공통으로 생성."""
    legend = "".join(
        '<span class="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant">'
        f'<span class="inline-block w-3 h-3 rounded-full" style="background:{c}"></span>{rre.esc(lbl)}</span>'
        for c, _fg, lbl in _MAP_STATE.values())
    return (
        '<div class="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">'
        '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold mb-md flex items-center gap-sm">'
        '<span class="material-symbols-outlined text-secondary text-[20px]">map</span>권역 지도</h3>'
        '<div class="flex-1 flex items-center justify-center min-h-[260px]">'
        f'<svg viewBox="{view_box}" preserveAspectRatio="xMidYMid meet" '
        f'class="w-full h-full max-h-[300px]{extra_class}" role="img" aria-label="{rre.esc(aria)}">{svg_inner}</svg></div>'
        f'<div class="flex flex-wrap gap-md mt-md pt-md border-t border-surface-border">{legend}</div>'
        '</div>')


def region_map(data):
    """권역 지도 — 소속 국가의 실제 국경(topojson)을 클로즈업해 그리고
    진출상태별로 채움색 구분. topojson 매칭 국가가 없으면 도형 노드 지도로 폴백."""
    internal = data.get("_internal", {})
    region = data.get("code", "")
    c2r = internal.get("country_to_region", {})
    status = internal.get("country_status", {})
    members = [c for c, r in c2r.items() if r == region]
    if not members:
        return ""

    def state_key(code):
        s = status.get(alias(code))
        return s if s in ("운영중", "준비중") else "_미진출"

    def fill_of(code):
        fill, fg, _ = _MAP_STATE[state_key(code)]
        return fill, fg

    # 1순위: 실제 국경 지도
    svg_inner, view_box = region_geo.build_region_map_svg(members, fill_of)
    if svg_inner:
        return _region_card(region, svg_inner, view_box,
                            f"{region} 권역 진출 상태 지도(실제 국경)")

    # 폴백: 도형 노드 지도 (topojson 미매칭 권역)
    coords = _MAP_COORDS.get(region, {})
    if not coords:
        cols = 4
        coords = {c: (12 + (i % cols) * 26, 18 + (i // cols) * 24)
                  for i, c in enumerate(members)}
    nodes = []
    for code in members:
        x, y = coords.get(code, (50, 50))
        fill, fg, _ = _MAP_STATE[state_key(code)]
        nodes.append(
            f'<g><circle cx="{x}" cy="{y}" r="6.4" fill="{fill}" stroke="#f7f8fa" stroke-width="1"/>'
            f'<text x="{x}" y="{y + 2.1}" text-anchor="middle" font-size="4.4" '
            f'font-weight="700" fill="{fg}">{rre.esc(code)}</text></g>')
    return _region_card(region, "".join(nodes), "0 10 82 76",
                        f"{region} 권역 진출 상태 지도")


def _products_cell(products):
    """상품명 리스트 → 작은 칩 배지. 비면 '—'."""
    if not products:
        return '<span class="text-on-surface-variant">—</span>'
    return '<div class="flex flex-wrap gap-1">' + "".join(
        rre.badge(p, "#eaf0f8", "#2c4c86") for p in products) + '</div>'


def entered_list(data):
    rows = data.get("entered_countries", [])
    if not rows:
        return ""
    body = "".join(
        '<tr class="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors">'
        f'<td class="p-sm font-mono text-xs text-on-surface">{rre.esc(r.get("code", ""))}</td>'
        f'<td class="p-sm text-on-surface">{rre.esc(r.get("name_ko", ""))} '
        f'<span class="text-on-surface-variant">{rre.esc(r.get("name_en", ""))}</span></td>'
        f'<td class="p-sm">{rre.badge(r.get("status", "-"), "#eaf0f8", "#3f6cb4")}</td>'
        f'<td class="p-sm text-on-surface-variant">{rre.esc(r.get("solution", "—"))}</td>'
        f'<td class="p-sm">{_products_cell(r.get("products", []))}</td>'
        f'<td class="p-sm text-right text-on-surface-variant">{rre.esc(r.get("since", "—"))}</td>'
        '</tr>' for r in rows)
    return (
        '<div class="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">'
        '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold mb-md flex items-center gap-sm">'
        '<span class="material-symbols-outlined text-secondary text-[20px]">flag</span>기진출 국가</h3>'
        '<table class="w-full text-left border-collapse font-body-md text-body-md">'
        '<thead><tr class="bg-surface-light border-b border-surface-border">'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">Code</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">국가</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">상태</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">솔루션</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">상품</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold text-right">진출연도</th>'
        f'</tr></thead><tbody>{body}</tbody></table></div>')


def quickwin_table(data):
    """진출 예정국 quick-win 순위 — 유사도(IT준비도)/매력도(BIZ매력도)/종합점수."""
    rows = sorted(data.get("candidate_countries", []),
                  key=lambda r: r.get("quick_win_rank", 999))
    if not rows:
        return ""

    def score_cell(v):
        col = rre.score_color(v)
        return (f'<td class="p-sm"><div class="flex items-center gap-xs min-w-[88px]">'
                f'<div class="flex-1">{rre.bar(v, 100, col)}</div>'
                f'<span class="font-label-md text-label-md font-semibold w-7 text-right shrink-0" style="color:{col}">{rre.fmt_num(round(v,1))}</span>'
                f'</div></td>')

    body = "".join(
        '<tr class="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors">'
        f'<td class="p-sm font-label-md text-label-md text-primary font-bold">{rre.esc(r.get("quick_win_rank", "—"))}</td>'
        f'<td class="p-sm text-on-surface whitespace-nowrap">{rre.esc(r.get("name_ko", ""))} '
        f'<span class="font-mono text-xs text-on-surface-variant">{rre.esc(r.get("code", ""))}</span></td>'
        f'{score_cell(r.get("composite_score", 0))}'
        f'<td class="p-sm">{rre.badge("퀵윈" if r.get("quick_win") else r.get("quadrant", "-"), "#e9f3ee" if r.get("quick_win") else "#eef0f2", "#4f8a6d" if r.get("quick_win") else "#3b3f46")}</td>'
        '</tr>' for r in rows)
    return (
        '<div class="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">'
        '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold mb-md flex items-center gap-sm">'
        '<span class="material-symbols-outlined text-secondary text-[20px]">leaderboard</span>진출 예정국 Quick-Win 순위</h3>'
        '<table class="w-full text-left border-collapse font-body-md text-body-md">'
        '<thead><tr class="bg-surface-light border-b border-surface-border">'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">#</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">국가</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">종합점수</th>'
        '<th class="p-sm font-label-md text-label-md text-outline font-semibold">판정</th>'
        f'</tr></thead><tbody>{body}</tbody></table></div>')


# 뉴스 카테고리 코드 → 한글 라벨 (값 있을 때만 칩 표시)
_NEWS_CAT_LABEL = {
    "auto_market": "자동차 시장",
    "regulation": "규제",
    "finance": "금융",
    "ev": "전동화",
    "macro": "거시경제",
}


def _src_badge(text):
    """출처 플래그 배지 — secondary 토큰만 사용(팔레트 정합)."""
    return ('<span class="font-label-sm text-label-sm text-secondary bg-secondary-fixed '
            f'px-2 py-0.5 rounded-full whitespace-nowrap">{rre.esc(text)}</span>')


def _executive(data):
    return (data.get("_report", {}).get("tabs", {}) or {}).get("executive_summary", {}) or {}


def news_panel(data):
    """외부 뉴스 스캔 — 카테고리 칩 + 헤드라인 링크 + 시사점(좌측 보더 강조).
    상단 우측(지도 옆) 배치용 — h-full로 지도와 높이 정렬."""
    news = [n for n in (_executive(data).get("external_news_scan") or {}).get("items", [])
            if n.get("headline")]
    if not news:
        return ('<div class="bg-surface rounded-lg p-lg border border-surface-border '
                'custom-shadow-level-2 flex flex-col h-full">'
                '<div class="flex items-center gap-sm mb-md">'
                '<span class="material-symbols-outlined text-secondary text-[20px]">newspaper</span>'
                '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold flex-1">외부 뉴스 스캔</h3></div>'
                '<p class="font-body-sm text-body-sm text-on-surface-variant">표시할 뉴스가 없습니다.</p></div>')
    items = []
    for n in news:
        cat = _NEWS_CAT_LABEL.get(n.get("news_category") or "")
        chip = (f'<span class="font-label-sm text-label-sm text-secondary bg-secondary-fixed '
                f'px-2 py-0.5 rounded mr-sm">{rre.esc(cat)}</span>' if cat else "")
        meta = " · ".join(x for x in (n.get("publisher"), n.get("date")) if x)
        sowhat = (f'<p class="font-body-sm text-body-sm text-on-surface-variant mt-xs '
                  f'pl-sm border-l-2 border-secondary">{rre.esc(n.get("so_what", ""))}</p>'
                  if n.get("so_what") else "")
        items.append(
            '<div class="border-b border-surface-border last:border-0 py-md first:pt-0">'
            f'<div class="mb-xs">{chip}'
            f'<a href="{rre.esc(n.get("url", "#"))}" target="_blank" rel="noopener" '
            f'class="font-label-md text-label-md text-primary font-semibold hover:underline '
            f'focus-visible:underline">{rre.esc(n.get("headline", ""))}</a></div>'
            f'{sowhat}'
            f'<span class="font-label-sm text-label-sm text-outline block mt-xs">{rre.esc(meta)}</span>'
            '</div>')
    return (
        '<div class="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">'
        '<div class="flex items-center gap-sm mb-md">'
        '<span class="material-symbols-outlined text-secondary text-[20px]">newspaper</span>'
        '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold flex-1">외부 뉴스 스캔</h3>'
        f'{_src_badge("NEWS")}</div>'
        f'<div class="flex-1 overflow-y-auto max-h-[320px] pr-xs">{"".join(items)}</div></div>')


def region_insight(data):
    """권역 인사이트 — 보고서 executive_summary의 핵심 결론(why_top1) 리드 +
    ai_cross_insight 교차분석 불릿(번호 마커). 표현만(계산 없음)."""
    es = _executive(data)
    lead = ((es.get("core_conclusion") or {}).get("why_top1") or {}).get("ko", "").strip()
    cross = [i for i in (es.get("ai_cross_insight") or {}).get("insights", [])
             if (i.get("ko") or i.get("en"))]
    if not lead and not cross:
        return ""

    lead_html = (
        '<div class="rounded-lg bg-secondary-fixed/40 p-md mb-md flex gap-sm items-start">'
        '<span class="material-symbols-outlined text-secondary text-[22px] mt-[1px]">emoji_events</span>'
        f'<p class="font-body-lg text-body-lg text-on-surface font-semibold m-0">{rre.esc(lead)}</p></div>'
    ) if lead else ""

    rows = "".join(
        '<div class="flex gap-md items-start rounded-lg bg-surface-light p-md">'
        '<span class="font-headline-md text-[18px] leading-[28px] text-secondary font-bold '
        f'shrink-0 w-7 text-center">{n + 1}</span>'
        f'<p class="font-body-md text-body-md text-on-surface m-0">{rre.esc((i.get("ko") or i.get("en")).strip())}</p>'
        '</div>' for n, i in enumerate(cross))
    rows_html = f'<div class="flex flex-col gap-sm">{rows}</div>' if cross else ""

    return (
        '<div class="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">'
        '<div class="flex items-center gap-sm mb-md">'
        '<span class="material-symbols-outlined text-secondary text-[20px]">psychology</span>'
        '<h3 class="font-headline-md text-[20px] leading-[28px] text-primary font-bold flex-1">권역 인사이트</h3>'
        f'{_src_badge("AI 분석")}</div>'
        f'{lead_html}{rows_html}</div>')


# ─────────────────────────────────────────────────────────────────────────────
# HTML 렌더
# ─────────────────────────────────────────────────────────────────────────────
def render_html(data):
    code = data.get("code", "")
    en = data.get("region", code)
    ko = data.get("region_ko", "")
    title = f"{ko}({en}) 권역 상세 — 진출 진단"
    footer = (f"리서치 데이터 — {rre.esc(code)} · schema v{rre.esc(data.get('schema_version', '-'))} · "
              f"조사 {rre.esc(rre.fmt_dt(data.get('fetched_at', '')))} {rre.freshness_badge(data.get('fetched_at', ''))}")

    with open(TPL_PATH, encoding="utf-8") as f:
        tpl = f.read()

    return (tpl
            .replace("{{PAGE_TITLE}}", rre.esc(title))
            .replace("{{REGION_EN}}", rre.esc(en))
            .replace("{{REGION_KO}}", rre.esc(ko))
            .replace("{{KPI_CARDS}}", kpi_cards(data))
            .replace("{{REGION_MAP}}", region_map(data))
            .replace("{{QUICKWIN_TABLE}}", quickwin_table(data))
            .replace("{{REGION_INSIGHT}}", region_insight(data))
            .replace("{{REPORT_CTA}}", report_cta(data))
            .replace("{{FOOTER_META}}", footer))


# ─────────────────────────────────────────────────────────────────────────────
# 입출력
# ─────────────────────────────────────────────────────────────────────────────
def load_detail(region, version=None):
    datadir = os.path.join(DATA, "research", "region", region)
    if version:
        path = os.path.join(datadir, f"{region}_{version}.json")
    else:
        path = os.path.join(datadir, f"{region}_latest.json")
    if not os.path.exists(path):
        cand = sorted(glob.glob(os.path.join(datadir, f"{region}_*.json")))
        if not cand:
            raise SystemExit(f"[안내] region '{region}' 리서치 데이터 없음 — data/research/region/{region}/ 확인 필요 (잠정 스키마, README 참조).")
        path = cand[-1]
    with open(path, encoding="utf-8") as f:
        snapshot = json.load(f)

    # 3-소스 병합 — 스냅샷(A)에 보고서(B)·사내룰셋(C)을 합쳐 렌더 입력 키를 채운다.
    internal = load_internal()
    report = load_latest_report(region)
    data = dict(snapshot)  # region/region_ko/code/footer 메타 보존
    entered = build_entered(snapshot, internal)
    candidates = build_candidates(report, snapshot)
    data["entered_countries"] = entered
    data["candidate_countries"] = candidates
    data["_report"] = report      # 뉴스가 executive_summary 참조
    data["_internal"] = internal  # 권역 지도가 country_to_region·status 참조
    return data, path


def render(region="EU", version=None):
    data, src = load_detail(region, version)
    out_html = render_html(data)

    outdir = os.path.join(DETAIL, "region", region, "html")
    os.makedirs(outdir, exist_ok=True)
    # 메인 화면에서 생성할 때마다 다음 순번(DTL_<REGION>_nnn.html)을 부여 — 기존 개수 기준
    existing = glob.glob(os.path.join(outdir, f"DTL_{region}_*.html"))
    seq = len(existing) + 1
    out = os.path.join(outdir, f"DTL_{region}_{seq:03d}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(out_html)

    print(f"[{region}] 권역 상세화면 렌더 완료 — 입력 {os.path.relpath(src, STORAGE)}")
    print(f"  기진출 {len(data.get('entered_countries', []))}개 · 후보 {len(data.get('candidate_countries', []))}개")
    print(f"→ {os.path.relpath(out, STORAGE)}")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    region = args[0] if args else "EU"
    version = args[1] if len(args) > 1 else None
    render(region, version)
