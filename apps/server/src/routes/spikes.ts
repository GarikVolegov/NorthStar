/**
 * /api/spikes — "Career Spike": il commit reversibile del percorso indeciso.
 *
 * Da un'ipotesi della Bussola si crea un micro-esperimento di ~2 settimane con
 * kill-criterion. Riusa user_objectives + calendar_events (soft-link). L'esito
 * fa avanzare lo stage: experimenting → committed (continue+energia) oppure
 * torna a hypotheses (kill = "no informato", non fallimento).
 *
 * SECURITY: ogni query è owner-scoped su req.user!.id. Mai userId dal body.
 */
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  careerSpikesTable,
  userObjectivesTable,
  calendarEventsTable,
  compassProfilesTable,
  compassSignalsTable,
  professionsTable,
  type CompassHypothesis,
} from "@workspace/db";
import {
  proposeSpike,
  resolveSpikeOutcome,
  spikeReviewDate,
  spikeOutcomeDims,
  type SpikeDecision,
} from "@workspace/ai-server";
import { requireAuth } from "../middleware/auth";
import { recomputeCompass } from "../services/compass/recompute";

const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** RIASEC dell'ipotesi (per i dims del segnale) se refId è "profession:N". */
async function riasecForRef(refId: string | null): Promise<string[]> {
  if (!refId) return [];
  const m = /^profession:(\d+)$/.exec(refId);
  if (!m) return [];
  const [p] = await db
    .select({ riasecFit: professionsTable.riasecFit })
    .from(professionsTable)
    .where(eq(professionsTable.id, Number(m[1])))
    .limit(1);
  return p?.riasecFit ?? [];
}

/* ─── GET /api/spikes — spike dell'utente (attivi + passati) ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const spikes = await db
      .select()
      .from(careerSpikesTable)
      .where(eq(careerSpikesTable.userId, req.user!.id))
      .orderBy(desc(careerSpikesTable.createdAt));
    res.json(spikes);
  } catch (err) {
    req.log?.error?.({ err }, "spikes list error");
    res.status(500).json({ error: "Errore nel caricamento degli spike" });
  }
});

/* ─── POST /api/spikes/propose — azioni + kill-criterion candidati ─── */
router.post("/propose", requireAuth, async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const hypothesisLabel = typeof body.hypothesisLabel === "string" ? body.hypothesisLabel : "";
    if (!hypothesisLabel.trim()) {
      res.status(400).json({ error: "hypothesisLabel richiesto" });
      return;
    }
    const firstSkill = typeof body.firstSkill === "string" ? body.firstSkill : undefined;
    res.json({ suggestions: proposeSpike(hypothesisLabel, { firstSkill }) });
  } catch (err) {
    req.log?.error?.({ err }, "spikes propose error");
    res.status(500).json({ error: "Errore nella proposta dello spike" });
  }
});

/* ─── POST /api/spikes — crea spike (+ objective + calendar event) ─── */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const hypothesisLabel = typeof body.hypothesisLabel === "string" ? body.hypothesisLabel.trim() : "";
    const action = typeof body.action === "string" ? body.action.trim() : "";
    const killCriterion = typeof body.killCriterion === "string" ? body.killCriterion.trim() : "";
    const refType = typeof body.refType === "string" ? body.refType : null;
    const refId = typeof body.refId === "string" ? body.refId : null;

    // senza kill-criterion non è uno spike, è un buon proposito → rifiuta
    if (!hypothesisLabel || !action || !killCriterion) {
      res.status(400).json({ error: "hypothesisLabel, action e killCriterion sono obbligatori" });
      return;
    }

    const now = new Date();
    const parsed = body.reviewDate ? new Date(String(body.reviewDate)) : spikeReviewDate(now);
    // la review deve essere futura (vincolo calendario)
    const reviewDate = Number.isFinite(parsed.getTime()) && parsed.getTime() > now.getTime() + DAY_MS
      ? parsed
      : spikeReviewDate(now);

    // Riuso: un obiettivo (l'azione) + un evento calendario alla review date
    const [objective] = await db
      .insert(userObjectivesTable)
      .values({ userId, text: action, category: "spike" })
      .returning({ id: userObjectivesTable.id });

    const [event] = await db
      .insert(calendarEventsTable)
      .values({
        userId,
        title: `Review spike: ${hypothesisLabel}`,
        description: `Criterio di stop: ${killCriterion}`,
        startAt: reviewDate,
        endAt: new Date(reviewDate.getTime() + 60 * 60 * 1000),
        category: "deadline",
        tags: ["spike"],
      })
      .returning({ id: calendarEventsTable.id });

    const [spike] = await db
      .insert(careerSpikesTable)
      .values({
        userId, hypothesisLabel, refType, refId, action, killCriterion,
        startDate: now, reviewDate, status: "active",
        objectiveId: objective?.id ?? null,
        calendarEventId: event?.id ?? null,
      })
      .returning();

    // Bussola → experimenting; marca l'ipotesi come "in prova"
    await recomputeCompass(userId);
    const [profile] = await db
      .select()
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);
    if (profile) {
      const hyps = (profile.hypotheses as CompassHypothesis[]).map((h) =>
        h.clusterId === refId ? { ...h, testedAt: now.toISOString() } : h,
      );
      await db
        .update(compassProfilesTable)
        .set({ hypotheses: hyps, stage: "experimenting", updatedAt: now })
        .where(eq(compassProfilesTable.userId, userId));
    }

    res.status(201).json(spike);
  } catch (err) {
    req.log?.error?.({ err }, "spikes create error");
    res.status(500).json({ error: "Errore nella creazione dello spike" });
  }
});

