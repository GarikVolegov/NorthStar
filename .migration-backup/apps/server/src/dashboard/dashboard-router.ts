/**
 * dashboard-router.ts
 *
 * Route:
 *   GET /api/dashboard/stats       — XP, livello, streak, obiettivi completati
 *   GET /api/dashboard/objectives  — obiettivi attivi + completati recenti
 *   GET /api/dashboard/revenue     — revenue mensile (proxy per autonomi)
 *   GET /api/dashboard/transition  — snapshot transizione di carriera
 *
 * Tutte le route richiedono auth (requireAuth montato in index.ts).
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  userObjectivesTable,
  voiceSessionsTable,
  sectorsTable,
} from "@workspace/db";
import { eq, and, desc, gte, lt, count } from "drizzle-orm";

export const dashboardRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── GET /stats ─────────────────────────────────────────────────────────────────
dashboardRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    const user = await db
      .select({
        totalXp:     usersTable.totalXp,
        streakDays:  usersTable.streakDays,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

    const totalXp       = user.totalXp ?? 0;
    const level         = Math.floor(totalXp / XP_PER_LEVEL);
    const currentStreak = Math.max(user.streakDays ?? 0, user.voiceStreak ?? 0);

    const [completedRow] = await db
      .select({ count: count() })
      .from(userObjectivesTable)
      .where(and(
        eq(userObjectivesTable.userId, userId),
        eq(userObjectivesTable.completed, true),
      ));

    res.json({
      totalXp,
      level,
      currentStreak,
      longestStreak: currentStreak,
      completedObjectives: completedRow?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /objectives ────────────────────────────────────────────────────────────
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
      const target   = row.targetValue  ?? 0;
      const current  = row.currentValue ?? 0;
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
dashboardRouter.get("/revenue", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    const now              = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentRow] = await db
      .select({ count: count() })
      .from(voiceSessionsTable)
      .where(and(
        eq(voiceSessionsTable.userId, userId),
        eq(voiceSessionsTable.status, "completed"),
        gte(voiceSessionsTable.completedAt, startOfMonth),
      ));

    const [prevRow] = await db
      .select({ count: count() })
      .from(voiceSessionsTable)
      .where(and(
        eq(voiceSessionsTable.userId, userId),
        eq(voiceSessionsTable.status, "completed"),
        gte(voiceSessionsTable.completedAt, startOfPrevMonth),
        lt(voiceSessionsTable.completedAt, startOfMonth),
      ));

    const [activeRow] = await db
      .select({ count: count() })
      .from(userObjectivesTable)
      .where(and(
        eq(userObjectivesTable.userId, userId),
        eq(userObjectivesTable.completed, false),
      ));

    const RATE = 80;
    res.json({
      currentMonth:     (currentRow?.count ?? 0) * RATE,
      previousMonth:    (prevRow?.count    ?? 0) * RATE,
      currency:         "€",
      activeClients:    Math.min(activeRow?.count ?? 0, 20),
      pendingProposals: Math.max(0, (activeRow?.count ?? 0) - 3),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /transition ────────────────────────────────────────────────────────────
/**
 * Snapshot per DashboardTransizione.
 *
 * phasesCompleted stimato da obiettivi completati:
 *   0  → 0 completati
 *   1  → 1-3 completati
 *   2  → 4-8 completati
 *   3  → > 8 completati
 */
dashboardRouter.get("/transition", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    const user = await db
      .select({
        totalXp:     usersTable.totalXp,
        streakDays:  usersTable.streakDays,
        voiceStreak: usersTable.voiceStreak,
        currentRole: usersTable.currentRole,
        targetRole:  usersTable.targetRole,
        sectorId:    usersTable.sectorId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

    // Nome settore target
    let targetSector: string | null = null;
    if (user.sectorId) {
      const sector = await db
        .select({ name: sectorsTable.name })
        .from(sectorsTable)
        .where(eq(sectorsTable.id, user.sectorId))
        .limit(1)
        .then((r) => r[0]);
      targetSector = sector?.name ?? null;
    }

    // Conta obiettivi completati → stima fase
    const [completedRow] = await db
      .select({ count: count() })
      .from(userObjectivesTable)
      .where(and(
        eq(userObjectivesTable.userId, userId),
        eq(userObjectivesTable.completed, true),
      ));

    const completedCount  = completedRow?.count ?? 0;
    const phasesCompleted = completedCount === 0 ? 0
                          : completedCount <= 3  ? 1
                          : completedCount <= 8  ? 2
                          : 3;

    res.json({
      currentRole:         user.currentRole ?? null,
      targetRole:          user.targetRole  ?? null,
      targetSector,
      phasesCompleted,
      totalXp:             user.totalXp ?? 0,
      currentStreak:       Math.max(user.streakDays ?? 0, user.voiceStreak ?? 0),
      completedObjectives: completedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
