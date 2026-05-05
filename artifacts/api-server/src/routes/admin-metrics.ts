import { Router } from "express";
import { db, usersTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { sql, count, gte, and, isNotNull } from "drizzle-orm";

const router = Router();
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

function adminAuth(req: any, res: any, next: any) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(401).json({ error: "Non autorizzato" }); return;
  }
  next();
}

router.get("/admin/metrics", adminAuth, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(usersTable);
    const [{ newUsers30d }] = await db.select({ newUsers30d: count() }).from(usersTable).where(gte(usersTable.createdAt, thirtyDaysAgo));
    const [{ newUsers7d }] = await db.select({ newUsers7d: count() }).from(usersTable).where(gte(usersTable.createdAt, sevenDaysAgo));
    const [{ premiumUsers }] = await db.select({ premiumUsers: count() }).from(usersTable).where(isNotNull(usersTable.stripeSubscriptionId));

    const [{ totalTests }] = await db.select({ totalTests: count() }).from(testSessionsTable);
    const [{ testsWithUser }] = await db.select({ testsWithUser: count() }).from(testSessionsTable).where(isNotNull(testSessionsTable.userId));
    const [{ tests30d }] = await db.select({ tests30d: count() }).from(testSessionsTable).where(gte(testSessionsTable.createdAt, thirtyDaysAgo));

    const topSectors = await db
      .select({ sectorId: testSessionsTable.confirmedSectorId, count: count() })
      .from(testSessionsTable)
      .where(isNotNull(testSessionsTable.confirmedSectorId))
      .groupBy(testSessionsTable.confirmedSectorId)
      .orderBy(sql`count(*) DESC`)
      .limit(6);

    const sectors = await db.select({ id: sectorsTable.id, name: sectorsTable.name }).from(sectorsTable);
    const sectorMap = Object.fromEntries(sectors.map((s) => [s.id, s.name]));
    const topSectorsNamed = topSectors.map((s) => ({
      sectorId: s.sectorId,
      name: sectorMap[s.sectorId!] ?? `Settore ${s.sectorId}`,
      count: Number(s.count),
    }));

    const dailySignups = await db
      .select({
        day: sql<string>`date_trunc('day', ${usersTable.createdAt})::date::text`,
        count: count(),
      })
      .from(usersTable)
      .where(gte(usersTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', ${usersTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${usersTable.createdAt})`);

    const conversionRate = totalUsers > 0
      ? ((Number(premiumUsers) / Number(totalUsers)) * 100).toFixed(1)
      : "0.0";

    res.json({
      users: {
        total: Number(totalUsers),
        premium: Number(premiumUsers),
        new30d: Number(newUsers30d),
        new7d: Number(newUsers7d),
        conversionRate: parseFloat(conversionRate),
      },
      tests: {
        total: Number(totalTests),
        withUser: Number(testsWithUser),
        last30d: Number(tests30d),
        completionRate: totalTests > 0
          ? ((Number(testsWithUser) / Number(totalTests)) * 100).toFixed(1)
          : "0.0",
      },
      topSectors: topSectorsNamed,
      dailySignups: dailySignups.map((d) => ({ day: d.day, count: Number(d.count) })),
      revenue: null,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin-metrics]", err);
    res.status(500).json({ error: "Errore nel calcolo metriche" });
  }
});

export default router;
