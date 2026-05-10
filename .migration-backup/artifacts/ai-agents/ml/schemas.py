"""
Schemi Pydantic per il modulo ML di NorthStar.
Usati da FastAPI per validazione input/output degli endpoint /ml/*.
"""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


# ─── Input ────────────────────────────────────────────────────────────────────

class RiasecScores(BaseModel):
    """Punteggi RIASEC normalizzati [0,1]. Tutti i campi sono obbligatori."""
    realistic:        float = Field(..., ge=0.0, le=1.0, description="Realistico")
    investigative:    float = Field(..., ge=0.0, le=1.0, description="Investigativo")
    artistic:         float = Field(..., ge=0.0, le=1.0, description="Artistico")
    social:           float = Field(..., ge=0.0, le=1.0, description="Sociale")
    enterprising:     float = Field(..., ge=0.0, le=1.0, description="Intraprendente")
    conventional:     float = Field(..., ge=0.0, le=1.0, description="Convenzionale")


class CareerRecommendationRequest(BaseModel):
    user_id:          int              = Field(..., description="ID utente NorthStar")
    riasec:           RiasecScores
    preferred_sectors: list[str]       = Field(default_factory=list, description="Settori preferiti dall'utente")
    skills:           list[str]        = Field(default_factory=list, description="Skills dal profilo utente")
    years_experience: int              = Field(default=0, ge=0, le=50)
    is_premium:       bool             = Field(default=False)
    top_k:            int              = Field(default=5, ge=1, le=20, description="Numero di raccomandazioni da restituire")


class SectorSimilarityRequest(BaseModel):
    """Calcola similarità coseno tra un profilo RIASEC e tutti i settori."""
    riasec: RiasecScores
    top_k:  int = Field(default=10, ge=1, le=28)


class ModelInfoRequest(BaseModel):
    model_name: str = Field(..., description="Nome del modello: career_recommender | sector_similarity")


# ─── Output ───────────────────────────────────────────────────────────────────

class CareerRecommendation(BaseModel):
    rank:          int
    sector_id:     str
    sector_name:   str
    score:         float   = Field(..., description="Score di matching [0,1]")
    riasec_match:  float   = Field(..., description="Similarità coseno con il vettore RIASEC del settore")
    why:           str     = Field(..., description="Spiegazione leggibile del match")


class CareerRecommendationResponse(BaseModel):
    user_id:         int
    recommendations: list[CareerRecommendation]
    model_version:   str
    algorithm:       str
    processing_ms:   int


class SectorSimilarity(BaseModel):
    sector_id:    str
    sector_name:  str
    cosine_score: float


class SectorSimilarityResponse(BaseModel):
    similarities:  list[SectorSimilarity]
    processing_ms: int


class ModelInfoResponse(BaseModel):
    model_name:    str
    is_trained:    bool
    feature_count: int
    algorithm:     str
    version:       str
    metadata:      dict[str, Any] = Field(default_factory=dict)
