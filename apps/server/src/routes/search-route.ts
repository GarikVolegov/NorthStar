import { Router } from "express";
import { z } from "zod/v4";
import { routeQuery, type RouterOutput } from "@workspace/ai-server";

const router = Router();

const routeSchema = z.object({
  q: z.string().min(1).max(500),
  page: z.string().optional(),
  history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
});

router.post("/", async (req, res) => {
  try {
    const parsed = routeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Input non valido", details: parsed.error.issues });
      return;
    }

    const { q, page, history } = parsed.data;
    const result: RouterOutput = await routeQuery({
      q,
      ...(page ? { page } : {}),
      ...(history ? { history } : {}),
    });

    res.json(result);
  } catch (err) {
    req.log?.error?.({ err }, "search-route error");
    res.status(500).json({
      intent: "explore",
      user_mode: "exploring",
      experience_level: "beginner",
      needs_clarification: false,
      clarifying_question: null,
      ui_widget_type: "results_list",
      retrieval_strategy: "hybrid",
      confidence: 0.3,
    });
  }
});

export default router;
