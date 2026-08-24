"""
RugMaps API Router — RMI's interactive wallet visualization.
Self-contained engine — RugMaps' own wallet-cluster intelligence, zero third-party map APIs.
Connects to /api/v1/rugmaps/*
"""

import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rugmaps", tags=["rugmaps"])

# Retained background task set — prevents fire-and-forget tasks from being
# garbage-collected mid-flight (CPython keeps only weak refs to running tasks).
_background_tasks: set[asyncio.Task] = set()

SUPPORTED_CHAINS = {"solana", "ethereum", "base", "bsc", "arbitrum", "optimism", "polygon"}


class RugMapsRequest(BaseModel):
    center_wallet: str
    chain: str = "ethereum"
    depth: int = 2
    min_strength: float = 0.1


def _get_rm():
    try:
        from app.bubble_maps import get_bubble_maps_pro

        return get_bubble_maps_pro()
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Module unavailable: {e}")


def _validate_chain(chain: str) -> str:
    chain = chain.lower()
    if chain not in SUPPORTED_CHAINS:
        raise HTTPException(
            status_code=400, detail=f"Unsupported chain: {chain}. Supported: {', '.join(sorted(SUPPORTED_CHAINS))}"
        )
    return chain


@router.post("/map")
async def generate_rug_map(req: RugMapsRequest):
    """Generate interactive RugMap for a wallet (2-hop default)."""
    chain = _validate_chain(req.chain)
    rm = _get_rm()
    try:
        result = await rm.generate_map(
            center_wallet=req.center_wallet,
            chain=chain,
            depth=min(req.depth, 5),
            min_strength=req.min_strength,
        )
        return result.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:500])


@router.get("/analyze/{address}")
async def analyze_wallet(
    address: str,
    chain: str = Query("ethereum", description="Blockchain identifier"),
    depth: int = Query(2, ge=1, le=5),
):
    """Quick wallet analysis with RugMaps data."""
    chain = _validate_chain(chain)
    rm = _get_rm()
    result = await rm.generate_map(center_wallet=address, chain=chain, depth=depth)
    d = result.to_dict()
    return {
        "address": address,
        "chain": chain,
        "node_count": len(d.get("nodes", [])),
        "link_count": len(d.get("links", [])),
        "risk_level": d.get("risk_level", "unknown"),
        "risk_score": d.get("risk_score", 0),
        "stats": d.get("stats", {}),
        "top_counterparties": [n["address"][:12] + "..." for n in d.get("nodes", []) if n.get("layer") == 1][:10],
    }


@router.get("/entity/{address}")
async def get_entity_info(
    address: str,
    chain: str = Query("ethereum", description="Blockchain identifier"),
):
    """Get entity information for an address."""
    chain = _validate_chain(chain)
    rm = _get_rm()
    info = await rm._get_entity_info(address, chain)
    risk, level = await rm._calculate_risk(address, chain)
    return {"address": address, "chain": chain, "entity": info, "risk_score": risk, "risk_level": level}


@router.get("/health")
async def rugmaps_health():
    return {"status": "ok", "service": "rugmaps-engine"}


