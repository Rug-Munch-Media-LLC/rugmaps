"""
RugMaps Backend — FastAPI application entry point.

Mounts the bubble maps and honeypot map routers, provides
health checks and middleware.

Usage:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

# ── App metadata ──────────────────────────────────────────────────────────

APP_NAME = "rugmaps-backend"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "RugMaps — wallet cluster visualization and AI-powered token investigation"

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
    allow_origins=["*"],
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

# Import routers (lazy to avoid circular imports)
try:
    from routers.bubble_maps_router import router as bubble_maps_router

    app.include_router(bubble_maps_router)
    logger.info("Mounted bubble_maps_router at /api/v1/rugmaps/*")
except ImportError as e:
    logger.warning(f"bubble_maps_router not available: {e}")

try:
    from routers.honeypot_map import router as honeypot_map_router

    app.include_router(honeypot_map_router)
    logger.info("Mounted honeypot_map_router at /api/v1/honeypot-map/*")
except ImportError as e:
    logger.warning(f"honeypot_map_router not available: {e}")


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
