#!/usr/bin/env python3
"""
Region Report Renderer (Type 2 / PR2)

Consumes Type 2 JSON produced by app/backend/engine/generation/region_report_engine.py
and renders a standalone HTML report aligned with:
  - architecture/research/report_render_req.md   (nature→chart, flag→badge)
  - architecture/research/report_generate_req.md (tab structure, scoring rules)
  - architecture/design/stitch/html/PR2.html     (visual style/layout)

Tab order (per render spec §3, Type 2):
  요약 → 2-0 킬스위치 → 2-1 매력도 → 2-2 IT유사도/순위 → 2-3 시장배경
"""

import html
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SOURCE_BADGES = {
    "EXT":  {"label": "외부조사",   "bg": "#eef0f2", "fg": "#3b3f46"},
    "INT":  {"label": "내부자료",   "bg": "#eaf0f8", "fg": "#3f6cb4"},
    "CALC": {"label": "계산값",     "bg": "#e9f3ee", "fg": "#4f8a6d"},
    "AI":   {"label": "AI 인사이트", "bg": "#eaf0f8", "fg": "#3f6cb4"},
    "NEWS": {"label": "외부이슈",   "bg": "#fbf3e2", "fg": "#c08a2e"},
}

# 배지 flag 라벨 영문 (KO/EN 토글용)
SOURCE_BADGES_EN = {
    "EXT": "External", "INT": "Internal", "CALC": "Calculated",
    "AI": "AI Insight", "NEWS": "News",
}

COUNTRY_NAMES_KO = {
    "ES": "스페인", "PL": "폴란드", "IT": "이탈리아", "PT": "포르투갈",
    "UK": "영국", "GB": "영국", "NL": "네덜란드", "AT": "오스트리아", "DK": "덴마크",
    "DE": "독일", "FR": "프랑스", "CZ": "체코", "HU": "헝가리",
    "US": "미국", "CA": "캐나다", "MX": "멕시코",
    "AU": "호주", "NZ": "뉴질랜드", "JP": "일본", "KR": "한국", "SG": "싱가포르",
    "CN": "중국", "IN": "인도", "ID": "인도네시아",
    "BR": "브라질", "AR": "아르헨티나", "CL": "칠레", "PR": "푸에르토리코",
}

COUNTRY_NAMES_EN = {
    "ES": "Spain", "PL": "Poland", "IT": "Italy", "PT": "Portugal",
    "UK": "United Kingdom", "GB": "United Kingdom",
    "NL": "Netherlands", "AT": "Austria", "DK": "Denmark",
    "DE": "Germany", "FR": "France", "CZ": "Czech Republic", "HU": "Hungary",
    "US": "United States", "CA": "Canada", "MX": "Mexico",
    "AU": "Australia", "NZ": "New Zealand", "JP": "Japan", "KR": "South Korea",
    "SG": "Singapore", "CN": "China", "IN": "India", "ID": "Indonesia",
    "BR": "Brazil", "AR": "Argentina", "CL": "Chile", "PR": "Puerto Rico",
}

REGION_NAMES = {
    "EU": ("유럽", "European Union"),
    "NA": ("북미", "North America"),
    "APAC": ("아태", "Asia-Pacific"),
    "SA": ("남미", "South America"),
}

# UI 라벨 사전 (정적 UI 텍스트만; 본문/AI 메시지는 Phase 2~3에서 다룸)
LABELS = {
    # 헤더 / 버튼
    "btn_pdf":            {"ko": "PDF", "en": "PDF"},
    "btn_lang_toggle":    {"ko": "EN", "en": "한"},
    "header_report_id":   {"ko": "Report ID", "en": "Report ID"},
    "header_generated":   {"ko": "생성", "en": "Generated"},
    "header_baseline":    {"ko": "기준국", "en": "Baseline"},
    "header_data_year":   {"ko": "데이터 기준연도", "en": "Data year"},
    "header_evaluated":   {"ko": "평가", "en": "Evaluated"},
    "header_countries":   {"ko": "개국", "en": "countries"},
    "footer_snapshot":    {"ko": "스냅샷", "en": "Snapshot"},
    "footer_engine":      {"ko": "엔진", "en": "Engine"},
    "footer_schema":      {"ko": "스키마", "en": "Schema"},
    "footer_config":      {"ko": "컨피그", "en": "Config"},

    # 탭 네비
    "tab_summary":        {"ko": "요약", "en": "Summary"},
    "tab_killswitch":     {"ko": "킬스위치", "en": "Killswitch"},
    "tab_attractiveness": {"ko": "매력도", "en": "Attractiveness"},
    "tab_it":             {"ko": "IT/순위", "en": "IT / Ranking"},
    "tab_market":         {"ko": "시장배경", "en": "Market"},
    "tab_summary_sub":    {"ko": "Summary", "en": "Summary"},
    "tab_killswitch_sub": {"ko": "Kill-Switch", "en": "Kill-Switch"},
    "tab_attr_sub":       {"ko": "Attractiveness", "en": "Attractiveness"},
    "tab_it_sub":         {"ko": "IT & Ranking", "en": "IT & Ranking"},
    "tab_market_sub":     {"ko": "Market", "en": "Market"},

    # 요약 탭
    "summary_top3_title":     {"ko": "퀵윈 순위 (Top 3)", "en": "Quickwin Ranking (Top 3)"},
    "summary_rank":           {"ko": "Rank", "en": "Rank"},
    "summary_attr_label":     {"ko": "매력도", "en": "Attractiveness"},
    "summary_it_label":       {"ko": "IT 유사도", "en": "IT Similarity"},
    "summary_overall_rank":   {"ko": "전체 순위", "en": "Full Ranking"},
    "summary_ai_title":       {"ko": "AI 교차 인사이트", "en": "AI Cross-Insights"},
    "summary_news_title":     {"ko": "외부 이슈 스캔", "en": "External News Scan"},
    "summary_news_region":    {"ko": "권역 공통", "en": "Region-wide"},
    "summary_no_ai":          {"ko": "AI 인사이트 없음", "en": "No AI insights"},
    "summary_no_news":        {"ko": "권역 이슈 없음", "en": "No regional news"},
    "summary_no_rank":        {"ko": "순위 데이터 없음", "en": "No ranking data"},
    "summary_table_country":  {"ko": "국가", "en": "Country"},
    "summary_table_attr":     {"ko": "매력도", "en": "Attr."},
    "summary_table_it":       {"ko": "IT", "en": "IT"},
    "summary_table_quickwin": {"ko": "퀵윈", "en": "Quickwin"},
    "summary_baseline_excluded": {"ko": "이미 시스템 보유 — 순위 제외", "en": "Already deployed — excluded from ranking"},
    "summary_news_source":    {"ko": "출처", "en": "Source"},
    "summary_news_original":  {"ko": "원문", "en": "Original"},

    # 요약 패널 (prose) — 국가 보고서 요약 패널과 동일 구조
    "panel_summary":          {"ko": "요약", "en": "Summary"},
    "rgn_sum_line1_a":        {"ko": " 권역의 후보 ", "en": " region evaluated "},
    "rgn_sum_line1_b":        {"ko": "개국을 베이스라인 ", "en": " candidate countries against the baseline "},
    "rgn_sum_line1_c":        {"ko": " 대비 스코어링한 결과, 최우선 퀵윈 후보는 ", "en": ", and the top quick-win candidate is "},
    "rgn_sum_line1_d":        {"ko": "(으)로 도출되었습니다.", "en": "."},
    "rgn_sum_line2_a":        {"ko": "1위 근거 — ", "en": "Top-1 basis — "},
    "rgn_sum_line2_b":        {"ko": ". 킬스위치 탈락국은 ", "en": ". Killswitch-failed countries: "},
    "rgn_sum_line2_c":        {"ko": "개국입니다.", "en": "."},
    "rgn_sum_line3_concl":    {"ko": "결론적으로, ", "en": "Conclusion: "},
    "rgn_sum_line3_tail":     {"ko": " 진출을 우선 검토할 것을 권고합니다.", "en": " is recommended as the priority market."},

    # 킬스위치 탭
    "ks_matrix_title":  {"ko": "킬스위치 매트릭스", "en": "Killswitch Matrix"},
    "ks_status_pass":   {"ko": "통과", "en": "PASS"},
    "ks_status_fail":   {"ko": "탈락", "en": "FAIL"},
    "ks_status_unk":    {"ko": "확인 필요", "en": "UNKNOWN"},
    "ks_overall":       {"ko": "종합", "en": "Overall"},
    "ks_pass_count":    {"ko": "통과", "en": "Pass"},
    "ks_fail_count":    {"ko": "탈락", "en": "Fail"},
    "ks_explain_title": {"ko": "국가별 판정 근거", "en": "Per-Country Reasoning"},
    "ks_passed_msg":    {"ko": "모든 게이트 PASS → 권역 스코어링 포함", "en": "All gates PASS → included in regional scoring"},
    "ks_failed_msg":    {"ko": "한 개 이상의 게이트 FAIL → 스코어링 제외", "en": "One or more gates FAIL → excluded from scoring"},
    "ks_view_evidence": {"ko": "근거 보기", "en": "View evidence"},
    "ks_source":        {"ko": "출처", "en": "Source"},
    "ks_excluded_note": {"ko": "은 이후 스코어링에서 제외", "en": "are excluded from subsequent scoring"},
    "ks_status_flag":   {"ko": "주의", "en": "FLAG"},
    "ks_tier_col":      {"ko": "진출 형태", "en": "Entry Mode"},
    "ks_tier_in_region_confidence": {"ko": "권역내 확신", "en": "In-Region Confidence"},
    "ks_tier_external_solution":    {"ko": "외부솔루션 사용", "en": "External Solution"},
    "ks_tier_jv_recommended":       {"ko": "JV 권고", "en": "JV Recommended"},
    "ks_tier_jv_required":          {"ko": "JV 필수", "en": "JV Required"},

    # 매력도 탭
    "attr_ranking_title":     {"ko": "비즈니스 매력도 순위", "en": "Business Attractiveness Ranking"},
    "attr_contrib_title":     {"ko": "항목 기여분", "en": "Item Contributions"},
    "attr_country_formula":   {"ko": "국가별 점수 산식", "en": "Per-Country Score Formula"},
    "attr_view_formula":      {"ko": "산식 보기", "en": "View formula"},
    "attr_score_axis":        {"ko": "정규화 (0~100)", "en": "Normalized (0~100)"},
    "attr_raw_value":         {"ko": "조사값", "en": "Raw value"},
    "attr_eff_weight":        {"ko": "유효 가중치", "en": "Effective weight"},
    "attr_contribution":      {"ko": "기여", "en": "Contribution"},
    "attr_contrib_eq":        {"ko": "기여 = 정규화 × 유효가중치", "en": "Contribution = Norm × Eff.Weight"},
    "attr_source_item":       {"ko": "조사항목", "en": "Source item"},
    "attr_dir_positive":      {"ko": "高=好 정점수", "en": "High=Good (positive)"},
    "attr_dir_negative":      {"ko": "高=惡 역점수", "en": "High=Bad (reverse)"},
    "attr_weights_note":      {"ko": "가중치", "en": "Weights"},
    "attr_no_data":           {"ko": "데이터 없음", "en": "No data"},
    "attr_formula_help":      {
        "ko": "매력도 = Σ(정규화 × 유효가중치) ÷ Σ(유효가중치). 유효가중치 = 항목 가중치 × Tier 멀티플라이어 (Tier1=1.0 고정, Tier2~4는 config 조정 가능). 정규화는 권역 내 min~max 기준. 역점수 항목은 100 − 정규화값 적용(경쟁강도).",
        "en": "Attractiveness = Σ(Normalized × Effective Weight) ÷ Σ(Effective Weight). Effective weight = item weight × Tier multiplier (Tier1=1.0 fixed; Tier2~4 configurable). Normalization is min-max across regional candidates. Reverse-scored items use (100 − normalized) for High=Bad axes (e.g. competition intensity).",
    },
    "attr_tier_unknown":      {"ko": "Tier 미상", "en": "Tier unknown"},

    # IT 유사도 / 퀵윈 탭
    "it_heatmap_title":  {"ko": "IT 유사도 히트맵", "en": "IT Similarity Heatmap"},
    "it_vs_baseline":    {"ko": "vs 기준국", "en": "vs Baseline"},
    "it_band_legend":    {"ko": "밴드", "en": "Band"},
    "it_overall_col":    {"ko": "종합", "en": "Overall"},
    "it_baseline_pill":  {"ko": "기준", "en": "Base"},
    "it_sort_note":      {"ko": "정렬: 종합 점수 내림차순 · 기준국은 비교용으로 하단 표시. 셀 호버 시 raw 값 확인.", "en": "Sorted by overall band desc. Baseline is shown at the bottom for reference. Hover cells to see raw values."},
    "it_quickwin_title": {"ko": "퀵윈 종합 순위", "en": "Quickwin Final Ranking"},
    "it_scatter_title":  {"ko": "매력도 × IT 유사도", "en": "Attractiveness × IT Similarity"},
    "it_scatter_axis_x": {"ko": "매력도 →", "en": "Attractiveness →"},
    "it_scatter_axis_y": {"ko": "IT 유사도 →", "en": "IT Similarity →"},
    "it_quad_optimal":   {"ko": "퀵윈 최적", "en": "Optimal Quickwin"},
    "it_quad_short":     {"ko": "단기 진출", "en": "Short-Term"},
    "it_quad_midterm":   {"ko": "중장기", "en": "Mid-Long Term"},
    "it_quad_low":       {"ko": "후순위", "en": "Low Priority"},
    "it_quad_q1_label":  {"ko": "퀵윈 최적 — 즉시 진출 1순위", "en": "Quickwin optimal — top entry candidate"},
    "it_quad_q2_label":  {"ko": "단기 진출 — 시스템 빠르나 시장 작음(거점·실험)", "en": "Short-term — fast IT reuse, small market (foothold/experiment)"},
    "it_quad_q3_label":  {"ko": "중장기 — 시장은 매력, 시스템 새로 짜야", "en": "Mid-long term — attractive market, new system needed"},
    "it_quad_q4_label":  {"ko": "후순위/보류 — 둘 다 약함", "en": "Low priority — both weak"},
    "it_legend_candidate": {"ko": "후보국", "en": "Candidates"},
    "it_legend_baseline":  {"ko": "기준국 (비교용)", "en": "Baseline (reference)"},
    "it_legend_ks_excluded":{"ko": "킬스위치 탈락 (제외)", "en": "Killswitch failed (excluded)"},
    "it_top3_title":     {"ko": "상위 3개국 프로파일", "en": "Top-3 Country Profiles"},
    "it_country_formula":{"ko": "국가별 IT 유사도 산식", "en": "Per-Country IT Similarity Formula"},
    "it_qw_formula":     {"ko": "국가별 퀵윈 점수 산식", "en": "Per-Country Quickwin Formula"},
    "it_target_country": {"ko": "대상국", "en": "Target"},
    "it_band_score":     {"ko": "밴드 점수", "en": "Band score"},
    "it_quickwin_band":  {"ko": "퀵윈 구간", "en": "Quickwin band"},
    "it_qw_eligible":    {"ko": "평가 대상", "en": "Eligible"},
    "it_qw_ks_excluded": {"ko": "킬스위치 탈락", "en": "KS failed"},
    "it_qw_baseline_excluded": {"ko": "기준국 (제외)", "en": "Baseline (excluded)"},
    "it_formula_help": {
        "ko": "축별 raw 점수 = (수치 1~5) 100−|Δ|×20 / (범주·라이선스/솔루션) 텍스트 토큰 Jaccard 유사도 30+J×65 (완전 일치=100) / (gate) 동일=90·한쪽 PASS=50·기타=30. 유효가중치 = 항목 가중치 × Tier 멀티플라이어(대상국 데이터 신뢰도 기준, Tier1=1.0 고정). 종합 = Σ(raw × 유효가중치) ÷ Σ(유효가중치) → 10점 구간 반올림.",
        "en": "Per-axis raw = numeric(100−|Δ|×20) / categorical(text Jaccard 30+J×65, exact=100) / gate(same=90, one PASS=50, else=30). Effective weight = item weight × Tier multiplier (based on target's data tier; Tier1=1.0 fixed). Overall = Σ(raw × Eff.W) ÷ Σ(Eff.W) → rounded to 10-point bucket.",
    },
    "it_qw_formula_help": {
        "ko": "퀵윈 = 매력도 × w_biz + IT유사도 × w_it. 킬스위치 탈락국 제외, 10점 구간 표기.",
        "en": "Quickwin = Attractiveness × w_biz + IT × w_it. Killswitch failures excluded; reported as 10-point buckets.",
    },
    "it_sum_to_band":    {"ko": "합산 → 구간", "en": "Sum → band"},
    "it_news_keyword":   {"ko": "핵심 이슈", "en": "Key issue"},
    "it_ai_comment":     {"ko": "AI 코멘트", "en": "AI Comment"},
    "it_market_brief":   {"ko": "시장", "en": "Market"},
    "it_competition_brief": {"ko": "경쟁", "en": "Competition"},
    "it_ks_status":      {"ko": "킬스위치", "en": "Killswitch"},

    # 시장 배경 탭
    "market_title":       {"ko": "시장 배경 (참고)", "en": "Market Background (Reference)"},
    "market_oem_top5":    {"ko": "OEM Top 5", "en": "OEM Top 5"},
    "market_brand_top10": {"ko": "브랜드 Top 10", "en": "Brand Top 10"},
    "market_competitors": {"ko": "주요 경쟁사", "en": "Key Competitors"},
    "market_purchase":    {"ko": "구매 패턴(할부·리스)", "en": "Purchase Mix (Installment/Lease)"},
    "market_avg_price":   {"ko": "평균 신차가격", "en": "Avg. New Car Price"},
    "market_summary":     {"ko": "국가 요약", "en": "Country Summary"},
    "market_research_needed": {"ko": "조사 필요", "en": "Research needed"},
    "market_no_data":     {"ko": "데이터 없음", "en": "No data"},

    # 산식 안내 카드 / 공통
    "common_no_data":    {"ko": "데이터 없음", "en": "No data"},
    "common_unknown":    {"ko": "—", "en": "—"},
    "common_view_more":  {"ko": "더 보기", "en": "More"},

    # 추가 — 테이블 헤더 / pill
    "tbl_rank":           {"ko": "순위", "en": "Rank"},
    "tbl_country":        {"ko": "국가", "en": "Country"},
    "tbl_quickwin":       {"ko": "퀵윈", "en": "Quickwin"},
    "tbl_attractiveness": {"ko": "매력도", "en": "Attractiveness"},
    "tbl_it":             {"ko": "IT", "en": "IT"},
    "tbl_overall":        {"ko": "종합", "en": "Overall"},
    "pill_baseline_ref":  {"ko": "기준국 (비교용)", "en": "Baseline (reference)"},

    # 추가 — 인라인 라벨 / 빈 상태 / 산식 전개 (Phase: 영문 누락 보강)
    "band_bucket_note":   {"ko": "/100 (10점 구간)", "en": "/100 (10-pt bucket)"},
    "news_original":      {"ko": "↗ 원문", "en": "↗ Original"},
    "news_source_prefix": {"ko": "출처:", "en": "Source:"},
    "ks_source_prefix":   {"ko": "출처:", "en": "Source:"},
    "label_total":        {"ko": "총", "en": "Total"},
    "label_source_item":  {"ko": "조사항목:", "en": "Source item:"},
    "label_baseline_suffix": {"ko": "(기준)", "en": "(baseline)"},
    "no_gate_data":       {"ko": "게이트 데이터 없음", "en": "No gate data"},
    "no_contrib_data":    {"ko": "기여 데이터 없음", "en": "No contribution data"},
    "no_axis_data":       {"ko": "축 데이터 없음", "en": "No axis data"},
    "no_top3":            {"ko": "상위 3개국 없음", "en": "No top-3 countries"},
    "label_formula_expand": {"ko": "산식 전개:", "en": "Formula:"},
    # 시장 배경 탭 — 카드 미니 라벨
    "market_new_car_sales": {"ko": "신차 판매", "en": "New-car sales"},
    "market_finance_usage": {"ko": "금융 이용", "en": "Finance usage"},
    "market_ev_adoption":   {"ko": "EV 보급", "en": "EV adoption"},
    "market_competitor_entry": {"ko": "경쟁사 진출", "en": "Competitor entry"},
    # 산식 전개 문장 (IT/매력도 산식 카드 내부)
    "fx_text_exact":      {"ko": "텍스트 완전 일치 → 100", "en": "Exact text match → 100"},
    "fx_missing_value":   {"ko": "베이스 또는 대상 값 없음 → 점수 N/A", "en": "Baseline or target value missing → score N/A"},
    "fx_qw_missing":      {"ko": "매력도 또는 IT 유사도 결측 → 산정 불가", "en": "Attractiveness or IT similarity missing → cannot compute"},
}

