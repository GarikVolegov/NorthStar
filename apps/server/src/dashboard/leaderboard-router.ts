/**
 * leaderboard-router.ts
 *
 * Route:
 *   GET /api/leaderboard/sector  — top 10 utenti per XP nello stesso settore
 *
 * Logica:
 *   1. Recupera sectorId dell'utente corrente
 *   2. Query top 10 utenti dello stesso settore per totalXp DESC
 *   3. Aggiunge flag isCurrentUser e rank
 *   4. Se l'utente corrente non è in top 10, aggiunge la sua riga in fondo
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, desc, and, isNotNull } from "drizzle-orm";

export const leaderboardRouter = Router();

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

leaderboardRouter.get("/sector", async (req: Request, res: Response) => {
  try {
    const userId = uid(req);

    // 1. Recupera sectorId dell'utente
    const me = await db
      .select({
        sectorId: usersTable.sectorId,
        name:     usersTable.name,
        totalXp:  usersTable.totalXp,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!me?.sectorId) {
      // Utente senza settore: leaderboard vuota
      res.json({ entries: [] });
      return;
    }

    // 2. Top 10 nello stesso settore
    const rows = await db
      .select({
        id:       usersTable.id,
        name:     usersTable.name,
        totalXp:  usersTable.totalXp,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.sectorId, me.sectorId),
          isNotNull(usersTable.totalXp),
        )
      )
      .orderBy(desc(usersTable.totalXp))
      .limit(10);

    let entries = rows.map((row, i) => ({
      rank:          i + 1,
      userId:        row.id,
      name:          row.name ?? "Utente",
      avatarUrl:     row.avatarUrl ?? null,
      totalXp:       row.totalXp ?? 0,
      isCurrentUser: row.id === userId,
    }));

    // 3. Se l'utente corrente non è in top 10, aggiunge la sua riga
    const alreadyIn = entries.some((e) => e.isCurrentUser);
    if (!alreadyIn) {
      // Calcola rank reale
      const allAbove = await db
        .select({ count: db.$count(usersTable, and(
          eq(usersTable.sectorId, me.sectorId),
          isNotNull(usersTable.totalXp),
        ))})
        .then((r) => Number(r[0]?.count ?? 0));

      entries.push({
        rank:          allAbove + 1,
        userId,
        name:          me.name ?? "Tu",
        avatarUrl:     me.avatarUrl ?? null,
        totalXp:       me.totalXp ?? 0,
        isCurrentUser: true,
      });
    }

    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
