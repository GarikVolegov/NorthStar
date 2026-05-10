import type { Agent, AgentInput, AgentOutput, AgentContext, TaskType } from "./types";
import type { SharedStateNamespaces } from "./types";
import { personalityAgent } from "./personality";
import { sectorAgent } from "./sector";
import { professionAgent } from "./profession";
import { educationAgent } from "./education";
import { newsAgent } from "./news";
import { growthAgent } from "./growth";
import { calendarAgent } from "./calendar";
import { affiliationAgent } from "./affiliation";
import { workModeAgent } from "./work-mode";
import { validatorAgent } from "./validator";
import { withAgentLog } from "./logger";
import { logger } from "../lib/logger";
import type { ValidationSummary } from "../lib/agent-helpers";

const STATIC_FALLBACK: Record<string, AgentOutput> = {
  PersonalityAgent: {
    agentName: "PersonalityAgent",
    success: false,
    partial: true,
    data: { message: "Completa il test per ottenere il tuo profilo personalità." },
  },
  SectorAgent: {
    agentName: "SectorAgent",
    success: false,
    partial: true,
    data: { sectors: [], message: "Nessun settore disponibile al momento." },
  },
  ProfessionAgent: {
    agentName: "ProfessionAgent",
    success: false,
    partial: true,
    data: { professions: [], message: "Nessuna professione disponibile al momento." },
  },
};

async function runAgentSafe(
  agent: Agent,
  input: AgentInput,
  userId: number | undefined,
): Promise<AgentOutput> {
  const result = await withAgentLog(
    agent.name,
    input.taskType,
    userId,
    { taskType: input.taskType, plan: input.context.plan },
    () => agent.run(input),
  );

  if (!result.success && !result.partial) {
    logger.error({ agentName: agent.name, error: result.error }, "Agent failed after retry");
    return STATIC_FALLBACK[agent.name] ?? { ...result, partial: true };
  }

  return result;
}

function withSharedState(context: AgentContext, patch: Partial<SharedStateNamespaces>): AgentContext {
  return { ...context, sharedState: { ...context.sharedState, ...patch } };
}

function buildInput(
  taskType: string,
  payload: Record<string, unknown>,
  context: AgentContext,
): AgentInput {
  return { taskType, payload, context };
}

async function runFullProfile(
  payload: Record<string, unknown>,
  context: AgentContext,
  userId: number | undefined,
): Promise<Record<string, AgentOutput>> {
  const results: Record<string, AgentOutput> = {};
  const isPremium = context.plan === "premium";

  // Step 1: PersonalityAgent — derives primaryTypes
  const personalityResult = await runAgentSafe(
    personalityAgent,
    buildInput("personality_analysis", payload, context),
    userId,
  );
  results["PersonalityAgent"] = personalityResult;

  const primaryTypes =
    (personalityResult.data?.["primaryTypes"] as string[] | undefined) ??
    (payload["primaryTypes"] as string[] | undefined) ??
    [];

  const ctx1 = withSharedState(context, {
    personality: personalityResult.success
      ? (personalityResult.data as unknown as SharedStateNamespaces["personality"])
      : undefined,
  });

  // Step 2: SectorAgent — requires primaryTypes from Step 1
  const enrichedPayload = { ...payload, primaryTypes };
  const sectorResult = await runAgentSafe(
    sectorAgent,
    buildInput("sector_match", enrichedPayload, ctx1),
    userId,
  );
  results["SectorAgent"] = sectorResult;

  const topSectors =
    (sectorResult.data?.["sectors"] as Array<{ sectorName: string }> | undefined) ?? [];

  const ctx2 = withSharedState(ctx1, {
    sectors: sectorResult.success
      ? (sectorResult.data?.["sectors"] as SharedStateNamespaces["sectors"])
      : undefined,
  });

  // Step 3a: Parallel agents that don't depend on each other
  // EducationAgent intentionally excluded here — it needs professions from Step 3b
  const sharedPayload = { ...enrichedPayload, topSectors };

  const [profResult, newsResult, growthResult, workResult] = await Promise.all([
    runAgentSafe(professionAgent, buildInput("profession_match", sharedPayload, ctx2), userId),
    runAgentSafe(newsAgent, buildInput("news_filter", sharedPayload, ctx2), userId),
    runAgentSafe(growthAgent, buildInput("growth_suggestions", sharedPayload, ctx2), userId),
    isPremium
      ? runAgentSafe(workModeAgent, buildInput("work_mode_analysis", sharedPayload, ctx2), userId)
      : Promise.resolve<AgentOutput>({ agentName: "WorkModeAgent", success: false, partial: true, data: {} }),
  ]);

  results["ProfessionAgent"] = profResult;
  results["NewsAgent"] = newsResult;
  results["GrowthAgent"] = growthResult;
  if (isPremium) results["WorkModeAgent"] = workResult;

  const professions = (profResult.data?.["professions"] as Array<{ title: string }> | undefined) ?? [];

  const ctx3 = withSharedState(ctx2, {
    jobs: profResult.success
      ? (profResult.data?.["professions"] as SharedStateNamespaces["jobs"])
      : undefined,
  });

  // Step 3b: EducationAgent (needs professions from Step 3a) and CalendarAgent (premium only)
  if (isPremium) {
    const educationResult = await runAgentSafe(
      educationAgent,
      buildInput("education_path", { ...sharedPayload, professions }, ctx3),
      userId,
    );
    results["EducationAgent"] = educationResult;

    const educationPaths = (educationResult.data?.["educationPaths"] as Array<{ path: string }> | undefined) ?? [];

    const ctx4 = withSharedState(ctx3, {
      education: educationResult.success
        ? (educationResult.data?.["educationPaths"] as SharedStateNamespaces["education"])
        : undefined,
    });

    const calendarResult = await runAgentSafe(
      calendarAgent,
      buildInput("calendar_events", { primaryTypes, professions, educationPaths }, ctx4),
      userId,
    );
    results["CalendarAgent"] = calendarResult;
  }

  return results;
}

