/**
 * routines.ts — gestione routine autonome per utente (AaaS Layer 2).
 *
 * GET    /api/routines          — lista routine dell'utente
 * POST   /api/routines          — crea nuova routine (con feature gate per piano)
 * PATCH  /api/routines/:id      — aggiorna routine (active, name, parameters, schedule)
 * DELETE /api/routines/:id      — elimina routine
 * GET    /api/routines/feed     — ultimi risultati esecuzioni (feed in-app)
 * PATCH  /api/routines/feed/:id/read — segna esecuzione come letta
 *
 * LIMITI PER PIANO:
 *   free → 1 routine attiva
 *   pro  → 5 routine attive
 *   team → illimitate
 *
 * SECURITY: userId sempre da JWT (req.user.id), mai dal body/params.
 */
import { Router } from "express";
import { eq, and, count, desc, isNull } from "drizzle-orm";
import {
  db,
  userRoutinesTable,
  routineExecutionsTable,
  ROUTINE_TYPES,
  ROUTINE_OUTPUT_CHANNELS,
  type NewUserRoutine,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getEffectivePlan } from "../middleware/check-feature";
import { rootLogger } from "../middleware/logger";
import { computeNextRun, scheduleToDisplay } from "../lib/routine-schedule";

const router = Router();
const log    = rootLogger.child({ module: "routines" });

// ── Limiti routine per piano ───────────────────────────────────────────────────

const ROUTINE_LIMITS: Record<string, number> = {
  free: 1,
  pro:  5,
  team: Infinity,
};

function getRoutineLimit(plan: string): number {
  return ROUTINE_LIMITS[plan] ?? 1;
}

// ── Validazione body ──────────────────────────────────────────────────────────

const VALID_TYPES   = new Set<string>(ROUTINE_TYPES);
const VALID_CHANNELS = new Set<string>(ROUTINE_OUTPUT_CHANNELS);

interface CreateRoutineBody {
  type:           string;
  name?:          string;
  schedule:       string;
  parameters?:    Record<string, unknown>;
  outputChannel?: string;
}

interface UpdateRoutineBody {
  active?:        boolean;
  name?:          string;
  schedule?:      string;
  parameters?:    Record<string, unknown>;
  outputChannel?: string;
}

function validateCreateBody(body: unknown): CreateRoutineBody | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body non valido" };
  const b = body as Record<string, unknown>;

  if (!b.type || !VALID_TYPES.has(String(b.type)))
    return { error: `type non valido. Valori ammessi: ${ROUTINE_TYPES.join(", ")}` };
  if (!b.schedule || typeof b.schedule !== "string" || b.schedule.trim().length === 0)
    return { error: "schedule obbligatorio" };
  if (b.outputChannel && !VALID_CHANNELS.has(String(b.outputChannel)))
    return { error: `outputChannel non valido. Valori ammessi: ${ROUTINE_OUTPUT_CHANNELS.join(", ")}` };
  if (b.parameters && typeof b.parameters !== "object")
    return { error: "parameters deve essere un oggetto" };

  // name è opzionale: non includere la chiave se assente (exactOptionalPropertyTypes)
  const result: CreateRoutineBody = {
    type:          String(b.type),
    schedule:      b.schedule.trim(),
    parameters:    (b.parameters as Record<string, unknown>) ?? {},
    outputChannel: b.outputChannel ? String(b.outputChannel) : "all",
  };
  if (b.name) result.name = String(b.name).slice(0, 100);
  return result;
}

// ── GET /api/routines ─────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const rows = await db
      .select({
        id:            userRoutinesTable.id,
        type:          userRoutinesTable.type,
        name:          userRoutinesTable.name,
        schedule:      userRoutinesTable.schedule,
        parameters:    userRoutinesTable.parameters,
        outputChannel: userRoutinesTable.outputChannel,
        active:        userRoutinesTable.active,
        lastRunAt:     userRoutinesTable.lastRunAt,
        nextRunAt:     userRoutinesTable.nextRunAt,
        createdAt:     userRoutinesTable.createdAt,
      })
      .from(userRoutinesTable)
      .where(eq(userRoutinesTable.userId, userId))
      .orderBy(desc(userRoutinesTable.createdAt));

    const plan  = await getEffectivePlan(userId);
    const limit = getRoutineLimit(plan);
    const activeCount = rows.filter((r) => r.active).length;

    res.json({
      routines: rows.map((r) => ({
        ...r,
        scheduleDisplay: scheduleToDisplay(r.schedule),
      })),
      meta: {
        total:       rows.length,
        activeCount,
        plan,
        limit,
        canCreate:   activeCount < limit,
      },
    });
  } catch (e) {
    log.error({ e, userId }, "[routines] list error");
    res.status(500).json({ error: "Errore nel recupero delle routine" });
  }
});

