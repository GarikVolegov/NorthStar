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
import {
  extractSpiritAnswers,
  getDominantSpirit,
  getSecondarySpiritS,
  computeSpiritBoost,
  buildSpiritInsight,
} from "../lib/spirits";

const router: IRouter = Router();

router.post("/test-sessions", async (req, res): Promise<void> => {
  const parsed = SubmitTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { answers } = parsed.data;
  const allAnswers = answers as Record<string, number>;

  // RIASEC scoring (q1–q12)
  const riasecScores = computeRiasecScores(allAnswers);
  const primaryTypes = getPrimaryTypes(riasecScores);
  const profileSummary = buildProfileSummary(primaryTypes);

  // Spirit scoring (shen, hun, po, yi, zhi keys)
  const spiritScores = extractSpiritAnswers(allAnswers);
  const dominantSpirit = getDominantSpirit(spiritScores);
  const secondarySpirit = getSecondarySpiritS(spiritScores);

  const sectors = await db.select().from(sectorsTable);

  const recommendations = sectors
    .map((sector) => {
      const baseScore = computeMatchScore(riasecScores, sector.riasecTypes as string[]);
      const spiritBoost = computeSpiritBoost(spiritScores, sector.name);
      const matchScore = Math.min(99, baseScore + spiritBoost);
      const matchReason = buildMatchReason(primaryTypes, sector.name, sector.riasecTypes as string[]);
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

  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit);

  const [session] = await db
    .insert(testSessionsTable)
    .values({
      answers: allAnswers,
      riasecScores,
      primaryTypes,
      profileSummary,
      spiritScores,
      dominantSpirit,
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
    spiritScores: session.spiritScores,
    dominantSpirit: session.dominantSpirit,
    spiritInsight,
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
  const sectors = sectorIds.length > 0 ? await db.select().from(sectorsTable) : [];

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

  const spiritScores = (session.spiritScores ?? {}) as Record<string, number>;
  const dominantSpirit = session.dominantSpirit ?? "";
  const secondarySpirit = getSecondarySpiritS(spiritScores);
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit);

  res.json({
    id: session.id,
    userId: session.userId,
    answers: session.answers,
    riasecScores: session.riasecScores,
    primaryTypes: session.primaryTypes,
    profileSummary: session.profileSummary,
    spiritScores,
    dominantSpirit,
    spiritInsight,
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
  const sectors = sectorIds.length > 0 ? await db.select().from(sectorsTable) : [];

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

  const spiritScores = (updated.spiritScores ?? {}) as Record<string, number>;
  const dominantSpirit = updated.dominantSpirit ?? "";
  const secondarySpirit = getSecondarySpiritS(spiritScores);
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit);

  res.json({
    id: updated.id,
    userId: updated.userId,
    answers: updated.answers,
    riasecScores: updated.riasecScores,
    primaryTypes: updated.primaryTypes,
    profileSummary: updated.profileSummary,
    spiritScores,
    dominantSpirit,
    spiritInsight,
    recommendations,
    confirmedSectorId: updated.confirmedSectorId,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
