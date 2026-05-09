/**
 * affiliate-tracking.ts — Passo 5: tracking referral cookie + linkReferral.
 *
 * FLUSSO COMPLETO:
 *
 *   1. Visitatore arriva su /signup?ref=ABCD1234
 *   2. Frontend chiama saveReferralCode('ABCD1234') → salva cookie 'ns_ref'
 *      (30 giorni, SameSite=Lax)
 *   3. Al submit del form di signup, frontend legge getReferralCode() e
 *      invia { referralCode: 'ABCD1234' } nel body della POST /api/auth/signup
 *   4. Il route handler chiama linkReferral(newUserId, 'ABCD1234') DOPO
 *      aver creato l'utente
 *   5. linkReferral:
 *      a. Trova affiliateAccount via referralCode
 *      b. Setta users.referred_by_affiliate_id + incrementa total_referrals
 *         in una singola db.transaction (atomico, no race condition)
 *      c. Se l'utente è già abbonato (edge case OAuth): triggera commissione
 *
 * SERVER MIDDLEWARE:
 *   saveRefCookie(req, res): se req.query.ref esiste, setta il cookie.
 *   Montalo come middleware su GET /signup e GET /join.
 *
 * CLIENT HELPERS (browser):
 *   saveReferralCode(code) — scrive il cookie
 *   getReferralCode()      — legge il cookie
 *   clearReferralCode()    — rimuove il cookie dopo il signup
 *
 * INTEGRITÀ:
 *   linkReferral usa db.transaction per garantire che il collegamento
 *   utente-affiliato e l'incremento del contatore siano atomici.
 *   L'UPDATE su users usa una WHERE condizionale (referredByAffiliateId IS NULL)
 *   come guard a livello DB contro doppie scritture concorrenti.
 */
import { db } from "@workspace/db";
import {
  affiliateAccountsTable,
  usersTable,
} from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

// ── Constants ───────────────────────────────────────────────────────────────────

export const REF_COOKIE_NAME    = "ns_ref";
export const REF_COOKIE_DAYS    = 30;
export const REF_CODE_MAX_LEN   = 20;

// ── Server middleware ───────────────────────────────────────────────────────────

/**
 * Express middleware: se ?ref=CODE è presente nella query string,
 * setta il cookie ns_ref per 30 giorni.
 */
export function saveRefCookie(req: Request, res: Response, next: NextFunction): void {
  const code = req.query.ref;
  if (typeof code === "string" && code.length > 0 && code.length <= REF_CODE_MAX_LEN) {
    const sanitized = code.replace(/[^a-zA-Z0-9]/g, "");
    if (sanitized.length > 0) {
      res.cookie(REF_COOKIE_NAME, sanitized, {
        maxAge:   REF_COOKIE_DAYS * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: "lax",
        secure:   process.env.NODE_ENV === "production",
      });
    }
  }
  next();
}

/**
 * Legge il referral code dalla request (priorità: body > query > cookie).
 */
export function extractRefCode(req: Request): string | null {
  const fromBody   = typeof req.body?.referralCode === "string" ? req.body.referralCode : null;
  const fromQuery  = typeof req.query.ref === "string"          ? req.query.ref         : null;
  const fromCookie = typeof req.cookies?.[REF_COOKIE_NAME] === "string"
    ? req.cookies[REF_COOKIE_NAME] : null;

  const raw = fromBody ?? fromQuery ?? fromCookie ?? null;
  if (!raw) return null;
  const sanitized = raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, REF_CODE_MAX_LEN);
  return sanitized.length > 0 ? sanitized.toUpperCase() : null;
}

// ── Core: linkReferral ────────────────────────────────────────────────────────────

export interface LinkReferralResult {
  linked:        boolean;
  affiliateId?:  number;
  reason?:       string;
}

/**
 * Collega un nuovo utente al suo affiliato in modo atomico.
 *
 * RACE CONDITION FIX:
 *   Il vecchio codice eseguiva:
 *     1. SELECT per verificare che l'utente non fosse già collegato
 *     2. UPDATE per impostare referredByAffiliateId
 *     3. UPDATE per incrementare totalReferrals
 *   Tra i passi 1 e 2 una seconda richiesta concorrente (es. doppio
 *   submit del form) poteva passare il check e scrivere due volte.
 *
 *   La nuova versione usa db.transaction con un UPDATE condizionale:
 *     WHERE referred_by_affiliate_id IS NULL
 *   Se rowCount = 0, un'altra transazione ha già effettuato il collegamento
 *   e usciamo senza modificare totalReferrals. L'intero blocco è atomico.
 *
 * @param newUserId     ID del nuovo utente appena creato
 * @param referralCode  codice letto da extractRefCode(req)
 */
export async function linkReferral(
  newUserId:    number,
  referralCode: string,
): Promise<LinkReferralResult> {
  if (!referralCode) return { linked: false, reason: "no_code" };

  // Trova l'account affiliato (operazione di sola lettura, fuori dalla tx)
  const affiliate = await db
    .select({ id: affiliateAccountsTable.id, userId: affiliateAccountsTable.userId })
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.referralCode, referralCode.toUpperCase()))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!affiliate) return { linked: false, reason: "code_not_found" };
  if (affiliate.userId === newUserId) return { linked: false, reason: "self_referral" };

  // Transazione atomica: collega l'utente E incrementa il contatore
  // in un'unica operazione. La WHERE ... IS NULL previene doppi link.
  const linked = await db.transaction(async (tx) => {
    // UPDATE condizionale: scrive solo se l'utente non è già collegato
    const updateResult = await tx
      .update(usersTable)
      .set({ referredByAffiliateId: affiliate.id })
      .where(
        sql`${usersTable.id} = ${newUserId}
        AND ${usersTable.referredByAffiliateId} IS NULL
        AND ${newUserId} != ${affiliate.userId}`
      );

    // rowCount = 0 → utente già collegato (concorrenza) o auto-referral
    if ((updateResult.rowCount ?? 0) === 0) return false;

    // Incrementa contatore solo se il collegamento è avvenuto
    await tx
      .update(affiliateAccountsTable)
      .set({ totalReferrals: sql`total_referrals + 1` })
      .where(eq(affiliateAccountsTable.id, affiliate.id));

    return true;
  });

  if (!linked) return { linked: false, reason: "already_linked" };
  return { linked: true, affiliateId: affiliate.id };
}

// ── Client helpers (browser) ────────────────────────────────────────────────

export const clientRefTracking = {
  save(code: string): void {
    if (typeof document === "undefined") return;
    const sanitized = code.replace(/[^a-zA-Z0-9]/g, "").slice(0, REF_CODE_MAX_LEN);
    if (!sanitized) return;
    const expires = new Date(Date.now() + REF_COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = `${REF_COOKIE_NAME}=${sanitized}; expires=${expires}; path=/; SameSite=Lax`;
  },

  get(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REF_COOKIE_NAME}=([^;]*)`) );
    return match ? match[1] : null;
  },

  clear(): void {
    if (typeof document === "undefined") return;
    document.cookie = `${REF_COOKIE_NAME}=; Max-Age=0; path=/`;
  },
};