// ── POST /api/routines ────────────────────────────────────────────────────────

router.post("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const validated = validateCreateBody(req.body);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  try {
    // Feature gate: controlla limite routine attive per piano
    const plan  = await getEffectivePlan(userId);
    const limit = getRoutineLimit(plan);

    const countResult = await db
      .select({ activeCount: count() })
      .from(userRoutinesTable)
      .where(and(
        eq(userRoutinesTable.userId, userId),
        eq(userRoutinesTable.active, true),
      ));

    if (Number(countResult[0]?.activeCount ?? 0) >= limit) {
      res.status(403).json({
        code:    "ROUTINE_LIMIT_REACHED",
        error:   `Piano ${plan}: limite di ${limit} routine attiva${limit === 1 ? "" : "e"} raggiunto.`,
        plan,
        limit,
        upgrade: plan === "free" ? "pro" : plan === "pro" ? "team" : null,
      });
      return;
    }

    // Genera nome default se non fornito
    const nameDefaults: Record<string, string> = {
      job_monitor:      "Monitoraggio Offerte Lavoro",
      market_report:    "Report di Mercato",
      mindset_exercise: "Esercizio Mindset",
      growth_briefing:  "Briefing Crescita",
      interview_prep:   "Preparazione Colloquio",
    };

    const nextRunAt = computeNextRun(validated.schedule);

    const newRoutine: NewUserRoutine = {
      userId,
      type:          validated.type as NewUserRoutine["type"],
      name:          validated.name ?? nameDefaults[validated.type] ?? validated.type,
      schedule:      validated.schedule,
      parameters:    validated.parameters ?? {},
      outputChannel: (validated.outputChannel ?? "all") as NewUserRoutine["outputChannel"],
      active:        true,
      nextRunAt,
    };

    const [created] = await db
      .insert(userRoutinesTable)
      .values(newRoutine)
      .returning();

    if (!created) throw new Error("Inserimento fallito");

    log.info({ userId, routineId: created.id, type: created.type }, "[routines] created");

    res.status(201).json({
      routine: {
        ...created,
        scheduleDisplay: scheduleToDisplay(created.schedule),
      },
    });
  } catch (e) {
    log.error({ e, userId }, "[routines] create error");
    res.status(500).json({ error: "Errore nella creazione della routine" });
  }
});

// ── PATCH /api/routines/:id ───────────────────────────────────────────────────

