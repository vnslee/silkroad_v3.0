#!/usr/bin/env python3
"""상세화면/보고서 공유 표현·차트·포맷 헬퍼 모듈.

삭제된 region_report_rendering_engine.py 에 인라인돼 있던 범용 헬퍼를
detail 렌더러(country/region)가 재사용할 수 있도록 분리한 순수 헬퍼 모듈.
계산/스키마 의존 없이 표현(esc·fmt_value·차트·badge·score_color 등)만 담당한다.
detail 엔진은 이 모듈을 `import render_helpers as rre` 로 사용한다.
"""
import html
import datetime

def esc(s):
    return html.escape("" if s is None else str(s))


def fmt_num(v):
    if isinstance(v, float):
        return f"{v:,.1f}".rstrip("0").rstrip(".") if v % 1 else f"{int(v):,}"
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)


def fmt_value(it):
    """항목 value를 단위에 맞게 사람이 읽는 문자열로 변환."""
    v = it.get("value")
    unit = it.get("unit")
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    if v is None:
        return "—"
    if isinstance(v, (int, float)):
        if unit == "%":
            return f"{fmt_num(v)}%"
        if isinstance(unit, str) and unit.endswith("_1to5"):
            return f"{v}/5"
        if unit == "days":
            return f"{fmt_num(v)}일"
        if unit == "units":
            return f"{fmt_num(v)}대"
        if isinstance(unit, str) and unit.endswith("_M"):
            return f"{fmt_num(v)} {unit[:-2]}M"
        return fmt_num(v)
    return str(v)


def fmt_dt(iso):
    try:
        s = iso.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(s)
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return iso or ""


def freshness_badge(fetched_at):
    """fetched_at 기준 신선도 신호등 (스키마 규칙 10): 🟢방금/🟡30일/🔴90일+."""
    if not fetched_at:
        return ""
    try:
        s = fetched_at.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(s)
        now = datetime.datetime.now(dt.tzinfo)
        days = (now - dt).days
    except Exception:
        return ""
    if days <= 30:
        c, t = "#4f8a6d", "🟢 최신"
    elif days <= 90:
        c, t = "#c08a2e", f"🟡 {days}일 경과"
    else:
        c, t = "#c0533f", "🔴 재조사 권장"
    return badge(t, c + "1a", c)


# 사분면/신뢰도/게이트 색 토큰
QUAD_COLOR = {
    "즉시 진출": "#4f8a6d", "선별 진출": "#3f6cb4",
    "기회 탐색": "#c08a2e", "JV/제휴 필요": "#c0533f",
}
CONF_COLOR = {"상": "#4f8a6d", "중": "#c08a2e", "하": "#c0533f"}
GATE_COLOR = {"PASS": ("#e9f3ee", "#4f8a6d"), "FLAG": ("#fbf3e2", "#c08a2e"),
              "FAIL": ("#f6e7e3", "#c0533f")}


def badge(text, bg, fg):
    return (f'<span class="px-2 py-1 rounded-md font-label-sm text-label-sm '
            f'whitespace-nowrap" style="background:{bg};color:{fg}">{esc(text)}</span>')


def conf_badge(c):
    fg = CONF_COLOR.get(c, "#3b3f46")
    return badge(f"신뢰도 {c}", fg + "1a", fg)


def gate_badge(result):
    bg, fg = GATE_COLOR.get(result, ("#eee", "#555"))
    return badge(result, bg, fg)


def score_color(v):
    """0-100 점수 → 신호색."""
    return "#4f8a6d" if v >= 70 else "#3f6cb4" if v >= 50 else "#c08a2e" if v >= 35 else "#c0533f"


def bar(value, vmax=100, color="#3f6cb4"):
    pct = 0 if not vmax else max(0, min(100, value / vmax * 100))
    return (f'<div class="w-full h-base bg-surface-border rounded-full overflow-hidden">'
            f'<div class="h-full rounded-full" style="width:{pct:.0f}%;background:{color}"></div></div>')


