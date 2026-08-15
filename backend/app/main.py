"""
RugMaps Backend — FastAPI application entry point.

Mounts the bubble maps and honeypot map routers, provides
health checks and middleware.

Usage:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.routers.bubble_maps_router import router as bubble_maps_router
from app.routers.honeypot_map import router as honeypot_map_router

logger = logging.getLogger(__name__)

# ── App metadata ──────────────────────────────────────────────────────────

APP_NAME = "rugmaps-backend"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "RugMaps — wallet cluster visualization and AI-powered token investigation"

# ── CORS configuration ────────────────────────────────────────────────────
# Explicit origin allowlist — `allow_origins=["*"]` with
# `allow_credentials=True` is invalid per the CORS spec (browsers reject
# wildcard + credentials) and would open the API to any site. Origins are
# configured via the CORS_ALLOWED_ORIGINS env var (comma-separated);
# defaults to local development origins. Set CORS_ALLOWED_ORIGINS to the
# production frontend origin(s) when deploying.

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def _cors_allowed_origins() -> list[str]:
    """Parse CORS_ALLOWED_ORIGINS (comma-separated) or return dev defaults."""
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return DEFAULT_CORS_ORIGINS


# ── Lifespan ──────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info(f"{APP_NAME} v{APP_VERSION} starting...")
    yield
    logger.info(f"{APP_NAME} shutting down...")


# ── Create app ────────────────────────────────────────────────────────────

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ─────────────────────────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed:.3f}s)")
    return response


# ── Mount routers ─────────────────────────────────────────────────────────

app.include_router(bubble_maps_router)
logger.info("Mounted bubble_maps_router at /api/v1/rugmaps/*")

app.include_router(honeypot_map_router)
logger.info("Mounted honeypot_map_router at /api/v1/honeypot-map/*")


# ── Root endpoints ────────────────────────────────────────────────────────


@app.get("/")
async def root():
    return {
        "service": APP_NAME,
        "version": APP_VERSION,
        "status": "ok",
        "endpoints": {
            "rugmaps": "/api/v1/rugmaps/health",
            "honeypot_map": "/api/v1/honeypot-map/stats",
            "docs": "/docs",
        },
    }


@app.get("/health")
async def health():
    return {
        "service": APP_NAME,
        "version": APP_VERSION,
        "status": "ok",
        "uptime_seconds": 0,
    }
