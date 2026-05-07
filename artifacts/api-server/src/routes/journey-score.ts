import { Router } from "express";
import { db, usersTable, testSessionsTable, userObjectivesTable } from "@workspace/db";
import { certificationsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

/**
 * GET /api/journey-score/:userId — public, computes the NorthStar journey health score
 * Returns: overall % + breakdown by category
 */
router.get("/journey-score/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const sessions = await db.select().from(testSessionsTable).where(eq(testSessionsTable.userId, userId));
  const [objCount] = await db.select({ c: count() }).from(userObjectivesTable).where(eq(userObjectivesTable.userId, userId));
  const [completedObj] = await db.select({ c: count() }).from(userObjectivesTable).where(eq(userObjectivesTable.userId, userId));
  const [certCount] = await db.select({ c: count() }).from(certificationsTable).where(eq(certificationsTable.userId, userId));

  const hasTest = sessions.length > 0;
  const hasConfirmedSector = sessions.some((s) => s.confirmedSectorId);
  const hasRole = user.workPreference !== "unknown";
  const objectivesCount = Number(objCount?.c ?? 0);
  const completedCount = Number(completedObj?.c ?? 0);
  const certsCount = Number(certCount?.c ?? 0);

  const steps = [
    {
      id: "test",
      label: "Test completato",
      description: "Hai completato il test RIASEC",
      points: 20,
      earned: hasTest ? 20 : 0,
      done: hasTest,
    },
    {
      id: "sector",
      label: "Settore confermato",
      description: "Hai confermato il tuo settore di interesse",
      points: 20,
      earned: hasConfirmedSector ? 20 : 0,
      done: hasConfirmedSector,
    },
    {
      id: "objectives",
      label: "Obiettivi definiti",
      description: "Hai creato almeno 3 obiettivi",
      points: 20,
      earned: Math.min(objectivesCount * 7, 20),
      done: objectivesCount >= 3,
    },
    {
      id: "completions",
      label: "Obiettivi completati",
      description: "Hai completato almeno 1 obiettivo",
      points: 15,
      earned: Math.min(completedCount * 5, 15),
      done: completedCount >= 1,
    },
    {
      id: "certifications",
      label: "Certificazioni",
      description: "Hai aggiunto certificazioni al profilo",
      points: 15,
      earned: Math.min(certsCount * 8, 15),
      done: certsCount >= 1,
    },
    {
      id: "profile",
      label: "Profilo completo",
      description: "Il tuo profilo è visibile pubblicamente",
      points: 10,
      earned: user.isPublic ? 10 : 0,
      done: user.isPublic,
    },
  ];

  const totalEarned = steps.reduce((s, st) => s + st.earned, 0);
  const totalPossible = steps.reduce((s, st) => s + st.points, 0);
  const score = Math.round((totalEarned / totalPossible) * 100);

  const level =
    score >= 85 ? "Stella Polare" :
    score >= 65 ? "Navigatore" :
    score >= 45 ? "Esploratore" :
    score >= 25 ? "In Viaggio" :
    "Inizio Percorso";

  const levelEmoji =
    score >= 85 ? "⭐" :
    score >= 65 ? "🧭" :
    score >= 45 ? "🗺️" :
    score >= 25 ? "🚀" :
    "🌱";

  res.json({
    userId,
    name: user.name,
    score,
    level,
    levelEmoji,
    steps,
    totalEarned,
    totalPossible,
    isPublic: user.isPublic,
  });
});

export default router;
