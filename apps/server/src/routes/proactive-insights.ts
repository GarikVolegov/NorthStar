/**
 * proactive-insights.ts — endpoint per insight proattivi dell'utente.
 *
 * GET  /api/users/me/proactive-insights   — lista insight non letti
 * POST /api/users/me/proactive-insights/:id/read    — segna come letto
 * POST /api/users/me/proactive-insights/:id/dismiss — segna come dimesso
 *
 * PRIVACY:
 *   - userId sempre da JWT, mai dal body
 *   - body degli insight: testo Wendy, nessun PII
 */
import { Router } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, proactiveInsightsTable } from "@workspace/db";
import { rootLogger } from "../middleware/logger";

const router = Router();
const log = rootLogger.child({ module: "proactive-insights" });

// ── GET /api/users/me/proactive-insights ────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const onlyUnread = req.query.unread !== "false"; // default: solo non letti

  try {
    const rows = await db
      .select({
        id:                  proactiveInsightsTable.id,
        insightType:         proactiveInsightsTable.insightType,
        title:               proactiveInsightsTable.title,
        body:                proactiveInsightsTable.body,
        ctaLabel:            proactiveInsightsTable.ctaLabel,
        ctaTarget:           proactiveInsightsTable.ctaTarget,
        linkedWeakSignalId:  proactiveInsightsTable.linkedWeakSignalId,
        readAt:              proactiveInsightsTable.readAt,
        dismissedAt:         proactiveInsightsTable.dismissedAt,
        createdAt:           proactiveInsightsTable.createdAt,
      })
      .from(proactiveInsightsTable)
      .where(
        and(
          eq(proactiveInsightsTable.userId, userId),
          isNull(proactiveInsightsTable.dismissedAt),
          onlyUnread ? isNull(proactiveInsightsTable.readAt) : undefined,
        ),
      )
      .orderBy(desc(proactiveInsightsTable.createdAt))
      .limit(10);

    res.json({
      insights: rows,
      unreadCount: rows.filter((r) => !r.readAt).length,
    });
  } catch (e) {
    log.warn({ e, userId }, "[proactive-insights] list error — tabella non migrata?");
    res.json({ insights: [], unreadCount: 0 });
  }
});

// ── POST /api/users/me/proactive-insights/:id/read ─────────────────────────

router.post("/:id/read", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id     = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    const [row] = await db
      .update(proactiveInsightsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(proactiveInsightsTable.id, id),
          eq(proactiveInsightsTable.userId, userId),
          isNull(proactiveInsightsTable.readAt),
        ),
      )
      .returning({ id: proactiveInsightsTable.id });

    if (!row) { res.status(404).json({ error: "Insight non trovato" }); return; }
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, userId, id }, "[proactive-insights] mark read error");
    res.status(500).json({ error: "Errore nell'aggiornamento" });
  }
});

// ── POST /api/users/me/proactive-insights/:id/dismiss ──────────────────────

router.post("/:id/dismiss", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id     = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    const [row] = await db
      .update(proactiveInsightsTable)
      .set({ dismissedAt: new Date() })
      .where(
        and(
          eq(proactiveInsightsTable.id, id),
          eq(proactiveInsightsTable.userId, userId),
        ),
      )
      .returning({ id: proactiveInsightsTable.id });

    if (!row) { res.status(404).json({ error: "Insight non trovato" }); return; }
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, userId, id }, "[proactive-insights] dismiss error");
    res.status(500).json({ error: "Errore nella dismissione" });
  }
});

export default router;
