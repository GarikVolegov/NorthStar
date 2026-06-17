/**
 * market-intelligence.ts — Intelligence di mercato per l'utente (IT Italia).
 *
 * GET /api/market/overview  — FREE: radar stipendi & domanda (settori) + teaser segnali
 * GET /api/market/signals   — PRO (weak_signals): segnali emergenti + skill in crescita
 *
 * Consegna la promessa "liveData" del paywall. Il radar settori è sempre
 * popolato (dati seed); le sezioni segnali/skill degradano a vuoto se le tabelle
 * RAG non sono ancora alimentate (mostrate come "in aggiornamento" lato FE).
 */
import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  sectorsTable,
  weakSignalsTable,
  skillCooccurrencesTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/check-feature";

const router = Router();

// ── GET /api/market/overview — radar gratuito + teaser segnali ─────────────────
router.get("/overview", requireAuth, async (req, res) => {
  try {
    const sectors = await db
      .select({
        id: sectorsTable.id,
        name: sectorsTable.name,
        avgSalaryMin: sectorsTable.avgSalaryMin,
        avgSalaryMax: sectorsTable.avgSalaryMax,
        growthRate: sectorsTable.growthRate,
        automationRisk: sectorsTable.automationRisk,
        trend: sectorsTable.trend,
        icon: sectorsTable.icon,
        color: sectorsTable.color,
      })
      .from(sectorsTable)
      .where(eq(sectorsTable.isActive, true))
      .orderBy(desc(sectorsTable.growthRate))
      .limit(12);

    // Teaser segnali emergenti: solo conteggio + titoli (no dettaglio) per spingere a Pro.
    let signalsTotal = 0;
    let signalsPreview: string[] = [];
    try {
      const signals = await db
        .select({ title: weakSignalsTable.title })
        .from(weakSignalsTable)
        .where(sql`${weakSignalsTable.status} <> 'faded'`)
        .orderBy(desc(weakSignalsTable.strength))
        .limit(50);
      signalsTotal = signals.length;
      signalsPreview = signals.slice(0, 3).map((s) => s.title);
    } catch {
      /* tabella non ancora alimentata */
    }

    res.json({
      sectors: sectors.map((s) => ({
        ...s,
        growthRate: Math.round(s.growthRate * 10) / 10,
      })),
      signalsTeaser: { total: signalsTotal, preview: signalsPreview },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.error?.({ err }, "market overview error");
    res.status(500).json({ error: "Errore nel caricamento dei dati di mercato" });
  }
});

// ── GET /api/market/signals — segnali emergenti + skill in crescita (Pro) ──────
router.get(
  "/signals",
  requireAuth,
  requireFeature("weak_signals", "json"),
  async (req, res) => {
    try {
      const signals = await db
        .select({
          id: weakSignalsTable.id,
          signalType: weakSignalsTable.signalType,
          title: weakSignalsTable.title,
          description: weakSignalsTable.description,
          strength: weakSignalsTable.strength,
          status: weakSignalsTable.status,
          linkedSkills: weakSignalsTable.linkedSkillIds,
          geographies: weakSignalsTable.geographies,
          firstSeenAt: weakSignalsTable.firstSeenAt,
        })
        .from(weakSignalsTable)
        .where(sql`${weakSignalsTable.status} <> 'faded'`)
        .orderBy(desc(weakSignalsTable.strength))
        .limit(20);

      const emergingSkills = await db
        .select({
          skill: skillCooccurrencesTable.skillName,
          coSkill: skillCooccurrencesTable.coSkillName,
          frequency: skillCooccurrencesTable.frequency,
          frequencyRate: skillCooccurrencesTable.frequencyRate,
        })
        .from(skillCooccurrencesTable)
        .orderBy(desc(skillCooccurrencesTable.frequency))
        .limit(15);

      res.json({
        signals: signals.map((s) => ({
          id: s.id,
          signalType: s.signalType,
          title: s.title,
          description: s.description,
          strength: Math.round(s.strength * 100) / 100,
          status: s.status,
          linkedSkills: s.linkedSkills ?? [],
          geographies: s.geographies ?? [],
          firstSeenAt: s.firstSeenAt?.toISOString() ?? "",
        })),
        emergingSkills: emergingSkills.map((s) => ({
          skill: s.skill,
          coSkill: s.coSkill,
          frequency: s.frequency,
          frequencyRate: Math.round(s.frequencyRate * 1000) / 10,
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      req.log?.error?.({ err }, "market signals error");
      res.status(500).json({ error: "Errore nel caricamento dei segnali di mercato" });
    }
  },
);

export default router;
