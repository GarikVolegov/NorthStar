import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import { getEffectivePlan, planMeets } from "../middleware/check-feature";

const router = Router();

const SUPPORTED_TASK_TYPES = ["status", "introspection", "summary"] as const;
type SupportedTaskType = (typeof SUPPORTED_TASK_TYPES)[number];

const AgentRequestSchema = z.object({
  taskType: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const capabilities = [
  {
    taskType: "status",
    description: "Returns authenticated agent availability and plan status.",
  },
  {
    taskType: "introspection",
    description: "Returns the deterministic actions this endpoint can perform.",
  },
  {
    taskType: "summary",
    description: "Returns the legacy empty summary envelope for compatibility.",
  },
] satisfies Array<{ taskType: SupportedTaskType; description: string }>;

function isSupportedTaskType(value: string): value is SupportedTaskType {
  return (SUPPORTED_TASK_TYPES as readonly string[]).includes(value);
}

async function sendAgentResponse(
  res: Response,
  userId: number,
  taskType: SupportedTaskType,
  start: number,
) {
  const currentPlan = await getEffectivePlan(userId);

  res.json({
    success: true,
    plan: planMeets(currentPlan, "pro") ? "premium" : "free",
    capabilities,
    action: {
      taskType,
      status: "completed",
      mode: "deterministic",
      externalServices: false,
    },
    data: {
      status: {
        authenticated: true,
        userId,
        plan: currentPlan,
        availableTaskTypes: SUPPORTED_TASK_TYPES,
        externalServicesRequired: false,
      },
      summary: {
        professions: [],
        educationPaths: [],
        growth: [],
        news: [],
        calendarEvents: [],
      },
      durationMs: Date.now() - start,
      validation: { valid: true, errors: [], warnings: [] },
    },
  });
}

router.get("/", requireAuth, async (req, res) => {
  await sendAgentResponse(res, req.user!.id, "status", Date.now());
});

router.post("/", requireAuth, async (req, res) => {
  const start = Date.now();
  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta agente non valida" });
    return;
  }

  const taskType = parsed.data.taskType ?? "summary";
  if (!isSupportedTaskType(taskType)) {
    res.status(400).json({
      error: "Task agente non supportato",
      supportedTaskTypes: SUPPORTED_TASK_TYPES,
    });
    return;
  }

  await sendAgentResponse(res, req.user!.id, taskType, start);
});

export default router;
