/**
 * subscription.ts — gestione piano abbonamento e Stripe webhook.
 *
 * GET  /api/subscription        — piano corrente dell'utente
 * POST /api/subscription/webhook — Stripe webhook (raw body)
 *
 * SECURITY:
 *   - webhook verificato con stripe-signature
 *   - userId mai dal body del webhook — sempre da Stripe metadata
 *   - stripeCustomerId mai restituito al client
 */
import { Router, type Request, type Response } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { invalidatePlanCache } from "../middleware/check-feature";

const router = Router();
const log    = rootLogger.child({ module: "subscription" });

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// ── GET /api/subscription ─────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const [sub] = await db
      .select({
        plan:        subscriptionsTable.plan,
        validUntil:  subscriptionsTable.validUntil,
        cancelledAt: subscriptionsTable.cancelledAt,
        createdAt:   subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .where(and(
        eq(subscriptionsTable.userId, userId),
        isNull(subscriptionsTable.cancelledAt),
      ))
      .orderBy(subscriptionsTable.createdAt)
      .limit(1);

    const effectivePlan = (sub?.validUntil && sub.validUntil < new Date())
      ? "free"
      : (sub?.plan ?? "free");

    res.json({
      plan:        effectivePlan,
      validUntil:  sub?.validUntil?.toISOString() ?? null,
      cancelledAt: sub?.cancelledAt?.toISOString() ?? null,
    });
  } catch (e) {
    log.error({ e, userId }, "[subscription] get error");
    res.status(500).json({ error: "Errore nel recupero abbonamento" });
  }
});

// ── POST /api/subscription/webhook ───────────────────────────────────────────
// Stripe webhook — richiede raw body (configurato in app.ts prima di express.json())

router.post(
  "/webhook",
  async (req: Request, res: Response) => {
    if (!STRIPE_WEBHOOK_SECRET) {
      log.warn("[subscription] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    }

    let event: { type: string; data: { object: Record<string, unknown> } };

    try {
      // Verifica firma Stripe (in produzione)
      if (STRIPE_WEBHOOK_SECRET) {
        const stripe = await import("stripe").then((m) => new m.default(process.env.STRIPE_SECRET_KEY ?? ""));
        const sig = req.headers["stripe-signature"] as string;
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET) as any;
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (e) {
      log.warn({ e }, "[subscription] webhook signature invalid");
      res.status(400).send("Webhook signature invalid");
      return;
    }

    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (e) {
      log.error({ e, eventType: event.type }, "[subscription] webhook handler error");
      res.status(500).json({ error: "Handler error" });
    }
  },
);

// ── Stripe event handlers ─────────────────────────────────────────────────────

async function handleStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const customerId  = obj.customer as string;
      const subId       = obj.subscription as string;
      const metadata    = (obj.metadata ?? {}) as Record<string, string>;
      const userId      = metadata.userId ? parseInt(metadata.userId) : null;
      const plan        = (metadata.plan ?? "pro") as "pro" | "team";

      if (!userId || !subId) {
        log.warn({ obj }, "[subscription] checkout.session.completed missing userId or subId");
        return;
      }

      // Crea/aggiorna subscription
      await db
        .insert(subscriptionsTable)
        .values({
          userId,
          plan,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subId,
          validUntil:           new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // +31 giorni
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.stripeSubscriptionId,
          set: { plan, updatedAt: new Date() },
        } as any);

      // Aggiorna stripeSubscriptionId su users per backward compat
      await db
        .update(usersTable)
        .set({ stripeSubscriptionId: subId, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));

      invalidatePlanCache(userId);
      log.info({ userId, plan, subId }, "[subscription] checkout completed → plan upgraded");
      break;
    }

    case "customer.subscription.updated": {
      const subId    = obj.id as string;
      const status   = obj.status as string;
      const periodEnd = (obj.current_period_end as number) * 1000;
      const priceId  = (obj.items as any)?.data?.[0]?.price?.id as string | undefined;

      // Determina il piano dal price ID (configurabile via env)
      const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID;
      const plan = (priceId && priceId === teamPriceId) ? "team" : "pro";

      const [updated] = await db
        .update(subscriptionsTable)
        .set({
          plan:        status === "active" ? plan : "free",
          validUntil:  new Date(periodEnd),
          updatedAt:   new Date(),
        })
        .where(eq(subscriptionsTable.stripeSubscriptionId, subId))
        .returning({ userId: subscriptionsTable.userId });

      if (updated?.userId) invalidatePlanCache(updated.userId);
      log.info({ subId, plan, status }, "[subscription] subscription.updated");
      break;
    }

    case "customer.subscription.deleted": {
      const subId = obj.id as string;
      const [cancelled] = await db
        .update(subscriptionsTable)
        .set({ cancelledAt: new Date(), plan: "free", updatedAt: new Date() })
        .where(eq(subscriptionsTable.stripeSubscriptionId, subId))
        .returning({ userId: subscriptionsTable.userId });

      if (cancelled?.userId) {
        invalidatePlanCache(cancelled.userId);
        // Rimuovi stripeSubscriptionId da users
        await db
          .update(usersTable)
          .set({ stripeSubscriptionId: null, updatedAt: new Date() })
          .where(eq(usersTable.id, cancelled.userId));
      }
      log.info({ subId }, "[subscription] subscription.deleted → downgraded to free");
      break;
    }

    default:
      log.debug({ eventType: event.type }, "[subscription] unhandled Stripe event");
  }
}

export default router;
