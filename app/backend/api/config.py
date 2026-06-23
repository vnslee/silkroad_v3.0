"""설정·경로·상수 — backend-api.

STORAGE_BASE는 이 파일 위치 기준으로 self-locate한다(엔진의 self-locate 패턴과 동일 기준:
api/ → app/backend → storage). 어디서 실행하든 동일하게 해석된다.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# api/config.py → app/backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
STORAGE_BASE = BACKEND_DIR / "storage"
DATA_DIR = STORAGE_BASE / "data"
RESEARCH_DIR = DATA_DIR / "research"
INTERNAL_LATEST = DATA_DIR / "internal" / "internal_latest.json"
HYUNDAI_WORLDWIDE = DATA_DIR / "internal" / "hyundai_worldwide.json"
REPORT_DIR = STORAGE_BASE / "report"
DETAIL_DIR = STORAGE_BASE / "detail"

# 엔진 import를 위한 경로(크로스 폴더 import 패턴 — CLAUDE.md)
ENGINE_GENERATION = BACKEND_DIR / "engine" / "generation"
ENGINE_RENDERING = BACKEND_DIR / "engine" / "rendering"

# report-pdf 스킬 스크립트(프로젝트 루트 기준)
PROJECT_ROOT = BACKEND_DIR.parent.parent
PDF_SCRIPT = PROJECT_ROOT / ".claude" / "skills" / "report-pdf" / "scripts" / "html_to_pdf.py"

# ── Bedrock 리서치 구성 (2차) ───────────────────────────────────
# 자격증명은 boto3 표준 체인(env·profile·role). 별도 API Key 불필요(SigV4).
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "ap-northeast-2")
# 모델 ID: on-demand(`anthropic.claude-opus-4-8`)는 inference profile 필요 →
# global cross-region inference profile(`global.` 접두사)을 기본으로 둔다. env override 가능.
BEDROCK_MODEL = os.environ.get("BEDROCK_MODEL", "global.anthropic.claude-opus-4-8")
# 클라이언트 백엔드: "mantle"(Messages-API Bedrock, output_config 지원) | "legacy"(bedrock-runtime InvokeModel).
# Mantle 엔드포인트 미가용 환경(DNS 미해석)에서는 legacy로 폴백. 자동 폴백도 지원.
BEDROCK_BACKEND = os.environ.get("BEDROCK_BACKEND", "legacy")
RESEARCH_MAX_TOKENS = int(os.environ.get("RESEARCH_MAX_TOKENS", "16000"))
# 리서치 프롬프트·스키마 명세 위치(self-locate). 명세=실행 단일출처(Q3=A).
RESEARCH_SPEC_DIR = PROJECT_ROOT / "architecture" / "research"

# 도메인 상수
DOMAINS = ("country", "region")
# target_id 검증: 국가 ISO alpha-2 대문자 / 권역 코드(2~5 대문자)
TARGET_ID_PATTERN = r"^[A-Z]{2,5}$"
REPORT_ID_PREFIX = {"country": "RPT_CTR", "region": "RPT_RGN"}
# 전체 report_id 형식 강제(경로 traversal 방어) — RPT_CTR_ES_001 / RPT_RGN_EU_012
REPORT_ID_PATTERN = r"^RPT_(CTR|RGN)_[A-Z]{2,5}_\d{3}$"

# CORS — 개발용 전체 허용(배포 시 조정)
CORS_ALLOW_ORIGINS = ["*"]

API_PREFIX = "/api"


def domain_plural(domain: str) -> str:
    """country → countries, region → regions (URL prefix용)."""
    return "countries" if domain == "country" else "regions"


def ensure_engine_on_path() -> None:
    """엔진 디렉토리를 sys.path에 추가(중복 방지)."""
    for p in (str(ENGINE_GENERATION), str(ENGINE_RENDERING)):
        if p not in sys.path:
            sys.path.insert(0, p)


def configure_logging(level: int = logging.INFO) -> None:
    """표준 logging 설정(중복 핸들러 방지)."""
    root = logging.getLogger("silkroad")
    if root.handlers:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"silkroad.api.{name}")
