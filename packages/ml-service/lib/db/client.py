"""
client.py — Async PostgreSQL client per la ML service.

Usa asyncpg per connessione diretta al DB NorthStar (stesso Neon PostgreSQL
usato dal server Express). Legge DATABASE_URL dall'env.

Tabelle di interesse per la ML service:
  - job_posting_snapshots — dati aggregati mensili (input per analisi trend)
  - weak_signals          — output del classifier
  - rag_chunks            — per ricerca semantica via embedding
  - rag_sources           — metadati fonti RAG

PRIVACY: nessun dato utente (no userId, no PII) — solo aggregati di mercato.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List, Optional

import asyncpg  # type: ignore

logger = logging.getLogger(__name__)

# Singleton connection pool
_pool: Optional[asyncpg.Pool] = None

DATABASE_URL = os.getenv("DATABASE_URL", "")


async def get_pool() -> asyncpg.Pool:
    """Restituisce il pool di connessioni (singleton)."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("[db] DATABASE_URL non configurato")
        logger.info("[db] creating connection pool")
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("[db] pool ready")
    return _pool


async def close_pool() -> None:
    """Chiude il pool al termine del processo."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("[db] pool closed")


@asynccontextmanager
async def connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Context manager per acquisire una connessione dal pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


# ── Query helpers ──────────────────────────────────────────────────────────────

async def fetch_job_posting_snapshots(
    role_title: Optional[str] = None,
    geography: Optional[str] = None,
    limit_periods: int = 12,
) -> List[dict]:
    """
    Recupera snapshot aggregati di job posting per role title e geography.
    Ordina per period DESC, limita agli ultimi N mesi.
    """
    async with connection() as conn:
        where_clauses = []
        args = []

        if role_title:
            where_clauses.append(f"LOWER(role_title) = LOWER(${len(args) + 1})")
            args.append(role_title)

        if geography:
            where_clauses.append(f"geography = ${len(args) + 1}")
            args.append(geography)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        rows = await conn.fetch(
            f"""
            SELECT role_title, period, count, geography, top_skills,
                   avg_salary_min, avg_salary_max, growth_rate
            FROM job_posting_snapshots
            {where_sql}
            ORDER BY period DESC
            LIMIT {limit_periods * 20}
            """,
            *args,
        )
        return [dict(r) for r in rows]


async def fetch_emerging_role_titles(
    geography: Optional[str] = None,
    min_count: int = 20,
    periods: int = 2,
) -> List[str]:
    """
    Recupera i role title con crescita rapida negli ultimi N periodi.
    Usato come input per WeakSignalClassifier.
    """
    async with connection() as conn:
        geo_filter = "AND geography = $1" if geography else ""
        args = [geography] if geography else []

        rows = await conn.fetch(
            f"""
            SELECT role_title
            FROM job_posting_snapshots
            {geo_filter}
            WHERE count >= {min_count}
            GROUP BY role_title
            HAVING COUNT(DISTINCT period) >= {periods}
            ORDER BY MAX(count) DESC
            LIMIT 200
            """,
            *args,
        )
        return [r["role_title"] for r in rows]


async def upsert_weak_signal(
    role_title: str,
    signal_type: str,
    description: str,
    strength: float,
    status: str,
    geographies: List[str],
    linked_skill_ids: List[str],
    evidence: dict,
) -> int:
    """
    Inserisce o aggiorna un weak_signal nel DB.
    Restituisce l'id del record.
    """
    async with connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO weak_signals
                (signal_type, title, description, strength, status,
                 geographies, linked_sector_ids, linked_role_ids, linked_skill_ids,
                 sources, confirmation_evidence, last_seen_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, '{}', '{}', $7, '{ml_service}', $8, NOW(), NOW())
            ON CONFLICT ON CONSTRAINT weak_signals_pkey DO NOTHING
            RETURNING id
            """,
            signal_type, role_title, description, strength, status,
            geographies, linked_skill_ids,
            evidence,
        )
        if row:
            return row["id"]

        # Aggiorna se esiste già
        updated = await conn.fetchrow(
            """
            UPDATE weak_signals
            SET strength = $1, status = $2, description = $3,
                confirmation_evidence = $4, last_seen_at = NOW(), updated_at = NOW()
            WHERE title = $5 AND signal_type = 'new_job_title'
            RETURNING id
            """,
            strength, status, description, evidence, role_title,
        )
        return updated["id"] if updated else -1
