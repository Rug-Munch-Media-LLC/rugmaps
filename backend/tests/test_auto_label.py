"""
RugMaps Backend — Auto-Labeler HTTP Endpoint Tests.

Tests POST /api/v1/rugmaps/auto-label and GET /api/v1/rugmaps/auto-label/stats.
The auto-labeler is heuristic-based (no network), so these tests run against
the ASGI app with no external mocking.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auto_label_exchange_detection(client: AsyncClient):
    """POST /auto-label should classify an exchange wallet from context."""
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

    exchange_labels = [lb for lb in data["labels_applied"] if lb.get("label_type") == "exchange"]
    assert len(exchange_labels) >= 1
    assert exchange_labels[0]["confidence"] >= 0.8


@pytest.mark.asyncio
async def test_auto_label_contract_detection(client: AsyncClient):
    """POST /auto-label should detect known contract addresses."""
    resp = await client.post(
        "/api/v1/rugmaps/auto-label",
        json={
            "address": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            "chain": "ethereum",
            "events": [{"event": "scan"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    contract_labels = [lb for lb in data["labels_applied"] if lb.get("label_type") == "contract"]
    assert len(contract_labels) >= 1
    assert "Uniswap" in contract_labels[0]["name"]


@pytest.mark.asyncio
async def test_auto_label_multiple_events_aggregate(client: AsyncClient):
    """Multiple events should each contribute labels; count reflects total."""
    resp = await client.post(
        "/api/v1/rugmaps/auto-label",
        json={
            "address": "0xdef1...",
            "chain": "ethereum",
            "events": [
                {"entity_type": "mev_bot", "event": "scan"},
                {"label": "Flashbots", "event": "scan"},
            ],
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert data["count"] == len(data["labels_applied"])
    mev_labels = [lb for lb in data["labels_applied"] if lb.get("label_type") == "mev_bot"]
    assert len(mev_labels) >= 1


@pytest.mark.asyncio
async def test_auto_label_empty_events_ok(client: AsyncClient):
    """Empty events list should still return a valid response (no crash)."""
    resp = await client.post(
        "/api/v1/rugmaps/auto-label",
        json={"address": "0xabc", "chain": "ethereum", "events": []},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["address"] == "0xabc"
    assert isinstance(data["labels_applied"], list)
    assert isinstance(data["count"], int)


@pytest.mark.asyncio
async def test_auto_label_missing_address_ok(client: AsyncClient):
    """Missing address should be handled gracefully (empty string)."""
    resp = await client.post(
        "/api/v1/rugmaps/auto-label",
        json={"address": "", "chain": "ethereum", "events": [{"label": "Binance"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["address"] == ""


@pytest.mark.asyncio
async def test_auto_label_stats_endpoint(client: AsyncClient):
    """GET /auto-label/stats should return tracking statistics."""
    resp = await client.get("/api/v1/rugmaps/auto-label/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "ok"
    assert "total_observations" in data
    assert "total_wallets_tracked" in data
    assert "by_type" in data
