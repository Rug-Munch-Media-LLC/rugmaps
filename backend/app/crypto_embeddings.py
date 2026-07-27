"""
RugMaps Crypto Embeddings — text embedding for scam pattern matching.

Provides a minimal embedding interface. When the full rmi-backend
embedding service is unavailable, returns a zero vector placeholder.

In production, uses OpenRouter embeddings or the rmi-backend embedding API.
"""

from __future__ import annotations

import hashlib
import logging
import os

import httpx

logger = logging.getLogger(__name__)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
EMBEDDING_DIM = 768  # Default dimension for nomic-embed-text


class CryptoEmbedder:
    """Text embedder for crypto/scam analysis.

    Generates embeddings for text queries to search similar scam patterns.
    Falls back to a deterministic hash-based embedding when the backend
    embedding service is unavailable.
    """

    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None
        self._dim = EMBEDDING_DIM

    async def embed_query(self, text: str) -> list[float]:
        """Embed a text query into a vector.

        Args:
            text: The text to embed.

        Returns:
            A list of floats representing the embedding vector.
        """
        # Try rmi-backend embedding API first
        try:
            if self._http is None:
                self._http = httpx.AsyncClient(timeout=10)

            resp = await self._http.post(
                f"{BACKEND_URL}/api/v1/rag/embed",
                json={"text": text},
            )
            if resp.status_code == 200:
                data = resp.json()
                embedding = data.get("embedding", data.get("data", []))
                if embedding and isinstance(embedding, list):
                    return embedding
        except Exception as e:
            logger.debug(f"Backend embedder unavailable: {e}")

        # Fallback: deterministic pseudo-embedding from text hash
        # This is NOT semantically meaningful but allows the system to
        # function without an embedding service for basic operations.
        return self._fallback_embed(text)

    def _fallback_embed(self, text: str) -> list[float]:
        """Generate a deterministic pseudo-embedding from text hash.

        This is not semantically meaningful — it's a last-resort fallback
        so the ANN index search can at least run without crashing.
        """
        h = hashlib.sha256(text.encode()).digest()
        # Expand hash bytes to fill embedding dimension
        result = []
        for i in range(self._dim):
            val = h[i % 32] / 255.0 * 2 - 1  # normalize to [-1, 1]
            result.append(val)
        return result


# Singleton
_embedder_instance: CryptoEmbedder | None = None


def get_embedder() -> CryptoEmbedder:
    """Get the singleton CryptoEmbedder instance."""
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = CryptoEmbedder()
    return _embedder_instance
