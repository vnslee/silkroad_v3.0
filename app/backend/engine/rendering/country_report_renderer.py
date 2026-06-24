#!/usr/bin/env python3
"""
Country Report Renderer: Convert Type 1 TCO JSON to HTML

Renders Type 1 report JSON into HTML following PR1.html design template.
Implements data nature -> chart type mapping from render spec.
"""

import html
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime


class CountryReportRenderer:
    """Render Type 1 (single country TCO) reports to HTML."""

    def __init__(self, report_json_path: str, template_path: Optional[str] = None):
        """Initialize renderer with report JSON.

        Args:
            report_json_path: Path to Type 1 report JSON
            template_path: Optional custom HTML template path
        """
        self.report_json_path = report_json_path
        self.template_path = template_path
        self.report_data: Optional[Dict] = None

    def load_report(self) -> bool:
        """Load report JSON file."""
        try:
            with open(self.report_json_path, 'r', encoding='utf-8') as f:
                self.report_data = json.load(f)
            return True
        except Exception as e:
            print(f"Error loading report: {e}")
            return False

    @staticmethod
    def _loc_text(value, lang: str = "ko") -> str:
        """엔진이 만든 {ko, en} dict에서 lang 추출. dict 아니면 원본 그대로."""
        if isinstance(value, dict):
            return value.get(lang) or value.get("ko") or ""
        return value or ""

    @staticmethod
    def _bi_span(ko_text, en_text, extra_class: str = "") -> str:
        """한글·영문 양 언어 텍스트를 <span data-i18n>으로 감싸 반환. en 비어있으면 한글만."""
        import html as _h
        ko = _h.escape("" if ko_text is None else str(ko_text))
        en = _h.escape("" if en_text is None else str(en_text)) if en_text else ""
        cls = f' class="{extra_class}"' if extra_class else ""
        if en:
            return f'<span{cls} data-i18n="bilingual" data-en="{en}">{ko}</span>'
        return f'<span{cls}>{ko}</span>'

    def _item_value_text(self, item: Dict[str, Any], lang: str = "ko") -> Any:
        """리서치 item의 value를 lang에 맞게 반환. value_en 우선, 없으면 value."""
        if lang == "en":
            v_en = item.get("value_en")
            if v_en is not None and v_en != "":
                return v_en
        return item.get("value")

    def _item_insight(self, item: Dict[str, Any]) -> tuple:
        """리서치 item의 insight (ko, en) 튜플 반환. 둘 다 없으면 빈 문자열."""
        return (item.get("insight") or "", item.get("insight_en") or "")

    def _loc_span(self, value, extra_class: str = "") -> str:
        """{ko, en} dict 또는 문자열을 <span data-i18n> 으로 출력 (KO/EN 토글 지원)."""
        import html as _h
        if isinstance(value, dict):
            ko = _h.escape(value.get("ko") or "")
            en = _h.escape(value.get("en") or "")
            cls = f' class="{extra_class}"' if extra_class else ""
            return f'<span{cls} data-i18n="engine_msg" data-en="{en}">{ko}</span>'
        cls = f' class="{extra_class}"' if extra_class else ""
        return f'<span{cls}>{_h.escape(str(value) if value is not None else "")}</span>'

    def get_country_flag_url(self, country_code: str) -> str:
        """Get country flag image URL.

        Args:
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            Flag image URL
        """
        # ISO codes for flag service (USA→us 등 별칭 보정)
        flag_aliases = {"USA": "us"}
        code = flag_aliases.get(country_code.upper(), country_code.lower())
        return f"https://flagcdn.com/w160/{code}.png"

    _COUNTRY_KO = {
        "ES": "스페인", "PL": "폴란드", "CZ": "체코", "HU": "헝가리",
        "GB": "영국", "UK": "영국", "DE": "독일", "FR": "프랑스", "IT": "이탈리아",
        "NL": "네덜란드", "AT": "오스트리아", "DK": "덴마크", "PT": "포르투갈",
        "US": "미국", "CA": "캐나다", "MX": "멕시코",
        "AU": "호주", "NZ": "뉴질랜드", "JP": "일본", "KR": "한국", "SG": "싱가포르",
        "BR": "브라질",
    }
    _COUNTRY_EN = {
        "ES": "Spain", "PL": "Poland", "CZ": "Czech Republic", "HU": "Hungary",
        "GB": "United Kingdom", "UK": "United Kingdom", "DE": "Germany",
        "FR": "France", "IT": "Italy", "NL": "Netherlands", "AT": "Austria",
        "DK": "Denmark", "PT": "Portugal",
        "US": "United States", "CA": "Canada", "MX": "Mexico",
        "AU": "Australia", "NZ": "New Zealand", "JP": "Japan", "KR": "South Korea",
        "SG": "Singapore", "BR": "Brazil",
    }

    def get_country_name(self, country_code: str) -> str:
        return self._COUNTRY_KO.get(country_code, country_code)

    def get_country_name_en(self, country_code: str) -> str:
        return self._COUNTRY_EN.get(country_code, country_code)

    def country_name_span(self, country_code: str) -> str:
        """KO/EN 토글되는 국가명 span."""
        import html as _h
        ko = _h.escape(self.get_country_name(country_code))
        en = _h.escape(self.get_country_name_en(country_code))
        return f'<span data-i18n="country_name" data-en="{en}">{ko}</span>'

    def _decision_label(self, decision_type: str, base_country_name: str,
                         base_country_code: str = "") -> str:
        """Translate decision type into a human-friendly KO/EN bilingual span."""
        en_country = self.get_country_name_en(base_country_code) if base_country_code else base_country_name
        pairs = {
            "baseline_system_expansion": (
                f"권역 내 확산 ({base_country_name} 시스템)",
                f"Regional Expansion ({en_country} system)",
            ),
            "external_solution": ("외부솔루션 도입", "External Solution"),
            "hq_build": ("본사 자체구축", "HQ Self-Build"),
        }
        if decision_type in pairs:
            ko, en = pairs[decision_type]
            return f'<span data-i18n="decision_label" data-en="{html.escape(en)}">{html.escape(ko)}</span>'
        return decision_type.replace('_', ' ').title()

    def format_currency(self, amount: float, currency: str = "EUR") -> str:
        """Format currency amount.

        Args:
            amount: Numeric amount
            currency: Currency code

        Returns:
            Formatted currency string
        """
        symbols = {"EUR": "€", "GBP": "£", "USD": "$", "KRW": "₩"}
        symbol = symbols.get(currency, currency)
        # Sub-unit amounts (< 10) keep 2 decimals so 구독료 단가(0.9 등)가 1로 반올림되지 않게.
        if amount and abs(amount) < 10:
            return f"{symbol}{amount:,.2f}"
        return f"{symbol}{amount:,.0f}"

    def get_source_badge(self, source_flag: str) -> Dict[str, str]:
        """Get badge styling for source flag.

        Args:
            source_flag: Source flag (EXT/INT/CALC/AI/NEWS)

        Returns:
            Dict with label and color class
        """
        badges = {
            "EXT": {"label": "외부조사", "color": "bg-gray-100 text-gray-700 border-gray-300"},
            "INT": {"label": "내부자료", "color": "bg-blue-100 text-blue-700 border-blue-300"},
            "CALC": {"label": "계산값", "color": "bg-green-100 text-green-700 border-green-300"},
            "AI": {"label": "AI 인사이트", "color": "bg-purple-100 text-purple-700 border-purple-300"},
            "NEWS": {"label": "외부이슈", "color": "bg-orange-100 text-orange-700 border-orange-300"}
        }
        return badges.get(source_flag, {"label": source_flag, "color": "bg-gray-100 text-gray-700"})

    def _format_item_value(self, item: Dict[str, Any]) -> str:
        """Render an item value (scalar, list, or dict) as readable HTML."""
        value = item.get("value")
        unit = item.get("unit") or ""

        if value is None:
            return '<span class="text-text-secondary italic">N/A</span>'

        if isinstance(value, list):
            # 1) 순위형 — [{rank, name, market_share}]: 미니 바 + 캡티브 칩
            if value and isinstance(value[0], dict) and any("market_share" in e or "name" in e for e in value):
                # 점유율 숫자 추출 (최댓값 기준 막대 비율)
                def _pct(s):
                    import re as _re
                    m = _re.search(r"(\d+(?:\.\d+)?)", str(s or ""))
                    return float(m.group(1)) if m else 0.0
                max_pct = max((_pct(e.get("market_share")) for e in value), default=0.0) or 1.0
                rows = []
                for entry in value:
                    rank = entry.get("rank", "")
                    name = entry.get("name", "")
                    share = entry.get("market_share", "")
                    share_en = entry.get("market_share_en", "")
                    pct = _pct(share)
                    bar_w = (pct / max_pct) * 100 if max_pct else 0
                    captive = self._has_captive_hint(name) if hasattr(self, "_has_captive_hint") else False
                    cap_chip = (
                        '<span class="inline-flex items-center gap-xs bg-secondary-container/30 text-secondary border border-secondary/40 px-2 py-[1px] rounded-full font-label-sm text-label-sm ml-xs">'
                        '<span class="material-symbols-outlined text-[12px]">verified</span><span data-i18n="captive_chip" data-en="Captive">캡티브</span></span>'
                        if captive else ''
                    )
                    rank_pill_cls = "bg-primary text-on-primary" if (isinstance(rank, int) and rank <= 3) or str(rank) in ("1","2","3") else "bg-surface-container text-text-secondary"
                    rank_html = f'<span class="inline-flex items-center justify-center w-5 h-5 rounded-full {rank_pill_cls} font-label-sm text-label-sm flex-shrink-0">{rank}</span>' if rank != "" else ''
                    rows.append(f'''
                    <li class="flex items-center gap-xs">
                        {rank_html}
                        <span class="font-label-md text-label-md text-text-primary flex-1 truncate">{name}</span>
                        {cap_chip}
                        <div class="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary" style="width: {bar_w:.0f}%"></div>
                        </div>
                        <span class="font-label-md text-label-md text-text-secondary w-12 text-right">{self._bi_span(str(share), str(share_en))}</span>
                    </li>
                    ''')
                return f'<ul class="flex flex-col gap-xs w-full">{"".join(rows)}</ul>'

            # 2) 단순 브랜드/회사 문자열 리스트 — 칩 그리드
            if value and all(isinstance(v, str) for v in value):
                chips = []
                for i, name in enumerate(value):
                    captive = self._has_captive_hint(name) if hasattr(self, "_has_captive_hint") else False
                    cap_dot = '<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>' if captive else ''
                    chips.append(
                        f'<span class="inline-flex items-center gap-xs bg-surface-container-low border border-surface-container-highest rounded-full px-sm py-[2px] font-label-sm text-label-sm text-text-primary">'
                        f'<span class="font-label-sm text-label-sm text-text-secondary">{i+1}</span>'
                        f'<span>{name}</span>{cap_dot}'
                        f'</span>'
                    )
                return f'<div class="flex flex-wrap gap-xs">{"".join(chips)}</div>'

            return ", ".join(str(v) for v in value)

        if isinstance(value, (int, float)) and unit not in ("type", "match", "regime"):
            unit_suffix = f' <span class="text-text-secondary font-body-sm">{unit}</span>' if unit else ""
            return f'<span class="font-semibold">{value:,}</span>{unit_suffix}'

        # 문자열 value — value_en 있으면 양 언어 토글
        value_en = item.get("value_en") or ""
        return self._bi_span(value, value_en)

    def _render_donut(self, segments: list, center_label: str = "") -> str:
        """Render a small donut chart from segments=[{label, value, color}].

        Values can be raw — they're normalized to 100. Renders as an SVG ring
        with proportional arcs and legend underneath.
        """
        if not segments:
            return ""
        total = sum((s.get("value") or 0) for s in segments) or 1
        cx, cy, r_outer, r_inner = 60, 60, 50, 30

        import math
        start_angle = -math.pi / 2  # start at top
        arcs = []
        for i, s in enumerate(segments):
            frac = (s.get("value") or 0) / total
            end_angle = start_angle + frac * 2 * math.pi
            large = 1 if frac > 0.5 else 0
            x1 = cx + r_outer * math.cos(start_angle)
            y1 = cy + r_outer * math.sin(start_angle)
            x2 = cx + r_outer * math.cos(end_angle)
            y2 = cy + r_outer * math.sin(end_angle)
            x3 = cx + r_inner * math.cos(end_angle)
            y3 = cy + r_inner * math.sin(end_angle)
            x4 = cx + r_inner * math.cos(start_angle)
            y4 = cy + r_inner * math.sin(start_angle)
            color = s.get("color") or "#3f6cb4"
            d = (
                f"M {x1:.2f} {y1:.2f} "
                f"A {r_outer} {r_outer} 0 {large} 1 {x2:.2f} {y2:.2f} "
                f"L {x3:.2f} {y3:.2f} "
                f"A {r_inner} {r_inner} 0 {large} 0 {x4:.2f} {y4:.2f} Z"
            )
            arcs.append(f'<path d="{d}" fill="{color}"/>')
            start_angle = end_angle

        legend = "".join(
            f'<div class="flex items-center gap-xs">'
            f'<span class="w-3 h-3 rounded-sm" style="background:{s.get("color", "#3f6cb4")}"></span>'
            f'<span class="font-label-sm text-label-sm text-text-secondary">{s["label"]}</span>'
            f'<span class="font-label-sm text-label-sm text-text-primary font-semibold">{(s.get("value") or 0)/total*100:.0f}%</span>'
            f'</div>'
            for s in segments
        )

        center_html = (
            f'<text x="{cx}" y="{cy + 1}" text-anchor="middle" font-size="14" font-weight="700" fill="#3f6cb4">{center_label}</text>'
            if center_label else ''
        )

        return f'''
        <div class="flex items-center gap-md bg-surface-container-low rounded-md p-sm">
            <svg viewBox="0 0 120 120" style="width: 100px; height: 100px;" preserveAspectRatio="xMidYMid meet">
                {''.join(arcs)}
                {center_html}
            </svg>
            <div class="flex flex-col gap-xs flex-1">
                {legend}
            </div>
        </div>
        '''

    def _composition_for_item(self, item: Dict[str, Any]):
        """Return a 2-segment composition pair for known share items, or None."""
        name = item.get("item", "")
        unit = item.get("unit", "")
        val = item.get("value")
        try:
            v = float(val)
        except (TypeError, ValueError):
            return None
        if unit != "%":
            return None
        # Known item → semantic labels for the other slice
        mapping = {
            "구매 패턴(할부·리스 비중)": ("할부·리스", "현금·기타"),
            "캡티브 강도(점유율)": ("캡티브 금융사", "그 외"),
            "금융사 점유율(Top 5)": ("Top 5", "기타"),
            "EV 보급률": ("EV", "ICE 외"),
            "금융 이용률(신차)": ("금융 이용", "현금"),
            "금융 이용률(중고차)": ("금융 이용", "현금"),
        }
        if name not in mapping:
            return None
        primary, other = mapping[name]
        v = max(0.0, min(100.0, v))
        return [
            {"label": primary, "value": v, "color": "#3f6cb4"},
            {"label": other,   "value": 100 - v, "color": "#e6e9ec"},
        ]

    def _render_sparkline(self, history: list, forecast: list, unit: str = "") -> str:
        """Inline mini line chart for an item's timeseries (history solid + forecast dashed)."""
        if not history and not forecast:
            return ""

        W, H = 360, 90
        ml, mr, mt, mb = 36, 12, 8, 18
        chart_w = W - ml - mr
        chart_h = H - mt - mb

        all_pts = list(history or []) + list(forecast or [])
        if not all_pts:
            return ""
        years = sorted({p.get("year") for p in all_pts if p.get("year") is not None})
        values = [p.get("value") for p in all_pts if p.get("value") is not None]
        if not years or not values:
            return ""
        y_min, y_max = min(values), max(values)
        if y_min == y_max:
            y_max = y_min + 1
        pad = (y_max - y_min) * 0.15
        y_min -= pad
        y_max += pad

        def x_of(yr):
            return ml + (years.index(yr) / max(len(years) - 1, 1)) * chart_w

        def y_of(v):
            return mt + chart_h - ((v - y_min) / (y_max - y_min)) * chart_h

        # Grid
        grid = ""
        for i in range(3):
            gy = mt + chart_h * i / 2
            grid += f'<line x1="{ml}" y1="{gy}" x2="{ml + chart_w}" y2="{gy}" stroke="#e6e9ec"/>'

        # Y labels (max / min)
        y_labels = (
            f'<text x="{ml - 4}" y="{mt + 6}" font-size="9" fill="#747782" text-anchor="end">{y_max - pad:,.0f}</text>'
            f'<text x="{ml - 4}" y="{mt + chart_h - 1}" font-size="9" fill="#747782" text-anchor="end">{y_min + pad:,.0f}</text>'
        )

        # X labels (first/last year)
        first_y, last_y = years[0], years[-1]
        x_labels = (
            f'<text x="{x_of(first_y)}" y="{mt + chart_h + 12}" font-size="9" fill="#747782" text-anchor="middle">{first_y}</text>'
            f'<text x="{x_of(last_y)}" y="{mt + chart_h + 12}" font-size="9" fill="#747782" text-anchor="middle">{last_y}</text>'
        )

        # History path (solid)
        hist_d = ""
        if history:
            hist_d = "M " + " L ".join(f"{x_of(p['year'])} {y_of(p['value'])}" for p in history)
            hist_d = f'<path d="{hist_d}" fill="none" stroke="#3f6cb4" stroke-width="2"/>'

        # Forecast path (dashed) — connect last history point to first forecast
        fc_d = ""
        if forecast:
            start = (history or [forecast[0]])[-1]
            seq = [start] + list(forecast)
            fc_d_path = "M " + " L ".join(f"{x_of(p['year'])} {y_of(p['value'])}" for p in seq)
            fc_d = f'<path d="{fc_d_path}" fill="none" stroke="#3f6cb4" stroke-width="2" stroke-dasharray="4 3" opacity="0.85"/>'

        # Dots
        dots = ""
        for p in (history or []):
            dots += f'<circle cx="{x_of(p["year"])}" cy="{y_of(p["value"])}" r="2.5" fill="#3f6cb4"/>'
        for p in (forecast or []):
            dots += f'<circle cx="{x_of(p["year"])}" cy="{y_of(p["value"])}" r="2.5" fill="#3f6cb4" opacity="0.7"/>'

        unit_label = f' ({unit})' if unit else ''
        return f'''
        <svg class="w-full" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" style="max-height: 100px;">
            {grid}
            {y_labels}
            {x_labels}
            {hist_d}
            {fc_d}
            {dots}
        </svg>
        '''

    def _render_item_card(self, item: Dict[str, Any]) -> str:
        """Render a single item with value, source, and insight."""
        if item.get("status") == "missing":
            return f'''
            <div class="p-md bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-yellow-700 text-[18px]">warning</span>
                    <span class="font-label-md text-label-md text-yellow-800">{self._bi_span(item.get("item", ""), item.get("item_en") or "")}</span>
                </div>
                <p class="font-body-sm text-body-sm text-yellow-700 mt-xs" data-i18n="data_missing" data-en="Data not collected — needs reinforcement during due diligence">데이터 미수집 — 실사 단계 보강 필요</p>
            </div>
            '''

        name = self._bi_span(item.get("item", ""), item.get("item_en") or "")
        tier = item.get("tier", "")
        tier_color = {1: "emerald", 2: "blue", 3: "yellow", 4: "gray"}.get(tier, "gray")
        source = item.get("source") or ""
        source_en = item.get("source_en") or ""
        insight = item.get("insight") or ""
        insight_en = item.get("insight_en") or ""
        ai_flag = item.get("insight_ai_generated")
        gate_result = item.get("gate_result")

        gate_badge = ""
        if gate_result:
            gate_color = {"PASS": "emerald", "FLAG": "yellow", "FAIL": "red"}.get(gate_result, "gray")
            gate_badge = f'<span class="bg-{gate_color}-100 text-{gate_color}-800 border border-{gate_color}-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">{gate_result}</span>'

        ai_badge = ""
        if ai_flag:
            ai_badge = '<span class="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">AI</span>'

        timeseries_html = ""
        ts = item.get("timeseries")
        if isinstance(ts, dict):
            history = ts.get("history") or []
            forecast = ts.get("forecast") or []
            cagr_h = ts.get("cagr_hist")
            cagr_f = ts.get("cagr_forecast")
            spark_html = self._render_sparkline(history, forecast, item.get("unit", ""))
            cagr_html = ""
            if cagr_h is not None or cagr_f is not None:
                cagr_html = f'''
                <div class="flex gap-md font-label-sm text-label-sm text-text-secondary">
                    <span class="inline-flex items-center gap-xs">
                        <span class="w-2 h-2 rounded-full" style="background:#3f6cb4"></span>
                        <span data-i18n="cagr_hist" data-en="CAGR (history):">CAGR(과거):</span> <span class="font-semibold text-text-primary">{cagr_h}%</span>
                    </span>
                    <span class="inline-flex items-center gap-xs">
                        <span class="w-2 h-2 rounded-full" style="background:#3f6cb4;opacity:0.7"></span>
                        <span data-i18n="cagr_forecast" data-en="CAGR (forecast):">CAGR(전망):</span> <span class="font-semibold text-text-primary">{cagr_f}%</span>
                    </span>
                </div>
                '''
            if spark_html or cagr_html:
                timeseries_html = f'''
                <div class="bg-surface-container-low rounded-md p-sm flex flex-col gap-xs">
                    {spark_html}
                    {cagr_html}
                </div>
                '''

        # 비중(%) 항목이면 도넛 차트도 추가
        donut_html = ""
        composition = self._composition_for_item(item)
        if composition:
            center = f"{composition[0]['value']:.0f}%"
            donut_html = self._render_donut(composition, center_label=center)

        # 값이 리스트형(순위/브랜드 등)이면 전체 폭으로 펼치고, 단일값은 우측 정렬 유지
        is_list_value = isinstance(item.get("value"), list)
        value_html = self._format_item_value(item)
        if is_list_value:
            value_block = f'<div class="font-body-md text-body-md text-primary w-full mt-xs">{value_html}</div>'
            header_extras = ""
        else:
            value_block = ""
            header_extras = f'<div class="font-body-md text-body-md text-primary text-right max-w-[55%] font-semibold">{value_html}</div>'

        return f'''
        <div class="p-md bg-surface rounded-lg border border-surface-container-highest flex flex-col gap-sm">
            <div class="flex items-start justify-between gap-sm">
                <div class="flex items-center gap-xs flex-wrap">
                    <span class="font-label-md text-label-md text-text-primary uppercase tracking-wide">{name}</span>
                    <span class="bg-{tier_color}-100 text-{tier_color}-800 border border-{tier_color}-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">Tier {tier}</span>
                    {gate_badge}
                </div>
                {header_extras}
            </div>
            {value_block}
            {donut_html}
            {timeseries_html}
            <details class="border-t border-surface-container-highest pt-sm group">
                <summary class="flex items-center justify-between gap-xs cursor-pointer list-none">
                    <div class="flex items-center gap-xs">
                        <span class="material-symbols-outlined text-text-secondary text-[14px]">info</span>
                        <span class="font-label-sm text-label-sm text-text-secondary uppercase">근거 · 인사이트</span>
                        {ai_badge}
                    </div>
                    <span class="material-symbols-outlined text-text-secondary text-[16px] transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div class="flex flex-col gap-sm mt-sm">
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            <span class="material-symbols-outlined text-text-secondary text-[14px]">source</span>
                            <span class="font-label-sm text-label-sm text-text-secondary uppercase" data-i18n="evidence_label" data-en="Evidence">근거</span>
                        </div>
                        <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(source, source_en)}</p>
                    </div>
                    <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
                        <div class="flex items-center gap-xs mb-xs">
                            <span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>
                            <span class="font-label-sm text-label-sm text-primary uppercase" data-i18n="insight_label" data-en="Insight">인사이트</span>
                        </div>
                        <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(insight, insight_en)}</p>
                    </div>
                </div>
            </details>
        </div>
        '''

    def render_items_section(self, items: list, title: str = "상세 항목 및 근거",
                              icon: str = "fact_check") -> str:
        """Render a section listing detailed item cards as a responsive grid."""
        if not items:
            return ""
        cards = "".join(self._render_item_card(it) for it in items)
        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                {cards}
            </div>
        </section>
        '''

    def render_kpi_card(self, label: str, value: str, trend: Optional[str] = None,
                       trend_value: Optional[str] = None) -> str:
        """Render KPI card HTML.

        Args:
            label: Metric label
            value: Metric value
            trend: Trend icon (up/down/flat)
            trend_value: Trend percentage

        Returns:
            HTML string
        """
        trend_icons = {
            "up": ("trending_up", "text-emerald-800"),
            "down": ("trending_down", "text-accent-red"),
            "flat": ("trending_flat", "text-text-secondary")
        }
        icon, icon_class = trend_icons.get(trend, ("trending_flat", "text-text-secondary"))

        trend_html = ""
        if trend_value:
            trend_html = f'<span class="font-label-sm text-label-sm {icon_class}">{trend_value}</span>'

        return f'''
        <div class="flex flex-col p-sm bg-surface rounded-lg border border-surface-container-highest">
            <div class="flex justify-between items-start mb-xs">
                <span class="font-label-sm text-label-sm text-text-secondary uppercase">{label}</span>
                <span class="material-symbols-outlined {icon_class} text-[18px]">{icon}</span>
            </div>
            <div class="flex items-baseline gap-xs">
                <span class="font-headline-md text-headline-md text-primary">{value}</span>
                {trend_html}
            </div>
        </div>
        '''

    def _similarity_multiplier(self, score: float) -> float:
        """명세서 산식1: 종합 유사도 → TCO 적용 승수 %."""
        if score >= 90:
            return 0.50
        if score >= 80:
            return 0.60
        if score >= 70:
            return 0.70
        if score >= 60:
            return 0.80
        if score >= 50:
            return 0.90
        return 1.00

    def _multiplier_band_label(self, score: float) -> str:
        pairs = [
            (90, "유사도 90~100 → 50% 적용", "Similarity 90–100 → 50% applied"),
            (80, "유사도 80~90 → 60% 적용",  "Similarity 80–90 → 60% applied"),
            (70, "유사도 70~80 → 70% 적용",  "Similarity 70–80 → 70% applied"),
            (60, "유사도 60~70 → 80% 적용",  "Similarity 60–70 → 80% applied"),
            (50, "유사도 50~60 → 90% 적용",  "Similarity 50–60 → 90% applied"),
        ]
        for threshold, ko, en in pairs:
            if score >= threshold:
                return f'<span data-i18n="mult_band_lbl" data-en="{html.escape(en)}">{html.escape(ko)}</span>'
        return f'<span data-i18n="mult_band_lbl" data-en="Similarity <50 → 100% (no deduction)">유사도 50 미만 → 100% (감점 없음)</span>'

    # -----------------------------------------------------------------
    # Chart helpers (inline SVG, no external libs)
    # -----------------------------------------------------------------

    def _find_tab14_item(self, name: str) -> Optional[Dict[str, Any]]:
        if not self.report_data:
            return None
        for it in self.report_data.get("tabs", {}).get("tab_1_4_market", {}).get("items", []) or []:
            if it.get("item") == name:
                return it
        return None

    # Captive brand hints (대표 캡티브 OEM/금융사). 표 안 배지에 사용.
    _CAPTIVE_HINTS = {
        # OEM (캡티브 금융사 보유)
        "Toyota", "Volkswagen", "VW", "BMW", "Mercedes-Benz", "Mercedes",
        "Audi", "Ford", "Renault", "Hyundai", "Kia", "Honda", "Nissan",
        "Peugeot", "Stellantis", "Fiat", "Volvo", "SEAT", "Skoda",
        # 금융사 (캡티브 계열)
        "Santander Consumer", "BMW Bank", "Volkswagen Financial",
        "Toyota Financial", "Mercedes-Benz Bank", "Ford Credit",
        "Hyundai Capital", "Kia Capital", "Renault Bank",
    }

    def _has_captive_hint(self, name) -> bool:
        # name이 문자열 또는 {name,...} dict로 올 수 있어 방어적으로 이름을 추출.
        if isinstance(name, dict):
            name = name.get("name") or name.get("brand") or name.get("label") or ""
        if not name:
            return False
        return any(k.lower() in str(name).lower() for k in self._CAPTIVE_HINTS)

    def render_top5_ranking_panel(self, title: str, icon: str,
                                    rows: List[Dict[str, Any]],
                                    metric_label: str = "점유율",
                                    show_captive: bool = True,
                                    insight: Optional[str] = None) -> str:
        """Top 5 ranking panel — compact table + mini share bar + cumulative share footer.

        Each row: {label, value(%)} (optional `captive: bool`, `extra: str`).
        """
        if not rows:
            return ""
        rows = list(rows)[:5]
        max_v = max((r.get("value") or 0) for r in rows) or 1
        cumulative = sum((r.get("value") or 0) for r in rows)

        body_rows = ""
        for i, r in enumerate(rows):
            v = r.get("value") or 0
            label = r.get("label") or ""
            bar_pct = (v / max_v) * 100
            captive = r.get("captive")
            if captive is None and show_captive:
                captive = self._has_captive_hint(label)
            captive_chip = (
                '<span class="inline-flex items-center gap-xs bg-secondary-container/30 text-secondary border border-secondary/40 px-2 py-[1px] rounded-full font-label-sm text-label-sm" title="캡티브 금융사 보유 추정">'
                '<span class="material-symbols-outlined text-[12px]">verified</span><span data-i18n="captive_chip" data-en="Captive">캡티브</span></span>'
                if captive else ''
            )
            extra = r.get("extra") or ""
            extra_html = f'<span class="font-label-sm text-label-sm text-text-secondary ml-xs">{extra}</span>' if extra else ''
            rank_class = "text-primary" if i == 0 else "text-text-secondary"
            body_rows += f'''
            <tr class="border-b border-surface-container-highest last:border-b-0">
                <td class="py-sm pr-sm align-middle">
                    <div class="flex items-center gap-sm">
                        <span class="font-headline-md text-headline-md {rank_class} w-6 text-right">{i+1}</span>
                        <div class="flex flex-col">
                            <span class="font-label-md text-label-md text-text-primary">{label}</span>
                            <div class="flex items-center gap-xs mt-[2px]">{captive_chip}{extra_html}</div>
                        </div>
                    </div>
                </td>
                <td class="py-sm px-sm align-middle w-[40%]">
                    <div class="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full bg-primary" style="width: {bar_pct:.1f}%"></div>
                    </div>
                </td>
                <td class="py-sm pl-sm align-middle text-right w-[80px]">
                    <span class="font-headline-md text-headline-md text-primary">{v:.1f}</span>
                    <span class="font-label-sm text-label-sm text-text-secondary">%</span>
                </td>
            </tr>
            '''

        insight_html = (
            f'<div class="mt-md bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">'
            f'<div class="flex items-center gap-xs mb-xs"><span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>'
            f'<span class="font-label-sm text-label-sm text-primary uppercase tracking-wider" data-i18n="insight_label" data-en="Insight">인사이트</span></div>'
            f'<p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{insight}</p></div>'
            if insight else ''
        )

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
                <div class="flex items-center gap-sm">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                    <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
                </div>
                <div class="text-right">
                    <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider"><span data-i18n="top5_cumulative" data-en="Top 5 cumulative">Top 5 누적</span> <span data-i18n="metric_share" data-en="share">{metric_label}</span></div>
                    <div class="font-headline-md text-headline-md text-primary">{cumulative:.1f}<span class="font-body-sm text-body-sm text-text-secondary">%</span></div>
                </div>
            </div>
            <table class="w-full">
                <thead>
                    <tr class="text-text-secondary border-b border-surface-container-highest">
                        <th class="py-xs pr-sm text-left font-label-sm text-label-sm uppercase">순위 · 기업</th>
                        <th class="py-xs px-sm text-left font-label-sm text-label-sm uppercase">{metric_label}</th>
                        <th class="py-xs pl-sm text-right font-label-sm text-label-sm uppercase">값</th>
                    </tr>
                </thead>
                <tbody>{body_rows}</tbody>
            </table>
            {insight_html}
        </section>
        '''

    def render_horizontal_bar_chart(self, title: str, icon: str,
                                     rows: List[Dict[str, Any]],
                                     value_label: str = "점유율(%)") -> str:
        """Render a horizontal bar chart from a list of {label, value, sub?} dicts."""
        if not rows:
            return ""
        max_v = max((r.get("value") or 0) for r in rows) or 1
        bar_h = 28
        gap = 12
        height = len(rows) * (bar_h + gap) + 20
        bars = ""
        for i, r in enumerate(rows):
            y = 10 + i * (bar_h + gap)
            v = r.get("value") or 0
            width = (v / max_v) * 540
            label = r.get("label", "")
            sub = r.get("sub")
            bars += f'''
            <g>
                <text x="0" y="{y + bar_h/2 + 4}" font-size="13" fill="#14171c" font-weight="600">{i+1}. {label}</text>
                <rect x="180" y="{y}" width="{width}" height="{bar_h}" rx="4" fill="#3f6cb4" opacity="0.85"/>
                <text x="{180 + width + 8}" y="{y + bar_h/2 + 4}" font-size="12" fill="#3b3f46" font-weight="600">{v}%{f' · {sub}' if sub else ''}</text>
            </g>
            '''
        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
            </div>
            <svg class="w-full" viewBox="0 0 760 {height}" preserveAspectRatio="xMidYMid meet">
                {bars}
            </svg>
        </section>
        '''

    def render_range_bar_chart(self, title: str, icon: str, ranges: List[Dict[str, Any]],
                                axis_label: str = "%") -> str:
        """Render a horizontal range bar chart from list of {label, lo, hi, accent?} dicts."""
        if not ranges:
            return ""
        all_lo = min(r["lo"] for r in ranges)
        all_hi = max(r["hi"] for r in ranges)
        span = (all_hi - all_lo) or 1
        bar_h = 24
        gap = 16
        height = len(ranges) * (bar_h + gap) + 40
        items_html = ""
        for i, r in enumerate(ranges):
            y = 20 + i * (bar_h + gap)
            x1 = 160 + ((r["lo"] - all_lo) / span) * 540
            x2 = 160 + ((r["hi"] - all_lo) / span) * 540
            color = r.get("accent", "#3f6cb4")
            items_html += f'''
            <g>
                <text x="0" y="{y + bar_h/2 + 4}" font-size="13" fill="#14171c" font-weight="600">{r['label']}</text>
                <line x1="{x1}" y1="{y + bar_h/2}" x2="{x2}" y2="{y + bar_h/2}" stroke="{color}" stroke-width="6" stroke-linecap="round"/>
                <circle cx="{x1}" cy="{y + bar_h/2}" r="5" fill="{color}"/>
                <circle cx="{x2}" cy="{y + bar_h/2}" r="5" fill="{color}"/>
                <text x="{x1 - 6}" y="{y + bar_h/2 + 4}" font-size="11" fill="#3b3f46" font-weight="600" text-anchor="end">{r['lo']}{axis_label}</text>
                <text x="{x2 + 8}" y="{y + bar_h/2 + 4}" font-size="11" fill="#3b3f46" font-weight="600">{r['hi']}{axis_label}</text>
            </g>
            '''
        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
            </div>
            <svg class="w-full" viewBox="0 0 760 {height}" preserveAspectRatio="xMidYMid meet">
                {items_html}
            </svg>
        </section>
        '''

    def render_line_chart(self, title: str, icon: str, series: List[Dict[str, Any]],
                           y_label: str = "%") -> str:
        """Render line chart. Each series: {name, color, history:[{year,value}], forecast:[...]}.
        history는 실선, forecast는 점선으로 표시."""
        if not series:
            return ""
        all_points = []
        for s in series:
            for pt in s.get("history", []) + s.get("forecast", []):
                all_points.append(pt)
        if not all_points:
            return ""
        years = sorted({p["year"] for p in all_points})
        y_min = min(p["value"] for p in all_points)
        y_max = max(p["value"] for p in all_points)
        if y_min == y_max:
            y_max = y_min + 1
        pad = (y_max - y_min) * 0.1
        y_min -= pad
        y_max += pad

        W, H = 760, 280
        ml, mr, mt, mb = 50, 20, 20, 36
        chart_w = W - ml - mr
        chart_h = H - mt - mb

        def x_of(year):
            return ml + (years.index(year) / max(len(years) - 1, 1)) * chart_w

        def y_of(v):
            return mt + chart_h - ((v - y_min) / (y_max - y_min)) * chart_h

        # gridlines (4 horizontal)
        grid = ""
        for i in range(5):
            gy = mt + chart_h * i / 4
            val = y_max - (y_max - y_min) * i / 4
            grid += f'<line x1="{ml}" y1="{gy}" x2="{ml + chart_w}" y2="{gy}" stroke="#e6e9ec" stroke-width="1"/>'
            grid += f'<text x="{ml - 6}" y="{gy + 4}" font-size="10" fill="#747782" text-anchor="end">{val:.0f}</text>'

        # x axis labels
        x_labels = ""
        for y in years:
            xp = x_of(y)
            x_labels += f'<text x="{xp}" y="{mt + chart_h + 16}" font-size="10" fill="#747782" text-anchor="middle">{y}</text>'

        series_paths = ""
        legend_items = ""
        for s in series:
            color = s.get("color", "#3f6cb4")
            hist = s.get("history", [])
            fc = s.get("forecast", [])
            if hist:
                d_hist = "M " + " L ".join(f"{x_of(p['year'])} {y_of(p['value'])}" for p in hist)
                series_paths += f'<path d="{d_hist}" fill="none" stroke="{color}" stroke-width="2.5"/>'
                for p in hist:
                    series_paths += f'<circle cx="{x_of(p["year"])}" cy="{y_of(p["value"])}" r="3" fill="{color}"/>'
            if fc:
                # connect last hist to first fc
                start = hist[-1] if hist else fc[0]
                d_fc = f"M {x_of(start['year'])} {y_of(start['value'])}"
                for p in fc:
                    d_fc += f" L {x_of(p['year'])} {y_of(p['value'])}"
                series_paths += f'<path d="{d_fc}" fill="none" stroke="{color}" stroke-width="2.5" stroke-dasharray="6 4"/>'
                for p in fc:
                    series_paths += f'<circle cx="{x_of(p["year"])}" cy="{y_of(p["value"])}" r="3" fill="{color}" opacity="0.6"/>'
            legend_items += f'<div class="flex items-center gap-xs"><span class="w-3 h-3 rounded-full" style="background:{color}"></span><span class="font-label-sm text-label-sm text-text-secondary">{s.get("name", "")}</span></div>'

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
                <div class="flex items-center gap-sm">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                    <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
                </div>
                <div class="flex items-center gap-md">{legend_items}</div>
            </div>
            <svg class="w-full" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
                {grid}
                {x_labels}
                {series_paths}
            </svg>
            <p class="font-label-sm text-label-sm text-text-secondary mt-xs"><span data-i18n="line_legend" data-en="Solid = history, dashed = forecast · unit:">실선=과거, 점선=전망 · 단위:</span> {y_label}</p>
        </section>
        '''

    def render_waterfall_chart(self, title: str, icon: str, steps: List[Dict[str, Any]],
                                currency: str = "EUR") -> str:
        """steps: list of {label, value, is_total?}.
        Each non-total contributes additively; is_total resets the running total visually."""
        if not steps:
            return ""
        # Determine y range
        running = 0
        peaks = []
        for s in steps:
            if s.get("is_total"):
                peaks.append(s["value"])
                running = s["value"]
            else:
                running += s["value"]
                peaks.append(running)
        y_max = max(peaks)
        if y_max <= 0:
            y_max = 1

        W = 760
        chart_h = 260
        col_w = (W - 60) / len(steps) * 0.7
        col_gap = (W - 60) / len(steps) * 0.3
        baseline_y = chart_h + 20
        bars = ""
        running = 0
        for i, s in enumerate(steps):
            x = 40 + i * (col_w + col_gap)
            if s.get("is_total"):
                top = s["value"]
                top_y = baseline_y - (top / y_max) * chart_h
                bars += f'<rect x="{x}" y="{top_y}" width="{col_w}" height="{baseline_y - top_y}" fill="#3f6cb4" rx="3"/>'
                bars += f'<text x="{x + col_w/2}" y="{top_y - 6}" font-size="11" fill="#3f6cb4" font-weight="700" text-anchor="middle">{self.format_currency(top, currency)}</text>'
                running = top
            else:
                start = running
                running += s["value"]
                end = running
                top_y = baseline_y - (max(start, end) / y_max) * chart_h
                bot_y = baseline_y - (min(start, end) / y_max) * chart_h
                fill = "#4f8a6d" if s["value"] >= 0 else "#c0533f"
                bars += f'<rect x="{x}" y="{top_y}" width="{col_w}" height="{bot_y - top_y}" fill="{fill}" opacity="0.85" rx="3"/>'
                bars += f'<text x="{x + col_w/2}" y="{top_y - 6}" font-size="11" fill="{fill}" font-weight="700" text-anchor="middle">+{self.format_currency(s["value"], currency)}</text>'
            bars += f'<text x="{x + col_w/2}" y="{baseline_y + 16}" font-size="11" fill="#3b3f46" text-anchor="middle">{s["label"]}</text>'

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
            </div>
            <svg class="w-full" viewBox="0 0 {W} {baseline_y + 40}" preserveAspectRatio="xMidYMid meet">
                <line x1="40" y1="{baseline_y}" x2="{W - 20}" y2="{baseline_y}" stroke="#e6e9ec" stroke-width="1"/>
                {bars}
            </svg>
        </section>
        '''

    def render_cumulative_area_chart(self, title: str, icon: str,
                                      one_off: float, annual_recurring: float,
                                      operations_10y: float, years: int = 10,
                                      currency: str = "EUR") -> str:
        """Render cumulative 10-year cost area chart.
        - one_off paid at year 0 (구축비)
        - annual_recurring + (operations_10y/years) accumulate over time
        Two stacked layers: 일회성(구축비) vs 반복(구독료+유지+운영)."""
        W, H = 760, 320
        ml, mr, mt, mb = 70, 20, 30, 40
        chart_w = W - ml - mr
        chart_h = H - mt - mb
        op_annual = operations_10y / years
        # cumulative total per year (구축비는 Y0에 한 번, 반복비는 매년 누적)
        years_axis = list(range(0, years + 1))
        cum_total = [one_off + (annual_recurring + op_annual) * y for y in years_axis]
        y_max = max(cum_total) or 1

        def x_of(y):
            return ml + (y / years) * chart_w

        def y_of(v):
            return mt + chart_h - (v / y_max) * chart_h

        # Y0 vertical spike bar showing the build-cost jump
        bar_w = 14
        spike_x = x_of(0) - bar_w / 2
        spike_top_y = y_of(one_off)
        spike_h = (y_of(0) - y_of(one_off))
        build_spike = (
            f'<rect x="{spike_x}" y="{spike_top_y}" width="{bar_w}" height="{spike_h}" '
            f'rx="3" fill="#3f6cb4"/>'
            f'<text x="{x_of(0)}" y="{spike_top_y - 8}" font-size="11" fill="#3f6cb4" '
            f'font-weight="700" text-anchor="middle">구축 {self.format_currency(one_off, currency)}</text>'
        )

        # Cumulative total area (under the line)
        area_d = f"M {x_of(0)} {y_of(0)} "
        for i, y in enumerate(years_axis):
            area_d += f"L {x_of(y)} {y_of(cum_total[i])} "
        area_d += f"L {x_of(years)} {y_of(0)} Z"

        # Cumulative total line
        line_d = "M " + " L ".join(f"{x_of(y)} {y_of(cum_total[i])}" for i, y in enumerate(years_axis))

        # Data dots + Y10 label
        dots = ""
        for i, y in enumerate(years_axis):
            dots += f'<circle cx="{x_of(y)}" cy="{y_of(cum_total[i])}" r="3.5" fill="#3f6cb4"/>'
        last_idx = len(years_axis) - 1
        last_label = (
            f'<text x="{x_of(years) - 6}" y="{y_of(cum_total[last_idx]) - 10}" '
            f'font-size="12" fill="#3f6cb4" font-weight="700" text-anchor="end">'
            f'Y{years} 누적 {self.format_currency(cum_total[-1], currency)}</text>'
        )

        # Gridlines + Y axis labels
        grid = ""
        for i in range(5):
            gy = mt + chart_h * i / 4
            val = y_max - y_max * i / 4
            grid += f'<line x1="{ml}" y1="{gy}" x2="{ml + chart_w}" y2="{gy}" stroke="#e6e9ec"/>'
            grid += f'<text x="{ml - 6}" y="{gy + 4}" font-size="10" fill="#747782" text-anchor="end">{self.format_currency(val, currency)}</text>'

        # X-axis labels
        x_labels = ""
        for y in years_axis:
            xp = x_of(y)
            x_labels += f'<text x="{xp}" y="{mt + chart_h + 18}" font-size="10" fill="#747782" text-anchor="middle">Y{y}</text>'

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
                <div class="flex items-center gap-sm">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                    <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
                </div>
                <div class="flex items-center gap-md">
                    <div class="flex items-center gap-xs"><span class="w-3 h-3 rounded-sm" style="background:#3f6cb4"></span><span class="font-label-sm text-label-sm text-text-secondary">Y0 구축비</span></div>
                    <div class="flex items-center gap-xs"><span class="w-3 h-3 rounded-full" style="background:#3f6cb4"></span><span class="font-label-sm text-label-sm text-text-secondary">누적 총비용</span></div>
                </div>
            </div>
            <svg class="w-full" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
                {grid}
                <path d="{area_d}" fill="#3f6cb4" opacity="0.12"/>
                <path d="{line_d}" fill="none" stroke="#3f6cb4" stroke-width="2.5"/>
                {dots}
                {build_spike}
                {last_label}
                {x_labels}
            </svg>
            <div class="mt-md bg-surface-container/60 p-md rounded-lg border-l-4 border-primary">
                <div class="flex items-center gap-xs mb-xs">
                    <span class="material-symbols-outlined text-primary text-[14px]">function</span>
                    <span class="font-label-sm text-label-sm text-primary uppercase tracking-wider" data-i18n="formula" data-en="Formula">산식</span>
                </div>
                <code class="block font-body-sm text-body-sm text-on-surface-variant leading-relaxed" data-i18n="cum_formula" data-en="Cumulative(Y) = Build cost + (Annual subscription + Annual maintenance + Opex ÷ {years}) × Y">
                    누적(Y) = 구축비 + (연 구독료 + 연 유지보수 + 운영비 ÷ {years}) × Y
                </code>
            </div>
        </section>
        '''

    def render_step_chart(self, title: str, icon: str, tiers: List[Dict[str, Any]],
                          current_volume: int, currency: str = "EUR") -> str:
        """Step chart showing subscription price per unit as cumulative volume crosses tier thresholds."""
        if not tiers:
            return ""
        W, H = 760, 260
        ml, mr, mt, mb = 60, 20, 20, 40
        chart_w = W - ml - mr
        chart_h = H - mt - mb
        # x range
        x_max = max(t["max_volume"] for t in tiers if t["max_volume"] < 999999) * 1.05
        x_max = max(x_max, current_volume * 1.2)
        prices = [t["price_per_unit"] for t in tiers]
        y_max = max(prices) * 1.15
        y_min = 0

        def x_of(v):
            return ml + min(v / x_max, 1.0) * chart_w

        def y_of(v):
            return mt + chart_h - (v / y_max) * chart_h

        # Build step path
        path = ""
        for t in tiers:
            x1 = x_of(t["min_volume"])
            x2 = x_of(min(t["max_volume"], x_max))
            y = y_of(t["price_per_unit"])
            path += f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#3f6cb4" stroke-width="3" stroke-linecap="round"/>'
        # Current volume marker
        cx = x_of(current_volume)
        marker_price = None
        for t in tiers:
            if t["min_volume"] <= current_volume <= t["max_volume"]:
                marker_price = t["price_per_unit"]
                break
        marker = ""
        if marker_price is not None:
            cy = y_of(marker_price)
            marker = f'''
                <line x1="{cx}" y1="{mt}" x2="{cx}" y2="{mt + chart_h}" stroke="#4f8a6d" stroke-width="1.5" stroke-dasharray="4 4"/>
                <circle cx="{cx}" cy="{cy}" r="6" fill="#4f8a6d"/>
                <text x="{cx + 10}" y="{cy + 4}" font-size="12" fill="#4f8a6d" font-weight="700">현재 {current_volume:,}건 → {self.format_currency(marker_price, currency)}</text>
            '''

        # Gridlines and labels (Y)
        grid = ""
        for i in range(5):
            gy = mt + chart_h * i / 4
            val = y_max - y_max * i / 4
            grid += f'<line x1="{ml}" y1="{gy}" x2="{ml + chart_w}" y2="{gy}" stroke="#e6e9ec"/>'
            grid += f'<text x="{ml - 6}" y="{gy + 4}" font-size="10" fill="#747782" text-anchor="end">{self.format_currency(val, currency)}</text>'

        # X labels (tier thresholds)
        x_labels = ""
        for t in tiers:
            xv = t["min_volume"]
            xp = x_of(xv)
            x_labels += f'<text x="{xp}" y="{mt + chart_h + 16}" font-size="10" fill="#747782" text-anchor="middle">{xv:,}</text>'

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">{icon}</span>
                <h2 class="font-headline-md text-headline-md text-primary">{title}</h2>
            </div>
            <svg class="w-full" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet">
                {grid}
                {x_labels}
                {path}
                {marker}
            </svg>
            <p class="font-label-sm text-label-sm text-text-secondary mt-xs" data-i18n="step_chart_subtitle" data-en="X = cumulative contracts, Y = per-unit price · auto-discounted as volume grows (retroactive to all volume)">X=누적 계약건수, Y=건당 단가 · 누적 증가 시 자동 하향 (전 물량 소급)</p>
        </section>
        '''

    # -----------------------------------------------------------------
    # Summary KPI visualizations (similarity donut / TCO waterfall /
    # build-period comparison bar). 대상국=남색(#3f6cb4), 베이스라인=회색(#e6e9ec).
    # -----------------------------------------------------------------
    _NAVY = "#3f6cb4"
    _GRAY = "#e6e9ec"

    def render_similarity_donut_card(self, score: float) -> str:
        """유사도 점수를 도넛(남색=유사, 회색=차이)으로 표시하는 패널 카드."""
        import math
        score = max(0.0, min(100.0, float(score or 0)))
        cx, cy, r_outer, r_inner = 80, 80, 64, 42
        # 단일 호(score%) — 남색. 나머지는 회색 트랙 풀링.
        track = (
            f'<circle cx="{cx}" cy="{cy}" r="{(r_outer + r_inner) / 2:.1f}" '
            f'fill="none" stroke="{self._GRAY}" stroke-width="{r_outer - r_inner}"/>'
        )
        frac = score / 100.0
        start = -math.pi / 2
        end = start + frac * 2 * math.pi
        large = 1 if frac > 0.5 else 0
        rm = (r_outer + r_inner) / 2
        x1, y1 = cx + rm * math.cos(start), cy + rm * math.sin(start)
        x2, y2 = cx + rm * math.cos(end), cy + rm * math.sin(end)
        arc = (
            f'<path d="M {x1:.2f} {y1:.2f} A {rm:.1f} {rm:.1f} 0 {large} 1 {x2:.2f} {y2:.2f}" '
            f'fill="none" stroke="{self._NAVY}" stroke-width="{r_outer - r_inner}" stroke-linecap="round"/>'
        ) if frac > 0 else ''
        return f'''
        <div class="flex flex-col h-full">
            <div class="flex items-center justify-between mb-md">
                <span class="font-headline-md text-headline-md text-primary tracking-tight" data-i18n="kpi_similarity" data-en="Similarity Score">유사도 점수</span>
                <span class="material-symbols-outlined text-primary text-[28px]">donut_large</span>
            </div>
            <div class="flex-1 flex items-center justify-center">
                <svg viewBox="0 0 160 160" class="w-full max-w-[220px] h-auto" preserveAspectRatio="xMidYMid meet">
                    {track}
                    {arc}
                    <text x="{cx}" y="{cy + 11}" text-anchor="middle" font-size="38" font-weight="800" fill="{self._NAVY}">{score:.1f}</text>
                </svg>
            </div>
        </div>
        '''

    def render_tco_waterfall_card(self, tco: Dict[str, Any], currency: str = "EUR") -> str:
        """예상 10년 TCO를 워터폴(구축 → 구독 → 유지 → 운영 → 총계)로 표시.
        비총계 단계=회색, 총계=남색. 패널 박스 없이 헤더+SVG만 출력."""
        build_cost = tco.get("build_cost", 0) or 0
        annual_sub = tco.get("annual_subscription", 0) or 0
        annual_mnt = tco.get("annual_maintenance", 0) or 0
        ops_10y = tco.get("operations_10y", 0) or 0
        total = tco.get("total_tco_10y", 0) or 0
        steps = [
            {"label": "구축비", "en": "Build", "value": build_cost},
        ]
        # 구독료는 구독제 솔루션(NetSol)일 때만 단계로 표시. 비구독이면 운영비에 포함되어 0.
        if annual_sub > 0:
            steps.append({"label": "구독료(10Y)", "en": "Subscr.(10Y)", "value": annual_sub * 10})
        steps += [
            {"label": "유지보수(10Y)", "en": "Maint.(10Y)", "value": annual_mnt * 10},
            {"label": "운영비(10Y)", "en": "Ops(10Y)", "value": ops_10y},
            {"label": "10년 TCO", "en": "10Y TCO", "value": total, "is_total": True},
        ]

        peaks, running = [], 0
        for s in steps:
            if s.get("is_total"):
                running = s["value"]
            else:
                running += s["value"]
            peaks.append(running)
        y_max = max(peaks) or 1

        W, chart_h = 360, 200
        col_w = (W - 40) / len(steps) * 0.66
        col_gap = (W - 40) / len(steps) * 0.34
        baseline_y = chart_h + 16
        bars, running = "", 0
        for i, s in enumerate(steps):
            x = 24 + i * (col_w + col_gap)
            if s.get("is_total"):
                top = s["value"]
                top_y = baseline_y - (top / y_max) * chart_h
                bars += f'<rect x="{x}" y="{top_y}" width="{col_w}" height="{baseline_y - top_y}" fill="{self._NAVY}" rx="3"/>'
                bars += f'<text x="{x + col_w/2}" y="{top_y - 6}" font-size="11" fill="{self._NAVY}" font-weight="700" text-anchor="middle">{self.format_currency(top, currency)}</text>'
                running = top
            else:
                start = running
                running += s["value"]
                top_y = baseline_y - (max(start, running) / y_max) * chart_h
                bot_y = baseline_y - (min(start, running) / y_max) * chart_h
                bars += f'<rect x="{x}" y="{top_y}" width="{col_w}" height="{bot_y - top_y}" fill="{self._GRAY}" rx="3"/>'
                bars += f'<text x="{x + col_w/2}" y="{top_y - 6}" font-size="10" fill="#747782" font-weight="700" text-anchor="middle">+{self.format_currency(s["value"], currency)}</text>'
            bars += (f'<text x="{x + col_w/2}" y="{baseline_y + 14}" font-size="9.5" fill="#3b3f46" '
                     f'text-anchor="middle" data-i18n="wf_label" data-en="{html.escape(s["en"])}">{s["label"]}</text>')

        return f'''
        <div class="flex flex-col h-full">
            <div class="flex items-center justify-between mb-md">
                <span class="font-headline-md text-headline-md text-primary tracking-tight" data-i18n="kpi_tco" data-en="Est. 10Y TCO">예상 10년 TCO</span>
                <span class="material-symbols-outlined text-primary text-[28px]">payments</span>
            </div>
            <div class="flex-1 flex items-center">
                <svg class="w-full" viewBox="0 0 {W} {baseline_y + 24}" preserveAspectRatio="xMidYMid meet">
                    <line x1="24" y1="{baseline_y}" x2="{W - 16}" y2="{baseline_y}" stroke="{self._GRAY}" stroke-width="1"/>
                    {bars}
                </svg>
            </div>
        </div>
        '''

    def render_build_period_card(self, tco: Dict[str, Any]) -> str:
        """예상 구축기간을 베이스라인 국가 대비 가로 바(대상=남색, 베이스라인=회색)로 표시."""
        target_months = float(tco.get("build_months", 0) or 0)
        bd = tco.get("build_breakdown", {}) or {}
        bd_inputs = bd.get("inputs", {}) or {}
        base_months = float(bd_inputs.get("B 구축기간(개월)", 0) or 0)
        base_code = bd_inputs.get("베이스라인 국가", "") or ""
        target_code = self.report_data.get("target", {}).get("country", "") if self.report_data else ""

        max_m = max(target_months, base_months) or 1
        # 라벨(국가명)을 바 위에 올려 폭 제약 없이 표시 — 영문 긴 국가명 잘림 방지.
        W, bar_h, lbl_h, gap, top, val_w = 360, 30, 22, 28, 8, 44
        track_w = W - val_w
        rows = [
            (target_code, target_months, self._NAVY),
            (base_code, base_months, self._GRAY),
        ]
        bars = ""
        for i, (code, m, color) in enumerate(rows):
            y = top + i * (lbl_h + bar_h + gap)
            bar_y = y + lbl_h
            w = (m / max_m) * track_w
            name_ko = html.escape(self.get_country_name(code))
            name_en = html.escape(self.get_country_name_en(code))
            bars += (
                f'<text x="0" y="{y + 11}" font-size="15" fill="#3b3f46" font-weight="700">'
                f'<tspan data-i18n="country_name" data-en="{name_en}">{name_ko}</tspan></text>'
                f'<rect x="0" y="{bar_y}" width="{track_w}" height="{bar_h}" rx="5" fill="#eef0f2"/>'
                f'<rect x="0" y="{bar_y}" width="{w:.1f}" height="{bar_h}" rx="5" fill="{color}"/>'
                f'<text x="{w + 8:.1f}" y="{bar_y + bar_h / 2 + 4}" font-size="13" fill="{color if color != self._GRAY else "#747782"}" font-weight="700">{m:.1f}M</text>'
            )
        height = top + len(rows) * (lbl_h + bar_h + gap)
        delta = base_months - target_months
        delta_pct = (delta / base_months * 100) if base_months else 0
        footer = (
            f'<p class="font-label-sm text-label-sm text-text-secondary mt-sm">'
            f'<span data-i18n="build_vs_baseline" data-en="vs baseline: ">베이스라인 대비 </span>'
            f'<strong class="text-primary">{delta:.1f}M ({delta_pct:.0f}%) '
            f'<span data-i18n="build_shorter" data-en="shorter">단축</span></strong></p>'
            if delta > 0 else ''
        )
        return f'''
        <div class="flex flex-col h-full">
            <div class="flex items-center justify-between mb-md">
                <span class="font-headline-md text-headline-md text-primary tracking-tight" data-i18n="kpi_build_period" data-en="Est. Build Period">예상 구축 기간</span>
                <span class="material-symbols-outlined text-primary text-[28px]">schedule</span>
            </div>
            <div class="flex-1 flex items-center">
                <svg class="w-full" viewBox="0 0 {W} {height}" preserveAspectRatio="xMidYMid meet">
                    {bars}
                </svg>
            </div>
            {footer}
        </div>
        '''

    def render_tab_0_summary(self) -> str:
        """Render Tab 1-0: Executive Summary."""
        if not self.report_data:
            return ""

        target = self.report_data.get("target", {})
        tabs = self.report_data.get("tabs", {})
        similarity = tabs.get("tab_1_1_similarity", {})
        tco = tabs.get("tab_1_3_tco", {})
        decision = tabs.get("tab_1_2_decision", {})

        country_name = self.get_country_name(target.get("country", ""))
        base_country_code = decision.get("base_country") or target.get("base_country", "GB")
        base_country_name = self.get_country_name(base_country_code)
        decision_type = decision.get("decision", "")
        decision_label = self._decision_label(decision_type, base_country_name, base_country_code)
        overall_insight = self.report_data.get("overall_insight") or ""
        overall_insight_en = self.report_data.get("overall_insight_en") or ""

        # Extract key metrics for KPI cards
        similarity_score = similarity.get("overall_score", 0)
        total_tco = tco.get("total_tco_10y", 0)
        build_months = tco.get("build_months", 0)
        currency = tco.get("currency", "EUR")

        # 3-up 시각화: 유사도 도넛 · TCO 워터폴 · 구축기간 비교 바
        # (대상국=남색, 베이스라인=회색)
        kpi_visuals_html = (
            self.render_similarity_donut_card(similarity_score)
            + self.render_tco_waterfall_card(tco, currency)
            + self.render_build_period_card(tco)
        )

        decision_tree_html = self.render_decision_tree_section(include_outer=True)

        # 요약 패널 — 핵심 결론을 두 줄 문장으로 (recommendation은 ko/en dict 가능)
        #  1줄: 유사도·시스템 결정·10년 TCO·구축/계약을 한 문장으로 이어붙임
        #  2줄: 권고 결론을 한 문장으로 압축
        recommendation_value = decision.get("recommendation", "")
        recommendation_text = self._loc_span(recommendation_value) if recommendation_value else ""
        expected_contracts = tco.get("expected_contracts", 0)
        target_country_code = target.get("country", "")

        # 1줄: 대상국의 유사도 평가와 그에 따른 시스템 결정
        summary_line_1 = (
            f'<strong>{self.country_name_span(target_country_code)}'
            f'({target_country_code})</strong>'
            f'<span data-i18n="summary_line1_a" data-en=" shows an overall similarity of">의 종합 유사도는 베이스라인 </span>'
            f'<strong>{self.country_name_span(base_country_code)}({base_country_code})</strong> '
            f'<span data-i18n="summary_line1_b" data-en="against the baseline, leading to a recommended system decision of">대비 </span>'
            f'<strong>{similarity_score:.1f}<span data-i18n="bullet_pts_100" data-en=" / 100">점/100</span></strong>'
            f'<span data-i18n="summary_line1_c" data-en=".">으로, 이에 따라 시스템 결정은 </span>'
            f'<strong>{decision_label}</strong>'
            f'<span data-i18n="summary_line1_d" data-en=" is recommended.">(으)로 권고됩니다.</span>'
        )

        # 2줄: 비용·일정 핵심 수치
        summary_line_2 = (
            f'<span data-i18n="summary_line2_a" data-en="The estimated 10-year TCO is">예상 10년 TCO는 </span>'
            f'<strong>{self.format_currency(total_tco, currency)}</strong>'
            f'<span data-i18n="summary_line2_b" data-en=", with an estimated build duration of">이며, 구축 기간은 약 </span>'
            f'<strong>{build_months:.1f}<span data-i18n="unit_months" data-en=" months">개월</span></strong>'
            f'<span data-i18n="summary_line2_c" data-en=" and estimated new contracts of">, 예상 신규 계약은 </span>'
            f'<strong>{expected_contracts:,}<span data-i18n="unit_per_year" data-en="/yr">건/년</span></strong>'
            f'<span data-i18n="summary_line2_d" data-en=".">으로 추정됩니다.</span>'
        )

        # 3줄: 권고 결론 한 문장 (recommendation 있으면 그 문장, 없으면 결정 라벨 기반 문장)
        if recommendation_text:
            summary_line_3 = (
                f'<span data-i18n="summary_line3_concl" data-en="Conclusion:">결론적으로, </span>'
                f'{recommendation_text}'
                f'<span data-i18n="summary_line3_tail" data-en=" is the recommended path.">을(를) 권고합니다.</span>'
            )
        else:
            summary_line_3 = (
                f'<span data-i18n="summary_line3_concl" data-en="Conclusion:">결론적으로, </span>'
                f'<strong>{decision_label}</strong>'
                f'<span data-i18n="summary_line3_tail" data-en=" is the recommended path.">을(를) 권고합니다.</span>'
            )

        # 요약 헤더 — mockup 다크 히어로(그라데이션 + 우측 큰 점수 + eyebrow 라벨).
        #  좌: eyebrow / 국기·국가명 / 3줄 요약문(아이콘 불릿)  우: 64px 유사도 점수 + 결정 배지
        flag_url = self.get_country_flag_url(target_country_code)
        flag_img = (f'<img src="{html.escape(flag_url)}" alt="" '
                    f'style="width:34px;height:23px;border-radius:3px;object-fit:cover;'
                    f'box-shadow:0 0 0 1px rgba(255,255,255,.15)"/>') if flag_url else ""
        summary_panel = f'''
        <section class="rounded-[18px] px-[30px] py-[28px] card-shadow text-white"
                 style="background:linear-gradient(120deg,#101622,#1F2D45)">
            <div class="font-label-sm text-[12px] mb-sm" style="color:#8FA0BD;letter-spacing:.1em"
                 data-i18n="report_eyebrow" data-en="COUNTRY DIAGNOSTIC REPORT · IT SIMILARITY">국가 진단 보고서 · IT 유사도</div>
            <div class="flex items-start justify-between gap-lg flex-wrap">
                <div class="flex-1 min-w-0" style="min-width:280px">
                    <div class="flex items-center gap-sm mb-md">
                        {flag_img}
                        <span class="text-[28px] font-bold leading-none">{self.country_name_span(target_country_code)}({target_country_code})</span>
                    </div>
                    <div class="flex flex-col gap-sm [&_strong]:text-white">
                        <p class="flex items-start gap-sm font-body-md text-[15px] leading-[1.6] m-0" style="color:rgba(255,255,255,.9)">
                            <span>{summary_line_1}</span>
                        </p>
                        <p class="flex items-start gap-sm font-body-md text-[15px] leading-[1.6] m-0" style="color:rgba(255,255,255,.9)">
                            <span>{summary_line_2}</span>
                        </p>
                        <p class="flex items-start gap-sm font-body-md text-[15px] leading-[1.6] m-0" style="color:rgba(255,255,255,.9)">
                            <span>{summary_line_3}</span>
                        </p>
                    </div>
                </div>
                <div class="text-center flex-none">
                    <div class="mono font-bold leading-none" style="font-size:64px;color:#7FB6FF">{similarity_score:.1f}</div>
                    <div class="font-body-sm text-[12px] mt-1" style="color:#AEB6C4"
                         data-i18n="similarity_score_label" data-en="IT Similarity">IT 유사도 점수</div>
                    <div class="mt-sm rounded-[9px] px-[14px] py-[6px] font-body-sm text-[12px] font-semibold inline-block"
                         style="background:rgba(63,108,180,.3);border:1px solid rgba(63,108,180,.5);color:#7FB6FF">{decision_label}</div>
                </div>
            </div>
        </section>
        '''

        # 국가 종합 인사이트 패널 — overall_insight를 항상 문장 단위 불릿으로 분할.
        # 한국어 문장을 기준으로 쪼개고, 영어는 문장 수가 정확히 일치할 때만 1:1 매칭.
        # 불일치 시(예: 12 vs 13문장) 영어를 통문장으로 합쳐 한 덩어리가 되던 버그 방지 —
        # 이 경우 한국어 불릿은 그대로 쪼개고 영어는 생략한다(_bi_span이 en 없으면 한글만 렌더).
        def _to_bullets(text: str, text_en: str = "") -> str:
            if not text:
                return ""
            import re
            sentences_ko = [s.strip() for s in re.split(r"(?<=[.!?。])\s+", text.strip()) if s.strip()]
            sentences_en = [s.strip() for s in re.split(r"(?<=[.!?。])\s+", text_en.strip()) if s.strip()] if text_en else []
            if not sentences_ko:
                sentences_ko = [text.strip()]
            # 양 언어 문장 수 같으면 1:1 매칭, 다르면 한국어만 문장별 불릿(영어 생략)
            if sentences_en and len(sentences_en) == len(sentences_ko):
                pairs = list(zip(sentences_ko, sentences_en))
            else:
                pairs = [(s, "") for s in sentences_ko]
            return "".join(
                f'<li class="flex items-start gap-sm">'
                f'<span class="material-symbols-outlined text-primary text-[16px] mt-[2px]">arrow_right</span>'
                f'<span class="font-body-md text-body-md text-on-surface-variant leading-relaxed">{self._bi_span(ko, en)}</span>'
                f'</li>'
                for ko, en in pairs
            )

        overall_insight_panel = ""
        if overall_insight:
            overall_insight_panel = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">lightbulb</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_overall_insight" data-en="Country Overall Insight">국가 종합 인사이트</h2>
                </div>
                <ul class="flex flex-col gap-sm list-none p-0 m-0">
                    {_to_bullets(overall_insight, overall_insight_en)}
                </ul>
            </section>
            '''

        return f'''
        <div class="flex flex-col gap-xl">
            {summary_panel}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                {kpi_visuals_html}
            </div>
            <div class="grid grid-cols-12 gap-gutter items-stretch">
                <div class="col-span-8 flex flex-col gap-xl">
                    {decision_tree_html.replace('<section class="', '<section class="flex-1 ', 1)}
                </div>
                <div class="col-span-4 flex flex-col gap-xl">
                    {self.render_subscription_tier_table().replace('<section class="', '<section class="flex-1 ', 1)}
                </div>
                <div class="col-span-12">
                    {overall_insight_panel}
                </div>
            </div>
        </div>
        '''

    def _render_dimension_scoring_card(self, item: Dict[str, Any], base_country_name: str, target_country_name: str) -> str:
        """Render a single item with its dimension-by-dimension scoring breakdown."""
        name = item.get("item", "")
        axis = item.get("axis", "")
        item_score = item.get("item_similarity", 0)
        weight = item.get("weight", 0)
        dims = item.get("dimensions", []) or []

        rows = ""
        for d in dims:
            dim_name = d.get("dimension", "")
            t = d.get("target_score", 0)
            b = d.get("base_score", 0)
            gap = d.get("gap", 0)
            sim = d.get("similarity", 0)
            note = d.get("note", "")
            note_en = d.get("note_en", "")
            # bar widths max 5 → 0-100%
            t_pct = (float(t) / 5.0) * 100.0
            b_pct = (float(b) / 5.0) * 100.0
            rows += f'''
            <tr class="border-b border-surface-container-highest align-top">
                <td class="py-sm pr-sm">
                    <div class="font-body-sm text-body-sm text-text-primary font-semibold">{dim_name}</div>
                    {f'<div class="font-body-sm text-body-sm text-text-secondary mt-xs">{self._bi_span(note, note_en)}</div>' if note else ''}
                </td>
                <td class="py-sm px-sm w-[110px]">
                    <div class="flex items-center gap-xs">
                        <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-primary" style="width: {t_pct:.0f}%"></div>
                        </div>
                        <span class="font-label-sm text-label-sm text-text-primary w-[20px] text-right">{t}</span>
                    </div>
                </td>
                <td class="py-sm px-sm w-[110px]">
                    <div class="flex items-center gap-xs">
                        <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                            <div class="h-full bg-secondary" style="width: {b_pct:.0f}%"></div>
                        </div>
                        <span class="font-label-sm text-label-sm text-text-primary w-[20px] text-right">{b}</span>
                    </div>
                </td>
                <td class="py-sm px-sm w-[60px] text-right font-label-sm text-label-sm {('text-emerald-700' if gap <= 1 else ('text-yellow-700' if gap <= 2 else 'text-accent-red'))}">{gap:.0f}</td>
                <td class="py-sm pl-sm w-[80px] text-right font-label-md text-label-md text-primary font-bold">{sim:.0f}</td>
            </tr>
            '''

        score_color = "emerald" if item_score >= 70 else ("yellow" if item_score >= 50 else "red")

        return f'''
        <div class="bg-surface border border-surface-container-highest rounded-lg p-md">
            <div class="flex items-start justify-between gap-md mb-sm">
                <div>
                    <div class="font-label-md text-label-md text-text-primary uppercase tracking-wider">{name}</div>
                    <div class="font-label-sm text-label-sm text-text-secondary mt-xs"><span data-i18n="dim_axis" data-en="Axis">축</span>: {axis or '-'} · <span data-i18n="dim_weight" data-en="Weight">가중치</span> {weight*100:.0f}%</div>
                </div>
                <div class="flex flex-col items-end">
                    <div class="font-headline-md text-headline-md text-{score_color}-700">{item_score:.0f}</div>
                    <div class="font-label-sm text-label-sm text-text-secondary">/ 100</div>
                </div>
            </div>
            <table class="w-full font-body-sm text-body-sm">
                <thead>
                    <tr class="text-text-secondary border-b border-surface-container-highest">
                        <th class="py-xs pr-sm text-left font-label-sm text-label-sm uppercase" data-i18n="th_dimension" data-en="Dimension">디멘전</th>
                        <th class="py-xs px-sm text-left font-label-sm text-label-sm uppercase">{target_country_name} <span class="text-text-secondary normal-case">(<span data-i18n="header_target" data-en="Target">대상국</span>)</span></th>
                        <th class="py-xs px-sm text-left font-label-sm text-label-sm uppercase">{base_country_name} <span class="text-text-secondary normal-case">(<span data-i18n="header_baseline" data-en="Baseline">베이스라인</span>)</span></th>
                        <th class="py-xs px-sm text-right font-label-sm text-label-sm uppercase" data-i18n="th_gap" data-en="Gap">격차</th>
                        <th class="py-xs pl-sm text-right font-label-sm text-label-sm uppercase" data-i18n="th_similarity" data-en="Similarity">유사도</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
        '''

    def render_similarity_scoring_section(self) -> str:
        """Render dimension-by-dimension similarity scoring tables for each item."""
        if not self.report_data:
            return ""
        tabs = self.report_data.get("tabs", {})
        similarity = tabs.get("tab_1_1_similarity", {})
        items = similarity.get("items", []) or []
        if not items:
            return ""

        target_country_code = self.report_data.get("target", {}).get("country", "")
        base_country_code = self.report_data.get("target", {}).get("base_country", "GB")
        target_country_name = self.get_country_name(target_country_code)
        base_country_name = self.get_country_name(base_country_code)

        cards = "".join(
            self._render_dimension_scoring_card(it, base_country_name, target_country_name)
            for it in items
        )

        scale_note = similarity.get("scale", "")
        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">calculate</span>
                <h2 class="font-headline-md text-headline-md text-primary"><span data-i18n="dim_scoring" data-en="Dimension Scoring">디멘전별 채점</span> ({self.country_name_span(target_country_code)} <span data-i18n="sim_vs" data-en="vs">vs</span> {self.country_name_span(base_country_code)})</h2>
            </div>
            <p class="font-body-sm text-body-sm text-text-secondary mb-md" data-i18n="dim_scoring_note" data-en="Each dimension is rated 1-5 for both countries; similarity is derived from the gap.">각 디멘전을 1~5점 척도로 양국 평가 후, 격차에 따라 유사도를 산출합니다.</p>
            <div class="flex flex-col gap-md">
                {cards}
            </div>
        </section>
        '''

    def _render_radar_svg(self, axes: dict) -> str:
        """4축 레이더(시스템·상품·규제·리스크) — shadcn/Recharts 'stroke radar' 스타일 SVG 이식.

        점선 폴라 그리드(strokeDasharray 3 3) + 옅은 채움 + 깔끔한 점.
        축 순서(시계 12시→시계방향): 시스템(상)·상품(우)·규제(하)·리스크(좌).
        axes 값은 0~100. viewBox 0 0 200 200, 중심(100,100), 반경 80.
        """
        cx = cy = 100.0
        R = 80.0
        order = ["system", "product", "regulatory", "risk"]
        # 각 축의 단위벡터 (상/우/하/좌)
        dirs = {"system": (0, -1), "product": (1, 0), "regulatory": (0, 1), "risk": (-1, 0)}

        def pt(axis, frac):
            dx, dy = dirs[axis]
            return (cx + dx * R * frac, cy + dy * R * frac)

        # 점선 폴라 그리드(4단계 동심 다이아몬드)
        grid = []
        for ring in (0.25, 0.5, 0.75, 1.0):
            poly = " ".join(f"{x:.1f},{y:.1f}" for x, y in (pt(a, ring) for a in order))
            grid.append(f'<polygon fill="none" points="{poly}" stroke="#D2D7DE" '
                        f'stroke-width="1" stroke-dasharray="3 3"/>')
        # 축 스포크(중심→꼭짓점) 점선
        for a in order:
            ex, ey = pt(a, 1.0)
            grid.append(f'<line x1="{cx}" y1="{cy}" x2="{ex:.1f}" y2="{ey:.1f}" '
                        f'stroke="#E6E9EC" stroke-width="1" stroke-dasharray="3 3"/>')

        # 데이터 폴리곤 + 점
        data_pts = [pt(a, max(0.0, min(100.0, axes.get(a, 0))) / 100.0) for a in order]
        poly_pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in data_pts)
        dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="#3F6CB4" '
                       f'stroke="#fff" stroke-width="1.5"/>' for x, y in data_pts)

        return (
            '<svg class="w-full h-full overflow-visible" viewBox="0 0 200 200">'
            f'{"".join(grid)}'
            f'<polygon points="{poly_pts}" fill="#3F6CB4" fill-opacity="0.12" '
            f'stroke="#3F6CB4" stroke-width="2.5" stroke-linejoin="round"/>'
            f'{dots}'
            '</svg>'
        )

    def render_tab_1_1_similarity(self) -> str:
        """Render Tab 1-1: Similarity Scoring (vs Baseline)."""
        if not self.report_data:
            return ""

        tabs = self.report_data.get("tabs", {})
        similarity = tabs.get("tab_1_1_similarity", {})
        axes = similarity.get("axes", {})
        overall_score = similarity.get("overall_score", 0)
        target_code = self.report_data.get("target", {}).get("country", "")
        base_code = self.report_data.get("target", {}).get("base_country", "GB")
        target_name = self.get_country_name(target_code)
        base_name = self.get_country_name(base_code)
        if target_code == base_code:
            similarity_title = (
                '<span data-i18n="sim_title_self" data-en="Similarity Score (Self-Baseline)">'
                '유사도 점수 (자기 베이스라인)</span>'
            )
        else:
            similarity_title = (
                f'<span data-i18n="sim_title_prefix" data-en="Similarity Score">'
                f'유사도 점수</span> '
                f'({self.country_name_span(target_code)} '
                f'<span data-i18n="sim_vs" data-en="vs">vs</span> '
                f'{self.country_name_span(base_code)})'
            )
        scoring_section = self.render_similarity_scoring_section()
        evidence_section = self.render_items_section(
            similarity.get("evidence_items", []),
            title="유사도 산정 근거 항목 (원천 데이터)",
            icon="fact_check",
        )

        axis_labels = {
            "system":     ("top-0 left-1/2 -translate-x-1/2", "시스템"),
            "product":    ("right-0 top-1/2 -translate-y-1/2", "상품"),
            "regulatory": ("bottom-0 left-1/2 -translate-x-1/2", "규제"),
            "risk":       ("left-0 top-1/2 -translate-y-1/2", "리스크"),
        }
        # Defensive: cover legacy keys if present
        legacy_alias = {"solution_type": "system", "digital_maturity": "system", "product_mix": "product"}
        normalized_axes = {legacy_alias.get(k, k): v for k, v in axes.items()}

        labels_html = ""
        for axis_key, (position, label) in axis_labels.items():
            labels_html += f'<span class="absolute {position} font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">{label}</span>\n'

        metrics_html = ""
        for axis_key, (_, label) in axis_labels.items():
            score = normalized_axes.get(axis_key, 0)
            metrics_html += f'''
            <div class="flex flex-col p-sm bg-surface rounded-lg border border-surface-container-highest">
                <span class="font-label-sm text-label-sm text-text-secondary uppercase">{label}</span>
                <span class="font-headline-md text-headline-md text-primary">{score:.1f}</span>
            </div>
            '''

        radar_axes = {
            "system": normalized_axes.get("system", 0),
            "product": normalized_axes.get("product", 0),
            "regulatory": normalized_axes.get("regulatory", 0),
            "risk": normalized_axes.get("risk", 0),
        }

        return f'''
        <div class="grid grid-cols-12 gap-gutter">
            <div class="col-span-8 flex flex-col gap-xl">
                <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                    <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">radar</span>
                        <h2 class="font-headline-md text-headline-md text-primary m-0">{similarity_title}</h2>
                    </div>
                    <div class="relative flex flex-col items-center">
                        <div class="w-full aspect-square relative flex items-center justify-center mb-md max-w-md mx-auto">
                            {self._render_radar_svg(radar_axes)}
                            {labels_html}
                        </div>
                    </div>
                </section>
            </div>
            <div class="col-span-4 flex flex-col gap-xl">
                <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                    <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">assessment</span>
                        <h2 class="font-headline-md text-headline-md text-primary" data-i18n="per_axis_score" data-en="Per-Axis Score">축별 점수</h2>
                    </div>
                    <div class="grid grid-cols-2 gap-sm mb-md">
                        {metrics_html}
                    </div>
                    <div class="p-md bg-surface-container rounded-lg border-l-4 border-primary mb-sm">
                        <div class="flex items-center gap-xs mb-xs">
                            <span class="material-symbols-outlined text-primary text-[18px]">grade</span>
                            <span class="font-semibold font-label-md text-label-md text-primary uppercase">Overall Score</span>
                        </div>
                        <div class="flex items-baseline gap-xs">
                            <span class="font-headline-lg text-headline-lg text-primary">{overall_score:.1f}</span>
                            <span class="font-body-sm text-body-sm text-text-secondary">/ 100</span>
                        </div>
                    </div>
                    <div class="p-md bg-emerald-50/60 rounded-lg border-l-4 border-emerald-600">
                        <div class="flex items-center gap-xs mb-xs">
                            <span class="material-symbols-outlined text-emerald-700 text-[18px]">percent</span>
                            <span class="font-semibold font-label-md text-label-md text-emerald-800 uppercase" data-i18n="tco_multiplier" data-en="TCO Multiplier">TCO 적용 승수</span>
                        </div>
                        <div class="flex items-baseline gap-xs">
                            <span class="font-headline-lg text-headline-lg text-emerald-700">{self._similarity_multiplier(overall_score) * 100:.0f}%</span>
                        </div>
                        <p class="font-label-sm text-label-sm text-text-secondary mt-xs">{self._multiplier_band_label(overall_score)}</p>
                    </div>
                </section>
            </div>
            <div class="col-span-12">{scoring_section}</div>
            <div class="col-span-12">{evidence_section}</div>
        </div>
        '''

    def render_decision_tree_section(self, include_outer: bool = True) -> str:
        """Render reusable decision tree flowchart section.

        Args:
            include_outer: When True, wraps the flowchart in the standard panel/card
        """
        if not self.report_data:
            return ""

        tabs = self.report_data.get("tabs", {})
        decision = tabs.get("tab_1_2_decision", {})
        similarity_score = decision.get("similarity_score", 0)
        recommendation = decision.get("recommendation", "")
        base_system = decision.get("base_system", "N/A")
        base_country = decision.get("base_country") or self.report_data.get("target", {}).get("base_country", "GB")
        base_country_name = self.get_country_name(base_country)
        hq_cost = decision.get("hq_baseline_cost", 0)
        hq_months = decision.get("hq_baseline_months", 0)
        currency = decision.get("hq_baseline_currency", "EUR")

        decision_type = decision.get("decision", "")

        external_passes = decision.get("external_passes_criteria")  # optional; None = 미평가
        region_system_exists = decision.get("region_system_exists", True)

        # Score-level path label (independent of region gate)
        score_path = "B" if similarity_score >= 70 else ("EXT_CHECK" if similarity_score < 50 else "HQ_MID")

        # Final outcome — region gate first, then score path
        if not region_system_exists:
            # No region system → external-solution gate (YES=EXT, NO=HQ fallback)
            if external_passes is False:
                final_path = "HQ"
            else:
                final_path = "EXT"
        elif score_path == "B":
            final_path = "B"
        elif score_path == "HQ_MID":
            final_path = "HQ"
        else:  # EXT_CHECK
            if decision_type == "external_solution" or external_passes is True:
                final_path = "EXT"
            elif external_passes is False:
                final_path = "HQ"
            else:
                final_path = "EXT"

        path_b = "active" if final_path == "B" else "inactive"
        path_ext = "active" if final_path == "EXT" else "inactive"
        path_hq = "active" if final_path == "HQ" else "inactive"

        # Color tokens by active path — 박스(남색/회색)와 통일: 활성 경로는 항상 primary 남색
        active_color = "#3f6cb4"
        score_branch_x = {"B": 150, "EXT_CHECK": 450, "HQ_MID": 750}[score_path]

        # Localization requirements (특화요건) — pulled from decision items
        spec_field_names = [
            "상품판매 현황", "개인정보보호법", "데이터 현지화 의무",
            "의무보험 규제", "신용생명보험 규제", "보험 끼워팔기 규제",
            "AI 신용평가 규제",
        ]
        decision_items = decision.get("items", []) or []
        items_by_name = {it.get("item", ""): it for it in decision_items}
        spec_chips_html = ""
        for name in spec_field_names:
            it = items_by_name.get(name)
            present = it is not None and it.get("status") != "missing"
            chip_color = "emerald" if present else "yellow"
            icon = "check_circle" if present else "warning"
            spec_chips_html += f'''
            <span class="inline-flex items-center gap-xs bg-{chip_color}-100/60 text-{chip_color}-800 border border-{chip_color}-200 px-2 py-1 rounded-full font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[14px]">{icon}</span>
                {name}
            </span>
            '''

        # Action text per branch
        action_b = (
            f'<span data-i18n="action_b_prefix" data-en="Regional expansion system">'
            f'권역 내 확산 시스템'
            f'</span>({self.country_name_span(base_country)} - {base_system}) '
            f'<span data-i18n="action_b_suffix" data-en="+ local customization → TCO calculation">'
            f'+ 현지 특화 추가개발 → TCO 산정</span>'
        )
        action_ext = (
            '<span data-i18n="action_ext" data-en="Local solutions + 2-3 regional alternatives recommended (when threshold passed)">'
            '현지 사용 솔루션 + 로컬 솔루션 2~3종 추천 (기준점 통과 시)'
            '</span>'
        )
        action_hq = (
            f'<span data-i18n="action_hq_prefix" data-en="HQ system use">'
            f'본사 시스템 사용</span> '
            f'({self.format_currency(hq_cost, currency)} / {hq_months}M '
            f'<span data-i18n="action_hq_basis" data-en="basis">기준</span>)'
        )

        inner = f'''
            <style>
                @keyframes dt-pulse {{
                    0% {{ transform: scale(1); box-shadow: 0 0 0 0 rgba(63,108,180,0.25); }}
                    70% {{ transform: scale(1.04); box-shadow: 0 0 0 16px rgba(63,108,180,0); }}
                    100% {{ transform: scale(1); box-shadow: 0 0 0 0 rgba(63,108,180,0); }}
                }}
                @keyframes dt-pop {{
                    0% {{ transform: scale(0.85); opacity: 0; }}
                    60% {{ transform: scale(1.08); opacity: 1; }}
                    100% {{ transform: scale(1); opacity: 1; }}
                }}
                @keyframes dt-spin {{
                    from {{ transform: rotate(0deg); }}
                    to {{ transform: rotate(360deg); }}
                }}
                @keyframes dt-flow {{
                    to {{ stroke-dashoffset: -24; }}
                }}
                @keyframes dt-dash {{
                    from {{ stroke-dashoffset: 1000; }}
                    to {{ stroke-dashoffset: 0; }}
                }}
                @keyframes dt-glow {{
                    0%, 100% {{ filter: drop-shadow(0 0 6px rgba(63,108,180,0.45)); }}
                    50% {{ filter: drop-shadow(0 0 14px rgba(63,108,180,0.9)); }}
                }}
                .dt-node-start {{ animation: dt-pulse 2.4s ease-in-out infinite; }}
                .dt-diamond {{ animation: dt-pop 0.6s ease-out 0.3s both; transform-origin: center; }}
                .dt-flow-line {{
                    stroke: #9aa0a8;
                    stroke-width: 2;
                    stroke-dasharray: 6 6;
                    animation: dt-flow 1.2s linear infinite;
                    fill: none;
                }}
                .dt-active-path {{
                    stroke: {active_color};
                    stroke-width: 4;
                    stroke-linecap: round;
                    fill: none;
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 1000;
                    animation: dt-dash 1.6s ease-out 0.6s forwards, dt-glow 2s ease-in-out 2.2s infinite;
                }}
                .dt-active-bullet {{ animation: dt-pop 0.5s ease-out 2.0s both, dt-glow 2s ease-in-out 2.4s infinite; transform-origin: center; transform-box: fill-box; }}
                .dt-branch-card {{ animation: dt-pop 0.55s ease-out both; transform-origin: top center; }}
                .dt-branch-b {{ animation-delay: 2.1s; }}
                .dt-branch-ext {{ animation-delay: 2.3s; }}
                .dt-branch-hq {{ animation-delay: 2.5s; }}
                .dt-branch-active {{ box-shadow: 0 6px 18px rgba(0,0,0,0.08); }}
            </style>

            <div class="flex flex-col items-center pt-md gap-sm">
                <svg class="w-full max-w-4xl block" viewBox="0 0 900 640" preserveAspectRatio="xMidYMid meet" style="margin-bottom: -8px;">
                    <defs>
                        <marker id="arrow-soft" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aa0a8" />
                        </marker>
                    </defs>

                    <!-- (a) 권역 내 시스템 존재 다이아몬드 (top) -->
                    <g class="dt-diamond">
                        <polygon points="450,20 520,80 450,140 380,80" fill="#f7f8fa" stroke="#3f6cb4" stroke-width="2"/>
                        <text x="450" y="75" text-anchor="middle" font-size="14" fill="#3f6cb4" font-weight="700">권역 내 구축</text>
                        <text x="450" y="92" text-anchor="middle" font-size="14" fill="#3f6cb4" font-weight="700">시스템 존재?</text>
                    </g>

                    <!-- (a) YES → 점수 다이아몬드 -->
                    <path d="M450 140 L450 200" class="dt-flow-line" opacity="0.25" />
                    <text x="465" y="175" text-anchor="start" font-size="14" font-weight="700" fill="{'#3f6cb4' if region_system_exists else '#9aa0a8'}" data-i18n="yes_with_country" data-en="YES ({self.get_country_name_en(base_country)})">YES ({base_country_name})</text>

                    <!-- (a) NO → 외부솔루션 기준점 다이아몬드 -->
                    <path d="M520 80 L820 80 L820 480 L520 480" class="dt-flow-line" opacity="0.25" />
                    <text x="700" y="70" text-anchor="middle" font-size="14" font-weight="700" fill="{'#3f6cb4' if not region_system_exists else '#9aa0a8'}">NO → 외부솔루션</text>

                    <!-- (b) 점수 분기 다이아몬드 -->
                    <g class="dt-diamond" style="animation-delay: 0.6s;">
                        <polygon points="450,200 525,260 450,320 375,260" fill="#f7f8fa" stroke="{'#3f6cb4' if region_system_exists else '#9aa0a8'}" stroke-width="2"/>
                        <text x="450" y="255" text-anchor="middle" font-size="12" fill="{'#3f6cb4' if region_system_exists else '#9aa0a8'}" font-weight="700">유사도</text>
                        <text x="450" y="280" text-anchor="middle" font-size="18" fill="{'#3f6cb4' if region_system_exists else '#9aa0a8'}" font-weight="800">{similarity_score:.1f}</text>
                    </g>

                    <!-- (b) Score branch 1: ≥70 → B leaf -->
                    <path d="M450 320 L450 360 L150 360 L150 560" class="dt-flow-line" opacity="0.25" />
                    <text x="300" y="350" text-anchor="middle" font-size="14" font-weight="700" fill="{'#3f6cb4' if (region_system_exists and score_path == 'B') else '#9aa0a8'}">≥ 70 → 권역 내 확산</text>

                    <!-- (b) Score branch 2: 50~70 → HQ leaf -->
                    <path d="M450 320 L450 360 L750 360 L750 560" class="dt-flow-line" opacity="0.25" />
                    <text x="600" y="350" text-anchor="middle" font-size="14" font-weight="700" fill="{'#3f6cb4' if (region_system_exists and score_path == 'HQ_MID') else '#9aa0a8'}">50~70 → 본사 자체구축</text>

                    <!-- (b) Score branch 3: <50 → secondary gate (with longer gap) -->
                    <path d="M450 320 L450 420" class="dt-flow-line" opacity="0.25" />
                    <text x="465" y="370" text-anchor="start" font-size="14" font-weight="700" fill="{'#3f6cb4' if (region_system_exists and score_path == 'EXT_CHECK') else '#9aa0a8'}">&lt; 50</text>

                    <!-- (c) 외부솔루션 기준점 다이아몬드 -->
                    <g class="dt-diamond" style="animation-delay: 1.0s;">
                        <polygon points="450,420 520,480 450,540 380,480" fill="#f7f8fa" stroke="{'#3f6cb4' if ((not region_system_exists) or (region_system_exists and score_path == 'EXT_CHECK')) else '#9aa0a8'}" stroke-width="2"/>
                        <text x="450" y="475" text-anchor="middle" font-size="12" fill="{'#3f6cb4' if ((not region_system_exists) or (region_system_exists and score_path == 'EXT_CHECK')) else '#9aa0a8'}" font-weight="700">외부솔루션</text>
                        <text x="450" y="492" text-anchor="middle" font-size="12" fill="{'#3f6cb4' if ((not region_system_exists) or (region_system_exists and score_path == 'EXT_CHECK')) else '#9aa0a8'}" font-weight="700">기준점 통과?</text>
                    </g>

                    <!-- (c) Gate → EXT leaf -->
                    <path d="M450 540 L450 615" class="dt-flow-line" opacity="0.25" />
                    <text x="465" y="585" text-anchor="start" font-size="14" font-weight="700" fill="{'#3f6cb4' if (final_path == 'EXT') else '#9aa0a8'}">YES → 외부솔루션</text>

                    <!-- (c) Gate → HQ leaf (fallback) -->
                    <path d="M520 480 L750 480 L750 560" class="dt-flow-line" opacity="0.25" />
                    <text x="640" y="472" text-anchor="middle" font-size="14" font-weight="700" fill="{'#3f6cb4' if (final_path == 'HQ' and (not region_system_exists or score_path == 'EXT_CHECK')) else '#9aa0a8'}">NO (Fallback)</text>

                    <!-- Active path: region NOT exists → gate YES → EXT -->
                    {'<path d="M520 80 L820 80 L820 480 L520 480 M450 540 L450 615" class="dt-active-path" />' if (not region_system_exists and final_path == 'EXT') else ''}

                    <!-- Active path: region NOT exists → gate NO → HQ -->
                    {'<path d="M520 80 L820 80 L820 480 L520 480 L750 480 L750 560" class="dt-active-path" />' if (not region_system_exists and final_path == 'HQ') else ''}

                    <!-- Active path: region exists, ≥70 → B -->
                    {'<path d="M450 140 L450 200 M450 320 L450 360 L150 360 L150 560" class="dt-active-path" />' if (region_system_exists and final_path == 'B') else ''}

                    <!-- Active path: region exists, 50~70 → HQ -->
                    {'<path d="M450 140 L450 200 M450 320 L450 360 L750 360 L750 560" class="dt-active-path" />' if (region_system_exists and score_path == 'HQ_MID' and final_path == 'HQ') else ''}

                    <!-- Active path: region exists, <50, gate YES → EXT -->
                    {'<path d="M450 140 L450 200 M450 320 L450 420 M450 540 L450 615" class="dt-active-path" />' if (region_system_exists and score_path == 'EXT_CHECK' and final_path == 'EXT') else ''}

                    <!-- Active path: region exists, <50, gate NO → HQ -->
                    {'<path d="M450 140 L450 200 M450 320 L450 420 M520 480 L750 480 L750 560" class="dt-active-path" />' if (region_system_exists and score_path == 'EXT_CHECK' and final_path == 'HQ') else ''}

                    <!-- Final bullet at leaf -->
                    <circle class="dt-active-bullet" cx="{ {'B': 150, 'EXT': 450, 'HQ': 750}[final_path] }" cy="{ 615 if final_path == 'EXT' else 560 }" r="7" fill="{active_color}" />
                </svg>

                <!-- 처리 액션 (3 branches) -->
                <div class="w-full max-w-4xl">
                    <div class="grid grid-cols-3 gap-lg">
                        <div class="dt-branch-card dt-branch-b border-2 {'bg-primary/10 border-primary dt-branch-active' if path_b == 'active' else 'bg-surface-container border-outline-variant opacity-40'} rounded-xl p-md">
                            <div class="flex items-center justify-center gap-xs">
                                <span class="material-symbols-outlined {'text-primary' if path_b == 'active' else 'text-text-secondary'} text-[20px]">expand_circle_down</span>
                                <span class="font-semibold font-body-md text-body-md {'text-primary' if path_b == 'active' else 'text-text-secondary'} uppercase tracking-wider"><span data-i18n="branch_b" data-en="Regional Expansion">권역 내 확산</span></span>
                            </div>
                        </div>

                        <div class="dt-branch-card dt-branch-ext border-2 {'bg-primary/10 border-primary dt-branch-active' if path_ext == 'active' else 'bg-surface-container border-outline-variant opacity-40'} rounded-xl p-md">
                            <div class="flex items-center justify-center gap-xs">
                                <span class="material-symbols-outlined {'text-primary' if path_ext == 'active' else 'text-text-secondary'} text-[20px]">extension</span>
                                <span class="font-semibold font-body-md text-body-md {'text-primary' if path_ext == 'active' else 'text-text-secondary'} uppercase tracking-wider" data-i18n="branch_ext" data-en="External Solution">외부솔루션</span>
                            </div>
                        </div>

                        <div class="dt-branch-card dt-branch-hq border-2 {'bg-primary/10 border-primary dt-branch-active' if path_hq == 'active' else 'bg-surface-container border-outline-variant opacity-40'} rounded-xl p-md">
                            <div class="flex items-center justify-center gap-xs">
                                <span class="material-symbols-outlined {'text-primary' if path_hq == 'active' else 'text-text-secondary'} text-[20px]">domain</span>
                                <span class="font-semibold font-body-md text-body-md {'text-primary' if path_hq == 'active' else 'text-text-secondary'} uppercase tracking-wider" data-i18n="branch_hq" data-en="HQ Self-Build">본사 자체구축</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        '''

        if not include_outer:
            return inner

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">account_tree</span>
                <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_decision_tree" data-en="System Decision Tree">시스템 결정 트리</h2>
            </div>
            {inner}
        </section>
        '''

    def render_subscription_tier_table(self) -> str:
        """Render the subscription pricing tier table as a standalone panel."""
        if not self.report_data:
            return ""
        tabs = self.report_data.get("tabs", {})
        tco_tab = tabs.get("tab_1_3_tco", {})
        tiers = tco_tab.get("subscription_tiers", []) or []
        if not tiers:
            return ""

        existing_volume = tco_tab.get("existing_total_volume", 0)
        sub_details = tco_tab.get("subscription_details", {}) or {}
        # 비구독 솔루션(구독료 운영비 포함)은 구독료 구간표를 노출하지 않는다.
        if sub_details.get("applicable", True) is False or (tco_tab.get("annual_subscription", 0) or 0) <= 0:
            return ""
        active_total = sub_details.get("total_volume", 0)
        active_unit_price = sub_details.get("unit_price")

        tier_rows = ""
        for tier in tiers:
            t_min = tier.get("min_volume", 0)
            t_max = tier.get("max_volume", 0)
            t_price = tier.get("price_per_unit", 0)
            t_currency = tier.get("currency", "EUR")
            is_active = (t_min <= active_total <= t_max) if active_total else False
            range_label = f"{t_min:,} ~ {t_max:,}" if t_max < 999999 else f"{t_min:,}+"
            row_class = "bg-primary/10 text-primary font-semibold" if is_active else "text-text-primary"
            tier_rows += f'''
            <tr class="{row_class}">
                <td class="px-2 py-1.5 border-b border-surface-container-highest">{range_label}</td>
                <td class="px-2 py-1.5 border-b border-surface-container-highest text-right">{self.format_currency(t_price, t_currency)}</td>
            </tr>
            '''

        applied_row = (
            f'<div class="flex justify-between items-center mt-xs px-sm py-2 rounded-lg bg-primary/10 border-l-4 border-primary">'
            f'<span class="text-primary font-semibold uppercase tracking-wider font-label-md text-label-md" data-i18n="applied_unit_price" data-en="Applied Unit Price">적용 단가</span>'
            f'<span class="text-primary font-bold font-body-lg text-body-lg">{self.format_currency(active_unit_price, sub_details.get("currency", "EUR"))}</span></div>'
            if active_unit_price is not None else ''
        )

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">payments</span>
                <h2 class="font-headline-md text-headline-md text-primary" data-i18n="sub_tier_table" data-en="Subscription Tier Table">구독료 구간표</h2>
            </div>
            <table class="w-full font-body-md text-body-md">
                <thead>
                    <tr class="text-text-secondary">
                        <th class="px-2 py-1.5 text-left font-label-md text-label-md uppercase" data-i18n="cum_volume" data-en="Cumulative Volume">누적건수</th>
                        <th class="px-2 py-1.5 text-right font-label-md text-label-md uppercase" data-i18n="unit_price" data-en="Unit Price">단가</th>
                    </tr>
                </thead>
                <tbody>{tier_rows}</tbody>
            </table>
            <div class="flex flex-col gap-xs mt-md pt-sm border-t border-surface-container-highest font-body-md text-body-md">
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="existing_cum" data-en="Existing Cumulative">기존 누적</span><span class="text-text-primary font-semibold">{existing_volume:,}<span data-i18n="unit_contracts" data-en=""> 건</span></span></div>
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="new_added" data-en="New Added">신규 추가</span><span class="text-text-primary font-semibold">{sub_details.get("new_volume", 0):,}<span data-i18n="unit_contracts" data-en=""> 건</span></span></div>
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="new_cum" data-en="New Cumulative">신규 누적</span><span class="text-primary font-semibold">{active_total:,}<span data-i18n="unit_contracts" data-en=""> 건</span></span></div>
                {applied_row}
            </div>
        </section>
        '''

    def _baseline_notice_card(self, title, message, base_country: str = "",
                              base_system: str = "") -> str:
        """기준국(자가 분석) 안내 카드 — TCO/결정 산식 적용 불가 시 표시.
        title/message는 str 또는 {ko, en} dict 모두 허용."""
        import html as _html
        def _e(s): return _html.escape("" if s is None else str(s))
        sub = ""
        if base_country or base_system:
            chips = []
            if base_country:
                chips.append(f'<span class="px-2 py-[2px] rounded bg-[#E8F0FE] text-[#1967D2] font-label-sm text-label-sm"><span data-i18n="header_baseline" data-en="Baseline">기준국</span> {_e(base_country)}</span>')
            if base_system:
                chips.append(f'<span class="px-2 py-[2px] rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">{_e(base_system)}</span>')
            sub = '<div class="flex items-center gap-xs mt-sm">' + "".join(chips) + '</div>'
        title_html = self._loc_span(title) if isinstance(title, dict) else _e(title)
        message_html = self._loc_span(message) if isinstance(message, dict) else _e(message)
        return f'''
        <div class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-start gap-md">
                <div class="w-12 h-12 rounded-lg bg-[#E8F0FE] text-[#1967D2] flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined">verified</span>
                </div>
                <div class="flex-1">
                    <h2 class="font-headline-md text-headline-md text-primary m-0">{title_html}</h2>
                    <p class="font-body-md text-body-md text-on-surface-variant mt-xs">{message_html}</p>
                    {sub}
                </div>
            </div>
        </div>
        '''

    def render_tab_1_2_decision(self) -> str:
        """Render Tab 1-2: System Decision Tree."""
        if not self.report_data:
            return ""

        decision = self.report_data.get("tabs", {}).get("tab_1_2_decision", {}) or {}
        if decision.get("is_baseline"):
            notice = self._baseline_notice_card(
                {"ko": "기준국 — 시스템 결정 트리 적용 불가",
                 "en": "Baseline — system decision tree does not apply"},
                decision.get("recommendation") or {
                    "ko": "기준국은 이미 운영 중인 시스템이 권역 확산의 기준입니다.",
                    "en": "The baseline already operates a deployed system that serves as the reference for regional expansion.",
                },
                base_country=decision.get("base_country", ""),
                base_system=decision.get("base_system", ""),
            )
            return f'<div class="flex flex-col gap-xl">{notice}</div>'

        flowchart = self.render_decision_tree_section(include_outer=True)
        tier_panel = self.render_subscription_tier_table()

        if not tier_panel:
            return f'''
            <div class="flex flex-col gap-xl">
                {flowchart}
            </div>
            '''

        # 두 패널을 같은 높이로: flex 행(items-stretch)으로 셀을 같은 높이로 만들고,
        # 각 셀을 flex 컨테이너로 두어 자식 <section>이 셀 높이를 꽉 채우게 한다
        # (grid+h-full보다 CDN 환경에서 안정적). section에는 h-full w-full을 직접 주입.
        flowchart_h = flowchart.replace('<section class="', '<section class="h-full w-full ', 1)
        tier_panel_h = tier_panel.replace('<section class="', '<section class="h-full w-full ', 1)

        return f'''
        <div class="flex gap-gutter items-stretch">
            <div class="w-3/4 flex min-w-0">{flowchart_h}</div>
            <div class="w-1/4 flex min-w-0">{tier_panel_h}</div>
        </div>
        '''

    def render_tab_1_3_tco(self) -> str:
        """Render Tab 1-3: Contract Volume & 10Y TCO."""
        if not self.report_data:
            return ""

        tabs = self.report_data.get("tabs", {})
        tco = tabs.get("tab_1_3_tco", {})
        if tco.get("is_baseline"):
            return f'<div class="flex flex-col gap-xl">{self._baseline_notice_card({"ko":"기준국 — TCO 산정 적용 불가","en":"Baseline — TCO calculation does not apply"}, tco.get("message") or {"ko":"기준국은 신규 구축 비용 산정 대상이 아닙니다.","en":"Baseline is not a target of new-build cost calculation."})}</div>'

        build_cost = tco.get("build_cost", 0)
        annual_subscription = tco.get("annual_subscription", 0)
        annual_maintenance = tco.get("annual_maintenance", 0)
        annual_recurring = tco.get("annual_recurring", annual_subscription + annual_maintenance)
        operations_10y = tco.get("operations_10y", 0)
        total_tco = tco.get("total_tco_10y", 0)
        currency = tco.get("currency", "EUR")

        subscription_details = tco.get("subscription_details", {})

        # Custom 2-col layout for tab 1-3:
        # 좌측 셀에 "신차 판매대수" + "평균 신차가격"을 세로 스택해서
        # 우측 "금융 이용률(신차)"의 키와 시각적으로 비슷하게 만든다.
        raw_items = tco.get("items", []) or []
        items_by_name = {it.get("item"): it for it in raw_items}
        first_pair_a = items_by_name.get("신차 판매대수")
        first_pair_b = items_by_name.get("평균 신차가격")
        right_first = items_by_name.get("금융 이용률(신차)")
        consumed = {n for n in ["신차 판매대수", "평균 신차가격", "금융 이용률(신차)"] if items_by_name.get(n)}
        remaining = [it for it in raw_items if it.get("item") not in consumed]

        def _stacked(items):
            return '<div class="flex flex-col gap-md">' + ''.join(self._render_item_card(it) for it in items if it) + '</div>'

        first_row = ""
        if first_pair_a or first_pair_b or right_first:
            left_stack = _stacked([first_pair_a, first_pair_b])
            right_cell = self._render_item_card(right_first) if right_first else ''
            first_row = f'''
            <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>{left_stack}</div>
                <div>{right_cell}</div>
            </div>
            '''

        remaining_cards = ''.join(self._render_item_card(it) for it in remaining)
        remaining_grid = f'<div class="grid grid-cols-1 md:grid-cols-2 gap-md mt-md">{remaining_cards}</div>' if remaining_cards else ''

        items_section = f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">table_chart</span>
                <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_contract_basis" data-en="Contract Volume Basis Items">계약 규모 산정 근거 항목</h2>
            </div>
            {first_row}
            {remaining_grid}
        </section>
        ''' if raw_items else ""

        # Waterfall steps (명세 산식 4: 시스템 = 구축 + 유지(10Y), 운영비는 별도 통금액)
        system_subtotal = build_cost + annual_recurring * 10
        wf_steps = [
            {"label": "구축비", "value": build_cost},
            {"label": "유지비(10Y)", "value": annual_recurring * 10},
            {"label": "시스템 소계", "value": system_subtotal, "is_total": True},
            {"label": "운영비(10Y)", "value": operations_10y},
            {"label": "총 TCO", "value": total_tco, "is_total": True},
        ]
        waterfall_html = self.render_waterfall_chart(
            "10년 TCO 구성 분해 (워터폴)", "stacked_bar_chart", wf_steps, currency
        )

        # 10-year cumulative area — 일회성=구축비, 반복=구독료+유지보수
        area_html = self.render_cumulative_area_chart(
            "10년 누적 비용 추이", "trending_up",
            one_off=build_cost, annual_recurring=annual_recurring,
            operations_10y=operations_10y, years=10, currency=currency,
        )

        # Step chart for subscription tiers — 구독제 솔루션(NetSol)일 때만 노출.
        # 비구독 솔루션은 구독료가 운영비에 포함되므로 구간표 대신 안내 카드로 대체.
        is_subscription = annual_subscription > 0 or subscription_details.get("applicable", True) is not False
        if is_subscription:
            tiers = tco.get("subscription_tiers", []) or []
            active_total = subscription_details.get("total_volume", 0)
            step_html = self.render_step_chart(
                "구독료 구간 (전체 소급)", "stairs",
                tiers=tiers, current_volume=active_total, currency=currency,
            )
        else:
            base_solution_disp = (tco.get("build_breakdown", {}).get("inputs", {}) or {}).get("베이스라인 솔루션", "")
            step_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">stairs</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="sub_na_title" data-en="Subscription Fee N/A">구독료 비해당</h2>
                </div>
                <div class="bg-surface-container p-md rounded-lg border-l-4 border-primary font-body-sm text-body-sm text-on-surface-variant" data-i18n="sub_na_note" data-en="The baseline solution{0} is not subscription-based; its cost is already included in 10-year operations cost. No separate subscription fee applies.">
                    베이스라인 솔루션{1}은 구독제가 아니며, 관련 비용은 10년 운영비에 이미 포함됩니다. 별도 구독료가 부과되지 않습니다.
                </div>
            </section>
            '''.format(
                f" ({html.escape(base_solution_disp)})" if base_solution_disp else "",
                f"({html.escape(base_solution_disp)})" if base_solution_disp else "",
            )

        # Similarity multiplier reference table
        similarity_score_val = tco.get("similarity_score", 0)
        mult_active_band = tco.get("similarity_band") or "-"
        mult_table_rows = [
            ("90 ~ 100", "50%", 0.50),
            ("80 ~ 90",  "60%", 0.60),
            ("70 ~ 80",  "70%", 0.70),
            ("60 ~ 70",  "80%", 0.80),
            ("50 ~ 60",  "90%", 0.90),
            ("< 50",     "100%", 1.00),
        ]
        mult_table_html = ""
        for band, pct, _ in mult_table_rows:
            is_active = band == mult_active_band
            row_class = "bg-primary/10 text-primary font-semibold" if is_active else ""
            row_text_pct = "text-primary" if is_active else "text-text-primary"
            mult_table_html += f'''
            <tr class="{row_class}">
                <td class="px-2 py-1 border-b border-surface-container-highest font-body-sm text-body-sm">{band}</td>
                <td class="px-2 py-1 border-b border-surface-container-highest text-right font-body-sm text-body-sm {row_text_pct}">{pct}</td>
            </tr>
            '''

        multiplier_panel = f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">percent</span>
                <h2 class="font-headline-md text-headline-md text-primary" data-i18n="sim_to_mult" data-en="Similarity → TCO Multiplier">유사도 → TCO 승수</h2>
            </div>
            <p class="font-body-sm text-body-sm text-text-secondary mb-sm" data-i18n="sim_to_mult_note" data-en="Converts the overall similarity score from Tab 1-1 into a multiplier applied to baseline cost/duration.">탭1-1 종합 유사도 점수를 베이스라인 비용·기간에 적용할 승수로 환산합니다.</p>
            <table class="w-full">
                <thead>
                    <tr class="text-text-secondary">
                        <th class="px-2 py-1 text-left font-label-sm text-label-sm uppercase" data-i18n="overall_similarity" data-en="Overall Similarity">종합 유사도</th>
                        <th class="px-2 py-1 text-right font-label-sm text-label-sm uppercase" data-i18n="multiplier" data-en="Multiplier">승수</th>
                    </tr>
                </thead>
                <tbody>{mult_table_html}</tbody>
            </table>
            <div class="flex flex-col gap-xs mt-md pt-sm border-t border-surface-container-highest font-body-sm text-body-sm">
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="current_similarity" data-en="Current Similarity">현재 유사도</span><span class="text-text-primary font-semibold">{similarity_score_val:.1f}</span></div>
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="applied_band" data-en="Applied Band">적용 구간</span><span class="text-primary font-semibold">{mult_active_band}</span></div>
                <div class="flex justify-between"><span class="text-text-secondary" data-i18n="bf_applied_mult" data-en="Applied Multiplier">적용 승수</span><span class="text-primary font-semibold">{(tco.get("similarity_multiplier") or 0)*100:.0f}%</span></div>
            </div>
        </section>
        '''

        # KPI cards (총 TCO / 구축기간 / 예상 계약건수 / 유사도 승수)
        mult_val = tco.get("similarity_multiplier") or 0
        mult_band = tco.get("similarity_band") or "-"
        sub_band = f'<span data-i18n="kpi_band" data-en="Band">구간</span> {mult_band}'
        kpi_html = ""
        for label_ko, label_en, value, icon, sub in [
            ("총 10년 TCO",   "Total 10-Year TCO",    self.format_currency(total_tco, currency),    "payments",   ""),
            ("예상 구축 기간", "Est. Build Duration", f"{tco.get('build_months', 0):.1f}M",          "schedule",   ""),
            ("예상 계약건수", "Est. Contracts",      f"{tco.get('expected_contracts', 0):,}<span data-i18n=\"unit_count_kpi\" data-en=\"\"> 건</span>", "fact_check", ""),
            ("유사도 승수",   "Similarity Multiplier", f"{mult_val * 100:.0f}%",                    "percent",    sub_band),
        ]:
            sub_html = f'<span class="font-label-sm text-label-sm text-text-secondary mt-xs">{sub}</span>' if sub else ''
            kpi_html += f'''
            <div class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow flex flex-col">
                <div class="flex items-center justify-between mb-sm">
                    <span class="font-label-md text-label-md text-primary uppercase tracking-wider" data-i18n="kpi_label" data-en="{html.escape(label_en)}">{html.escape(label_ko)}</span>
                    <span class="material-symbols-outlined text-primary text-[24px]">{icon}</span>
                </div>
                <span class="font-display-lg text-display-lg text-primary leading-none">{value}</span>
                {sub_html}
            </div>
            '''

        # HQ self-build reference (명세 ※ 어느 분기든 참고용 병기)
        decision_tab = tabs.get("tab_1_2_decision", {})
        hq_cost = decision_tab.get("hq_baseline_cost", 0)
        hq_months = decision_tab.get("hq_baseline_months", 0)
        hq_currency = decision_tab.get("hq_baseline_currency", currency)
        hq_reference_card = ""

        # Build cost/duration breakdown card (산식 4 — 신규국 구축비/기간)
        build_brk = tco.get("build_breakdown") or {}
        build_formula_card = ""
        if build_brk:
            bi = build_brk.get("inputs", {})
            bo = build_brk.get("outputs", {})
            base_country_disp = bi.get("베이스라인 국가", "-")
            base_solution = bi.get("베이스라인 솔루션", "-")
            base_cost_v = bi.get("B 구축비용", 0)
            base_months_v = bi.get("B 구축기간(개월)", 0)
            sim_score = bi.get("종합 유사도", 0)
            mult_band = bi.get("승수 구간", "-")
            mult_val = bi.get("적용 승수", 0)
            out_cost = bo.get("신규국 구축비용", 0)
            out_months = bo.get("신규국 구축기간(개월)", 0)
            build_formula_card = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">build</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="bf_title" data-en="Build Cost·Duration Formula">구축비용·기간 산식</h2>
                </div>
                <div class="bg-surface-container p-md rounded-lg border-l-4 border-primary mb-md font-body-sm text-body-sm text-on-surface-variant" data-i18n="bf_formula" data-en="Build cost / duration = Baseline (B) value × Similarity multiplier">
                    {build_brk.get("formula", "")}
                </div>
                <div class="grid grid-cols-2 md:grid-cols-6 gap-sm">
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="bf_baseline" data-en="Baseline">베이스라인</div>
                        <div class="font-headline-md text-headline-md text-primary">{self.country_name_span(base_country_disp)}</div>
                        <div class="font-label-sm text-label-sm text-text-secondary">{base_solution}</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="bf_b_cost" data-en="B Build Cost">B 구축비용</div>
                        <div class="font-headline-md text-headline-md text-primary">{self.format_currency(base_cost_v, currency)}</div>
                        <div class="font-label-sm text-label-sm text-text-secondary">internal.json</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="bf_b_months" data-en="B Build Duration">B 구축기간</div>
                        <div class="font-headline-md text-headline-md text-primary">{base_months_v}M</div>
                        <div class="font-label-sm text-label-sm text-text-secondary">internal.json</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="bf_overall_sim" data-en="Overall Similarity">종합 유사도</div>
                        <div class="font-headline-md text-headline-md text-primary">{sim_score}</div>
                        <div class="font-label-sm text-label-sm text-text-secondary" data-i18n="bf_sim_result" data-en="Similarity score result">유사도 점수 결과</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="bf_applied_mult" data-en="Applied Multiplier">적용 승수</div>
                        <div class="font-headline-md text-headline-md text-primary">{mult_val*100:.0f}%</div>
                        <div class="font-label-sm text-label-sm text-text-secondary"><span data-i18n="bf_band" data-en="Band">구간</span> {mult_band}</div>
                    </div>
                    <div class="p-sm bg-primary-container/10 rounded-lg border-2 border-primary">
                        <div class="font-label-sm text-label-sm text-primary uppercase tracking-wider" data-i18n="bf_new_output" data-en="New Country Output">신규국 산출</div>
                        <div class="font-headline-md text-headline-md text-primary">{self.format_currency(out_cost, currency)}</div>
                        <div class="font-label-sm text-label-sm text-text-secondary">{out_months:.1f}M</div>
                    </div>
                </div>
            </section>
            '''

        # Expected contracts breakdown card (formula + inputs)
        breakdown = tco.get("expected_contracts_breakdown") or {}
        formula_card = ""
        if breakdown:
            inputs = breakdown.get("inputs", {})
            sales = inputs.get("신차 판매대수", 0)
            pen = inputs.get("금융 이용률(신차)_%", 0)
            inst = inputs.get("구매 패턴(할부·리스 비중)_%", 0)
            share = inputs.get("우리사 예상 점유율", 0)
            result = breakdown.get("value", 0)
            formula_card = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">function</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="ec_formula_title" data-en="Est. Contracts Formula">예상 계약건수 산식</h2>
                </div>
                <div class="bg-surface-container p-md rounded-lg border-l-4 border-primary mb-md font-body-sm text-body-sm text-on-surface-variant" data-i18n="ec_formula_body" data-en="New car sales × Finance usage (new) × (Installment + Lease share) × Our expected share">
                    {breakdown.get("formula", "")}
                </div>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-sm">
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="ec_new_car_sales" data-en="New Car Sales">신차 판매대수</div>
                        <div class="font-headline-md text-headline-md text-primary">{sales:,.0f}</div>
                        <div class="font-label-sm text-label-sm text-text-secondary" data-i18n="ec_per_year_units" data-en="units / yr">대 / 년</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="ec_finance_usage" data-en="Finance Usage">금융 이용률</div>
                        <div class="font-headline-md text-headline-md text-primary">{pen:.0f}%</div>
                        <div class="font-label-sm text-label-sm text-text-secondary" data-i18n="ec_new_basis" data-en="(new car basis)">신차 기준</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="ec_install_lease_share" data-en="Installment / Lease Share">할부·리스 비중</div>
                        <div class="font-headline-md text-headline-md text-primary">{inst:.0f}%</div>
                        <div class="font-label-sm text-label-sm text-text-secondary" data-i18n="ec_purchase_pattern" data-en="Purchase Pattern">구매 패턴</div>
                    </div>
                    <div class="p-sm bg-surface rounded-lg border border-surface-container-highest">
                        <div class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="ec_our_share" data-en="Our Share">우리사 점유율</div>
                        <div class="font-headline-md text-headline-md text-primary">{share*100:.1f}%</div>
                        <div class="font-label-sm text-label-sm text-text-secondary">internal.json</div>
                    </div>
                    <div class="p-sm bg-primary-container/10 rounded-lg border-2 border-primary">
                        <div class="font-label-sm text-label-sm text-primary uppercase tracking-wider" data-i18n="ec_est_contracts" data-en="Est. Contracts">예상 계약건수</div>
                        <div class="font-headline-md text-headline-md text-primary">{result:,}<span data-i18n="unit_contracts2" data-en=""> 건</span></div>
                        <div class="font-label-sm text-label-sm text-text-secondary" data-i18n="ec_formula_result" data-en="= formula result">= 산식 결과</div>
                    </div>
                </div>
            </section>
            '''

        return f'''
        <div class="flex flex-col gap-xl">
            <div class="grid grid-cols-4 gap-gutter">
                {kpi_html}
            </div>
            {build_formula_card}
            {hq_reference_card}
            {formula_card}
            <div class="grid grid-cols-12 gap-gutter">
                <div class="col-span-6">{waterfall_html}</div>
                <div class="col-span-6">{area_html}</div>
            </div>
            <div class="grid grid-cols-12 gap-gutter">
                <div class="col-span-7">{step_html}</div>
                <div class="col-span-5">{multiplier_panel}</div>
            </div>
            {items_section}
        </div>
        '''

    def render_data_quality_section(self) -> str:
        """Render data quality indicator section."""
        if not self.report_data:
            return ""

        quality = self.report_data.get("data_quality", {})
        completeness = quality.get("completeness_pct", 0)
        total_items = quality.get("total_items", 0)
        target_items = quality.get("target_items", 0)
        timeseries_coverage = quality.get("timeseries_coverage", 0)

        status_color = "emerald" if completeness >= 95 else "yellow" if completeness >= 80 else "red"

        return f'''
        <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">fact_check</span>
                <h2 class="font-headline-md text-headline-md text-primary">Data Quality</h2>
            </div>
            <div class="flex flex-col gap-md">
                <div class="flex justify-between items-center p-sm bg-surface rounded-lg border border-surface-container-highest">
                    <div class="flex items-center gap-sm">
                        <div class="w-8 h-8 rounded-full bg-secondary-container/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-secondary text-[18px]">database</span>
                        </div>
                        <span class="font-label-md text-label-md text-text-primary">Data Completeness</span>
                    </div>
                    <div class="flex items-center gap-xs bg-{status_color}-100/50 text-{status_color}-800 px-2 py-1 rounded-full border border-{status_color}-200">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        <span class="font-label-sm text-label-sm uppercase tracking-wide">{completeness:.1f}%</span>
                    </div>
                </div>
                <div class="flex justify-between items-center p-sm bg-surface rounded-lg border border-surface-container-highest">
                    <span class="text-body-sm text-text-secondary">Items Present</span>
                    <span class="font-semibold text-body-sm text-text-primary">{total_items} / {target_items}</span>
                </div>
                <div class="flex justify-between items-center p-sm bg-surface rounded-lg border border-surface-container-highest">
                    <span class="text-body-sm text-text-secondary">Timeseries Coverage</span>
                    <span class="font-semibold text-body-sm text-text-primary">{timeseries_coverage:.1f}%</span>
                </div>
            </div>
        </section>
        '''

    def _render_news_card(self, news_item: Dict[str, Any]) -> str:
        """Render a single news entry from the 외부 이슈 스캔 list."""
        category = news_item.get("news_category", "")
        headline = news_item.get("headline", "")
        headline_en = news_item.get("headline_en", "")
        so_what = news_item.get("so_what", "")
        so_what_en = news_item.get("so_what_en", "")
        publisher = news_item.get("publisher", "")
        pub_date = news_item.get("pub_date", "")
        url = news_item.get("url", "")

        is_stub = headline == "조사 필요"
        if is_stub:
            return f'''
            <div class="p-md bg-yellow-50 border border-yellow-200 rounded-lg">
                <div class="flex items-center gap-xs mb-xs">
                    <span class="material-symbols-outlined text-yellow-700 text-[18px]">warning</span>
                    <span class="font-label-md text-label-md text-yellow-800 uppercase">{category}</span>
                </div>
                <p class="font-body-sm text-body-sm text-yellow-700" data-i18n="news_missing" data-en="No related whitelist issue found — needs reinforcement during due diligence">관련 화이트리스트 이슈 미확보 — 실사 단계 보강 필요</p>
            </div>
            '''

        link = f'<a class="text-primary underline" href="{url}" target="_blank" rel="noopener" data-i18n="source_link" data-en="Source">원문</a>' if url else ''
        return f'''
        <div class="p-md bg-surface rounded-lg border border-surface-container-highest flex flex-col gap-xs">
            <div class="flex items-center gap-xs flex-wrap">
                <span class="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-label-sm text-label-sm uppercase">{category}</span>
                <span class="font-label-sm text-label-sm text-text-secondary">{publisher} · {pub_date}</span>
            </div>
            <h4 class="font-label-md text-label-md text-text-primary leading-relaxed">{self._bi_span(headline, headline_en)}</h4>
            <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
                <div class="flex items-center gap-xs mb-xs">
                    <span class="material-symbols-outlined text-primary text-[14px]">psychology</span>
                    <span class="font-label-sm text-label-sm text-primary uppercase">So What</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(so_what, so_what_en)}</p>
            </div>
            {link}
        </div>
        '''

    def render_tab_1_4_market(self) -> str:
        """Render Tab 1-4: Market & Competition Background."""
        if not self.report_data:
            return ""

        market = self.report_data.get("tabs", {}).get("tab_1_4_market", {})
        items = market.get("items", [])
        competitors = market.get("competitors")
        entry_form = market.get("competitor_entry_form")
        brand_top10 = market.get("brand_top10")
        news = market.get("news")
        regulators = market.get("regulators")
        country_summary = market.get("country_summary")

        items_section = self.render_items_section(
            items,
            title="시장·경쟁 핵심 지표 (원천 데이터)",
            icon="leaderboard",
        )

        # ---------- Charts ----------
        import re as _re
        def _parse_share(raw):
            if raw is None:
                return 0
            m = _re.search(r"(\d+(?:\.\d+)?)", str(raw))
            return float(m.group(1)) if m else 0

        # 1) 금융사 Top5 + 캡티브 강도
        fin_item = self._find_tab14_item("금융사 순위(Top 5)")
        fin_rows = []
        if fin_item and isinstance(fin_item.get("value"), list):
            for r in fin_item["value"][:5]:
                fin_rows.append({
                    "label": r.get("name", ""),
                    "value": round(_parse_share(r.get("market_share")), 1),
                })
        finance_chart = self.render_top5_ranking_panel(
            "금융사 Top 5 (점유율 · 캡티브 강도)", "account_balance",
            fin_rows, metric_label="점유율",
            insight=self._bi_span((fin_item or {}).get("insight") or "",
                                  (fin_item or {}).get("insight_en") or "")
                    if (fin_item or {}).get("insight") else None,
        )

        # 2) OEM Top5
        oem_item = self._find_tab14_item("OEM 순위(Top 5)")
        oem_rows = []
        if oem_item and isinstance(oem_item.get("value"), list):
            for r in oem_item["value"][:5]:
                oem_rows.append({
                    "label": r.get("name", ""),
                    "value": round(_parse_share(r.get("market_share")), 1),
                })
        oem_chart = self.render_top5_ranking_panel(
            "OEM Top 5 (점유율 · 캡티브 보유)", "directions_car",
            oem_rows, metric_label="점유율",
            insight=self._bi_span((oem_item or {}).get("insight") or "",
                                  (oem_item or {}).get("insight_en") or "")
                    if (oem_item or {}).get("insight") else None,
        )

        # 3) 경쟁사 금리 범위 — best effort: extract numbers
        rate_item = self._find_tab14_item("경쟁사 금리 범위")
        rate_chart = ""
        if rate_item:
            import re
            text = str(rate_item.get("value", ""))
            ranges = []
            # Patterns like "6~10%" / "0~3%"
            for m in re.finditer(r"(\d+(?:\.\d+)?)\s*[~\-–]\s*(\d+(?:\.\d+)?)\s*%", text):
                ranges.append({"lo": float(m.group(1)), "hi": float(m.group(2))})
            rb_rows = []
            if len(ranges) >= 1:
                rb_rows.append({"label": "신차 자동차대출", "lo": ranges[0]["lo"], "hi": ranges[0]["hi"], "accent": "#3f6cb4"})
            if len(ranges) >= 2:
                rb_rows.append({"label": "캡티브 프로모", "lo": ranges[1]["lo"], "hi": ranges[1]["hi"], "accent": "#4f8a6d"})
            single = re.search(r"평균.*?(\d+(?:\.\d+)?)\s*%", text)
            if single:
                v = float(single.group(1))
                rb_rows.append({"label": "소비자신용 평균", "lo": v, "hi": v, "accent": "#c0533f"})
            if rb_rows:
                rate_chart = self.render_range_bar_chart("경쟁사 금리 범위", "percent", rb_rows)

        # 4) EV 보급률 + EV·ICE 잔존가치 라인차트
        ev_item = self._find_tab14_item("EV 보급률")
        rv_item = self._find_tab14_item("EV·ICE 잔존가치 리스크")
        line_series = []
        if ev_item and isinstance(ev_item.get("timeseries"), dict):
            ts = ev_item["timeseries"]
            line_series.append({
                "name": "EV 보급률",
                "color": "#3f6cb4",
                "history": ts.get("history", []),
                "forecast": ts.get("forecast", []),
            })
        if rv_item and isinstance(rv_item.get("timeseries"), dict):
            ts = rv_item["timeseries"]
            line_series.append({
                "name": "EV/ICE 잔존가치(3년)",
                "color": "#c0533f",
                "history": ts.get("history", []),
                "forecast": ts.get("forecast", []),
            })
        ev_chart = self.render_line_chart(
            "EV 보급률 · EV/ICE 잔존가치 추이", "battery_charging_full",
            line_series, y_label="%"
        )

        # 5) 평균 신차가격 KPI
        price_item = self._find_tab14_item("평균 신차가격")
        price_kpi_html = ""
        if price_item:
            val = price_item.get("value")
            unit = price_item.get("unit") or ""
            price_kpi_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow flex flex-col">
                <div class="flex items-center justify-between mb-sm">
                    <span class="font-label-md text-label-md text-primary uppercase tracking-wider" data-i18n="avg_new_car_price" data-en="Avg. New-Car Price">평균 신차가격</span>
                    <span class="material-symbols-outlined text-primary text-[24px]">sell</span>
                </div>
                <div class="flex items-baseline gap-xs">
                    <span class="font-display-lg text-display-lg text-primary leading-none">{val:,}</span>
                    <span class="font-body-md text-body-md text-text-secondary">{unit}</span>
                </div>
                <p class="font-body-sm text-body-sm text-text-secondary mt-sm leading-relaxed">{self._bi_span(price_item.get('insight', ''), price_item.get('insight_en', ''))}</p>
            </section>
            '''

        # Country summary block
        summary_html = ""
        if country_summary:
            summary_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">summarize</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_country_summary" data-en="Country Qualitative Summary">국가 정성 요약</h2>
                </div>
                <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-md">{self._bi_span(country_summary.get("value", ""), country_summary.get("value_en", ""))}</p>
                <div class="bg-surface-container/60 p-md rounded-lg border-l-4 border-primary">
                    <div class="flex items-center gap-xs mb-xs">
                        <span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>
                        <span class="font-label-sm text-label-sm text-primary uppercase" data-i18n="insight_label" data-en="Insight">인사이트</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(country_summary.get("insight", ""), country_summary.get("insight_en", ""))}</p>
                </div>
            </section>
            '''

        # Competitor categorization (자동 그룹핑 — 회사명·진출형태 텍스트 기반)
        competitor_cards = ""
        if competitors:
            comp_list = competitors.get("value") or []

            def _comp_name(c) -> str:
                """경쟁사 항목 → 표시 이름. 문자열 또는 {name,rank,...} dict 모두 허용."""
                if isinstance(c, dict):
                    return str(c.get("name") or c.get("company") or c.get("label") or "")
                return str(c)

            def _classify_competitor(c) -> str:
                n = _comp_name(c).lower()
                # OEM 캡티브 (브랜드명 + Financial/Bank/Kredit/Credit/Capital)
                oem_brands = ["volkswagen", "vw", "toyota", "bmw", "mercedes", "audi",
                              "ford", "renault", "hyundai", "kia", "nissan", "honda",
                              "peugeot", "stellantis", "fiat"]
                if any(b in n for b in oem_brands):
                    return "oem_captive"
                # 플릿 리스 (ALD/Arval/Alphabet/Ayvens/LeasePlan)
                if any(k in n for k in ["ald", "arval", "alphabet", "ayvens", "leaseplan"]):
                    return "fleet_lease"
                # 은행계 (Santander, Cetelem(BNP), CaixaBank, Sabadell, CA Auto Bank, BNP)
                if any(k in n for k in ["santander", "cetelem", "bnp", "caixa", "sabadell",
                                          "ca auto", "credit agricole", "barclays", "hsbc"]):
                    return "bank"
                return "specialty"

            groups = {
                "bank": {"label": "은행계 자회사", "label_en": "Bank Subsidiaries",
                          "icon": "account_balance", "color": "primary", "members": []},
                "oem_captive": {"label": "OEM 캡티브", "label_en": "OEM Captives",
                                "icon": "directions_car", "color": "secondary", "members": []},
                "fleet_lease": {"label": "플릿/렌팅 리스사", "label_en": "Fleet / Rental Lessors",
                                 "icon": "garage", "color": "secondary", "members": []},
                "specialty": {"label": "전문 여신사·기타", "label_en": "Specialty Lenders & Other",
                               "icon": "store", "color": "outline", "members": []},
            }
            for c in comp_list:
                groups[_classify_competitor(c)]["members"].append(c)

            cards_html = ""
            for key, g in groups.items():
                if not g["members"]:
                    continue
                chips = "".join(
                    f'<span class="inline-flex items-center gap-xs bg-surface rounded-full border border-surface-container-highest px-sm py-[2px] font-label-sm text-label-sm text-text-primary">{html.escape(_comp_name(m))}</span>'
                    for m in g["members"]
                )
                cards_html += f'''
                <div class="p-sm bg-surface-container-low rounded-lg border border-surface-container-highest">
                    <div class="flex items-center justify-between mb-xs">
                        <div class="flex items-center gap-xs">
                            <span class="material-symbols-outlined text-primary text-[18px]">{g["icon"]}</span>
                            <span class="font-label-md text-label-md text-primary uppercase tracking-wider">{self._bi_span(g["label"], g["label_en"])}</span>
                        </div>
                        <span class="font-label-sm text-label-sm text-text-secondary">{self._bi_span(f'{len(g["members"])}개', f'{len(g["members"])}')}</span>
                    </div>
                    <div class="flex flex-wrap gap-xs">{chips}</div>
                </div>
                '''

            entry_text = (entry_form or {}).get("value", "")
            entry_text_en = (entry_form or {}).get("value_en", "")
            entry_html = (
                f'<div class="bg-surface p-sm rounded-md border border-surface-container-highest mb-md">'
                f'<div class="flex items-center gap-xs mb-xs"><span class="material-symbols-outlined text-text-secondary text-[14px]">flag</span>'
                f'<span class="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider" data-i18n="entry_form_label" data-en="Entry Mode">진출 형태</span></div>'
                f'<p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(entry_text, entry_text_en)}</p></div>'
                if entry_text else ''
            )

            competitor_cards = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
                    <div class="flex items-center gap-sm">
                        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">groups</span>
                        <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_competitors_by_type" data-en="Competitor Landscape (by Type)">경쟁사 현황 (유형별)</h2>
                    </div>
                    <span class="font-label-sm text-label-sm text-text-secondary">{self._bi_span(f'총 {len(comp_list)}개사', f'{len(comp_list)} firms')}</span>
                </div>
                {entry_html}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md">{cards_html}</div>
                <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary mt-md">
                    <div class="flex items-center gap-xs mb-xs">
                        <span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>
                        <span class="font-label-sm text-label-sm text-primary uppercase" data-i18n="insight_label" data-en="Insight">인사이트</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(competitors.get("insight", ""), competitors.get("insight_en", ""))}</p>
                </div>
            </section>
            '''

        # Brand Top 10 — 컴팩트 2열 카드 (rank pill + brand name + captive chip)
        brand_html = ""
        if brand_top10:
            brands = brand_top10.get("value") or []

            def _brand_row(rank, name):
                # 브랜드 항목이 문자열 또는 {name,rank,...} dict 모두 올 수 있음 → 이름 정규화.
                if isinstance(name, dict):
                    name = str(name.get("name") or name.get("brand") or name.get("label") or "")
                else:
                    name = str(name)
                captive = self._has_captive_hint(name)
                cap_chip = (
                    '<span class="inline-flex items-center gap-xs bg-secondary-container/30 text-secondary border border-secondary/40 px-2 py-[1px] rounded-full font-label-sm text-label-sm">'
                    '<span class="material-symbols-outlined text-[12px]">verified</span><span data-i18n="captive_chip" data-en="Captive">캡티브</span></span>'
                    if captive else ''
                )
                # 1~3위는 강조 배경
                pill_bg = "bg-primary text-on-primary" if rank <= 3 else "bg-surface-container text-text-secondary"
                row_bg = "bg-surface-container-low" if rank <= 3 else "bg-surface"
                return f'''
                <div class="flex items-center gap-sm p-sm {row_bg} rounded-md border border-surface-container-highest">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full {pill_bg} font-label-md text-label-md flex-shrink-0">{rank}</span>
                    <span class="font-body-md text-body-md text-text-primary flex-1 truncate">{html.escape(name)}</span>
                    {cap_chip}
                </div>
                '''

            grid_html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-sm">' + \
                "".join(_brand_row(i + 1, n) for i, n in enumerate(brands[:10])) + "</div>"

            brand_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center justify-between gap-sm mb-md pb-sm border-b border-surface-border">
                    <div class="flex items-center gap-sm">
                        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">directions_car</span>
                        <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_brand_top10" data-en="Brand Top 10">브랜드 Top 10</h2>
                    </div>
                    <span class="font-label-sm text-label-sm text-text-secondary" data-i18n="new_car_reg_rank" data-en="New-car registration ranking">신차 등록 순위</span>
                </div>
                {grid_html}
                <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary mt-md">
                    <div class="flex items-center gap-xs mb-xs">
                        <span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>
                        <span class="font-label-sm text-label-sm text-primary uppercase" data-i18n="insight_label" data-en="Insight">인사이트</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(brand_top10.get("insight", ""), brand_top10.get("insight_en", ""))}</p>
                </div>
            </section>
            '''

        regulators_html = ""
        if regulators:
            regulators_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">policy</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_regulators" data-en="Regulators">규제기관</h2>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-sm">{self._bi_span(regulators.get("value", ""), regulators.get("value_en", ""))}</p>
                <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary">
                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(regulators.get("insight", ""), regulators.get("insight_en", ""))}</p>
                </div>
            </section>
            '''

        news_html = ""
        if news:
            news_list = news.get("value") or []
            news_cards = "".join(self._render_news_card(n) for n in news_list)
            news_html = f'''
            <section class="bg-surface-container-lowest border border-surface-border rounded-xl p-lg card-shadow">
                <div class="flex items-center gap-sm mb-md pb-sm border-b border-surface-border">
                    <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">newspaper</span>
                    <h2 class="font-headline-md text-headline-md text-primary" data-i18n="panel_news_scan" data-en="External News Scan">외부 이슈 스캔</h2>
                </div>
                <div class="flex flex-col gap-md">
                    {news_cards}
                </div>
                <div class="bg-surface-container/60 p-sm rounded-md border-l-4 border-primary mt-md">
                    <div class="flex items-center gap-xs mb-xs">
                        <span class="material-symbols-outlined text-primary text-[14px]">lightbulb</span>
                        <span class="font-label-sm text-label-sm text-primary uppercase" data-i18n="overall_insight_label" data-en="Overall Insight">종합 인사이트</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{self._bi_span(news.get("insight", ""), news.get("insight_en", ""))}</p>
                </div>
            </section>
            '''

        return f'''
        <div class="flex flex-col gap-xl">
            {summary_html}
            <div class="grid grid-cols-12 gap-gutter">
                <div class="col-span-6">{finance_chart}</div>
                <div class="col-span-6">{oem_chart}</div>
            </div>
            {ev_chart}
            <div class="grid grid-cols-12 gap-gutter">
                <div class="col-span-8">{rate_chart}</div>
                <div class="col-span-4">{price_kpi_html}</div>
            </div>
            <div class="grid grid-cols-12 gap-gutter">
                <div class="col-span-6">{competitor_cards}</div>
                <div class="col-span-6">{brand_html}</div>
            </div>
            {regulators_html}
            {news_html}
            {items_section}
        </div>
        '''

    def render_tabs_navigation(self) -> str:
        """Render tab navigation bar (mockup: 이모지 + 단일 라벨, 활성=#101622).

        EN 라벨은 i18n 토글로 본문 라벨만 교체(별도 부제 span 제거 — mockup 정합).
        """
        tabs = [
            {"id": "tab-0", "label": "요약",            "en": "Summary"},
            {"id": "tab-1", "label": "유사도 점수",      "en": "Similarity"},
            {"id": "tab-2", "label": "시스템 결정 트리", "en": "Decision Tree"},
            {"id": "tab-3", "label": "TCO · 구독료",     "en": "TCO"},
            {"id": "tab-4", "label": "시장·경쟁 배경",   "en": "Market"},
        ]

        tabs_html = ""
        for tab in tabs:
            tabs_html += f'''
            <button class="tab-button flex items-center gap-xs px-[14px] py-sm rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-surface-container text-text-secondary"
                    data-tab="{tab['id']}">
                <span data-i18n="tab" data-en="{tab['en']}">{tab['label']}</span>
            </button>
            '''

        return f'''
        <div class="bg-surface-container-lowest border border-surface-border rounded-xl px-sm py-[6px] mb-xl sticky top-0 z-10 card-shadow">
            <div class="flex gap-xs overflow-x-auto">
                {tabs_html}
            </div>
        </div>
        '''

    def generate_html(self) -> str:
        """Generate complete HTML report.

        Returns:
            HTML string
        """
        if not self.report_data:
            self.load_report()

        target = self.report_data.get("target", {})
        country_code = target.get("country", "XX")
        country_name = self.get_country_name(country_code)
        report_id = self.report_data.get("report_id", "RPT_XXX")
        generated_at = self.report_data.get("generated_at", "")

        # Format date
        try:
            dt = datetime.fromisoformat(generated_at)
            formatted_date = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            formatted_date = generated_at

        flag_url = self.get_country_flag_url(country_code)
        country_meta = self.report_data.get("country_meta", {}) or {}
        country_en = country_meta.get("country") or self.get_country_name_en(country_code)
        # 보고서 제목 — KO/EN 양 언어
        report_title_ko = self.report_data.get("title") or f"{country_name} 진출 진단 보고서"
        report_title_en = f"{country_en} Market Entry Diagnostic Report"
        report_title = f'<span data-i18n="report_title" data-en="{html.escape(report_title_en)}">{html.escape(report_title_ko)}</span>'
        base_country_code = target.get("base_country", "GB")
        base_country_name = self.get_country_name(base_country_code)
        currency_code = country_meta.get("currency", "")
        data_year = country_meta.get("data_year", "")
        region_code = country_meta.get("region") or self.report_data.get("target", {}).get("region") or ""
        region_pairs = {
            "EU":   ("EU · 유럽",  "EU · Europe"),
            "NA":   ("NA · 북미",  "NA · North America"),
            "APAC": ("APAC · 아·태", "APAC · Asia-Pacific"),
            "SA":   ("SA · 남미",  "SA · South America"),
        }
        if region_code in region_pairs:
            r_ko, r_en = region_pairs[region_code]
            region_label = f'<span data-i18n="region_label" data-en="{html.escape(r_en)}">{html.escape(r_ko)}</span>'
        elif region_code:
            region_label = html.escape(region_code)
        else:
            region_label = '<span data-i18n="region_unset" data-en="Region unset">권역 미지정</span>'
        entry_status = country_meta.get("entry_status") or "미진출"
        status_style = {
            "운영중": "bg-emerald-100 text-emerald-800 border-emerald-200",
            "준비중": "bg-yellow-100 text-yellow-800 border-yellow-200",
            "미진출": "bg-surface-container text-text-secondary border-surface-border",
        }.get(entry_status, "bg-surface-container text-text-secondary border-surface-border")
        status_icon = {
            "운영중": "check_circle",
            "준비중": "schedule",
            "미진출": "explore",
        }.get(entry_status, "explore")
        # 진출 상태 양 언어 라벨
        entry_status_en_map = {"운영중": "Operating", "준비중": "Preparing", "미진출": "Not entered"}
        entry_status_en = entry_status_en_map.get(entry_status, entry_status)
        entry_status_label = f'<span data-i18n="entry_status" data-en="{html.escape(entry_status_en)}">{html.escape(entry_status)}</span>'

        # Render tab navigation
        tabs_nav = self.render_tabs_navigation()

        # Render all tabs
        tab_0 = self.render_tab_0_summary()
        tab_1 = self.render_tab_1_1_similarity()
        tab_2 = self.render_tab_1_2_decision()
        tab_3 = self.render_tab_1_3_tco()
        tab_4 = self.render_tab_1_4_market()

        return f'''<!DOCTYPE html>
<html class="light" lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>{html.escape(report_title_ko)}</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"/>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <script id="tailwind-config">
        tailwind.config = {{
            darkMode: "class",
            theme: {{
                extend: {{
                    "colors": {{
                        "accent-red": "#C0533F",
                        "surface-bright": "#F7F8FA",
                        "on-primary-fixed-variant": "#2C4C86",
                        "tertiary-fixed": "#F6E7E3",
                        "primary-fixed-dim": "#6E97D6",
                        "inverse-surface": "#1F2D45",
                        "surface-container-lowest": "#ffffff",
                        "secondary": "#3F6CB4",
                        "on-tertiary": "#ffffff",
                        "on-primary": "#ffffff",
                        "error": "#C0533F",
                        "on-tertiary-fixed-variant": "#C0533F",
                        "secondary-fixed": "#EAF0F8",
                        "tertiary": "#C0533F",
                        "inverse-primary": "#6E97D6",
                        "primary-container": "#2C4C86",
                        "on-primary-container": "#8FA0BD",
                        "primary-fixed": "#EAF0F8",
                        "on-secondary-container": "#2C4C86",
                        "surface-dim": "#dbdad9",
                        "surface-container-low": "#F7F8FA",
                        "surface-border": "#E6E9EC",
                        "on-error": "#ffffff",
                        "surface-container-highest": "#EEF0F2",
                        "surface-container": "#EEF0F2",
                        "secondary-fixed-dim": "#6E97D6",
                        "on-tertiary-fixed": "#C0533F",
                        "surface-variant": "#EEF0F2",
                        "on-tertiary-container": "#E89380",
                        "inverse-on-surface": "#F7F8FA",
                        "outline": "#9AA0A8",
                        "surface-light": "#F7F8FA",
                        "text-secondary": "#3B3F46",
                        "on-primary-fixed": "#101622",
                        "surface-tint": "#3F6CB4",
                        "on-secondary-fixed": "#101622",
                        "on-surface-variant": "#3B3F46",
                        "on-secondary-fixed-variant": "#2C4C86",
                        "on-error-container": "#C0533F",
                        "outline-variant": "#E6E9EC",
                        "text-disabled": "#9AA0A8",
                        "secondary-container": "#6E97D6",
                        "tertiary-fixed-dim": "#E89380",
                        "on-secondary": "#ffffff",
                        "background": "#F7F8FA",
                        "error-container": "#F6E7E3",
                        "surface": "#F7F8FA",
                        "on-background": "#14171C",
                        "text-primary": "#14171C",
                        "surface-container-high": "#EEF0F2",
                        "primary": "#101622",
                        "tertiary-container": "#F6E7E3",
                        "on-surface": "#14171C"
                    }},
                    "borderRadius": {{
                        "DEFAULT": "0.25rem",
                        "lg": "0.5rem",
                        "xl": "0.75rem",
                        "full": "9999px"
                    }},
                    "spacing": {{
                        "sm": "8px",
                        "margin-desktop": "48px",
                        "gutter": "24px",
                        "base": "4px",
                        "margin-mobile": "16px",
                        "xl": "32px",
                        "lg": "24px",
                        "xs": "4px",
                        "md": "16px"
                    }},
                    "fontFamily": {{
                        "headline-md": ["Pretendard"],
                        "label-md": ["Pretendard"],
                        "headline-lg": ["Pretendard"],
                        "body-sm": ["Pretendard"],
                        "display-lg": ["Pretendard"],
                        "label-sm": ["Pretendard"],
                        "body-lg": ["Pretendard"],
                        "headline-lg-mobile": ["Pretendard"],
                        "body-md": ["Pretendard"],
                        "mono": ["Space Grotesk", "Pretendard", "sans-serif"]
                    }},
                    "fontSize": {{
                        "headline-md": ["24px", {{"lineHeight": "32px", "fontWeight": "600"}}],
                        "label-md": ["12px", {{"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600"}}],
                        "headline-lg": ["32px", {{"lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700"}}],
                        "body-sm": ["14px", {{"lineHeight": "20px", "fontWeight": "400"}}],
                        "display-lg": ["48px", {{"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700"}}],
                        "label-sm": ["11px", {{"lineHeight": "14px", "fontWeight": "500"}}],
                        "body-lg": ["18px", {{"lineHeight": "28px", "fontWeight": "400"}}],
                        "headline-lg-mobile": ["24px", {{"lineHeight": "32px", "fontWeight": "700"}}],
                        "body-md": ["16px", {{"lineHeight": "24px", "fontWeight": "400"}}]
                    }}
                }}
            }}
        }}
    </script>
    <style>
        body {{ font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif; }}
        .mono, .font-mono {{ font-family: 'Space Grotesk', 'Pretendard', sans-serif; }}
        .backdrop-blur-md {{ backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }}
        .card-shadow {{ box-shadow: 0 4px 8px rgba(20, 23, 28, 0.04); }}
        details > summary::-webkit-details-marker {{ display: none; }}
        details > summary {{ list-style: none; }}
        @media print {{
            @page {{ size: A3 landscape; margin: 12mm; }}
            body {{ background: #ffffff; }}
            .no-print, header button, .tab-button {{ display: none !important; }}
            /* 인쇄 시 모든 탭 펼침 */
            .tab-content {{ display: block !important; }}
            .tab-content + .tab-content {{ page-break-before: always; }}
            /* 아코디언 모두 펼침 */
            details {{ display: block !important; }}
            details > summary {{ display: none !important; }}
            details > *:not(summary) {{ display: block !important; }}
            /* sticky 비활성화 */
            .sticky {{ position: static !important; }}
            /* 카드 페이지 내에서 잘리지 않게 */
            section, .card-shadow {{ break-inside: avoid; page-break-inside: avoid; }}
            .card-shadow {{ box-shadow: none !important; }}
        }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .tab-button.active {{
            background-color: #101622;
            color: white;
        }}
    </style>
</head>
<body class="bg-surface min-h-screen font-body-md text-text-primary antialiased">
<div class="w-full flex flex-col relative bg-surface">
    <main class="flex-1 px-gutter sm:px-xl lg:px-[64px] py-xl">
        <div class="max-w-7xl mx-auto">
            {tabs_nav}

            <div class="tab-content active" id="tab-0">{tab_0}</div>
            <div class="tab-content" id="tab-1">{tab_1}</div>
            <div class="tab-content" id="tab-2">{tab_2}</div>
            <div class="tab-content" id="tab-3">{tab_3}</div>
            <div class="tab-content" id="tab-4">{tab_4}</div>
        </div>
    </main>
</div>

<script>
    // Tab switching functionality
    document.querySelectorAll('.tab-button').forEach(button => {{
        button.addEventListener('click', () => {{
            const tabId = button.getAttribute('data-tab');

            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {{
                content.classList.remove('active');
            }});

            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(btn => {{
                btn.classList.remove('active');
            }});

            // Show selected tab content
            document.getElementById(tabId).classList.add('active');

            // Add active class to clicked button
            button.classList.add('active');
        }});
    }});

    // Set first tab as active
    document.querySelector('.tab-button').classList.add('active');

    // ───── i18n KO/EN 토글 ─────
    // 1) data-i18n 속성: 명시적 매핑 (data-en 우선)
    // 2) GLOSSARY: 한글 텍스트 노드를 자동 영문 치환 (정적 UI 라벨용)
    const I18N_KEY = 'report_lang';
    const GLOSSARY = {{
        // 탭 / 카드 / 패널 헤더
        "요약": "Summary",
        "유사도 점수": "Similarity Score",
        "유사도": "Similarity",
        "시스템 결정 트리": "System Decision Tree",
        "결정 트리": "Decision Tree",
        "결정 요약": "Decision Summary",
        "계약건수·구독료·TCO": "Contracts · Subscription · TCO",
        "시장·경쟁 배경": "Market & Competition",
        "시장 배경": "Market Background",
        "경쟁사 현황": "Competitor Landscape",
        "근거 · 인사이트": "Evidence & Insights",
        "근거": "Evidence",
        "산식": "Formula",
        "산식 보기": "View formula",
        "근거 보기": "View evidence",
        "상세 보기": "View details",
        "더 보기": "More",
        "기준국": "Baseline",
        "대상국": "Target",
        "베이스라인": "Baseline",
        "베이스라인 국가 / 시스템": "Baseline / System",
        "권역": "Region",
        "권역 내 확산": "Regional expansion",
        "권역 내 구축": "Regional build",
        "권역 내 시스템 존재 다이아몬드": "Regional system present (diamond)",
        "권역 미지정": "Region unset",
        "권역 확산": "Regional expansion",
        // 디멘전 / 항목
        "솔루션 유형": "Solution Type",
        "디지털 채널 성숙도": "Digital Channel Maturity",
        "디지털 딜러 성숙도": "Digital Dealer Maturity",
        "디지털 채널": "Digital Channel",
        "라이선스 체제(세그먼트별)": "Licensing Regime (by segment)",
        "라이선스 체제": "Licensing Regime",
        "라이선스 종류": "License Type",
        "라이선스": "License",
        "데이터 현지화 의무": "Data Localization",
        "데이터현지화": "Data Localization",
        "차량회수 절차 용이성": "Repossession Ease",
        "차량회수 절차": "Repossession Process",
        "차량회수": "Repossession",
        "법적 회수 소요기간": "Legal Recovery Period",
        "구매 패턴(할부·리스 비중)": "Purchase Pattern (Installment/Lease)",
        "구매 패턴": "Purchase Pattern",
        "금융 이용률(신차)": "Finance Usage (New)",
        "금융 이용률(중고차)": "Finance Usage (Used)",
        "금융 이용률": "Finance Usage",
        "금융 이용": "Finance Usage",
        "신차 판매대수": "New Car Sales",
        "캡티브 강도(점유율)": "Captive Intensity (Share)",
        "캡티브 강도": "Captive Intensity",
        "평균 신차가격": "Avg. New Car Price",
        "평균 금리/APR": "Avg. Rate / APR",
        "EV 보급률": "EV Adoption",
        "EV·ICE 잔존가치 리스크": "EV·ICE Residual Value Risk",
        "오토금융/리스 시장규모": "Auto Finance/Lease Market Size",
        "오토금융 성장률(CAGR)": "Auto Finance Growth (CAGR)",
        "GDP 성장률": "GDP Growth",
        "자동차 판매대수": "Vehicle Sales",
        "시장규모(CAGR)": "Market Size (CAGR)",
        "금융이용유형": "Finance Type Mix",
        "경쟁강도": "Competition Intensity",
        // 시장 탭 — 표/차트 라벨
        "순위 · 기업": "Rank · Company",
        "값": "Value",
        "점유율": "Share",
        "신차 자동차대출": "New-Car Auto Loan",
        "캡티브 프로모": "Captive Promo",
        "소비자신용 평균": "Consumer Credit Avg.",
        // KPI / 점수
        "종합 유사도": "Overall Similarity",
        "종합 유사도 점수": "Overall Similarity Score",
        "축별 유사도": "Per-Axis Similarity",
        "축별 유사도 분해": "Per-Axis Breakdown",
        "축별": "Per-axis",
        "축": "Axis",
        "시스템": "System",
        "상품": "Product",
        "규제": "Regulation",
        "리스크": "Risk",
        "리스크 등급": "Risk Level",
        "매력도": "Attractiveness",
        "퀵윈": "Quickwin",
        "10년 TCO": "10-Year TCO",
        "10년": "10 Years",
        "10Y TCO": "10Y TCO",
        "TCO": "TCO",
        "총 TCO": "Total TCO",
        "총비용": "Total Cost",
        "총": "Total",
        "구축비": "Build Cost",
        "구축비용": "Build Cost",
        "구축비용·기간 산식": "Build Cost·Duration Formula",
        "구축 기간 / 계약": "Build Duration / Contract",
        "구축기간": "Build Duration",
        "구축기간(개월)": "Build Duration (months)",
        "구축 + 유지(10Y), 운영비는 별도 통금액": "Build + Maintenance (10Y); Opex is a separate fixed amount.",
        "구축비, 반복": "Build (one-off), Recurring",
        "구축비는 Y0에 한 번, 반복비는 매년 누적": "Build is one-off in Y0; recurring costs accumulate annually.",
        "특화개발비": "Customization Cost",
        "특화개발 견적": "Customization Estimate",
        "유지보수": "Maintenance",
        "연 유지보수": "Annual Maintenance",
        "연 유지비": "Annual Recurring",
        "운영비": "Operations",
        "운영비 통금액": "Total Opex",
        "연 구독료": "Annual Subscription",
        "구독료": "Subscription",
        "구독료+유지보수": "Subscription + Maintenance",
        "구독료 단가": "Per-unit Price",
        "구독료 구간": "Subscription Tier",
        "구독료 구간 (전체 소급)": "Subscription Tier (Retroactive)",
        "구독료 구간표": "Subscription Tier Table",
        "건/년": "/yr",
        "건당 단가": "Per-unit Price",
        "건당": "Per unit",
        "건당 단가 · 누적 증가 시 자동 하향 (전 물량 소급)": "Per-unit price · auto-discounted as volume grows (retroactive to all volume).",
        "계약건수": "Contracts",
        "예상 계약건수": "Expected Contracts",
        "누적 계약건수": "Cumulative Contracts",
        "신규 누적": "New Cumulative",
        "기존 누적": "Existing Cumulative",
        "누적": "Cumulative",
        "누적 총비용": "Cumulative Total Cost",
        // 결정 트리
        "최종 결정": "Final Decision",
        "결정 분기와 무관 · 비교용": "Independent of branching · for reference",
        "분기 경로": "Branch Path",
        "유사도 평가": "Similarity Assessment",
        "시스템 결정": "System Decision",
        "기준점 통과": "Threshold passed",
        "기준점": "Threshold",
        "감점 없음": "No deduction",
        "그 외": "Otherwise",
        "기타": "Other",
        // 시장·경쟁 배경
        "금융사 순위": "Finance Company Ranking",
        "금융사 점유율": "Finance Company Share",
        "금융사 Top 5 (점유율 · 캡티브 강도)": "Finance Top 5 (Share · Captive Intensity)",
        "금융사 Top5 + 캡티브 강도": "Finance Top 5 + Captive Intensity",
        "금융사 (캡티브 계열)": "Captive Finance",
        "OEM 순위": "OEM Ranking",
        "브랜드 Top10": "Brand Top 10",
        "브랜드": "Brand",
        "경쟁사 리스트": "Competitor List",
        "경쟁사 진출 형태": "Competitor Entry Form",
        "경쟁사 금리 범위": "Competitor Rate Range",
        "경쟁사": "Competitor",
        "규제기관": "Regulator",
        "외부 이슈 스캔": "External News Scan",
        "핵심 이슈": "Key Issue",
        "국가 종합 인사이트": "Country Overall Insight",
        "국가 정성 요약": "Country Qualitative Summary",
        "AI 코멘트": "AI Comment",
        "AI 교차 인사이트": "AI Cross-Insights",
        "AI 인사이트": "AI Insights",
        // 데이터 품질
        "데이터 품질": "Data Quality",
        "근거 자료": "Source Material",
        "출처": "Source",
        "출처 신뢰도": "Source Reliability",
        "Tier": "Tier",
        "외부조사": "External",
        "내부자료": "Internal",
        "계산값": "Calculated",
        "외부이슈": "News",
        "사실확인됨": "Verified",
        "조사 필요": "Research needed",
        "관련 화이트리스트 이슈 미확보": "No whitelisted issue found",
        "데이터 없음": "No data",
        "원문": "Original",
        // 단위·표기
        "년": "yr",
        "개월": "months",
        "개": "count",
        "개사": "firms",
        "건": "contracts",
        "건수": "Count",
        "건수 산정 입력값": "Inputs for Volume Calc",
        "구간": "Tier",
        "월": "month",
        "원": "KRW",
        "통과": "Pass",
        "탈락": "Fail",
        "통과/탈락": "Pass / Fail",
        "통과 게이트": "Passing Gate",
        "통과 게이트 수": "Passing Gate Count",
        // 푸터·메타
        "Report ID": "Report ID",
        "생성": "Generated",
        "생성일": "Generated",
        "스냅샷": "Snapshot",
        "엔진": "Engine",
        "스키마": "Schema",
        "컨피그": "Config",
        "버전": "Version",
        "FX 기준": "FX base",
        "데이터 기준연도": "Data year",
        "통화": "Currency",
        "권역 내 확산 시스템": "Regional Expansion System",
        // 패널·차트 헤더 보강
        "총 10년 TCO": "Total 10-Year TCO",
        "예상 구축 기간": "Est. Build Duration",
        "예상 계약건수": "Est. Contracts",
        "예상 계약건수 산식": "Est. Contracts Formula",
        "유사도 승수": "Similarity Multiplier",
        "10년 TCO 구성 분해 (워터폴)": "10-Year TCO Breakdown (Waterfall)",
        "10년 TCO 구성 분해": "10-Year TCO Breakdown",
        "10년 누적 비용 추이": "10-Year Cumulative Cost Trend",
        "본사 자체구축 (참고)": "HQ Self-Build (Reference)",
        "본사 자체구축": "HQ Self-Build",
        "최종 결정": "Final Decision",
        // 단위 토큰
        "건": "contracts",
        "운영중": "Operating",
        "준비중": "Preparing",
        "미진출": "Not entered",
        // 추가 패널·라벨
        "예상 10년 TCO": "Est. 10-Year TCO",
        "신규국 구축비용": "New Country Build Cost",
        "신규국 구축기간(개월)": "New Country Build Duration (months)",
        "유사도 점수 (자기 베이스라인)": "Similarity Score (Self-Baseline)",
        "유사도 산정 근거 항목 (원천 데이터)": "Similarity Source Items (Raw Data)",
        "시장·경쟁 핵심 지표 (원천 데이터)": "Market & Competition Key Indicators (Raw Data)",
        "상세 항목 및 근거": "Detailed Items & Evidence",
        "베이스라인 솔루션": "Baseline Solution",
        "베이스라인 국가": "Baseline Country",
        "베이스라인 국가 / 시스템": "Baseline Country / System",
        "승수 구간": "Multiplier Band",
        "적용 승수": "Applied Multiplier",
        "시스템 소계": "System Subtotal",
        "운영비(10Y)": "Operations (10Y)",
        "유지비(10Y)": "Maintenance (10Y)",
        "우리사 예상 점유율": "Our Expected Share",
        "축별 유사도 분해": "Per-Axis Similarity Breakdown",
        "축별 유사도": "Per-Axis Similarity",
        "차트 유형": "Chart Type",
        "유사도 점수": "Similarity Score",
        "분기 경로": "Branching Path",
        "외부솔루션 도입": "External Solution",
        "권역 내 확산": "Regional Expansion",
        "본사 자체구축": "HQ Self-Build",
        "은행계 자회사": "Bank Subsidiary",
        "캡티브 금융사": "Captive Finance Co.",
        "캡티브 금융사 보유 추정": "Estimated Captive Finance Presence",
        "캡티브 프로모": "Captive Promo",
        "플릿/렌팅 리스사": "Fleet / Renting Lessor",
        "전문 여신사·기타": "Specialized Lender / Others",
        "할부·리스": "Installment · Lease",
        "현금": "Cash",
        "현금·기타": "Cash / Other",
        "신차 자동차대출": "New-Car Auto Loan",
        "소비자신용 평균": "Consumer Credit Avg.",
        "보험 끼워팔기 규제": "Insurance Tying Regulation",
        "신용생명보험 규제": "Credit Life Insurance Regulation",
        "의무보험 규제": "Compulsory Insurance Regulation",
        "개인정보보호법": "Personal Data Protection",
        "상품판매 현황": "Product Sales Status",
        "리스크 등급": "Risk Level",
        "통과 게이트 수": "Passing Gate Count",
        "통과 게이트": "Passing Gates",
        "통과/탈락": "Pass / Fail",
        "근거 자료": "Source Material",
        "데이터 품질": "Data Quality",
        "원문": "Original",
        "조사 필요": "Research needed",
        "관련 화이트리스트 이슈 미확보": "No whitelisted issue available",
        "데이터 없음": "No data",
        "데이터 기준연도": "Data year",
        "FX 기준": "FX base",
        "통화": "Currency",
        "버전": "Version",
        "기준점 통과": "Threshold passed",
        "기준점": "Threshold",
        "감점 없음": "No deduction",
        "건수 산정 입력값": "Inputs for Volume Calculation",
        // 점유율·KPI 보조
        "점유율": "Share",
        "사실확인됨": "Fact-checked",
        // 추가 패널 타이틀
        // 디멘전 이름 (25개)
        "배포형태(패키지/SI/SaaS)": "Deployment (Package/SI/SaaS)",
        "커스터마이징 자유도": "Customization Freedom",
        "벤더 종속도": "Vendor Lock-in",
        "멀티테넌시 여부": "Multi-tenancy",
        "온라인 신청 연동": "Online Application Integration",
        "비대면 계약 가능": "Remote Contracting",
        "API 개방도": "API Openness",
        "페이퍼리스 수준": "Paperless Level",
        "리스 취급 일치도": "Lease Handling Match",
        "렌탈 취급 일치도": "Rental Handling Match",
        "플릿 취급 일치도": "Fleet Handling Match",
        "상품별 비중 유사도": "Product Mix Similarity",
        "취득방식(등록 vs 인가)": "Acquisition (Registration vs License)",
        "외국인 취득 가능": "Foreign Eligibility",
        "처리기간(개월)": "Processing Time (months)",
        "최저자본금 수준": "Min. Capital Level",
        "감독 강도": "Supervision Intensity",
        "현지 저장 강제": "Local Storage Mandate",
        "국외 이전 허용도": "Cross-border Transfer",
        "동의·보관 규제": "Consent / Retention Regulation",
        "GDPR 동등성": "GDPR Equivalence",
        "사법절차 필요": "Judicial Process Required",
        "회수 소요기간(일)": "Recovery Time (days)",
        "자력구제 허용": "Self-Help Allowed",
        "회수율": "Recovery Rate",
        "OEM Top 5 (점유율 · 캡티브 보유)": "OEM Top 5 (Share · Captive Ownership)",
        "OEM 순위(Top 5)": "OEM Ranking (Top 5)",
        "금융사 Top 5 (점유율 · 캡티브 강도)": "Finance Top 5 (Share · Captive Intensity)",
        "금융사 순위(Top 5)": "Finance Company Ranking (Top 5)",
        "금융사 점유율(Top 5)": "Finance Company Share (Top 5)",
        "EV 보급률 · EV/ICE 잔존가치 추이": "EV Adoption · EV/ICE Residual Value Trend",
        "EV·ICE 잔존가치 리스크": "EV·ICE Residual Value Risk",
        "EV/ICE 잔존가치(3년)": "EV/ICE Residual Value (3yr)",
        "신차 등록 순위": "New Car Registration Ranking",
        "Top 5": "Top 5",
        "ICE 외": "Non-ICE",
        "기타": "Other",
        "경쟁사 금리 범위": "Competitor Rate Range",
        "시장·경쟁 핵심 지표 (원천 데이터)": "Market & Competition Key Indicators (Raw Data)",
        "유사도 산정 근거 항목 (원천 데이터)": "Similarity Source Items (Raw Data)",
        "상세 항목 및 근거": "Detailed Items & Evidence",
        "계약 규모 산정 근거 항목": "Contract Volume Basis Items",
        "10년 누적 비용 추이": "10-Year Cumulative Cost Trend",
        "구독료 구간 (전체 소급)": "Subscription Tier (Retroactive)",
        "10년 TCO 구성 분해 (워터폴)": "10-Year TCO Breakdown (Waterfall)",

        // 결정트리 다이어그램
        "처리 (Action)": "Action",
        "처리 (ACTION)": "Action",
        "Regional build": "Regional build",
        "시스템 존재?": "System present?",
        "기준점 통과?": "Threshold passed?",
        "Similarity": "Similarity",
        "≥ 70 → 권역 내 확산": "≥ 70 → Regional expansion",
        "50~70 → 본사 자체구축": "50–70 → HQ self-build",
        "< 50": "< 50",
        "외부솔루션": "External solution",
        "YES → 외부솔루션": "YES → External solution",
        "NO → 외부솔루션": "NO → External solution",
        "NO (Fallback)": "NO (Fallback)",
        "현지 사용 솔루션 + 로컬 솔루션 2~3종 추천 (기준점 통과 시)": "Local solutions + 2-3 regional alternatives recommended (when threshold passed)",
        // SVG <text> static labels (decision tree)
        "권역 내 구축": "Regional Build",
        "유사도": "Similarity",
    }};

    // 한글 문자 포함 여부
    function _hasKo(s) {{
        return /[\\uAC00-\\uD7A3]/.test(s);
    }}
    // 텍스트 노드 자동 번역: GLOSSARY에 정확 일치하는 경우만 교체 (안전 우선)
    function _walkAndTranslate(root, lang) {{
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const targets = [];
        while (walker.nextNode()) {{
            const node = walker.currentNode;
            if (!node.nodeValue) continue;
            const trimmed = node.nodeValue.trim();
            if (!trimmed) continue;
            // 부모가 data-i18n 가졌으면 명시 매핑이 이미 처리하므로 스킵
            const parentEl = node.parentElement;
            if (parentEl && parentEl.closest('[data-i18n]')) continue;
            if (parentEl && (parentEl.tagName === 'SCRIPT' || parentEl.tagName === 'STYLE')) continue;
            targets.push({{node, trimmed}});
        }}
        targets.forEach(({{node, trimmed}}) => {{
            // ko 백업
            if (!node._koOriginal) node._koOriginal = node.nodeValue;
            if (lang === 'en') {{
                const mapped = GLOSSARY[trimmed];
                if (mapped) {{
                    // 원래 공백 유지하면서 본문만 교체
                    node.nodeValue = node._koOriginal.replace(trimmed, mapped);
                }}
            }} else {{
                node.nodeValue = node._koOriginal;
            }}
        }});
    }}

    function applyLang(lang) {{
        // 1) data-i18n 명시 매핑 — 자식 span 보존 위해 텍스트 노드만 교체
        // data-en="" 빈 문자열은 "영문일 땐 비워라"는 의미 (한글로 폴백하지 않음)
        document.querySelectorAll('[data-i18n]').forEach(el => {{
            const en = el.getAttribute('data-en');
            const hasEn = en !== null;  // null=속성 없음, ""=영문 시 비움, 그 외=영문 텍스트
            // 첫 텍스트 노드 찾기 (자식 element는 건드리지 않음)
            let textNode = null;
            for (const n of el.childNodes) {{
                if (n.nodeType === 3) {{ textNode = n; break; }}  // TEXT_NODE
            }}
            if (textNode) {{
                if (!textNode._koOriginal) textNode._koOriginal = textNode.nodeValue;
                textNode.nodeValue = (lang === 'en' && hasEn) ? en : textNode._koOriginal;
            }} else if (el.children.length === 0) {{
                // 텍스트만 가진 element — textContent 교체
                const ko = el.getAttribute('data-ko');
                if (ko === null) el.setAttribute('data-ko', el.textContent);
                const original = el.getAttribute('data-ko') || el.textContent;
                el.textContent = (lang === 'en' && hasEn) ? en : original;
            }}
        }});
        // 2) GLOSSARY 기반 자동 번역
        try {{ _walkAndTranslate(document.body, lang); }} catch (_) {{}}
        const label = document.getElementById('lang-label');
        if (label) label.textContent = lang === 'en' ? '한' : 'EN';
        document.documentElement.lang = lang;
        try {{ localStorage.setItem(I18N_KEY, lang); }} catch (_) {{}}
    }}
    function toggleLang() {{
        const current = (document.documentElement.lang || 'ko').toLowerCase().startsWith('en') ? 'en' : 'ko';
        applyLang(current === 'en' ? 'ko' : 'en');
    }}
    // 언어 토글 UI 제거됨 — 항상 기본값(한글)로 표시. 과거 저장된 'en' 설정도 무시하고 정리.
    try {{ localStorage.removeItem(I18N_KEY); }} catch (_) {{}}

    // PDF (browser print → save as PDF) — 인쇄 전 모든 아코디언 펼침, 끝나면 원복
    function exportPDF() {{
        const tabs = document.querySelectorAll('.tab-content');
        const details = document.querySelectorAll('details');
        const tabState = Array.from(tabs).map(t => t.classList.contains('active'));
        const detailState = Array.from(details).map(d => d.open);
        details.forEach(d => d.open = true);
        const restore = () => {{
            details.forEach((d, i) => d.open = detailState[i]);
            tabs.forEach((t, i) => t.classList.toggle('active', tabState[i]));
            window.removeEventListener('afterprint', restore);
        }};
        window.addEventListener('afterprint', restore);
        setTimeout(restore, 60000);
        window.print();
    }}
    const pdfBtn = document.getElementById('btn-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', exportPDF);
    // Cmd/Ctrl+P 단축키
    window.addEventListener('keydown', (e) => {{
        if ((e.metaKey || e.ctrlKey) && e.key === 'p') {{
            e.preventDefault();
            exportPDF();
        }}
    }});

</script>
</body>
</html>'''

    def save_html(self, output_path: Optional[str] = None) -> str:
        """Save generated HTML to file.

        Args:
            output_path: Optional custom output path

        Returns:
            Path to saved HTML file
        """
        if not output_path:
            # Default: sibling 'html' directory next to the JSON's 'data' folder
            json_path = Path(self.report_json_path)
            country_root = json_path.parent.parent  # e.g. .../country/ES
            html_dir = country_root / "html"
            html_dir.mkdir(parents=True, exist_ok=True)
            output_path = html_dir / f"{json_path.stem}.html"

        html = self.generate_html()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

        return str(output_path)


def main():
    """CLI entry point for rendering."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python country_report_renderer.py <report_json_path> [output_html_path]")
        print("Example: python country_report_renderer.py storage/report/country/data/ES/RPT_CTR_ES_001.json")
        sys.exit(1)

    report_json_path = sys.argv[1]
    output_html_path = sys.argv[2] if len(sys.argv) > 2 else None

    renderer = CountryReportRenderer(report_json_path)

    if not renderer.load_report():
        sys.exit(1)

    html_path = renderer.save_html(output_html_path)
    print(f"✅ HTML report generated: {html_path}")

    return 0


if __name__ == "__main__":
    main()
