import { Router } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { XP_REWARDS, XP_PER_LEVEL, xpProgress, DAILY_LIMITS } from "./xp-constants";

const router = Router();
router.use(requireAuth);

const XP_SOURCES = {
  chat_message: { xp: XP_REWARDS.CHAT_MESSAGE, limit: DAILY_LIMITS.CHAT_MESSAGES },
  daily_login: { xp: XP_REWARDS.DAILY_LOGIN, limit: 1 },
  objective_completed: { xp: XP_REWARDS.OBJECTIVE_COMPLETED, limit: 0 },
  assessment_completed: { xp: XP_REWARDS.ASSESSMENT_COMPLETED, limit: 0 },
} as const;

type XpSource = keyof typeof XP_SOURCES;

router.post("/award", async (req, res) => {
  try {
    const { source } = req.body as { source: XpSource };
    const userId = req.user!.id;

    const config = XP_SOURCES[source];
    if (!config) {
      res.status(400).json({ error: `Sorgente XP sconosciuta: ${source}` });
      return;
    }

    if (config.limit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, userId),
            sql`${usersTable.updatedAt} >= ${today.toISOString()}`,
          ),
        );

      if (Number(result?.count ?? 0) >= config.limit) {
        res.status(429).json({ error: `Limite giornaliero raggiunto per ${source}` });
        return;
      }
    }

    const [user] = await db
      .select({ totalXp: usersTable.totalXp })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const newTotalXp = (user?.totalXp ?? 0) + config.xp;
    await db
      .update(usersTable)
      .set({ totalXp: newTotalXp, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    const { level, current, next, progress } = xpProgress(newTotalXp);

    res.json({
      xpAwarded: config.xp,
      source,
      totalXp: newTotalXp,
      level,
      current,
      next,
      progress,
    });
  } catch (err) {
    req.log?.error?.({ err }, "xp award error");
    res.status(500).json({ error: "Errore nell'assegnazione XP" });
  }
});

export default router;
