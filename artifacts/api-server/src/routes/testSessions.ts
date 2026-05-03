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
import { orchestratorAgent } from "../agents/orchestrator";
import { logAgentCall } from "../agents/logger";
import { parseOrchestratorData, getSubAgentOutput, parseSectorAgentData } from "../lib/agent-helpers";
import { getAuthenticatedUserId, getUserPlan } from "../lib/plan-utils";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/test-sessions", async (req, res): Promise<void> => {
  const parsed = SubmitTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { answers } = parsed.data;
  const allAnswers = answers as Record<string, number>;

  // Deterministic RIASEC scoring
  const riasecScores = computeRiasecScores(allAnswers);
  const primaryTypes = getPrimaryTypes(riasecScores);
  const profileSummary = buildProfileSummary(primaryTypes);

  // Deterministic Spirit scoring
  const spiritScores = extractSpiritAnswers(allAnswers);
  const dominantSpirit = getDominantSpirit(spiritScores);
  const secondarySpirit = getSecondarySpiritS(spiritScores);
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit, spiritScores);

  // Detect user and plan from JWT/session (test sessions can be submitted by both authed and anon)
  const authenticatedUserId = getAuthenticatedUserId(req);
  const plan = authenticatedUserId ? await getUserPlan(authenticatedUserId) : "free";

  // Delegate sector matching to SectorAgent via orchestrator
  let agentRecommendations: Array<{
    sectorId: number;
    sectorName: string;
    matchScore: number;
    matchReason: string;
    sector: Record<string, unknown>;
  }> = [];

  try {
    const _agentStart = Date.now();
    const agentResult = await orchestratorAgent.run({
      taskType: "sector_match",
      payload: { riasecScores, spiritScores, primaryTypes },
      context: { userId: authenticatedUserId, plan, sharedState: {} },
    });
    await logAgentCall({
      agentName: "OrchestratorAgent",
      userId: authenticatedUserId,
      taskType: "sector_match",
      inputSummary: { source: "test-sessions", plan },
      outputSummary: { success: agentResult.success },
      durationMs: Date.now() - _agentStart,
      error: agentResult.error,
      retryCount: 0,
    });

    if (agentResult.success) {
      const orcData = parseOrchestratorData(agentResult);
      const sectorData = orcData
        ? parseSectorAgentData(getSubAgentOutput(orcData, "SectorAgent"))
        : null;

      if (sectorData && sectorData.sectors.length > 0) {
        const allSectors = await db.select().from(sectorsTable);
        agentRecommendations = sectorData.sectors.map((s) => {
          const dbSector = allSectors.find((sec) => sec.id === s.sectorId);
          return {
            sectorId: s.sectorId,
            sectorName: s.sectorName,
            matchScore: s.matchScore,
            matchReason: s.motivation,
            sector: dbSector
              ? {
                  ...dbSector,
                  riasecTypes: dbSector.riasecTypes as string[],
                  skills: dbSector.skills as string[],
                  advantages: dbSector.advantages as string[],
                  disadvantages: dbSector.disadvantages as string[],
                  opportunities: dbSector.opportunities as string[],
                  createdAt: dbSector.createdAt.toISOString(),
                }
              : {},
          };
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "SectorAgent delegation failed, falling back to direct computation");
  }

  // Fallback: deterministic sector computation if agent failed
  if (agentRecommendations.length === 0) {
    const sectors = await db.select().from(sectorsTable);
    agentRecommendations = sectors
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
  }

  const recommendations = agentRecommendations;

  const [session] = await db
    .insert(testSessionsTable)
    .values({
      ...(authenticatedUserId ? { userId: authenticatedUserId } : {}),
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
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit, spiritScores);

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

router.post("/test-sessions/:id/assign-user", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  const userId = req.body?.userId;
  if (typeof userId !== "number") {
    res.status(400).json({ error: "userId richiesto" });
    return;
  }

  const [session] = await db
    .select()
    .from(testSessionsTable)
    .where(eq(testSessionsTable.id, id));

  if (!session) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  await db
    .update(testSessionsTable)
    .set({ userId })
    .where(eq(testSessionsTable.id, id));

  res.json({ ok: true, sessionId: id, userId });
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
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit, spiritScores);

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
