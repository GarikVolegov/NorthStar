"""
Test API per gli endpoint /ml/* — usa TestClient di FastAPI (senza server reale).
"""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from ml.router import ml_router

# App di test minimale con solo il router ML
app = FastAPI()
app.include_router(ml_router, prefix="/ml")
client = TestClient(app)


class TestMLHealth:
    def test_health_200(self):
        res = client.get("/ml/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["is_trained"] is True
        assert data["sector_count"] == 28 or data["metadata"]["sector_count"] == 28


class TestMLSectors:
    def test_sectors_200(self):
        res = client.get("/ml/sectors")
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 28
        assert len(data["sectors"]) == 28
        first = data["sectors"][0]
        assert "id" in first and "name" in first and "riasec" in first


class TestMLRecommend:
    _valid_body = {
        "user_id": 1,
        "riasec": {
            "realistic": 0.3, "investigative": 0.9, "artistic": 0.4,
            "social": 0.3, "enterprising": 0.5, "conventional": 0.8
        },
        "skills": ["python", "sql"],
        "top_k": 5,
    }

    def test_recommend_200(self):
        res = client.post("/ml/recommend", json=self._valid_body)
        assert res.status_code == 200
        data = res.json()
        assert len(data["recommendations"]) == 5

    def test_recommend_structure(self):
        res = client.post("/ml/recommend", json=self._valid_body)
        r = res.json()["recommendations"][0]
        assert "rank" in r
        assert "sector_id" in r
        assert "score" in r
        assert "riasec_match" in r
        assert "why" in r

    def test_recommend_riasec_fuori_range_422(self):
        bad_body = {**self._valid_body, "riasec": {"realistic": 1.5, "investigative": 0.5,
            "artistic": 0.5, "social": 0.5, "enterprising": 0.5, "conventional": 0.5}}
        res = client.post("/ml/recommend", json=bad_body)
        assert res.status_code == 422

    def test_recommend_top_k_1(self):
        body = {**self._valid_body, "top_k": 1}
        res = client.post("/ml/recommend", json=body)
        assert res.status_code == 200
        assert len(res.json()["recommendations"]) == 1

    def test_recommend_top_k_max(self):
        body = {**self._valid_body, "top_k": 20}
        res = client.post("/ml/recommend", json=body)
        assert res.status_code == 200
        assert len(res.json()["recommendations"]) == 20

    def test_recommend_top_k_oltre_limite_422(self):
        body = {**self._valid_body, "top_k": 50}  # max è 20
        res = client.post("/ml/recommend", json=body)
        assert res.status_code == 422


class TestMLSectorSimilarity:
    def test_similarity_200(self):
        res = client.post("/ml/sector-similarity", json={
            "riasec": {"realistic": 0.5, "investigative": 0.5, "artistic": 0.5,
                       "social": 0.5, "enterprising": 0.5, "conventional": 0.5},
            "top_k": 5,
        })
        assert res.status_code == 200
        assert len(res.json()["similarities"]) == 5
