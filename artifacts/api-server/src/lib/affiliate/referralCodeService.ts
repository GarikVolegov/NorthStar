/**
 * referralCodeService.ts
 * Vedi API_RULES.md + DB_RULES.md prima di modificare.
 *
 * Gestisce il ciclo di vita del codice referral:
 *   1. resolveReferralCode   → code → affiliateAccountId
 *   2. attachReferralToUser  → scrive referredByCode al signup (soft, non-blocking)
 *   3. processPostPaymentReferral → dopo invoice.paid, converte e chiama confirmReferral()
 */

import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { affiliateAccountsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { confirmReferral } from "./referralService.js";

// ---------------------------------------------------------------------------
// 1. Risolvi codice → affiliateAccountId
// ---------------------------------------------------------------------------

/**
 * Dato un codice referral (es. "NS-A-1234"), restituisce l'ID dell'account
 * affiliato corrispondente, oppure null se non trovato/inattivo.
 */
export async function resolveReferralCode(
  code: string
): Promise<number | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned.startsWith("NS-A-")) return null;

  const [account] = await db
    .select({ id: affiliateAccountsTable.id })
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.referralCode, cleaned))
    .limit(1);

  return account?.id ?? null;
}

// ---------------------------------------------------------------------------
// 2. Attach al signup — non-blocking
// ---------------------------------------------------------------------------

/**
 * Salva il codice raw su users.referredByCode subito dopo la registrazione.
 * Se il codice è già risolvibile, imposta anche referredByAffiliateId.
 * Non lancia mai eccezioni verso il caller: la registrazione non deve fallire
 * per un codice referral non valido.
 */
export async function attachReferralToUser(
  userId: number,
  rawCode: string
): Promise<void> {
  try {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned) return;

    const affiliateId = await resolveReferralCode(cleaned);

    await db
      .update(usersTable)
      .set({
        referredByCode: cleaned,
        // Se risolto subito, prenotiamo l'affiliateId — la conversione avviene
        // solo dopo il primo pagamento in processPostPaymentReferral.
        ...(affiliateId ? { referredByAffiliateId: affiliateId } : {}),
      })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    // Logga ma non propagare — la registrazione utente non deve essere bloccata
    console.error("[referralCodeService] attachReferralToUser failed", err);
  }
}

// ---------------------------------------------------------------------------
// 3. Post-payment: converti referral
// ---------------------------------------------------------------------------

/**
 * Chiamato dal webhook Stripe dopo invoice.paid.
 * Legge referredByAffiliateId dall'utente e invoca confirmReferral().
 * Idempotente: se referralConvertedAt è già impostato, non fa nulla.
 */
export async function processPostPaymentReferral(
  userId: number
): Promise<void> {
  const [user] = await db
    .select({
      referredByAffiliateId: usersTable.referredByAffiliateId,
      referredByCode: usersTable.referredByCode,
      referralConvertedAt: usersTable.referralConvertedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return;

  // Già convertito
  if (user.referralConvertedAt) return;

  // Prova a risolvere il codice se non abbiamo ancora l'affiliateId
  let affiliateId = user.referredByAffiliateId;
  if (!affiliateId && user.referredByCode) {
    affiliateId = await resolveReferralCode(user.referredByCode);
    if (affiliateId) {
      await db
        .update(usersTable)
        .set({ referredByAffiliateId: affiliateId })
        .where(eq(usersTable.id, userId));
    }
  }

  if (!affiliateId) return; // Nessun referral valido

  // Conferma il referral (crea affiliate_referrals + aggiorna balance)
  await confirmReferral({
    referrerId: affiliateId,
    referredUserId: userId,
    actorId: userId,
    ipAddress: "webhook",
  });

  // Marca conversione
  await db
    .update(usersTable)
    .set({ referralConvertedAt: new Date() })
    .where(eq(usersTable.id, userId));
}
