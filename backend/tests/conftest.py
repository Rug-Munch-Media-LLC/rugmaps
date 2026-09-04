"""RugMaps Backend — test fixtures and configuration."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Force tests to use localhost for DataBus
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")
os.environ.setdefault("BACKEND_TIMEOUT", "1")


@pytest.fixture(autouse=True)
def _reset_singletons():
    """Reset shared singleton state between tests.

    ``BubbleMapsPro`` and ``AutoLabeler`` are process-wide singletons. Tests
    replace their ``_databus_fetch`` / ``_fetch_counterparties`` methods with
    AsyncMocks and populate the in-memory ``_cache``. Without a reset, those
    mutations leak across tests (a mock set in one test silently changes the
    behavior of the next), producing order-dependent failures. This fixture
    restores the original bound methods and clears the cache before each test.
    """
    from app.auto_labeler import get_auto_labeler
    from app.bubble_maps import BubbleMapsPro, get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    # Restore the real bound methods (tests may have replaced them with mocks).
    bm._databus_fetch = BubbleMapsPro._databus_fetch.__get__(bm, BubbleMapsPro)
    bm._fetch_counterparties = BubbleMapsPro._fetch_counterparties.__get__(bm, BubbleMapsPro)
    bm._cache.clear()

    labeler = get_auto_labeler()
    labeler._observations.clear()
    labeler._labels_cache.clear()
    labeler._stats.clear()
    yield


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with ASGI transport.

    Uses the app directly (no network), but external DataBus HTTP
    calls will fail fast with the 1s timeout unless mocked.
    """
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_databus_wallet_labels() -> dict:
    """Mock wallet labels response from DataBus."""
    return {
        "data": {
            "labels": [
                {
                    "address": "0x1234567890abcdef1234567890abcdef12345678",
                    "name": "Binance Hot Wallet",
                    "label": "Binance",
                    "type": "exchange",
                    "risk_score": 10,
                    "tags": ["cex", "exchange", "binance"],
                }
            ]
        },
        "source": "databus",
        "tier": "local",
        "is_local": True,
    }


@pytest.fixture
def mock_databus_entity_intel() -> dict:
    """Mock entity intel response from DataBus."""
    return {
        "data": {
            "counterparties": [
                {
                    "address": "0xdead000000000000000000000000000000000000",
                    "weight": 15.0,
                    "transactions": 25,
                    "label": "Uniswap V2 Router",
                    "is_dev": False,
                    "is_bundle": False,
                    "risk_score": 5,
                },
                {
                    "address": "0xbeef000000000000000000000000000000000000",
                    "weight": 8.0,
                    "transactions": 12,
                    "label": "MEV Bot",
                    "is_dev": False,
                    "is_bundle": True,
                    "risk_score": 85,
                },
            ]
        },
        "source": "databus",
        "tier": "local",
    }


@pytest.fixture
def mock_bubble_map_result() -> dict:
    """Expected bubble map response shape."""
    return {
        "center_address": "0xabc...",
        "chain": "ethereum",
        "nodes": [
            {
                "id": "0xabc...",
                "address": "0xabc...",
                "value": 100.0,
                "risk": 10.0,
                "layer": 0,
                "color": "#8B5CF6",
                "is_cex": True,
                "entity_type": "exchange",
                "tags": ["cex", "exchange"],
            },
        ],
        "links": [],
        "risk_score": 10.0,
        "risk_level": "low",
        "stats": {
            "total_nodes": 1,
            "total_links": 0,
            "by_layer": {0: 1},
            "by_entity_type": {"exchange": 1},
            "high_risk_count": 0,
            "dev_count": 0,
            "bundle_count": 0,
            "cex_count": 1,
        },
        "metadata": {
            "data_source": "databus",
            "depth": 2,
        },
    }
