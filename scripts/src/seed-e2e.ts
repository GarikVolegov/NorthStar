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
 *   E2E_USER_PASSWORD     — password in chiaro (default: E2ePassword123!)
 *
 * L'utente viene creato con:
 *   - un settore reale (primo disponibile nel DB)
 *   - 3 objectives di esempio
 *   - isPremium=false, isAffiliate=false, isAdmin=false
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as crypto from 'crypto';

// ─── Tipi minimi — evita dipendere dall'intero schema per non dover compilare ─
type NewUser = {
  email: string;
  passwordHash: string;
  name: string;
  isPremium: boolean;
  isAffiliate: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  sectorId: number | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL non impostata');
  process.exit(1);
}

const EMAIL    = process.env.E2E_USER_EMAIL    ?? 'e2e@northstar.it';
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'E2ePassword123!';

// ─── Hash password (stesso algoritmo del server) ──────────────────────────────
function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Prende il primo settore disponibile (qualsiasi)
    const sectorRes = await client.query(
      'SELECT id FROM sectors ORDER BY id LIMIT 1'
    );
    const sectorId: number | null = sectorRes.rows[0]?.id ?? null;

    const passwordHash = hashPassword(PASSWORD);

    // Upsert utente base
    const upsertRes = await client.query(
      `INSERT INTO users
         (email, password_hash, name, is_premium, is_affiliate, is_admin,
          is_email_verified, sector_id, created_at, updated_at)
       VALUES ($1, $2, $3, false, false, false, true, $4, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         password_hash    = EXCLUDED.password_hash,
         is_premium       = false,
         is_affiliate     = false,
         is_admin         = false,
         is_email_verified= true,
         sector_id        = EXCLUDED.sector_id,
         updated_at       = NOW()
       RETURNING id`,
      [EMAIL, passwordHash, 'E2E Test User', sectorId]
    );

    const userId: number = upsertRes.rows[0].id;
    console.log(`✅  Utente base upserted: ${EMAIL} (id=${userId})`);

    // Cancella objectives precedenti e ricrea
    await client.query('DELETE FROM objectives WHERE user_id = $1', [userId]);

    const objectives = [
      { text: 'Diventare sviluppatore full-stack', category: 'skill',    progress: 30 },
      { text: 'Trovare primo lavoro in tech',     category: 'career',   progress: 10 },
      { text: 'Completare corso TypeScript',      category: 'learning', progress: 60 },
    ];

    for (const obj of objectives) {
      await client.query(
        `INSERT INTO objectives (user_id, text, category, progress, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, obj.text, obj.category, obj.progress]
      );
    }

    console.log(`✅  Objectives creati: ${objectives.length}`);
    console.log(`ℹ️   sectorId assegnato: ${sectorId ?? 'null (tabella sectors vuota)'}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌  seed-e2e failed:', err);
  process.exit(1);
});
