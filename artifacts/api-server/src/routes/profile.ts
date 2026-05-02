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

  // Collect confirmed sector IDs for quick lookup
  const confirmedSectorIds = new Set(
    sessions.map((s) => s.confirmedSectorId).filter(Boolean)
  );

  // Build session data (all 3 recs with full sector info)
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

    const recommendations = recs.map((r) => {
      const sec = sectors.find((s) => s.id === r.sectorId);
      return {
        ...r,
        sector: sec
          ? {
              id: sec.id,
              name: sec.name,
              icon: sec.icon,
              description: sec.description,
              avgSalaryMin: sec.avgSalaryMin,
              avgSalaryMax: sec.avgSalaryMax,
              growthRate: sec.growthRate,
              automationRisk: sec.automationRisk,
              trend: sec.trend,
              riasecTypes: sec.riasecTypes as string[],
              skills: (sec.skills as string[]).slice(0, 4),
            }
          : null,
      };
    });

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
      recommendations,
    };
  });

  // Build deduplicated explored sectors (best match score wins)
  const sectorMap = new Map<
    number,
    {
      sectorId: number;
      bestMatchScore: number;
      confirmed: boolean;
      sector: (typeof sectors)[number];
    }
  >();

  for (const s of sessions) {
    const recs = (s.recommendations ?? []) as Array<{
      sectorId: number;
      sectorName: string;
      matchScore: number;
    }>;
    for (const r of recs) {
      const existing = sectorMap.get(r.sectorId);
      const isConfirmed = confirmedSectorIds.has(r.sectorId);
      const sec = sectors.find((sec) => sec.id === r.sectorId);
      if (!sec) continue;
      if (!existing || r.matchScore > existing.bestMatchScore) {
        sectorMap.set(r.sectorId, {
          sectorId: r.sectorId,
          bestMatchScore: r.matchScore,
          confirmed: isConfirmed,
          sector: sec,
        });
      } else if (isConfirmed) {
        existing.confirmed = true;
      }
    }
  }

  const exploredSectors = Array.from(sectorMap.values())
    .sort((a, b) => {
      if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
      return b.bestMatchScore - a.bestMatchScore;
    })
    .map(({ sectorId, bestMatchScore, confirmed, sector }) => ({
      sectorId,
      bestMatchScore,
      confirmed,
      name: sector.name,
      icon: sector.icon,
      description: sector.description,
      avgSalaryMin: sector.avgSalaryMin,
      avgSalaryMax: sector.avgSalaryMax,
      growthRate: sector.growthRate,
      automationRisk: sector.automationRisk,
      scalability: sector.scalability,
      trend: sector.trend,
      timeToAutonomy: sector.timeToAutonomy,
      riasecTypes: sector.riasecTypes as string[],
      skills: (sector.skills as string[]).slice(0, 5),
      advantages: (sector.advantages as string[]).slice(0, 3),
    }));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    testSessions: sessionData,
    exploredSectors,
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
