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
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root of the monorepo
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug: check if we are loading the env correctly
console.log("[migrate] Current directory:", process.cwd());
console.log("[migrate] DATABASE_URL from env:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("[migrate] DATABASE_URL_MIGRATOR from env:", process.env.DATABASE_URL_MIGRATOR ? "SET" : "NOT SET");

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const DATABASE_URL_MIGRATOR = process.env.DATABASE_URL_MIGRATOR;
if (!DATABASE_URL_MIGRATOR) {
  console.error("[migrate] ERROR: DATABASE_URL_MIGRATOR is not set.");
  process.exit(1);
}

const migrationPool = new Pool({ connectionString: DATABASE_URL_MIGRATOR });
const db = drizzle(migrationPool);

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
  await migrationPool.end();
}
