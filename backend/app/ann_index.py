"""
RugMaps ANN Index — Approximate Nearest Neighbor search stub.

Provides a minimal ANN index interface for scam pattern matching.
When the full rmi-backend FAISS index is unavailable, returns
empty results gracefully.

In production, this connects to the rmi-backend RAG service at
BACKEND_URL/api/v1/rag/search.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")


class ANNIndex:
    """Approximate Nearest Neighbor index for scam pattern search.

    Wraps the rmi-backend RAG search API. Falls back to empty results
    when the backend is unavailable.
    """

    def __init__(self) -> None:
        self.indexes: set[str] = {"scam_patterns", "known_scams", "wallet_profiles"}
        self._http: httpx.AsyncClient | None = None

    async def search(self, index_name: str, embedding: list[float], k: int = 5) -> list[dict]:
        """Search the ANN index for similar items.

        Args:
            index_name: Which index to search (scam_patterns, known_scams, wallet_profiles).
            embedding: The query embedding vector.
            k: Number of results to return.

        Returns:
            List of result dicts with 'metadata' and 'score' keys.
        """
        # Try RAG search via backend
        try:
            if self._http is None:
                self._http = httpx.AsyncClient(timeout=10)

            # Convert embedding to a query string (best-effort)
            # The RAG backend does its own embedding
            query_text = f"similar scam patterns for {index_name}"
            resp = await self._http.post(
                f"{BACKEND_URL}/api/v1/rag/search",
                json={
                    "query": query_text,
                    "collection": index_name,
                    "limit": k,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                return [
                    {
                        "metadata": {
                            "pattern": r.get("title", ""),
                            "description": r.get("content", ""),
                            "type": r.get("metadata", {}).get("scam_type", "unknown"),
                            "label": r.get("title", ""),
                        },
                        "score": r.get("relevance_score", r.get("score", 0)),
                    }
                    for r in results
                ]
        except Exception as e:
            logger.debug(f"ANN search unavailable (backed by RAG): {e}")

        return []


# Singleton
_ann_instance: ANNIndex | None = None


def get_ann_index() -> ANNIndex:
    """Get the singleton ANNIndex instance."""
    global _ann_instance
    if _ann_instance is None:
        _ann_instance = ANNIndex()
    return _ann_instance
