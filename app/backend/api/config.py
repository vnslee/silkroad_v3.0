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
# 국가 지오/메타 참조(마커 좌표·국가명·권역·ISO numeric)의 단일 출처.
GEO_COUNTRY = DATA_DIR / "geo" / "country_geo.json"
REPORT_DIR = STORAGE_BASE / "report"
DETAIL_DIR = STORAGE_BASE / "detail"

# 엔진 import를 위한 경로(크로스 폴더 import 패턴 — CLAUDE.md)
ENGINE_GENERATION = BACKEND_DIR / "engine" / "generation"
ENGINE_RENDERING = BACKEND_DIR / "engine" / "rendering"

# report-pdf 스킬 스크립트(프로젝트 루트 기준)
PROJECT_ROOT = BACKEND_DIR.parent.parent
PDF_SCRIPT = PROJECT_ROOT / ".claude" / "skills" / "report-pdf" / "scripts" / "html_to_pdf.py"

# ── LLM 리서치 구성 (2차) ───────────────────────────────────────
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", os.environ.get("AWS_REGION", "ap-northeast-2"))
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# ── AgentCore Gateway 웹검색 (us-east-1 전용 커넥터) ──────────────
# first-party "Web Search Tool" 커넥터는 현재 us-east-1에만 있다(서울 미지원).
# Gateway는 us-east-1에 만들고 서울 백엔드에서 cross-region SigV4 호출한다.
# Gateway URL/ID/ARN은 provision_gateway.py가 출력하는 값을 env로 주입한다.
GATEWAY_REGION = os.environ.get("GATEWAY_SEARCH_REGION", "us-east-1")
GATEWAY_SEARCH_URL = os.environ.get("GATEWAY_SEARCH_URL")
GATEWAY_SEARCH_ID = os.environ.get("GATEWAY_SEARCH_ID")
GATEWAY_SEARCH_ARN = os.environ.get("GATEWAY_SEARCH_ARN")
GATEWAY_SEARCH_MAX_RESULTS = int(os.environ.get("GATEWAY_SEARCH_MAX_RESULTS", "10"))
# 도메인→신뢰도 티어 매핑(운영자 편집 가능). 스코어링 룰셋(internal_latest.json)과 분리.
CREDIBILITY_TIERS = DATA_DIR / "internal" / "source_tiers.json"
# Claude Platform on AWS 워크스페이스 ID(aws 백엔드 필수).
ANTHROPIC_AWS_WORKSPACE_ID = os.environ.get("ANTHROPIC_AWS_WORKSPACE_ID")

# 클라이언트 백엔드:
#   "api"    — first-party Anthropic API(ANTHROPIC_API_KEY). 웹검색 ✅. 가장 간단.
#   "aws"    — Claude Platform on AWS(AnthropicAWS, SigV4 + workspace_id). 웹검색 ✅.
#   "mantle" — Messages-API Bedrock(output_config 지원, 웹검색 ❌).
#   "legacy" — bedrock-runtime InvokeModel(웹검색 ❌).
# ⚠️ 웹검색 서버툴은 api/aws 에서만 동작 — Amazon Bedrock(mantle/legacy)은 미지원.
#
# 웹검색 제공자(WEB_SEARCH_PROVIDER):
#   "gateway"     — AgentCore Gateway WebSearch 커넥터를 오케스트레이션이 직접 호출(선검색).
#                   legacy 백엔드(IAM 키만)에서도 동작. 기본값.
#   "server_tool" — 기존 Anthropic SDK 웹검색 서버툴(api/aws 백엔드 한정, web_search_supported()).
#   "off"         — 웹검색 비활성.
WEB_SEARCH_PROVIDER = os.environ.get("WEB_SEARCH_PROVIDER", "gateway")


def _auto_backend() -> str:
    """가용 자격증명으로 백엔드 자동 선택. 명시 BEDROCK_BACKEND가 있으면 그걸 우선.

    우선순위: first-party 키(웹검색O) > Platform on AWS workspace(웹검색O) >
    Bedrock(CLAUDE_CODE_USE_BEDROCK/AWS_REGION, 웹검색X). 아무것도 없으면 api(에러는 호출 시).
    """
    explicit = os.environ.get("BEDROCK_BACKEND")
    if explicit:
        return explicit
    if ANTHROPIC_API_KEY:
        return "api"
    if ANTHROPIC_AWS_WORKSPACE_ID:
        return "aws"
    if os.environ.get("CLAUDE_CODE_USE_BEDROCK") or os.environ.get("AWS_REGION"):
        return "legacy"
    return "api"


BEDROCK_BACKEND = _auto_backend()
# 모델 ID: api/aws는 bare ID, Bedrock(mantle/legacy)은 `global.anthropic.` 접두사.
_DEFAULT_MODEL = (
    "claude-opus-4-8"
    if BEDROCK_BACKEND in ("api", "aws")
    else "global.anthropic.claude-opus-4-8"
)
BEDROCK_MODEL = os.environ.get("BEDROCK_MODEL", _DEFAULT_MODEL)
# 챗봇 자유 답변(generate_text)용 모델 — 간단한 답변은 Sonnet으로 분리(빠르고 저렴).
# 리서치·구조화 분류(generate_structured)는 BEDROCK_MODEL(Opus) 유지.
_DEFAULT_CHAT_MODEL = (
    "claude-sonnet-4-6"
    if BEDROCK_BACKEND in ("api", "aws")
    else "global.anthropic.claude-sonnet-4-6"
)
CHAT_MODEL = os.environ.get("CHAT_MODEL", _DEFAULT_CHAT_MODEL)
RESEARCH_MAX_TOKENS = int(os.environ.get("RESEARCH_MAX_TOKENS", "16000"))


def web_search_supported() -> bool:
    """현재 백엔드가 웹검색 서버툴을 지원하는지(Bedrock 계열은 미지원).

    server_tool 제공자 경로에서만 의미가 있다(gateway 경로는 백엔드 무관).
    """
    return BEDROCK_BACKEND in ("api", "aws")


def gateway_search_enabled() -> bool:
    """AgentCore Gateway 선검색 경로가 활성인지(provider=gateway + URL 설정됨)."""
    return WEB_SEARCH_PROVIDER == "gateway" and bool(GATEWAY_SEARCH_URL)
# 리서치 프롬프트·스키마 명세 위치(self-locate). 명세=실행 단일출처(Q3=A).
RESEARCH_SPEC_DIR = PROJECT_ROOT / "architecture" / "research"
# 챗봇 시나리오 명세 위치(self-locate). 흐름·선택지 SoT(chatbot_flow.json)와
# 케이스·관점 서술 SoT(senario.md)를 런타임에 읽는다(RESEARCH_SPEC_DIR과 동일 패턴).
CHATBOT_SPEC_DIR = PROJECT_ROOT / "architecture" / "chatbot"

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
