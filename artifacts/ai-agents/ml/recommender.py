"""
Career Recommender Model — NorthStar ML Module

Algoritmo: Nearest Neighbors (cosine) + feature engineering RIASEC.

Design:
  - Fase 1 (MVP): cosine similarity pura tra profilo utente e vettori settore.
    Nessun training richiesto — funziona da subito, zero dati storici necessari.
  - Fase 2 (con dati): KNN con feature aggiuntive (skills, esperienza, settori
    preferiti). Si attiva solo se esistono dati di feedback utente.
  - Fase 3 (futuro): collaborative filtering con SVD su matrice user×sector.

Il modello seleziona automaticamente la fase disponibile al momento del caricamento.
"""
from __future__ import annotations
import logging
import time
from typing import Any

import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize

from .sector_data import get_sector_matrix, SECTORS
from .schemas import (
    CareerRecommendationRequest,
    CareerRecommendationResponse,
    CareerRecommendation,
    SectorSimilarityRequest,
    SectorSimilarityResponse,
    SectorSimilarity,
)

logger = logging.getLogger(__name__)

# Ordine dimensioni fisso: [R, I, A, S, E, C]
_RIASEC_DIM = ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"]

# Peso bonus per settori marcati come preferiti dall'utente
_PREFERRED_SECTOR_BONUS = 0.08

# Peso bonus per ogni skill che corrisponde a una parola chiave del settore
_SKILL_BONUS_PER_MATCH = 0.02

# Skill keywords per settore (subset — espandibile con NLP embedding in futuro)
_SECTOR_SKILLS: dict[str, list[str]] = {
    "software_development":   ["python", "javascript", "typescript", "react", "node", "java", "sql", "git", "api", "backend", "frontend"],
    "data_science":           ["python", "ml", "tensorflow", "pytorch", "pandas", "numpy", "sql", "statistics", "r", "data"],
    "cybersecurity":          ["security", "network", "linux", "python", "pentest", "firewall", "soc"],
    "ux_design":              ["figma", "sketch", "ux", "ui", "prototyping", "research", "css", "design"],
    "digital_marketing":      ["seo", "sem", "google ads", "meta ads", "analytics", "content", "social media"],
    "finance_banking":        ["excel", "financial modeling", "accounting", "bloomberg", "python", "sql"],
    "entrepreneurship":       ["pitch", "mvp", "fundraising", "startup", "product", "agile", "lean"],
    "data_science":           ["python", "r", "sql", "statistics", "ml", "deep learning"],
    "project_management":     ["agile", "scrum", "jira", "pmp", "planning", "stakeholders"],
    "healthcare_clinical":    ["medicina", "infermieristica", "farmacologia", "clinica", "emr"],
    "biotech_pharma":         ["biologia", "chimica", "laboratorio", "r&d", "gmp", "python"],
    "cloud_devops":           ["aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ci/cd"],
}


