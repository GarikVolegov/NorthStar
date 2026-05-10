/**
 * GET /api/admin/stats
 *
 * Route aggregata che restituisce in un'unica chiamata tutte le KPI
 * necessarie alla dashboard admin:
 *   - totalUsers        : utenti totali registrati
 *   - newUsersToday     : nuovi utenti nelle ultime 24 ore
 *   - activeUsersWeek   : utenti con lastActiveAt negli ultimi 7 giorni
 *   - totalSessions     : sessioni di coaching totali
 *   - discoveryItems    : discovery items nel DB
 *   - discoverySources  : fonti discovery attive
 *
 * Stripe (revenue, orders) è incluso in modo graceful:
 * se STRIPE_SECRET_KEY non è presente, i valori sono null.
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { coachSessionsTable } from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import { discoverySourcesTable } from "@workspace/db";
import { sql, gte, eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      [{ total: totalUsers }],
      [{ total: newUsersToday }],
      [{ total: activeUsersWeek }],
      [{ total: totalSessions }],
      [{ total: discoveryItems }],
      [{ total: discoverySources }],
    ] = await Promise.all([
      db.select({ total: sql<number>`count(*)::int` }).from(usersTable),
      db.select({ total: sql<number>`count(*)::int` }).from(usersTable)
        .where(gte(usersTable.createdAt, yesterday)),
      db.select({ total: sql<number>`count(*)::int` }).from(usersTable)
        .where(gte(usersTable.lastActiveAt, lastWeek)),
      db.select({ total: sql<number>`count(*)::int` }).from(coachSessionsTable),
      db.select({ total: sql<number>`count(*)::int` }).from(discoveryItemsTable),
      db.select({ total: sql<number>`count(*)::int` }).from(discoverySourcesTable)
        .where(eq(discoverySourcesTable.enabled, true)),
    ]);

    // Stripe — graceful fallback se non configurato
    let stripeRevenue: number | null = null;
    let stripeOrders:  number | null = null;
    if (process.env["STRIPE_SECRET_KEY"]) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);
        const charges = await stripe.charges.list({ limit: 100 });
        stripeOrders  = charges.data.length;
        stripeRevenue = charges.data
          .filter((c) => c.status === "succeeded")
          .reduce((sum, c) => sum + c.amount, 0) / 100;
      } catch {
        // Stripe non disponibile — lasciamo null
      }
    }

    res.json({
      totalUsers,
      newUsersToday,
      activeUsersWeek,
      totalSessions,
      discoveryItems,
      discoverySources,
      stripeRevenue,
      stripeOrders,
      fetchedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
