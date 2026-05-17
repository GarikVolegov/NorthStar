import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, pool, sectorsTable, testSessionsTable } from "@workspace/db";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
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
      jsonb_array_elements(recommendations::jsonb) AS r
      GROUP BY r->>'sectorName'
      ORDER BY count(*) DESC
      LIMIT 10
    `);

    res.json({
      totalSectors: Number(sectorCount?.count ?? 0),
      totalTestsTaken: Number(sessionCount?.count ?? 0),
      topSectors: topSectorsResult.map((s: { name: string; count: number }) => ({ name: s.name, count: s.count })),
      avgGrowthRate: Number(avgGrowth?.avg ?? 0),
    });
  } catch (err) {
    req.log?.error?.({ err }, "stats summary error");
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

export default router;
