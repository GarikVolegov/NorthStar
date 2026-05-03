import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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
  applyWorkModeBoost,
  RIASEC_SUGGESTED_WORK_MODE,
  type WorkMode,
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
import { usersTable } from "@workspace/db";
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

  const riasecScores = computeRiasecScores(allAnswers);
  const primaryTypes = getPrimaryTypes(riasecScores);
  const profileSummary = buildProfileSummary(primaryTypes);

  const spiritScores = extractSpiritAnswers(allAnswers);
  const dominantSpirit = getDominantSpirit(spiritScores);
  const secondarySpirit = getSecondarySpiritS(spiritScores);
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit, spiritScores);

  const authenticatedUserId = getAuthenticatedUserId(req);
  const plan = authenticatedUserId ? await getUserPlan(authenticatedUserId) : "free";

  let userWorkMode: WorkMode = "unknown";
  if (authenticatedUserId) {
    const [userRow] = await db
      .select({ workPreference: usersTable.workPreference })
      .from(usersTable)
      .where(eq(usersTable.id, authenticatedUserId));
    if (userRow?.workPreference) {
      userWorkMode = userRow.workPreference as WorkMode;
    }
  }

  const agentReasonMap: Record<number, string> = {};
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
      if (sectorData) {
        for (const s of sectorData.sectors) {
          agentReasonMap[s.sectorId] = s.motivation;
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "SectorAgent failed, using computed match reasons");
  }

  const allSectors = await db.select().from(sectorsTable);
  const allScored = allSectors
    .map((sector) => {
      const baseScore = computeMatchScore(riasecScores, sector.riasecTypes as string[]);
      const spiritBoost = computeSpiritBoost(spiritScores, sector.name);
      const matchScore = Math.min(99, baseScore + spiritBoost);
      const matchReason = agentReasonMap[sector.id] ?? buildMatchReason(primaryTypes, sector.name, sector.riasecTypes as string[]);
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
    .sort((a, b) => b.matchScore - a.matchScore);

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
      recommendations: allScored.map(({ sector: _s, ...r }) => r),
    })
    .returning();

  const boostedRecommendations = allScored
    .map((rec) => {
      const sectorWorkMode = (rec.sector as { workMode?: Array<"dipendente" | "autonomo" | "ibrido"> | null })?.workMode ?? null;
      const boostedScore = applyWorkModeBoost(rec.matchScore, userWorkMode, sectorWorkMode);
      return { ...rec, matchScore: boostedScore };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  const suggestedWorkModeForSession = primaryTypes.length > 0
    ? (RIASEC_SUGGESTED_WORK_MODE[primaryTypes[0] as keyof typeof RIASEC_SUGGESTED_WORK_MODE] ?? "ibrido")
    : "ibrido";

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
    suggestedWorkMode: suggestedWorkModeForSession,
    recommendations: boostedRecommendations,
    confirmedSectorId: session.confirmedSectorId,
    createdAt: session.createdAt.toISOString(),
  });
});

router.get("/test-sessions/latest", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [userRow] = await db
    .select({ testSessionId: usersTable.testSessionId, workPreference: usersTable.workPreference })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!userRow) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const sessionsByUser = await db
    .select()
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  const [session] = sessionsByUser.length > 0
    ? sessionsByUser
    : userRow.testSessionId
      ? await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, userRow.testSessionId))
      : [];

  if (!session) {
    res.status(404).json({ error: "Test session not found" });
    return;
  }

  const validWorkModes: WorkMode[] = ["dipendente", "autonomo", "ibrido", "unknown"];
  const sessionUserWorkMode: WorkMode =
    userRow.workPreference && validWorkModes.includes(userRow.workPreference as WorkMode)
      ? (userRow.workPreference as WorkMode)
      : "unknown";

  const storedRecs = (session.recommendations ?? []) as Array<{
    sectorId: number; sectorName: string; matchScore: number; matchReason: string;
  }>;

  const sectors = storedRecs.length > 0 ? await db.select().from(sectorsTable) : [];

  const recommendations = storedRecs
    .map((rec) => {
      const sector = sectors.find((s) => s.id === rec.sectorId);
      const boostedScore = applyWorkModeBoost(
        rec.matchScore,
        sessionUserWorkMode,
        sector?.workMode as Array<"dipendente" | "autonomo" | "ibrido"> | null,
      );
      return { sectorId: rec.sectorId, sectorName: rec.sectorName, matchScore: boostedScore, matchReason: rec.matchReason };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  res.json({
    sessionId: session.id,
    workPreference: sessionUserWorkMode,
    recommendations,
    confirmedSectorId: session.confirmedSectorId,
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

  const sessionUserId = session.userId ?? getAuthenticatedUserId(req);
  const workModeParam = req.query.work_mode as string | undefined;
  const validWorkModes: WorkMode[] = ["dipendente", "autonomo", "ibrido", "unknown"];
  let sessionUserWorkMode: WorkMode = "unknown";
  if (workModeParam && validWorkModes.includes(workModeParam as WorkMode)) {
    sessionUserWorkMode = workModeParam as WorkMode;
  } else if (sessionUserId) {
    const [userRow] = await db
      .select({ workPreference: usersTable.workPreference })
      .from(usersTable)
      .where(eq(usersTable.id, sessionUserId));
    if (userRow?.workPreference) {
      sessionUserWorkMode = userRow.workPreference as WorkMode;
    }
  }

  const sectorIds = storedRecs.map((r) => r.sectorId);
  const sectors = sectorIds.length > 0 ? await db.select().from(sectorsTable) : [];

  const recommendations = storedRecs
    .map((rec) => {
      const sector = sectors.find((s) => s.id === rec.sectorId);
      const boostedScore = applyWorkModeBoost(
        rec.matchScore,
        sessionUserWorkMode,
        sector?.workMode as Array<"dipendente" | "autonomo" | "ibrido"> | null,
      );
      return {
        ...rec,
        matchScore: boostedScore,
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
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  const spiritScores = (session.spiritScores ?? {}) as Record<string, number>;
  const dominantSpirit = session.dominantSpirit ?? "";
  const secondarySpirit = getSecondarySpiritS(spiritScores);
  const spiritInsight = buildSpiritInsight(dominantSpirit, secondarySpirit, spiritScores);

  const primaryTypesForWorkMode = (session.primaryTypes ?? []) as string[];
  const suggestedWorkMode = primaryTypesForWorkMode.length > 0
    ? (RIASEC_SUGGESTED_WORK_MODE[primaryTypesForWorkMode[0] as keyof typeof RIASEC_SUGGESTED_WORK_MODE] ?? "ibrido")
    : "ibrido";

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
    suggestedWorkMode,
    recommendations,
    confirmedSectorId: session.confirmedSectorId,
    createdAt: session.createdAt.toISOString(),
  });
});

router.post("/test-sessions/:id/assign-user", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
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
