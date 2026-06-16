/**
 * subscription.ts — gestione piano abbonamento e Stripe checkout/webhook.
 *
 * GET  /api/subscription              — piano corrente dell'utente (auth)
 * GET  /api/subscription/plans        — catalogo piani + prezzi (pubblico)
 * POST /api/subscription/upgrade      — crea Checkout Session Stripe (auth)
 * POST /api/subscription/cancel       — disdetta a fine periodo (auth)
 * GET  /api/subscription/billing-portal — Stripe Billing Portal (auth)
 * POST /api/subscription/webhook      — Stripe webhook (raw body, no auth)
 *
 * SECURITY:
 *   - webhook verificato con stripe-signature
 *   - userId mai dal body del webhook — sempre da Stripe metadata / JWT
 *   - stripeCustomerId/stripeSubscriptionId mai restituiti al client
 */
import { Router, type Request, type Response } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { invalidatePlanCache } from "../middleware/check-feature";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";
import { logSecurityEvent } from "../lib/security-events";
import {
  getStripe,
  getPlanCatalog,
  priceIdFor,
  planForPriceId,
  PAID_PLANS,
  BILLING_INTERVALS,
  type PaidPlan,
  type BillingInterval,
} from "../lib/stripe";
import {
  type StripeLikeEvent,
  applyAffiliateCommissionForInvoice,
  normalizeStripeEvent,
  readMetadata,
  readSubscriptionId,
  readSubscriptionPriceId,
} from "../lib/stripe-webhook-helpers";

const router = Router();
const log = rootLogger.child({ module: "subscription" });

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const SUBSCRIPTION_PLANS = ["pro", "team"] as const;

/**
 * Base URL del frontend per success/cancel/return URL.
 * Ordine: APP_BASE_URL → primo di ALLOWED_ORIGINS → fallback locale.
 * Un solo helper, niente localhost hardcoded sparsi.
 */
function webBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed[0]) return allowed[0].replace(/\/+$/, "");

  return "http://localhost:5173";
}

// ── GET /api/subscription ─────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const [sub] = await db
      .select({
        plan: subscriptionsTable.plan,
        validUntil: subscriptionsTable.validUntil,
        cancelledAt: subscriptionsTable.cancelledAt,
        createdAt: subscriptionsTable.createdAt,
      })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          isNull(subscriptionsTable.cancelledAt),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    const effectivePlan =
      sub?.validUntil && sub.validUntil < new Date()
        ? "free"
        : (sub?.plan ?? "free");

    res.json({
      plan: effectivePlan,
      validUntil: sub?.validUntil?.toISOString() ?? null,
      cancelledAt: sub?.cancelledAt?.toISOString() ?? null,
    });
  } catch (e) {
    log.error({ e, userId }, "[subscription] get error");
    res.status(500).json({ error: "Errore nel recupero abbonamento" });
  }
});

// ── GET /api/subscription/plans ───────────────────────────────────────────────
// Pubblico — catalogo piani + prezzi per la FE (niente prezzi hardcoded lato web).

router.get("/plans", (_req, res) => {
  const plans = getPlanCatalog().map((p) => ({
    plan: p.plan,
    interval: p.interval,
    priceId: p.priceId ?? null,
    amountEur: p.amountEur,
  }));
  res.json({ plans });
});

// ── POST /api/subscription/upgrade ────────────────────────────────────────────
// Crea una Stripe Checkout Session per (plan, interval) e ritorna l'URL.

