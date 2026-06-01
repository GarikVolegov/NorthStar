"""
trend_analyzer.py — Analisi trend job posting e rilevamento weak signals.

Implementa:
1. TrendAnalyzer: analisi time-series su job_posting_snapshots
   - crescita cumulativa, MoM (Month-over-Month), CAGR
   - regressione lineare per proiezione futura
   - stagionalità (placeholder per futuro)

2. WeakSignalClassifier: classifica se un job title è "emerging"
   - feature engineering da job posting snapshots
   - threshold-based (V1) con logistica regressione (V2 ready)
   - compatibile con i weak_signals del DB NorthStar

Pattern: Strategy (swap classifier senza cambiare API)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class SnapshotPoint:
    """Un punto di dati di job posting per un periodo."""
    period: str            # YYYY-MM
    count: int
    geography: str
    top_skills: List[str] = field(default_factory=list)
    avg_salary_min: Optional[int] = None
    avg_salary_max: Optional[int] = None


@dataclass
class TrendResult:
    """Risultato dell'analisi trend per un role title."""
    role_title: str
    geography: str
    periods: List[str]
    counts: List[int]
    growth_rate_mom: float           # Mean MoM growth rate
    growth_rate_total: float         # % crescita totale primo→ultimo periodo
    cagr: Optional[float]            # CAGR annualizzato (se ≥12 mesi)
    trend_direction: str             # "up" | "stable" | "down"
    velocity: float                  # accelerazione: crescita media ultimi 3 mesi vs precedenti
    projected_next: Optional[int]    # proiezione mese successivo (regressione lineare)
    confidence: float                # 0–1, basato su R² della regressione


@dataclass
class WeakSignalScore:
    """Score ML per classificazione weak signal."""
    role_title: str
    is_emerging: bool
    strength: float                  # 0–1 composito
    factors: Dict[str, float]        # contributo per fattore
    status: str                      # "emerging" | "confirmed" | "stable" | "faded"


# ── TrendAnalyzer ──────────────────────────────────────────────────────────────

