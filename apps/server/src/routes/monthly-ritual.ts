import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  createOrGetMonthlyRitualRun,
  getMonthlyRitualPhase,
  type MonthlyRitualRunRecord,
  type MonthlyRitualUserStore,
} from "../services/monthly-ritual/monthly-ritual.service";
import { dbMonthlyRitualStore } from "../services/monthly-ritual/monthly-ritual.repository";

interface MonthlyRitualRouterDeps {
  store?: MonthlyRitualUserStore;
  now?: () => Date;
}

const preferencesPatchSchema = z.object({
  ritualEnabled: z.boolean().optional(),
  emailReminderEnabled: z.boolean().optional(),
}).strict();

export function createMonthlyRitualRouter(deps: MonthlyRitualRouterDeps = RouterDefaults): Router {
  const router = Router();
  const store = deps.store ?? dbMonthlyRitualStore;
  const now = deps.now ?? (() => new Date());

  router.get("/current", requireAuth, async (req, res) => {
    const current = now();
    const phase = getMonthlyRitualPhase(current);
    const preferences = await store.getPreferences(req.user!.id);
    const active = phase.phase === "active" && preferences.ritualEnabled;
    const run = active
      ? await createOrGetMonthlyRitualRun({
        userId: req.user!.id,
        journeyType: req.user!.journeyType,
        now: current,
        store,
      })
      : null;

    res.json({
      active,
      phase: phase.phase,
      ritualMonth: phase.ritualMonth,
      ritualDate: `${phase.ritualMonth}-07`,
      nextRitualDate: phase.nextRitualLocalDate,
      preferences,
      run: run ? serializeRun(run) : null,
    });
  });

  router.post("/current/open", requireAuth, async (req, res) => {
    const current = now();
    const run = await getActiveRun(req.user!.id, req.user!.journeyType, current, store);
    if (!run) {
      res.status(409).json({ error: "La Notte della Fondazione non e' attiva oggi" });
      return;
    }
    const opened = await store.updateRun(run.id, {
      status: run.status === "challenge_completed" ? run.status : "opened",
      openedAt: run.openedAt ?? current,
      updatedAt: current,
    });
    res.json({ run: serializeRun(opened) });
  });

  router.post("/current/challenge/complete", requireAuth, async (req, res) => {
    const current = now();
    const run = await getActiveRun(req.user!.id, req.user!.journeyType, current, store);
    if (!run) {
      res.status(409).json({ error: "La Notte della Fondazione non e' attiva oggi" });
      return;
    }
    const completed = await store.updateRun(run.id, {
      status: "challenge_completed",
      openedAt: run.openedAt ?? current,
      completedAt: run.completedAt ?? current,
      updatedAt: current,
    });
    res.json({ run: serializeRun(completed) });
  });

  router.get("/archive", requireAuth, async (req, res) => {
    const runs = await store.getRecentRuns(req.user!.id, 12);
    res.json({ runs: runs.map(serializeRun) });
  });

  router.get("/preferences", requireAuth, async (req, res) => {
    const preferences = await store.getPreferences(req.user!.id);
    res.json({ preferences });
  });

  router.patch("/preferences", requireAuth, async (req, res) => {
    const parsed = preferencesPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Preferenze non valide" });
      return;
    }
    const patch: { ritualEnabled?: boolean; emailReminderEnabled?: boolean } = {};
    if (parsed.data.ritualEnabled !== undefined) patch.ritualEnabled = parsed.data.ritualEnabled;
    if (parsed.data.emailReminderEnabled !== undefined) {
      patch.emailReminderEnabled = parsed.data.emailReminderEnabled;
    }
    const preferences = await store.updatePreferences(req.user!.id, patch);
    res.json({ preferences });
  });

  return router;
}

const RouterDefaults: MonthlyRitualRouterDeps = {};

async function getActiveRun(
  userId: number,
  journeyType: string | null,
  now: Date,
  store: MonthlyRitualUserStore,
): Promise<MonthlyRitualRunRecord | null> {
  const phase = getMonthlyRitualPhase(now);
  const preferences = await store.getPreferences(userId);
  if (phase.phase !== "active" || !preferences.ritualEnabled) return null;
  return createOrGetMonthlyRitualRun({ userId, journeyType, now, store });
}

function serializeRun(run: MonthlyRitualRunRecord) {
  return {
    ...run,
    ritualDate: run.ritualDate.toISOString(),
    emailSentAt: run.emailSentAt?.toISOString() ?? null,
    pushSentAt: run.pushSentAt?.toISOString() ?? null,
    proactiveInsightCreatedAt: run.proactiveInsightCreatedAt?.toISOString() ?? null,
    openedAt: run.openedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export default createMonthlyRitualRouter();
