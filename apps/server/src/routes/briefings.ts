/**
 * briefings.ts — endpoint per i briefing di Wendy.
 *
 * GET  /api/briefings           — lista briefing dell'utente
 * POST /api/briefings/generate  — genera briefing on-demand
 * PATCH /api/briefings/:id/read — segna come letto
 */
import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import { db, wendyBriefingsTable } from "@workspace/db";
import { generateBriefingForUser } from "../jobs/briefing-generator";

const router = Router();
const log    = rootLogger.child({ module: "briefings" });

// ── GET /api/briefings ────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit  = Math.min(parseInt(req.query.limit as string || "10"), 20);

  try {
    const rows = await db
      .select({
        id:        wendyBriefingsTable.id,
        type:      wendyBriefingsTable.type,
        period:    wendyBriefingsTable.period,
        content:   wendyBriefingsTable.content,
        readAt:    wendyBriefingsTable.readAt,
        createdAt: wendyBriefingsTable.createdAt,
      })
      .from(wendyBriefingsTable)
      .where(eq(wendyBriefingsTable.userId, userId))
      .orderBy(desc(wendyBriefingsTable.createdAt))
      .limit(limit);

    res.json({ briefings: rows, total: rows.length });
  } catch (e) {
    log.error({ e, userId }, "[briefings] list error");
    res.status(500).json({ error: "Errore nel recupero dei briefing" });
  }
});

// ── POST /api/briefings/generate ─────────────────────────────────────────────
// On-demand — disponibile 1/settimana per Free, illimitato per Pro+

router.post("/generate", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  // Controllo rate: 1 briefing manuale per utente ogni 6 ore
  const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recent = await db
    .select({ id: wendyBriefingsTable.id })
    .from(wendyBriefingsTable)
    .where(and(
      eq(wendyBriefingsTable.userId, userId),
      eq(wendyBriefingsTable.type, "manual"),
    ))
    .orderBy(desc(wendyBriefingsTable.createdAt))
    .limit(1);

  if (recent[0]) {
    const lastBriefing = await db
      .select({ createdAt: wendyBriefingsTable.createdAt })
      .from(wendyBriefingsTable)
      .where(eq(wendyBriefingsTable.id, recent[0].id))
      .limit(1);

    if (lastBriefing[0] && lastBriefing[0].createdAt > recentCutoff) {
      res.status(429).json({
        error: "Briefing generato di recente. Attendi almeno 6 ore prima di generarne un altro.",
        nextAvailableAt: new Date(lastBriefing[0].createdAt.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      });
      return;
    }
  }

  try {
    const { usersTable } = await import("@workspace/db");

    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
    const content = await generateBriefingForUser(userId, user.name, "weekly");

    if (!content) {
      res.status(500).json({ error: "Generazione briefing fallita — riprova tra poco" });
      return;
    }

    const period = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .insert(wendyBriefingsTable)
      .values({ userId, type: "manual", period, content })
      .returning({ id: wendyBriefingsTable.id });

    if (!row) {
      throw new Error("Briefing non salvato");
    }

    log.info({ userId, briefingId: row.id }, "[briefings] manual generated");
    res.status(201).json({ ok: true, briefingId: row.id, content });
  } catch (e) {
    log.error({ e, userId }, "[briefings] generate error");
    res.status(500).json({ error: "Errore nella generazione del briefing" });
  }
});

// ── PATCH /api/briefings/:id/read ────────────────────────────────────────────

router.patch("/:id/read", requireAuth, async (req, res) => {
  const userId     = req.user!.id;
  const briefingId = parseInt(req.params.id ?? "", 10);
  if (isNaN(briefingId)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    await db
      .update(wendyBriefingsTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(wendyBriefingsTable.id, briefingId),
        eq(wendyBriefingsTable.userId, userId),
      ));
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, briefingId }, "[briefings] mark read error");
    res.status(500).json({ error: "Errore" });
  }
});

export default router;
