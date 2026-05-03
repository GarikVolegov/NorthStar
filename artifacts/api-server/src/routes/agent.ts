import { Router, type IRouter } from "express";
import { AgentRequestSchema, PREMIUM_TASK_TYPES } from "../agents/types";
import { orchestratorAgent } from "../agents/orchestrator";
import { getAuthenticatedUserId, getUserPlan } from "../lib/plan-utils";
import { parseOrchestratorData } from "../lib/agent-helpers";
import { logAgentCall } from "../agents/logger";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/agent", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { taskType, payload } = parsed.data;
  const plan = await getUserPlan(userId);

  if (plan === "free" && PREMIUM_TASK_TYPES.has(taskType)) {
    res.status(403).json({
      error: "Piano Premium richiesto",
      message: `Il task '${taskType}' richiede un piano Premium.`,
      requiredPlan: "premium",
    });
    return;
  }

  const clientSharedState = parsed.data.context?.sharedState ?? {};
  const context = {
    userId,
    plan,
    sharedState: clientSharedState,
  };

  logger.info({ taskType, userId, plan }, "Agent request received");

  const start = Date.now();
  const result = await orchestratorAgent.run({ taskType, payload, context });
  const durationMs = Date.now() - start;

  await logAgentCall({
    agentName: "OrchestratorAgent",
    userId,
    taskType,
    inputSummary: { taskType, plan, payloadKeys: Object.keys(payload) },
    outputSummary: { success: result.success, hasError: !!result.error },
    durationMs,
    error: result.error,
    retryCount: 0,
  });

  if (!result.success) {
    const orcData = parseOrchestratorData(result);
    res.status(422).json({
      success: false,
      error: result.error ?? "Orchestrator failed",
      taskType,
      plan,
      validation: orcData?.validation ?? null,
    });
    return;
  }

  res.json({
    success: true,
    taskType,
    plan,
    data: result.data,
  });
});

router.get("/agent/health", (_req, res): void => {
  res.json({
    status: "ok",
    agents: [
      "OrchestratorAgent",
      "PersonalityAgent",
      "SectorAgent",
      "ProfessionAgent",
      "EducationAgent",
      "NewsAgent",
      "GrowthAgent",
      "CalendarAgent",
      "AffiliationAgent",
      "WorkModeAgent",
      "ValidatorAgent",
    ],
    taskTypes: [
      "full_profile",
      "personality_analysis",
      "sector_match",
      "profession_match",
      "education_path",
      "news_filter",
      "growth_suggestions",
      "calendar_events",
      "affiliation_materials",
      "work_mode_analysis",
    ],
    premiumTasks: Array.from(PREMIUM_TASK_TYPES),
  });
});

export default router;
