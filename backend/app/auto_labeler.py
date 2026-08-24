"""
RugMaps Auto-Labeler — automatic wallet classification.

Detects exchange wallets, contract addresses, MEV bots, deployers,
and other known entity types based on on-chain patterns and heuristics.

Usage:
    labeler = get_auto_labeler()
    labels = await labeler.observe_wallet("0x...", "ethereum", {"event": "scanned"})
    stats = labeler.get_stats()
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ── Heuristic Patterns ─────────────────────────────────────────────────────

# Known exchange deposit addresses patterns (hot wallets)
EXCHANGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^(0x)?[0-9a-fA-F]{40}$"), "evm_address"),  # generic check
]

# Known exchange label keywords (from wallet labels dataset)
CEX_KEYWORDS = frozenset(
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
    }
)

# MEV bot address patterns
MEV_PATTERNS: list[re.Pattern] = [
    re.compile(r"^0x[0-9a-fA-F]{40}$"),  # Valid EVM address (checked further by hints)
]

# Known MEV-related keywords in labels
MEV_KEYWORDS = frozenset(
    {
        "mev",
        "sandwich",
        "flashbot",
        "flashbots",
        "searcher",
        "arbitrage",
        "builder",
        "relay",
        "extractor",
    }
)

# Solana-specific patterns
SOLANA_PROGRAM_IDS: dict[str, str] = {
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "SPL Token Program",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xr25z9LT3r6PJqz": "SPL Associated Token Account",
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": "Metaplex Token Metadata",
    "worm2ZoG2kUd4vFXhvjh93UUH596ayR3Q3UUzi": "Wormhole Bridge",
    "JUP6LkbZbjS1jKKwapdHX74JK9eKHTcxhpdwEBc": "Jupiter DEX",
    "675kPX9MHTjS2zt1EMQHhPpSeQEzXvSsAAhKwCw": "Raydium Liquidity Pool",
    "p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfu98": "Pyth Oracle",
}

# EVM-known contract patterns
KNOWN_CONTRACT_PREFIXES: dict[str, str] = {
    "0x7a250d": "Uniswap V2 Router",
    "0x68b346": "Uniswap V3 Router",
    "0xe59242": "Uniswap V3 Swap Router",
    "0xDef1C0": "0x Exchange Proxy",
    "0x111111": "1inch Router",
    "0xd9e1cE": "Curve Registry",
    "0xBA1222": "Balancer Vault",
    "0xC92E8b": "PancakeSwap Router",
    "0x10ED43": "PancakeSwap V2 Router",
    "0x13f4EA": "SushiSwap Router",
    "0xd9e1": "MakerDAO",
    "0x00000000000000000000000000000000000000ff": "ERC-1967 Proxy",
}

# Tornado Cash / mixer patterns
MIXER_ADDRESSES: set[str] = {
    # Tornado Cash (ETH)
    "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc",
    "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",
    "0xa160cdab225685da1d56aa342ad8841c3b53f291",
    "0xd4b88df4d29f5cedd6857912842cff3b20c4cfa3",
    "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",
    "0x07687e702b410Fa43f4cB4Af7FA097918ffD2730",
    "0x23773e65ed146a459791799d01336db255f172cf",
}


@dataclass
class WalletObservation:
    """A recorded observation about a wallet."""

    address: str
    chain: str
    event: str
    timestamp: float
    labels: list[WalletLabel] = field(default_factory=list)


@dataclass
class WalletLabel:
    """A label applied to a wallet."""

    label_type: str  # exchange, contract, mev_bot, deployer, mixer, token, unknown
    name: str
    confidence: float  # 0.0 - 1.0
    source: str = "auto_labeler"
    metadata: dict = field(default_factory=dict)


class AutoLabeler:
    """Automatic wallet labeling engine.

    Uses heuristic patterns and known address databases to classify
    wallet addresses by their behavior and known associations.
    """

    def __init__(self) -> None:
        self._observations: dict[str, list[WalletObservation]] = defaultdict(list)
        self._labels_cache: dict[str, list[WalletLabel]] = {}
        self._stats: dict[str, int] = defaultdict(int)

    async def observe_wallet(
        self,
        address: str,
        chain: str = "ethereum",
        context: dict | None = None,
    ) -> list[dict]:
        """Observe a wallet and return any labels generated.

        Args:
            address: The wallet address.
            chain: Blockchain identifier.
            context: Optional context dict (event, token, risk, etc.).

        Returns:
            List of label dicts applied to this wallet.
        """
        if not address:
            return []

        event = (context or {}).get("event", "observation")
        obs = WalletObservation(
            address=address,
            chain=chain,
            event=event,
            timestamp=__import__("time").time(),
        )

        # Run classifiers
        labels: list[WalletLabel] = []

        # 1. Exchange detection
        if label := await self._detect_exchange(address, chain, context):
            labels.append(label)

        # 2. Contract detection
        if label := await self._detect_contract(address, chain):
            labels.append(label)

        # 3. MEV bot detection
        if label := await self._detect_mev_bot(address, chain, context):
            labels.append(label)

        # 4. Mixer detection
        if label := await self._detect_mixer(address, chain):
            labels.append(label)

        # 5. Solana program detection
        if chain == "solana":
            if label := await self._detect_solana_program(address):
                labels.append(label)

        # If no specific label found, mark as unknown wallet
        if not labels:
            labels.append(
                WalletLabel(
                    label_type="wallet",
                    name=f"Unlabeled {chain[:3]} wallet",
                    confidence=0.3,
                    source="auto_labeler_fallback",
                )
            )

        obs.labels = labels
        self._observations[address].append(obs)

        # Cache labels by address
        self._labels_cache[address] = labels

        # Update stats
        self._stats["total_observations"] += 1
        self._stats[f"type:{labels[0].label_type}"] += 1

        return [lb.__dict__ for lb in labels]

    async def _detect_exchange(
        self,
        address: str,
        chain: str,
        context: dict | None = None,
    ) -> WalletLabel | None:
        """Detect if address is a known exchange wallet."""
        # Check known exchange addresses from context labels
        label_from_context = (context or {}).get("label", "")
        if label_from_context:
            lower = label_from_context.lower()
            for kw in CEX_KEYWORDS:
                if kw in lower:
                    return WalletLabel(
                        label_type="exchange",
                        name=label_from_context,
                        confidence=0.9,
                        source="auto_labeler_exchange_keyword",
                        metadata={"keyword": kw, "context_label": label_from_context},
                    )

        # Check entity type from context
        entity_type = (context or {}).get("entity_type", "")
        if entity_type == "exchange":
            exchange_name = (context or {}).get("name", "Unknown Exchange")
            return WalletLabel(
                label_type="exchange",
                name=exchange_name,
                confidence=0.85,
                source="auto_labeler_entity_type",
            )

        return None

    async def _detect_contract(self, address: str, chain: str) -> WalletLabel | None:
        """Detect if address is a smart contract."""
        if chain == "solana":
            # Solana program IDs are typically base58, 32-44 chars
            if len(address) >= 32 and len(address) <= 44:
                if address.startswith(("G", "7", "8", "9", "D", "E", "F", "A")):
                    return WalletLabel(
                        label_type="contract",
                        name="Solana Program",
                        confidence=0.5,
                        source="auto_labeler_solana_program",
                    )
            return None

        # EVM: check known contract prefixes
        if address.startswith("0x"):
            addr_lower = address.lower()
            for prefix, known_name in KNOWN_CONTRACT_PREFIXES.items():
                if addr_lower.startswith(prefix):
                    return WalletLabel(
                        label_type="contract",
                        name=known_name,
                        confidence=0.95,
                        source="auto_labeler_known_contract",
                        metadata={"prefix": prefix},
                    )

        return None

    async def _detect_mev_bot(
        self,
        address: str,
        chain: str,
        context: dict | None = None,
    ) -> WalletLabel | None:
        """Detect if address is an MEV bot."""
        # Check context for MEV hints
        label = (context or {}).get("label", "")
        tags = (context or {}).get("tags", [])
        entity_type = (context or {}).get("entity_type", "")

        # Check label
        if label:
            lower = label.lower()
            for kw in MEV_KEYWORDS:
                if kw in lower:
                    return WalletLabel(
                        label_type="mev_bot",
                        name=label,
                        confidence=0.8,
                        source="auto_labeler_mev_keyword",
                        metadata={"keyword": kw},
                    )

        # Check tags
        for tag in tags:
            if isinstance(tag, str) and tag.lower() in MEV_KEYWORDS:
                return WalletLabel(
                    label_type="mev_bot",
                    name=f"MEV Bot ({tag})",
                    confidence=0.75,
                    source="auto_labeler_mev_tag",
                )

        # Check entity type
        if entity_type == "mev_bot" or entity_type == "searcher":
            return WalletLabel(
                label_type="mev_bot",
                name=entity_type.replace("_", " ").title(),
                confidence=0.85,
                source="auto_labeler_entity_type",
            )

        return None

    async def _detect_mixer(self, address: str, chain: str) -> WalletLabel | None:
        """Detect if address is a known mixer/tumbler."""
        if chain == "ethereum" and address.lower() in {a.lower() for a in MIXER_ADDRESSES}:
            return WalletLabel(
                label_type="mixer",
                name="Tornado Cash",
                confidence=0.99,
                source="auto_labeler_known_mixer",
            )
        return None

    async def _detect_solana_program(self, address: str) -> WalletLabel | None:
        """Detect Solana program IDs."""
        if address in SOLANA_PROGRAM_IDS:
            return WalletLabel(
                label_type="contract",
                name=SOLANA_PROGRAM_IDS[address],
                confidence=0.99,
                source="auto_labeler_solana_program_id",
            )
        return None

    def get_stats(self) -> dict:
        """Return auto-labeler statistics."""
        return {
            "total_observations": self._stats.get("total_observations", 0),
            "total_wallets_tracked": len(self._observations),
            "by_type": {k.replace("type:", ""): v for k, v in self._stats.items() if k.startswith("type:")},
        }


# ── Singleton ───────────────────────────────────────────────────────────────

_labeler_instance: AutoLabeler | None = None


def get_auto_labeler() -> AutoLabeler:
    """Get the singleton AutoLabeler instance."""
    global _labeler_instance
    if _labeler_instance is None:
        _labeler_instance = AutoLabeler()
    return _labeler_instance