router.patch("/:id", requireAuth, async (req, res) => {
  const userId    = req.user!.id;
  const routineId = parseInt(req.params.id ?? "", 10);
  if (isNaN(routineId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const body = req.body as UpdateRoutineBody;

  try {
    // Verifica ownership
    const [existing] = await db
      .select({ id: userRoutinesTable.id, active: userRoutinesTable.active })
      .from(userRoutinesTable)
      .where(and(
        eq(userRoutinesTable.id, routineId),
        eq(userRoutinesTable.userId, userId),
      ))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "Routine non trovata" }); return; }

    // Se si sta riattivando una routine, controlla il limite
    if (body.active === true && !existing.active) {
      const plan  = await getEffectivePlan(userId);
      const limit = getRoutineLimit(plan);

      const countResult2 = await db
        .select({ activeCount: count() })
        .from(userRoutinesTable)
        .where(and(
          eq(userRoutinesTable.userId, userId),
          eq(userRoutinesTable.active, true),
        ));

      if (Number(countResult2[0]?.activeCount ?? 0) >= limit) {
        res.status(403).json({
          code:    "ROUTINE_LIMIT_REACHED",
          error:   `Piano ${plan}: limite di ${limit} routine attiva${limit === 1 ? "" : "e"} raggiunto.`,
          plan,
          limit,
        });
        return;
      }
    }

    const updates: Partial<typeof userRoutinesTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof body.active === "boolean") updates.active = body.active;
    if (body.name)         updates.name = String(body.name).slice(0, 100);
    if (body.outputChannel && VALID_CHANNELS.has(body.outputChannel))
      updates.outputChannel = body.outputChannel as NewUserRoutine["outputChannel"];
    if (body.parameters && typeof body.parameters === "object")
      updates.parameters = body.parameters;
    if (body.schedule) {
      updates.schedule  = body.schedule;
      updates.nextRunAt = computeNextRun(body.schedule);
    }

    const [updated] = await db
      .update(userRoutinesTable)
      .set(updates)
      .where(and(
        eq(userRoutinesTable.id, routineId),
        eq(userRoutinesTable.userId, userId),
      ))
      .returning();

    log.info({ userId, routineId, changes: Object.keys(updates) }, "[routines] updated");
    res.json({
      routine: {
        ...updated,
        scheduleDisplay: scheduleToDisplay(updated!.schedule),
      },
    });
  } catch (e) {
    log.error({ e, userId, routineId }, "[routines] update error");
    res.status(500).json({ error: "Errore nell'aggiornamento della routine" });
  }
});

// ── DELETE /api/routines/:id ──────────────────────────────────────────────────

router.delete("/:id", requireAuth, async (req, res) => {
  const userId    = req.user!.id;
  const routineId = parseInt(req.params.id ?? "", 10);
  if (isNaN(routineId)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    const result = await db
      .delete(userRoutinesTable)
      .where(and(
        eq(userRoutinesTable.id, routineId),
        eq(userRoutinesTable.userId, userId),
      ))
      .returning({ id: userRoutinesTable.id });

    if (!result.length) { res.status(404).json({ error: "Routine non trovata" }); return; }

    log.info({ userId, routineId }, "[routines] deleted");
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, userId, routineId }, "[routines] delete error");
    res.status(500).json({ error: "Errore nell'eliminazione della routine" });
  }
});

// ── GET /api/routines/feed ────────────────────────────────────────────────────
// Ultime esecuzioni (risultati) delle routine — alimenta il widget dashboard.

router.get("/feed", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit  = Math.min(parseInt(req.query.limit as string || "20"), 50);

  try {
    const rows = await db
      .select({
        id:        routineExecutionsTable.id,
        routineId: routineExecutionsTable.routineId,
        title:     routineExecutionsTable.title,
        body:      routineExecutionsTable.body,
        ctaLabel:  routineExecutionsTable.ctaLabel,
        ctaTarget: routineExecutionsTable.ctaTarget,
        metadata:  routineExecutionsTable.metadata,
        readAt:    routineExecutionsTable.readAt,
        createdAt: routineExecutionsTable.createdAt,
      })
      .from(routineExecutionsTable)
      .where(eq(routineExecutionsTable.userId, userId))
      .orderBy(desc(routineExecutionsTable.createdAt))
      .limit(limit);

    const unreadCount = rows.filter((r) => r.readAt === null).length;

    res.json({ executions: rows, unreadCount, total: rows.length });
  } catch (e) {
    log.error({ e, userId }, "[routines] feed error");
    res.status(500).json({ error: "Errore nel recupero del feed" });
  }
});

// ── PATCH /api/routines/feed/:id/read ────────────────────────────────────────

router.patch("/feed/:id/read", requireAuth, async (req, res) => {
  const userId      = req.user!.id;
  const executionId = parseInt(req.params.id ?? "", 10);
  if (isNaN(executionId)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    await db
      .update(routineExecutionsTable)
      .set({ readAt: new Date() })
      .where(and(
        eq(routineExecutionsTable.id, executionId),
        eq(routineExecutionsTable.userId, userId),
        isNull(routineExecutionsTable.readAt),
      ));
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, userId, executionId }, "[routines] mark read error");
    res.status(500).json({ error: "Errore" });
  }
});

export default router;
