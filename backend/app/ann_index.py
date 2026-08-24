"""RugMaps similarity search — single-system client over the fleet's
canonical vector stack (rugbrain API → Qdrant).

Consolidation history (2026-08-24 audit): this module was previously an
in-process "ANN" stub that proxied a legacy RAG endpoint using locally
generated hash-based pseudo-embeddings — a parallel, fake-data indexing
system. Per the single-indexing-system rule it now delegates ALL
embedding + storage + search to the rugbrain/Qdrant stack that every
other app uses (rmi-backend compat layer, rugmunchbot vendored store).
No local FAISS. No local embeddings. No silent fake-data fallbacks —
if the vector stack is unreachable this returns [] and logs a WARNING.

Collections are real Qdrant collections shared fleet-wide:
    scam_patterns, known_scams, wallet_embeddings (see rugbrain /collections)

Config:
    RAG_API_URL      default http://127.0.0.1:8012/api/v1 (host-side;
                     docker deployments set http://rugbrain-api:8012/api/v1)
    RMI_RAG_API_KEY  X-API-Key value (gopass → /srv/secrets/rugmaps.env)
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RAG_API_URL = os.getenv("RAG_API_URL", "http://127.0.0.1:8012/api/v1").rstrip("/")
SEARCH_TIMEOUT = float(os.getenv("RUGMAPS_SEARCH_TIMEOUT", "30"))

# Logical index name -> real Qdrant collection(s) behind rugbrain.
COLLECTION_MAP: dict[str, list[str]] = {
    "scam_patterns": ["scam_patterns"],
    "known_scams": ["known_scams"],
    # historical name kept for callers; resolves to the live wallet collection
    "wallet_profiles": ["wallet_embeddings"],
}


class SimilaritySearch:
    """Thin async client over rugbrain's multi-collection search."""

    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None

    @property
    def indexes(self) -> set[str]:
        """Logical index names supported (compat with previous stub API)."""
        return set(COLLECTION_MAP)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=SEARCH_TIMEOUT)
        return self._http

    async def close(self) -> None:
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    async def search(
        self,
        index_name: str,
        query_text: str,
        k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search one logical index by TEXT query (embedding happens server-side).

        Returns normalized dicts: {"metadata": {...}, "score": float}.
        """
        return await self.search_multi([index_name], query_text, k=k)

    async def search_multi(
        self,
        index_names: list[str],
        query_text: str,
        k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search multiple logical indexes; results fused by rugbrain (RRF)."""
        if not query_text:
            return []

        collections: list[str] = []
        for name in index_names:
            collections.extend(COLLECTION_MAP.get(name, [name]))

        headers: dict[str, str] = {}
        api_key = os.getenv("RMI_RAG_API_KEY", "")
        if api_key:
            headers["X-API-Key"] = api_key

        client = await self._get_client()
        try:
            resp = await client.post(
                f"{RAG_API_URL}/search/multi",
                json={"query": query_text, "collections": collections, "limit": k},
                headers=headers,
            )
            if resp.status_code != 200:
                logger.warning(
                    "rugmaps_similarity_failed status=%s body=%s",
                    resp.status_code,
                    resp.text[:200],
                )
                return []
            raw = resp.json().get("results", [])
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as exc:
            logger.warning("rugmaps_similarity_unavailable error=%s", str(exc)[:150])
            return []

        normalized: list[dict[str, Any]] = []
        for r in raw:
            metadata = r.get("metadata") or r.get("payload") or {}
            if isinstance(metadata, str):
                metadata = {"description": metadata}
            normalized.append(
                {
                    "metadata": metadata,
                    "score": float(r.get("score", 0.0)),
                }
            )
        return normalized


# ── Module-level singleton ──────────────────────────────────────────────────

_instance: SimilaritySearch | None = None


def get_similarity_search() -> SimilaritySearch:
    global _instance
    if _instance is None:
        _instance = SimilaritySearch()
    return _instance
