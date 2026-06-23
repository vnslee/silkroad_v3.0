"""FastAPI 앱 진입점 (C1).

CORS·라우터 등록·로깅 초기화. country/region 대칭 API 제공.
실행: uvicorn app.backend.api.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .routers import catalog, chat, detail, jobs, reports, research, ruleset

config.configure_logging()
_log = config.get_logger("main")

app = FastAPI(
    title="silk-road API",
    description="글로벌 오토파이낸스 진출 진단 — country/region 대칭 백엔드 API (ROADMAP 1차)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOW_ORIGINS,
    # 와일드카드 origin과 credentials 동시 사용은 브라우저가 거부 → False(1차 미사용).
    # 배포 시 origin 화이트리스트로 좁히면서 필요하면 True.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalog.router)
app.include_router(detail.router)
app.include_router(reports.router)
app.include_router(jobs.router)
app.include_router(research.router)
app.include_router(chat.router)
app.include_router(ruleset.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


# ── 프론트엔드 정적 서빙 (선택적) ────────────────────────────────
# 이 환경의 리버스 프록시 규약: `/app/*` → 백엔드(:8000)가 SPA(dist)를 서빙.
# 프론트 빌드(app/frontend/dist)가 존재할 때만 /app 에 mount. base=/app/ 로 빌드해야 자산 경로가 맞는다.
# dist가 없으면(개발 중 API만 사용) 조용히 건너뛴다.
from pathlib import Path as _Path  # noqa: E402

from fastapi.staticfiles import StaticFiles  # noqa: E402

_FRONTEND_DIST = _Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/app", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
    _log.info("frontend mounted at /app from %s", _FRONTEND_DIST)
else:
    _log.info("frontend dist not found (%s) — /app not mounted", _FRONTEND_DIST)


_log.info("silk-road API initialized")
