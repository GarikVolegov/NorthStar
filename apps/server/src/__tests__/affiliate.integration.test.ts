/**
 * affiliate.integration.test.ts
 *
 * Test di integrazione per i percorsi critici del programma affiliazione:
 *
 *   1. Creazione account affiliato (lazy, al primo accesso dashboard)
 *   2. Generazione link referral univoco
 *   3. Signup di un utente tramite codice referral
 *   4. linkReferral: idempotenza (doppia chiamata non duplica il link)
 *   5. linkReferral: auto-referral bloccato
 *   6. linkReferral: codice inesistente
 *   7. getOrCreateAccount: sicurezza concorrente (parallel calls)
 *   8. Dashboard: dati coerenti dopo referral
 *
 * SETUP:
 *   Richiede DATABASE_URL puntato a un DB di test con migration applicate.
 *   I dati vengono rimossi in afterAll via cleanTestUsers.
 *
 * ESECUZIONE:
 *   pnpm --filter @northstar/server test
 *   DATABASE_URL=postgres://... pnpm --filter @northstar/server test
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp } from "./helpers/app";
import { makeToken, authHeader } from "./helpers/auth";
import { createTestUser, cleanTestUsers } from "./helpers/db-seed";
import { linkReferral } from "../affiliate/affiliate-tracking";
import { getOrCreateAccount } from "../affiliate/affiliate-service";
import { db } from "@workspace/db";
import { affiliateAccountsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Setup globale ─────────────────────────────────────────────────────────────

const TAG = "aff-integ";
const app = buildApp();

// Utenti creati nel DB prima dei test
let affiliateUser:  { id: number; email: string; name: string; tag: string };
let referredUser:   { id: number; email: string; name: string; tag: string };
let unrelatedUser:  { id: number; email: string; name: string; tag: string };

beforeAll(async () => {
  // Pulizia preventiva (in caso di test precedenti non conclusi)
  await cleanTestUsers(TAG);

  affiliateUser = await createTestUser({ tag: TAG, name: "Affiliato Test", isAffiliate: true });
  referredUser  = await createTestUser({ tag: TAG, name: "Referral Test" });
  unrelatedUser = await createTestUser({ tag: TAG, name: "Unrelated Test" });
});

afterAll(async () => {
  await cleanTestUsers(TAG);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Affiliate: creazione account", () => {
  it("GET /api/affiliate/dashboard crea l'account al primo accesso e ritorna 200", async () => {
    const token = makeToken({ id: affiliateUser.id, email: affiliateUser.email });
    const res = await request(app)
      .get("/api/affiliate/dashboard")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.account).toBeDefined();
    expect(res.body.account.referralCode).toMatch(/^[A-F0-9]{8}$/);
    expect(res.body.account.referralUrl).toContain(res.body.account.referralCode);
  });

  it("Chiamate multiple a getOrCreateAccount non creano duplicati", async () => {
    // Simula 5 chiamate concorrenti per lo stesso userId
    const calls = Array.from({ length: 5 }, () =>
      getOrCreateAccount(affiliateUser.id),
    );
    const results = await Promise.all(calls);

    // Tutti devono restituire lo stesso id
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(1); // tutti identici

    // Verifica nel DB: esattamente una riga
    const rows = await db
      .select()
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.userId, affiliateUser.id));
    expect(rows).toHaveLength(1);
  });

  it("Il referralCode è univoco nel DB", async () => {
    const account = await getOrCreateAccount(affiliateUser.id);
    const rows = await db
      .select()
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.referralCode, account.referralCode));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(affiliateUser.id);
  });
});

describe("Affiliate: linkReferral", () => {
  let referralCode: string;

  beforeAll(async () => {
    const account = await getOrCreateAccount(affiliateUser.id);
    referralCode  = account.referralCode;
  });

  it("linkReferral collega correttamente l'utente referito", async () => {
    const result = await linkReferral(referredUser.id, referralCode);

    expect(result.linked).toBe(true);
    expect(result.affiliateId).toBeDefined();

    // Verifica nel DB
    const user = await db
      .select({ referredByAffiliateId: usersTable.referredByAffiliateId })
      .from(usersTable)
      .where(eq(usersTable.id, referredUser.id))
      .then((r) => r[0]);

    expect(user?.referredByAffiliateId).toBe(result.affiliateId);
  });

  it("linkReferral è idempotente: doppia chiamata non duplica il link né il contatore", async () => {
    // Prima chiamata già fatta nel test precedente
    const account1 = await getOrCreateAccount(affiliateUser.id);
    const countBefore = account1.totalReferrals;

    // Seconda chiamata con lo stesso utente referito
    const result2 = await linkReferral(referredUser.id, referralCode);
    expect(result2.linked).toBe(false);
    expect(result2.reason).toBe("already_linked");

    // Il contatore non deve essere cambiato
    const account2 = await getOrCreateAccount(affiliateUser.id);
    expect(account2.totalReferrals).toBe(countBefore);
  });

  it("linkReferral blocca l'auto-referral", async () => {
    const result = await linkReferral(affiliateUser.id, referralCode);

    expect(result.linked).toBe(false);
    expect(result.reason).toBe("self_referral");
  });

  it("linkReferral ritorna code_not_found per codice inesistente", async () => {
    const result = await linkReferral(unrelatedUser.id, "NONEXIST");

    expect(result.linked).toBe(false);
    expect(result.reason).toBe("code_not_found");
  });

  it("linkReferral concorrente: due richieste parallele collegano l'utente una sola volta", async () => {
    // Crea un utente fresco per questo test di concorrenza
    const freshUser = await createTestUser({ tag: TAG, name: "Concurrent Test" });

    // 3 chiamate parallele per lo stesso utente
    const [r1, r2, r3] = await Promise.all([
      linkReferral(freshUser.id, referralCode),
      linkReferral(freshUser.id, referralCode),
      linkReferral(freshUser.id, referralCode),
    ]);

    const successes = [r1, r2, r3].filter((r) => r.linked === true);
    const failures  = [r1, r2, r3].filter((r) => r.linked === false);

    // Esattamente una sola deve avere successo
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
    failures.forEach((f) => expect(f.reason).toBe("already_linked"));

    // Verifica nel DB: un solo referredByAffiliateId
    const user = await db
      .select({ referredByAffiliateId: usersTable.referredByAffiliateId })
      .from(usersTable)
      .where(eq(usersTable.id, freshUser.id))
      .then((r) => r[0]);
    expect(user?.referredByAffiliateId).toBeDefined();
  });
});

describe("Affiliate: dashboard dopo referral", () => {
  it("GET /api/affiliate/dashboard ritorna totalReferrals >= 1 dopo il collegamento", async () => {
    const token = makeToken({ id: affiliateUser.id, email: affiliateUser.email });
    const res = await request(app)
      .get("/api/affiliate/dashboard")
      .set(...authHeader(token));

    expect(res.status).toBe(200);
    // Almeno il referredUser è stato collegato nei test precedenti
    expect(res.body.account.totalReferrals).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/affiliate/dashboard senza token ritorna 401", async () => {
    const res = await request(app).get("/api/affiliate/dashboard");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
