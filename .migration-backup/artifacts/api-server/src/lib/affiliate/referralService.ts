/**
 * referralService.ts — Gestione referral confermati.
 *
 * ⚠️  REGOLA 0: vedi API_RULES.md + DB_RULES.md prima di modificare.
 *
 * Chiamato dal webhook Stripe invoice.paid quando:
 *   1. È il PRIMO pagamento di un nuovo utente
 *   2. L'utente si è registrato con un codice referral
 *
 * Idempotente: confirmReferral() con lo stesso referredUserId è no-op.
 */

import { db } from '@workspace/db';
import {
  affiliateAccountsTable,
  affiliateReferralsTable,
  auditLogTable,
  usersTable,
} from '@workspace/db/schema';
import { eq } from 'drizzle-orm';

export interface ConfirmReferralParams {
  /** userId di chi ha condiviso il codice */
  referrerUserId: number;
  /** userId di chi si è registrato tramite il codice */
  referredUserId: number;
  /** stripePaymentIntentId del primo pagamento — per idempotency */
  firstPaymentIntentId: string;
  ipAddress?: string;
}

export type ConfirmReferralResult =
  | 'confirmed'           // referral confermato per la prima volta
  | 'already_referred'    // questo utente è già stato referito — skip
  | 'referrer_not_found'; // il referrer non esiste

/**
 * Conferma un referral al primo pagamento Stripe del referred.
 *
 * Steps:
 *   1. Verifica che il referrer esista
 *   2. Crea l'account affiliato del referrer se non esiste
 *   3. Inserisce il referral (idempotente via UNIQUE su referredUserId)
 *   4. Incrementa totalReferrals sull'account affiliato
 *   5. Logga in audit
 */
export async function confirmReferral(
  params: ConfirmReferralParams,
): Promise<ConfirmReferralResult> {
  const { referrerUserId, referredUserId, firstPaymentIntentId, ipAddress } = params;

  return await db.transaction(async (tx) => {
    // ── Step 1: Verifica referrer ─────────────────────────────────────
    const [referrer] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, referrerUserId))
      .limit(1);

    if (!referrer) return 'referrer_not_found';

    // ── Step 2: Crea/trova account affiliato del referrer ─────────────
    let [affiliateAccount] = await tx
      .select()
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.userId, referrerUserId))
      .limit(1);

    if (!affiliateAccount) {
      // Crea account affiliato con codice unico
      const referralCode = generateReferralCode(referrerUserId);
      const [created] = await tx
        .insert(affiliateAccountsTable)
        .values({
          userId:      referrerUserId,
          referralCode,
          lockedBalance:       0,
          withdrawableBalance: 0,
          totalEarned:         0,
          totalReferrals:      0,
          status:              'active',
        })
        .returning();
      affiliateAccount = created;
    }

    // ── Step 3: Insert referral idempotente ───────────────────────────
    // Il UNIQUE su referred_user_id fa sì che inserimenti duplicati
    // (es. webhook duplicato) vengano ignorati silenziosamente.
    const inserted = await tx
      .insert(affiliateReferralsTable)
      .values({
        referrerUserId,
        referredUserId,
        affiliateId:          affiliateAccount.id,
        status:               'active',
        firstPaymentIntentId,
      })
      .onConflictDoNothing()
      .returning({ id: affiliateReferralsTable.id });

    if (inserted.length === 0) {
      return 'already_referred';
    }

    // ── Step 4: Incrementa totalReferrals ────────────────────────────
    await tx
      .update(affiliateAccountsTable)
      .set({
        totalReferrals: affiliateAccount.totalReferrals + 1,
        updatedAt:      new Date(),
      })
      .where(eq(affiliateAccountsTable.id, affiliateAccount.id));

    // ── Step 5: Audit log ─────────────────────────────────────────────
    await tx.insert(auditLogTable).values({
      actorId:  null, // sistema / webhook
      targetId: referrerUserId,
      action:   'affiliate_referral_confirmed',
      metadata: {
        referrerUserId,
        referredUserId,
        affiliateId:          affiliateAccount.id,
        firstPaymentIntentId,
      },
      ipAddress: ipAddress ?? null,
    });

    return 'confirmed';
  });
}

/**
 * Cancella un referral attivo (es. subscription deleted, refund).
 * Non elimina il record — lo marca come cancelled (audit trail).
 */
export async function cancelReferral(params: {
  referredUserId: number;
  reason:         string;
  actorId?:       number | null;
}): Promise<void> {
  const { referredUserId, reason, actorId = null } = params;

  await db.transaction(async (tx) => {
    const [referral] = await tx
      .select()
      .from(affiliateReferralsTable)
      .where(eq(affiliateReferralsTable.referredUserId, referredUserId))
      .limit(1);

    if (!referral || referral.status === 'cancelled') return;

    await tx
      .update(affiliateReferralsTable)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(affiliateReferralsTable.id, referral.id));

    await tx.insert(auditLogTable).values({
      actorId,
      targetId: referral.referrerUserId,
      action:   'referral_cancelled',
      metadata: { referredUserId, affiliateId: referral.affiliateId, reason },
    });
  });
}

/** Genera un codice referral unico basato su userId + timestamp. */
function generateReferralCode(userId: number): string {
  const base = userId.toString(36).toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase().slice(-4);
  return `NS-${base}-${suffix}`;
}
