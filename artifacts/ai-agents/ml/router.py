"""
ML Router — endpoint FastAPI per il modulo di raccomandazione.

Montato su /ml in main.py:
    from ml.router import ml_router
    app.include_router(ml_router, prefix="/ml", tags=["ML"])

Endpoint esposti:
    POST /ml/recommend          — raccomandazioni carriera personalizzate
    POST /ml/sector-similarity  — similarità coseno pura (debug/explore)
    GET  /ml/health             — stato modello
    GET  /ml/sectors            — lista settori con vettori RIASEC
"""
from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException
from .recommender import get_recommender
from .sector_data import SECTORS
from .schemas import (
    CareerRecommendationRequest,
    CareerRecommendationResponse,
    SectorSimilarityRequest,
    SectorSimilarityResponse,
    ModelInfoResponse,
)

logger = logging.getLogger(__name__)
ml_router = APIRouter()


@ml_router.get("/health")
async def ml_health() -> dict:
    """Stato del modulo ML — usato da Express health check e CI."""
    rec = get_recommender()
    return {
        "status": "ok",
        "module": "northstar-ml",
        **rec.info,
    }


@ml_router.get("/sectors")
async def list_sectors() -> dict:
    """Lista completa dei 28 settori con ID, nome e vettore RIASEC."""
    return {
        "sectors": [
            {"id": s["id"], "name": s["name"], "riasec": s["riasec"]}
            for s in SECTORS
        ],
        "count": len(SECTORS),
    }


@ml_router.post("/recommend", response_model=CareerRecommendationResponse)
async def recommend(req: CareerRecommendationRequest) -> CareerRecommendationResponse:
    """
    Genera raccomandazioni di carriera personalizzate.

    Algoritmo:
      1. Cosine similarity tra vettore RIASEC utente e matrice settori
      2. Bonus per settori preferiti (+0.08)
      3. Bonus per skill rilevanti nel profilo (+0.02 per match, max +0.15)
      4. Ordinamento per score finale, restituzione top_k

    Latenza tipica: < 5ms (numpy in-memory, nessun DB).
    """
    try:
        rec = get_recommender()
        return rec.recommend(req)
    except Exception as exc:
        logger.error(f"Errore in /ml/recommend: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ML error: {exc}")


@ml_router.post("/sector-similarity", response_model=SectorSimilarityResponse)
async def sector_similarity(req: SectorSimilarityRequest) -> SectorSimilarityResponse:
    """
    Similarità coseno pura tra profilo RIASEC e settori.
    Utile per debug, esplorazione e visualizzazione radar chart.
    """
    try:
        rec = get_recommender()
        return rec.sector_similarity(req)
    except Exception as exc:
        logger.error(f"Errore in /ml/sector-similarity: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ML error: {exc}")


@ml_router.get("/model-info", response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    """Metadati del modello: versione, algoritmo, feature count."""
    rec = get_recommender()
    info = rec.info
    return ModelInfoResponse(
        model_name=info["model_name"],
        is_trained=info["is_trained"],
        feature_count=info["feature_count"],
        algorithm=info["algorithm"],
        version=info["version"],
        metadata=info["metadata"],
    )