# ─────────────────────────────────────────────────────────────────────────────
# SVG 차트
# ─────────────────────────────────────────────────────────────────────────────
def vbar_chart(series, vmax=100, height=180, unit=""):
    """세로 막대 비교 차트. series=[(label, value, color)]."""
    if not series:
        return ""
    n = len(series)
    bw, gap, pad = 54, 28, 28
    w = pad * 2 + n * bw + (n - 1) * gap
    h = height
    base = h - 34
    top = 16
    bars = []
    for i, (label, val, color) in enumerate(series):
        x = pad + i * (bw + gap)
        bh = 0 if not vmax else max(2, (val / vmax) * (base - top))
        y = base - bh
        bars.append(
            f'<rect x="{x}" y="{y:.1f}" width="{bw}" height="{bh:.1f}" rx="4" fill="{color}"/>'
            f'<text x="{x+bw/2}" y="{y-6:.1f}" text-anchor="middle" font-size="13" '
            f'font-weight="700" fill="#14171c">{fmt_num(val)}{esc(unit)}</text>'
            f'<text x="{x+bw/2}" y="{base+18}" text-anchor="middle" font-size="12" '
            f'fill="#3b3f46">{esc(label)}</text>')
    return (f'<svg viewBox="0 0 {w} {h}" class="w-full" style="max-height:{h}px" '
            f'preserveAspectRatio="xMidYMid meet">'
            f'<line x1="{pad-8}" y1="{base}" x2="{w-pad+8}" y2="{base}" '
            f'stroke="#e6e9ec" stroke-width="1"/>{"".join(bars)}</svg>')


def quadrant_chart(rows):
    """매력도(x) × 난이도(y, 위쪽이 낮음) 사분면 버블. 버블=구축비, 색=퀵윈."""
    w, h, pad = 520, 380, 44
    x0, y0 = pad, 16
    x1, y1 = w - 16, h - pad
    def sx(a): return x0 + (a / 100) * (x1 - x0)
    def sy(d): return y0 + (d / 100) * (y1 - y0)  # 난이도 클수록 아래
    mx, my = sx(50), sy(50)
    builds = [r["cost"]["build"] for r in rows] or [1]
    bmax = max(builds) or 1
    pts = []
    for r in rows:
        a, d = r["attractiveness"], r["difficulty"]
        cx, cy = sx(a), sy(d)
        rad = 9 + (r["cost"]["build"] / bmax) * 17
        col = "#3f6cb4" if r["quick_win"] else "#9aa0a8"
        pts.append(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rad:.1f}" fill="{col}" '
            f'fill-opacity="0.78" stroke="#fff" stroke-width="2"/>'
            f'<text x="{cx:.1f}" y="{cy+4:.1f}" text-anchor="middle" font-size="12" '
            f'font-weight="700" fill="#fff">{esc(r["code"])}</text>')
    # 사분면 라벨
    labels = [
        (sx(75), sy(25), "즉시 진출"), (sx(25), sy(25), "기회 탐색"),
        (sx(75), sy(78), "선별 진출"), (sx(25), sy(78), "JV/제휴 필요"),
    ]
    lab = "".join(f'<text x="{lx:.0f}" y="{ly:.0f}" text-anchor="middle" '
                  f'font-size="11" fill="#9aa0a8" font-weight="600">{esc(t)}</text>'
                  for lx, ly, t in labels)
    return (f'<svg viewBox="0 0 {w} {h}" class="w-full" preserveAspectRatio="xMidYMid meet">'
            f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="#fff" '
            f'stroke="#e6e9ec"/>'
            f'<line x1="{mx:.0f}" y1="{y0}" x2="{mx:.0f}" y2="{y1}" stroke="#e6e9ec" stroke-dasharray="4 4"/>'
            f'<line x1="{x0}" y1="{my:.0f}" x2="{x1}" y2="{my:.0f}" stroke="#e6e9ec" stroke-dasharray="4 4"/>'
            f'{lab}{"".join(pts)}'
            f'<text x="{(x0+x1)/2:.0f}" y="{h-12}" text-anchor="middle" font-size="12" '
            f'fill="#3b3f46">매력도 →</text>'
            f'<text x="14" y="{(y0+y1)/2:.0f}" text-anchor="middle" font-size="12" '
            f'fill="#3b3f46" transform="rotate(-90 14 {(y0+y1)/2:.0f})">← 진입난이도(낮을수록 위)</text>'
            f'</svg>')