class TrendAnalyzer:
    """
    Analizza trend di job posting nel tempo.

    Uso:
        snapshots = [SnapshotPoint(period="2025-01", count=50, geography="IT"), ...]
        analyzer = TrendAnalyzer()
        result = analyzer.analyze("Data Engineer", "IT", snapshots)
    """

    def analyze(
        self,
        role_title: str,
        geography: str,
        snapshots: List[SnapshotPoint],
    ) -> Optional[TrendResult]:
        """Analizza trend per un role title dato."""
        if not snapshots:
            return None

        # Ordina per periodo
        snapshots = sorted(snapshots, key=lambda s: s.period)
        periods = [s.period for s in snapshots]
        counts  = [s.count for s in snapshots]

        if len(counts) < 2:
            return TrendResult(
                role_title=role_title, geography=geography,
                periods=periods, counts=counts,
                growth_rate_mom=0.0, growth_rate_total=0.0,
                cagr=None, trend_direction="stable",
                velocity=0.0, projected_next=None, confidence=0.0,
            )

        # MoM growth rates
        mom_rates = []
        for i in range(1, len(counts)):
            prev = counts[i - 1]
            curr = counts[i]
            if prev > 0:
                mom_rates.append((curr - prev) / prev)
            else:
                mom_rates.append(1.0 if curr > 0 else 0.0)

        growth_mom   = float(np.mean(mom_rates)) if mom_rates else 0.0
        growth_total = ((counts[-1] - counts[0]) / counts[0]) if counts[0] > 0 else 0.0

        # CAGR (se ≥12 mesi)
        cagr: Optional[float] = None
        n_months = len(counts) - 1
        if n_months >= 12 and counts[0] > 0:
            years = n_months / 12
            cagr = (counts[-1] / counts[0]) ** (1 / years) - 1

        # Regressione lineare per proiezione
        x = np.arange(len(counts), dtype=float)
        y = np.array(counts, dtype=float)
        coeffs = np.polyfit(x, y, 1)
        slope, intercept = coeffs
        y_pred = np.polyval(coeffs, x)

        # R² per confidence
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r2 = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

        projected = max(0, int(slope * len(counts) + intercept))

        # Velocity: media ultimi 3 vs precedenti
        half = max(1, len(counts) // 2)
        recent_mean = np.mean(counts[-min(3, len(counts)):])
        older_mean  = np.mean(counts[:half])
        velocity = float((recent_mean - older_mean) / older_mean) if older_mean > 0 else 0.0

        # Direction
        if growth_mom > 0.08:
            direction = "up"
        elif growth_mom < -0.05:
            direction = "down"
        else:
            direction = "stable"

        return TrendResult(
            role_title=role_title,
            geography=geography,
            periods=periods,
            counts=counts,
            growth_rate_mom=round(growth_mom, 4),
            growth_rate_total=round(growth_total, 4),
            cagr=round(cagr, 4) if cagr is not None else None,
            trend_direction=direction,
            velocity=round(velocity, 4),
            projected_next=projected,
            confidence=round(max(0.0, min(1.0, r2)), 4),
        )


# ── WeakSignalClassifier ───────────────────────────────────────────────────────

class WeakSignalClassifier:
    """
    Classifica job title come weak signal emergente basandosi su feature
    estratte da job_posting_snapshots.

    V1: threshold-based con pesi configurabili.
    V2 (future): sostituire con modello logistic regression trainato su
    segnali storici confermati/faded nel DB.

    Pattern: Strategy — sostituibile con ML classifier senza cambiare API.
    """

    # Pesi per il composite score (somma = 1.0)
    WEIGHTS = {
        "growth_rate_mom":   0.35,   # crescita mensile
        "volume_score":      0.25,   # volume attuale normalizzato
        "velocity":          0.20,   # accelerazione recente
        "source_diversity":  0.10,   # quante geography/fonti confermano
        "recency":           0.10,   # quanto recente è l'ultimo segnale
    }

    def score(
        self,
        role_title: str,
        snapshots: List[SnapshotPoint],
        trend: Optional[TrendResult] = None,
        min_count: int = 30,
    ) -> Optional[WeakSignalScore]:
        """
        Calcola lo score weak signal per un role title.
        Restituisce None se il volume è troppo basso per essere affidabile.
        """
        if not snapshots:
            return None

        current_count = max(s.count for s in snapshots)
        if current_count < min_count:
            return None

        # Analizza trend se non già fatto
        if trend is None:
            geography = snapshots[0].geography if snapshots else "Global"
            analyzer = TrendAnalyzer()
            trend = analyzer.analyze(role_title, geography, snapshots)

        if trend is None:
            return None

        factors: Dict[str, float] = {}

        # 1. Growth rate score (MoM normalizzato 0–1)
        factors["growth_rate_mom"] = min(1.0, max(0.0, trend.growth_rate_mom / 3.0))

        # 2. Volume score (normalizzato su target 500 annunci/mese)
        factors["volume_score"] = min(1.0, current_count / 500.0)

        # 3. Velocity score
        factors["velocity"] = min(1.0, max(0.0, (trend.velocity + 1.0) / 2.0))

        # 4. Source diversity (quante geography diverse coprono questo ruolo)
        geos = {s.geography for s in snapshots}
        factors["source_diversity"] = min(1.0, len(geos) / 3.0)

        # 5. Recency (l'ultimo snapshot quanto è recente — 0.0 se > 60gg)
        from datetime import date
        latest_period = max(s.period for s in snapshots)
        try:
            y, m = map(int, latest_period.split("-"))
            latest_date = date(y, m, 1)
            days_ago = (date.today() - latest_date).days
            factors["recency"] = max(0.0, 1.0 - (days_ago / 60.0))
        except Exception:
            factors["recency"] = 0.5

        # Composite score
        strength = sum(
            self.WEIGHTS[k] * factors[k]
            for k in self.WEIGHTS
        )
        strength = round(min(1.0, max(0.0, strength)), 4)

        # Status
        if strength >= 0.60 and current_count >= 50:
            status = "confirmed"
        elif strength >= 0.30:
            status = "emerging"
        elif trend.trend_direction == "down" and strength < 0.20:
            status = "faded"
        else:
            status = "stable"

        return WeakSignalScore(
            role_title=role_title,
            is_emerging=(status in ("emerging", "confirmed")),
            strength=strength,
            factors=factors,
            status=status,
        )
