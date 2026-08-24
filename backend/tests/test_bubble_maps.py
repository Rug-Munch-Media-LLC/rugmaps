"""
RugMaps Backend — Bubble Maps Tests.

Tests the core bubble_maps module, auto_labeler, and HTTP endpoints.
Uses mocked DataBus HTTP responses for deterministic testing.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import httpx
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

        # Kwargs-keyed mock: robust to concurrent/parallel fetch ordering.
        def fake_databus(data_type: str, **kwargs):
            if data_type == "wallet_labels":
                addr = kwargs.get("address", "")
                names = {
                    "0xabc...": {"name": "Test Wallet", "type": "wallet", "risk_score": 10},
                    "0xdead...": {"name": "Uniswap Router", "type": "contract", "risk_score": 5},
                    "0xbeef...": {"name": "Suspected Bot", "type": "mev_bot", "risk_score": 80},
                }
                return {"data": {"labels": [names.get(addr, {})]}}
            if data_type == "entity_intel":
                if kwargs.get("address") == "0xabc...":
                    return {
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
                    }
                return {"data": {"counterparties": []}}
            return None

        bm._databus_fetch = AsyncMock(side_effect=fake_databus)

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


# ── Similarity Search (single-system rugbrain client) Tests ──────────────


class TestSimilaritySearch:
    """Tests for the rugbrain-backed similarity search client."""

    @pytest.mark.asyncio
    async def test_search_multi_normalizes_results(self):
        """search_multi() should normalize rugbrain results to metadata+score."""
        from unittest.mock import patch

        from app.ann_index import SimilaritySearch

        sim = SimilaritySearch()
        fake_resp = type(
            "R",
            (),
            {
                "status_code": 200,
                "json": staticmethod(
                    lambda: {
                        "results": [
                            {"metadata": {"description": "honeypot pattern", "pattern": "sell_tax"}, "score": 0.91},
                            {"payload": {"description": "bundle scam"}, "score": 0.72},
                        ]
                    }
                ),
            },
        )()

        async def fake_post(*a, **kw):
            return fake_resp

        with patch.object(httpx.AsyncClient, "post", new=fake_post):
            results = await sim.search_multi(["scam_patterns", "known_scams"], "rug pull", k=5)
        assert len(results) == 2
        assert results[0]["metadata"]["pattern"] == "sell_tax"
        assert results[0]["score"] == 0.91
        assert results[1]["metadata"]["description"] == "bundle scam"

    @pytest.mark.asyncio
    async def test_search_returns_empty_on_unavailable(self):
        """Backend down → empty list, never an exception (graceful)."""
        from app.ann_index import SimilaritySearch

        sim = SimilaritySearch()
        # Point at a dead port so connection fails fast
        import app.ann_index as ann_mod

        ann_mod.RAG_API_URL = "http://127.0.0.1:1/api/v1"
        try:
            results = await sim.search("scam_patterns", "rug pull honeypot", k=5)
            assert isinstance(results, list)
            assert len(results) == 0
        finally:
            ann_mod.RAG_API_URL = "http://127.0.0.1:8012/api/v1"

    @pytest.mark.asyncio
    async def test_collection_map_covers_logical_indexes(self):
        """Logical index names must map to real Qdrant collections."""
        from app.ann_index import COLLECTION_MAP

        assert COLLECTION_MAP["scam_patterns"] == ["scam_patterns"]
        assert COLLECTION_MAP["known_scams"] == ["known_scams"]
        assert COLLECTION_MAP["wallet_profiles"] == ["wallet_embeddings"]

    @pytest.mark.asyncio
    async def test_search_similar_scams_dedupes(self):
        """search_similar_scams() dedupes by description and caps at 10."""
        from unittest.mock import patch

        import app.rugmaps_ai as ai

        async def fake_search(indexes, query, k=10):
            return [
                {"metadata": {"description": "same desc"}, "score": 0.9},
                {"metadata": {"description": "same desc"}, "score": 0.8},
                {"metadata": {"description": "unique one"}, "score": 0.7},
            ]

        with patch("app.ann_index.get_similarity_search") as g:
            inst = type("S", (), {"search_multi": staticmethod(fake_search)})()
            g.return_value = inst
            out = await ai.search_similar_scams("0xtok", "ethereum")
        descs = [x["description"] for x in out]
        assert len(descs) == len(set(descs))
        assert "unique one" in descs


# ── Graph Traversal & Verdict Guard (2026-08-24 audit fixes) ─────────────


class TestGraphTraversal:
    """BFS traversal with intra-cluster edge discovery."""

    @pytest.mark.asyncio
    async def test_intra_cluster_edges_discovered(self):
        """L1↔L1 edges (bundle signal) must appear in links, not just spokes."""
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
                                {"address": "0xa1", "weight": 10.0, "transactions": 20},
                                {"address": "0xa2", "weight": 10.0, "transactions": 20},
                            ]
                        }
                    }
                if addr in ("0xa1", "0xa2"):
                    # a1 and a2 transact with EACH OTHER — the bundle signature.
                    other = "0xa2" if addr == "0xa1" else "0xa1"
                    return {
                        "data": {
                            "counterparties": [
                                {"address": other, "weight": 5.0, "transactions": 9},
                            ]
                        }
                    }
            return None

        bm._databus_fetch = AsyncMock(side_effect=fake_databus)
        result = await bm.generate_map(center_wallet="0xcenter", chain="ethereum", depth=2)

        pairs = {frozenset((ln.source, ln.target)) for ln in result.links}
        assert frozenset(("0xa1", "0xa2")) in pairs, (
            "Intra-cluster edge between two L1 wallets missing — cluster detection broken"
        )
        # No duplicate/reverse duplicates
        assert len(pairs) == len(result.links)

    @pytest.mark.asyncio
    async def test_depth3_expands_three_layers(self):
        """depth=3 must actually reach layer-3 nodes (honest depth)."""
        from app.bubble_maps import get_bubble_maps_pro

        bm = get_bubble_maps_pro()

        def fake_databus(data_type: str, **kwargs):
            addr = kwargs.get("address", "")
            if data_type == "wallet_labels":
                return {"data": {"labels": [{"name": f"W {addr[:8]}", "risk_score": 5}]}}
            if data_type == "entity_intel":
                tree = {
                    "0xc": ["0xl1a"],
                    "0xl1a": ["0xl2a"],
                    "0xl2a": ["0xl3a"],
                }
                children = tree.get(addr, [])
                return {"data": {"counterparties": [{"address": c, "weight": 1.0} for c in children]}}
            return None

        bm._databus_fetch = AsyncMock(side_effect=fake_databus)
        result = await bm.generate_map(center_wallet="0xc", chain="ethereum", depth=3)

        layers = {n.id: n.layer for n in result.nodes}
        assert layers.get("0xl1a") == 1
        assert layers.get("0xl2a") == 2
        assert layers.get("0xl3a") == 3, "depth=3 did not traverse to layer 3"

    @pytest.mark.asyncio
    async def test_depth_clamped_to_max(self):
        """Depths beyond MAX_DEPTH are clamped, not silently mis-traversed."""
        from app.bubble_maps import MAX_DEPTH, get_bubble_maps_pro

        bm = get_bubble_maps_pro()
        bm._databus_fetch = AsyncMock(return_value=None)
        result = await bm.generate_map(center_wallet="0xc", chain="ethereum", depth=99)
        assert result.metadata["depth"] == MAX_DEPTH

    @pytest.mark.asyncio
    async def test_cache_eviction(self):
        """Cache must evict oldest entries beyond CACHE_MAX_ENTRIES."""
        from app.bubble_maps import CACHE_MAX_ENTRIES, get_bubble_maps_pro

        bm = get_bubble_maps_pro()
        bm._cache.clear()
        for i in range(CACHE_MAX_ENTRIES + 50):
            bm._cache[f"k{i}"] = (float(i), {"i": i})
        bm._cache_evict()
        assert len(bm._cache) <= CACHE_MAX_ENTRIES
        # Oldest keys evicted, newest retained
        assert "k0" not in bm._cache
        assert f"k{CACHE_MAX_ENTRIES + 49}" in bm._cache


class TestVerdictGuard:
    """Empty/insufficient graphs must NEVER produce a SAFE verdict."""

    def test_fallback_analysis_insufficient_nodes(self):
        from app.rugmaps_ai import generate_fallback_analysis

        result = generate_fallback_analysis(
            risk_score=0, holders=[], labels={}, similar_scams=[], node_count=1, link_count=0
        )
        assert result["verdict"] == "UNKNOWN"
        assert result["status"] == "insufficient_data"
        assert result["confidence"] == 0

    def test_insufficient_data_shape(self):
        from app.rugmaps_ai import insufficient_data_analysis

        d = insufficient_data_analysis(1, "0xtoken123456", "ethereum")
        assert d["verdict"] == "UNKNOWN"
        assert d["risk_score"] is None
        assert "NOT a safety signal" in d["summary"]
        assert d["green_flags"] == []

    def test_min_nodes_threshold_exists(self):
        from app.rugmaps_ai import MIN_NODES_FOR_VERDICT

        assert MIN_NODES_FOR_VERDICT >= 3
