#!/usr/bin/env python3
"""국가(country) 상세화면 렌더링 엔진 (P1)

- AI 리서치 국가 데이터(data/research/country/<CODE>/<CODE>_latest.json)를 입력으로 받아,
  웹 디자인 스펙(architecture/design/stitch/html/P1.html, "국가 정보")에 맞춘
  완성형 standalone HTML 상세화면으로 렌더링한다.
- 구성(스펙 §4 P1): 국기·국가명·진출여부 → 국가 일반(통화·시장규모 등) +
  시계열 차트 + 시장/핵심규제/특화요건·시스템 섹션.
- 데이터 주도(country-agnostic) — 어떤 국가 리서치 데이터든 동일 로직으로 렌더.
- 입력: data/research/country/<CODE>/<CODE>_latest.json
- 출력: detail/country/<CODE>/html/DTL_<CODE>_<nnn>.html (생성마다 순번 증가)

스코어링/계산은 일절 하지 않고 "표현"만 담당한다 (관심사 분리).
포맷·차트 헬퍼는 render_helpers(rre)를 재사용한다.
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

TPL_PATH = os.path.join(BASE, "templates", "country_detail_template.html")


# ─────────────────────────────────────────────────────────────────────────────
# 공통 카드 셸 — mockup 카드 스타일(흰 배경·#EEF0F2 보더·radius 16·padding 22)
# ─────────────────────────────────────────────────────────────────────────────
def _card(inner, extra=""):
    return (f'<div class="bg-surface-container-lowest border border-surface-border '
            f'rounded-2xl p-[22px] {extra}">{inner}</div>')


def _card_title(text, right_html=""):
    return (f'<div class="flex justify-between items-center mb-md">'
            f'<div class="font-headline-md text-[15px] font-bold text-on-surface">{rre.esc(text)}</div>'
            f'{right_html}</div>')


# ─────────────────────────────────────────────────────────────────────────────
# 진출 상태 — country_status(internal_latest) 기준. (운영중→초록 / 미진출→레드 / 그외→회색)
# ─────────────────────────────────────────────────────────────────────────────
def _internal():
    path = os.path.join(DATA, "internal", "internal_latest.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _entry_status_text(code, internal):
    """진출 상태 문자열 — country_status 우선, 없으면 country_assets 보유=기진출."""
    status = (internal.get("country_status", {}) or {}).get(code)
    if status:
        return status
    return "기진출" if code in (internal.get("country_assets", {}) or {}) else "미진출"


def _status_badge(text):
    """상태 배지 — 운영중/기진출=초록, 미진출=레드, 그외=회색."""
    if text in ("운영중", "기진출"):
        bg, fg = "#E9F3EE", "#4F8A6D"
    elif text == "미진출":
        bg, fg = "#FDF0EE", "#C0533F"
    else:
        bg, fg = "#EEF0F2", "#3B3F46"
    return (f'<span class="inline-flex items-center font-label-sm text-[13px] font-semibold '
            f'rounded-md px-[9px] py-[3px]" style="background:{bg};color:{fg}">{rre.esc(text)}</span>')


# ─────────────────────────────────────────────────────────────────────────────
# 시장 추이 차트 — mockup 스타일(과거 실선 + 예측 점선, X축 연도, 예측 구분선, 범례)
#   매력도(시장규모·성장 계열) + 이용/금리 계열을 각자 정규화해 두 선으로 겹쳐 그린다.
# ─────────────────────────────────────────────────────────────────────────────
COMBINED_KEYS = ["오토금융/리스 시장규모", "신차 판매대수", "GDP 성장률"]


def _pick_series(data, n=2):
    """COMBINED_KEYS 순서대로 timeseries 보유 항목을 최대 n개 매칭(부분일치, 중복 방지)."""
    items = [it for it in data.get("items", []) if it.get("timeseries")]
    picked, used = [], set()
    for key in COMBINED_KEYS:
        if len(picked) >= n:
            break
        for it in items:
            if id(it) not in used and key in it.get("item", ""):
                picked.append(it)
                used.add(id(it))
                break
    return picked


def _smooth_path(xy):
    """좌표 리스트 [(x,y),...] → monotone-ish Catmull-Rom 베지어 path d.

    Recharts type="bump"/"monotone" 처럼 부드러운 곡선. 점이 1개면 빈 문자열,
    2개면 직선, 3개 이상이면 Catmull-Rom→cubic Bézier 변환(과도한 오버슈트 방지 텐션 1/6).
    """
    n = len(xy)
    if n == 0:
        return ""
    if n == 1:
        x, y = xy[0]
        return f"M{x:.1f} {y:.1f}"
    d = [f"M{xy[0][0]:.1f} {xy[0][1]:.1f}"]
    for i in range(n - 1):
        p0 = xy[i - 1] if i > 0 else xy[i]
        p1 = xy[i]
        p2 = xy[i + 1]
        p3 = xy[i + 2] if i + 2 < n else p2
        c1x = p1[0] + (p2[0] - p0[0]) / 6
        c1y = p1[1] + (p2[1] - p0[1]) / 6
        c2x = p2[0] - (p3[0] - p1[0]) / 6
        c2y = p2[1] - (p3[1] - p1[1]) / 6
        d.append(f"C{c1x:.1f} {c1y:.1f} {c2x:.1f} {c2y:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    return " ".join(d)


def _market_chart_svg(series):
    """라인차트 — Recharts 'glowing line chart' 스타일을 SVG로 이식.
    부드러운 곡선(monotone)·소프트 글로우 필터·선 아래 그라데이션 영역·연한 그리드.
    과거=실선, 예측=점선(같은 색), 예측 시작 구분선 + X축 연도 라벨.

    series=[{name,color,history,forecast}]. 각 시리즈 자체 정규화(추세 비교).
    """
    series = [s for s in series if len((s.get("history") or []) + (s.get("forecast") or [])) >= 2]
    if not series:
        return ""
    W, H = 320, 190
    L, R, T, B = 10, 10, 14, 36  # 좌/우/상/하 여백(하단=X축 라벨 공간)
    all_years = sorted({p["year"] for s in series for p in (s.get("history") or []) + (s.get("forecast") or [])})
    xmin, xmax = all_years[0], all_years[-1]

    def X(x):
        return L + (0 if xmax == xmin else (x - xmin) / (xmax - xmin)) * (W - L - R)

    # 예측 시작 연도(첫 시리즈 forecast 첫 해) — 구분 점선 위치
    fc_year = None
    for s in series:
        fc = s.get("forecast") or []
        if fc:
            fc_year = fc[0]["year"]
            break

    base_y = H - B

    # defs: 글로우 필터 + 영역 그라데이션 + 선 그리기 애니메이션용 wipe clip
    defs = ['<filter id="mc-glow" x="-20%" y="-20%" width="140%" height="140%">'
            '<feGaussianBlur stdDeviation="3.2" result="blur"/>'
            '<feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>']
    for i, s in enumerate(series):
        color = s.get("color") or "#3F6CB4"
        defs.append(
            f'<linearGradient id="mc-area-{i}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0%" stop-color="{color}" stop-opacity="0.22"/>'
            f'<stop offset="100%" stop-color="{color}" stop-opacity="0"/></linearGradient>')
    # 좌→우 그리기(reveal): 전체 플롯 영역을 덮는 rect를 scaleX 0→1 로 wipe.
    defs.append(f'<clipPath id="mc-reveal"><rect class="mc-wipe" x="0" y="0" '
                f'width="{W}" height="{H}"/></clipPath>')

    # 애니메이션 CSS — Recharts 라인 그리기 느낌(좌→우 wipe) + 끝점 pop.
    # prefers-reduced-motion 사용자는 즉시 완성 상태로(접근성).
    style = (
        '<style>'
        '@keyframes mc-wipe{from{transform:scaleX(0)}to{transform:scaleX(1)}}'
        '@keyframes mc-pop{0%{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.25)}'
        '100%{opacity:1;transform:scale(1)}}'
        '.mc-wipe{transform-box:fill-box;transform-origin:left center;'
        'animation:mc-wipe 1.15s cubic-bezier(.22,.61,.36,1) forwards}'
        '.mc-dot{transform-box:fill-box;transform-origin:center;opacity:0;'
        'animation:mc-pop .45s ease-out 1.05s forwards}'
        '@media (prefers-reduced-motion: reduce){'
        '.mc-wipe{animation:none;transform:scaleX(1)}'
        '.mc-dot{animation:none;opacity:1}}'
        '</style>')
    parts = [f'<defs>{"".join(defs)}</defs>', style]

    # 연한 가로 그리드(4분할) — Recharts CartesianGrid vertical=false 느낌 (정적)
    for g in range(5):
        gy = T + (base_y - T) * g / 4
        parts.append(f'<line x1="{L}" y1="{gy:.1f}" x2="{W-R}" y2="{gy:.1f}" '
                     f'stroke="#EEF0F2" stroke-width="1"/>')

    if fc_year is not None and xmin < fc_year <= xmax:
        fx = X(fc_year)
        parts.append(f'<line x1="{fx:.1f}" y1="{T-2}" x2="{fx:.1f}" y2="{base_y+1}" '
                     f'stroke="#E6E9EC" stroke-width="1" stroke-dasharray="4 3"/>')
        parts.append(f'<text x="{fx+6:.1f}" y="{T+6}" font-size="9" fill="#9AA0A8">▶ 예측</text>')

    # 선·영역은 reveal clip 그룹 안에서 좌→우로 그려진다. dot은 별도 pop.
    anim_parts = []
    dot_parts = []
    for i, s in enumerate(series):
        color = s.get("color") or "#3F6CB4"
        hist = s.get("history") or []
        fc = s.get("forecast") or []
        pts = hist + fc
        ys = [p["value"] for p in pts]
        ymin, ymax = min(ys), max(ys)

        def Y(v, ymin=ymin, ymax=ymax):
            return base_y - (0 if ymax == ymin else (v - ymin) / (ymax - ymin)) * (base_y - T)

        all_xy = [(X(p["year"]), Y(p["value"])) for p in pts]
        hist_xy = [(X(p["year"]), Y(p["value"])) for p in hist]
        link_xy = ([hist_xy[-1]] if hist_xy else []) + [(X(p["year"]), Y(p["value"])) for p in fc]

        # 영역 채움(전체 곡선 아래) — 그라데이션
        full_d = _smooth_path(all_xy)
        if full_d and len(all_xy) >= 2:
            area_d = (full_d + f" L{all_xy[-1][0]:.1f} {base_y:.1f}"
                      f" L{all_xy[0][0]:.1f} {base_y:.1f} Z")
            anim_parts.append(f'<path d="{area_d}" fill="url(#mc-area-{i})" stroke="none"/>')

        # 과거 실선(글로우)
        if hist_xy:
            anim_parts.append(f'<path d="{_smooth_path(hist_xy)}" fill="none" stroke="{color}" '
                              f'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" '
                              f'filter="url(#mc-glow)"/>')
        # 예측 점선
        if len(link_xy) >= 2:
            anim_parts.append(f'<path d="{_smooth_path(link_xy)}" fill="none" stroke="{color}" '
                              f'stroke-width="2.2" stroke-dasharray="5 3" opacity=".75" '
                              f'stroke-linecap="round" stroke-linejoin="round"/>')
        # 끝점 강조 dot(흰 테두리) — wipe 끝난 뒤 pop
        if all_xy:
            ex, ey = all_xy[-1]
            dot_parts.append(f'<circle class="mc-dot" cx="{ex:.1f}" cy="{ey:.1f}" r="3.4" '
                             f'fill="{color}" stroke="#ffffff" stroke-width="1.5"/>')

    parts.append(f'<g clip-path="url(#mc-reveal)">{"".join(anim_parts)}</g>')
    parts.extend(dot_parts)

    # X축 연도 라벨(처음·예측시작·마지막 + 균등 일부) — 정적
    label_years = sorted(set([xmin, xmax] + ([fc_year] if fc_year else []) + all_years[::2]))
    for yr in label_years:
        parts.append(f'<text x="{X(yr):.1f}" y="{H-12}" text-anchor="middle" font-size="9" '
                     f'fill="#9AA0A8">{yr}</text>')

    return (f'<svg viewBox="0 0 {W} {H}" class="w-full block" style="max-height:190px">'
            f'{"".join(parts)}</svg>')


def market_chart(data):
    picked = _pick_series(data, n=2)
    # 두 추세선은 hue가 확연히 다른 색으로 — 블루(매력도 계열) + 그린(tertiary, 판매/이용 계열).
    # 둘 다 Kinetic Enterprise 팔레트라 보고서 톤과 일치하면서 한눈에 구분된다.
    colors = ["#3F6CB4", "#4F8A6D"]
    series = []
    for i, it in enumerate(picked):
        ts = it.get("timeseries") or {}
        series.append({
            "name": it.get("item", ""),
            "color": colors[i % len(colors)],
            "history": ts.get("history"),
            "forecast": ts.get("forecast"),
        })
    svg = _market_chart_svg(series)
    if not svg:
        body = '<p class="font-body-sm text-body-sm text-on-surface-variant">시계열 데이터 없음.</p>'
        return _card(_card_title("핵심 시장 지표 추이") + body)
    # 범례 + 예측 구분 안내
    legend_items = "".join(
        '<span class="flex items-center gap-xs">'
        f'<span class="inline-block w-[18px] h-[3px] rounded-sm" style="background:{s["color"]}"></span>'
        f'<span class="font-body-sm text-[12px] text-[#6B7280]">{rre.esc(s["name"])}</span></span>'
        for s in series)
    legend = (f'<div class="flex flex-wrap gap-md mt-sm">{legend_items}'
              '<span class="flex items-center gap-xs opacity-60">'
              '<span class="inline-block w-[18px] h-[2px]" style="background:repeating-linear-gradient(to right,#9AA0A8 0 4px,transparent 4px 7px)"></span>'
              '<span class="font-body-sm text-[12px] text-[#6B7280]">예측 구간</span></span></div>')
    yr_range = ""
    if series:
        years = [p["year"] for p in (series[0].get("history") or []) + (series[0].get("forecast") or [])]
        if years:
            yr_range = (f'<span class="font-body-sm text-[11px] text-[#9AA0A8] bg-surface-variant '
                        f'rounded-md px-2 py-[3px]">{min(years)} → {max(years)}F</span>')
    return _card(_card_title("핵심 시장 지표 추이", yr_range)
                 + f'<div class="relative w-full overflow-hidden">{svg}</div>{legend}')


# ─────────────────────────────────────────────────────────────────────────────
# 경쟁 금융사 Top 5 + 합산 점유율 푸터 (로즈/나이팅게일 차트)
# ─────────────────────────────────────────────────────────────────────────────
# 슬라이스 색 — Kinetic Enterprise 팔레트(블루·그린·앰버·레드 + 중립)
_PIE_COLORS = ["#3F6CB4", "#4F8A6D", "#C08A2E", "#C0533F", "#7A8493"]


def _share_pct(s):
    """'약 20%' / '20%' → 20.0 (float), 실패 시 None."""
    import re
    m = re.search(r"(\d+(?:\.\d+)?)", str(s))
    return float(m.group(1)) if m else None


def _pie_chart(slices, size=176):
    """로즈(나이팅게일) 차트 — 각도는 균등(360/N), 반지름은 값에 비례.
    slices: [(label, value, color)]. 점유율이 클수록 바깥으로 더 길게 뻗는다."""
    import math
    cx = cy = size / 2
    r_max = size / 2
    n = len(slices)
    if not n:
        return ""
    vmax = max((v for _, v, _ in slices), default=0) or 1
    r_min = r_max * 0.30  # 가장 작은 값도 최소한 보이도록 안쪽 베이스
    sweep = 360.0 / n
    paths, ang = [], -90.0  # 12시 방향에서 시작
    for _label, value, color in slices:
        rr = r_min + (r_max - r_min) * (value / vmax)
        a0 = math.radians(ang)
        a1 = math.radians(ang + sweep)
        x0, y0 = cx + rr * math.cos(a0), cy + rr * math.sin(a0)
        x1, y1 = cx + rr * math.cos(a1), cy + rr * math.sin(a1)
        large = 1 if sweep > 180 else 0
        paths.append(
            f'<path d="M{cx},{cy} L{x0:.2f},{y0:.2f} '
            f'A{rr:.2f},{rr:.2f} 0 {large} 1 {x1:.2f},{y1:.2f} Z" '
            f'fill="{color}" stroke="#FFFFFF" stroke-width="1.5"/>')
        ang += sweep
    return (f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" '
            f'class="shrink-0" role="img" aria-label="경쟁 금융사 시장 점유율">'
            f'{"".join(paths)}</svg>')


def competitors_table(data):
    rows = None
    for it in data.get("items", []):
        if it.get("item") == "금융사 순위(Top 5)" and isinstance(it.get("value"), list):
            rows = it["value"]
            break
    if not rows:
        return ""
    top = rows[:5]
    # 파이 슬라이스 + 범례(점유율 파싱 가능한 행만 파이에 반영)
    slices = []
    for i, r in enumerate(top):
        pct = _share_pct(r.get("market_share"))
        if pct is not None:
            slices.append((r.get("name", ""), pct, _PIE_COLORS[i % len(_PIE_COLORS)]))
    pie = _pie_chart(slices) if slices else ""
    legend = "".join(
        '<div class="flex items-center gap-sm py-[7px]">'
        f'<span class="inline-block w-[11px] h-[11px] rounded-sm shrink-0" '
        f'style="background:{_PIE_COLORS[i % len(_PIE_COLORS)]}"></span>'
        f'<span class="font-mono font-bold text-[13px] text-[#101622] w-5 shrink-0">{rre.esc(r.get("rank", i + 1))}</span>'
        f'<span class="font-body-md text-[13.5px] text-on-surface break-words flex-1 min-w-0">{rre.esc(r.get("name", ""))}</span>'
        f'<span class="font-mono text-[13.5px] font-bold text-secondary whitespace-nowrap">{rre.esc(r.get("market_share", "—"))}</span>'
        '</div>' for i, r in enumerate(top))
    chart_block = (
        '<div class="flex flex-wrap items-center gap-lg">'
        f'<div class="flex items-center justify-center">{pie}</div>'
        f'<div class="flex-1 min-w-[180px]">{legend}</div>'
        '</div>')
    # 합산 점유율(파싱 가능한 값만)
    shares = [v for _n, v, _c in slices]
    footer = ""
    if shares:
        total = round(sum(shares))
        footer = (
            '<div class="mt-md px-[14px] py-[11px] bg-surface-light rounded-[10px] '
            'font-body-sm text-[12px] text-[#6B7280] leading-relaxed">'
            f'{len(shares)}사 합산 자동차 금융 시장 점유율 약 <strong class="text-on-surface">{total}%</strong> '
            '— 독립계 캡티브 진입 여지 존재</div>')
    return _card(
        _card_title("경쟁 금융사 Top 5")
        + chart_block + footer)


# ─────────────────────────────────────────────────────────────────────────────
# AI 인사이트 — overall_insight 앞 N문장을 컬러 불릿으로 (mockup: 블루/앰버/그린/레드 순환)
# ─────────────────────────────────────────────────────────────────────────────
_BULLET_COLORS = ["#3F6CB4", "#3F6CB4", "#C08A2E", "#4F8A6D", "#4F8A6D", "#C0533F"]


def _split_sentences(text, n=6):
    import re
    parts = [p for p in re.split(r"(?<=[.。])\s+", (text or "").strip()) if p]
    return parts[:n]


def ai_insights(data):
    sentences = _split_sentences(data.get("overall_insight") or "", 6)
    if not sentences:
        # 폴백: 매력도 상위 지표
        picked = [it for it in data.get("items", [])
                  if it.get("axis") == "attractiveness" and it.get("role") == "score"][:5]
        if not picked:
            return ""
        lis = "".join(
            '<li class="flex items-baseline justify-between gap-md py-xs border-b border-surface-border last:border-0">'
            f'<span class="font-body-sm text-[13.5px] text-on-surface">{rre.esc(it["item"])}</span>'
            f'<span class="font-mono text-[13px] font-semibold text-secondary whitespace-nowrap">{rre.esc(rre.fmt_value(it))}</span></li>'
            for it in picked)
        body = f'<ul class="flex flex-col">{lis}</ul>'
    else:
        bullets = "".join(
            '<div class="flex gap-[10px] items-start">'
            f'<span class="w-[6px] h-[6px] rounded-full mt-[7px] shrink-0" style="background:{_BULLET_COLORS[i % len(_BULLET_COLORS)]}"></span>'
            f'<span class="font-body-sm text-[13.5px] text-text-secondary leading-[1.55]">{rre.esc(s)}</span></div>'
            for i, s in enumerate(sentences))
        body = f'<div class="flex flex-col gap-[11px]">{bullets}</div>'
    title = (
        '<div class="flex items-center gap-sm mb-md">'
        '<div class="font-headline-md text-[15px] font-bold text-on-surface">AI 인사이트</div>'
        '<span class="font-label-sm text-[10px] font-semibold tracking-wide rounded-md px-2 py-[2px]" '
        'style="background:#EAF0F8;color:#3F6CB4">AI 분석</span></div>')
    return _card(title + body)


# ─────────────────────────────────────────────────────────────────────────────
# 진출 정보 — 상태/시스템결정/베이스라인/IT유사도/지원방식 (mockup 라벨-값 행)
#   IT유사도·시스템결정은 보고서 데이터(있으면)에서, 베이스라인은 internal에서.
# ─────────────────────────────────────────────────────────────────────────────
def _latest_report(code):
    """국가 보고서 최신본 JSON 로드(있으면). 진출정보 카드의 IT유사도·결정 보강용."""
    d = os.path.join(STORAGE, "report", "country", code, "data")
    cands = sorted(glob.glob(os.path.join(d, f"RPT_CTR_{code}_*.json")))
    if not cands:
        return None
    try:
        with open(cands[-1], encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


# 법인종류 코드 → (라벨, 배경, 글자색). 미지정은 None.
_ENTITY_TYPE = {
    "SA": ("단독법인", "#E9F3EE", "#4F8A6D"),
    "JV": ("JV", "#FBF0E6", "#C08A2E"),
}


def _entity_cell(t):
    """법인종류(SA/JV) → 배지 HTML. 비면 빈 문자열."""
    label, bg, fg = _ENTITY_TYPE.get((t or "").upper(), (None, None, None))
    if not label:
        return ""
    return rre.badge(label, bg, fg)


def _products_cell(products):
    """관리상품 리스트 → 작은 칩 배지 묶음. 비면 '—'."""
    if not products:
        return '<span class="font-body-sm text-[13px] text-outline">—</span>'
    return '<div class="flex flex-wrap gap-1 justify-end">' + "".join(
        rre.badge(p, "#EAF0F8", "#2C4C86") for p in products) + '</div>'


def entry_info(data):
    code = data.get("code", "")
    region = data.get("region", "")
    internal = _internal()
    status_text = _entry_status_text(code, internal)
    report = _latest_report(code)

    rows = []

    def row(label, value_html, border=True):
        b = " border-b border-surface-border" if border else ""
        rows.append(
            f'<div class="flex justify-between items-center py-[11px]{b}">'
            f'<span class="font-body-sm text-[13px] text-outline">{rre.esc(label)}</span>'
            f'<span class="text-right">{value_html}</span></div>')

    # 진출 상태
    row("진출 상태", _status_badge(status_text))

    if status_text == "운영중":
        # 운영중 — 추천(베이스라인/기준 솔루션) 대신 실제 자체 운영 정보를 표시.
        asset = (internal.get("country_assets", {}) or {}).get(code, {})
        sol = asset.get("solution")
        if sol:
            row("운영 솔루션",
                f'<span class="font-body-sm text-[13px] font-semibold">{rre.esc(sol)}</span>')
        ent = _entity_cell(asset.get("type"))
        if ent:
            row("법인종류", ent)
        products = asset.get("products") or []
        if products:
            row("관리상품", _products_cell(products))
        since = asset.get("since")
        if since:
            row("진출연도",
                f'<span class="font-body-sm text-[13px] font-semibold">{rre.esc(since)}</span>')
    else:
        # 미진출/준비중 등 — 진출 추천 정보(시스템 결정·IT 유사도·베이스라인·기준 솔루션).
        if report:
            tabs = report.get("tabs", {})
            decision = tabs.get("tab_1_2_decision", {})
            rec = decision.get("recommendation")
            rec_text = rec.get("ko") if isinstance(rec, dict) else rec
            if rec_text:
                row("시스템 결정",
                    f'<span class="font-body-sm text-[13px] font-semibold text-secondary">{rre.esc(rec_text)}</span>')
            sim = tabs.get("tab_1_1_similarity", {}).get("overall_score")
            if isinstance(sim, (int, float)):
                row("IT 유사도",
                    f'<span class="font-mono text-[16px] font-bold text-secondary">{sim:.1f}'
                    '<span class="font-body-sm text-[12px] text-outline font-normal"> / 100</span></span>')

        # 권역 베이스라인 국가
        base_code = (internal.get("region_baselines", {}) or {}).get(region)
        if base_code:
            base_ko = _country_ko(base_code)
            flag = ""
            if len(base_code) == 2 and base_code.isalpha():
                flag = f'<span class="mr-1">{_flag_emoji(base_code)}</span>'
            row("권역 베이스라인",
                f'<span class="font-body-sm text-[13px] font-semibold">{flag}{rre.esc(base_ko)} ({rre.esc(base_code)})</span>')
            # 베이스라인 솔루션을 기준 솔루션으로 표시
            sol = (internal.get("country_assets", {}) or {}).get(base_code, {}).get("solution")
            if sol:
                row("기준 솔루션",
                    f'<span class="font-body-sm text-[13px] font-semibold">{rre.esc(sol)}</span>', border=False)
    if rows:
        # 마지막 행 보더 제거
        rows[-1] = rows[-1].replace(" border-b border-surface-border", "")
    return _card(_card_title("진출 정보") + f'<div class="flex flex-col">{"".join(rows)}</div>')


def _country_ko(code):
    """국가코드 → 한글 국가명. 해당국 리서치 데이터에서 조회, 없으면 코드 반환."""
    path = os.path.join(DATA, "research", "country", code, f"{code}_latest.json")
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        return d.get("country_ko") or d.get("country") or code
    except Exception:
        return code


def _flag_emoji(code):
    """ISO alpha-2 → 국기 이모지(리저널 인디케이터)."""
    code = (code or "").upper()
    if len(code) != 2 or not code.isalpha():
        return ""
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in code)


def flag_cell(data):
    """국기 셀 — flag_url 있으면 사용, 없으면 국가코드(ISO-2) 기반 flagcdn URL 폴백, 그것도 없으면 코드 텍스트."""
    url = data.get("flag_url")
    if not url:
        code = (data.get("code") or "").strip().lower()
        if len(code) == 2 and code.isalpha():
            url = f"https://flagcdn.com/w320/{code}.png"
    if url:
        return f"background-image: url('{rre.esc(url)}'); background-size: cover; background-position: center;", ""
    return "", f'<span class="font-label-md text-label-md text-on-surface-variant">{rre.esc(data.get("code", ""))}</span>'


# ─────────────────────────────────────────────────────────────────────────────
# HTML 렌더
# ─────────────────────────────────────────────────────────────────────────────
def render_html(data):
    code = data.get("code", "")
    en = data.get("country", code)
    ko = data.get("country_ko", "")
    title = f"{ko}({en}) 국가 상세 — 진출 진단"  # 브라우저 탭 제목(PAGE_TITLE)

    with open(TPL_PATH, encoding="utf-8") as f:
        tpl = f.read()

    return (tpl
            .replace("{{PAGE_TITLE}}", rre.esc(title))
            .replace("{{MARKET_CHART}}", market_chart(data))
            .replace("{{COMPETITORS}}", competitors_table(data))
            .replace("{{AI_INSIGHTS}}", ai_insights(data))
            .replace("{{ENTRY_INFO}}", entry_info(data)))


# ─────────────────────────────────────────────────────────────────────────────
# 입출력
# ─────────────────────────────────────────────────────────────────────────────
def load_detail(code, version=None):
    datadir = os.path.join(DATA, "research", "country", code)
    if version:
        path = os.path.join(datadir, f"{code}_{version}.json")
    else:
        path = os.path.join(datadir, f"{code}_latest.json")
    if not os.path.exists(path):
        cand = sorted(glob.glob(os.path.join(datadir, f"{code}_*.json")))
        if not cand:
            raise SystemExit(f"[안내] country '{code}' 리서치 데이터 없음 — data/research/country/{code}/ 확인 필요.")
        path = cand[-1]
    with open(path, encoding="utf-8") as f:
        return json.load(f), path


def render_to_string(code="ES", version=None):
    """파일을 쓰지 않고 상세화면 HTML 문자열만 반환(API 실시간 렌더용).

    매 요청마다 최신 리서치 데이터·internal_latest(country_status 등)를 읽어 렌더하므로
    데이터 변경이 즉시 반영된다. 디스크 캐시(DTL_<CODE>_nnn.html)는 만들지 않는다."""
    data, _src = load_detail(code, version)
    return render_html(data)


def render(code="ES", version=None):
    data, src = load_detail(code, version)
    out_html = render_html(data)

    outdir = os.path.join(DETAIL, "country", code, "html")
    os.makedirs(outdir, exist_ok=True)
    # 메인 화면에서 생성할 때마다 다음 순번(DTL_<CODE>_nnn.html)을 부여 — 기존 개수 기준
    existing = glob.glob(os.path.join(outdir, f"DTL_{code}_*.html"))
    seq = len(existing) + 1
    out = os.path.join(outdir, f"DTL_{code}_{seq:03d}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(out_html)

    print(f"[{code}] 상세화면 렌더 완료 — 입력 {os.path.relpath(src, STORAGE)}")
    print(f"  항목 {len(data.get('items', []))}개")
    print(f"→ {os.path.relpath(out, STORAGE)}")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    code = args[0] if args else "ES"
    version = args[1] if len(args) > 1 else None
    render(code, version)