router.post("/upgrade", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email;
  const body = asPlainRecord(getRequestBody(req));

  const plan = isOneOf(body.plan, PAID_PLANS) ? (body.plan as PaidPlan) : null;
  const interval = isOneOf(body.interval, BILLING_INTERVALS)
    ? (body.interval as BillingInterval)
    : null;

  if (!plan || !interval) {
    res.status(400).json({
      error: "Parametri non validi: plan ∈ {pro,team}, interval ∈ {monthly,yearly}",
    });
    return;
  }

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    log.error({ plan, interval }, "[subscription] missing Stripe price ID");
    res
      .status(503)
      .json({ error: "Piano non disponibile al momento. Riprova più tardi." });
    return;
  }

  try {
    // Riusa lo stripeCustomerId se l'utente ha già una subscription Stripe.
    const [existing] = await db
      .select({ stripeCustomerId: subscriptionsTable.stripeCustomerId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    const baseUrl = webBaseUrl();
    const metadata = {
      userId: String(userId),
      plan,
      interval,
    };

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      ...(existing?.stripeCustomerId
        ? { customer: existing.stripeCustomerId }
        : { customer_email: userEmail }),
      success_url: `${baseUrl}/premium-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/premium`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      log.error({ userId, plan, interval }, "[subscription] checkout session no URL");
      res.status(502).json({ error: "Impossibile avviare il pagamento" });
      return;
    }

    log.info({ userId, plan, interval }, "[subscription] checkout session created");
    res.json({ url: session.url });
  } catch (e) {
    log.error({ e, userId, plan, interval }, "[subscription] upgrade error");
    res.status(500).json({ error: "Errore nella creazione del checkout" });
  }
});

// ── POST /api/subscription/cancel ─────────────────────────────────────────────
// Disdetta a fine periodo. Il webhook riconcilia lo stato DB.

router.post("/cancel", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const [sub] = await db
      .select({ stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId })
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          isNull(subscriptionsTable.cancelledAt),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!sub?.stripeSubscriptionId) {
      res.status(404).json({ error: "Nessun abbonamento attivo da disdire" });
      return;
    }

    const updated = await getStripe().subscriptions.update(
      sub.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    // Stripe API v22 (Basil): current_period_end vive sui subscription item.
    const periodEndUnix = updated.items.data[0]?.current_period_end;

    log.info({ userId }, "[subscription] cancel at period end requested");
    res.json({
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
    });
  } catch (e) {
    log.error({ e, userId }, "[subscription] cancel error");
    res.status(500).json({ error: "Errore nella disdetta dell'abbonamento" });
  }
});

// ── GET /api/subscription/billing-portal ──────────────────────────────────────
// Crea una sessione Stripe Billing Portal e ritorna l'URL.

