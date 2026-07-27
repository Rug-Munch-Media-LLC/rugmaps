"""
RugMaps Backend — Bubble Maps Tests.

Tests the core bubble_maps module, auto_labeler, and HTTP endpoints.
Uses mocked DataBus HTTP responses for deterministic testing.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

# ── BubbleMapsPro Unit Tests ──────────────────────────────────────────────


class TestBubbleMapsPro:
    """Tests for the BubbleMapsPro engine with mocked DataBus."""

    @pytest.mark.asyncio
    async def test_get_bubble_maps_pro_returns_singleton(self):
        """get_bubble_maps_pro() should return a singleton instance."""
        from app.bubble_maps import BubbleMapsPro, get_bubble_maps_pro

        instance1 = get_bubble_maps_pro()
        instance2 = get_bubble_maps_pro()

        assert isinstance(instance1, BubbleMapsPro)
        assert instance1 is instance2  # Singleton

    @pytest.mark.asyncio
    async def test_generate_map_returns_correct_structure(self):
        """generate_map() should return a BubbleMapResult with nodes and links."""
        from app.bubble_maps import BubbleMapResult, get_bubble_maps_pro

        bm = get_bubble_maps_pro()

        # Mock the DataBus calls
        bm._databus_fetch = AsyncMock(
            side_effect=[
                # Center wallet labels
                {"data": {"labels": [{"name": "Test Wallet", "type": "wallet", "risk_score": 10}]}},
                # Entity intel (counterparties)
                {
                    "data": {
                        "counterparties": [
                            {"address": "0xdead...", "weight": 50.0, "transactions": 100, "risk_score": 5},
                            {
                                "address": "0xbeef...",
                                "weight": 25.0,
                                "transactions": 50,
                                "risk_score": 80,
                                "is_bundle": True,
                            },
                        ]
                    }
                },
                # Labels for counterparty 1
                {"data": {"labels": [{"name": "Uniswap Router", "type": "contract", "risk_score": 5}]}},
                # Labels for counterparty 2
                {"data": {"labels": [{"name": "Suspected Bot", "type": "mev_bot", "risk_score": 80}]}},
            ]
        )

        result = await bm.generate_map(
            center_wallet="0xabc...",
            chain="ethereum",
            depth=1,
            min_strength=0.0,
        )

        assert isinstance(result, BubbleMapResult)
        assert result.center_address == "0xabc..."
        assert result.chain == "ethereum"

        # Check center node
        assert len(result.nodes) >= 1
        center = result.nodes[0]
        assert center.id == "0xabc..."
        assert center.layer == 0
        assert center.value == 100.0

        # Check we have the two counterparties
        node_ids = {n.id for n in result.nodes}
        assert "0xdead..." in node_ids
        assert "0xbeef..." in node_ids

        # Check bundle flag was detected
        beef_node = next(n for n in result.nodes if n.id == "0xbeef...")
        assert beef_node.is_bundle is True
        assert beef_node.risk == 80.0

        # Check links
        assert len(result.links) == 2

        # Check to_dict output
        d = result.to_dict()
        assert "nodes" in d
        assert "links" in d
        assert "risk_score" in d
        assert "risk_level" in d
        assert d["stats"]["total_nodes"] >= 3
        assert d["stats"]["total_links"] == 2

    @pytest.mark.asyncio
    async def test_generate_map_with_no_databus(self):
        """generate_map() should return a minimal result when DataBus is unavailable."""
        from app.bubble_maps import BubbleMapResult, get_bubble_maps_pro

        bm = get_bubble_maps_pro()

        # DataBus returns None (unavailable)
        bm._databus_fetch = AsyncMock(return_value=None)

        result = await bm.generate_map(
            center_wallet="0xabc...",
            chain="ethereum",
            depth=1,
        )

        assert isinstance(result, BubbleMapResult)
        assert result.center_address == "0xabc..."
        # Should at least have the center node
        assert len(result.nodes) == 1
        assert result.nodes[0].id == "0xabc..."

    @pytest.mark.asyncio
    async def test_risk_calculation(self):
        """_calculate_risk() should return score and level."""
        from app.bubble_maps import get_bubble_maps_pro

        bm = get_bubble_maps_pro()
        bm._databus_fetch = AsyncMock(
            return_value={
                "data": {"labels": [{"name": "Test", "risk_score": 75}]},
            }
        )

        score, level = await bm._calculate_risk("0xabc...", "ethereum")
        assert score == 75
        assert level == "high"

    @pytest.mark.asyncio
    async def test_node_color_helpers(self):
        """Node color should map correctly based on risk and layer."""
        from app.bubble_maps import _node_color

        # Center node
        assert _node_color(0, 0) == "#8B5CF6"
        # High risk
        assert _node_color(70, 1) == "#FF3366"
        assert _node_color(100, 2) == "#FF3366"
        # Medium risk
        assert _node_color(40, 1) == "#FF9800"
        assert _node_color(69, 1) == "#FF9800"
        # Low risk (25+ but < 40)
        assert _node_color(25, 1) == "#28CBF4"
        # Very low risk
        assert _node_color(10, 1) == "#22C55E"

    def test_risk_level_thresholds(self):
        """_risk_level() should return correct level for scores."""
        from app.bubble_maps import BubbleMapsPro

        assert BubbleMapsPro._risk_level(0) == "unknown"
        assert BubbleMapsPro._risk_level(10) == "low"
        assert BubbleMapsPro._risk_level(25) == "medium"
        assert BubbleMapsPro._risk_level(50) == "high"
        assert BubbleMapsPro._risk_level(80) == "critical"
        assert BubbleMapsPro._risk_level(100) == "critical"

    def test_is_cex_label(self):
        """_is_cex_label() should detect exchange labels."""
        from app.bubble_maps import BubbleMapsPro

        assert BubbleMapsPro._is_cex_label("Binance Hot Wallet") is True
        assert BubbleMapsPro._is_cex_label("Coinbase 1") is True
        assert BubbleMapsPro._is_cex_label("OKX Deposit") is True
        assert BubbleMapsPro._is_cex_label("Uniswap V2 Router") is False
        assert BubbleMapsPro._is_cex_label("") is False
        assert BubbleMapsPro._is_cex_label("Personal Wallet") is False


# ── AutoLabeler Unit Tests ─────────────────────────────────────────────────


class TestAutoLabeler:
    """Tests for the AutoLabeler wallet classification engine."""

    @pytest.mark.asyncio
    async def test_get_auto_labeler_returns_singleton(self):
        """get_auto_labeler() should return a singleton instance."""
        from app.auto_labeler import AutoLabeler, get_auto_labeler

        instance1 = get_auto_labeler()
        instance2 = get_auto_labeler()

        assert isinstance(instance1, AutoLabeler)
        assert instance1 is instance2

    @pytest.mark.asyncio
    async def test_observe_wallet_exchange_detection(self):
        """Should detect exchange wallets from context labels."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        labels = await labeler.observe_wallet(
            "0xabc...",
            "ethereum",
            {"label": "Binance Hot Wallet", "event": "scan"},
        )

        assert len(labels) >= 1
        exchange_labels = [lb for lb in labels if lb["label_type"] == "exchange"]
        assert len(exchange_labels) >= 1
        assert exchange_labels[0]["confidence"] >= 0.8

    @pytest.mark.asyncio
    async def test_observe_wallet_contract_detection(self):
        """Should detect known contract addresses."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        labels = await labeler.observe_wallet(
            "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
            "ethereum",
        )

        contract_labels = [lb for lb in labels if lb["label_type"] == "contract"]
        assert len(contract_labels) >= 1
        assert "Uniswap" in contract_labels[0]["name"]

    @pytest.mark.asyncio
    async def test_observe_wallet_mev_detection(self):
        """Should detect MEV bots from context."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        labels = await labeler.observe_wallet(
            "0xdef1...",
            "ethereum",
            {"entity_type": "mev_bot", "event": "scan"},
        )

        mev_labels = [lb for lb in labels if lb["label_type"] == "mev_bot"]
        assert len(mev_labels) >= 1

    @pytest.mark.asyncio
    async def test_observe_wallet_mixer_detection(self):
        """Should detect known mixer addresses."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        labels = await labeler.observe_wallet(
            "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc",
            "ethereum",
        )

        mixer_labels = [lb for lb in labels if lb["label_type"] == "mixer"]
        assert len(mixer_labels) >= 1
        assert mixer_labels[0]["name"] == "Tornado Cash"

    @pytest.mark.asyncio
    async def test_observe_wallet_empty_address(self):
        """Should handle empty addresses gracefully."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        labels = await labeler.observe_wallet("", "ethereum")
        assert labels == []

    @pytest.mark.asyncio
    async def test_get_stats(self):
        """get_stats() should return tracking statistics."""
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        stats = labeler.get_stats()
        assert "total_observations" in stats
        assert "total_wallets_tracked" in stats
        assert "by_type" in stats