async function runSingleAgent(
  taskType: TaskType,
  payload: Record<string, unknown>,
  context: AgentContext,
  userId: number | undefined,
): Promise<Record<string, AgentOutput>> {
  const results: Record<string, AgentOutput> = {};

  const agentMap: Record<string, Agent> = {
    personality_analysis: personalityAgent,
    sector_match: sectorAgent,
    profession_match: professionAgent,
    education_path: educationAgent,
    news_filter: newsAgent,
    growth_suggestions: growthAgent,
    calendar_events: calendarAgent,
    affiliation_materials: affiliationAgent,
    work_mode_analysis: workModeAgent,
  };

  const agent = agentMap[taskType];
  if (agent) {
    results[agent.name] = await runAgentSafe(agent, buildInput(taskType, payload, context), userId);
  }

  return results;
}

export const orchestratorAgent: Agent = {
  name: "OrchestratorAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    const taskType = input.taskType as TaskType;
    const userId = input.context.userId;
    const start = Date.now();

    logger.info({ taskType, userId, plan: input.context.plan }, "Orchestrator starting");

    try {
      let agentResults: Record<string, AgentOutput>;

      if (taskType === "full_profile") {
        agentResults = await runFullProfile(input.payload, input.context, userId);
      } else {
        agentResults = await runSingleAgent(taskType, input.payload, input.context, userId);
      }

      const validatorResult = await runAgentSafe(
        validatorAgent,
        buildInput(taskType, { aggregatedResults: agentResults, taskType }, input.context),
        userId,
      );
      agentResults["ValidatorAgent"] = validatorResult;

      const validation = validatorResult.data as unknown as ValidationSummary;
      const hasErrors = !validation?.valid && (validation?.errors?.length ?? 0) > 0;
      const durationMs = Date.now() - start;

      logger.info(
        {
          taskType,
          durationMs,
          agentsRun: Object.keys(agentResults).length,
          validationErrors: validation?.errors?.length ?? 0,
          validationWarnings: validation?.warnings?.length ?? 0,
        },
        "Orchestrator complete",
      );

      return {
        agentName: this.name,
        success: !hasErrors,
        partial: hasErrors ? false : (validation?.warnings?.length ?? 0) > 0,
        data: {
          taskType,
          plan: input.context.plan,
          durationMs,
          validation,
          agents: agentResults,
          summary: buildSummary(taskType, agentResults),
        },
        error: hasErrors
          ? `Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`
          : undefined,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      logger.error({ err, taskType, durationMs }, "Orchestrator failed");
      return {
        agentName: this.name,
        success: false,
        data: { taskType, durationMs },
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

function buildSummary(
  _taskType: string,
  results: Record<string, AgentOutput>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (results["PersonalityAgent"]?.success) {
    summary["personality"] = results["PersonalityAgent"].data;
  }
  if (results["SectorAgent"]?.success) {
    summary["sectors"] = results["SectorAgent"].data?.["sectors"];
  }
  if (results["ProfessionAgent"]?.success) {
    summary["professions"] = results["ProfessionAgent"].data?.["professions"];
  }
  if (results["EducationAgent"]?.success) {
    summary["educationPaths"] = results["EducationAgent"].data?.["educationPaths"];
  }
  if (results["NewsAgent"]?.success) {
    summary["news"] = results["NewsAgent"].data?.["news"];
  }
  if (results["GrowthAgent"]?.success) {
    summary["growth"] = results["GrowthAgent"].data?.["articles"];
  }
  if (results["CalendarAgent"]?.success) {
    summary["calendarEvents"] = results["CalendarAgent"].data?.["suggestedEvents"];
  }
  if (results["WorkModeAgent"]?.success) {
    summary["workMode"] = results["WorkModeAgent"].data;
  }
  if (results["AffiliationAgent"]?.success) {
    summary["affiliation"] = results["AffiliationAgent"].data;
  }

  return summary;
}
