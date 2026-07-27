"""
RugMaps Backend — Router endpoint tests.

Tests the HTTP endpoints defined in bubble_maps_router.py.
Uses mocked DataBus HTTP responses for deterministic testing.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analyze_wallet_endpoint(client: AsyncClient):
    """GET /api/v1/rugmaps/analyze/{address} should return wallet analysis."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)

    resp = await client.get("/api/v1/rugmaps/analyze/0xabc123?chain=ethereum")
    assert resp.status_code == 200
    data = resp.json()

    assert data["address"] == "0xabc123"
    assert data["chain"] == "ethereum"
    assert "node_count" in data
    assert "link_count" in data
    assert "risk_level" in data
    assert "risk_score" in data
    assert "stats" in data
    assert "top_counterparties" in data


@pytest.mark.asyncio
async def test_analyze_wallet_minimal_response(client: AsyncClient):
    """Analyze endpoint without DataBus should still return basic structure."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)

    resp = await client.get("/api/v1/rugmaps/analyze/0xdeadbeef?chain=solana")
    assert resp.status_code == 200
    data = resp.json()

    assert isinstance(data["node_count"], int)
    assert isinstance(data["link_count"], int)
    assert isinstance(data["risk_score"], (int, float))
    assert data["chain"] == "solana"


@pytest.mark.asyncio
async def test_entity_endpoint(client: AsyncClient):
    """GET /api/v1/rugmaps/entity/{address} should return entity info."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(
        return_value={
            "data": {"labels": [{"name": "Test Entity", "type": "wallet", "risk_score": 25}]},
        }
    )

    resp = await client.get("/api/v1/rugmaps/entity/0xabc123?chain=ethereum")
    assert resp.status_code == 200
    data = resp.json()

    assert data["address"] == "0xabc123"
    assert data["chain"] == "ethereum"
    assert "entity" in data
    assert "risk_score" in data
    assert "risk_level" in data


@pytest.mark.asyncio
async def test_entity_endpoint_no_labels(client: AsyncClient):
    """Entity endpoint should handle missing labels gracefully."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)

    resp = await client.get("/api/v1/rugmaps/entity/0xunknown?chain=ethereum")
    assert resp.status_code == 200
    data = resp.json()

    assert data["address"] == "0xunknown"
    assert isinstance(data["risk_score"], (int, float))
    assert isinstance(data["risk_level"], str)


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """GET /api/v1/rugmaps/health should return ok status."""
    resp = await client.get("/api/v1/rugmaps/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "rugmaps-engine"


@pytest.mark.asyncio
async def test_map_endpoint(client: AsyncClient):
    """POST /api/v1/rugmaps/map should generate a bubble map."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)

    resp = await client.post(
        "/api/v1/rugmaps/map",
        json={"center_wallet": "0xabc123", "chain": "ethereum", "depth": 1, "min_strength": 0.1},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "nodes" in data
    assert "links" in data
    assert "risk_score" in data
    assert "risk_level" in data
    assert "stats" in data
    assert "center_address" in data


@pytest.mark.asyncio
async def test_map_endpoint_validates_chains(client: AsyncClient):
    """Map endpoint should reject unsupported chains."""
    resp = await client.post(
        "/api/v1/rugmaps/map",
        json={"center_wallet": "0xabc", "chain": "invalid_chain", "depth": 2, "min_strength": 0.1},
    )
    assert resp.status_code == 400
    data = resp.json()
    assert "detail" in data
    assert "Unsupported chain" in data["detail"]


@pytest.mark.asyncio
async def test_auto_label_endpoint(client: AsyncClient):
    """POST /api/v1/rugmaps/auto-label should label wallets from events."""
    resp = await client.post(
        "/api/v1/rugmaps/auto-label",
        json={
            "address": "0xabc123",
            "chain": "ethereum",
            "events": [{"label": "Binance Hot Wallet", "event": "scan"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert data["address"] == "0xabc123"
    assert "labels_applied" in data
    assert data["count"] >= 1

    # Should have exchange label
    exchange_labels = [lb for lb in data["labels_applied"] if lb.get("label_type") == "exchange"]
    assert len(exchange_labels) >= 1


@pytest.mark.asyncio
async def test_auto_label_stats_endpoint(client: AsyncClient):
    """GET /api/v1/rugmaps/auto-label/stats should return stats."""
    resp = await client.get("/api/v1/rugmaps/auto-label/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert "total_observations" in data
    assert "total_wallets_tracked" in data
    assert "by_type" in data
