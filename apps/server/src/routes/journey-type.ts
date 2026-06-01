import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, usersTable } from "@workspace/db";
import { invalidateUserFeedCache } from "@workspace/ai-server";
import { isOneOf } from "../lib/type-guards";

const router = Router();

const VALID_JOURNEY_TYPES = [
  "indeciso",
  "dipendente",
  "autonomo",
  "azienda",
  "investitore",
] as const;

function buildJourneyDecisionUpdate(journeyType: string) {
  const decidedAt = journeyType === "indeciso" ? null : new Date();
  return {
    journeyType,
    journeyDecidedAt: decidedAt,
    journeyDecisionSource: decidedAt ? "percorso_page" : null,
    updatedAt: new Date(),
  };
}

/* ─── PATCH /api/journey-type/me/journey-type  —  aggiorna tipo percorso (utente corrente) ─── */
router.patch("/me/journey-type", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { journeyType } = req.body as { journeyType: string };

    if (!isOneOf(journeyType, VALID_JOURNEY_TYPES)) {
      res
        .status(400)
        .json({
          error: "Tipo percorso non valido",
          valid: VALID_JOURNEY_TYPES,
        });
      return;
    }

    const update = buildJourneyDecisionUpdate(journeyType);

    await db
      .update(usersTable)
      .set(update)
      .where(eq(usersTable.id, userId));
    invalidateUserFeedCache(userId);
    res.json({
      success: true,
      journeyType,
      journeyDecidedAt: update.journeyDecidedAt?.toISOString() ?? null,
      journeyDecisionSource: update.journeyDecisionSource,
    });
  } catch (err) {
    req.log?.error?.({ err }, "journey-type /me update error");
    res
      .status(500)
      .json({ error: "Errore nell'aggiornamento del tipo di percorso" });
  }
});

/* ─── PATCH /api/journey-type/:userId/journey-type  —  aggiorna tipo percorso ─── */
router.patch("/:userId/journey-type", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { journeyType } = req.body as { journeyType: string };

    if (!isOneOf(journeyType, VALID_JOURNEY_TYPES)) {
      res
        .status(400)
        .json({
          error: "Tipo percorso non valido",
          valid: VALID_JOURNEY_TYPES,
        });
      return;
    }

    const update = buildJourneyDecisionUpdate(journeyType);

    await db
      .update(usersTable)
      .set(update)
      .where(eq(usersTable.id, userId));

    // Invalida la cache del feed personalizzato dopo cambio di percorso
    invalidateUserFeedCache(userId);

    res.json({
      success: true,
      journeyType,
      journeyDecidedAt: update.journeyDecidedAt?.toISOString() ?? null,
      journeyDecisionSource: update.journeyDecisionSource,
    });
  } catch (err) {
    req.log?.error?.({ err }, "journey-type update error");
    res
      .status(500)
      .json({ error: "Errore nell'aggiornamento del tipo di percorso" });
  }
});

export default router;
