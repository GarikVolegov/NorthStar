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
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import {
  affiliateAccountsTable,
  affiliateCommissionsTable,
  affiliateReferralsTable,
  db,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { invalidatePlanCache } from "../middleware/check-feature";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";
import { logSecurityEvent } from "../lib/security-events";

const router = Router();
const log = rootLogger.child({ module: "subscription" });

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const SUBSCRIPTION_PLANS = ["pro", "team"] as const;

interface StripeLikeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

function affiliateCommissionPct(): number {
  const value = Number(process.env.AFFILIATE_COMMISSION_PCT ?? "20");
  return Number.isFinite(value) && value > 0 ? value : 20;
}

function affiliateReserveCents(): number {
  const value = Number(process.env.AFFILIATE_RESERVE_CENTS ?? "900");
  return Number.isInteger(value) && value > 0 ? value : 900;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function readSubscriptionId(obj: Record<string, unknown>): string | null {
  if (typeof obj.subscription === "string") return obj.subscription;
  if (
    obj.subscription &&
    typeof obj.subscription === "object" &&
    "id" in obj.subscription
  ) {
    const id = (obj.subscription as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function normalizeStripeEvent(value: unknown): StripeLikeEvent | null {
  const event = asPlainRecord(value);
  const data = asPlainRecord(event.data);
  const object = asPlainRecord(data.object);
  return typeof event.type === "string" && Object.keys(object).length > 0
    ? { type: event.type, data: { object } }
    : null;
}

function readMetadata(value: unknown): Record<string, string> {
  const metadata = asPlainRecord(value);
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function readSubscriptionPriceId(
  obj: Record<string, unknown>,
): string | undefined {
  const items = asPlainRecord(obj.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const firstItem = asPlainRecord(data[0]);
  const price = asPlainRecord(firstItem.price);
  return typeof price.id === "string" ? price.id : undefined;
}

async function findUserIdByStripeSubscription(
  subId: string,
): Promise<number | null> {
  const [subscription] = await db
    .select({ userId: subscriptionsTable.userId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeSubscriptionId, subId))
    .limit(1);

  if (subscription?.userId) return subscription.userId;

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.stripeSubscriptionId, subId))
    .limit(1);

  return user?.id ?? null;
}

async function applyAffiliateCommissionForInvoice(
  obj: Record<string, unknown>,
): Promise<void> {
  const invoiceId = typeof obj.id === "string" ? obj.id : null;
  const subId = readSubscriptionId(obj);
  const amountPaid = Number(obj.amount_paid ?? 0);

  if (
    !invoiceId ||
    !subId ||
    !Number.isInteger(amountPaid) ||
    amountPaid <= 0
  ) {
    log.debug(
      { invoiceId, subId, amountPaid },
      "[subscription] invoice.paid skipped for affiliate commission",
    );
    return;
  }

  const referredUserId = await findUserIdByStripeSubscription(subId);
  if (!referredUserId) {
    log.debug(
      { invoiceId, subId },
      "[subscription] invoice.paid has no local subscription user",
    );
    return;
  }

  const rate = affiliateCommissionPct();
  const commissionCents = Math.round((amountPaid * rate) / 100);
  if (commissionCents <= 0) return;

  const paidAt =
    typeof obj.created === "number" ? new Date(obj.created * 1000) : new Date();
  const reserveCents = affiliateReserveCents();

  await db.transaction(async (tx) => {
    const [referral] = await tx
      .select({
        affiliateId: affiliateReferralsTable.affiliateId,
        referredUserId: affiliateReferralsTable.referredUserId,
        status: affiliateReferralsTable.status,
      })
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.referredUserId, referredUserId))
      .limit(1);

    if (!referral || referral.status === "cancelled") return;

    const [account] = await tx
      .select({
        id: affiliateAccountsTable.id,
        status: affiliateAccountsTable.status,
        lockedBalance: affiliateAccountsTable.lockedBalance,
      })
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.id, referral.affiliateId))
      .limit(1);

    if (!account || account.status === "suspended") return;

    const lockedRoom = Math.max(0, reserveCents - account.lockedBalance);
    const lockedAdd = Math.min(commissionCents, lockedRoom);
    const withdrawableAdd = commissionCents - lockedAdd;
    const appliedTo = withdrawableAdd > 0 ? "withdrawable" : "locked";

    const inserted = await tx
      .insert(affiliateCommissionsTable)
      .values({
        affiliateId: account.id,
        referredUserId: referral.referredUserId,
        amountCents: commissionCents,
        stripeInvoiceId: invoiceId,
        sourceAmountCents: amountPaid,
        commissionRatePct: Math.round(rate),
        month: monthKey(paidAt),
        appliedTo,
        status: "applied",
        appliedAt: new Date(),
      })
      .onConflictDoNothing({
        target: affiliateCommissionsTable.stripeInvoiceId,
      })
      .returning({ id: affiliateCommissionsTable.id });

    if (inserted.length === 0) return;

    await tx
      .update(affiliateAccountsTable)
      .set({
        lockedBalance: sql`${affiliateAccountsTable.lockedBalance} + ${lockedAdd}`,
        withdrawableBalance: sql`${affiliateAccountsTable.withdrawableBalance} + ${withdrawableAdd}`,
        totalEarned: sql`${affiliateAccountsTable.totalEarned} + ${commissionCents}`,
        updatedAt: new Date(),
      })
      .where(eq(affiliateAccountsTable.id, account.id));
  });

  log.info(
    { invoiceId, subId, referredUserId, commissionCents, rate },
    "[subscription] affiliate commission applied",
  );
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

    case "customer.subscription.updated": {
      const subId = typeof obj.id === "string" ? obj.id : "";
      const status = typeof obj.status === "string" ? obj.status : "";
      const currentPeriodEnd = Number(obj.current_period_end);
      const periodEnd = Number.isFinite(currentPeriodEnd)
        ? currentPeriodEnd * 1000
        : Date.now();
      const priceId = readSubscriptionPriceId(obj);

      // Determina il piano dal price ID (configurabile via env)
      const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID;
      const plan = priceId && priceId === teamPriceId ? "team" : "pro";

      const [updated] = await db
        .update(subscriptionsTable)
        .set({
          plan: status === "active" ? plan : "free",
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
