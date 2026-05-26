import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth";
import {
  explainGraphifyNode,
  getGraphifyStatus,
  searchGraphify,
} from "../lib/graphify-client";

const router = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  profile: z.enum(["code", "process", "docs", "all"]).optional(),
});

const ExplainQuerySchema = z.object({
  graph: z.string().min(1).max(80),
  id: z.string().min(1).max(500),
});

router.use(requireAuth, requireAdmin);

router.get("/status", async (_req: Request, res: Response) => {
  const status = await getGraphifyStatus();
  res.status(status.state === "ready" ? 200 : 503).json(status);
});

router.get("/search", async (req: Request, res: Response) => {
  const parsed = SearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Parametro q richiesto",
      details: parsed.error.flatten(),
    });
    return;
  }

  const results = parsed.data.profile
    ? await searchGraphify(parsed.data.q, { profile: parsed.data.profile })
    : await searchGraphify(parsed.data.q);
  res.json({ results });
});

router.get("/explain", async (req: Request, res: Response) => {
  const parsed = ExplainQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Parametri graph e id richiesti",
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = await explainGraphifyNode(parsed.data.graph, parsed.data.id);
  if (!result) {
    res.status(404).json({ error: "Nodo Graphify non trovato" });
    return;
  }
  res.json(result);
});

export default router;