DEFAULT_LANG = "ko"


# ---------------------------------------------------------------------------
# Renderer
# ---------------------------------------------------------------------------

class RegionReportRenderer:
    """Render Type 2 region report JSON → standalone HTML."""

    def __init__(self, report_json_path: str):
        self.report_json_path = report_json_path
        self.report: Dict[str, Any] = {}

    # ------------------------- I/O & helpers --------------------------

    def load_report(self) -> bool:
        try:
            with open(self.report_json_path, "r", encoding="utf-8") as f:
                self.report = json.load(f)
            return True
        except Exception as e:
            print(f"Error loading region report: {e}")
            return False

    @staticmethod
    def esc(s: Any) -> str:
        return html.escape("" if s is None else str(s))

    @staticmethod
    def country_flag_url(code: str) -> str:
        # UK/GB alias
        iso = "gb" if code == "UK" else code.lower()
        return f"https://flagcdn.com/w80/{iso}.png"

    def baseline_data_year(self, baseline_code: str) -> str:
        """기준 국가의 리서치 데이터(<CODE>_latest.json)에서 data_year를 읽어온다.
        리포트 JSON 경로로부터 storage 루트를 역추적해 research/country/<CODE> 를 찾는다.
        UK는 GB 데이터로 alias. 실패 시 빈 문자열."""
        if not baseline_code:
            return ""
        # report 경로: storage/report/region/<REGION>/data/<ID>.json → storage 루트 추적
        data_dir = os.path.dirname(os.path.abspath(self.report_json_path))
        storage = os.path.abspath(os.path.join(data_dir, "..", "..", "..", ".."))
        for code in ([ "GB", "UK" ] if baseline_code in ("UK", "GB") else [baseline_code]):
            path = os.path.join(storage, "data", "research", "country", code, f"{code}_latest.json")
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        return str(json.load(f).get("data_year", "") or "")
                except Exception:
                    return ""
        return ""

    def country_ko(self, code: str) -> str:
        return COUNTRY_NAMES_KO.get(code, code)

    def country_en(self, code: str) -> str:
        return COUNTRY_NAMES_EN.get(code, code)

    # ── i18n helpers ──────────────────────────────────────────────────
    def t(self, key: str) -> str:
        """Plain text (KO baseline). 영문 토글이 필요 없는 단순 inline용."""
        spec = LABELS.get(key)
        return spec["ko"] if isinstance(spec, dict) else key

    def t_span(self, key: str, extra_class: str = "") -> str:
        """`<span data-i18n>` element — JS 토글로 KO↔EN 전환됨."""
        spec = LABELS.get(key)
        if not isinstance(spec, dict):
            return self.esc(key)
        ko = self.esc(spec.get("ko", ""))
        en = self.esc(spec.get("en", ""))
        cls = f' class="{extra_class}"' if extra_class else ""
        return f'<span{cls} data-i18n="{key}" data-en="{en}">{ko}</span>'

    def loc_span(self, value: Any, extra_class: str = "") -> str:
        """엔진이 만든 {ko, en} dict를 <span data-i18n> 으로 출력.
        - dict면 ko/en 둘 다 노출
        - 문자열이면 그대로 (양 언어 동일 취급)
        """
        if isinstance(value, dict):
            ko = self.esc(value.get("ko", ""))
            en = self.esc(value.get("en", ""))
            cls = f' class="{extra_class}"' if extra_class else ""
            return f'<span{cls} data-i18n="engine_msg" data-en="{en}">{ko}</span>'
        cls = f' class="{extra_class}"' if extra_class else ""
        return f'<span{cls}>{self.esc(value)}</span>'

    def bi_span(self, ko: Any, en: Any = "", extra_class: str = "") -> str:
        """평탄한 (ko, en) 문자열 쌍을 <span data-i18n> 으로 출력 — JS 토글로 KO↔EN.
        en이 비어 있으면 ko로 폴백(토글해도 동일).
        """
        ko_s = self.esc(ko or "")
        en_s = self.esc(en or ko or "")
        cls = f' class="{extra_class}"' if extra_class else ""
        return f'<span{cls} data-i18n="engine_msg" data-en="{en_s}">{ko_s}</span>'

    @staticmethod
    def loc_text(value: Any, lang: str = "ko") -> str:
        """엔진이 만든 dict에서 특정 언어 문자열 추출 (인라인 평문용)."""
        if isinstance(value, dict):
            return value.get(lang) or value.get("ko") or ""
        return value or ""

    def badge(self, flag: str, suffix: Any = "") -> str:
        """source-flag 배지. suffix는 str 또는 {ko,en} dict (dict면 KO/EN 토글).

        배지의 flag 라벨(외부조사·계산값 등)도 SOURCE_BADGES_EN으로 토글된다.
        """
        if flag not in SOURCE_BADGES:
            return ""
        b = SOURCE_BADGES[flag]
        ko_label = b["label"]
        en_label = SOURCE_BADGES_EN.get(flag, b["label"])
        if isinstance(suffix, dict):
            ko_sfx, en_sfx = suffix.get("ko", ""), suffix.get("en", "")
        else:
            ko_sfx = en_sfx = suffix or ""
        ko_full = ko_label + (f" · {ko_sfx}" if ko_sfx else "")
        en_full = en_label + (f" · {en_sfx}" if en_sfx else "")
        return (
            f'<span class="inline-flex items-center gap-1 px-2 py-[2px] rounded-full '
            f'text-[10px] font-semibold tracking-wide" '
            f'style="background:{b["bg"]};color:{b["fg"]}" '
            f'data-i18n="engine_msg" data-en="{self.esc(en_full)}">{self.esc(ko_full)}</span>'
        )

    @staticmethod
    def score_color(score: Optional[float]) -> str:
        if score is None:
            return "#9aa0a8"
        if score >= 80:
            return "#4f8a6d"
        if score >= 60:
            return "#3f6cb4"
        if score >= 40:
            return "#c08a2e"
        return "#c0533f"

    # ------------------------- Tab 요약 -------------------------------

    def render_tab_summary(self) -> str:
        tabs = self.report.get("tabs", {})
        qw = tabs.get("quickwin", {})
        ranking = qw.get("ranking", [])[:3]
        exec_sum = tabs.get("executive_summary", {})

        kpis_html = self._render_podium(ranking)

        # AI insights — 엔진이 {ko, en} dict 또는 plain string 으로 줄 수 있음.
        # 별도 패널은 제거하고 첫 항목만 요약 패널 마지막 줄로 편입한다(ai_top, 아래).
        ai = exec_sum.get("ai_cross_insight", {})
        ai_items = ai.get("insights", []) or []

        # NEWS items — 권역 공통(region scope)은 강조, 국가별은 일반 카드
        news_items = (exec_sum.get("external_news_scan", {}) or {}).get("items", []) or []
        news_html_parts = []
        for n in news_items:
            is_region = (n.get("scope") == "region") or (n.get("country") in (None, ""))
            if is_region:
                scope_pill = (
                    '<span class="font-label-sm text-label-sm font-semibold px-2 py-[2px] rounded-full" '
                    f'style="background:#fbf3e2;color:#c08a2e">{self.t_span("summary_news_region")}</span>'
                )
                card_style = 'border-2 border-[#c08a2e]/40 bg-[#fbf3e2]'
                cat_label = n.get("news_category")
                cat_pill = (
                    f'<span class="text-[10px] uppercase tracking-wider text-text-secondary ml-xs">{self.esc(cat_label)}</span>'
                    if cat_label else ""
                )
                header_left = f'{scope_pill}{cat_pill}'
            else:
                _ccode = n.get("country", "")
                _cls = "font-label-sm text-label-sm text-text-secondary uppercase tracking-wider"
                if _ccode:
                    inner = (
                        f'<span class="{_cls}" data-i18n="country_name" '
                        f'data-en="{self.esc(self.country_en(_ccode) or _ccode)}">'
                        f'{self.esc(self.country_ko(_ccode) or _ccode)}</span>'
                    )
                else:
                    inner = self.t_span("summary_news_region", extra_class=_cls)
                header_left = inner
                card_style = 'border border-surface-border bg-surface-light'
            url = n.get("url")
            url_link = (
                f'<a href="{self.esc(url)}" target="_blank" rel="noopener" '
                f'class="font-label-sm text-label-sm text-secondary hover:underline ml-xs">{self.t_span("news_original")}</a>'
                if url else ""
            )
            news_html_parts.append(f'''
            <div class="rounded-lg p-md {card_style}">
                <div class="flex items-center justify-between mb-xs flex-wrap gap-xs">
                    <div class="flex items-center gap-xs">{header_left}</div>
                    {self.badge("NEWS", self.esc(n.get("date") or ""))}
                </div>
                <h4 class="font-label-md text-label-md text-primary mb-xs">{self.bi_span(n.get("headline"), n.get("headline_en"))}</h4>
                <p class="font-body-sm text-body-sm text-on-surface-variant">{self.bi_span(n.get("so_what"), n.get("so_what_en"))}</p>
                <p class="font-label-sm text-label-sm text-text-secondary mt-xs">{self.t_span("news_source_prefix")} {self.esc(n.get("publisher") or "—")}{url_link}</p>
            </div>''')
        news_html = "\n".join(news_html_parts) or f'<div class="text-text-secondary text-body-sm">{self.t_span("summary_no_news")}</div>'

        # ── 요약 패널 (prose) — 국가 보고서 요약 패널과 동일 구조/스타일 ──────────
        # 권역 데이터(후보국 수·베이스라인·top1·1위 근거·킬스위치 탈락 수)로
        # 세 줄 내러티브를 구성한다.
        target = self.report.get("target", {}) or {}
        candidates = target.get("evaluated_countries", []) or []
        baseline_code = (qw.get("baseline_country")
                         or target.get("baseline_country") or "")
        region_ko = (self.report.get("region_meta", {}) or {}).get("region_ko") \
            or target.get("region", "")
        region_en = (self.report.get("region_meta", {}) or {}).get("region") \
            or target.get("region", "")
        core = exec_sum.get("core_conclusion", {}) or {}
        why = core.get("why_top1") or ""
        failed_n = core.get("killswitch_failed_count", 0)
        top1 = ranking[0] if ranking else {}
        top1_code = top1.get("country", "")

        def _name_span(code: str) -> str:
            """국가/권역 코드를 KO↔EN 토글 span 으로 (괄호 코드 포함)."""
            return (f'{self.bi_span(self.country_ko(code), self.country_en(code))}'
                    f'({self.esc(code)})')

        line1 = (
            f'<strong>{self.bi_span(region_ko, region_en)}</strong>'
            f'{self.t_span("rgn_sum_line1_a")}'
            f'<strong>{self.esc(len(candidates))}</strong>'
            f'{self.t_span("rgn_sum_line1_b")}'
            f'<strong>{_name_span(baseline_code)}</strong>'
            f'{self.t_span("rgn_sum_line1_c")}'
            f'<strong>{_name_span(top1_code)}</strong>'
            f'{self.t_span("rgn_sum_line1_d")}'
        ) if top1_code else (
            f'<strong>{self.bi_span(region_ko, region_en)}</strong>'
            f'{self.t_span("rgn_sum_line1_a")}'
            f'<strong>{self.esc(len(candidates))}</strong>'
            f'{self.t_span("rgn_sum_line1_b")}'
            f'<strong>{_name_span(baseline_code)}</strong>.'
        )

        line2 = (
            f'{self.t_span("rgn_sum_line2_a")}'
            f'<strong>{self.loc_span(why)}</strong>'
            f'{self.t_span("rgn_sum_line2_b")}'
            f'<strong>{self.esc(failed_n)}</strong>'
            f'{self.t_span("rgn_sum_line2_c")}'
        )

        # AI 교차 인사이트 첫 항목을 요약 패널 마지막 줄로 편입 (별도 패널은 제거됨)
        ai_top = ai_items[0] if ai_items else None
        ai_line_p = f'''
                <p class="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
                    <span class="material-symbols-outlined text-white/70 text-[22px] mt-[2px] flex-shrink-0">psychology</span>
                    <span>{self.loc_span(ai_top)}</span>
                </p>''' if ai_top else ""

        summary_panel = f'''
        <section class="bg-primary border border-primary rounded-xl p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
            <div class="flex items-center gap-sm mb-md pb-sm border-b border-white/20">
                <span class="material-symbols-outlined text-on-primary" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                <h2 class="font-headline-md text-[24px] leading-[32px] font-semibold text-on-primary" data-i18n="panel_summary" data-en="Summary">요약</h2>
            </div>
            <div class="flex flex-col gap-md [&_strong]:text-white">
                <p class="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
                    <span class="material-symbols-outlined text-white/70 text-[22px] mt-[2px] flex-shrink-0">analytics</span>
                    <span>{line1}</span>
                </p>
                <p class="flex items-start gap-sm font-body-lg text-body-lg text-white/90 leading-relaxed m-0">
                    <span class="material-symbols-outlined text-white/70 text-[22px] mt-[2px] flex-shrink-0">payments</span>
                    <span>{line2}</span>
                </p>{ai_line_p}
            </div>
        </section>'''

        return f'''
        <section class="flex flex-col gap-xl">
            {summary_panel}
            {kpis_html}

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
                <div class="lg:col-span-7">
                    {self._render_scatter_card()}
                </div>
                <div class="lg:col-span-5">
                    <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
                        <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                            <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="summary_overall_rank" data-en="Full Ranking">전체 순위</h2>
                            {self.badge("CALC", "ranking")}
                        </div>
                        {self._render_summary_ranking()}
                    </div>
                </div>
            </div>

            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
                <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                    <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="summary_news_title" data-en="External News Scan">외부 이슈 스캔</h2>
                    {self.badge("NEWS")}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-md">{news_html}</div>
            </div>
        </section>'''

    def _build_scatter(self) -> tuple:
        """매력도 × IT 유사도 산점도(SVG)와 사분면 설명 박스를 빌드.
        IT/순위 탭과 요약 탭이 공유한다. (scatter_svg, scatter_legend) 반환."""
        qw = self.report.get("tabs", {}).get("quickwin", {}) or {}
        rows_for_scatter = qw.get("rows", [])
        scatter_points = []
        for r in rows_for_scatter:
            attr = r.get("attractiveness")
            it = r.get("it_similarity")
            if attr is None or it is None:
                continue
            cx = 40 + (attr / 100) * 360
            cy = 260 - (it / 100) * 240
            if r.get("is_baseline"):
                # 기준국: 흰 채움 + 진한 보라 테두리 + 별 마커 → 후보국과 명확히 구분
                point_svg = (
                    f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="9" fill="#FFFFFF" stroke="#3f6cb4" stroke-width="2.5"/>'
                    f'<text x="{cx:.1f}" y="{cy+4:.1f}" text-anchor="middle" font-size="13" fill="#3f6cb4" font-weight="bold">★</text>'
                )
                label_color = "#3f6cb4"
                # SVG <text>는 JS i18n 토글이 닿지 않으므로 언어중립 "(B)" 접미사 사용
                label_text = self.esc(r.get("country", "")) + " (B)"
            elif r.get("excluded"):
                point_svg = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="6" fill="#9aa0a8" opacity="0.6"/>'
                label_color = "#6B7280"
                label_text = self.esc(r.get("country", ""))
            else:
                # 후보국: 채도 높은 오렌지로 변경 (배경 녹색 사분면과도 변별)
                point_svg = f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="7" fill="#c0533f" stroke="#FFFFFF" stroke-width="1.5"/>'
                label_color = "#14171c"
                label_text = self.esc(r.get("country", ""))
            scatter_points.append(f'''
                {point_svg}
                <text x="{cx+12:.1f}" y="{cy+4:.1f}" font-size="11" fill="{label_color}" font-weight="600">{label_text}</text>''')
        # Grid lines + quadrant labels + highlight (위로 20px 이동)
        scatter_svg = f'''
        <svg viewBox="0 0 420 300" class="w-full">
            <rect x="40" y="20" width="360" height="240" fill="#f7f8fa" stroke="#e6e9ec"/>
            <rect x="220" y="20" width="180" height="120" fill="#e9f3ee" opacity="0.4"/>
            <line x1="220" y1="20" x2="220" y2="260" stroke="#e6e9ec" stroke-dasharray="3,3"/>
            <line x1="40" y1="140" x2="400" y2="140" stroke="#e6e9ec" stroke-dasharray="3,3"/>
            <!-- Quadrant labels (희미하게, 데이터 위가 아닌 배경) -->
            <text x="130" y="40" text-anchor="middle" font-size="10" fill="#9aa0a8" font-weight="600" data-i18n="it_quad_short" data-en="② {self.esc(LABELS["it_quad_short"]["en"])}">② {self.esc(LABELS["it_quad_short"]["ko"])}</text>
            <text x="130" y="54" text-anchor="middle" font-size="9" fill="#9aa0a8" data-i18n="quad_hint_q2" data-en="IT↑ · {self.esc(LABELS["summary_attr_label"]["en"])}↓">IT↑ · {self.esc(LABELS["summary_attr_label"]["ko"])}↓</text>
            <text x="310" y="40" text-anchor="middle" font-size="10" fill="#4f8a6d" font-weight="700" data-i18n="it_quad_optimal" data-en="① {self.esc(LABELS["it_quad_optimal"]["en"])}">① {self.esc(LABELS["it_quad_optimal"]["ko"])}</text>
            <text x="310" y="54" text-anchor="middle" font-size="9" fill="#4f8a6d" data-i18n="quad_hint_q1" data-en="IT↑ · {self.esc(LABELS["summary_attr_label"]["en"])}↑">IT↑ · {self.esc(LABELS["summary_attr_label"]["ko"])}↑</text>
            <text x="130" y="245" text-anchor="middle" font-size="10" fill="#9aa0a8" font-weight="600" data-i18n="it_quad_low" data-en="④ {self.esc(LABELS["it_quad_low"]["en"])}">④ {self.esc(LABELS["it_quad_low"]["ko"])}</text>
            <text x="130" y="258" text-anchor="middle" font-size="9" fill="#9aa0a8" data-i18n="quad_hint_q4" data-en="IT↓ · {self.esc(LABELS["summary_attr_label"]["en"])}↓">IT↓ · {self.esc(LABELS["summary_attr_label"]["ko"])}↓</text>
            <text x="310" y="245" text-anchor="middle" font-size="10" fill="#9aa0a8" font-weight="600" data-i18n="it_quad_midterm" data-en="③ {self.esc(LABELS["it_quad_midterm"]["en"])}">③ {self.esc(LABELS["it_quad_midterm"]["ko"])}</text>
            <text x="310" y="258" text-anchor="middle" font-size="9" fill="#9aa0a8" data-i18n="quad_hint_q3" data-en="IT↓ · {self.esc(LABELS["summary_attr_label"]["en"])}↑">IT↓ · {self.esc(LABELS["summary_attr_label"]["ko"])}↑</text>
            <!-- Axis labels -->
            <text x="220" y="285" text-anchor="middle" font-size="11" fill="#6b7280" data-i18n="it_scatter_axis_x" data-en="{self.esc(LABELS["it_scatter_axis_x"]["en"])}">{self.esc(LABELS["it_scatter_axis_x"]["ko"])}</text>
            <text x="20" y="140" text-anchor="middle" font-size="11" fill="#6b7280" transform="rotate(-90 20 140)" data-i18n="it_scatter_axis_y" data-en="{self.esc(LABELS["it_scatter_axis_y"]["en"])}">{self.esc(LABELS["it_scatter_axis_y"]["ko"])}</text>
            {"".join(scatter_points)}
        </svg>'''

        # 사분면 설명 박스
        scatter_legend = f'''
        <div class="mt-md p-sm bg-surface-light border border-surface-border rounded-md">
            <div class="grid grid-cols-2 gap-xs text-label-sm">
                <div class="flex items-start gap-xs">
                    <span class="font-bold" style="color:#4f8a6d">①</span>
                    {self.t_span("it_quad_q1_label")}
                </div>
                <div class="flex items-start gap-xs">
                    <span class="font-bold text-text-secondary">②</span>
                    {self.t_span("it_quad_q2_label")}
                </div>
                <div class="flex items-start gap-xs">
                    <span class="font-bold text-text-secondary">③</span>
                    {self.t_span("it_quad_q3_label")}
                </div>
                <div class="flex items-start gap-xs">
                    <span class="font-bold text-text-secondary">④</span>
                    {self.t_span("it_quad_q4_label")}
                </div>
            </div>
            <div class="mt-sm pt-xs border-t border-surface-border flex items-center gap-md text-label-sm text-text-secondary flex-wrap">
                <span class="flex items-center gap-xs"><span class="inline-block w-3 h-3 rounded-full border border-white" style="background:#c0533f"></span>{self.t_span("it_legend_candidate")}</span>
                <span class="flex items-center gap-xs"><span class="inline-block w-3 h-3 rounded-full bg-white border-2" style="border-color:#3f6cb4;font-size:8px;line-height:8px;text-align:center;color:#3f6cb4">★</span>{self.t_span("it_legend_baseline")}</span>
                <span class="flex items-center gap-xs"><span class="inline-block w-2 h-2 rounded-full opacity-60" style="background:#9aa0a8"></span>{self.t_span("it_legend_ks_excluded")}</span>
            </div>
        </div>'''
        return scatter_svg, scatter_legend

    def _render_scatter_card(self) -> str:
        """매력도 × IT 유사도 산점도를 표준 카드로 감싼다 (요약 탭에서 사용)."""
        scatter_svg, scatter_legend = self._build_scatter()
        return f'''
        <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
            <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="it_scatter_title" data-en="Attractiveness × IT Similarity">매력도 × IT 유사도</h2>
                {self.badge("CALC", {"ko": "2축", "en": "2-axis"})}
            </div>
            {scatter_svg}
            {scatter_legend}
        </div>'''

    def _render_podium(self, ranking: List[Dict]) -> str:
        """퀵윈 Top 3을 시상대(podium) 형태로 렌더 — 1위 중앙·최고단, 2위 좌, 3위 우.
        보고서 카드 톤(surface-container-lowest 카드 + Kinetic 블루 팔레트)을 그대로 따른다.
        순위는 단(pedestal) 높이 + primary 농담으로만 구분한다(별도 배경 패널·이모지 없음)."""
        if not ranking:
            return f'''
            <div>
                <h2 class="font-headline-md text-headline-md text-primary mb-md" data-i18n="summary_top3_title" data-en="Quickwin Ranking (Top 3)">퀵윈 순위 (Top 3)</h2>
                <div class="text-text-secondary">{self.t_span("summary_no_rank")}</div>
            </div>'''

        # rank → entry 매핑 (데이터가 rank 순이 아닐 수 있으니 명시적으로 정렬)
        by_rank = {e.get("rank"): e for e in ranking}
        # 시상대 배치: [2위(좌), 1위(중앙), 3위(우)] — 없으면 자리 비움
        layout = [2, 1, 3]

        # 단(段) 스타일 — 높이·강조 차등은 Kinetic 블루 팔레트 농담으로만 표현
        #   1위: primary(#3f6cb4) 최고단·강조 테두리, 2/3위: secondary~연한 톤 하강
        STEP = {
            1: {"pedestal_h": "h-20", "pad": "pt-0",
                "pedestal": "#3f6cb4", "border": "border-primary",
                "ring": "ring-1 ring-primary/30"},
            2: {"pedestal_h": "h-12", "pad": "pt-lg",
                "pedestal": "#3f6cb4", "border": "border-surface-border",
                "ring": ""},
            3: {"pedestal_h": "h-8", "pad": "pt-lg",
                "pedestal": "#6e97d6", "border": "border-surface-border",
                "ring": ""},
        }

        cols = []
        for rank in layout:
            entry = by_rank.get(rank)
            st = STEP[rank]
            if not entry:
                # 빈 자리 — 시상대 정렬 유지를 위해 placeholder 단만
                cols.append(f'''
                <div class="flex flex-col items-center justify-end {st["pad"]}">
                    <div class="w-full {st["pedestal_h"]} rounded-t-md opacity-20" style="background:{st["pedestal"]}"></div>
                </div>''')
                continue
            code = entry.get("country", "")
            ko = self.country_ko(code)
            band = entry.get("score_band")
            attr = entry.get("attractiveness")
            it = entry.get("it_similarity_band")
            color = self.score_color(band)
            cols.append(f'''
            <div class="flex flex-col items-center justify-end {st["pad"]}">
                <div class="w-full bg-surface-container-lowest border {st["border"]} {st["ring"]} rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] flex flex-col items-center text-center">
                    <div class="flex items-center gap-xs mb-xs">
                        <span class="font-label-sm text-label-sm font-bold uppercase tracking-wider text-primary">Rank #{self.esc(entry.get("rank"))}</span>
                        {self.badge("CALC")}
                    </div>
                    <img src="{self.country_flag_url(code)}" class="w-10 h-[26px] object-cover rounded-sm border border-surface-border my-xs" alt="">
                    <div class="font-headline-md text-headline-md text-primary leading-tight">{self.esc(ko)}</div>
                    <div class="text-text-secondary text-body-sm">{self.esc(self.country_en(code))}</div>
                    <div class="flex items-baseline gap-xs mt-sm">
                        <span class="text-4xl font-bold" style="color:{color}">{self.esc(band) if band is not None else "—"}</span>
                    </div>
                    <div class="mt-sm w-full grid grid-cols-2 gap-xs text-body-sm border-t border-surface-border pt-sm">
                        <div>{self.t_span("summary_attr_label", extra_class="text-text-secondary block text-[10px] uppercase tracking-wider")}<span class="font-semibold text-primary">{self.esc(attr) if attr is not None else "—"}</span></div>
                        <div>{self.t_span("summary_it_label", extra_class="text-text-secondary block text-[10px] uppercase tracking-wider")}<span class="font-semibold text-primary">{self.esc(it) if it is not None else "—"}</span></div>
                    </div>
                </div>
                <div class="w-full {st["pedestal_h"]} rounded-b-md flex items-center justify-center" style="background:{st["pedestal"]}">
                    <span class="font-bold text-white text-xl leading-none">{self.esc(entry.get("rank"))}</span>
                </div>
            </div>''')

        return f'''
        <div>
            <h2 class="font-headline-md text-headline-md text-primary mb-md" data-i18n="summary_top3_title" data-en="Quickwin Ranking (Top 3)">퀵윈 순위 (Top 3)</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-md items-end max-w-3xl mx-auto">{"".join(cols)}</div>
        </div>'''

    def _render_summary_ranking(self) -> str:
        """Full quickwin ranking for the summary tab — all candidate countries + baseline note."""
        tabs = self.report.get("tabs", {})
        qw = tabs.get("quickwin", {}) or {}
        ranking = qw.get("ranking", []) or []

        if not ranking:
            return f'<div class="text-text-secondary text-body-sm">{self.t_span("summary_no_rank")}</div>'

        rows = []
        for entry in ranking:
            rank = entry.get("rank")
            code = entry.get("country", "")
            band = entry.get("score_band")
            attr = entry.get("attractiveness")
            it = entry.get("it_similarity_band")
            color = self.score_color(band)
            rank_label = f"#{rank}"
            row_class = "bg-surface-light/40" if rank and rank <= 3 else ""
            rows.append(f'''
            <div class="grid grid-cols-12 items-center gap-xs py-md px-xs border-b border-surface-border last:border-b-0 {row_class}">
                <div class="col-span-1 text-center text-xl font-semibold">{rank_label}</div>
                <div class="col-span-6 flex items-center gap-sm">
                    <img src="{self.country_flag_url(code)}" class="w-6 h-[18px] object-cover rounded-sm shrink-0" alt="">
                    <span class="font-label-md text-body-lg text-primary truncate">{self.esc(self.country_ko(code))}</span>
                    <span class="text-label-md text-text-secondary truncate">{self.esc(self.country_en(code))}</span>
                </div>
                <div class="col-span-2 text-right">
                    <div class="text-primary font-medium text-body-md">{self.esc(attr) if attr is not None else "—"}</div>
                </div>
                <div class="col-span-1 text-right">
                    <div class="text-primary font-medium text-body-md">{self.esc(it) if it is not None else "—"}</div>
                </div>
                <div class="col-span-2 text-right">
                    <div class="text-3xl font-bold leading-none" style="color:{color}">{self.esc(band) if band is not None else "—"}</div>
                </div>
            </div>''')

        return f'''
        <div class="grid grid-cols-12 items-center gap-xs px-xs pb-sm border-b-2 border-surface-border text-label-md text-text-secondary uppercase tracking-wider">
            <div class="col-span-1 text-center">#</div>
            <div class="col-span-6">{self.t_span("tbl_country")}</div>
            <div class="col-span-2 text-right">{self.t_span("tbl_attractiveness")}</div>
            <div class="col-span-1 text-right">{self.t_span("tbl_it")}</div>
            <div class="col-span-2 text-right">{self.t_span("tbl_quickwin")}</div>
        </div>
        <div class="flex flex-col">{"".join(rows)}</div>'''

    # ------------------------- Tab 2-0 Killswitch ---------------------

    # tier별 색상(severity 기반): 확신=green, 외부솔루션=blue, JV권고=amber, JV필수=red
    _KS_TIER_STYLE = {
        "in_region_confidence": ("#e9f3ee", "#4f8a6d"),
        "external_solution":    ("#e6eef6", "#3a6ea5"),
        "jv_recommended":       ("#fbf0dd", "#9a6b1e"),
        "jv_required":          ("#f6e7e3", "#c0533f"),
    }

    def _ks_tier_pill(self, c: Dict) -> str:
        """국가 entry → 4단계 tier pill. 라벨은 JSON tier_label(SoT) 우선, 없으면 토큰 폴백."""
        tier = c.get("tier")
        bg, fg = self._KS_TIER_STYLE.get(tier, ("#eef0f2", "#3b3f46"))
        label = c.get("tier_label") or {}
        if label.get("ko") or label.get("en"):
            text = self.loc_span(label)
        else:
            text = self.t_span(f"ks_tier_{tier}") if tier else "—"
        return (f'<span class="px-2 py-[2px] rounded-md font-label-sm text-label-sm" '
                f'style="background:{bg};color:{fg}">{text}</span>')

    def _ks_summary_text(self, ks: Dict, passed: List, failed: List) -> Dict[str, str]:
        """섹션 요약: tier_summary가 있으면 4단계 분포, 없으면 통과/탈락 폴백."""
        tier_summary = ks.get("tier_summary") or []
        if tier_summary:
            ko = " · ".join(f'{(t.get("label") or {}).get("ko") or t.get("key")} {t.get("count", 0)}개국'
                            for t in tier_summary)
            en = " · ".join(f'{(t.get("label") or {}).get("en") or t.get("key")} {t.get("count", 0)}'
                            for t in tier_summary)
            return {
                "ko": f'진출 형태 분류 — {ko}. JV 필수국은 퀵윈 랭킹에서 제외, JV 권고국은 감점 후 포함.',
                "en": f'Entry-mode classification — {en}. JV-required countries are excluded from the quickwin ranking; JV-recommended are included with a penalty.',
            }
        return {
            "ko": f'통과 {len(passed)}개국 · 탈락 {len(failed)}개국. 탈락국({", ".join(failed) or "없음"})은 이후 스코어링에서 제외.',
            "en": f'{len(passed)} passed · {len(failed)} failed. Failed countries ({", ".join(failed) or "none"}) are excluded from subsequent scoring.',
        }

    def render_tab_killswitch(self) -> str:
        ks = self.report.get("tabs", {}).get("tab_2_0_killswitch", {}) or {}
        gates: List[str] = ks.get("gates", [])
        countries: List[Dict] = ks.get("countries", [])

        head_cells = "".join(
            f'<th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase whitespace-nowrap">{self.esc(g)}</th>'
            for g in gates
        )
        rows_html = []
        for c in countries:
            passed = c.get("pass")
            row_class = "" if passed else "bg-surface-light text-text-secondary"
            cells = []
            for g in gates:
                gate = (c.get("gates") or {}).get(g, {})
                status = (gate.get("status") or "UNKNOWN").upper()
                if status == "PASS":
                    pill = '<span class="px-2 py-[2px] bg-[#e9f3ee] text-[#4f8a6d] rounded-md font-label-sm text-label-sm">○ PASS</span>'
                elif status == "FLAG":
                    pill = f'<span class="px-2 py-[2px] bg-[#fbf0dd] text-[#9a6b1e] rounded-md font-label-sm text-label-sm">△ {self.t_span("ks_status_flag")}</span>'
                elif status == "FAIL":
                    pill = '<span class="px-2 py-[2px] bg-[#f6e7e3] text-[#c0533f] rounded-md font-label-sm text-label-sm">✕ FAIL</span>'
                else:
                    pill = '<span class="px-2 py-[2px] bg-surface-container text-text-secondary rounded-md font-label-sm text-label-sm">— UNK</span>'
                tip = self.esc(gate.get("value") or "")
                cells.append(f'<td class="py-sm px-sm" title="{tip}">{pill}</td>')
            country_pill = self._ks_tier_pill(c)
            rows_html.append(f'''
                <tr class="border-b border-surface-border {row_class}">
                    <td class="py-sm px-sm font-medium text-primary whitespace-nowrap">
                        <span class="inline-flex items-center gap-xs">
                            <img src="{self.country_flag_url(c.get("country",""))}" class="w-5 h-4 object-cover rounded-sm" alt="">
                            {self.esc(self.country_ko(c.get("country","")))} <span class="text-text-secondary">({self.esc(self.country_en(c.get("country","")))})</span>
                        </span>
                    </td>
                    {''.join(cells)}
                    <td class="py-sm px-sm">{country_pill}</td>
                </tr>''')
        rows = "\n".join(rows_html)

        passed = ks.get("passed", []) or []
        failed = ks.get("failed", []) or []

        # Per-country explanation accordions
        explain_cards = []
        for c in countries:
            code = c.get("country")
            country_passed = c.get("pass")
            badge_pill = self._ks_tier_pill(c)
            gate_rows = []
            for g in gates:
                gate = (c.get("gates") or {}).get(g, {})
                status = (gate.get("status") or "UNKNOWN").upper()
                status_color = {"PASS": "#4f8a6d", "FLAG": "#9a6b1e", "FAIL": "#c0533f"}.get(status, "#9aa0a8")
                icon = {"PASS": "○", "FLAG": "△", "FAIL": "✕"}.get(status, "—")
                source = self.esc(gate.get("source") or "—")
                tier = gate.get("tier")
                tier_pill = f'<span class="ml-xs px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#eef0f2;color:#3b3f46">Tier {tier}</span>' if tier else ""
                scope = self.esc(gate.get("gate_scope") or "")
                gate_rows.append(f'''
                <div class="border-b border-surface-border last:border-b-0 py-sm">
                    <div class="flex items-start gap-sm">
                        <span class="text-xl font-bold shrink-0" style="color:{status_color};width:24px;text-align:center">{icon}</span>
                        <div class="flex-1">
                            <div class="flex items-center gap-xs flex-wrap mb-xs">
                                <span class="font-label-md text-label-md text-primary">{self.esc(g)}</span>
                                {f'<span class="text-label-sm text-text-secondary">scope: {scope}</span>' if scope else ""}
                                {tier_pill}
                                {self.badge("EXT")}
                            </div>
                            <div class="text-body-sm text-on-surface-variant">{self.esc(gate.get("value") or "—")}</div>
                            <div class="text-label-sm text-text-secondary mt-xs">{self.t_span("ks_source_prefix")} {source}</div>
                        </div>
                    </div>
                </div>''')
            gates_block = "".join(gate_rows) or f'<div class="text-text-secondary text-body-sm py-sm">{self.t_span("no_gate_data")}</div>'

            # tier별 진출 권고 한줄 사유 (없으면 기존 PASS/FAIL 메시지 폴백)
            _tier_reason = {
                "in_region_confidence": {"ko": "전 게이트 PASS → 직접 진출", "en": "All gates PASS → direct entry"},
                "external_solution": {"ko": "데이터 현지화만 제약 → 외부솔루션으로 우회", "en": "Only data-localization flagged → use external solution"},
                "jv_recommended": {"ko": "송금·지분 제약 → JV 권고 (감점 후 랭킹 포함)", "en": "Remittance/ownership flagged → JV recommended (ranked with penalty)"},
                "jv_required": {"ko": "신용등급 등 제약 → JV 필수 (랭킹 제외)", "en": "Credit-rating etc. flagged → JV required (excluded from ranking)"},
            }
            reason = _tier_reason.get(c.get("tier"))
            if reason:
                summary_reason_span = self.loc_span(reason, extra_class="text-label-sm text-text-secondary ml-xs flex-1")
            else:
                summary_reason_span = (
                    self.t_span("ks_passed_msg", extra_class="text-label-sm text-text-secondary ml-xs flex-1")
                    if country_passed else
                    self.t_span("ks_failed_msg", extra_class="text-label-sm text-text-secondary ml-xs flex-1")
                )
            explain_cards.append(f'''
            <details class="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
                <summary class="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
                    <span class="material-symbols-outlined text-[20px] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
                    <img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm" alt="">
                    <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(code))} <span class="text-text-secondary font-normal">({self.esc(self.country_en(code))})</span></span>
                    {badge_pill}
                    {summary_reason_span}
                    {self.t_span("ks_view_evidence", extra_class="font-label-sm text-label-sm text-secondary")}
                </summary>
                <div class="px-md pb-md pt-xs">
                    {gates_block}
                </div>
            </details>''')
        explain_html = "\n".join(explain_cards)

        return f'''
        <section class="flex flex-col gap-lg">
            <div class="flex items-center gap-sm">
                <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="ks_matrix_title" data-en="Killswitch Matrix">킬스위치 매트릭스</h2>
                {self.badge("EXT")} {self.badge("CALC", "status_matrix")}
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant -mt-sm">
                {self.loc_span(self._ks_summary_text(ks, passed, failed))}
            </p>
            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b-2 border-surface-border">
                            <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_country")}</th>
                            {head_cells}
                            <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("ks_tier_col")}</th>
                        </tr>
                    </thead>
                    <tbody class="font-body-sm text-body-sm">{rows}</tbody>
                </table>
            </div>

            <div>
                <h3 class="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm" data-i18n="ks_explain_title" data-en="Per-Country Reasoning">국가별 판정 근거</h3>
                <div class="flex flex-col gap-sm">{explain_html}</div>
            </div>
        </section>'''

    # ------------------------- Tab 2-1 Attractiveness -----------------

    def render_tab_attractiveness(self) -> str:
        tab = self.report.get("tabs", {}).get("tab_2_1_attractiveness", {}) or {}
        countries = tab.get("countries", [])
        ranking = tab.get("ranking", [])
        weights = tab.get("weights", {}) or {}

        # Horizontal bar — ranking
        ranking_rows = []
        for r in ranking:
            score = r.get("score") or 0
            color = self.score_color(score)
            pct = max(0, min(100, score))
            ranking_rows.append(f'''
                <div class="grid grid-cols-12 items-center gap-sm">
                    <div class="col-span-3 flex items-center gap-xs">
                        <span class="font-label-sm text-label-sm text-text-secondary w-5 text-right">#{r.get("rank")}</span>
                        <img src="{self.country_flag_url(r.get("country",""))}" class="w-5 h-4 object-cover rounded-sm" alt="">
                        <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(r.get("country","")))}</span>
                        <span class="font-label-sm text-label-sm text-text-secondary">{self.esc(self.country_en(r.get("country","")))}</span>
                    </div>
                    <div class="col-span-7">
                        <div class="w-full h-4 bg-surface-container rounded-full overflow-hidden">
                            <div class="h-full rounded-full" style="width:{pct:.1f}%;background:{color}"></div>
                        </div>
                    </div>
                    <div class="col-span-2 text-right font-semibold text-primary">{self.esc(score)}</div>
                </div>''')
        bars_html = "\n".join(ranking_rows) or f'<div class="text-text-secondary">{self.t_span("attr_no_data")}</div>'

        # Stacked bar — contributions per country
        contrib_keys = list(weights.keys())
        palette = ["#3f6cb4", "#3f6cb4", "#6e97d6", "#8fa0bd", "#3f6cb4", "#c08a2e"]
        # Color map for contribution legend
        legend_html = "".join(f'''
            <div class="flex items-center gap-xs">
                <div class="w-3 h-3 rounded-sm" style="background:{palette[i % len(palette)]}"></div>
                <span class="text-label-sm text-text-secondary">{self.esc(k)}</span>
            </div>''' for i, k in enumerate(contrib_keys))

        stack_rows = []
        for c in countries:
            code = c.get("country")
            contribs = c.get("contributions", {}) or {}
            total = sum((v.get("contribution") or 0) for v in contribs.values())
            if total <= 0:
                segments = '<div class="h-full bg-surface-container w-full"></div>'
            else:
                seg_parts = []
                for i, k in enumerate(contrib_keys):
                    v = (contribs.get(k) or {}).get("contribution") or 0
                    pct = (v / total) * 100 if total else 0
                    color = palette[i % len(palette)]
                    seg_parts.append(
                        f'<div class="h-full" style="width:{pct:.1f}%;background:{color}" '
                        f'title="{self.esc(k)}: {v:.1f}"></div>'
                    )
                segments = "".join(seg_parts)
            stack_rows.append(f'''
                <div class="grid grid-cols-12 items-center gap-sm">
                    <div class="col-span-3 flex items-center gap-xs">
                        <img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm" alt="">
                        <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(code))}</span>
                    </div>
                    <div class="col-span-7">
                        <div class="w-full h-4 bg-surface-container rounded overflow-hidden flex">{segments}</div>
                    </div>
                    <div class="col-span-2 text-right text-text-secondary text-label-sm">{self.t_span("label_total")} {self.esc(c.get("attractiveness_score"))}</div>
                </div>''')
        stack_html = "\n".join(stack_rows) or f'<div class="text-text-secondary">{self.t_span("attr_no_data")}</div>'

        # Per-country derivation accordions
        explain_cards = []
        # Sort countries by attractiveness desc to match ranking order
        sorted_countries = sorted(
            countries,
            key=lambda c: (c.get("attractiveness_score") if c.get("attractiveness_score") is not None else -1),
            reverse=True,
        )
        for c in sorted_countries:
            code = c.get("country")
            score = c.get("attractiveness_score")
            score_color = self.score_color(score)
            contribs = c.get("contributions") or {}
            axis_rows = []
            for k, info in contribs.items():
                raw = info.get("raw_value")
                norm = info.get("normalized")
                wt = info.get("weight")
                tier = info.get("tier")
                tier_mult = info.get("tier_multiplier")
                eff_w = info.get("effective_weight")
                contribution = info.get("contribution")
                src_item = info.get("source_item")
                reverse = info.get("reverse")
                dir_pill = (
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#f6e7e3;color:#c0533f">{self.t_span("attr_dir_negative")}</span>'
                    if reverse else
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#e9f3ee;color:#4f8a6d">{self.t_span("attr_dir_positive")}</span>'
                )
                tier_pill = (
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#eef0f2;color:#3b3f46">Tier {tier} ×{tier_mult}</span>'
                    if tier is not None else
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#f6e7e3;color:#c0533f">{self.t_span("attr_tier_unknown")} ×1.0</span>'
                )
                norm_bar = ""
                if norm is not None:
                    pct = max(0, min(100, norm))
                    norm_bar = f'''
                    <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden mt-xs">
                        <div class="h-full rounded-full" style="width:{pct:.1f}%;background:{self.score_color(norm)}"></div>
                    </div>'''
                axis_rows.append(f'''
                <div class="border-b border-surface-border last:border-b-0 py-sm">
                    <div class="flex items-start justify-between gap-sm mb-xs">
                        <div class="flex-1">
                            <div class="flex items-center gap-xs flex-wrap">
                                <span class="font-label-md text-label-md text-primary">{self.esc(k)}</span>
                                {dir_pill}
                                {tier_pill}
                                {self.badge("EXT")}
                            </div>
                            <div class="text-label-sm text-text-secondary mt-xs">{self.t_span("label_source_item")} {self.esc(src_item)}</div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_contribution")}</div>
                            <div class="font-semibold text-primary">{self.esc(contribution) if contribution is not None else "—"}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-4 gap-sm text-body-sm">
                        <div>
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_raw_value")}</div>
                            <div class="text-primary font-medium">{self.esc(raw) if raw is not None else "—"}</div>
                        </div>
                        <div>
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_score_axis")}</div>
                            <div class="text-primary font-medium">{self.esc(norm) if norm is not None else "—"}</div>
                            {norm_bar}
                        </div>
                        <div>
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_eff_weight")}</div>
                            <div class="text-primary font-medium">{self.esc(wt)} × {self.esc(tier_mult)} = <strong>{self.esc(eff_w) if eff_w is not None else "—"}</strong></div>
                        </div>
                        <div>
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_contrib_eq")}</div>
                            <div class="text-primary font-medium">{self.esc(norm) if norm is not None else "—"} × {self.esc(eff_w) if eff_w is not None else "—"} = <strong>{self.esc(contribution) if contribution is not None else "—"}</strong></div>
                        </div>
                    </div>
                </div>''')
            axes_block = "".join(axis_rows) or f'<div class="text-text-secondary text-body-sm py-sm">{self.t_span("no_contrib_data")}</div>'

            explain_cards.append(f'''
            <details class="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
                <summary class="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
                    <span class="material-symbols-outlined text-[20px] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
                    <img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm" alt="">
                    <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(code))} <span class="text-text-secondary font-normal">({self.esc(self.country_en(code))})</span></span>
                    <span class="text-2xl font-bold ml-xs" style="color:{score_color}">{self.esc(score) if score is not None else "—"}</span>
                    <span class="text-label-sm text-text-secondary flex-1" data-i18n="attr_formula_subtitle" data-en="/100 — sum of normalized × effective weights">/100 — 항목별 정규화×가중치 합산</span>
                    {self.t_span("attr_view_formula", extra_class="font-label-sm text-label-sm text-secondary")}
                </summary>
                <div class="px-md pb-md pt-xs">
                    <div class="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant" data-i18n="attr_formula_help" data-en="{self.esc(LABELS["attr_formula_help"]["en"])}">{self.esc(LABELS["attr_formula_help"]["ko"])}</div>
                    {axes_block}
                </div>
            </details>''')
        explain_html = "\n".join(explain_cards)

        return f'''
        <section class="flex flex-col gap-xl">
            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
                <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                    <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="attr_ranking_title" data-en="Business Attractiveness Ranking">비즈니스 매력도 순위</h2>
                    {self.badge("CALC", "ranking · 0~100")}
                </div>
                <div class="flex flex-col gap-sm">{bars_html}</div>
            </div>

            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
                <div class="flex items-center justify-between mb-md border-b border-surface-border pb-sm">
                    <div class="flex items-center gap-sm">
                        <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="attr_contrib_title" data-en="Item Contributions">항목 기여분</h2>
                        {self.badge("CALC", "composition")}
                    </div>
                    <div class="flex flex-wrap gap-md">{legend_html}</div>
                </div>
                <div class="flex flex-col gap-sm">{stack_html}</div>
                <p class="mt-md text-label-sm text-text-secondary">
                    {self.t_span("attr_weights_note")}: {", ".join(f"{self.esc(k)} {self.esc(v)}" for k,v in weights.items())}
                </p>
            </div>

            <div>
                <h3 class="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm" data-i18n="attr_country_formula" data-en="Per-Country Score Formula">국가별 점수 산식</h3>
                <div class="flex flex-col gap-sm">{explain_html}</div>
            </div>
        </section>'''

    # ------------------------- Tab 2-2 IT/Quickwin --------------------

    def render_tab_it_quickwin(self) -> str:
        tabs = self.report.get("tabs", {})
        it_tab = tabs.get("tab_2_2_it_similarity", {}) or {}
        qw = tabs.get("quickwin", {}) or {}
        top3 = tabs.get("top3_country_cards", []) or []

        baseline = it_tab.get("baseline_country", "")
        countries = it_tab.get("countries", [])
        axes_order = list((it_tab.get("weights") or {}).keys())

        # Sort by total band desc, baseline pinned to bottom (reference only)
        sorted_countries = sorted(
            countries,
            key=lambda c: (
                0 if c.get("is_baseline") else 1,                          # baseline last
                -(c.get("it_similarity_band") or 0),
                -(c.get("it_similarity_raw") or 0),
            ),
        )
        # Move baseline to bottom: above puts baseline first (0 < 1), so flip
        sorted_countries = sorted(
            countries,
            key=lambda c: (
                1 if c.get("is_baseline") else 0,
                -(c.get("it_similarity_band") or 0),
                -(c.get("it_similarity_raw") or 0),
            ),
        )

        def cell_style(band: Optional[float]) -> tuple:
            """Return (bg, fg) — opacity-scaled mono palette for cleaner look."""
            if band is None:
                return ("#F3F4F6", "#9aa0a8")
            if band >= 90:
                return ("#2f5c46", "#FFFFFF")
            if band >= 80:
                return ("#4f8a6d", "#FFFFFF")
            if band >= 70:
                return ("#6fa98c", "#FFFFFF")
            if band >= 60:
                return ("#c7e2d3", "#2f5c46")
            if band >= 50:
                return ("#fbf3e2", "#8a6a1e")
            if band >= 40:
                return ("#c08a2e", "#FFFFFF")
            return ("#c0533f", "#FFFFFF")

        # Column header — axes
        col_count = len(axes_order)
        # Country column + axes columns + total column
        # Use CSS grid for crisp alignment, no table borders
        grid_template = f"minmax(180px, 1.4fr) repeat({col_count}, minmax(80px, 1fr)) minmax(72px, 0.9fr)"

        header_cells = [f'<div class="px-sm py-xs text-label-sm text-text-secondary uppercase tracking-wider">{self.t_span("tbl_country")}</div>']
        for a in axes_order:
            header_cells.append(
                f'<div class="px-xs py-xs text-label-sm text-text-secondary text-center whitespace-normal leading-tight">{self.esc(a)}</div>'
            )
        header_cells.append(f'<div class="px-xs py-xs text-label-sm text-text-secondary text-center uppercase tracking-wider">{self.t_span("tbl_overall")}</div>')
        header_row = (
            f'<div class="grid items-end gap-[2px] mb-xs" style="grid-template-columns:{grid_template}">'
            + "".join(header_cells)
            + '</div>'
        )

        body_rows = []
        for c in sorted_countries:
            code = c.get("country")
            is_base = c.get("is_baseline")
            tot = c.get("it_similarity_band")
            tot_raw = c.get("it_similarity_raw")
            country_cell = (
                f'<div class="px-sm py-sm flex items-center gap-xs {"opacity-70" if is_base else ""}">'
                f'<img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm shrink-0" alt="">'
                f'<span class="font-label-md text-label-md text-primary truncate">{self.esc(self.country_ko(code))}</span>'
                f'<span class="text-label-sm text-text-secondary truncate">{self.esc(self.country_en(code))}</span>'
                + (f'<span class="text-[10px] font-semibold ml-xs px-[6px] py-[1px] rounded-full" style="background:#eaf0f8;color:#3f6cb4">{self.t_span("it_baseline_pill")}</span>' if is_base else '')
                + '</div>'
            )
            cells = [country_cell]
            for a in axes_order:
                axis = (c.get("axes") or {}).get(a) or {}
                band = axis.get("score_band")
                raw = axis.get("score_raw")
                tv = axis.get("target_value")
                bg, fg = cell_style(band)
                label = "—" if band is None else str(band)
                tip = self.esc(f"{a}: {tv} (raw {raw})" if tv is not None else f"{a} (raw {raw})")
                cells.append(
                    f'<div class="m-[2px] rounded-md flex items-center justify-center font-semibold py-sm text-body-sm transition-transform hover:scale-105" '
                    f'style="background:{bg};color:{fg};min-height:42px" title="{tip}">{label}</div>'
                )
            tot_bg, tot_fg = cell_style(tot)
            cells.append(
                f'<div class="m-[2px] rounded-md flex items-center justify-center font-bold py-sm text-body-md" '
                f'style="background:{tot_bg};color:{tot_fg};min-height:42px" title="raw {tot_raw}">{self.esc(tot) if tot is not None else "—"}</div>'
            )
            row_classes = "rounded-md hover:bg-surface-light transition-colors"
            if is_base:
                row_classes += " bg-surface-light/60 border-t-2 border-dashed border-surface-border mt-xs pt-xs"
            body_rows.append(
                f'<div class="grid items-stretch {row_classes}" style="grid-template-columns:{grid_template}">'
                + "".join(cells)
                + '</div>'
            )

        # Legend — gradient bar
        legend_steps = [
            ("≥90", "#2f5c46", "#FFFFFF"),
            ("80", "#4f8a6d", "#FFFFFF"),
            ("70", "#6fa98c", "#FFFFFF"),
            ("60", "#c7e2d3", "#2f5c46"),
            ("50", "#fbf3e2", "#8a6a1e"),
            ("40", "#c08a2e", "#FFFFFF"),
            ("<40", "#c0533f", "#FFFFFF"),
        ]
        legend_html = (
            '<div class="flex items-center gap-xs flex-wrap">'
            f'{self.t_span("it_band_legend", extra_class="text-label-sm text-text-secondary mr-xs")}'
            + "".join(
                f'<div class="rounded px-2 py-[2px] text-label-sm font-semibold" style="background:{bg};color:{fg}">{label}</div>'
                for label, bg, fg in legend_steps
            )
            + '</div>'
        )

        heatmap_block = (
            f'<div class="overflow-x-auto">'
            f'<div class="min-w-[640px]">{header_row}'
            + "".join(body_rows)
            + '</div></div>'
        )

        # Quickwin ranking
        qw_rows = []
        for r in qw.get("ranking", []):
            qw_rows.append(f'''
                <tr class="border-b border-surface-border">
                    <td class="py-sm px-sm font-medium text-primary">#{r.get("rank")}</td>
                    <td class="py-sm px-sm">
                        <span class="inline-flex items-center gap-xs">
                            <img src="{self.country_flag_url(r.get("country"))}" class="w-5 h-4 object-cover rounded-sm" alt="">
                            {self.esc(self.country_ko(r.get("country")))} <span class="text-text-secondary">({self.esc(self.country_en(r.get("country","")))})</span>
                        </span>
                    </td>
                    <td class="py-sm px-sm font-semibold" style="color:{self.score_color(r.get("score_band"))}">{self.esc(r.get("score_band"))}</td>
                    <td class="py-sm px-sm text-text-secondary">{self.esc(r.get("attractiveness"))}</td>
                    <td class="py-sm px-sm text-text-secondary">{self.esc(r.get("it_similarity_band"))}</td>
                </tr>''')
        qw_html = "\n".join(qw_rows) or f'<tr><td colspan="5" class="text-text-secondary py-md">{self.t_span("common_no_data")}</td></tr>'

        # Scatter (attractiveness × IT similarity) — 요약 탭과 공유하는 헬퍼로 빌드
        scatter_svg, scatter_legend = self._build_scatter()

        # Top 3 cards
        cards_html_parts = []
        for i, card in enumerate(top3):
            code = card.get("country", "")
            mb = card.get("market_brief") or {}
            cb = card.get("competition_brief") or {}
            news = card.get("top_news") or {}
            ks_pass = card.get("killswitch_pass")
            ks_pill = (
                f'<span class="px-2 py-[2px] bg-[#e9f3ee] text-[#4f8a6d] rounded-md font-label-sm text-label-sm">{self.t_span("ks_status_pass")}</span>'
                if ks_pass else
                f'<span class="px-2 py-[2px] bg-[#f6e7e3] text-[#c0533f] rounded-md font-label-sm text-label-sm">{self.t_span("ks_status_fail")}</span>'
            )

            def line(label_html: str, val: Any, flag: str) -> str:
                # label_html은 개발자 제공 t_span() HTML (사용자 데이터 아님 → esc 안 함)
                if val is None or val == "" or val == "—":
                    return ""
                txt = val if isinstance(val, (int, float, str)) else json.dumps(val, ensure_ascii=False)
                return (
                    f'<div class="flex items-start gap-xs py-xs border-b border-surface-border min-w-0">'
                    f'<span class="font-label-sm text-label-sm text-text-secondary w-20 shrink-0 mt-xs">{label_html}</span>'
                    f'<span class="flex-1 min-w-0 text-body-sm text-on-surface-variant break-words whitespace-normal" style="word-break:break-word;overflow-wrap:anywhere">{self.esc(txt)}</span>'
                    f'<span class="shrink-0 mt-xs">{self.badge(flag)}</span>'
                    f'</div>'
                )

            def entry_form_block(label_html: str, val: Any, flag: str) -> str:
                """경쟁사 진출 형태 — '타입(회사·회사) + 타입(회사) + ... . 후기' 구조를
                카테고리 헤더 + pill 형태로 분해해 가독성 향상."""
                if not isinstance(val, str) or not val.strip():
                    return ""
                import re
                # Split into category groups + trailing note
                # Step 1: separate trailing sentence (after last '. ' that follows a closing paren)
                trailing = ""
                main = val.strip()
                m = re.search(r"\)\s*\.\s*([^.]+)\.?\s*$", main)
                if m:
                    trailing = m.group(1).strip()
                    main = main[:m.start() + 1]  # keep closing paren

                # Step 2: split by ' + '
                groups_html = []
                for part in re.split(r"\s*\+\s*", main):
                    part = part.strip().rstrip(".").strip()
                    if not part:
                        continue
                    # type(companies) → header + companies
                    g = re.match(r"^([^()]+?)\s*\(([^()]+)\)\s*$", part)
                    if g:
                        type_name = g.group(1).strip()
                        companies = [c.strip() for c in re.split(r"[·,]", g.group(2)) if c.strip()]
                        pills = "".join(
                            f'<span class="inline-block px-2 py-[1px] bg-surface-container text-on-surface-variant rounded-full text-[11px] m-[2px]">{self.esc(c)}</span>'
                            for c in companies
                        )
                        groups_html.append(
                            f'<div class="mb-xs">'
                            f'<div class="font-label-sm text-label-sm text-primary mb-[2px]">{self.esc(type_name)}</div>'
                            f'<div class="flex flex-wrap -m-[2px]">{pills}</div>'
                            f'</div>'
                        )
                    else:
                        # 괄호 없는 항목은 그대로 텍스트로
                        groups_html.append(
                            f'<div class="text-body-sm text-on-surface-variant mb-xs">{self.esc(part)}</div>'
                        )

                trailing_html = (
                    f'<div class="text-label-sm text-text-secondary mt-xs pt-xs border-t border-surface-border italic">{self.esc(trailing)}</div>'
                    if trailing else ""
                )

                return (
                    f'<div class="py-xs border-b border-surface-border min-w-0">'
                    f'<div class="flex items-center gap-xs mb-xs">'
                    f'<span class="font-label-sm text-label-sm text-text-secondary">{label_html}</span>'
                    f'{self.badge(flag)}'
                    f'</div>'
                    f'{"".join(groups_html)}'
                    f'{trailing_html}'
                    f'</div>'
                )

            news_block = ""
            if isinstance(news, dict) and news.get("headline"):
                news_block = (
                    f'<div class="mt-sm bg-surface-light border border-surface-border rounded-md p-sm">'
                    f'<div class="flex items-center justify-between mb-xs">'
                    f'{self.t_span("it_news_keyword", extra_class="font-label-sm text-label-sm text-text-secondary uppercase")}'
                    f'{self.badge("NEWS", self.esc(news.get("date") or ""))}'
                    f'</div>'
                    f'<div class="font-label-md text-label-md text-primary mb-xs">{self.bi_span(news.get("headline"), news.get("headline_en"))}</div>'
                    f'<div class="text-body-sm text-on-surface-variant">{self.bi_span(news.get("so_what"), news.get("so_what_en"))}</div>'
                    f'<div class="text-label-sm text-text-secondary mt-xs">{self.esc(news.get("publisher") or "")}</div>'
                    f'</div>'
                )

            ai_comment = card.get("ai_comment") or ""
            ai_block = ""
            if ai_comment:
                ai_block = (
                    f'<div class="mt-sm bg-[#eaf0f8]/40 border border-[#eaf0f8] rounded-md p-sm">'
                    f'<div class="flex items-center gap-xs mb-xs">'
                    f'<span class="material-symbols-outlined text-[16px]" style="color:#3f6cb4">psychology</span>'
                    f'{self.t_span("it_ai_comment", extra_class="font-label-sm text-label-sm uppercase tracking-wider")}'
                    f'{self.badge("AI")}'
                    f'</div>'
                    f'<div class="text-body-sm text-on-surface-variant">{self.esc(ai_comment)}</div>'
                    f'</div>'
                )

            cards_html_parts.append(f'''
            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)] flex flex-col min-w-0 overflow-hidden">
                <div class="flex items-center justify-between mb-sm">
                    <div class="flex items-center gap-sm">
                        <span class="text-2xl font-bold text-primary">#{self.esc(card.get("rank"))}</span>
                        <div>
                            <div class="font-label-sm text-label-sm text-text-secondary uppercase">Rank #{card.get("rank")}</div>
                            <div class="flex items-center gap-xs mt-[2px]">
                                <img src="{self.country_flag_url(code)}" class="w-6 h-4 object-cover rounded-sm" alt="">
                                <h3 class="font-headline-md text-headline-md text-primary m-0">{self.esc(self.country_ko(code))}</h3>
                                <span class="text-text-secondary">({self.esc(self.country_en(code))})</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        {self.t_span("tbl_quickwin", extra_class="font-label-sm text-label-sm text-text-secondary uppercase")}
                        <div class="text-2xl font-bold" style="color:{self.score_color(card.get("quickwin_score_band"))}">{self.esc(card.get("quickwin_score_band"))}</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-xs mb-sm">
                    <div class="bg-surface-light rounded-md p-xs text-center">
                        {self.t_span("summary_attr_label", extra_class="font-label-sm text-label-sm text-text-secondary")}
                        <div class="font-semibold text-primary">{self.esc(card.get("attractiveness"))}</div>
                    </div>
                    <div class="bg-surface-light rounded-md p-xs text-center">
                        {self.t_span("summary_it_label", extra_class="font-label-sm text-label-sm text-text-secondary")}
                        <div class="font-semibold text-primary">{self.esc(card.get("it_similarity_band"))}</div>
                    </div>
                </div>

                <div class="flex items-center justify-between text-body-sm mb-xs">
                    {self.t_span("it_ks_status", extra_class="text-text-secondary")}
                    {ks_pill}
                </div>

                <div class="flex flex-col">
                    {line(self.t_span("market_new_car_sales"), (mb.get("신차_판매대수")), "EXT")}
                    {line(self.t_span("market_finance_usage"), f"{mb.get('금융_이용률_신차')}%" if mb.get("금융_이용률_신차") is not None else None, "EXT")}
                    {line(self.t_span("market_ev_adoption"), f"{mb.get('EV_보급률')}%" if mb.get("EV_보급률") is not None else None, "EXT")}
                    {entry_form_block(self.t_span("market_competitor_entry"), cb.get("경쟁사_진출_형태"), "EXT")}
                </div>

                {news_block}
                {ai_block}
            </div>''')
        cards_html = "\n".join(cards_html_parts) or f'<div class="text-text-secondary">{self.t_span("no_top3")}</div>'

        # Per-country IT similarity accordions
        it_explain_cards = []
        sorted_it = sorted(
            countries,
            key=lambda c: (c.get("it_similarity_band") if c.get("it_similarity_band") is not None else -1),
            reverse=True,
        )
        for c in sorted_it:
            code = c.get("country")
            total = c.get("it_similarity_band")
            raw_total = c.get("it_similarity_raw")
            is_base = c.get("is_baseline")
            total_color = self.score_color(total)
            axis_rows = []
            for axis_key, axis_info in (c.get("axes") or {}).items():
                src_item = axis_info.get("source_item")
                wt = axis_info.get("weight")
                tier = axis_info.get("tier")
                tier_mult = axis_info.get("tier_multiplier")
                eff_w = axis_info.get("effective_weight")
                band = axis_info.get("score_band")
                raw = axis_info.get("score_raw")
                bv = axis_info.get("baseline_value")
                tv = axis_info.get("target_value")
                # Derivation explanation (양 언어 dict → loc_span 으로 토글)
                _rawtxt = raw if raw is not None else '—'
                if isinstance(bv, (int, float)) and isinstance(tv, (int, float)):
                    diff = abs(bv - tv)
                    derive = {
                        "ko": f"수치 차이 |{bv} − {tv}| = {diff} → 100 − {diff}×20 = {_rawtxt}",
                        "en": f"Numeric gap |{bv} − {tv}| = {diff} → 100 − {diff}×20 = {_rawtxt}",
                    }
                elif bv == tv and bv is not None:
                    derive = dict(LABELS["fx_text_exact"])
                elif bv is None or tv is None:
                    derive = dict(LABELS["fx_missing_value"])
                else:
                    derive = {
                        "ko": f"텍스트 토큰 Jaccard 유사도 기반 → 30 + 유사도×65 = {_rawtxt} (또는 gate 동일=90 / 한쪽 PASS=50)",
                        "en": f"Text-token Jaccard similarity → 30 + J×65 = {_rawtxt} (or gate same=90 / one PASS=50)",
                    }
                tier_pill = (
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#eef0f2;color:#3b3f46">Tier {tier} ×{tier_mult}</span>'
                    if tier is not None else
                    f'<span class="px-[6px] py-[1px] rounded text-[10px] font-semibold" style="background:#f6e7e3;color:#c0533f">{self.t_span("attr_tier_unknown")} ×1.0</span>'
                )
                axis_rows.append(f'''
                <div class="border-b border-surface-border last:border-b-0 py-sm">
                    <div class="flex items-start justify-between gap-sm mb-xs">
                        <div class="flex-1">
                            <div class="flex items-center gap-xs flex-wrap">
                                <span class="font-label-md text-label-md text-primary">{self.esc(axis_key)}</span>
                                {tier_pill}
                                {self.badge("EXT")}
                            </div>
                            <div class="text-label-sm text-text-secondary mt-xs">{self.t_span("label_source_item")} {self.esc(src_item)}</div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-label-sm text-text-secondary">{self.t_span("attr_eff_weight")}</div>
                            <div class="font-semibold text-primary">{self.esc(wt)} × {self.esc(tier_mult)} = <strong>{self.esc(eff_w) if eff_w is not None else "—"}</strong></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-sm text-body-sm">
                        <div class="bg-surface-light rounded p-xs">
                            <div class="text-label-sm text-text-secondary mb-xs"><span data-i18n="header_baseline" data-en="Baseline">기준국</span> {self.esc(self.country_en(baseline))}</div>
                            <div class="text-primary">{self.esc(bv) if bv is not None else "—"}</div>
                        </div>
                        <div class="bg-surface-light rounded p-xs">
                            <div class="text-label-sm text-text-secondary mb-xs"><span data-i18n="it_target_country" data-en="Target">대상국</span> {self.esc(self.country_en(code))}</div>
                            <div class="text-primary">{self.esc(tv) if tv is not None else "—"}</div>
                        </div>
                        <div class="rounded p-xs" style="background:rgba(63,108,180,0.06)">
                            {self.t_span("it_band_score", extra_class="text-label-sm text-text-secondary mb-xs")}
                            <div class="font-bold" style="color:{self.score_color(band)}">{self.esc(band) if band is not None else "—"} <span class="text-label-sm text-text-secondary font-normal">(raw {self.esc(raw)})</span></div>
                        </div>
                    </div>
                    <div class="text-label-sm text-text-secondary mt-xs">{self.loc_span(derive)}</div>
                </div>''')
            axes_block = "".join(axis_rows) or f'<div class="text-text-secondary text-body-sm py-sm">{self.t_span("no_axis_data")}</div>'

            base_label = f" {self.t_span('it_baseline_pill', extra_class='text-label-sm text-secondary')}" if is_base else ""
            it_explain_cards.append(f'''
            <details class="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
                <summary class="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
                    <span class="material-symbols-outlined text-[20px] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
                    <img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm" alt="">
                    <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(code))} <span class="text-text-secondary font-normal">({self.esc(self.country_en(code))})</span>{base_label}</span>
                    <span class="text-2xl font-bold ml-xs" style="color:{total_color}">{self.esc(total) if total is not None else "—"}</span>
                    <span class="text-label-sm text-text-secondary flex-1">/100 (raw {self.esc(raw_total)})</span>
                    {self.t_span("attr_view_formula", extra_class="font-label-sm text-label-sm text-secondary")}
                </summary>
                <div class="px-md pb-md pt-xs">
                    <div class="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant" data-i18n="it_formula_help" data-en="{self.esc(LABELS["it_formula_help"]["en"])}">{self.esc(LABELS["it_formula_help"]["ko"])}</div>
                    {axes_block}
                </div>
            </details>''')
        it_explain_html = "\n".join(it_explain_cards)

        # Quickwin per-country derivation accordions
        qw_explain_cards = []
        for r in qw.get("rows", []):
            code = r.get("country")
            attr = r.get("attractiveness")
            it_raw = r.get("it_similarity")
            it_band = r.get("it_similarity_band")
            qw_raw = r.get("quickwin_raw")
            qw_band = r.get("quickwin_band")
            excluded = r.get("excluded", r.get("killswitch_excluded"))
            is_baseline = r.get("is_baseline")
            exclusion_reason = r.get("exclusion_reason")
            w_biz = (qw.get("weights") or {}).get("w_biz", 0.6)
            w_it = (qw.get("weights") or {}).get("w_it", 0.4)
            if is_baseline:
                status_pill = f'<span class="px-2 py-[2px] bg-[#eaf0f8] text-[#3f6cb4] rounded-md font-label-sm text-label-sm">{self.t_span("it_qw_baseline_excluded")}</span>'
            elif excluded:
                status_pill = f'<span class="px-2 py-[2px] bg-[#f6e7e3] text-[#c0533f] rounded-md font-label-sm text-label-sm">{self.t_span("it_qw_ks_excluded")}</span>'
            else:
                status_pill = f'<span class="px-2 py-[2px] bg-[#e9f3ee] text-[#4f8a6d] rounded-md font-label-sm text-label-sm">{self.t_span("it_qw_eligible")}</span>'
            if attr is not None and it_raw is not None:
                _qw_calc = (
                    f"{attr} × {w_biz} + {it_raw} × {w_it} = "
                    f"{round(attr*w_biz, 2)} + {round(it_raw*w_it, 2)} = {qw_raw}"
                )
                derive = {
                    "ko": f"{_qw_calc} → 10점 구간 {qw_band}",
                    "en": f"{_qw_calc} → 10-pt bucket {qw_band}",
                }
            else:
                derive = dict(LABELS["fx_qw_missing"])
            qw_explain_cards.append(f'''
            <details class="bg-surface-container-lowest border border-surface-border rounded-lg shadow-[0_2px_4px_rgba(20,23,28,0.04)] group">
                <summary class="cursor-pointer list-none px-md py-sm flex items-center gap-sm hover:bg-surface-light rounded-lg">
                    <span class="material-symbols-outlined text-[20px] text-text-secondary transition-transform group-open:rotate-90">chevron_right</span>
                    <img src="{self.country_flag_url(code)}" class="w-5 h-4 object-cover rounded-sm" alt="">
                    <span class="font-label-md text-label-md text-primary">{self.esc(self.country_ko(code))} <span class="text-text-secondary font-normal">({self.esc(self.country_en(code))})</span></span>
                    <span class="text-2xl font-bold ml-xs" style="color:{self.score_color(qw_band)}">{self.esc(qw_band) if qw_band is not None else "—"}</span>
                    {self.t_span("it_quickwin_band", extra_class="text-label-sm text-text-secondary flex-1")}
                    {status_pill}
                </summary>
                <div class="px-md pb-md pt-xs">
                    <div class="bg-surface-light border border-surface-border rounded-md p-sm mb-sm font-body-sm text-on-surface-variant" data-i18n="it_qw_formula_help" data-en="{self.esc(LABELS["it_qw_formula_help"]["en"])}">{self.esc(LABELS["it_qw_formula_help"]["ko"])}</div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-sm text-body-sm">
                        <div class="bg-surface-light rounded p-sm">
                            {self.t_span("summary_attr_label", extra_class="text-label-sm text-text-secondary mb-xs")}
                            <div class="text-2xl font-bold text-primary">{self.esc(attr) if attr is not None else "—"}</div>
                            <div class="text-label-sm text-text-secondary mt-xs">× {w_biz}</div>
                        </div>
                        <div class="bg-surface-light rounded p-sm">
                            {self.t_span("summary_it_label", extra_class="text-label-sm text-text-secondary mb-xs")}
                            <div class="text-2xl font-bold text-primary">{self.esc(it_raw) if it_raw is not None else "—"}</div>
                            <div class="text-label-sm text-text-secondary mt-xs">× {w_it}</div>
                        </div>
                        <div class="rounded p-sm" style="background:rgba(63,108,180,0.06)">
                            {self.t_span("it_sum_to_band", extra_class="text-label-sm text-text-secondary mb-xs")}
                            <div class="text-2xl font-bold" style="color:{self.score_color(qw_band)}">{self.esc(qw_band) if qw_band is not None else "—"}</div>
                            <div class="text-label-sm text-text-secondary mt-xs">raw {self.esc(qw_raw) if qw_raw is not None else "—"}</div>
                        </div>
                    </div>
                    <div class="text-label-sm text-text-secondary mt-sm">{self.t_span("label_formula_expand")} {self.loc_span(derive)}</div>
                </div>
            </details>''')
        qw_explain_html = "\n".join(qw_explain_cards)

        return f'''
        <section class="flex flex-col gap-xl">
            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
                <div class="flex items-center justify-between gap-sm mb-md border-b border-surface-border pb-sm flex-wrap">
                    <div class="flex items-center gap-sm">
                        <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="it_heatmap_title" data-en="IT Similarity Heatmap">IT 유사도 히트맵</h2>
                        <span class="text-label-sm text-text-secondary"><span data-i18n="it_vs_baseline" data-en="vs Baseline">vs 기준국</span> {self.esc(self.country_en(baseline))}</span>
                        {self.badge("CALC", {"ko": "10점 구간", "en": "10-pt bucket"})}
                    </div>
                    {legend_html}
                </div>
                {heatmap_block}
                <p class="mt-md text-label-sm text-text-secondary" data-i18n="it_sort_note" data-en="{self.esc(LABELS["it_sort_note"]["en"])}">{self.esc(LABELS["it_sort_note"]["ko"])}</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
                <div class="lg:col-span-7">
                    <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
                        <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                            <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="it_quickwin_title" data-en="Quickwin Final Ranking">퀵윈 종합 순위</h2>
                            {self.badge("CALC")}
                        </div>
                        <table class="w-full text-left border-collapse">
                            <thead><tr class="border-b-2 border-surface-border">
                                <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_rank")}</th>
                                <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_country")}</th>
                                <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_quickwin")}</th>
                                <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_attractiveness")}</th>
                                <th class="py-sm px-sm font-label-md text-label-md text-text-secondary uppercase">{self.t_span("tbl_it")}</th>
                            </tr></thead>
                            <tbody class="font-body-sm">{qw_html}</tbody>
                        </table>
                        <p class="mt-sm text-label-sm text-text-secondary">{self.loc_span(qw.get("note") or "")}</p>
                    </div>
                </div>
                <div class="lg:col-span-5">
                    <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-lg shadow-[0_4px_8px_rgba(20,23,28,0.04)] h-full">
                        <div class="flex items-center gap-sm mb-md border-b border-surface-border pb-sm">
                            <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="it_scatter_title" data-en="Attractiveness × IT Similarity">매력도 × IT 유사도</h2>
                            {self.badge("CALC", {"ko": "2축", "en": "2-axis"})}
                        </div>
                        {scatter_svg}
                        {scatter_legend}
                    </div>
                </div>
            </div>

            <div>
                <div class="flex items-center gap-sm mb-md">
                    <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="it_top3_title" data-en="Top-3 Country Profiles">상위 3개국 프로파일</h2>
                    {self.badge("CALC")} {self.badge("EXT")} {self.badge("NEWS")} {self.badge("AI")}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-md">{cards_html}</div>
            </div>

            <div>
                <h3 class="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm" data-i18n="it_country_formula" data-en="Per-Country IT Similarity Formula">국가별 IT 유사도 산식</h3>
                <div class="flex flex-col gap-sm">{it_explain_html}</div>
            </div>

            <div>
                <h3 class="font-label-md text-label-md uppercase tracking-wider text-text-secondary mb-sm" data-i18n="it_qw_formula" data-en="Per-Country Quickwin Formula">국가별 퀵윈 점수 산식</h3>
                <div class="flex flex-col gap-sm">{qw_explain_html}</div>
            </div>
        </section>'''

    # ------------------------- Tab 2-3 Market Background --------------

    def render_tab_market(self) -> str:
        tab = self.report.get("tabs", {}).get("tab_2_3_market_background", {}) or {}
        countries = tab.get("countries", []) or []

        def render_list(val: Any, max_items: int = 5) -> str:
            if isinstance(val, list):
                items = val[:max_items]
                if items and isinstance(items[0], dict):
                    parts = []
                    for it in items:
                        name = it.get("name") or it.get("rank") or ""
                        ms = it.get("market_share") or ""
                        parts.append(f'<li class="text-body-sm"><span class="text-primary font-medium">{self.esc(name)}</span> <span class="text-text-secondary">{self.esc(ms)}</span></li>')
                    return f'<ol class="list-decimal pl-5 flex flex-col gap-[2px]">{"".join(parts)}</ol>'
                return f'<div class="text-body-sm text-on-surface-variant">{", ".join(self.esc(x) for x in items)}</div>'
            if val:
                return f'<div class="text-body-sm text-on-surface-variant">{self.esc(val)}</div>'
            return f'<div class="text-text-secondary text-body-sm">{self.t_span("market_research_needed")}</div>'

        cards = []
        for c in countries:
            code = c.get("country", "")
            cards.append(f'''
            <div class="bg-surface-container-lowest border border-surface-border rounded-lg p-md shadow-[0_4px_8px_rgba(20,23,28,0.04)]">
                <div class="flex items-center gap-sm mb-sm border-b border-surface-border pb-sm">
                    <img src="{self.country_flag_url(code)}" class="w-6 h-4 object-cover rounded-sm" alt="">
                    <h3 class="font-headline-md text-headline-md text-primary m-0">{self.esc(self.country_ko(code))}</h3>
                    <span class="text-text-secondary">({self.esc(self.country_en(code))})</span>
                </div>
                <div class="flex flex-col gap-sm">
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_oem_top5", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT", "ranking")}
                        </div>
                        {render_list(c.get("oem_top5"))}
                    </div>
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_brand_top10", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT", "ranking")}
                        </div>
                        {render_list(c.get("brand_top10"), max_items=10)}
                    </div>
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_competitors", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT")}
                        </div>
                        {render_list(c.get("competitors"), max_items=6)}
                    </div>
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_purchase", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT")}
                        </div>
                        <div class="text-body-sm text-on-surface-variant">{self.esc(c.get("purchase_pattern"))}{self.esc(c.get("purchase_pattern_unit") or "")}</div>
                    </div>
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_avg_price", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT", "single_value")}
                        </div>
                        <div class="text-body-sm text-on-surface-variant">{self.esc(c.get("avg_new_car_price"))}</div>
                    </div>
                    <div>
                        <div class="flex items-center gap-xs mb-xs">
                            {self.t_span("market_summary", extra_class="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary")}
                            {self.badge("EXT", "qualitative")}
                        </div>
                        <div class="text-body-sm text-on-surface-variant">{self.esc((c.get("qualitative_summary") or "")[:280])}{"…" if len(c.get("qualitative_summary") or "") > 280 else ""}</div>
                    </div>
                </div>
            </div>''')
        cards_html = "\n".join(cards) or f'<div class="text-text-secondary">{self.t_span("market_no_data")}</div>'

        return f'''
        <section class="flex flex-col gap-lg">
            <div class="flex items-center gap-sm">
                <h2 class="font-headline-md text-headline-md text-primary m-0" data-i18n="market_title" data-en="Market Background (Reference)">시장 배경 (참고)</h2>
                {self.badge("EXT")}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-md">{cards_html}</div>
        </section>'''

    # ------------------------- HTML Shell -----------------------------

    TABS = [
        ("tab-summary",        "tab_summary",        "tab_summary_sub",    "summarize"),
        ("tab-killswitch",     "tab_killswitch",     "tab_killswitch_sub", "verified_user"),
        ("tab-attractiveness", "tab_attractiveness", "tab_attr_sub",       "trending_up"),
        ("tab-it",             "tab_it",             "tab_it_sub",         "leaderboard"),
        ("tab-market",         "tab_market",         "tab_market_sub",     "public"),
    ]

    def render_tabs_nav(self) -> str:
        parts = []
        for i, (tid, main_key, sub_key, icon) in enumerate(self.TABS):
            active = "active" if i == 0 else ""
            main_label = self.t_span(main_key)
            sub_label = self.t_span(sub_key, extra_class="opacity-60 text-[10px]")
            parts.append(f'''
            <button class="tab-button {active} flex items-center gap-xs px-md py-sm rounded-lg font-label-md text-label-md uppercase tracking-wider transition-colors hover:bg-surface-container text-text-secondary"
                    data-tab="{tid}">
                <span class="material-symbols-outlined text-[18px]">{icon}</span>
                {main_label}
                {sub_label}
            </button>''')
        return f'''
        <div class="bg-surface-container-lowest border border-surface-border rounded-xl p-sm mb-xl sticky top-0 z-10 card-shadow">
            <div class="flex gap-sm overflow-x-auto">{"".join(parts)}</div>
        </div>'''

    def generate_html(self) -> str:
        if not self.report:
            self.load_report()

        target = self.report.get("target", {}) or {}
        region = target.get("region", "EU")
        baseline = target.get("baseline_country", "GB")
        report_id = self.report.get("report_id", "RPT_RGN_XXX")

        ko, en = REGION_NAMES.get(region, (region, region))
        title = {
            "ko": f"{ko}({en}) 권역 퀵윈 분석 보고서",
            "en": f"{en} Regional Quickwin Analysis Report",
        }
        title_plain = f'{title["ko"]} / {title["en"]}'  # <title> 태그용 (PDF 파일명)

        fx = self.report.get("fx") or {}
        fx_note = ""
        if fx.get("rates"):
            fx_note = self.loc_span({
                "ko": f"FX 기준: {fx.get('base')} · 기준일 {fx.get('as_of')}",
                "en": f"FX base: {fx.get('base')} · as of {fx.get('as_of')}",
            })

        tab_summary = self.render_tab_summary()
        tab_ks = self.render_tab_killswitch()
        tab_attr = self.render_tab_attractiveness()
        tab_it = self.render_tab_it_quickwin()
        tab_market = self.render_tab_market()

        return f'''<!DOCTYPE html>
<html class="light" lang="ko">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <!-- 브라우저 인쇄 시 PDF 기본 파일명에 이 title이 사용됨 -->
    <title>{self.esc(report_id)} — {self.esc(title_plain)}</title>
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"/>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    <script>
        tailwind.config = {{
            darkMode: "class",
            theme: {{
                extend: {{
                    colors: {{
                        "accent-red": "#C0533F",
                        "surface-bright": "#F7F8FA",
                        "primary": "#101622",
                        "primary-container": "#2C4C86",
                        "on-primary-container": "#8FA0BD",
                        "on-primary": "#ffffff",
                        "secondary": "#3F6CB4",
                        "secondary-container": "#6E97D6",
                        "surface": "#F7F8FA",
                        "surface-light": "#F7F8FA",
                        "surface-container": "#EEF0F2",
                        "surface-container-low": "#F7F8FA",
                        "surface-container-lowest": "#ffffff",
                        "surface-border": "#E6E9EC",
                        "on-surface": "#14171C",
                        "on-surface-variant": "#3B3F46",
                        "text-primary": "#14171C",
                        "text-secondary": "#3B3F46",
                        "background": "#F7F8FA"
                    }},
                    borderRadius: {{ DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" }},
                    spacing: {{ xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px",
                                gutter: "24px", "margin-desktop": "48px", "margin-mobile": "16px", base: "4px" }},
                    fontFamily: {{
                        "headline-md": ["Pretendard"], "label-md": ["Pretendard"],
                        "headline-lg": ["Pretendard"], "body-sm": ["Pretendard"],
                        "label-sm": ["Pretendard"], "body-md": ["Pretendard"],
                        "mono": ["Space Grotesk", "Pretendard", "sans-serif"]
                    }},
                    fontSize: {{
                        "headline-md": ["20px", {{lineHeight: "28px", fontWeight: "600"}}],
                        "headline-lg": ["28px", {{lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "700"}}],
                        "label-md": ["12px", {{lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600"}}],
                        "label-sm": ["11px", {{lineHeight: "14px", fontWeight: "500"}}],
                        "body-sm": ["14px", {{lineHeight: "20px", fontWeight: "400"}}],
                        "body-md": ["16px", {{lineHeight: "24px", fontWeight: "400"}}],
                        "body-lg": ["18px", {{lineHeight: "28px", fontWeight: "400"}}]
                    }}
                }}
            }}
        }};
    </script>
    <style>
        body {{ font-family: 'Pretendard', 'Noto Sans KR', system-ui, sans-serif; }}
        .mono, .font-mono {{ font-family: 'Space Grotesk', 'Pretendard', sans-serif; }}
        .card-shadow {{ box-shadow: 0 4px 8px rgba(20, 23, 28, 0.12); }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .tab-button.active {{ background-color: #101622; color: white; }}
        .material-symbols-outlined {{ font-variation-settings: 'FILL' 0, 'wght' 500; }}

        /* ───────── Print / PDF export ───────── */
        @media print {{
            @page {{ size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }}
            html, body {{
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}
            /* Hide UI chrome */
            .no-print, .tab-button, header button, footer button {{ display: none !important; }}
            .sticky {{ position: static !important; }}
            /* Show all tab content stacked */
            .tab-content {{ display: block !important; break-before: page; }}
            .tab-content:first-of-type {{ break-before: auto; }}
            /* Add tab title before each panel (KO 기본 · html[lang=en]일 때 EN) */
            .tab-content[id="tab-summary"]::before        {{ content: "요약"; }}
            .tab-content[id="tab-killswitch"]::before     {{ content: "킬스위치"; }}
            .tab-content[id="tab-attractiveness"]::before {{ content: "매력도"; }}
            .tab-content[id="tab-it"]::before             {{ content: "IT 유사도 / 퀵윈"; }}
            .tab-content[id="tab-market"]::before         {{ content: "시장 배경"; }}
            html[lang="en"] .tab-content[id="tab-summary"]::before        {{ content: "Summary"; }}
            html[lang="en"] .tab-content[id="tab-killswitch"]::before     {{ content: "Kill-Switch"; }}
            html[lang="en"] .tab-content[id="tab-attractiveness"]::before {{ content: "Attractiveness"; }}
            html[lang="en"] .tab-content[id="tab-it"]::before             {{ content: "IT Similarity / Quickwin"; }}
            html[lang="en"] .tab-content[id="tab-market"]::before         {{ content: "Market Background"; }}
            .tab-content::before {{
                display: block;
                font-size: 18px;
                font-weight: 700;
                color: #101622;
                border-bottom: 2px solid #101622;
                padding-bottom: 6px;
                margin-bottom: 16px;
            }}
            /* Force-open all accordions */
            details {{ break-inside: avoid; }}
            details > summary {{ list-style: none; }}
            details > summary::-webkit-details-marker {{ display: none; }}
            details > summary .material-symbols-outlined {{ display: none; }}
            /* Cards: avoid breaking awkwardly */
            section > div, .grid > div {{ break-inside: avoid; }}
            /* Shrink shadows for cleaner print */
            * {{ box-shadow: none !important; }}
            /* Drop hover transitions */
            * {{ transition: none !important; }}
        }}
    </style>
</head>
<body class="bg-surface min-h-screen font-body-md text-text-primary antialiased">
<div class="w-full flex flex-col relative bg-surface">
    <main class="flex-1 px-gutter sm:px-xl lg:px-[64px] py-xl">
        <div class="max-w-7xl mx-auto">
            {self.render_tabs_nav()}
            <div class="tab-content active" id="tab-summary">{tab_summary}</div>
            <div class="tab-content" id="tab-killswitch">{tab_ks}</div>
            <div class="tab-content" id="tab-attractiveness">{tab_attr}</div>
            <div class="tab-content" id="tab-it">{tab_it}</div>
            <div class="tab-content" id="tab-market">{tab_market}</div>
        </div>
    </main>
</div>
<script>
    document.querySelectorAll('.tab-button').forEach(btn => {{
        btn.addEventListener('click', () => {{
            const id = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            btn.classList.add('active');
        }});
    }});

    // i18n KO/EN 토글 — data-i18n 속성 가진 요소의 textContent 교체
    const I18N_KEY = 'report_lang';
    function applyLang(lang) {{
        document.querySelectorAll('[data-i18n]').forEach(el => {{
            const ko = el.getAttribute('data-ko');
            const en = el.getAttribute('data-en');
            // 첫 호출 시 한글 원본을 data-ko에 백업
            if (ko === null) el.setAttribute('data-ko', el.textContent);
            const original = el.getAttribute('data-ko') || el.textContent;
            el.textContent = (lang === 'en' && en) ? en : original;
        }});
        const label = document.getElementById('lang-label');
        if (label) label.textContent = lang === 'en' ? '한' : 'EN';
        document.documentElement.lang = lang;
        try {{ localStorage.setItem(I18N_KEY, lang); }} catch (_) {{}}
    }}
    function toggleLang() {{
        const current = (document.documentElement.lang || 'ko').toLowerCase().startsWith('en') ? 'en' : 'ko';
        applyLang(current === 'en' ? 'ko' : 'en');
    }}
    // 페이지 로드 시 저장된 언어 복원
    try {{
        const saved = localStorage.getItem(I18N_KEY);
        if (saved === 'en') applyLang('en');
    }} catch (_) {{}}

    // PDF 저장 — 모든 탭/아코디언을 펼치고 인쇄 대화상자 호출, 인쇄 후 원복
    function exportPDF() {{
        const tabs = document.querySelectorAll('.tab-content');
        const tabBtns = document.querySelectorAll('.tab-button');
        const details = document.querySelectorAll('details');

        // 1) 현재 상태 저장
        const tabState = Array.from(tabs).map(t => t.classList.contains('active'));
        const detailState = Array.from(details).map(d => d.open);

        // 2) 모두 펼침 (print CSS가 display:block 강제하지만, JS도 details.open 강제)
        details.forEach(d => d.open = true);

        // 3) 인쇄 (PDF 저장은 사용자가 대화상자에서 선택)
        const restore = () => {{
            details.forEach((d, i) => d.open = detailState[i]);
            // 활성 탭 복원
            tabs.forEach((t, i) => t.classList.toggle('active', tabState[i]));
            window.removeEventListener('afterprint', restore);
        }};
        window.addEventListener('afterprint', restore);
        // Safari/Firefox에서 afterprint 미발생할 때 폴백
        setTimeout(restore, 60000);

        window.print();
    }}

    // 키보드 단축키: Cmd/Ctrl+P → 동일 동작
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
        if not output_path:
            jp = Path(self.report_json_path)
            html_dir = jp.parent.parent / "html"
            html_dir.mkdir(parents=True, exist_ok=True)
            output_path = html_dir / f"{jp.stem}.html"
        out = self.generate_html()
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(out)
        return str(output_path)


def main():
    import sys
    if len(sys.argv) < 2:
        print("Usage: python region_report_renderer.py <region_report_json> [output_html]")
        print("Example: python region_report_renderer.py storage/report/region/EU/data/RPT_RGN_EU_001.json")
        sys.exit(1)
    json_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    r = RegionReportRenderer(json_path)
    if not r.load_report():
        sys.exit(1)
    saved = r.save_html(out_path)
    print(f"HTML report generated: {saved}")
    return 0


if __name__ == "__main__":
    main()
