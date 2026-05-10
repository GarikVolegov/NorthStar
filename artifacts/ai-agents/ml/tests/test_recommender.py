"""
Test suite per il modulo ML di NorthStar.

Esecuzione:
    cd artifacts/ai-agents
    pytest ml/tests/ -v
"""
from __future__ import annotations
import pytest
import numpy as np
from ml.schemas import RiasecScores, CareerRecommendationRequest, SectorSimilarityRequest
from ml.recommender import CareerRecommender
from ml.sector_data import SECTORS, get_sector_matrix


# ─── Fixture ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def recommender() -> CareerRecommender:
    """Singleton del recommender condiviso tra tutti i test del modulo."""
    return CareerRecommender()


def make_riasec(**kwargs) -> RiasecScores:
    """Helper: crea RiasecScores con valori default 0.5 — override con kwargs."""
    defaults = {d: 0.5 for d in ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"]}
    defaults.update(kwargs)
    return RiasecScores(**defaults)


# ─── Test sector_data ─────────────────────────────────────────────────────────

class TestSectorData:
    def test_settori_count(self):
        assert len(SECTORS) == 28

    def test_ogni_settore_ha_vettore_6d(self):
        for s in SECTORS:
            assert len(s["riasec"]) == 6, f"Settore {s['id']} ha vettore di lunghezza errata"

    def test_valori_normalizzati(self):
        for s in SECTORS:
            for v in s["riasec"]:
                assert 0.0 <= v <= 1.0, f"Valore fuori range in settore {s['id']}: {v}"

    def test_id_univoci(self):
        ids = [s["id"] for s in SECTORS]
        assert len(ids) == len(set(ids)), "ID settori duplicati rilevati"

    def test_sector_matrix_shape(self):
        matrix, sectors = get_sector_matrix()
        assert matrix.shape == (28, 6)
        assert matrix.dtype == np.float32


# ─── Test raccomandazioni ─────────────────────────────────────────────────────

class TestRecommendations:
    def test_profilo_investigativo_raccomanda_data_science(self, recommender):
        """Profilo fortemente investigativo deve avere data_science o physics_research in top-3."""
        req = CareerRecommendationRequest(
            user_id=1,
            riasec=make_riasec(investigative=1.0, realistic=0.2, artistic=0.1,
                               social=0.1, enterprising=0.1, conventional=0.6),
            top_k=3,
        )
        result = recommender.recommend(req)
        sector_ids = [r.sector_id for r in result.recommendations]
        assert any(s in sector_ids for s in ["data_science", "physics_research", "cybersecurity"])

    def test_profilo_artistico_raccomanda_ux_o_content(self, recommender):
        req = CareerRecommendationRequest(
            user_id=2,
            riasec=make_riasec(artistic=1.0, social=0.6, enterprising=0.5,
                               realistic=0.1, investigative=0.2, conventional=0.1),
            top_k=3,
        )
        result = recommender.recommend(req)
        sector_ids = [r.sector_id for r in result.recommendations]
        assert any(s in sector_ids for s in ["ux_design", "content_creation", "digital_marketing"])

    def test_profilo_enterprising_raccomanda_vendite_o_startup(self, recommender):
        req = CareerRecommendationRequest(
            user_id=3,
            riasec=make_riasec(enterprising=1.0, social=0.7, artistic=0.5,
                               realistic=0.1, investigative=0.2, conventional=0.2),
            top_k=3,
        )
        result = recommender.recommend(req)
        sector_ids = [r.sector_id for r in result.recommendations]
        assert any(s in sector_ids for s in ["entrepreneurship", "sales", "consulting"])

    def test_top_k_rispettato(self, recommender):
        for k in [1, 3, 5, 10]:
            req = CareerRecommendationRequest(
                user_id=99, riasec=make_riasec(), top_k=k
            )
            result = recommender.recommend(req)
            assert len(result.recommendations) == k

    def test_rank_sequenziale(self, recommender):
        req = CareerRecommendationRequest(user_id=4, riasec=make_riasec(), top_k=5)
        result = recommender.recommend(req)
        ranks = [r.rank for r in result.recommendations]
        assert ranks == list(range(1, 6))

    def test_score_decrescente(self, recommender):
        req = CareerRecommendationRequest(user_id=5, riasec=make_riasec(), top_k=10)
        result = recommender.recommend(req)
        scores = [r.score for r in result.recommendations]
        assert scores == sorted(scores, reverse=True)

    def test_score_in_range(self, recommender):
        req = CareerRecommendationRequest(user_id=6, riasec=make_riasec(), top_k=28)
        result = recommender.recommend(req)
        for r in result.recommendations:
            assert 0.0 <= r.score <= 1.0, f"Score fuori range: {r.score}"
            assert 0.0 <= r.riasec_match <= 1.0

    def test_preferred_sector_bonus(self, recommender):
        """Un settore preferito deve avere score più alto rispetto alla stessa richiesta senza preferenza."""
        base_req = CareerRecommendationRequest(
            user_id=7,
            riasec=make_riasec(investigative=0.8),
            top_k=28,
        )
        boosted_req = CareerRecommendationRequest(
            user_id=7,
            riasec=make_riasec(investigative=0.8),
            preferred_sectors=["finance_banking"],
            top_k=28,
        )
        base_result = recommender.recommend(base_req)
        boosted_result = recommender.recommend(boosted_req)

        base_finance = next(r for r in base_result.recommendations if r.sector_id == "finance_banking")
        boosted_finance = next(r for r in boosted_result.recommendations if r.sector_id == "finance_banking")
        assert boosted_finance.score > base_finance.score

    def test_skill_bonus_aumenta_score(self, recommender):
        """Avere skill Python deve aumentare lo score di data_science."""
        base_req = CareerRecommendationRequest(
            user_id=8, riasec=make_riasec(investigative=0.8), top_k=28
        )
        skilled_req = CareerRecommendationRequest(
            user_id=8, riasec=make_riasec(investigative=0.8),
            skills=["python", "pandas", "sql"], top_k=28
        )
        base = recommender.recommend(base_req)
        skilled = recommender.recommend(skilled_req)
        base_ds = next(r for r in base.recommendations if r.sector_id == "data_science")
        skilled_ds = next(r for r in skilled.recommendations if r.sector_id == "data_science")
        assert skilled_ds.score >= base_ds.score

    def test_why_non_vuoto(self, recommender):
        req = CareerRecommendationRequest(user_id=9, riasec=make_riasec(), top_k=5)
        result = recommender.recommend(req)
        for r in result.recommendations:
            assert len(r.why) > 10

    def test_processing_ms_ragionevole(self, recommender):
        req = CareerRecommendationRequest(user_id=10, riasec=make_riasec(), top_k=10)
        result = recommender.recommend(req)
        assert result.processing_ms < 500  # deve essere < 500ms, tipicamente < 5ms

    def test_response_model_version(self, recommender):
        req = CareerRecommendationRequest(user_id=11, riasec=make_riasec(), top_k=1)
        result = recommender.recommend(req)
        assert result.model_version != ""
        assert "cosine" in result.algorithm


# ─── Test sector similarity ───────────────────────────────────────────────────

class TestSectorSimilarity:
    def test_top_k_rispettato(self, recommender):
        for k in [1, 5, 28]:
            req = SectorSimilarityRequest(riasec=make_riasec(), top_k=k)
            result = recommender.sector_similarity(req)
            assert len(result.similarities) == k

    def test_similarita_in_range(self, recommender):
        req = SectorSimilarityRequest(riasec=make_riasec(), top_k=28)
        result = recommender.sector_similarity(req)
        for s in result.similarities:
            assert 0.0 <= s.cosine_score <= 1.0

    def test_profilo_identico_al_settore_ha_score_massimo(self, recommender):
        """Un vettore RIASEC identico a un settore deve avere cosine_score ≈ 1.0."""
        # Usa il vettore di data_science: [0.3, 0.95, 0.4, 0.3, 0.5, 0.8]
        req = SectorSimilarityRequest(
            riasec=RiasecScores(
                realistic=0.3, investigative=0.95, artistic=0.4,
                social=0.3, enterprising=0.5, conventional=0.8
            ),
            top_k=1,
        )
        result = recommender.sector_similarity(req)
        assert result.similarities[0].cosine_score > 0.98


# ─── Test model info ──────────────────────────────────────────────────────────

class TestModelInfo:
    def test_info_structure(self, recommender):
        info = recommender.info
        assert info["is_trained"] is True
        assert info["feature_count"] == 6
        assert info["metadata"]["sector_count"] == 28
