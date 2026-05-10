/**
 * db-guard — Guardia anti-injection per NorthStar
 *
 * Questo modulo NON è un ORM alternativo. Fornisce:
 *   1. Wrapper tipizzato attorno a Drizzle (always prepared statements)
 *   2. Funzione di validazione per rilevare SQL injection nei parametri
 *   3. ESLint-style helper per bloccare raw SQL accidentale
 *
 * REGOLA: Non usare db.execute(sql`...`) con interpolazione diretta di req.body.
 * Usare SEMPRE db.select().from(table).where(eq(col, value)) — Drizzle
 * genera prepared statements automaticamente tramite il driver pg.
 *
 * Documentazione Drizzle prepared statements:
 * https://orm.drizzle.team/docs/prepared-statements
 */
import { logger } from './logger.js';

// ─── Pattern SQL injection detection ────────────────────────────────────────
// Rilevamento best-effort su parametri stringa — non sostituisce i prepared statements
const SQL_INJECTION_PATTERNS = [
  /('|(\\x27)|(\\x22)|(\\47)|(\\34))/i,         // quote escaping
  /(;|\\x3B)/i,                                   // statement terminator
  /(\/\*|\*\/|--)/i,                             // SQL comments
  /\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|CAST|CONVERT|CHAR|NCHAR|VARCHAR|NVARCHAR|DECLARE|CURSOR|FETCH|KILL|XP_|SP_)\b/i,
  /(0x[0-9a-fA-F]+)/,                             // hex encoding
  /WAITFOR\s+DELAY/i,                              // time-based blind injection
  /BENCHMARK\s*\(/i,
];

/**
 * Controlla se un valore stringa contiene pattern SQL injection.
 * Loggare sempre — non lanciare eccezione (lascia che la validation Zod fallisca).
 */
export function hasSqlInjectionPattern(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * sanitizeStringParam — rimuove caratteri pericolosi da una stringa
 * Usare come ultima linea di difesa DOPO validazione Zod.
 * NON sostituisce i prepared statements di Drizzle.
 */
export function sanitizeStringParam(value: string): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // control chars
    .trim();
}

/**
 * assertNativeQuery — lancia errore se viene usata una query SQL raw
 * non sicura. Da usare come tripwire nei code review.
 *
 * Esempio di uso scorretto (da NON fare):
 *   const userId = req.body.id; // stringa da utente!
 *   db.execute(sql`SELECT * FROM users WHERE id = ${userId}`)
 *                                               ^^^^^^^^^ PERICOLOSO
 *
 * Esempio corretto (Drizzle prepared statement):
 *   db.select().from(users).where(eq(users.id, userId))
 *              ──── Drizzle serializza userId come parametro $1 ────
 */
export function assertNoRawSqlFromUserInput(
  query: string,
  context: string,
): void {
  if (hasSqlInjectionPattern(query)) {
    logger.error(
      { query: query.slice(0, 100), context },
      '🚨 SECURITY: Potenziale SQL injection rilevata in query raw — usare Drizzle ORM',
    );
    throw new Error(
      `[db-guard] Query raw non sicura rilevata in ${context}. Usare Drizzle ORM con parametri tipizzati.`,
    );
  }
}

// ─── Drizzle usage patterns — cheat sheet ───────────────────────────────────
//
// ✅ CORRETTO — Drizzle genera: SELECT * FROM users WHERE id = $1
// import { db } from '@workspace/db';
// import { users } from '@workspace/db/schema';
// import { eq } from 'drizzle-orm';
//
// const user = await db.select().from(users).where(eq(users.id, userId));
//
// ✅ CORRETTO — Prepared statement esplicito (performance-critical)
// const prepared = db.select().from(users).where(eq(users.id, sql.placeholder('id'))).prepare('get_user');
// const user = await prepared.execute({ id: userId });
//
// ✅ CORRETTO — Insert con tipi verificati da Drizzle schema
// await db.insert(users).values({ email, passwordHash, name });
//
// ❌ SBAGLIATO — interpolazione diretta da req.body
// const { id } = req.body;
// db.execute(sql`SELECT * FROM users WHERE id = ${id}`)  // PERICOLOSO
//
// ❌ SBAGLIATO — concatenazione manuale
// db.execute(`SELECT * FROM users WHERE email = '${email}'`)  // PERICOLOSO
