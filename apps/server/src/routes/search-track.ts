import { Router } from "express";
import { z } from "zod/v4";
import { db, searchEventsTable } from "@workspace/db";
import { getRequestLogger, getRequestUser } from "../lib/request-context";

const router = Router();

const trackSchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1).max(500),
  resultsShown: z
    .array(z.object({ id: z.number(), type: z.string(), title: z.string() }))
    .optional(),
  resultClicked: z.number().optional(),
  resultType: z.string().optional(),
  dwellTimeMs: z.number().optional(),
  dismissed: z.boolean().optional(),
});

router.post("/", async (req, res) => {
  try {
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid tracking data" });
      return;
    }

    const event = {
      sessionId: parsed.data.sessionId ?? null,
      userId: getRequestUser(req)?.id ?? null,
      query: parsed.data.query,
      resultsShown: parsed.data.resultsShown ?? null,
      resultClicked: parsed.data.resultClicked ?? null,
      resultType: parsed.data.resultType ?? null,
      dwellTimeMs: parsed.data.dwellTimeMs ?? null,
      dismissed: parsed.data.dismissed ? 1 : 0,
    };

    await db.insert(searchEventsTable).values(event);
    res.json({ ok: true });
  } catch (err) {
    getRequestLogger(req).error?.({ err }, "search track error");
    res.json({ ok: false });
  }
});

export default router;
