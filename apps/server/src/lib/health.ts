import { performance } from "node:perf_hooks";
import { pool } from "@workspace/db";
import {
  getEmbedderHealthSnapshot,
  probeEmbedding,
  type EmbedderHealthSnapshot,
} from "@workspace/ai-server";

import { getRateLimitRedisClient } from "./rate-limit-redis";

type BasicStatus = "ok" | "fail";
type OverallStatus = "ok" | "degraded" | "fail";
type EmbedderStatus = "ok" | "stale" | "unknown" | "fail";

export interface DependencyCheck {
  status: BasicStatus;
  latencyMs: number;
  message?: string;
}

export interface RedisDependencyCheck extends DependencyCheck {
  required: boolean;
}

export interface EmbedderDependencyCheck {
  status: EmbedderStatus;
  probe: "cached" | "fresh" | "disabled";
  latencyMs?: number;
  lastOkAt?: string;
  lastErrorAt?: string;
  message?: string;
}

export interface HealthPayload {
  status: OverallStatus;
  service: "northstar-server";
  release: string;
  uptimeSec: number;
  checks: {
    db: DependencyCheck;
    redis: RedisDependencyCheck;
    pgvector: DependencyCheck;
    embedder: EmbedderDependencyCheck;
  };
}

const CHECK_TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 1500);
const EMBED_PROBE_TTL_MS = Number(process.env.HEALTH_EMBED_PROBE_TTL_MS ?? 300_000);
const EMBED_STALE_MS = Number(process.env.HEALTH_EMBED_STALE_MS ?? 900_000);
const EMBED_PROBE_ENABLED = process.env.HEALTH_EMBED_PROBE_ENABLED !== "false";
const HAS_EMBED_API_KEY = Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
const REQUIRE_EMBED_OK =
  process.env.HEALTH_REQUIRE_EMBED_OK === "true" ||
  (process.env.HEALTH_REQUIRE_EMBED_OK == null && HAS_EMBED_API_KEY);
const REDIS_BYPASSED =
  process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true";

let cachedEmbedderCheck: EmbedderDependencyCheck | null = null;
let cachedEmbedderCheckAt = 0;

function elapsedSince(start: number): number {
  return Math.round(performance.now() - start);
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${CHECK_TIMEOUT_MS}ms`));
    }, CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function checkDbHealth(): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    await withTimeout(pool.query("SELECT 1"), "db health check");
    return { status: "ok", latencyMs: elapsedSince(start) };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: elapsedSince(start),
      message: messageFrom(error),
    };
  }
}

export async function checkPgvectorHealth(): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    const result = (await withTimeout(
      pool.query<{ installed: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed",
      ),
      "pgvector health check",
    )) as { rows: Array<{ installed: boolean }> };
    const installed = result.rows[0]?.installed === true;
    if (!installed) {
      return {
        status: "fail",
        latencyMs: elapsedSince(start),
        message: "pgvector extension is not installed",
      };
    }
    return { status: "ok", latencyMs: elapsedSince(start) };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: elapsedSince(start),
      message: messageFrom(error),
    };
  }
}

export async function checkRedisHealth(): Promise<RedisDependencyCheck> {
  const start = performance.now();
  const required = !REDIS_BYPASSED;

  if (!required) {
    return { status: "ok", latencyMs: elapsedSince(start), required };
  }

  try {
    const redis = await withTimeout(
      getRateLimitRedisClient(),
      "redis connect health check",
    );
    await withTimeout(redis.ping(), "redis ping health check");
    return { status: "ok", latencyMs: elapsedSince(start), required };
  } catch (error) {
    return {
      status: "fail",
      latencyMs: elapsedSince(start),
      required,
      message: messageFrom(error),
    };
  }
}

function snapshotToEmbedderCheck(
  snapshot: EmbedderHealthSnapshot,
  probe: "cached" | "fresh" | "disabled",
  latencyMs?: number,
): EmbedderDependencyCheck {
  const lastOkMs = snapshot.lastOkAt ? Date.parse(snapshot.lastOkAt) : NaN;
  const isStale = Number.isFinite(lastOkMs) && Date.now() - lastOkMs > EMBED_STALE_MS;
  const status: EmbedderStatus =
    snapshot.status === "ok" && isStale ? "stale" : snapshot.status;

  return {
    status,
    probe,
    ...(latencyMs != null ? { latencyMs } : {}),
    ...(snapshot.lastOkAt ? { lastOkAt: snapshot.lastOkAt } : {}),
    ...(snapshot.lastErrorAt ? { lastErrorAt: snapshot.lastErrorAt } : {}),
    ...(snapshot.lastError ? { message: snapshot.lastError } : {}),
  };
}

export async function checkEmbedderHealth(): Promise<EmbedderDependencyCheck> {
  const now = Date.now();
  if (cachedEmbedderCheck && now - cachedEmbedderCheckAt < EMBED_PROBE_TTL_MS) {
    return { ...cachedEmbedderCheck, probe: "cached" };
  }

  if (!EMBED_PROBE_ENABLED || !HAS_EMBED_API_KEY) {
    return snapshotToEmbedderCheck(getEmbedderHealthSnapshot(), "disabled");
  }

  const start = performance.now();
  try {
    await withTimeout(
      probeEmbedding("northstar health probe"),
      "embedder health check",
    );
  } catch {
    // embedder.ts records the failure details; read the snapshot below.
  }

  cachedEmbedderCheck = snapshotToEmbedderCheck(
    getEmbedderHealthSnapshot(),
    "fresh",
    elapsedSince(start),
  );
  cachedEmbedderCheckAt = now;
  return cachedEmbedderCheck;
}

export async function getHealthPayload(): Promise<HealthPayload> {
  const [db, redis, pgvector, embedder] = await Promise.all([
    checkDbHealth(),
    checkRedisHealth(),
    checkPgvectorHealth(),
    checkEmbedderHealth(),
  ]);

  const criticalFailed =
    db.status === "fail" ||
    pgvector.status === "fail" ||
    (redis.required && redis.status === "fail") ||
    (REQUIRE_EMBED_OK && embedder.status !== "ok");
  const degraded =
    !criticalFailed &&
    (embedder.status === "stale" ||
      embedder.status === "unknown" ||
      embedder.status === "fail");

  return {
    status: criticalFailed ? "fail" : degraded ? "degraded" : "ok",
    service: "northstar-server",
    release:
      process.env.SENTRY_RELEASE ??
      process.env.RELEASE_VERSION ??
      process.env.GITHUB_SHA ??
      "development",
    uptimeSec: Math.round(process.uptime()),
    checks: { db, redis, pgvector, embedder },
  };
}
