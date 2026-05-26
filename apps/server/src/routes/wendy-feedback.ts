/**
 * POST /api/ai/wendy/feedback
 *
 * Raccoglie 👍/👎 sulle risposte di Wendy.
 *
 * SECURITY:
 *   - userId sempre da JWT, mai dal body
 *   - Verifica che requestId non sia già stato votato dallo stesso utente (idempotente)
 *   - Nessun testo libero: solo reason enum predefinito
 *
 * PRIVACY: nessun contenuto del messaggio nei log.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { optionalAuth } from "../middleware/auth";
import { db, wendyFeedbackTable } from "@workspace/db";
import { rootLogger } from "../middleware/logger";
import { recordUserFeedback } from "@workspace/ai-server";

const router = Router();

const FeedbackSchema = z.object({
  requestId: z.string().min(1).max(100),
  rating:    z.enum(["up", "down"]),
  reason:    z.enum(["inaccurate", "irrelevant", "too_long", "too_slow", "harmful", "other"]).optional(),
  // Contesto snapshot (non-PII) — inviato dal frontend per arricchire l'analisi
  intent:    z.string().max(30).optional(),
  domain:    z.string().max(32).optional(),
  toolsUsed: z.array(z.string().max(50)).max(10).optional(),
});

router.post("/", optionalAuth, async (req: Request, res: Response) => {
  const parsed = FeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati feedback non validi", details: parsed.error.flatten() });
    return;
  }

  const { requestId, rating, reason, intent, domain, toolsUsed } = parsed.data;
  const userId = req.user?.id ?? null;

  try {
    // Idempotente: aggiorna se esiste già un voto per questo requestId/userId
    const [existing] = await db
      .select({ id: wendyFeedbackTable.id })
      .from(wendyFeedbackTable)
      .where(
        userId
          ? and(eq(wendyFeedbackTable.requestId, requestId), eq(wendyFeedbackTable.userId, userId))
          : eq(wendyFeedbackTable.requestId, requestId),
      )
      .limit(1);

    if (existing) {
      await db
        .update(wendyFeedbackTable)
        .set({ rating, reason: reason ?? null })
        .where(eq(wendyFeedbackTable.id, existing.id));
    } else {
      await db.insert(wendyFeedbackTable).values({
        requestId,
        userId,
        rating,
        reason: reason ?? null,
        intent: intent ?? null,
        toolsUsed: toolsUsed ?? [],
      });
    }

    rootLogger.info(
      { requestId, rating, reason, userId, intent, domain },
      "[wendy-feedback] recorded",
    );

    await recordUserFeedback(requestId, rating, domain);

    res.json({ ok: true });
  } catch (err) {
    rootLogger.error({ err, requestId }, "[wendy-feedback] insert failed");
    res.status(500).json({ error: "Errore nel salvataggio del feedback" });
  }
});

export default router;
