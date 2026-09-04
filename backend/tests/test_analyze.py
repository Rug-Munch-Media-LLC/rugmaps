"""
RugMaps Backend — Wallet Analysis Endpoint Tests.

Tests GET /api/v1/rugmaps/analyze/{address} — the quick wallet analysis
endpoint that returns node/link counts, risk, and top counterparties.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analyze_returns_full_structure(client: AsyncClient):
    """Analyze endpoint should return the full analysis contract."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)  # type: ignore[method-assign]

    resp = await client.get("/api/v1/rugmaps/analyze/0xabc123?chain=ethereum")
    assert resp.status_code == 200
    data = resp.json()

    assert data["address"] == "0xabc123"
    assert data["chain"] == "ethereum"
    assert isinstance(data["node_count"], int)
    assert isinstance(data["link_count"], int)
    assert isinstance(data["risk_score"], (int, float))
    assert isinstance(data["risk_level"], str)
    assert isinstance(data["stats"], dict)
    assert isinstance(data["top_counterparties"], list)


@pytest.mark.asyncio
async def test_analyze_with_graph_data(client: AsyncClient):
    """Analyze should surface node counts and top counterparties from the graph."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()

    def fake_databus(data_type: str, **kwargs):
        addr = kwargs.get("address", "")
        if data_type == "wallet_labels":
            return {"data": {"labels": [{"name": f"W {addr[:8]}", "risk_score": 10}]}}
        if data_type == "entity_intel":
            if addr == "0xcenter":
                return {
                    "data": {
                        "counterparties": [
                            {"address": "0xdeadbeef00000000000000000000000000000000", "weight": 50.0, "risk_score": 5},
                            {"address": "0xbeef000000000000000000000000000000000000", "weight": 25.0, "risk_score": 80},
                        ]
                    }
                }
            return {"data": {"counterparties": []}}
        return None

    bm._databus_fetch = AsyncMock(side_effect=fake_databus)  # type: ignore[method-assign]

    resp = await client.get("/api/v1/rugmaps/analyze/0xcenter?chain=ethereum&depth=1")
    assert resp.status_code == 200
    data = resp.json()

    assert data["node_count"] >= 3
    assert data["link_count"] >= 2
    # Top counterparties are layer-1 nodes, truncated to "0xdeadbeef..." form
    assert len(data["top_counterparties"]) >= 1
    assert data["top_counterparties"][0].endswith("...")


@pytest.mark.asyncio
async def test_analyze_solana_chain(client: AsyncClient):
    """Analyze should accept solana chain."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)  # type: ignore[method-assign]

    resp = await client.get("/api/v1/rugmaps/analyze/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v?chain=solana")
    assert resp.status_code == 200
    data = resp.json()
    assert data["chain"] == "solana"
    assert data["address"] == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"


@pytest.mark.asyncio
async def test_analyze_rejects_unsupported_chain(client: AsyncClient):
    """Analyze should reject unsupported chains with a 400."""
    resp = await client.get("/api/v1/rugmaps/analyze/0xabc?chain=notachain")
    assert resp.status_code == 400
    data = resp.json()
    assert "Unsupported chain" in data["detail"]


@pytest.mark.asyncio
async def test_analyze_depth_bounds(client: AsyncClient):
    """Analyze should enforce depth bounds (1..5) via FastAPI validation."""
    from app.bubble_maps import get_bubble_maps_pro

    bm = get_bubble_maps_pro()
    bm._databus_fetch = AsyncMock(return_value=None)  # type: ignore[method-assign]

    # depth=0 → 422 (below ge=1)
    resp = await client.get("/api/v1/rugmaps/analyze/0xabc?chain=ethereum&depth=0")
    assert resp.status_code == 422

    # depth=6 → 422 (above le=5)
    resp = await client.get("/api/v1/rugmaps/analyze/0xabc?chain=ethereum&depth=6")
    assert resp.status_code == 422

    # depth=5 → 200 (valid upper bound)
    resp = await client.get("/api/v1/rugmaps/analyze/0xabc?chain=ethereum&depth=5")
    assert resp.status_code == 200
