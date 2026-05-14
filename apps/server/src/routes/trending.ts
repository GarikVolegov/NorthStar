import { Router } from "express";
import { desc, sql } from "drizzle-orm";
import { db, pool, sectorsTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { rows: pickCounts } = await pool.query<{ name: string; total_picks: number }>(`
      SELECT r->>'sectorName' AS name, count(*)::int AS total_picks
      FROM test_sessions,
      jsonb_array_elements(recommendations::jsonb) AS r
      GROUP BY r->>'sectorName'
    `);

    const pickMap = new Map(pickCounts.map((p) => [p.name, p.total_picks]));

    const sectors = await db
      .select({
        id: sectorsTable.id,
        name: sectorsTable.name,
        icon: sectorsTable.icon,
        description: sectorsTable.description,
        trend: sectorsTable.trend,
        growthRate: sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        avgSalaryMin: sectorsTable.avgSalaryMin,
        avgSalaryMax: sectorsTable.avgSalaryMax,
        riasecTypes: sectorsTable.riasecTypes,
      })
      .from(sectorsTable)
      .orderBy(desc(sectorsTable.growthRate))
      .limit(20);

    const result = sectors.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      trend: s.trend,
      growthRate: s.growthRate,
      automationRisk: s.automationRisk,
      avgSalaryMin: s.avgSalaryMin,
      avgSalaryMax: s.avgSalaryMax,
      riasecTypes: s.riasecTypes,
      weeklyPicks: 0,
      totalPicks: pickMap.get(s.name) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log?.error?.({ err }, "trending sectors error");
    res.status(500).json({ error: "Errore nel recupero dei settori trending" });
  }
});

export default router;
