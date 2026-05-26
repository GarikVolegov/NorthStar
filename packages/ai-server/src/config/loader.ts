import { asc } from "drizzle-orm";
import { db, wendyConfigOverridesTable } from "@workspace/db";
import { logger } from "../logger";
import { applyConfigOverrides, parseEnvConfig, type WendyEnvSource } from "./wendy.config";
import type { WendyConfig, WendyConfigOverride } from "./types";

export interface LoadConfigOptions {
  env?: WendyEnvSource;
  dbOverrides?: WendyConfigOverride[];
  skipDb?: boolean;
}

export let wendyConfig: WendyConfig = parseEnvConfig();
let lastLoadedAt = 0;
let reloadInFlight: Promise<WendyConfig> | null = null;

async function loadDbOverrides(): Promise<WendyConfigOverride[]> {
  try {
    return await db
      .select({
        key: wendyConfigOverridesTable.key,
        value: wendyConfigOverridesTable.value,
      })
      .from(wendyConfigOverridesTable)
      .orderBy(asc(wendyConfigOverridesTable.updatedAt));
  } catch (err) {
    logger.warn({ err }, "[wendy-config] DB overrides unavailable; using env config");
    return [];
  }
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<WendyConfig> {
  const base = parseEnvConfig(options.env ?? process.env);
  const overrides = options.dbOverrides ?? (options.skipDb === true ? [] : await loadDbOverrides());
  return applyConfigOverrides(base, overrides);
}

export function getWendyConfig(): WendyConfig {
  return wendyConfig;
}

export async function refreshWendyConfig(options: LoadConfigOptions = {}): Promise<WendyConfig> {
  wendyConfig = await loadConfig(options);
  lastLoadedAt = Date.now();
  return wendyConfig;
}

export async function ensureWendyConfigFresh(
  ttlMs = Number(process.env.WENDY_CONFIG_RELOAD_MS ?? "30000"),
): Promise<WendyConfig> {
  if (Date.now() - lastLoadedAt < ttlMs) return wendyConfig;
  if (reloadInFlight) return reloadInFlight;

  reloadInFlight = refreshWendyConfig()
    .catch((err: unknown) => {
      logger.warn({ err }, "[wendy-config] refresh failed; keeping last known config");
      return wendyConfig;
    })
    .finally(() => {
      reloadInFlight = null;
    });

  return reloadInFlight;
}
