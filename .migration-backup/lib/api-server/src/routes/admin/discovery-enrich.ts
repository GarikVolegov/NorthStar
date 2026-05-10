/**
 * Admin route: POST /api/admin/discovery/enrich
 * ──────────────────────────────────────────────
 *
 * Triggerare manualmente il DiscoveryEnricherAgent.
 *
 * Body (opzionale):
 *   { batchSize?: number, concurrency?: number }
 *
 * Response:
 *   EnricherResult { processed, enriched, skipped, filtered, retried, durationMs, errors }
 *
 * Richiede autenticazione admin (jwtMiddleware applicato in app.ts).
 *
 * GET /api/admin/discovery/enrich/status
 *   Restituisce il numero di item ancora da arricchire (pending).
 */
import { Router, Request, Response } from "express";
import { runEnricher }              from "@workspace/integrations-openai-ai-server";
import { db }                       from "@workspace/db";
import { discoveryItemsTable }      from "@workspace/db";
import { eq, and, lt, count }       from "drizzle-orm";

const router = Router();

// POST / — lancia enricher
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const batchSize   = Math.min(Number(req.body?.batchSize   ?? 20), 100);
  const concurrency = Math.min(Number(req.body?.concurrency ?? 5),  10);

  try {
    const result = await runEnricher(batchSize, concurrency);
    res.json(result);
  } catch (err) {
    console.error("[admin/enrich]", err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /status — item pending
router.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(discoveryItemsTable)
      .where(
        and(
          eq(discoveryItemsTable.isEnriched, false),
          lt(discoveryItemsTable.enrichRetries, 3),
        )
      );
    res.json({ pending: row?.c ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
