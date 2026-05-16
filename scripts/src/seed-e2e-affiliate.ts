/**
 * seed-e2e-affiliate.ts
 *
 * Crea (o aggiorna via upsert) l'utente affiliato per i test Playwright e2e.
 * Questo utente ha isAffiliate=true e viene usato da e2e/affiliate.spec.ts
 * per testare il branch "Affiliato": stats card, referral link, dialog ritiro.
 *
 * Viene eseguito da CI dopo seed-e2e, e localmente con:
 *   pnpm --filter @northstar/server run seed:e2e-affiliate
 *
 * Env vars attese:
 *   DATABASE_URL             — connection string Postgres
 *   AFFILIATE_SEED_EMAIL     — email utente affiliate  (default: affiliate-e2e@northstar.it)
 *   AFFILIATE_SEED_PASSWORD  — password in chiaro      (default: AffiliateE2e123!)
 *
 * L'utente viene creato con:
 *   - isAffiliate=true
 *   - isPremium=true (la dashboard affiliate è accessibile solo ai premium)
 *   - referralCode generato deterministicamente dall'email
 *   - affiliateBalance=0, affiliateClicks=5, affiliateConversions=2 (dati demo)
 */

import 'dotenv/config';
import * as crypto from 'crypto';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

// ─── Config ───────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL non impostata');
  process.exit(1);
}

const EMAIL    = process.env.AFFILIATE_SEED_EMAIL    ?? 'affiliate-e2e@northstar.it';
const PASSWORD = process.env.AFFILIATE_SEED_PASSWORD ?? 'AffiliateE2e123!';

function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

/** Genera un referral code deterministico dall'email (6 char uppercase hex) */
function referralCodeFromEmail(email: string): string {
  return crypto.createHash('md5').update(email).digest('hex').slice(0, 8).toUpperCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // Since we're using drizzle with neon/http, we need to execute raw queries differently
    // For seed scripts, we'll use the db.execute method with raw SQL

    // Prende il primo settore disponibile
    const sectorRes: any = await db.execute(
      sql`SELECT id FROM sectors ORDER BY id LIMIT 1`
    );
    const sectorId: number | null = sectorRes.length > 0 ? sectorRes[0].id : null;

    const passwordHash  = hashPassword(PASSWORD);
    const referralCode  = referralCodeFromEmail(EMAIL);

    // Upsert utente affiliate
    const upsertRes: any = await db.execute(
      sql`
        INSERT INTO users
          (email, password_hash, name, is_premium, is_affiliate, is_admin,
           email_verified, sector_id, referred_by_code, created_at, updated_at)
        VALUES (
          ${EMAIL},
          ${passwordHash},
          'E2E Affiliate User',
          true,
          true,
          false,
          true,
          ${sectorId ?? null},
          ${referralCode},
          NOW(),
          NOW()
        )
        ON CONFLICT (email) DO UPDATE SET
          password_hash     = EXCLUDED.password_hash,
          is_premium        = true,
          is_affiliate      = true,
          is_admin          = false,
          email_verified    = true,
          sector_id         = EXCLUDED.sector_id,
          referred_by_code  = EXCLUDED.referred_by_code,
          updated_at        = NOW()
        RETURNING id
      `
    );
    const userId: number = upsertRes.length > 0 ? upsertRes[0].id : 0;
    console.log(`✅  Utente affiliate upserted: ${EMAIL} (id=${userId})`);
    console.log(`ℹ️   referralCode: ${referralCode}`);

    // Upsert statistiche affiliate (tabella affiliate_stats o simile)
    // Graceful: se la tabella non esiste, logga e continua
    try {
      await db.execute(
        sql`
          INSERT INTO affiliate_stats
            (user_id, balance, clicks, conversions, created_at, updated_at)
          VALUES (
            ${userId},
            0,
            5,
            2,
            NOW(),
            NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            clicks      = 5,
            conversions = 2,
            updated_at  = NOW()
        `
      );
      console.log('✅  affiliate_stats upserted');
    } catch (statsErr: any) {
      if (statsErr.code === '42P01') {
        // Tabella non esiste ancora — skip silenzioso
        console.log('ℹ️   tabella affiliate_stats non presente, skip stats seed');
      } else {
        throw statsErr;
      }
    }

    // Objectives minimi per non rompere GET /api/auth/me
    const existingObj: any = await db.execute(
      sql`SELECT COUNT(*) AS count FROM objectives WHERE user_id = ${userId}`
    );
    if (existingObj.length > 0 && parseInt(existingObj[0].count, 10) === 0) {
      await db.execute(
        sql`
          INSERT INTO objectives (user_id, text, category, progress, created_at)
          VALUES (
            ${userId},
            'Obiettivo affiliate di test',
            'career',
            0,
            NOW()
          )
        `
      );
      console.log('✅  Objective placeholder creato');
    }
  } catch (err) {
    console.error('Error in seed-e2e-affiliate:', err);
    throw err;
  }
}

main().catch((err) => {
  console.error('❌  seed-e2e-affiliate failed:', err);
  process.exit(1);
});