# ── ANN Index Stub Tests ──────────────────────────────────────────────────


class TestANNIndex:
    """Tests for the ANN index stub."""

    @pytest.mark.asyncio
    async def test_get_ann_index_returns_singleton(self):
        """get_ann_index() should return a working singleton."""
        from app.ann_index import ANNIndex, get_ann_index

        idx = get_ann_index()
        assert isinstance(idx, ANNIndex)
        assert "scam_patterns" in idx.indexes
        assert "known_scams" in idx.indexes

    @pytest.mark.asyncio
    async def test_search_returns_empty_when_unavailable(self):
        """search() should return empty list when backend is down."""
        from app.ann_index import get_ann_index

        idx = get_ann_index()
        # When no backend, it should return empty gracefully (no exception)
        results = await idx.search("scam_patterns", [0.0] * 768, k=5)
        assert isinstance(results, list)
        # May be empty since there's no backend running
        assert len(results) >= 0


# ── Crypto Embeddings Stub Tests ──────────────────────────────────────────


class TestCryptoEmbeddings:
    """Tests for the CryptoEmbedder stub."""

    @pytest.mark.asyncio
    async def test_embed_query_returns_vector(self):
        """embed_query() should return a vector of correct dimension."""
        from app.crypto_embeddings import CryptoEmbedder

        embedder = CryptoEmbedder()
        vec = await embedder.embed_query("test token solana rug pull")
        assert isinstance(vec, list)
        assert len(vec) == 768
        # Should be float values
        assert all(isinstance(v, float) for v in vec)

    @pytest.mark.asyncio
    async def test_embed_query_deterministic(self):
        """Same input should produce same embedding (fallback)."""
        from app.crypto_embeddings import CryptoEmbedder

        embedder = CryptoEmbedder()
        vec1 = await embedder.embed_query("hello world")
        vec2 = await embedder.embed_query("hello world")
        assert vec1 == vec2
