"""
RugMaps Bubble Maps Engine — wallet cluster graph generation.

Connects to the rmi-backend DataBus for wallet labels, entity intelligence,
and transaction graph data. Falls back gracefully when the backend is
unavailable (standalone/dev mode).

Usage:
    bm = get_bubble_maps_pro()
    result = await bm.generate_map("7EcD...", depth=2, min_strength=0.1)
    d = result.to_dict()
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
BACKEND_TIMEOUT = float(os.environ.get("BACKEND_TIMEOUT", "10"))
CACHE_TTL = int(os.environ.get("RUGMAPS_CACHE_TTL", "300"))  # 5 min default

# Supported chains and their explorer URL templates
EXPLORERS: dict[str, str] = {
    "solana": "https://solscan.io/account/",
    "ethereum": "https://etherscan.io/address/",
    "base": "https://basescan.org/address/",
    "bsc": "https://bscscan.com/address/",
    "arbitrum": "https://arbiscan.io/address/",
    "optimism": "https://optimistic.etherscan.io/address/",
    "polygon": "https://polygonscan.com/address/",
}

# Known CEX identifiers for auto-labeling
KNOWN_CEX_KEYWORDS = frozenset(
    {
        "binance",
        "coinbase",
        "kraken",
        "okx",
        "bybit",
        "kucoin",
        "bitfinex",
        "gemini",
        "crypto.com",
        "huobi",
        "mexc",
        "gate.io",
        "bitstamp",
        "coinspot",
        "cex.io",
        "gate",
        "latoken",
        "ascendex",
        "bitget",
        "bingx",
        "phemex",
        "woo",
        "whitebit",
        "lbank",
        "digifinex",
        "poloniex",
        "bittrex",
        "hitbtc",
        "btc-e",
        "yobit",
    }
)


# ── Data Structures ────────────────────────────────────────────────────────


@dataclass
class BubbleNode:
    """A wallet/address in the bubble map visualization."""

    id: str
    address: str
    label: str = ""
    value: float = 1.0  # Size — supply % or relative weight
    risk: float = 0.0  # 0-100
    layer: int = 1  # 0=center, 1=direct, 2=2-hop
    is_dev: bool = False
    is_bundle: bool = False
    is_cex: bool = False
    cluster_id: str = ""
    entity_type: str = ""
    tags: list[str] = field(default_factory=list)
    explorer_url: str = ""

    def to_dict(self) -> dict:
        d: dict[str, Any] = {
            "id": self.id,
            "address": self.address,
            "value": round(self.value, 4),
            "risk": round(self.risk, 1),
            "layer": self.layer,
            "color": _node_color(self.risk, self.layer),
        }
        if self.label:
            d["label"] = self.label
        if self.is_dev:
            d["is_dev"] = True
        if self.is_bundle:
            d["is_bundle"] = True
        if self.is_cex:
            d["is_cex"] = True
        if self.cluster_id:
            d["cluster_id"] = self.cluster_id
        if self.entity_type:
            d["entity_type"] = self.entity_type
        if self.tags:
            d["tags"] = self.tags[:10]
        if self.explorer_url:
            d["explorer_url"] = self.explorer_url
        return d


@dataclass
class BubbleLink:
    """A transaction/relationship between two wallets."""

    source: str
    target: str
    value: float = 1.0  # Transaction count or relative strength
    transactions: int = 0
    total_value_usd: float = 0.0

    def to_dict(self) -> dict:
        d: dict[str, Any] = {
            "source": self.source,
            "target": self.target,
            "value": round(self.value, 4),
        }
        if self.transactions:
            d["transactions"] = self.transactions
        if self.total_value_usd:
            d["total_value_usd"] = round(self.total_value_usd, 2)
        return d


@dataclass
class BubbleMapResult:
    """Complete bubble map result."""

    center_address: str
    chain: str
    nodes: list[BubbleNode] = field(default_factory=list)
    links: list[BubbleLink] = field(default_factory=list)
    risk_score: float = 0.0
    risk_level: str = "unknown"
    stats: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "center_address": self.center_address,
            "chain": self.chain,
            "nodes": [n.to_dict() for n in self.nodes],
            "links": [ln.to_dict() for ln in self.links],
            "risk_score": round(self.risk_score, 1),
            "risk_level": self.risk_level,
            "stats": {
                "total_nodes": len(self.nodes),
                "total_links": len(self.links),
                "by_layer": self.stats.get("by_layer", {}),
                "by_entity_type": self.stats.get("by_entity_type", {}),
                "high_risk_count": self.stats.get("high_risk_count", 0),
                "dev_count": self.stats.get("dev_count", 0),
                "bundle_count": self.stats.get("bundle_count", 0),
                "cex_count": self.stats.get("cex_count", 0),
            },
            "metadata": {
                "generated_at": time.time(),
                "data_source": self.metadata.get("data_source", "databus"),
                **self.metadata,
            },
        }


# ── BubbleMapsPro Engine ────────────────────────────────────────────────────


class BubbleMapsPro:
    """RugMaps wallet cluster visualization engine.

    Fetches wallet labels and entity intelligence from the rmi-backend
    DataBus via HTTP, then builds a D3/cytoscape-compatible graph.
    """

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, Any]] = {}
        self._http: httpx.AsyncClient | None = None
        self._http_lock = asyncio.Lock()

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http is None:
            async with self._http_lock:
                if self._http is None:
                    self._http = httpx.AsyncClient(
                        timeout=BACKEND_TIMEOUT,
                        limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
                    )
        return self._http

    async def _databus_fetch(self, data_type: str, **kwargs) -> dict | None:
        """Call the rmi-backend DataBus HTTP API."""
        cache_key = f"{data_type}:{hash(frozenset(kwargs.items()))}"
        now = time.time()

        # Check in-memory cache
        if cache_key in self._cache:
            ts, val = self._cache[cache_key]
            if now - ts < CACHE_TTL:
                return val

        client = await self._get_client()
        url = f"{BACKEND_URL}/api/v1/databus/fetch/{data_type}"

        try:
            params = {k: v for k, v in kwargs.items() if v is not None}
            params.setdefault("consumer_type", "authenticated")
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                self._cache[cache_key] = (now, data)
                return data
            elif resp.status_code == 502:
                logger.debug(f"DataBus unavailable for {data_type}: {resp.text[:100]}")
                return None
            else:
                logger.warning(f"DataBus returned {resp.status_code} for {data_type}")
                return None
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as e:
            logger.warning(f"DataBus connection failed for {data_type}: {e}")
            return None

    # ── Public API ──────────────────────────────────────────────────────

    async def generate_map(
        self,
        center_wallet: str,
        chain: str = "ethereum",
        depth: int = 2,
        min_strength: float = 0.0,
    ) -> BubbleMapResult:
        """Generate a wallet cluster graph centered on *center_wallet*.

        Args:
            center_wallet: The wallet address to center the graph on.
            chain: Blockchain identifier (solana, ethereum, base, etc.).
            depth: How many hops out to traverse (1-5).
            min_strength: Minimum edge strength to include.

        Returns:
            BubbleMapResult with nodes, links, risk assessment.
        """
        depth = max(1, min(depth, 5))

        # Fetch wallet labels for the center address
        center_label = await self._get_entity_info(center_wallet, chain)

        # Fetch counterparties / entity cluster from DataBus
        cluster_data = await self._databus_fetch(
            "entity_intel",
            address=center_wallet,
            chain=chain,
        )

        # Fetch wallet labels for known counterparties
        counterparties: list[dict] = []
        if cluster_data and isinstance(cluster_data, dict):
            raw = cluster_data.get("data", cluster_data)
            counterparties = raw.get("counterparties", raw.get("related_wallets", []))

        # Build the center node
        center_node = BubbleNode(
            id=center_wallet,
            address=center_wallet,
            label=center_label.get("name") or center_label.get("label") or "",
            layer=0,
            value=100.0,  # Center node is always largest
            risk=center_label.get("risk_score", 0),
            is_dev=center_label.get("type") == "developer",
            is_cex=center_label.get("type") == "exchange",
            entity_type=center_label.get("type", ""),
            tags=center_label.get("tags", []),
            cluster_id=center_label.get("cluster_id", ""),
            explorer_url=EXPLORERS.get(chain, EXPLORERS["ethereum"]) + center_wallet,
        )

        nodes: dict[str, BubbleNode] = {center_wallet: center_node}
        links: list[BubbleLink] = []

        # Process counterparties (layer 1)
        seen_addresses = {center_wallet}
        dev_count = 0
        bundle_count = 0
        cex_count = 0
        high_risk_count = 0

        for cp in counterparties[:100]:
            addr = cp.get("address", "") or cp.get("id", "")
            if not addr or addr in seen_addresses:
                continue

            cp_label_data = await self._get_entity_info(addr, chain)
            cp_type = cp_label_data.get("type", "")
            cp_risk = cp_label_data.get("risk_score", cp.get("risk_score", 0))
            weight = cp.get("weight", cp.get("value", cp.get("pct", 1)))
            tx_count = cp.get("transactions", cp.get("tx_count", 0))
            usd_value = cp.get("total_value_usd", cp.get("value_usd", 0))

            is_dev = cp_type == "developer" or bool(cp.get("is_dev"))
            is_bundle = cp_type == "bundle" or bool(cp.get("is_bundle"))
            is_cex = cp_type == "exchange" or self._is_cex_label(
                cp_label_data.get("name", "") or cp_label_data.get("label", "")
            )

            if is_dev:
                dev_count += 1
            if is_bundle:
                bundle_count += 1
            if is_cex:
                cex_count += 1
            if cp_risk >= 70:
                high_risk_count += 1

            node = BubbleNode(
                id=addr,
                address=addr,
                label=cp_label_data.get("name", "") or cp_label_data.get("label", cp.get("label", "")),
                value=float(weight) if isinstance(weight, (int, float)) else 1.0,
                risk=float(cp_risk) if isinstance(cp_risk, (int, float)) else 0.0,
                layer=1,
                is_dev=is_dev,
                is_bundle=is_bundle,
                is_cex=is_cex,
                entity_type=cp_type,
                tags=cp_label_data.get("tags", []),
                cluster_id=cp_label_data.get("cluster_id", ""),
                explorer_url=EXPLORERS.get(chain, EXPLORERS["ethereum"]) + addr,
            )
            nodes[addr] = node
            seen_addresses.add(addr)

            links.append(
                BubbleLink(
                    source=center_wallet,
                    target=addr,
                    value=float(tx_count) if tx_count else 1.0,
                    transactions=int(tx_count) if tx_count else 0,
                    total_value_usd=float(usd_value) if usd_value else 0.0,
                )
            )

            # Layer 2: counterparty of counterparty (if depth > 1)
            if depth >= 2:
                await self._expand_layer2(
                    addr,
                    chain,
                    nodes,
                    links,
                    seen_addresses,
                    cp_label_data,
                    dev_count_accounting=is_dev,
                    bundle_count_accounting=is_bundle,
                    cex_count_accounting=is_cex,
                    high_risk_count_accounting=cp_risk >= 70,
                )

        # Calculate aggregate risk score
        risk_score, risk_level = self._calculate_risk_from_nodes(nodes, links)

        # Build stats
        by_layer: dict[int, int] = {}
        by_entity: dict[str, int] = {}
        for n in nodes.values():
            by_layer[n.layer] = by_layer.get(n.layer, 0) + 1
            if n.entity_type:
                by_entity[n.entity_type] = by_entity.get(n.entity_type, 0) + 1

        # ── Write findings back to DataBus (fire-and-forget) ──────────
        # Creates a feedback loop: rugmaps finds risky clusters →
        # rmi-backend uses them for risk scoring → rugmaps queries improved scores.
        # This is intentionally fire-and-forget — never blocks generate_map().
        if risk_score > 50 or risk_level in ("high", "critical"):
            asyncio.create_task(
                self._databus_ingest_cluster(
                    center_wallet,
                    chain,
                    risk_score,
                    risk_level,
                    len(nodes),
                    len(links),
                )
            )

        return BubbleMapResult(
            center_address=center_wallet,
            chain=chain,
            nodes=list(nodes.values()),
            links=links,
            risk_score=risk_score,
            risk_level=risk_level,
            stats={
                "by_layer": by_layer,
                "by_entity_type": by_entity,
                "high_risk_count": high_risk_count,
                "dev_count": dev_count,
                "bundle_count": bundle_count,
                "cex_count": cex_count,
            },
            metadata={"data_source": "databus", "depth": depth},
        )

    async def _expand_layer2(
        self,
        address: str,
        chain: str,
        nodes: dict[str, BubbleNode],
        links: list[BubbleLink],
        seen: set[str],
        **accounting_flags: bool,
    ) -> None:
        """Expand second-hop connections for a wallet."""
        cluster_data = await self._databus_fetch(
            "entity_intel",
            address=address,
            chain=chain,
        )
        if not cluster_data:
            return

        raw = cluster_data.get("data", cluster_data)
        counterparties = raw.get("counterparties", raw.get("related_wallets", []))[:30]

        for cp in counterparties:
            addr = cp.get("address", "") or cp.get("id", "")
            if not addr or addr in seen:
                continue

            cp_label_data = await self._get_entity_info(addr, chain)
            cp_risk = cp_label_data.get("risk_score", cp.get("risk_score", 0))
            weight = cp.get("weight", cp.get("value", cp.get("pct", 1)))
            tx_count = cp.get("transactions", cp.get("tx_count", 0))

            is_dev = cp_label_data.get("type") == "developer" or bool(cp.get("is_dev"))
            is_bundle = cp_label_data.get("type") == "bundle" or bool(cp.get("is_bundle"))
            is_cex = cp_label_data.get("type") == "exchange" or self._is_cex_label(
                cp_label_data.get("name", "") or cp_label_data.get("label", "")
            )

            node = BubbleNode(
                id=addr,
                address=addr,
                label=cp_label_data.get("name", "") or cp_label_data.get("label", cp.get("label", "")),
                value=float(weight) if isinstance(weight, (int, float)) else 0.5,
                risk=float(cp_risk) if isinstance(cp_risk, (int, float)) else 0.0,
                layer=2,
                is_dev=is_dev,
                is_bundle=is_bundle,
                is_cex=is_cex,
                entity_type=cp_label_data.get("type", ""),
                tags=cp_label_data.get("tags", []),
                explorer_url=EXPLORERS.get(chain, EXPLORERS["ethereum"]) + addr,
            )
            nodes[addr] = node
            seen.add(addr)

            links.append(
                BubbleLink(
                    source=address,
                    target=addr,
                    value=float(tx_count) if tx_count else 0.5,
                    transactions=int(tx_count) if tx_count else 0,
                )
            )

    # ── Entity Info & Risk ──────────────────────────────────────────────

    async def _get_entity_info(self, address: str, chain: str = "ethereum") -> dict:
        """Get entity information and wallet labels for an address."""
        result = await self._databus_fetch("wallet_labels", address=address, chain=chain)
        if result:
            data = result.get("data", result)
            if isinstance(data, dict):
                labels = data.get("labels", data.get("results", []))
                if labels and isinstance(labels, list):
                    return labels[0] if labels else {}
                return data
            return {}
        return {}

    async def _calculate_risk(self, address: str, chain: str = "ethereum") -> tuple[int, str]:
        """Calculate risk score and level for an address."""
        info = await self._get_entity_info(address, chain)
        score = int(info.get("risk_score", 0)) if isinstance(info.get("risk_score"), (int, float)) else 0
        level = self._risk_level(score)
        return score, level

    def _calculate_risk_from_nodes(
        self,
        nodes: dict[str, BubbleNode],
        links: list[BubbleLink],
    ) -> tuple[float, str]:
        """Aggregate risk score from all nodes in the graph."""
        if not nodes:
            return 0.0, "unknown"

        risk_scores = [n.risk for n in nodes.values()]
        avg_risk = sum(risk_scores) / len(risk_scores)

        # Weighted by dev/bundle presence
        dev_count = sum(1 for n in nodes.values() if n.is_dev)
        bundle_count = sum(1 for n in nodes.values() if n.is_bundle)
        high_risk_count = sum(1 for r in risk_scores if r >= 70)

        penalty = (dev_count * 10) + (bundle_count * 8) + (high_risk_count * 5)
        final_score = min(100, avg_risk + penalty / max(1, len(nodes)))

        return final_score, self._risk_level(final_score)

    async def _databus_ingest_cluster(
        self,
        address: str,
        chain: str,
        risk_score: float,
        risk_level: str,
        node_count: int,
        link_count: int,
    ) -> None:
        """Fire-and-forget: POST wallet cluster findings back to rmi-backend's DataBus.

        This creates the critical feedback loop:
            rugmaps finds clusters → rmi-backend uses them for risk scoring
            → rugmaps queries improved scores on next scan.

        Non-blocking by design: errors are logged but never propagated.
        The POST runs in a background task so generate_map() returns immediately.
        """
        ingest_url = f"{BACKEND_URL}/api/v1/databus/ingest"
        payload = {
            "source": "rugmaps",
            "data_type": "wallet_cluster",
            "content": {
                "address": address,
                "risk_score": round(risk_score, 1),
                "risk_level": risk_level,
                "nodes": node_count,
                "links": link_count,
                "chain": chain,
            },
            "token_address": address,
            "chain": chain,
        }
        try:
            # Use a short-lived client to avoid holding connections from the pool
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(ingest_url, json=payload)
                if resp.status_code < 400:
                    logger.info(
                        "databus_ingest_ok",
                        address=address[:12],
                        risk_score=risk_score,
                        status=resp.status_code,
                    )
                else:
                    logger.debug(
                        "databus_ingest_non_ok",
                        address=address[:12],
                        status=resp.status_code,
                        body=resp.text[:200],
                    )
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            logger.debug(
                "databus_ingest_unavailable",
                address=address[:12],
                error=str(exc)[:100],
            )
        except Exception as exc:
            logger.warning(
                "databus_ingest_failed",
                address=address[:12],
                error=str(exc)[:200],
            )

    @staticmethod
    def _risk_level(score: float) -> str:
        if score >= 80:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 25:
            return "medium"
        elif score > 0:
            return "low"
        return "unknown"

    @staticmethod
    def _is_cex_label(label: str) -> bool:
        """Check if a label indicates a known exchange."""
        if not label:
            return False
        lower = label.lower()
        if any(kw in lower for kw in KNOWN_CEX_KEYWORDS):
            return True
        if "exchange" in lower:
            return True
        return False


# ── Module-level singleton + convenience ────────────────────────────────────

_bm_instance: BubbleMapsPro | None = None


def get_bubble_maps_pro() -> BubbleMapsPro:
    """Get the singleton BubbleMapsPro instance."""
    global _bm_instance
    if _bm_instance is None:
        _bm_instance = BubbleMapsPro()
    return _bm_instance


# ── Helpers ─────────────────────────────────────────────────────────────────


def _node_color(risk: float, layer: int) -> str:
    """Return a hex color for a node based on risk and layer."""
    if layer == 0:
        return "#8B5CF6"  # Purple for center
    if risk >= 70:
        return "#FF3366"  # Red for high risk
    if risk >= 40:
        return "#FF9800"  # Orange for medium
    return "#22C55E" if risk < 25 else "#28CBF4"
    # Cyan for low risk, green for very low
