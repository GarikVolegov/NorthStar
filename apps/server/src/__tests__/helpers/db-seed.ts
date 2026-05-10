/**
 * db-seed.ts — Helpers per creare e pulire dati di test nel DB.
 *
 * ISOLAMENTO:
 *   Ogni test che crea utenti usa un suffisso UUID per l'email,
 *   garantendo che test paralleli non collidano sulle colonne UNIQUE.
 *
 * PULIZIA:
 *   cleanTestUsers(tag) elimina tutti gli utenti il cui tag è
 *   contenuto nell'email. Chiamarlo in afterEach/afterAll.
 *
 * PREREQUISITI:
 *   DATABASE_URL deve puntare a un DB di test (non produzione).
 *   Le migration devono essere già applicate.
 */
import { db } from "@workspace/db";
import {
  usersTable,
  affiliateAccountsTable,
  affiliateCommissionsTable,
  affiliateWithdrawalsTable,
} from "@workspace/db";
import { like, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface SeedUser {
  id:    number;
  email: string;
  name:  string;
  tag:   string;  // parte dell'email per la pulizia
}

/**
 * Crea un utente nel DB con un email univoco basato su tag + uuid.
 * Ritorna { id, email, name, tag }.
 */
export async function createTestUser(opts: {
  tag:     string;   // es. "affiliate-test"
  name?:   string;
  isAffiliate?: boolean;
}): Promise<SeedUser> {
  const uuid  = randomUUID().slice(0, 8);
  const email = `${opts.tag}-${uuid}@test.northstar.internal`;
  const name  = opts.name ?? `Test ${opts.tag}`;

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash:  await bcrypt.hash("test-password-123", 4), // 4 rounds: rapido nei test
      emailVerified: true,
      isAffiliate:   opts.isAffiliate ?? false,
    })
    .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name });

  return { id: user.id, email: user.email, name: user.name, tag: opts.tag };
}

/**
 * Elimina tutti i record di test creati per un dato tag.
 * Ordine: commissioni → prelievi → account affiliato → utenti.
 * Usa CASCADE dove disponibile, ma gestiamo manualmente per sicurezza.
 */
export async function cleanTestUsers(tag: string): Promise<void> {
  // Trova gli utenti con questo tag
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(like(usersTable.email, `%${tag}%@test.northstar.internal`));

  if (users.length === 0) return;
  const userIds = users.map((u) => u.id);

  // Trova gli account affiliati associati
  for (const uid of userIds) {
    const accs = await db
      .select({ id: affiliateAccountsTable.id })
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.userId, uid));

    for (const acc of accs) {
      await db.delete(affiliateCommissionsTable)
        .where(eq(affiliateCommissionsTable.affiliateId, acc.id));
      await db.delete(affiliateWithdrawalsTable)
        .where(eq(affiliateWithdrawalsTable.affiliateId, acc.id));
      await db.delete(affiliateAccountsTable)
        .where(eq(affiliateAccountsTable.id, acc.id));
    }

    await db.delete(usersTable).where(eq(usersTable.id, uid));
  }
}
