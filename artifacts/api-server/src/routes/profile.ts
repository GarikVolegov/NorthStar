import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const ChangePasswordBody = z.object({
  userId: z.number(),
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.get("/profile/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  const sessions = await db
    .select()
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt));

  const sectors = await db.select().from(sectorsTable);

  const sessionData = sessions.map((s) => {
    const recs = (s.recommendations ?? []) as Array<{
      sectorId: number;
      sectorName: string;
      matchScore: number;
      matchReason: string;
    }>;

    const confirmedSector = s.confirmedSectorId
      ? sectors.find((sec) => sec.id === s.confirmedSectorId) ?? null
      : null;

    return {
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      primaryTypes: s.primaryTypes,
      profileSummary: s.profileSummary,
      dominantSpirit: s.dominantSpirit,
      spiritScores: s.spiritScores,
      confirmedSectorId: s.confirmedSectorId,
      confirmedSector: confirmedSector
        ? {
            id: confirmedSector.id,
            name: confirmedSector.name,
            icon: confirmedSector.icon,
            description: confirmedSector.description,
          }
        : null,
      topRecommendation: recs[0] ?? null,
    };
  });

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    testSessions: sessionData,
  });
});

router.post("/profile/change-password", async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { userId, oldPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  if (!user.passwordHash) {
    res.status(400).json({ error: "Account senza password impostata" });
    return;
  }

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Password attuale non corretta" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  res.json({ message: "Password aggiornata con successo" });
});

export default router;
