/**
 * /api/compass — "La Bussola" del percorso indeciso.
 *
 * Layer direzionale unificante: legge il profilo, registra segnali dai
 * capture-tool nuovi (Specchio/Torneo/Diagnostico) e ricomputa fondendo le
 * fonti esistenti (test_sessions, simulated_days, diary indizi).
 *
 * SECURITY: ogni query è owner-scoped su req.user!.id. Mai userId dal body.
 */
import { Router } from "express";
import { and, eq, notInArray, sql } from "drizzle-orm";
import {
  db,
  compassProfilesTable,
  compassSignalsTable,
  sceneCardsTable,
  COMPASS_SIGNAL_TYPES,
  COMPASS_BLOCK_TYPES,
  type CompassSignalType,
  type CompassBlockType,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { recomputeCompass } from "../services/compass/recompute";

const router = Router();

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/* ─── GET /api/compass — profilo Bussola (lazy-init dai segnali esistenti) ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [existing] = await db
      .select()
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);

    // Prima visita: inizializza fondendo ciò che l'utente ha già fatto altrove
    const profile = existing ?? (await recomputeCompass(userId));
    res.json(profile);
  } catch (err) {
    req.log?.error?.({ err }, "compass get error");
    res.status(500).json({ error: "Errore nel caricamento della Bussola" });
  }
});

/* ─── POST /api/compass/signal — registra segnale + ricomputa ─── */
router.post("/signal", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const signalType = body.signalType as CompassSignalType;
    if (!COMPASS_SIGNAL_TYPES.includes(signalType)) {
      res.status(400).json({ error: "signalType non valido" });
      return;
    }

    const valence = body.valence != null ? clampNum(body.valence, -1, 1, 0) : undefined;
    const dims = (body.dims && typeof body.dims === "object") ? (body.dims as Record<string, number>) : undefined;
    const payload: Record<string, unknown> = {
      ...(valence != null ? { valence } : {}),
      ...(body.reactionMs != null ? { reactionMs: clampNum(body.reactionMs, 0, 600000, 0) } : {}),
      ...(dims ? { dims } : {}),
    };

    await db.insert(compassSignalsTable).values({
      userId,
      signalType,
      refType: typeof body.refType === "string" ? body.refType : null,
      refId: body.refId != null ? String(body.refId) : null,
      payload,
      weight: clampNum(body.weight, 0, 5, 1),
    });

    const profile = await recomputeCompass(userId);
    res.status(201).json(profile);
  } catch (err) {
    req.log?.error?.({ err }, "compass signal error");
    res.status(500).json({ error: "Errore nella registrazione del segnale" });
  }
});

/* ─── POST /api/compass/diagnose — imposta il tipo di blocco ─── */
router.post("/diagnose", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const blockType = (req.body as { blockType?: unknown })?.blockType as CompassBlockType;
    if (!COMPASS_BLOCK_TYPES.includes(blockType)) {
      res.status(400).json({ error: "blockType non valido" });
      return;
    }

    // assicura l'esistenza del profilo, poi aggiorna il blocco
    await recomputeCompass(userId);
    const [profile] = await db
      .update(compassProfilesTable)
      .set({ blockType, updatedAt: new Date() })
      .where(eq(compassProfilesTable.userId, userId))
      .returning();

    res.json(profile);
  } catch (err) {
    req.log?.error?.({ err }, "compass diagnose error");
    res.status(500).json({ error: "Errore nel diagnostico del blocco" });
  }
});

/* ─── GET /api/compass/scenes — prossime scene non ancora viste ─── */
router.get("/scenes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = clampNum(req.query.limit, 1, 30, 12);

    // id già swipati dall'utente (ref_id testuale → int)
    const seen = await db
      .select({ refId: compassSignalsTable.refId })
      .from(compassSignalsTable)
      .where(and(
        eq(compassSignalsTable.userId, userId),
        eq(compassSignalsTable.signalType, "scene_swipe"),
        eq(compassSignalsTable.refType, "scene"),
      ));
    const seenIds = seen
      .map((r) => Number(r.refId))
      .filter((n) => Number.isInteger(n));

    const where = seenIds.length
      ? and(eq(sceneCardsTable.active, true), notInArray(sceneCardsTable.id, seenIds))
      : eq(sceneCardsTable.active, true);

    const scenes = await db
      .select({
        id: sceneCardsTable.id,
        prompt: sceneCardsTable.prompt,
        imageUrl: sceneCardsTable.imageUrl,
        tags: sceneCardsTable.tags,
      })
      .from(sceneCardsTable)
      .where(where)
      .orderBy(sql`random()`)
      .limit(limit);

    res.json(scenes);
  } catch (err) {
    req.log?.error?.({ err }, "compass scenes error");
    res.status(500).json({ error: "Errore nel caricamento delle scene" });
  }
});

export default router;
