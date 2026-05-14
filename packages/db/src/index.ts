import dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

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
const _pool = new Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX ?? "10"),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT ?? "30000"),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT ?? "5000"),
});
const _db = drizzle(_pool, { schema });

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// On SIGTERM (Docker stop, Kubernetes pod eviction) drain the pool gracefully
// so in-flight queries finish before the process exits.
process.once("SIGTERM", () => {
  _pool.end().catch((err: unknown) =>
    console.error("[db] pool drain error on SIGTERM:", err),
  );
});
process.once("SIGINT", () => {
  _pool.end().catch((err: unknown) =>
    console.error("[db] pool drain error on SIGINT:", err),
  );
});

// ── Public exports ────────────────────────────────────────────────────────────
// Proxy wrappers preserved for backward compatibility with existing import sites.
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    return (_pool as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_t, prop) {
      return (_db as unknown as Record<string | symbol, unknown>)[prop as string];
    },
  },
);

export * from "./schema";
