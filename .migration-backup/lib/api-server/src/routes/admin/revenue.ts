/**
 * Admin — Revenue & Stripe Orders
 *
 * GET /api/admin/revenue          → lista charges Stripe (paginata, max 100)
 * GET /api/admin/revenue/summary  → totali aggregati (MRR, total revenue, order count)
 *
 * Se STRIPE_SECRET_KEY non è configurato risponde con dati vuoti + messaggio.
 */
import { Router, Request, Response } from "express";

const router = Router();

async function getStripe() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  const Stripe = (await import("stripe")).default;
  return new Stripe(key);
}

// ── GET /summary ─────────────────────────────────────────────────────────────

router.get("/summary", async (_req: Request, res: Response): Promise<void> => {
  const stripe = await getStripe();
  if (!stripe) {
    res.json({ configured: false, totalRevenue: 0, orderCount: 0, mrr: 0 });
    return;
  }
  try {
    const [charges, subs] = await Promise.all([
      stripe.charges.list({ limit: 100 }),
      stripe.subscriptions.list({ limit: 100, status: "active" }),
    ]);
    const totalRevenue = charges.data
      .filter((c) => c.status === "succeeded")
      .reduce((s, c) => s + c.amount, 0) / 100;
    const mrr = subs.data
      .reduce((s, sub) => {
        const item = sub.items.data[0];
        const price = item?.price;
        if (!price?.unit_amount) return s;
        const monthly =
          price.recurring?.interval === "year"
            ? price.unit_amount / 12
            : price.unit_amount;
        return s + monthly;
      }, 0) / 100;
    res.json({
      configured: true,
      totalRevenue,
      orderCount: charges.data.filter((c) => c.status === "succeeded").length,
      mrr,
      activeSubscriptions: subs.data.length,
    });
  } catch (err) {
    console.error("[admin/revenue/summary]", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

// ── GET / — lista charges ────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const stripe = await getStripe();
  if (!stripe) {
    res.json({ configured: false, orders: [] });
    return;
  }
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const startingAfter = req.query["starting_after"] ? String(req.query["starting_after"]) : undefined;
  try {
    const charges = await stripe.charges.list({
      limit,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const orders = charges.data.map((c) => ({
      id:          c.id,
      amount:      c.amount / 100,
      currency:    c.currency.toUpperCase(),
      status:      c.status,
      customerEmail: c.billing_details?.email ?? null,
      description: c.description ?? null,
      createdAt:   new Date(c.created * 1000).toISOString(),
    }));
    res.json({ configured: true, orders, hasMore: charges.has_more });
  } catch (err) {
    console.error("[admin/revenue]", err);
    res.status(500).json({ error: "Stripe error" });
  }
});

export default router;