router.get("/billing-portal", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const [sub] = await db
      .select({ stripeCustomerId: subscriptionsTable.stripeCustomerId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      res.status(404).json({ error: "Nessun profilo di fatturazione disponibile" });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${webBaseUrl()}/profilo`,
    });

    res.json({ url: session.url });
  } catch (e) {
    log.error({ e, userId }, "[subscription] billing-portal error");
    res.status(500).json({ error: "Errore nell'apertura del portale di fatturazione" });
  }
});

// ── POST /api/subscription/webhook ───────────────────────────────────────────
// Stripe webhook — richiede raw body (configurato in app.ts prima di express.json())

router.post("/webhook", async (req: Request, res: Response) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    log.warn(
      "[subscription] STRIPE_WEBHOOK_SECRET not set — skipping signature verification",
    );
  }

  let event: StripeLikeEvent;

  try {
    const rawBody = getRequestBody(req);
    // Verifica firma Stripe (in produzione)
    if (STRIPE_WEBHOOK_SECRET) {
      if (!Buffer.isBuffer(rawBody) && typeof rawBody !== "string") {
        throw new Error("Stripe webhook requires raw body");
      }
      const stripe = await import("stripe").then(
        (m) => new m.default(process.env.STRIPE_SECRET_KEY ?? ""),
      );
      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string")
        throw new Error("Missing stripe-signature header");
      const parsedEvent = normalizeStripeEvent(
        stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET),
      );
      if (!parsedEvent) throw new Error("Invalid Stripe event shape");
      event = parsedEvent;
    } else {
      const parsedBody: unknown =
        Buffer.isBuffer(rawBody) || typeof rawBody === "string"
          ? JSON.parse(rawBody.toString())
          : rawBody;
      const parsedEvent = normalizeStripeEvent(parsedBody);
      if (!parsedEvent) throw new Error("Invalid Stripe event shape");
      event = parsedEvent;
    }
  } catch (e) {
    logSecurityEvent("invalid_webhook_signature", {
      ip: req.ip,
      detail: "stripe_subscription_webhook",
    });
    log.warn({ e }, "[subscription] webhook signature invalid");
    res.status(400).send("Webhook signature invalid");
    return;
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (e) {
    log.error(
      { e, eventType: event.type },
      "[subscription] webhook handler error",
    );
    res.status(500).json({ error: "Handler error" });
  }
});

// ── Stripe event handlers ─────────────────────────────────────────────────────

async function handleStripeEvent(event: StripeLikeEvent): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const subId =
        typeof obj.subscription === "string" ? obj.subscription : "";
      const metadata = readMetadata(obj.metadata);
      const userId = metadata.userId ? parseInt(metadata.userId) : null;
      const plan = isOneOf(metadata.plan, SUBSCRIPTION_PLANS)
        ? metadata.plan
        : "pro";

      if (!userId || !subId) {
        log.warn(
          { obj },
          "[subscription] checkout.session.completed missing userId or subId",
        );
        return;
      }

      // Crea/aggiorna subscription
      await db
        .insert(subscriptionsTable)
        .values({
          userId,
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          validUntil: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), // +31 giorni
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.stripeSubscriptionId,
          set: { plan, updatedAt: new Date() },
        });

      // Aggiorna stripeSubscriptionId su users per backward compat
      await db
        .update(usersTable)
        .set({ stripeSubscriptionId: subId, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));

      invalidatePlanCache(userId);

      if (
        typeof obj.invoice === "string" &&
        typeof obj.amount_total === "number" &&
        obj.amount_total > 0
      ) {
        await applyAffiliateCommissionForInvoice({
          id: obj.invoice,
          subscription: subId,
          amount_paid: obj.amount_total,
          created: obj.created,
        });
      }

      log.info(
        { userId, plan, subId },
        "[subscription] checkout completed → plan upgraded",
      );
      break;
    }

    case "invoice.paid": {
      await applyAffiliateCommissionForInvoice(obj);
      break;
    }

    case "invoice.payment_failed": {
      // Pagamento fallito → downgrade a free (mirror di subscription.deleted).
      // Il userId si risolve dalla subscription, mai dal body.
      const subId = readSubscriptionId(obj);
      if (!subId) {
        log.warn({ obj }, "[subscription] invoice.payment_failed without subscription");
        break;
      }

      const [downgraded] = await db
        .update(subscriptionsTable)
        .set({ plan: "free", updatedAt: new Date() })
        .where(eq(subscriptionsTable.stripeSubscriptionId, subId))
        .returning({ userId: subscriptionsTable.userId });

      if (downgraded?.userId) invalidatePlanCache(downgraded.userId);
      log.warn(
        { subId },
        "[subscription] invoice.payment_failed → downgraded to free",
      );
      break;
    }

    case "customer.subscription.updated": {
      const subId = typeof obj.id === "string" ? obj.id : "";
      const status = typeof obj.status === "string" ? obj.status : "";
      const currentPeriodEnd = Number(obj.current_period_end);
      const periodEnd = Number.isFinite(currentPeriodEnd)
        ? currentPeriodEnd * 1000
        : Date.now();
      const priceId = readSubscriptionPriceId(obj);

      // Determina il piano dal price ID via mappa configurata.
      // Fallback alla subscription metadata se il price non è mappato.
      const metaPlan = readMetadata(obj.metadata).plan;
      const mappedPlan = planForPriceId(priceId);
      const plan =
        mappedPlan !== "free"
          ? mappedPlan
          : isOneOf(metaPlan, SUBSCRIPTION_PLANS)
            ? metaPlan
            : "pro";

      const [updated] = await db
        .update(subscriptionsTable)
        .set({
          plan: status === "active" ? plan : "free",
          stripePriceId: priceId ?? null,
          validUntil: new Date(periodEnd),
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.stripeSubscriptionId, subId))
        .returning({ userId: subscriptionsTable.userId });

      if (updated?.userId) invalidatePlanCache(updated.userId);
      log.info({ subId, plan, status }, "[subscription] subscription.updated");
      break;
    }

    case "customer.subscription.deleted": {
      const subId = typeof obj.id === "string" ? obj.id : "";
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
      log.info(
        { subId },
        "[subscription] subscription.deleted → downgraded to free",
      );
      break;
    }

    default:
      log.debug(
        { eventType: event.type },
        "[subscription] unhandled Stripe event",
      );
  }
}

export default router;