def line_chart(history, forecast, color="#3f6cb4"):
    """시계열 라인차트(실적+전망). history/forecast=[{year,value}]."""
    pts_all = (history or []) + (forecast or [])
    if len(pts_all) < 2:
        return ""
    w, h, pad = 300, 96, 8
    xs = [p["year"] for p in pts_all]
    ys = [p["value"] for p in pts_all]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    def X(x): return pad + (0 if xmax == xmin else (x - xmin) / (xmax - xmin)) * (w - 2 * pad)
    def Y(y): return (h - pad) - (0 if ymax == ymin else (y - ymin) / (ymax - ymin)) * (h - 2 * pad)
    def path(pp): return " ".join(("M" if i == 0 else "L") + f"{X(p['year']):.1f} {Y(p['value']):.1f}"
                                  for i, p in enumerate(pp))
    segs = []
    if history:
        segs.append(f'<path d="{path(history)}" fill="none" stroke="{color}" stroke-width="2"/>')
    if forecast:
        link = [history[-1]] + forecast if history else forecast
        segs.append(f'<path d="{path(link)}" fill="none" stroke="{color}" '
                    f'stroke-width="2" stroke-dasharray="4 3" opacity="0.6"/>')
    dots = "".join(f'<circle cx="{X(p["year"]):.1f}" cy="{Y(p["value"]):.1f}" r="2" fill="{color}"/>'
                   for p in pts_all)
    return (f'<svg viewBox="0 0 {w} {h}" class="w-full" style="max-height:96px">'
            f'{"".join(segs)}{dots}</svg>')


# 여러 시계열을 한 패널에 색만 다르게 겹쳐 그린다(추세 비교용).
# 단위가 서로 다를 수 있으므로 각 시리즈를 자기 min/max로 0~1 정규화한다 — 절대값이 아니라 추세를 비교.
MULTI_LINE_PALETTE = ["#3f6cb4", "#3f6cb4", "#6fa98c", "#c08a2e", "#3f6cb4", "#2f5c46"]


def multi_line_chart(series, height=160):
    """series=[{name, color?, history, forecast}] → 색 구분 + 범례 포함 단일 SVG.

    각 시리즈는 자체 정규화(추세 비교). 실적=실선, 전망=점선.
    """
    series = [s for s in series if len((s.get("history") or []) + (s.get("forecast") or [])) >= 2]
    if not series:
        return ""
    w, h, pad = 320, height, 10
    # x축은 전체 시리즈 공통 연도 범위로 정렬
    all_years = [p["year"] for s in series for p in (s.get("history") or []) + (s.get("forecast") or [])]
    xmin, xmax = min(all_years), max(all_years)

    def X(x):
        return pad + (0 if xmax == xmin else (x - xmin) / (xmax - xmin)) * (w - 2 * pad)

    segs, dots, legend = [], [], []
    for i, s in enumerate(series):
        color = s.get("color") or MULTI_LINE_PALETTE[i % len(MULTI_LINE_PALETTE)]
        hist = s.get("history") or []
        fc = s.get("forecast") or []
        pts = hist + fc
        ys = [p["value"] for p in pts]
        ymin, ymax = min(ys), max(ys)

        def Y(y, ymin=ymin, ymax=ymax):
            return (h - pad) - (0 if ymax == ymin else (y - ymin) / (ymax - ymin)) * (h - 2 * pad)

        def path(pp):
            return " ".join(("M" if j == 0 else "L") + f"{X(p['year']):.1f} {Y(p['value']):.1f}"
                            for j, p in enumerate(pp))
        if hist:
            segs.append(f'<path d="{path(hist)}" fill="none" stroke="{color}" stroke-width="2"/>')
        if fc:
            link = [hist[-1]] + fc if hist else fc
            segs.append(f'<path d="{path(link)}" fill="none" stroke="{color}" '
                        f'stroke-width="2" stroke-dasharray="4 3" opacity="0.6"/>')
        dots.append("".join(f'<circle cx="{X(p["year"]):.1f}" cy="{Y(p["value"]):.1f}" r="2" fill="{color}"/>'
                            for p in pts))
        legend.append(
            '<span class="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">'
            f'<span style="display:inline-block;width:10px;height:2px;background:{color}"></span>'
            f'{esc(s.get("name", ""))}</span>')

    svg = (f'<svg viewBox="0 0 {w} {h}" class="w-full" style="max-height:{height}px">'
           f'{"".join(segs)}{"".join(dots)}</svg>')
    legend_html = f'<div class="flex flex-wrap gap-x-md gap-y-xs mt-sm">{"".join(legend)}</div>'
    return svg + legend_html


