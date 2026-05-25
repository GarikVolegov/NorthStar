import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, userBadgesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { BADGE_DEFINITIONS, type BadgeKey } from "@workspace/db";
import { xpProgress } from "./xp-constants";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const badges = await db
      .select()
      .from(userBadgesTable)
      .where(eq(userBadgesTable.userId, userId))
      .orderBy(desc(userBadgesTable.earnedAt));

    const allDefinitions = Object.values(BADGE_DEFINITIONS).map((def) => {
      const earned = badges.find((b) => b.badgeKey === def.key);
      return {
        key: def.key,
        label: def.label,
        icon: def.icon,
        description: def.description,
        xp: def.xp,
        earned: !!earned,
        earnedAt: earned?.earnedAt ?? null,
        seen: earned?.seen ?? null,
        id: earned?.id ?? null,
      };
    });

    res.json({ badges: allDefinitions });
  } catch (err) {
    req.log?.error?.({ err }, "badges list error");
    res.status(500).json({ error: "Errore nel recupero dei badge" });
  }
});

router.post("/check", async (req, res) => {
  try {
    const userId = req.user!.id;
    const earned: Array<{ key: string; label: string; icon: string; xp: number }> = [];

    const existing = await db
      .select({ badgeKey: userBadgesTable.badgeKey })
      .from(userBadgesTable)
      .where(eq(userBadgesTable.userId, userId));

    const existingKeys = new Set(existing.map((b) => b.badgeKey));

    const [user] = await db
      .select({
        totalXp: usersTable.totalXp,
        voiceStreak: usersTable.voiceStreak,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

    const [sessionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userBadgesTable)
      .where(
        and(
          eq(userBadgesTable.userId, userId),
          eq(userBadgesTable.badgeKey, "first_session"),
        ),
      );
    const completedSessions = Number(sessionsResult?.count ?? 0);
    const currentLevel = Math.floor((user.totalXp ?? 0) / 200);

    const checks: Array<{ key: BadgeKey; condition: boolean }> = [
      { key: "first_session", condition: completedSessions >= 1 },
      { key: "marathon", condition: completedSessions >= 10 },
      { key: "centurion", condition: completedSessions >= 100 },
      { key: "dedication", condition: (user.voiceStreak ?? 0) >= 7 },
      { key: "level5", condition: currentLevel >= 5 },
      { key: "level10", condition: currentLevel >= 10 },
    ];

    for (const check of checks) {
      if (check.condition && !existingKeys.has(check.key)) {
        const def = BADGE_DEFINITIONS[check.key];
        if (!def) continue;

        await db.insert(userBadgesTable).values({
          userId,
          badgeKey: def.key,
          badgeLabel: def.label,
          badgeIcon: def.icon,
          badgeDescription: def.description,
          xpAwarded: def.xp,
        });

        const newTotalXp = (user.totalXp ?? 0) + def.xp;
        await db
          .update(usersTable)
          .set({ totalXp: newTotalXp })
          .where(eq(usersTable.id, userId));

        earned.push({ key: def.key, label: def.label, icon: def.icon, xp: def.xp });
      }
    }

    const xp = xpProgress(user.totalXp ?? 0);

    res.json({
      earned,
      totalXp: user.totalXp ?? 0,
      level: xp.level,
    });
  } catch (err) {
    req.log?.error?.({ err }, "badges check error");
    res.status(500).json({ error: "Errore nella verifica dei badge" });
  }
});

router.post("/:id/seen", async (req, res) => {
  try {
    const userId = req.user!.id;
    const badgeId = parseInt(req.params.id ?? "", 10);

    await db
      .update(userBadgesTable)
      .set({ seen: true })
      .where(
        and(
          eq(userBadgesTable.id, badgeId),
          eq(userBadgesTable.userId, userId),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "badges seen error");
    res.status(500).json({ error: "Errore nell'aggiornamento del badge" });
  }
});

export default router;
