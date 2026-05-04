import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return new Pool({ connectionString: url });
}

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_pool) _pool = getPool();
  if (!_db) _db = drizzle(_pool, { schema });
  return _db;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    if (!_pool) _pool = getPool();
    return (_pool as any)[prop];
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

export * from "./schema";
