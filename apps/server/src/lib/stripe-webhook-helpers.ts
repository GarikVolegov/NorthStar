/**
 * stripe-webhook-helpers.ts — parsing degli eventi Stripe + logica commissioni
 * affiliato applicata sulle invoice pagate.
 *
 * Estratto da routes/subscription.ts per tenere il file route sotto la soglia
 * di dimensione e isolare la logica commissioni (concern separato dalla
 * gestione abbonamento). Gli userId/subId sono sempre derivati dai dati Stripe,
 * mai dal client.
 */
import { eq, sql } from "drizzle-orm";
import {
  affiliateAccountsTable,
  affiliateCommissionsTable,
  affiliateReferralsTable,
  db,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { rootLogger } from "../middleware/logger";
import { asPlainRecord } from "./type-guards";

const log = rootLogger.child({ module: "subscription-webhook" });

export interface StripeLikeEvent {
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

export function readSubscriptionId(obj: Record<string, unknown>): string | null {
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

export function normalizeStripeEvent(value: unknown): StripeLikeEvent | null {
  const event = asPlainRecord(value);
  const data = asPlainRecord(event.data);
  const object = asPlainRecord(data.object);
  return typeof event.type === "string" && Object.keys(object).length > 0
    ? { type: event.type, data: { object } }
    : null;
}

export function readMetadata(value: unknown): Record<string, string> {
  const metadata = asPlainRecord(value);
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function readSubscriptionPriceId(
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

export async function applyAffiliateCommissionForInvoice(
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
