/**
 * /api/mood — endpoints del tool B10 "Mood-to-Action" (percorso indeciso).
 *
 *   POST /checkins        → salva un mood checkin, emette signal, ritorna suggerimento
 *   GET  /checkins        → ultimi N checkin dell'utente (per trend nel widget)
 *   POST /checkins/:id/acted → marca il checkin come "ho cliccato sul CTA"
 */
import { Router } from "express";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, moodCheckinsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { recordSignal } from "../services/discovery-engine";
import { suggestActionForMood, normalizeMoodInput } from "../services/mood/mood-to-action";

const router = Router();

const checkinSchema = z.object({
  energy:     z.number().min(0).max(100),
  anxiety:    z.number().min(0).max(100),
  curiosity:  z.number().min(0).max(100),
  clarity:    z.number().min(0).max(100),
  motivation: z.number().min(0).max(100),
});

router.post("/checkins", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const parsed = checkinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Slider non validi", details: parsed.error.flatten() });
    return;
  }

  const normalized = normalizeMoodInput(parsed.data);
  if ("error" in normalized) {
    res.status(400).json({ error: normalized.error });
    return;
  }

  const suggestion = suggestActionForMood(normalized);

  const [row] = await db
    .insert(moodCheckinsTable)
    .values({
      userId,
      energy:     normalized.energy,
      anxiety:    normalized.anxiety,
      curiosity:  normalized.curiosity,
      clarity:    normalized.clarity,
      motivation: normalized.motivation,
      suggestedToolHref:  suggestion.toolHref,
      suggestedToolLabel: suggestion.toolLabel,
      rationale:          suggestion.rationale,
    })
    .returning();

  // Segnale al Discovery Engine. Intensità modulata su quanto l'utente è "in territorio"
  // (cioè i picchi su almeno uno slider) — un mood neutro al centro vale meno.
  const peak = Math.max(
    Math.abs(normalized.energy - 50),
    Math.abs(normalized.anxiety - 50),
    Math.abs(normalized.curiosity - 50),
    Math.abs(normalized.clarity - 50),
    Math.abs(normalized.motivation - 50),
  ) / 50; // 0..1
  recordSignal({
    userId,
    signalType: "mood_checkin",
    intensity: Math.max(0.3, peak),
    payload: { checkinId: row!.id, suggestion: suggestion.toolHref },
  }).catch((err) => req.log?.warn?.({ err }, "[mood] discovery signal failed"));

  res.status(201).json({ checkin: row, suggestion });
});

router.get("/checkins", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(Number(req.query.limit) || 14, 60);
  const rows = await db
    .select()
    .from(moodCheckinsTable)
    .where(eq(moodCheckinsTable.userId, userId))
    .orderBy(desc(moodCheckinsTable.createdAt))
    .limit(limit);
  res.json({ checkins: rows });
});

router.post("/checkins/:id/acted", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const [updated] = await db
    .update(moodCheckinsTable)
    .set({ actedUpon: new Date().toISOString() })
    .where(and(eq(moodCheckinsTable.id, id), eq(moodCheckinsTable.userId, userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Checkin non trovato" });
    return;
  }
  res.json({ checkin: updated });
});

export default router;
