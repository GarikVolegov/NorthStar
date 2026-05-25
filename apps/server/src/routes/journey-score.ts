import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, usersTable, testSessionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { isPersistenceSchemaError } from "../lib/persistence";

const router = Router();

const STEPS = [
  { id: "test",       label: "Completa il test RIASEC",    description: "Scopri il tuo profilo professionale",        points: 20 },
  { id: "sector",     label: "Conferma il tuo settore",    description: "Scegli il settore in cui vuoi crescere",      points: 20 },
  { id: "workpref",   label: "Preferenze di lavoro",       description: "Indica come preferisci lavorare",             points: 15 },
  { id: "cv",         label: "Carica il tuo CV",           description: "Aggiungi il tuo curriculum",                  points: 20 },
  { id: "objectives", label: "Crea un obiettivo",          description: "Definisci il tuo primo traguardo",            points: 25 },
];

function toLevel(score: number): { level: string; levelEmoji: string } {
  if (score >= 85) return { level: "Eccellente",  levelEmoji: "🌟" };
  if (score >= 65) return { level: "Avanzato",    levelEmoji: "🚀" };
  if (score >= 45) return { level: "In cammino",  levelEmoji: "🌱" };
  if (score >= 25) return { level: "Iniziando",   levelEmoji: "🔰" };
  return              { level: "Principiante",     levelEmoji: "💡" };
}

router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    let sessionRow: { cnt: number } | undefined;
    try {
      [sessionRow] = await db
        .select({ cnt: count() })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.userId, userId));
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
      req.log?.warn?.({ err, route: "journey-score", userId, setupAction: "run_migrations" }, "test sessions unavailable");
    }

    const hasTest     = Number(sessionRow?.cnt ?? 0) > 0;
    const hasSector   = !!user.journeyType && user.journeyType !== "indeciso";

    const done: Record<string, boolean> = {
      test:       hasTest,
      sector:     hasSector,
      workpref:   false,
      cv:         false,
      objectives: false,
    };

    const steps = STEPS.map((s) => ({
      ...s,
      earned: done[s.id] ? s.points : 0,
      done:   done[s.id],
    }));

    const totalEarned   = steps.reduce((acc, s) => acc + s.earned, 0);
    const totalPossible = steps.reduce((acc, s) => acc + s.points, 0);
    const score         = Math.round((totalEarned / totalPossible) * 100);

    res.json({ score, ...toLevel(score), steps, totalEarned, totalPossible });
  } catch (err) {
    req.log?.error?.({ err }, "journey-score error");
    res.status(500).json({ error: "Errore nel calcolo del punteggio" });
  }
});

export default router;
