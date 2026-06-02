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
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import {
  db,
  compassProfilesTable,
  compassSignalsTable,
  sceneCardsTable,
  professionsTable,
  jobPostingSnapshotsTable,
  COMPASS_SIGNAL_TYPES,
  COMPASS_BLOCK_TYPES,
  type CompassSignalType,
  type CompassBlockType,
  type CompassHypothesis,
} from "@workspace/db";
import {
  selectTournamentPool,
  nextTournamentPair,
  tournamentChoiceDims,
  tournamentTarget,
  type TournamentChoice,
} from "@workspace/ai-server";
import { requireAuth } from "../middleware/auth";
import { recomputeCompass } from "../services/compass/recompute";
import { candidatesFromProfessions } from "../services/compass/adapters";

const TOURNAMENT_POOL_SIZE = 8;

/** Carica il pool del Torneo (deterministico) e lo stream di scelte già fatte. */
async function loadTournament(userId: number) {
  const professions = await db
    .select({ id: professionsTable.id, title: professionsTable.title, riasecFit: professionsTable.riasecFit })
    .from(professionsTable)
    .where(eq(professionsTable.isActive, true));
  const candidates = candidatesFromProfessions(professions);

  const [profile] = await db
    .select({ hypotheses: compassProfilesTable.hypotheses })
    .from(compassProfilesTable)
    .where(eq(compassProfilesTable.userId, userId))
    .limit(1);
  const hypothesisIds = ((profile?.hypotheses as CompassHypothesis[] | undefined) ?? [])
    .filter((h) => h.verdict !== "discarded")
    .map((h) => h.clusterId);

  const pool = selectTournamentPool(candidates, hypothesisIds, TOURNAMENT_POOL_SIZE);

  const rows = await db
    .select({ payload: compassSignalsTable.payload })
    .from(compassSignalsTable)
    .where(and(
      eq(compassSignalsTable.userId, userId),
      eq(compassSignalsTable.signalType, "tournament_choice"),
    ));
  const choices: TournamentChoice[] = rows
    .map((r) => r.payload as { winnerId?: unknown; loserId?: unknown })
    .filter((p): p is { winnerId: string; loserId: string } =>
      typeof p?.winnerId === "string" && typeof p?.loserId === "string")
    .map((p) => ({ winnerId: p.winnerId, loserId: p.loserId }));

  const riasecByCluster = new Map(candidates.map((c) => [c.clusterId, c.riasec]));
  return { pool, choices, riasecByCluster };
}

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
    const refId = body.refId != null ? String(body.refId) : null;

    // dims: per scene_swipe li deriva il SERVER dai pesi della scena (anti-gaming);
    // per gli altri tool, accetta dims dal client.
    let dims: Record<string, number> | undefined;
    if (signalType === "scene_swipe" && refId && valence != null && valence > 0) {
      const sceneIdNum = Number(refId);
      if (Number.isInteger(sceneIdNum)) {
        const [scene] = await db
          .select({ riasecWeights: sceneCardsTable.riasecWeights })
          .from(sceneCardsTable)
          .where(eq(sceneCardsTable.id, sceneIdNum))
          .limit(1);
        const weights = (scene?.riasecWeights as Record<string, number>) ?? {};
        dims = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v * valence]));
      }
    } else if (body.dims && typeof body.dims === "object") {
      dims = body.dims as Record<string, number>;
    }

    const payload: Record<string, unknown> = {
      ...(valence != null ? { valence } : {}),
      ...(body.reactionMs != null ? { reactionMs: clampNum(body.reactionMs, 0, 600000, 0) } : {}),
      ...(dims ? { dims } : {}),
    };

    await db.insert(compassSignalsTable).values({
      userId,
      signalType,
      refType: typeof body.refType === "string" ? body.refType : null,
      refId,
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

/* ─── POST /api/compass/signal/undo — annulla l'ultimo segnale di un tipo ─── */
router.post("/signal/undo", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const signalType = (req.body as { signalType?: unknown })?.signalType as CompassSignalType;
    if (!COMPASS_SIGNAL_TYPES.includes(signalType)) {
      res.status(400).json({ error: "signalType non valido" });
      return;
    }

    // Trova l'ultimo segnale di quel tipo per QUESTO utente e lo rimuove.
    const [last] = await db
      .select({ id: compassSignalsTable.id })
      .from(compassSignalsTable)
      .where(and(
        eq(compassSignalsTable.userId, userId),
        eq(compassSignalsTable.signalType, signalType),
      ))
      .orderBy(desc(compassSignalsTable.createdAt), desc(compassSignalsTable.id))
      .limit(1);

    if (last) {
      await db
        .delete(compassSignalsTable)
        .where(and(
          eq(compassSignalsTable.id, last.id),
          eq(compassSignalsTable.userId, userId), // doppia garanzia di ownership
        ));
    }

    const profile = await recomputeCompass(userId);
    res.json(profile);
  } catch (err) {
    req.log?.error?.({ err }, "compass signal undo error");
    res.status(500).json({ error: "Errore nell'annullamento del segnale" });
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

/* ─── GET /api/compass/tournament — pool + prossima coppia da confrontare ─── */
router.get("/tournament", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { pool, choices } = await loadTournament(userId);
    const pair = nextTournamentPair(pool, choices);
    res.json({
      pool: pool.map((c) => ({ clusterId: c.clusterId, label: c.label, riasec: c.riasec })),
      pair: pair ? pair.map((c) => ({ clusterId: c.clusterId, label: c.label, riasec: c.riasec })) : null,
      comparisons: choices.length,
      target: tournamentTarget(pool.length),
      done: pair === null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "compass tournament get error");
    res.status(500).json({ error: "Errore nel caricamento del Torneo" });
  }
});

/* ─── POST /api/compass/tournament/choice — registra una scelta a coppie ─── */
router.post("/tournament/choice", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const winnerId = typeof body.winnerId === "string" ? body.winnerId : "";
    const loserId = typeof body.loserId === "string" ? body.loserId : "";

    if (!winnerId || !loserId || winnerId === loserId) {
      res.status(400).json({ error: "winnerId e loserId devono essere cluster distinti" });
      return;
    }

    // I dims si derivano SERVER-side dal RIASEC dei cluster (anti-gaming):
    // non ci fidiamo mai dei dims dal client.
    const { pool, choices, riasecByCluster } = await loadTournament(userId);
    const inPool = new Set(pool.map((c) => c.clusterId));
    if (!inPool.has(winnerId) || !inPool.has(loserId)) {
      res.status(400).json({ error: "I cluster non fanno parte del Torneo corrente" });
      return;
    }

    const dims = tournamentChoiceDims(
      riasecByCluster.get(winnerId) ?? [],
      riasecByCluster.get(loserId) ?? [],
    );

    await db.insert(compassSignalsTable).values({
      userId,
      signalType: "tournament_choice",
      refType: "profession",
      refId: winnerId,
      payload: {
        winnerId,
        loserId,
        dims,
        valence: 1,
        ...(body.reactionMs != null ? { reactionMs: clampNum(body.reactionMs, 0, 600000, 0) } : {}),
      },
      weight: 1.2, // una scelta deliberata pesa un po' più di uno swipe
    });

    const profile = await recomputeCompass(userId);
    const nextChoices = [...choices, { winnerId, loserId }];
    const pair = nextTournamentPair(pool, nextChoices);
    res.status(201).json({
      profile,
      pair: pair ? pair.map((c) => ({ clusterId: c.clusterId, label: c.label, riasec: c.riasec })) : null,
      comparisons: nextChoices.length,
      target: tournamentTarget(pool.length),
      done: pair === null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "compass tournament choice error");
    res.status(500).json({ error: "Errore nella registrazione della scelta" });
  }
});

/* ─── GET /api/compass/action-plan — il ponte verso il lavoro vero ─── */
/* Quando una direzione ha retto alla prova (confirmed) o è la più forte, la
 * connette al mercato REALE: domanda (job_posting_snapshots) + prossimi passi
 * concreti. È la chiusura "ora l'app ti aiuta a trovare lavoro davvero". */
router.get("/action-plan", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [profile] = await db
      .select()
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);

    if (!profile) {
      res.json({ ready: false, stage: "zero_ideas" as const });
      return;
    }

    const hyps = (profile.hypotheses as CompassHypothesis[]).filter((h) => h.verdict !== "discarded");
    // priorità: un'ipotesi confermata da uno spike, altrimenti la più forte
    const direction = hyps.find((h) => h.verdict === "confirmed") ?? hyps[0];
    if (!direction) {
      res.json({ ready: false, stage: profile.stage });
      return;
    }

    const professionId = Number(/^profession:(\d+)$/.exec(direction.clusterId)?.[1]);

    let demand: {
      count: number; period: string; growthRate: number | null;
      avgSalaryMin: number | null; avgSalaryMax: number | null; topSkills: string[];
    } | null = null;
    if (Number.isInteger(professionId)) {
      const [snap] = await db
        .select({
          count: jobPostingSnapshotsTable.count,
          period: jobPostingSnapshotsTable.period,
          growthRate: jobPostingSnapshotsTable.growthRate,
          avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
          avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
          topSkills: jobPostingSnapshotsTable.topSkills,
        })
        .from(jobPostingSnapshotsTable)
        .where(eq(jobPostingSnapshotsTable.professionId, professionId))
        .orderBy(desc(jobPostingSnapshotsTable.period), desc(jobPostingSnapshotsTable.createdAt))
        .limit(1);
      demand = snap ?? null;
    }

    res.json({
      ready: true,
      stage: profile.stage,
      direction: {
        label: direction.label,
        clusterId: direction.clusterId,
        professionId: Number.isInteger(professionId) ? professionId : null,
        confidence: direction.confidence,
        confirmed: direction.verdict === "confirmed",
      },
      demand, // dati reali di mercato (può essere null se non abbiamo snapshot)
    });
  } catch (err) {
    req.log?.error?.({ err }, "compass action-plan error");
    res.status(500).json({ error: "Errore nel piano d'azione" });
  }
});

export default router;