/* ─── POST /api/spikes/:id/resolve — esito alla review → Bussola ─── */
router.post("/:id/resolve", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const spikeId = Number(req.params.id);
    if (!Number.isInteger(spikeId)) {
      res.status(400).json({ error: "id non valido" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const decision = body.decision === "kill" ? "kill" : body.decision === "continue" ? "continue" : null;
    if (!decision) {
      res.status(400).json({ error: "decision deve essere 'continue' o 'kill'" });
      return;
    }
    const energy = clampNum(body.energy, -1, 1, 0);
    const learned = typeof body.learned === "string" ? body.learned.slice(0, 2000) : undefined;

    // owner-scoped: lo spike deve essere dell'utente
    const [spike] = await db
      .select()
      .from(careerSpikesTable)
      .where(and(eq(careerSpikesTable.id, spikeId), eq(careerSpikesTable.userId, userId)))
      .limit(1);
    if (!spike) {
      res.status(404).json({ error: "Spike non trovato" });
      return;
    }
    if (spike.status !== "active") {
      res.status(409).json({ error: "Spike già risolto" });
      return;
    }

    const resolution = resolveSpikeOutcome(decision as SpikeDecision, energy);
    const now = new Date();

    // Segnale esperienziale forte verso/via dalle dimensioni dell'ipotesi
    const riasec = await riasecForRef(spike.refId);
    const dims = spikeOutcomeDims(riasec, resolution.signalValence);
    await db.insert(compassSignalsTable).values({
      userId,
      signalType: "spike_outcome",
      refType: spike.refType,
      refId: spike.refId,
      payload: { dims, valence: resolution.signalValence, decision, ...(learned ? { learned } : {}) },
      weight: resolution.signalWeight,
    });

    // Ricomputa (folds il segnale), poi applica stage + verdetto espliciti sopra
    await recomputeCompass(userId);
    const [profile] = await db
      .select()
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);
    let updatedProfile = profile;
    if (profile) {
      const hyps = (profile.hypotheses as CompassHypothesis[]).map((h) =>
        h.clusterId === spike.refId || h.label === spike.hypothesisLabel
          ? { ...h, verdict: resolution.verdict, testedAt: now.toISOString() }
          : h,
      );
      [updatedProfile] = await db
        .update(compassProfilesTable)
        .set({ hypotheses: hyps, stage: resolution.stage, updatedAt: now })
        .where(eq(compassProfilesTable.userId, userId))
        .returning();
    }

    const [updatedSpike] = await db
      .update(careerSpikesTable)
      .set({
        status: resolution.status,
        outcome: { energy, ...(learned ? { learned } : {}), decision },
        updatedAt: now,
      })
      .where(eq(careerSpikesTable.id, spikeId))
      .returning();

    res.json({ spike: updatedSpike, profile: updatedProfile });
  } catch (err) {
    req.log?.error?.({ err }, "spikes resolve error");
    res.status(500).json({ error: "Errore nella risoluzione dello spike" });
  }
});

export default router;
