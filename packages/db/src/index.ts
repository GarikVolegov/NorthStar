import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

// ── Fail fast ────────────────────────────────────────────────────────────────
// Validate at import time so the process crashes immediately with a clear
// message instead of failing on the first DB query at runtime.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "[db] DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ── Eager singleton init ──────────────────────────────────────────────────────
// Initialised once when the module is first imported. Node.js module loading
// is synchronous and single-threaded, so there is no race condition here.
const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema }) as NeonHttpDatabase<typeof schema>;

// Also export a pool for migrations and seeding (uses the same connection string)
export const pool = new Pool({ connectionString: DATABASE_URL });

// ── Public exports ────────────────────────────────────────────────────────────
export * from "./schema";
