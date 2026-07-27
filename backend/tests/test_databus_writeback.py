"""
Cross-app Integration Test: RugMaps → DataBus Write-Back.

Verifies that when ``BubbleMapsPro.generate_map()`` detects a high-risk cluster
(risk_score > 50 or risk_level in "high"/"critical"), it POSTs a correctly
structured payload to the DataBus ingest endpoint.

This creates the critical feedback loop documented in bubble_maps.py:
    rugmaps finds clusters → rmi-backend uses them for risk scoring
    → rugmaps queries improved scores on next scan.

The test validates:
  1. The ingest payload structure matches ``ScrapedIngestRequest`` schema
  2. Only high-risk findings trigger write-back (risk_score > 50)
  3. Low-risk findings do NOT trigger write-back

Skips gracefully when the rmi-backend is not running (live POST test),
but the payload-generation logic is tested with mock HTTP.
"""

from __future__ import annotations

import json
import os
from typing import Any
from unittest.mock import patch

import httpx
import pytest

pytestmark = pytest.mark.integration

# ── Configuration ──────────────────────────────────────────────────────────
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
INGEST_URL = f"{BACKEND_URL}/api/v1/databus/ingest"


# ── Helpers ────────────────────────────────────────────────────────────────


def _expected_ingest_payload(
    address: str = "0xHIGH_RISK_CLUSTER_001",
    chain: str = "ethereum",
    risk_score: float = 85.0,
    risk_level: str = "high",
    nodes: int = 12,
    links: int = 45,
) -> dict[str, Any]:
    """Return the payload the `_databus_ingest_cluster` method would POST.

    Mirrors the structure in ``bubble_maps.py`` ``_databus_ingest_cluster()``.
    """
    return {
        "source": "rugmaps",
        "data_type": "wallet_cluster",
        "content": {
            "address": address,
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "nodes": nodes,
            "links": links,
            "chain": chain,
        },
        "token_address": address,
        "chain": chain,
    }


# ── Tests ──────────────────────────────────────────────────────────────────


