import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { PROMPT_DEFAULTS } from "./prompt-defaults.js";

export { PROMPT_DEFAULTS };

export async function ensurePromptsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "agent_prompts" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_by" text
      );
    `);
  } catch { /* ignore if already exists */ }
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export async function getPrompt(key: string): Promise<string> {
  const fallback = PROMPT_DEFAULTS[key]?.value ?? "";

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const rows = await db.execute(sql`SELECT value FROM agent_prompts WHERE key = ${key} LIMIT 1`);
    const row = (rows.rows?.[0] ?? null) as { value: string } | null;
    if (row?.value) {
      cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
      return row.value;
    }
  } catch (err) {
    logger.warn({ err, key }, "[prompt-store] Failed to read prompt from DB — using default");
  }

  return fallback;
}

export async function setPrompt(key: string, value: string, updatedBy?: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO agent_prompts (key, value, updated_at, updated_by)
    VALUES (${key}, ${value}, now(), ${updatedBy ?? null})
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  `);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function deletePrompt(key: string): Promise<void> {
  await db.execute(sql`DELETE FROM agent_prompts WHERE key = ${key}`);
  cache.delete(key);
}

export async function listPromptOverrides(): Promise<Array<{
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}>> {
  try {
    const rows = await db.execute(sql`
      SELECT key, value, updated_at, updated_by FROM agent_prompts ORDER BY key
    `);
    return (rows.rows ?? []) as Array<{
      key: string;
      value: string;
      updated_at: string;
      updated_by: string | null;
    }>;
  } catch {
    return [];
  }
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, v),
    template
  );
}