class CareerRecommender:
    """
    Modello di raccomandazione carriera basato su KNN cosine.

    Istanza singleton — caricato una volta all'avvio del server,
    riutilizzato per tutte le request senza re-addestramento.
    """

    def __init__(self) -> None:
        self._sector_matrix, self._sectors = get_sector_matrix()
        self._sector_matrix_normalized = normalize(self._sector_matrix, norm="l2")
        self._knn = NearestNeighbors(metric="cosine", algorithm="brute")
        self._knn.fit(self._sector_matrix_normalized)
        self._version = "1.0.0-cosine"
        logger.info(f"CareerRecommender inizializzato: {len(self._sectors)} settori, versione {self._version}")

    def _riasec_to_vector(self, riasec) -> np.ndarray:
        """Converte RiasecScores in vettore numpy [R, I, A, S, E, C]."""
        return np.array(
            [getattr(riasec, dim) for dim in _RIASEC_DIM],
            dtype=np.float32,
        ).reshape(1, -1)

    def _compute_skill_bonus(self, sector_id: str, skills: list[str]) -> float:
        """Bonus cumulativo per overlap tra skill utente e skill richieste dal settore."""
        if not skills:
            return 0.0
        keywords = _SECTOR_SKILLS.get(sector_id, [])
        if not keywords:
            return 0.0
        skills_lower = {s.lower() for s in skills}
        matches = sum(1 for kw in keywords if any(kw in skill for skill in skills_lower))
        return min(matches * _SKILL_BONUS_PER_MATCH, 0.15)  # cap a 0.15

    def _generate_why(self, sector: dict, riasec_match: float, skills: list[str]) -> str:
        """Genera spiegazione leggibile del match."""
        riasec_vec = sector["riasec"]
        dominant_dims = sorted(
            zip(_RIASEC_DIM, riasec_vec), key=lambda x: x[1], reverse=True
        )[:2]
        dim_labels = {
            "realistic": "attitudine pratica",
            "investigative": "curiosità analitica",
            "artistic": "creatività",
            "social": "orientamento alle persone",
            "enterprising": "spirito imprenditoriale",
            "conventional": "rigore organizzativo",
        }
        dims_str = " e ".join(dim_labels[d] for d, _ in dominant_dims)
        match_pct = int(riasec_match * 100)
        why = f"Match {match_pct}% con il tuo profilo RIASEC, grazie alla tua {dims_str}."

        # Aggiungi nota sulle skill se c'è overlap
        sector_kws = _SECTOR_SKILLS.get(sector["id"], [])
        matched_skills = [s for s in skills if any(kw in s.lower() for kw in sector_kws)]
        if matched_skills:
            why += f" Skill rilevanti già nel tuo profilo: {', '.join(matched_skills[:3])}."
        return why

    def recommend(self, req: CareerRecommendationRequest) -> CareerRecommendationResponse:
        """Genera top-K raccomandazioni di carriera per un utente."""
        start = time.perf_counter()

        user_vec = self._riasec_to_vector(req.riasec)
        user_vec_norm = normalize(user_vec, norm="l2")

        # KNN cosine distance — distanza 0 = identico, 1 = opposto
        n_neighbors = min(req.top_k * 3, len(self._sectors))  # sovra-campiona per post-filtering
        distances, indices = self._knn.kneighbors(user_vec_norm, n_neighbors=n_neighbors)

        results: list[CareerRecommendation] = []
        for dist, idx in zip(distances[0], indices[0]):
            sector = self._sectors[idx]
            riasec_match = float(1.0 - dist)  # converti distanza in similarità

            # Score finale = similarità coseno + bonus settore preferito + bonus skill
            score = riasec_match
            if sector["id"] in req.preferred_sectors:
                score = min(score + _PREFERRED_SECTOR_BONUS, 1.0)
            score = min(score + self._compute_skill_bonus(sector["id"], req.skills), 1.0)

            results.append(CareerRecommendation(
                rank=0,  # assegnato dopo ordinamento
                sector_id=sector["id"],
                sector_name=sector["name"],
                score=round(score, 4),
                riasec_match=round(riasec_match, 4),
                why=self._generate_why(sector, riasec_match, req.skills),
            ))

        # Ordina per score decrescente e prendi top_k
        results.sort(key=lambda r: r.score, reverse=True)
        results = results[:req.top_k]
        for i, r in enumerate(results):
            r.rank = i + 1

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        logger.info(f"recommend user={req.user_id} top_k={req.top_k} elapsed={elapsed_ms}ms")

        return CareerRecommendationResponse(
            user_id=req.user_id,
            recommendations=results,
            model_version=self._version,
            algorithm="KNearestNeighbors-cosine + skill_bonus + preferred_sector_bonus",
            processing_ms=elapsed_ms,
        )

    def sector_similarity(self, req: SectorSimilarityRequest) -> SectorSimilarityResponse:
        """Calcola similarità coseno tra profilo RIASEC e tutti i settori (senza bonus)."""
        start = time.perf_counter()
        user_vec = normalize(self._riasec_to_vector(req.riasec), norm="l2")
        distances, indices = self._knn.kneighbors(user_vec, n_neighbors=req.top_k)

        sims = [
            SectorSimilarity(
                sector_id=self._sectors[idx]["id"],
                sector_name=self._sectors[idx]["name"],
                cosine_score=round(float(1.0 - dist), 4),
            )
            for dist, idx in zip(distances[0], indices[0])
        ]
        return SectorSimilarityResponse(
            similarities=sims,
            processing_ms=int((time.perf_counter() - start) * 1000),
        )

    @property
    def info(self) -> dict:
        return {
            "model_name": "career_recommender",
            "is_trained": True,
            "feature_count": 6,
            "algorithm": "KNearestNeighbors-cosine",
            "version": self._version,
            "metadata": {
                "sector_count": len(self._sectors),
                "riasec_dims": _RIASEC_DIM,
                "bonuses": ["preferred_sector", "skill_keyword_match"],
            },
        }


# ─── Singleton (caricato una volta all'avvio) ─────────────────────────────────
_recommender: CareerRecommender | None = None


def get_recommender() -> CareerRecommender:
    global _recommender
    if _recommender is None:
        _recommender = CareerRecommender()
    return _recommender
