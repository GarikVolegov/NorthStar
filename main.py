"""
NorthStar ML Service — FastAPI microservice per machine learning.

Endpoint principali:
  POST /embeddings/generate        — embedding gratuiti via sentence-transformers
  POST /embeddings/batch           — batch embeddings (per ingestione RAG)
  POST /analyze/trend              — analisi trend job posting (time series + DB)
  POST /analyze/trend/inline       — analisi trend con dati nel body (no DB)
  POST /analyze/weak-signals       — classificazione weak signal emergenti
  GET  /health                     — health check con DB ping

Porta default: 8000 (configurabile via ML_PORT env)
Configurazione: DATABASE_URL in .env (stesso Neon PostgreSQL del server Express)

Il servizio è indipendente dal server Node.js — comunica tramite HTTP.
Il Node.js lo chiama su PYTHON_ML_URL (default: http://localhost:8000).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("northstar.ml")


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[startup] NorthStar ML Service v1.0")
    try:
        from lib.db.client import get_pool
        await get_pool()
        logger.info("[startup] DB pool ready")
    except Exception as e:
        logger.warning(f"[startup] DB unavailable ({e}) — DB endpoints disabled")
    yield
    try:
        from lib.db.client import close_pool
        await close_pool()
        logger.info("[shutdown] DB pool closed")
    except Exception:
        pass


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="NorthStar ML Service",
    description="Embeddings, trend analysis e weak signal detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Schemas ────────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)

class EmbedResponse(BaseModel):
    embedding: List[float]
    dimensions: int
    model: str

class EmbedBatchRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=200)

class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]]
    dimensions: int
    count: int
    model: str

class SnapshotData(BaseModel):
    period: str
    count: int
    geography: str
    top_skills: List[str] = []
    avg_salary_min: Optional[int] = None
    avg_salary_max: Optional[int] = None

class TrendRequest(BaseModel):
    role_title: str = Field(..., min_length=1)
    geography: str = "IT"
    limit_periods: int = Field(default=12, ge=2, le=24)

class TrendInlineRequest(BaseModel):
    role_title: str
    geography: str = "IT"
    snapshots: List[SnapshotData]

class WeakSignalRequest(BaseModel):
    geography: Optional[str] = "IT"
    min_count: int = Field(default=30, ge=1)
    limit: int = Field(default=50, ge=1, le=200)
    persist: bool = Field(default=False)

class WeakSignalResult(BaseModel):
    role_title: str
    is_emerging: bool
    strength: float
    status: str
    factors: dict

class WeakSignalResponse(BaseModel):
    signals: List[WeakSignalResult]
    total_analyzed: int
    emerging_count: int


# ── Embeddings ─────────────────────────────────────────────────────────────────

@app.post("/embeddings/generate", response_model=EmbedResponse)
async def generate_embedding(req: EmbedRequest):
    """Genera embedding per un singolo testo (sentence-transformers, gratis)."""
    try:
        from lib.ml.embedder import embed_text, DEFAULT_MODEL
        vec = embed_text(req.text)
        return EmbedResponse(embedding=vec, dimensions=len(vec), model=DEFAULT_MODEL)
    except ImportError:
        raise HTTPException(503, "sentence-transformers non installato — run: uv add sentence-transformers")
    except Exception as e:
        logger.error(f"[embeddings] {e}")
        raise HTTPException(500, str(e))


@app.post("/embeddings/batch", response_model=EmbedBatchResponse)
async def generate_embeddings_batch(req: EmbedBatchRequest):
    """Batch embeddings per ingestione RAG — fino a 200 testi per chiamata."""
    try:
        from lib.ml.embedder import embed_batch, DEFAULT_MODEL
        vecs = embed_batch(req.texts)
        return EmbedBatchResponse(
            embeddings=vecs, dimensions=len(vecs[0]) if vecs else 0,
            count=len(vecs), model=DEFAULT_MODEL,
        )
    except ImportError:
        raise HTTPException(503, "sentence-transformers non installato")
    except Exception as e:
        logger.error(f"[embeddings/batch] {e}")
        raise HTTPException(500, str(e))


# ── Trend Analysis ─────────────────────────────────────────────────────────────

@app.post("/analyze/trend")
async def analyze_trend_from_db(req: TrendRequest):
    """Analisi trend job posting letta dal DB NorthStar."""
    try:
        from lib.db.client import fetch_job_posting_snapshots
        from lib.ml.trend_analyzer import TrendAnalyzer, SnapshotPoint
        rows = await fetch_job_posting_snapshots(req.role_title, req.geography, req.limit_periods)
        if not rows:
            raise HTTPException(404, f"Nessun dato per '{req.role_title}' in {req.geography}")
        snapshots = [SnapshotPoint(**{k: v for k, v in r.items() if k in SnapshotPoint.__dataclass_fields__}) for r in rows]
        result = TrendAnalyzer().analyze(req.role_title, req.geography, snapshots)
        if not result:
            raise HTTPException(422, "Dati insufficienti")
        return result.__dict__
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[analyze/trend] {e}")
        raise HTTPException(500, str(e))


@app.post("/analyze/trend/inline")
async def analyze_trend_inline(req: TrendInlineRequest):
    """Analisi trend con dati forniti nel body (senza DB — utile per Node.js)."""
    try:
        from lib.ml.trend_analyzer import TrendAnalyzer, SnapshotPoint
        snapshots = [SnapshotPoint(
            period=s.period, count=s.count, geography=s.geography,
            top_skills=s.top_skills, avg_salary_min=s.avg_salary_min, avg_salary_max=s.avg_salary_max,
        ) for s in req.snapshots]
        result = TrendAnalyzer().analyze(req.role_title, req.geography, snapshots)
        if not result:
            raise HTTPException(422, "Dati insufficienti")
        return result.__dict__
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[analyze/trend/inline] {e}")
        raise HTTPException(500, str(e))


# ── Weak Signal Classification ────────────────────────────────────────────────

@app.post("/analyze/weak-signals", response_model=WeakSignalResponse)
async def classify_weak_signals(req: WeakSignalRequest, background_tasks: BackgroundTasks):
    """
    Classifica i job title emergenti con WeakSignalClassifier ML.
    Complementa il weak_signal_detector.ts Node.js con analisi ML più sofisticata.
    Se persist=True, aggiorna i weak_signals nel DB in background.
    """
    try:
        from lib.db.client import fetch_emerging_role_titles, fetch_job_posting_snapshots
        from lib.ml.trend_analyzer import TrendAnalyzer, WeakSignalClassifier, SnapshotPoint

        role_titles = await fetch_emerging_role_titles(req.geography, req.min_count)
        if not role_titles:
            return WeakSignalResponse(signals=[], total_analyzed=0, emerging_count=0)

        role_titles = role_titles[: req.limit]
        analyzer   = TrendAnalyzer()
        classifier = WeakSignalClassifier()
        results: List[WeakSignalResult] = []

        for title in role_titles:
            rows = await fetch_job_posting_snapshots(title, req.geography, limit_periods=12)
            if not rows:
                continue
            snapshots = [SnapshotPoint(
                period=r["period"], count=r["count"], geography=r["geography"],
                top_skills=r["top_skills"] or [],
            ) for r in rows]
            trend = analyzer.analyze(title, req.geography or "Global", snapshots)
            score = classifier.score(title, snapshots, trend, min_count=req.min_count)
            if score and score.is_emerging:
                results.append(WeakSignalResult(
                    role_title=score.role_title, is_emerging=score.is_emerging,
                    strength=score.strength, status=score.status, factors=score.factors,
                ))

        if req.persist and results:
            background_tasks.add_task(_persist_weak_signals, results, req.geography or "IT")

        results.sort(key=lambda r: r.strength, reverse=True)
        return WeakSignalResponse(
            signals=results, total_analyzed=len(role_titles), emerging_count=len(results),
        )
    except Exception as e:
        logger.error(f"[analyze/weak-signals] {e}")
        raise HTTPException(500, str(e))


async def _persist_weak_signals(signals: List[WeakSignalResult], geography: str) -> None:
    """Background: salva weak_signals nel DB."""
    try:
        from lib.db.client import upsert_weak_signal
        for s in signals:
            await upsert_weak_signal(
                role_title=s.role_title, signal_type="new_job_title",
                description=f"ML service: '{s.role_title}' classificato {s.status}.",
                strength=s.strength, status=s.status, geographies=[geography],
                linked_skill_ids=[], evidence={"ml_factors": s.factors},
            )
        logger.info(f"[weak-signals] persisted {len(signals)} signals")
    except Exception as e:
        logger.error(f"[weak-signals persist] {e}")


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    status: dict = {"service": "northstar-ml", "version": "1.0.0", "status": "ok"}
    try:
        from lib.db.client import get_pool
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        status["db"] = "connected"
    except Exception as e:
        status["db"] = f"unavailable: {str(e)[:60]}"
    try:
        from lib.ml.embedder import DEFAULT_MODEL, embedding_dim
        status["embedding_model"] = DEFAULT_MODEL
        status["embedding_dims"]  = embedding_dim()
    except Exception:
        status["embedding_model"] = "not loaded"
    return status


@app.get("/")
async def root():
    return {
        "service": "NorthStar ML Service",
        "version": "1.0.0",
        "endpoints": {
            "embeddings_single": "POST /embeddings/generate",
            "embeddings_batch":  "POST /embeddings/batch",
            "trend_db":          "POST /analyze/trend",
            "trend_inline":      "POST /analyze/trend/inline",
            "weak_signals":      "POST /analyze/weak-signals",
            "health":            "GET /health",
        },
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ML_PORT", "8000"))
    os.makedirs("models", exist_ok=True)
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
