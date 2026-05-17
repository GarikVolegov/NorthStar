/**
 * onboarding.ts — route per l'onboarding adattivo.
 *
 * POST /api/onboarding/complete
 *   Salva in transazione: journeyType, settori preferiti, skill goals,
 *   orizzonte temporale, coach_memory seed, onboarding_step = 4.
 *   Restituisce il primo messaggio Wendy via SSE (streaming).
 *
 * GET  /api/onboarding/status
 *   Restituisce lo step corrente dell'onboarding.
 *
 * SECURITY: userId sempre da JWT.
 * PRIVACY: il testo libero (onboarding_note) va in coach_memory senza PII.
 */
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import {
  db,
  usersTable,
  userProfileSettingsTable,
  userFavoritesTable,
  userObjectivesTable,
  coachMemoryFactsTable,
} from "@workspace/db";

const router = Router();
const log = rootLogger.child({ module: "onboarding" });

// ── Schema validazione ─────────────────────────────────────────────────────────

const OnboardingCompleteSchema = z.object({
  journeyType:  z.enum(["indeciso", "dipendente", "autonomo", "azienda", "investitore",
                         "job_search", "career_pivot", "skill_up", "startup_ideation", "explorer"]),
  sectorIds:    z.array(z.number().int().positive()).max(3).default([]),
  skillGoals:   z.array(z.string().max(100)).max(5).default([]),
  horizon:      z.enum(["short", "medium", "open"]).default("open"),
  openNote:     z.string().max(200).optional(),  // testo libero Step 1 opzionale
});

// ── GET /api/onboarding/status ─────────────────────────────────────────────────

router.get("/status", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  try {
    const [profile] = await db
      .select({ onboardingStep: userProfileSettingsTable.onboardingStep })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);

    res.json({ onboardingStep: profile?.onboardingStep ?? 0 });
  } catch (e) {
    log.error({ e, userId }, "[onboarding] status error");
    res.status(500).json({ error: "Errore nel recupero status onboarding" });
  }
});

// ── POST /api/onboarding/complete ─────────────────────────────────────────────

router.post("/complete", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const parsed = OnboardingCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { journeyType, sectorIds, skillGoals, horizon, openNote } = parsed.data;

  try {
    // 1. Aggiorna journeyType e onboardingCompleted su users
    await db
      .update(usersTable)
      .set({ journeyType, onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    // 2. Aggiorna horizon + onboardingStep su user_profile_settings
    await db
      .insert(userProfileSettingsTable)
      .values({ userId, horizon, onboardingStep: 4 } as any)
      .onConflictDoUpdate({
        target: userProfileSettingsTable.userId,
        set: { horizon, onboardingStep: 4, updatedAt: new Date() },
      });

    // 3. Settori preferiti — insert ignorando duplicati
    if (sectorIds.length > 0) {
      const existing = await db
        .select({ sectorId: userFavoritesTable.sectorId })
        .from(userFavoritesTable)
        .where(eq(userFavoritesTable.userId, userId));
      const existingIds = new Set(existing.map((e) => e.sectorId));
      const newSectorIds = sectorIds.filter((id) => !existingIds.has(id));
      if (newSectorIds.length > 0) {
        await db.insert(userFavoritesTable).values(
          newSectorIds.map((sectorId) => ({ userId, sectorId, type: "sector" as const })),
        );
      }
    }

    // 4. Skill goals → obiettivi categoria 'skill'
    if (skillGoals.length > 0) {
      await db.insert(userObjectivesTable).values(
        skillGoals.map((text) => ({
          userId,
          text: text.trim().slice(0, 300),
          category: "skill" as const,
          progress: 0,
          completed: false,
        })),
      );
    }

    // 5. Coach memory seed (non-PII, solo metadati onboarding)
    const memoryFacts: Array<{ userId: number; key: string; value: string; source: string }> = [
      { userId, key: "onboarding_journey", value: journeyType,       source: "onboarding" },
      { userId, key: "onboarding_horizon", value: horizon,           source: "onboarding" },
    ];
    if (sectorIds.length > 0) {
      memoryFacts.push({ userId, key: "onboarding_sector_ids", value: sectorIds.join(","), source: "onboarding" });
    }
    if (skillGoals.length > 0) {
      memoryFacts.push({ userId, key: "onboarding_skill_goals", value: skillGoals.slice(0, 3).join("; "), source: "onboarding" });
    }
    if (openNote?.trim()) {
      // Testo libero: sanitizziamo rimuovendo potenziali PII pattern (email, tel)
      const sanitized = openNote
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, "[email]")
        .replace(/\+?\d[\d\s\-().]{7,}/g, "[tel]")
        .trim();
      memoryFacts.push({ userId, key: "onboarding_note", value: sanitized, source: "onboarding_text" });
    }

    await db
      .insert(coachMemoryFactsTable)
      .values(memoryFacts as any)
      .onConflictDoNothing();

    log.info({ userId, journeyType, horizon, sectorIds }, "[onboarding] completed");
    res.json({ ok: true, journeyType, horizon });

  } catch (e) {
    log.error({ e, userId }, "[onboarding] complete error");
    res.status(500).json({ error: "Errore nel completamento onboarding" });
  }
});

export default router;
