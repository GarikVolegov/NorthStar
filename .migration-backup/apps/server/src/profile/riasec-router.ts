/**
 * riasec-router.ts — GET /api/users/me/riasec
 *
 * Restituisce l'ultima testSession completata dell'utente.
 * Usato da RiasecProfileCard per visualizzare il profilo RIASEC.
 *
 * 200: RiasecResult
 * 404: { error: 'Nessun test completato' }
 * 401: non autenticato
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { testSessionsTable } from "@workspace/db";
import { eq, desc, isNotNull } from "drizzle-orm";

export const riasecRouter = Router();

function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}
function requireAuth(req: Request, res: Response, next: () => void) {
  const uid = (req as Request & { user?: { id: number } }).user?.id;
  if (!uid) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}

riasecRouter.get("/me/riasec", requireAuth, async (req, res) => {
  try {
    // Ultima sessione con riasecScores non vuoto
    const session = await db
      .select({
        riasecScores:    testSessionsTable.riasecScores,
        primaryTypes:    testSessionsTable.primaryTypes,
        profileSummary:  testSessionsTable.profileSummary,
        recommendations: testSessionsTable.recommendations,
        spiritScores:    testSessionsTable.spiritScores,
        dominantSpirit:  testSessionsTable.dominantSpirit,
        createdAt:       testSessionsTable.createdAt,
      })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, userId(req)))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!session || Object.keys(session.riasecScores).length === 0) {
      res.status(404).json({ error: "Nessun test completato" });
      return;
    }

    res.json({
      riasecScores:    session.riasecScores,
      primaryTypes:    session.primaryTypes,
      profileSummary:  session.profileSummary,
      recommendations: session.recommendations,
      dominantSpirit:  session.dominantSpirit,
      createdAt:       session.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
