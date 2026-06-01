"""
embedder.py — Free text embeddings via sentence-transformers.

Alternativa gratuita a OpenAI text-embedding-3-small.
Modello default: paraphrase-multilingual-MiniLM-L12-v2
  - 384 dimensioni
  - Ottimizzato per testi multilingua (italiano + inglese)
  - ~120MB, gira su CPU senza problemi

Per il RAG pipeline di NorthStar, può sostituire o affiancare
l'embedding OpenAI riducendo costi a zero.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import List

import numpy as np

logger = logging.getLogger(__name__)

# Modello configurabile via env — default multilingual ottimizzato per IT
DEFAULT_MODEL = os.getenv(
    "EMBEDDING_MODEL_LOCAL",
    "paraphrase-multilingual-MiniLM-L12-v2"
)

# Batch size per evitare OOM su CPU
BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "64"))


@lru_cache(maxsize=1)
def _load_model(model_name: str):
    """Carica il modello sentence-transformers con cache singleton."""
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        logger.info(f"[embedder] loading model: {model_name}")
        model = SentenceTransformer(model_name)
        logger.info(f"[embedder] model loaded — dims: {model.get_sentence_embedding_dimension()}")
        return model
    except ImportError:
        logger.error("[embedder] sentence-transformers not installed — run: uv add sentence-transformers")
        raise


def get_model():
    """Restituisce il modello corrente (singleton via lru_cache)."""
    return _load_model(DEFAULT_MODEL)


def embed_text(text: str) -> List[float]:
    """Genera embedding per un singolo testo."""
    model = get_model()
    vec = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vec.tolist()


def embed_batch(texts: List[str]) -> List[List[float]]:
    """
    Genera embeddings per una lista di testi in batch.
    Normalizza L2 (necessario per cosine similarity con pgvector).
    """
    model = get_model()
    all_vecs: List[List[float]] = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        vecs = model.encode(
            batch,
            batch_size=BATCH_SIZE,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        all_vecs.extend(vecs.tolist())

    return all_vecs


def embedding_dim() -> int:
    """Restituisce le dimensioni del modello corrente."""
    return get_model().get_sentence_embedding_dimension()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity tra due vettori già normalizzati L2."""
    va = np.array(a)
    vb = np.array(b)
    # Se già normalizzati, dot product == cosine similarity
    return float(np.dot(va, vb))
