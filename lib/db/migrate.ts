/**
 * Production migration runner.
 * Applies all pending SQL migrations from the ./drizzle folder.
 *
 * Usage:
 *   pnpm --filter @workspace/db exec tsx migrate.ts
 *
 * Run this in CI/CD BEFORE starting the API server.
 * Never run drizzle-kit push in production.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

console.log("[migrate] Running migrations...");

try {
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "drizzle"),
  });
  console.log("[migrate] ✓ All migrations applied successfully.");
} catch (err) {
  console.error("[migrate] ✗ Migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
