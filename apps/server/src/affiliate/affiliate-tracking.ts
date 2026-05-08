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
 *      aver creato l’utente
 *   5. linkReferral:
 *      a. Trova affiliateAccount via referralCode
 *      b. Setta users.referred_by_affiliate_id
 *      c. Incrementa affiliate_accounts.total_referrals
 *      d. Se l’utente è già abbonato (edge case OAuth): triggera commissione
 *
 * SERVER MIDDLEWARE:
 *   saveRefCookie(req, res): se req.query.ref esiste, setta il cookie.
 *   Montalo come middleware su GET /signup e GET /join.
 *
 * CLIENT HELPERS (browser):
 *   saveReferralCode(code) — scrive il cookie
 *   getReferralCode()      — legge il cookie
 *   clearReferralCode()    — rimuove il cookie dopo il signup
 */
import { db } from "@workspace/db";
import {
  affiliateAccountsTable,
  usersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

// ── Constants ───────────────────────────────────────────────────────────────────

export const REF_COOKIE_NAME    = "ns_ref";
export const REF_COOKIE_DAYS    = 30;
export const REF_CODE_MAX_LEN   = 20;

// ── Server middleware ───────────────────────────────────────────────────────────

/**
 * Express middleware: se ?ref=CODE è presente nella query string,
 * setta il cookie ns_ref per 30 giorni.
 *
 * Uso:
 *   app.get('/signup', saveRefCookie, signupPageHandler);
 *   app.get('/join',   saveRefCookie, joinPageHandler);
 */
export function saveRefCookie(req: Request, res: Response, next: NextFunction): void {
  const code = req.query.ref;
  if (typeof code === "string" && code.length > 0 && code.length <= REF_CODE_MAX_LEN) {
    const sanitized = code.replace(/[^a-zA-Z0-9]/g, "");
    if (sanitized.length > 0) {
      res.cookie(REF_COOKIE_NAME, sanitized, {
        maxAge:   REF_COOKIE_DAYS * 24 * 60 * 60 * 1000,
        httpOnly: false,   // leggibile da JS lato client (per prefill form)
        sameSite: "lax",
        secure:   process.env.NODE_ENV === "production",
      });
    }
  }
  next();
}

/**
 * Legge il referral code dalla request (priorità: body > query > cookie).
 * Da usare nel route handler POST /api/auth/signup.
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
 * Collega un nuovo utente al suo affiliato.
 *
 * Da chiamare SUBITO dopo aver creato l’utente nel DB.
 * È idempotente: se l’utente ha già un referredByAffiliateId, non fa nulla.
 *
 * @param newUserId     ID del nuovo utente appena creato
 * @param referralCode  codice letto da extractRefCode(req)
 * @returns LinkReferralResult
 */
export async function linkReferral(
  newUserId:    number,
  referralCode: string,
): Promise<LinkReferralResult> {
  if (!referralCode) return { linked: false, reason: "no_code" };

  // 1. Trova l’account affiliato
  const affiliate = await db
    .select({ id: affiliateAccountsTable.id, userId: affiliateAccountsTable.userId })
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.referralCode, referralCode.toUpperCase()))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!affiliate) return { linked: false, reason: "code_not_found" };

  // 2. Evita auto-referral
  if (affiliate.userId === newUserId) return { linked: false, reason: "self_referral" };

  // 3. Controlla che l’utente non sia già collegato (idempotenza)
  const user = await db
    .select({ referredByAffiliateId: usersTable.referredByAffiliateId })
    .from(usersTable)
    .where(eq(usersTable.id, newUserId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (user?.referredByAffiliateId != null) {
    return { linked: false, reason: "already_linked" };
  }

  // 4. Collega l’utente all’affiliato
  await db
    .update(usersTable)
    .set({ referredByAffiliateId: affiliate.id })
    .where(eq(usersTable.id, newUserId));

  // 5. Incrementa il contatore referral totali
  await db
    .update(affiliateAccountsTable)
    .set({ totalReferrals: sql`total_referrals + 1` })
    .where(eq(affiliateAccountsTable.id, affiliate.id));

  return { linked: true, affiliateId: affiliate.id };
}

// ── Client helpers (browser, importabili nel frontend) ────────────────────────
// Questi NON usano Node.js — sono puro browser JS.

export const clientRefTracking = {
  /**
   * Scrive il cookie ns_ref.
   * Chiama questa funzione quando l’URL ha ?ref=CODE.
   *
   *   if (new URLSearchParams(location.search).get('ref'))
   *     clientRefTracking.save(new URLSearchParams(location.search).get('ref')!)
   */
  save(code: string): void {
    if (typeof document === "undefined") return;
    const sanitized = code.replace(/[^a-zA-Z0-9]/g, "").slice(0, REF_CODE_MAX_LEN);
    if (!sanitized) return;
    const expires = new Date(Date.now() + REF_COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = `${REF_COOKIE_NAME}=${sanitized}; expires=${expires}; path=/; SameSite=Lax`;
  },

  /** Legge il codice dal cookie. Ritorna null se assente. */
  get(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REF_COOKIE_NAME}=([^;]*)`) );
    return match ? match[1] : null;
  },

  /** Elimina il cookie dopo il signup andato a buon fine. */
  clear(): void {
    if (typeof document === "undefined") return;
    document.cookie = `${REF_COOKIE_NAME}=; Max-Age=0; path=/`;
  },
};
