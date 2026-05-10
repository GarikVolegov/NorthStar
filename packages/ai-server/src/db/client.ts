/**
 * DB client — single Drizzle instance shared across the server.
 *
 * Uses DATABASE_URL from env. Falls back to a no-op stub when not set,
 * so the server still boots in environments without a DB (e.g. local dev
 * without Postgres).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — DB features disabled.");
    return null;
  }
  const pg = postgres(url, { max: 5 });
  return drizzle(pg, { schema });
}

export const db = createDb();
export type DB = NonNullable<typeof db>;