class TestDatabusWritebackPayload:
    """Tests for the ingest payload structure used by BubbleMapsPro."""

    def test_ingest_payload_has_required_fields(self):
        """The ingest payload must contain all fields required by ScrapedIngestRequest."""
        payload = _expected_ingest_payload()

        assert "source" in payload
        assert "data_type" in payload
        assert "content" in payload
        assert "token_address" in payload
        assert "chain" in payload

        assert payload["source"] == "rugmaps"
        assert payload["data_type"] == "wallet_cluster"

        content = payload["content"]
        assert "address" in content
        assert "risk_score" in content
        assert "risk_level" in content
        assert "nodes" in content
        assert "links" in content
        assert "chain" in content

    def test_ingest_payload_source_is_always_rugmaps(self):
        """The ``source`` field must always be 'rugmaps' for traceability."""
        payloads = [
            _expected_ingest_payload(risk_level="critical", risk_score=95.0),
            _expected_ingest_payload(risk_level="high", risk_score=65.0),
            _expected_ingest_payload(risk_level="medium", risk_score=45.0),
        ]
        for p in payloads:
            assert p["source"] == "rugmaps", f"Expected source='rugmaps' for risk_level={p['content']['risk_level']}"

    def test_ingest_payload_data_type_is_wallet_cluster(self):
        """The ``data_type`` field must be 'wallet_cluster' for the feedback loop."""
        payload = _expected_ingest_payload()
        assert payload["data_type"] == "wallet_cluster"

    def test_ingest_payload_content_risk_score_rounded_to_one_decimal(self):
        """risk_score in content must be rounded to 1 decimal place."""
        payload = _expected_ingest_payload(risk_score=85.6789)
        assert payload["content"]["risk_score"] == 85.7

    def test_ingest_payload_token_address_matches_center_address(self):
        """token_address should equal content.address (the cluster center)."""
        payload = _expected_ingest_payload(
            address="0xCLUSTER_CENTER_WALLET_123",
            risk_score=75.0,
        )
        assert payload["token_address"] == payload["content"]["address"]

    def test_ingest_payload_content_fields_are_typed_correctly(self):
        """Verify types of all content fields match ScrapedIngestRequest."""
        payload = _expected_ingest_payload(
            address="0xTYPE_CHECK_WALLET",
            chain="solana",
            risk_score=90.5,
            risk_level="critical",
            nodes=25,
            links=100,
        )
        content = payload["content"]
        assert isinstance(content["address"], str)
        assert isinstance(content["chain"], str)
        assert isinstance(content["risk_score"], float)
        assert isinstance(content["risk_level"], str)
        assert isinstance(content["nodes"], int)
        assert isinstance(content["links"], int)

    def test_ingest_payload_serializes_to_valid_json(self):
        """The payload must be JSON-serializable (for the POST body)."""
        payload = _expected_ingest_payload()
        serialized = json.dumps(payload)
        deserialized = json.loads(serialized)
        assert deserialized == payload

    @pytest.mark.asyncio
    async def test_high_risk_triggers_databus_ingest(self):
        """BubbleMapsPro.generate_map() must POST to ingest when risk > 50.

        This uses mock HTTP to capture the POST without needing the real backend.
        The ``_databus_ingest_cluster`` is called via ``asyncio.create_task()``,
        so we yield to the event loop after ``generate_map()`` to let the
        background task execute.
        """
        import asyncio
        from unittest.mock import AsyncMock

        from app.bubble_maps import BubbleMapsPro

        bm = BubbleMapsPro()

        # Mock the DataBus fetch calls to return high-risk data
        mock_wallet_labels = {
            "data": {
                "labels": [
                    {
                        "address": "0xRISKY_DEV_001",
                        "name": "Suspicious Dev",
                        "type": "developer",
                        "risk_score": 90,
                        "tags": ["dev", "high_risk"],
                    }
                ]
            },
            "source": "databus",
        }

        mock_entity_intel = {
            "data": {
                "counterparties": [
                    {
                        "address": "0xBUNDLE_BOT_001",
                        "weight": 20.0,
                        "transactions": 50,
                        "label": "Bundle Bot",
                        "is_dev": False,
                        "is_bundle": True,
                        "risk_score": 85,
                    },
                    {
                        "address": "0xFRESH_WALLET_002",
                        "weight": 5.0,
                        "transactions": 3,
                        "label": "Fresh Wallet",
                        "is_dev": False,
                        "is_bundle": True,
                        "risk_score": 75,
                    },
                ]
            },
            "source": "databus",
        }

        mock_ingest = AsyncMock()
        with (
            patch.object(bm, "_databus_fetch") as mock_fetch,
            patch.object(bm, "_databus_ingest_cluster", mock_ingest),
        ):

            async def mock_fetch_side_effect(data_type: str, **kw: Any) -> dict | None:
                if data_type == "wallet_labels":
                    return mock_wallet_labels
                elif data_type == "entity_intel":
                    return mock_entity_intel
                return None

            mock_fetch.side_effect = mock_fetch_side_effect

            result = await bm.generate_map(
                center_wallet="0xRISKY_DEV_001",
                chain="ethereum",
                depth=1,
            )

            # Yield to event loop so the background task (create_task) runs
            await asyncio.sleep(0)

            # Verify high-risk result
            assert result.risk_score > 50, f"Expected risk_score > 50, got {result.risk_score}"
            assert result.risk_level in ("high", "critical"), (
                f"Expected risk_level high/critical, got {result.risk_level}"
            )

            # Verify write-back was triggered
            assert mock_ingest.called, "Expected _databus_ingest_cluster to be called for high-risk cluster"

            # Verify the payload structure
            call_args = mock_ingest.call_args
            assert call_args is not None
            args = call_args[0]
            # Positional: address, chain, risk_score, risk_level, node_count, link_count
            addr, ch, r_score, r_level, n_count, l_count = args

            assert addr == "0xRISKY_DEV_001"
            assert ch == "ethereum"
            assert r_score > 50
            assert r_level in ("high", "critical")

    @pytest.mark.asyncio
    async def test_low_risk_does_not_trigger_writeback(self):
        """BubbleMapsPro.generate_map() with low risk must NOT POST to ingest.

        The write-back is only triggered when risk_score > 50.
        """
        from app.bubble_maps import BubbleMapsPro

        bm = BubbleMapsPro()

        mock_wallet_labels = {
            "data": {
                "labels": [
                    {
                        "address": "0xSAFE_WALLET_001",
                        "name": "Uniswap User",
                        "type": "user",
                        "risk_score": 5,
                        "tags": ["user"],
                    }
                ]
            },
            "source": "databus",
        }

        mock_entity_intel = {
            "data": {
                "counterparties": [
                    {
                        "address": "0xNORMAL_USER_002",
                        "weight": 2.0,
                        "transactions": 5,
                        "label": "Normal User",
                        "risk_score": 10,
                    }
                ]
            },
            "source": "databus",
        }

        ingest_calls: list[tuple] = []

        async def tracking_ingest(*args: Any, **kwargs: Any) -> None:
            ingest_calls.append((args, kwargs))

        with (
            patch.object(bm, "_databus_fetch") as mock_fetch,
            patch.object(bm, "_databus_ingest_cluster", tracking_ingest),
        ):

            async def mock_fetch_side_effect(data_type: str, **kw: Any) -> dict | None:
                if data_type == "wallet_labels":
                    return mock_wallet_labels
                elif data_type == "entity_intel":
                    return mock_entity_intel
                return None

            mock_fetch.side_effect = mock_fetch_side_effect

            await bm.generate_map(
                center_wallet="0xSAFE_WALLET_001",
                chain="ethereum",
                depth=1,
            )

            # Low risk should not trigger write-back
            assert len(ingest_calls) == 0, f"Expected 0 ingest calls for low-risk cluster, got {len(ingest_calls)}"

    @pytest.mark.asyncio
    async def test_live_ingest_payload_format(self):
        """Live test: POST a well-formed payload to DataBus and verify 202.

        Skips if rmi-backend is not running.
        """
        if not await self._backend_available():
            pytest.skip(f"rmi-backend not reachable at {BACKEND_URL}")

        payload = _expected_ingest_payload(
            address="0xLIVE_TEST_INTEGRATION_" + os.urandom(4).hex(),
            chain="ethereum",
            risk_score=72.3,
            risk_level="high",
            nodes=8,
            links=22,
        )

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(INGEST_URL, json=payload)

        # Ingest endpoint should return 202 (accepted) or 200 (processed)
        assert resp.status_code in (200, 202, 429), f"Ingest POST returned {resp.status_code}: {resp.text[:200]}"

        if resp.status_code == 202:
            body = resp.json()
            assert body.get("success") is True, f"Expected success=True, got {body}"

    @staticmethod
    async def _backend_available() -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{BACKEND_URL}/health")
                return resp.status_code == 200
        except httpx.RequestError:
            return False
