import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sectorsTable, testSessionsTable } from "@workspace/db";
import {
  GetSectorParams,
  GetSectorResponse,
  GetSectorStatsParams,
  GetSectorStatsResponse,
  GetStatsSummaryResponse,
  ListSectorsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sectors", async (_req, res): Promise<void> => {
  const sectors = await db.select().from(sectorsTable).orderBy(sectorsTable.id);
  res.json(ListSectorsResponse.parse(sectors));
});

router.get("/sectors/:id", async (req, res): Promise<void> => {
  const params = GetSectorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(eq(sectorsTable.id, params.data.id));

  if (!sector) {
    res.status(404).json({ error: "Sector not found" });
    return;
  }

  res.json(GetSectorResponse.parse(sector));
});

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const sectors = await db.select().from(sectorsTable);
  const sessions = await db.select().from(testSessionsTable);

  const confirmedSectorCounts: Record<number, number> = {};
  for (const session of sessions) {
    if (session.confirmedSectorId != null) {
      confirmedSectorCounts[session.confirmedSectorId] =
        (confirmedSectorCounts[session.confirmedSectorId] ?? 0) + 1;
    }
  }

  const topSectors = Object.entries(confirmedSectorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, count]) => {
      const sector = sectors.find((s) => s.id === Number(id));
      return { name: sector?.name ?? "Unknown", count };
    });

  const avgGrowthRate =
    sectors.length > 0
      ? sectors.reduce((sum, s) => sum + s.growthRate, 0) / sectors.length
      : 0;

  res.json(
    GetStatsSummaryResponse.parse({
      totalSectors: sectors.length,
      totalTestsTaken: sessions.length,
      topSectors,
      avgGrowthRate: Math.round(avgGrowthRate * 10) / 10,
    }),
  );
});

router.get("/sectors/:id/stats", async (req, res): Promise<void> => {
  const params = GetSectorStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(eq(sectorsTable.id, params.data.id));

  if (!sector) {
    res.status(404).json({ error: "Sector not found" });
    return;
  }

  const sessions = await db.select().from(testSessionsTable);
  let timesPicked = 0;
  let totalMatchScore = 0;
  let matchCount = 0;

  for (const session of sessions) {
    if (session.confirmedSectorId === params.data.id) {
      timesPicked++;
    }
    const rec = session.recommendations?.find(
      (r) => r.sectorId === params.data.id,
    );
    if (rec) {
      totalMatchScore += rec.matchScore;
      matchCount++;
    }
  }

  const avgMatchScore = matchCount > 0 ? Math.round((totalMatchScore / matchCount) * 10) / 10 : 0;
  const growthRate = sector.growthRate;

  res.json(
    GetSectorStatsResponse.parse({
      sectorId: sector.id,
      timesPicked,
      avgMatchScore,
      salaryRange: `€${sector.avgSalaryMin.toLocaleString("it-IT")} – €${sector.avgSalaryMax.toLocaleString("it-IT")}`,
      growthProjection: {
        shortTerm: `+${Math.round(growthRate * 0.3)}% nei prossimi 2 anni`,
        midTerm: `+${Math.round(growthRate * 0.7)}% nei prossimi 5 anni`,
        longTerm: `+${Math.round(growthRate)}% nei prossimi 10 anni`,
      },
    }),
  );
});

export default router;
