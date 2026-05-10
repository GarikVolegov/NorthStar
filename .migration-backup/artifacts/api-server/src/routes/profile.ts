import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

const ChangePasswordBody = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8), // FIX: raised from 6 to 8 chars minimum
});

const UserModeBody = z.object({
  userMode: z.enum(["explorer", "climber"]),
});

// GET /profile/:userId — public profile (no auth required, limited fields)
router.get("/profile/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
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

  const confirmedSectorIds = new Set(
    sessions.map((s) => s.confirmedSectorId).filter(Boolean)
  );

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
    userMode: user.userMode ?? "explorer",
    workPreference: user.workPreference,
    testSessions: sessionData,
    exploredSectors,
  });
});

// PATCH /profile/:userId/mode — FIXED: authMiddleware + ownership check (was open to IDOR)
router.patch("/profile/:userId/mode", authMiddleware, async (req, res): Promise<void> => {
  const paramId = parseInt(String(req.params.userId), 10);
  if (isNaN(paramId)) { res.status(400).json({ error: "ID non valido" }); return; }

  // FIX: ensure the authenticated user can only update their own mode
  const authenticatedUserId = res.locals.userId as number;
  if (paramId !== authenticatedUserId) {
    res.status(403).json({ error: "Non autorizzato a modificare questo profilo" });
    return;
  }

  const parsed = UserModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "userMode deve essere 'explorer' o 'climber'" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ userMode: parsed.data.userMode })
    .where(eq(usersTable.id, authenticatedUserId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Utente non trovato" }); return; }
  res.json({ userMode: updated.userMode });
});

// POST /profile/change-password — FIXED: authMiddleware + ownership (was open to IDOR via userId in body)
/* ── PATCH /profile/:id/journey-type ── */
const VALID_JOURNEY_TYPES = ["indeciso", "dipendente", "autonomo", "azienda", "investitore"] as const;

const JourneyTypeBody = z.object({
  journeyType: z.enum(VALID_JOURNEY_TYPES),
});

router.patch("/profile/:id/journey-type", authMiddleware, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.id), 10);
  const requesterId = res.locals.userId as number;

  if (isNaN(userId) || userId !== requesterId) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  const parsed = JourneyTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Tipo percorso non valido", details: parsed.error.flatten() });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  await db.update(usersTable).set({ journeyType: parsed.data.journeyType }).where(eq(usersTable.id, userId));
  res.json({ journeyType: parsed.data.journeyType });
});

// PATCH /profile/:userId/avatar — store base64 data URL as avatarUrl
const AvatarBody = z.object({
  avatarDataUrl: z.string().max(500_000).refine(
    (v) => v.startsWith("data:image/"),
    { message: "Formato immagine non valido" },
  ),
});

router.patch("/profile/:userId/avatar", authMiddleware, async (req, res): Promise<void> => {
  const paramId = parseInt(String(req.params.userId), 10);
  if (isNaN(paramId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const authenticatedUserId = res.locals.userId as number;
  if (paramId !== authenticatedUserId) {
    res.status(403).json({ error: "Non autorizzato a modificare questo profilo" });
    return;
  }

  const parsed = AvatarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Dati non validi" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl: parsed.data.avatarDataUrl })
    .where(eq(usersTable.id, authenticatedUserId))
    .returning({ avatarUrl: usersTable.avatarUrl });

  if (!updated) { res.status(404).json({ error: "Utente non trovato" }); return; }
  res.json({ avatarUrl: updated.avatarUrl });
});

// DELETE /profile/:userId/avatar — remove avatar
router.delete("/profile/:userId/avatar", authMiddleware, async (req, res): Promise<void> => {
  const paramId = parseInt(String(req.params.userId), 10);
  if (isNaN(paramId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const authenticatedUserId = res.locals.userId as number;
  if (paramId !== authenticatedUserId) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  await db.update(usersTable).set({ avatarUrl: null }).where(eq(usersTable.id, authenticatedUserId));
  res.json({ avatarUrl: null });
});

router.post("/profile/change-password", authMiddleware, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.flatten() });
    return;
  }

  // FIX: userId comes from the JWT token, not from the request body — prevents IDOR
  const userId = res.locals.userId as number;
  const { oldPassword, newPassword } = parsed.data;

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

  // FIX: prevent reuse of the same password
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) {
    res.status(400).json({ error: "La nuova password deve essere diversa da quella attuale" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12); // FIX: raised cost from 10 to 12
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  res.json({ message: "Password aggiornata con successo" });
});

export default router;
