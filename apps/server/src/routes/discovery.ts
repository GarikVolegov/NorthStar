/**
 * /api/discovery — endpoints per il Discovery Engine (percorso "indeciso").
 *
 *   GET  /readiness      → score corrente + nudge prossima azione
 *   POST /signals        → registra un segnale (sector reaction, generic events)
 *   GET  /signals        → ultimi N segnali dell'utente (debug + Costellazione future)
 *   POST /readiness/recompute → forza ricalcolo (admin/test)
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  getReadinessForDashboard,
  recordSignal,
  listSignals,
  recomputeReadiness,
} from "../services/discovery-engine/index.js";

const router = Router();

const signalSchema = z.object({
  signalType: z.enum([
    "test_complete",
    "sector_reaction",
    "diary_entry_indizi",
    "mood_checkin",
    "coach_socratic_step",
    "vita_parallela_reaction",
    "shadow_day_complete",
    "anti_test_complete",
    "test_drive_complete",
  ]),
  valence: z.number().min(-1).max(1).optional(),
  intensity: z.number().min(0).max(1).optional(),
  target: z.string().max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

router.get("/readiness", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = await getReadinessForDashboard(userId);
  res.json(data);
});

router.post("/readiness/recompute", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const r = await recomputeReadiness(userId);
  res.json(r);
});

router.post("/signals", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const parsed = signalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Segnale non valido", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const r = await recordSignal({
    userId,
    signalType: d.signalType,
    ...(d.valence !== undefined ? { valence: d.valence } : {}),
    ...(d.intensity !== undefined ? { intensity: d.intensity } : {}),
    ...(d.target !== undefined ? { target: d.target } : {}),
    ...(d.payload !== undefined ? { payload: d.payload } : {}),
  });
  res.status(201).json({ readiness: r });
});

router.get("/signals", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const signals = await listSignals(userId, limit);
  res.json({ signals });
});

export default router;