# ─────────────────────────────────────────────────────────────────────────────
# 기여도 분해 (누적 수평 막대) — *_contributions[].weighted 표현
#   막대 길이 = 해당 축 점수(0~100), 색 구간 = 항목별 가중 기여(weighted).
#   계산은 하지 않고 리포트가 이미 박아둔 weighted를 그대로 쌓는다.
# ─────────────────────────────────────────────────────────────────────────────
CONTRIB_PALETTE = ["#3f6cb4", "#3f6cb4", "#3f6cb4", "#6e97d6", "#6fa98c",
                   "#2f5c46", "#c08a2e", "#3f6cb4", "#c0533f", "#9aa0a8"]


def _contrib_color_map(names):
    return {n: CONTRIB_PALETTE[i % len(CONTRIB_PALETTE)] for i, n in enumerate(names)}


def stacked_bar(segments, scale=100, height=16):
    """누적 수평 막대. segments=[(label, value, color)]. width%는 scale 기준."""
    parts = []
    for label, val, color in segments:
        if not val or val <= 0:
            continue
        wpct = max(0.0, min(100.0, val / scale * 100))
        parts.append(f'<div style="width:{wpct:.1f}%;background:{color}" '
                     f'title="{esc(label)}: {fmt_num(val)}" class="h-full"></div>')
    inner = "".join(parts) or '<div class="h-full w-0"></div>'
    return (f'<div class="flex w-full rounded-full overflow-hidden bg-surface-border" '
            f'style="height:{height}px">{inner}</div>')


def contribution_breakdown(rows, kind):
    """국가별 기여도 누적 막대 + 공유 범례.
    kind='attractiveness'|'difficulty'(business_contributions) | 'similarity'(it_contributions)."""
    if kind == "similarity":
        get_contribs = lambda r: r.get("it_contributions", [])
        keep = lambda c: True
    else:
        get_contribs = lambda r: r.get("business_contributions", [])
        keep = lambda c: c.get("axis") == kind
    # 항목명 union (등장 순서 유지, weighted>0만)
    names, seen = [], set()
    for r in rows:
        for c in get_contribs(r):
            if keep(c) and (c.get("weighted") or 0) > 0 and c["item"] not in seen:
                names.append(c["item"])
                seen.add(c["item"])
    if not names:
        return ""
    cmap = _contrib_color_map(names)

    bars = []
    for r in rows:
        segs, total = [], 0.0
        for c in get_contribs(r):
            if not keep(c):
                continue
            w = c.get("weighted") or 0
            if w <= 0:
                continue
            segs.append((c["item"], w, cmap.get(c["item"], "#9aa0a8")))
            total += w
        if not segs:
            continue
        bars.append(
            f'<div class="flex items-center gap-sm">'
            f'<span class="font-label-md text-label-md text-primary w-8 shrink-0">{esc(r["code"])}</span>'
            f'<div class="flex-1">{stacked_bar(segs)}</div>'
            f'<span class="font-label-md text-label-md text-primary w-10 text-right shrink-0">'
            f'{fmt_num(round(total, 1))}</span></div>')
    if not bars:
        return ""
    legend = "".join(
        f'<span class="flex items-center gap-xs font-label-sm text-label-sm text-text-secondary">'
        f'<span class="w-3 h-3 rounded-sm shrink-0" style="background:{cmap[n]}"></span>{esc(n)}</span>'
        for n in names)
    return (f'<div class="flex flex-col gap-sm mb-md">{"".join(bars)}</div>'
            f'<div class="flex flex-wrap gap-md pt-sm border-t border-surface-border">{legend}</div>')


# ─────────────────────────────────────────────────────────────────────────────
# 공통 카드/섹션 헬퍼
# ─────────────────────────────────────────────────────────────────────────────
def card(inner, extra=""):
    return (f'<div class="bg-surface-container-lowest border border-surface-border rounded-lg '
            f'p-lg shadow-[0_4px_8px_rgba(0,32,78,0.04)] {extra}">{inner}</div>')


def section_title(t, sub=""):
    s = (f'<p class="font-body-sm text-body-sm text-on-surface-variant mt-xs">{esc(sub)}</p>'
         if sub else "")
    return f'<h2 class="font-headline-md text-headline-md text-primary m-0">{esc(t)}</h2>{s}'


