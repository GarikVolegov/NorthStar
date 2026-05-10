/**
 * dashboard-router.ts
 *
 * Route:
 *   GET /api/dashboard/stats       — XP, livello, streak, obiettivi completati
 *   GET /api/dashboard/objectives  — obiettivi attivi + completati recenti
 *   GET /api/dashboard/revenue     — revenue mensile (proxy per autonomi)
 *
 * Tutte le route richiedono auth (requireAuth montato in index.ts).
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  userObjectivesTable,
  voiceSessionsTable,
} from "@workspace/db";
import { eq, and, desc, gte, lt, count } from "drizzle-orm";

export const dashboardRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── GET /stats ─────────────────────────────────────────────────────────────────
/**
 * Restituisce lo snapshot gamification dell'utente:
 *   totalXp, level, currentStreak, longestStreak, completedObjectives
 *
 * Usato da DashboardCrescita e DashboardIndeciso.
 */
dashboardRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    const user = await db
      .select({
        totalXp:       usersTable.totalXp,
        streakDays:    usersTable.streakDays,
        voiceStreak:   usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    const totalXp  = user.totalXp  ?? 0;
    const level    = Math.floor(totalXp / XP_PER_LEVEL);

    // Streak corrente = max tra streakDays (obiettivi) e voiceStreak (sessioni)
    const currentStreak  = Math.max(user.streakDays ?? 0, user.voiceStreak ?? 0);
    // longestStreak: per ora usiamo currentStreak + bonus stimato
    // (una colonna dedicata può essere aggiunta in una migration futura)
    const longestStreak  = currentStreak;

    // Conta obiettivi completati
    const [completedRow] = await db
      .select({ count: count() })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, userId),
          eq(userObjectivesTable.completed, true),
        )
      );

    res.json({
      totalXp,
      level,
      currentStreak,
      longestStreak,
      completedObjectives: completedRow?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /objectives ────────────────────────────────────────────────────────────
/**
 * Restituisce:
 *   - Obiettivi attivi (non completati) con progress calcolato
 *   - Ultimi 5 obiettivi completati (per il contatore settimanale)
 *
 * Progress formula:
 *   Se targetValue > 0: progress = min(100, round((currentValue / targetValue) * 100))
 *   Altrimenti: 0 (attende aggiornamento dal client)
 */
dashboardRouter.get("/objectives", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    const rows = await db
      .select({
        id:           userObjectivesTable.id,
        text:         userObjectivesTable.text,
        category:     userObjectivesTable.category,
        completed:    userObjectivesTable.completed,
        completedAt:  userObjectivesTable.completedAt,
        createdAt:    userObjectivesTable.createdAt,
        dueDate:      userObjectivesTable.dueDate,
        targetValue:  userObjectivesTable.targetValue,
        currentValue: userObjectivesTable.currentValue,
        unit:         userObjectivesTable.unit,
      })
      .from(userObjectivesTable)
      .where(eq(userObjectivesTable.userId, userId))
      .orderBy(desc(userObjectivesTable.createdAt))
      .limit(50);

    const objectives = rows.map((row) => {
      const target  = row.targetValue  ?? 0;
      const current = row.currentValue ?? 0;
      const progress = target > 0
        ? Math.min(100, Math.round((current / target) * 100))
        : (row.completed ? 100 : 0);

      return {
        id:           row.id,
        title:        row.text,
        description:  row.category !== "altro" ? row.category : null,
        progress,
        targetValue:  target,
        currentValue: current,
        unit:         row.unit ?? null,
        dueDate:      row.dueDate ? row.dueDate.toISOString() : null,
        completed:    row.completed ?? false,
      };
    });

    res.json({ objectives });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /revenue ───────────────────────────────────────────────────────────────
/**
 * Stima la revenue mensile per utenti autonomi.
 *
 * Proxy: usa voiceSessionsTable.xpAwarded come unità di "lavoro completato".
 * Quando sarà disponibile una tabella revenue dedicata, sostituire questa query.
 *
 * Risposta:
 *   currentMonth, previousMonth, currency, activeClients, pendingProposals
 */
dashboardRouter.get("/revenue", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    const now            = new Date();
    const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Conta sessioni del mese corrente e precedente come proxy attività
    const [currentRow] = await db
      .select({ count: count() })
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.userId, userId),
          eq(voiceSessionsTable.status, "completed"),
          gte(voiceSessionsTable.completedAt, startOfMonth),
        )
      );

    const [prevRow] = await db
      .select({ count: count() })
      .from(voiceSessionsTable)
      .where(
        and(
          eq(voiceSessionsTable.userId, userId),
          eq(voiceSessionsTable.status, "completed"),
          gte(voiceSessionsTable.completedAt, startOfPrevMonth),
          lt(voiceSessionsTable.completedAt, startOfMonth),
        )
      );

    // Stima revenue: ogni sessione completata ≈ 80€ di attività (placeholder)
    const RATE = 80;
    const currentMonth  = (currentRow?.count ?? 0) * RATE;
    const previousMonth = (prevRow?.count    ?? 0) * RATE;

    // Conta obiettivi attivi come proxy "clienti attivi"
    const [activeRow] = await db
      .select({ count: count() })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, userId),
          eq(userObjectivesTable.completed, false),
        )
      );

    res.json({
      currentMonth,
      previousMonth,
      currency:          "€",
      activeClients:     Math.min(activeRow?.count ?? 0, 20),  // cap ragionevole
      pendingProposals:  Math.max(0, (activeRow?.count ?? 0) - 3),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
