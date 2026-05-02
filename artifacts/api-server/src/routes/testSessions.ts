import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, testSessionsTable, sectorsTable } from "@workspace/db";
import {
  SubmitTestBody,
  GetTestSessionParams,
  ConfirmSectorParams,
  ConfirmSectorBody,
} from "@workspace/api-zod";
import {
  computeRiasecScores,
  getPrimaryTypes,
  buildProfileSummary,
  computeMatchScore,
  buildMatchReason,
} from "../lib/riasec";

const router: IRouter = Router();

router.post("/test-sessions", async (req, res): Promise<void> => {
  const parsed = SubmitTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { answers } = parsed.data;
  const riasecScores = computeRiasecScores(answers as Record<string, number>);
  const primaryTypes = getPrimaryTypes(riasecScores);
  const profileSummary = buildProfileSummary(primaryTypes);

  const sectors = await db.select().from(sectorsTable);

  const recommendations = sectors
    .map((sector) => {
      const matchScore = computeMatchScore(
        riasecScores,
        sector.riasecTypes as string[],
      );
      const matchReason = buildMatchReason(
        primaryTypes,
        sector.name,
        sector.riasecTypes as string[],
      );
      return {
        sectorId: sector.id,
        sectorName: sector.name,
        matchScore,
        matchReason,
        sector: {
          ...sector,
          riasecTypes: sector.riasecTypes as string[],
          skills: sector.skills as string[],
          advantages: sector.advantages as string[],
          disadvantages: sector.disadvantages as string[],
          opportunities: sector.opportunities as string[],
          createdAt: sector.createdAt.toISOString(),
        },
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  const [session] = await db
    .insert(testSessionsTable)
    .values({
      answers: answers as Record<string, number>,
      riasecScores,
      primaryTypes,
      profileSummary,
      recommendations: recommendations.map(({ sector: _s, ...r }) => r),
    })
    .returning();

  res.status(201).json({
    id: session.id,
    userId: session.userId,
    answers: session.answers,
    riasecScores: session.riasecScores,
    primaryTypes: session.primaryTypes,
    profileSummary: session.profileSummary,
    recommendations,
    confirmedSectorId: session.confirmedSectorId,
    createdAt: session.createdAt.toISOString(),
  });
});

router.get("/test-sessions/:id", async (req, res): Promise<void> => {
  const params = GetTestSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(testSessionsTable)
    .where(eq(testSessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Test session not found" });
    return;
  }

  const storedRecs = (session.recommendations ?? []) as Array<{
    sectorId: number;
    sectorName: string;
    matchScore: number;
    matchReason: string;
  }>;

  const sectorIds = storedRecs.map((r) => r.sectorId);
  const sectors = sectorIds.length > 0
    ? await db.select().from(sectorsTable)
    : [];

  const recommendations = storedRecs.map((rec) => {
    const sector = sectors.find((s) => s.id === rec.sectorId);
    return {
      ...rec,
      sector: sector
        ? {
            ...sector,
            riasecTypes: sector.riasecTypes as string[],
            skills: sector.skills as string[],
            advantages: sector.advantages as string[],
            disadvantages: sector.disadvantages as string[],
            opportunities: sector.opportunities as string[],
            createdAt: sector.createdAt.toISOString(),
          }
        : null,
    };
  });

  res.json({
    id: session.id,
    userId: session.userId,
    answers: session.answers,
    riasecScores: session.riasecScores,
    primaryTypes: session.primaryTypes,
    profileSummary: session.profileSummary,
    recommendations,
    confirmedSectorId: session.confirmedSectorId,
    createdAt: session.createdAt.toISOString(),
  });
});

router.post("/test-sessions/:id/confirm", async (req, res): Promise<void> => {
  const params = ConfirmSectorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ConfirmSectorBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(testSessionsTable)
    .where(eq(testSessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Test session not found" });
    return;
  }

  const [updated] = await db
    .update(testSessionsTable)
    .set({ confirmedSectorId: body.data.sectorId })
    .where(eq(testSessionsTable.id, params.data.id))
    .returning();

  const storedRecs = (updated.recommendations ?? []) as Array<{
    sectorId: number;
    sectorName: string;
    matchScore: number;
    matchReason: string;
  }>;

  const sectorIds = storedRecs.map((r) => r.sectorId);
  const sectors = sectorIds.length > 0
    ? await db.select().from(sectorsTable)
    : [];

  const recommendations = storedRecs.map((rec) => {
    const sector = sectors.find((s) => s.id === rec.sectorId);
    return {
      ...rec,
      sector: sector
        ? {
            ...sector,
            riasecTypes: sector.riasecTypes as string[],
            skills: sector.skills as string[],
            advantages: sector.advantages as string[],
            disadvantages: sector.disadvantages as string[],
            opportunities: sector.opportunities as string[],
            createdAt: sector.createdAt.toISOString(),
          }
        : null,
    };
  });

  res.json({
    id: updated.id,
    userId: updated.userId,
    answers: updated.answers,
    riasecScores: updated.riasecScores,
    primaryTypes: updated.primaryTypes,
    profileSummary: updated.profileSummary,
    recommendations,
    confirmedSectorId: updated.confirmedSectorId,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
