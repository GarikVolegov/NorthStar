import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import { getEffectivePlan, planMeets } from "../middleware/check-feature";

const router = Router();

const AgentRequestSchema = z.object({
  taskType: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const start = Date.now();
  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta agente non valida" });
    return;
  }

  const currentPlan = await getEffectivePlan(req.user!.id);

  res.json({
    success: true,
    plan: planMeets(currentPlan, "pro") ? "premium" : "free",
    data: {
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
});

export default router;