@router.get("/token-graph")
async def token_holder_graph(
    token_address: str = Query(...),
    chain: str = Query("solana"),
    limit: int = Query(50, ge=5, le=200),
    skip_cache: bool = Query(False),
):
    """Generate a token holder graph with AI analysis and RAG caching.
    Uses DeepSeek Flash + our FAISS indexes + wallet labels + semantic cache."""

    from app.rugmaps_ai import (
        MIN_NODES_FOR_VERDICT,
        generate_ai_analysis,
        generate_fallback_analysis,
        get_cached_analysis,
        get_token_holders,
        get_wallet_labels,
        insufficient_data_analysis,
        search_similar_scams,
        set_cached_analysis,
    )

    # Check cache first (instant return for previously scanned tokens)
    if not skip_cache:
        cached = await get_cached_analysis(token_address, chain)
        if cached:
            logger.info(f"RugMaps cache HIT for {token_address[:12]}...")
            return {**cached, "from_cache": True}

    rm = _get_rm()

    # Get the bubble map concurrently with other data fetches
    try:
        result = await rm.generate_map(center_wallet=token_address, chain=chain, depth=3, min_strength=0.05)
        d = result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph generation failed: {str(e)[:200]}")

    nodes = d.get("nodes", [])
    links = d.get("links", [])

    # Enrich nodes concurrently
    enriched_nodes = []
    addresses_for_labels = []
    for node in nodes[:limit]:
        addr = node.get("address") or node.get("id", "")
        addresses_for_labels.append(addr)
        enriched = dict(node)
        enriched["explorer_url"] = _get_explorer_url(chain, addr)
        enriched_nodes.append(enriched)

    # Fetch wallet labels and similar scams in parallel
    labels, similar_scams, holders = await asyncio.gather(
        get_wallet_labels(addresses_for_labels, chain),
        search_similar_scams(token_address, chain),
        get_token_holders(token_address, chain),
        return_exceptions=True,
    )

    if isinstance(labels, Exception):
        labels = {}
    if isinstance(similar_scams, Exception):
        similar_scams = []
    if isinstance(holders, Exception):
        holders = []

    # Enrich nodes with labels
    for node in enriched_nodes:
        addr = node.get("address", "")
        label_data = labels.get(addr, {})
        entity = label_data.get("entity", {})
        node["label"] = entity.get("name") or entity.get("label") or node.get("label")
        node["entity_type"] = entity.get("type") or entity.get("entity_type")
        node["is_dev"] = entity.get("is_dev") or entity.get("type") == "developer"
        node["risk"] = label_data.get("risk_score") or node.get("risk_score", 0)
        node["tags"] = entity.get("tags") or []
        node["risk_level"] = label_data.get("risk_level", "unknown")

    graph_data = {
        "node_count": len(enriched_nodes),
        "link_count": min(len(links), limit * 2),
        "risk_score": d.get("risk_score", 0),
        "risk_level": d.get("risk_level", "unknown"),
        "stats": d.get("stats", {}),
    }

    # ── Verdict guard: never let the AI narrate an empty graph ──────────
    if len(enriched_nodes) < MIN_NODES_FOR_VERDICT:
        logger.warning(
            "token_graph_insufficient_data token=%s chain=%s nodes=%s",
            token_address[:12],
            chain,
            len(enriched_nodes),
        )
        response = {
            "token_address": token_address,
            "chain": chain,
            "nodes": enriched_nodes,
            "links": links[: limit * 2],
            **graph_data,
            "analysis": insufficient_data_analysis(len(enriched_nodes), token_address, chain),
            "similar_scams": [],
            "wallet_labels_count": 0,
            "from_cache": False,
            "data_quality": "insufficient",
        }
        set_cached_analysis(token_address, chain, response)
        return response

    # Generate AI analysis (DeepSeek Flash + fallback to our data engine)

    try:
        ai_analysis = await generate_ai_analysis(token_address, chain, graph_data, holders, labels, similar_scams)
    except Exception as e:
        logger.warning(f"AI analysis failed, using fallback: {e}")
        ai_analysis = generate_fallback_analysis(
            d.get("risk_score", 0),
            holders,
            labels,
            similar_scams,
            len(enriched_nodes),
            min(len(links), limit * 2),
        )

    response = {
        "token_address": token_address,
        "chain": chain,
        "nodes": enriched_nodes,
        "links": links[: limit * 2],
        **graph_data,
        "analysis": ai_analysis,
        "similar_scams": similar_scams[:5],
        "wallet_labels_count": len(labels),
        "from_cache": False,
        "data_quality": "ok",
    }

    # Cache for future requests
    set_cached_analysis(token_address, chain, response)

    # Auto-label all wallets in the graph (background — must NOT block the
    # response; task reference retained so it survives GC)
    async def _auto_label_graph() -> None:
        try:
            from app.auto_labeler import get_auto_labeler

            labeler = get_auto_labeler()
            for node in enriched_nodes:
                await labeler.observe_wallet(
                    node["address"],
                    chain,
                    {"event": "scanned_in_graph", "token": token_address, "risk": node.get("risk", 0)},
                )
        except Exception as e:  # best-effort by design
            logger.debug("Auto-labeling failed (best-effort): %s", e)

    task = asyncio.create_task(_auto_label_graph())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return response


def _get_explorer_url(chain: str, address: str) -> str:
    explorers = {
        "solana": "https://solscan.io/account/",
        "ethereum": "https://etherscan.io/address/",
        "base": "https://basescan.org/address/",
        "bsc": "https://bscscan.com/address/",
        "arbitrum": "https://arbiscan.io/address/",
        "optimism": "https://optimistic.etherscan.io/address/",
        "polygon": "https://polygonscan.com/address/",
    }
    base = explorers.get(chain, explorers["ethereum"])
    return base + address


# ── Auto-Labeler ──────────────────────────────────────────────


@router.post("/auto-label")
async def auto_label_wallet(request: dict):
    """Submit wallet observations for automatic labeling."""
    try:
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()

        address = request.get("address", "")
        chain = request.get("chain", "ethereum")
        events = request.get("events", [])

        all_labels = []
        for event in events:
            labels = await labeler.observe_wallet(address, chain, event)
            all_labels.extend(labels)

        return {
            "status": "ok",
            "address": address,
            "labels_applied": all_labels,
            "count": len(all_labels),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])


@router.get("/auto-label/stats")
async def auto_label_stats():
    """Get auto-labeler statistics."""
    try:
        from app.auto_labeler import get_auto_labeler

        labeler = get_auto_labeler()
        return {"status": "ok", **labeler.get_stats()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])
