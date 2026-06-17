import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, pool, sectorsTable, testSessionsTable } from "@workspace/db";
import { cached } from "../lib/redis";

const router = Router();

// Endpoint pubblico: aggrega l'INTERA test_sessions (jsonb_array_elements) ad
// ogni hit → cache 5 min per non scansionare la tabella ad ogni visita
// landing/anonima (era DDoS-abile e dominava la CPU del DB sotto traffico).
const SUMMARY_TTL_SECONDS = 300;

router.get("/summary", async (req, res) => {
  try {
    const summary = await cached("stats:summary", SUMMARY_TTL_SECONDS, async () => {
      const [sectorCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sectorsTable);

      const [sessionCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(testSessionsTable);

      const [avgGrowth] = await db
        .select({ avg: sql<number>`coalesce(avg(growth_rate),0)` })
        .from(sectorsTable);

      const { rows: topSectorsResult } = await pool.query<{ name: string; count: number }>(`
        SELECT r->>'sectorName' AS name, count(*)::int AS count
        FROM test_sessions,
        jsonb_array_elements(
          CASE
            WHEN recommendations IS NULL THEN '[]'::jsonb
            WHEN jsonb_typeof(recommendations::jsonb) = 'array' THEN recommendations::jsonb
            ELSE '[]'::jsonb
          END
        ) AS r
        WHERE r->>'sectorName' IS NOT NULL
        GROUP BY r->>'sectorName'
        ORDER BY count(*) DESC
        LIMIT 10
      `);

      return {
        totalSectors: Number(sectorCount?.count ?? 0),
        totalTestsTaken: Number(sessionCount?.count ?? 0),
        topSectors: topSectorsResult.map((s: { name: string; count: number }) => ({ name: s.name, count: s.count })),
        avgGrowthRate: Number(avgGrowth?.avg ?? 0),
      };
    });

    res.json(summary);
  } catch (err) {
    req.log?.error?.({ err }, "stats summary error");
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

export default router;
