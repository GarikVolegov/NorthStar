/**
 * seed-e2e.ts
 *
 * Crea (o aggiorna via upsert) l'utente base per i test Playwright e2e.
 * Viene eseguito da CI prima di avviare i servizi, e localmente con:
 *   pnpm --filter @northstar/server run seed:e2e
 *
 * Env vars attese:
 *   DATABASE_URL          — connection string Postgres
 *   E2E_USER_EMAIL        — email utente base  (default: e2e@northstar.it)
 *   E2E_USER_PASSWORD     — password in chiaro (required)
 */

import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import * as crypto from "crypto";

// ─── Tipi minimi — evita dipendere dall'intero schema per non dover compilare ─
// ─── Config ───────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL non impostata");
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required; refusing to use a default test password.`);
  }
  return value;
}

const EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@northstar.it";
const PASSWORD = requireEnv("E2E_USER_PASSWORD");

// ─── Hash password (stesso algoritmo del server) ──────────────────────────────
function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

// ─── Main ────────────────……………………………………………………………………
async function main() {
  // Since we're using drizzle with neon/http, we need to execute raw queries differently
  // For seed scripts, we'll use the db.execute method with raw SQL

  // Prende il primo settore disponibile (qualsiasi)
  try {
    const sectorRes: any = await db.execute(
      sql`SELECT id FROM sectors ORDER BY id LIMIT 1`,
    );
    const sectorId: number | null =
      sectorRes.rows.length > 0 ? sectorRes.rows[0].id : null;

    const passwordHash = hashPassword(PASSWORD);

    // Upsert utente base
    await db.execute(
      sql`
        INSERT INTO users
          (email, password_hash, name, is_premium, is_affiliate, is_admin,
           email_verified, sector_id, created_at, updated_at)
        VALUES (
          ${EMAIL}, 
          ${passwordHash}, 
          'E2E Test User', 
          false, 
          false, 
          false, 
          true, 
          ${sectorId ?? null}, 
          NOW(), 
          NOW()
        )
        ON CONFLICT (email) DO UPDATE SET
          password_hash    = EXCLUDED.password_hash,
          is_premium       = false,
          is_affiliate     = false,
          is_admin         = false,
          email_verified   = true,
          sector_id        = EXCLUDED.sector_id,
          updated_at       = NOW()
      `,
    );

    // Now get the user id
    const selectRes: any = await db.execute(
      sql`SELECT id FROM users WHERE email = ${EMAIL}`,
    );
    console.log(`Select result for email ${EMAIL}:`, selectRes);
    if (selectRes.rows.length === 0) {
      throw new Error(`Failed to fetch user after upsert for email: ${EMAIL}`);
    }
    const userId: number = selectRes.rows[0].id;
    console.log(`✅  Utente base upserted: ${EMAIL} (id=${userId})`);

    // Cancella objectives precedenti e ricrea
    await db.execute(
      sql`DELETE FROM user_objectives WHERE user_id = ${userId}`,
    );

    const objectives = [
      {
        text: "Diventare sviluppatore full-stack",
        category: "skill",
        progress: 30,
      },
      {
        text: "Trovare primo lavoro in tech",
        category: "career",
        progress: 10,
      },
      {
        text: "Completare corso TypeScript",
        category: "learning",
        progress: 60,
      },
    ];

    for (const obj of objectives) {
      await db.execute(
        sql`
          INSERT INTO user_objectives (user_id, text, category, progress, created_at)
          VALUES (
            ${userId}, 
            ${obj.text}, 
            ${obj.category}, 
            ${obj.progress}, 
            NOW()
          )
        `,
      );
    }

    console.log(`✅  Objectives creati: ${objectives.length}`);
    console.log(
      `ℹ️   sectorId assegnato: ${sectorId ?? "null (tabella sectors vuota)"}`,
    );
  } catch (err) {
    console.error("Error in seed-e2e:", err);
    throw err;
  }
}

main().catch((err) => {
  console.error("❌  seed-e2e failed:", err);
  process.exit(1);
});
