import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  getOpenHumanStatus,
  searchOpenHumanMemory,
  sendOpenHumanMessage,
  startOpenHumanSync,
} from "../lib/openhuman-client";

const router = Router();

const MessageSchema = z.object({
  message: z.string().min(1).max(5000),
});

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "OpenHuman unavailable";
  if (message === "OPENHUMAN_DISABLED") {
    return {
      status: 503,
      body: { error: "OpenHuman non e` abilitato.", state: "disabled" },
    };
  }
  if (message === "OPENHUMAN_NOT_CONFIGURED") {
    return {
      status: 503,
      body: { error: "OpenHuman non e` configurato.", state: "not_configured" },
    };
  }
  return {
    status: 502,
    body: { error: "OpenHuman non raggiungibile.", detail: message },
  };
}

router.get("/status", requireAuth, async (_req: Request, res: Response) => {
  const status = await getOpenHumanStatus();
  res.status(status.state === "connected" ? 200 : 503).json(status);
});

router.get("/memory", requireAuth, async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.status(400).json({ error: "Parametro q richiesto" });
    return;
  }

  try {
    const results = await searchOpenHumanMemory(q, req.user!.id);
    res.json({ results });
  } catch (err) {
    const response = errorResponse(err);
    res.status(response.status).json(response.body);
  }
});

router.post("/message", requireAuth, async (req: Request, res: Response) => {
  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Richiesta non valida",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = await sendOpenHumanMessage(parsed.data.message, req.user!.id);
    res.json(result);
  } catch (err) {
    const response = errorResponse(err);
    res.status(response.status).json(response.body);
  }
});

router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await startOpenHumanSync(req.user!.id);
    res.json(result);
  } catch (err) {
    const response = errorResponse(err);
    res.status(response.status).json(response.body);
  }
});

export default router;
