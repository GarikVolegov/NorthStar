import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { HealthPayload } from "./health";

const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  redisPing: vi.fn(),
  getRateLimitRedisClient: vi.fn(),
  probeEmbedding: vi.fn(),
  getEmbedderHealthSnapshot: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  pool: {
    query: mocks.dbQuery,
  },
}));

vi.mock("./rate-limit-redis", () => ({
  getRateLimitRedisClient: mocks.getRateLimitRedisClient,
  createRedisRateLimitStore: () => undefined,
  isRateLimitRedisRequired: () =>
    process.env.RATE_LIMIT_REDIS_REQUIRED === "true",
}));

vi.mock("@workspace/ai-server", () => ({
  probeEmbedding: mocks.probeEmbedding,
  getEmbedderHealthSnapshot: mocks.getEmbedderHealthSnapshot,
}));

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

async function loadHealth() {
  vi.resetModules();
  return await import("./health");
}

describe("health checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.RATE_LIMIT_REDIS_REQUIRED = "true";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    delete process.env.HEALTH_REQUIRE_EMBED_OK;
    delete process.env.HEALTH_EMBED_PROBE_ENABLED;

    mocks.dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return { rows: [{ installed: true }] };
      }
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            { column_name: "priority" },
            { column_name: "source_type" },
            { column_name: "scraping_url" },
            { column_name: "scraping_selector" },
            { column_name: "enabled" },
            { column_name: "last_fetch_at" },
          ],
        };
      }
      return { rows: [{ ok: 1 }] };
    });
    mocks.redisPing.mockResolvedValue("PONG");
    mocks.getRateLimitRedisClient.mockResolvedValue({ ping: mocks.redisPing });
    mocks.probeEmbedding.mockResolvedValue([0.1, 0.2]);
    mocks.getEmbedderHealthSnapshot.mockReturnValue({
      status: "ok",
      lastOkAt: new Date().toISOString(),
    });
  });

  it("returns ok when critical dependencies are ready", async () => {
    const { getHealthPayload } = await loadHealth();

    await expect(getHealthPayload()).resolves.toMatchObject({
      status: "ok",
      checks: {
        db: { status: "ok" },
        redis: { status: "ok", required: true },
        pgvector: { status: "ok" },
        embedder: { status: "ok", probe: "fresh" },
      },
    });
  });

  it("fails when pgvector is missing", async () => {
    mocks.dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return { rows: [{ installed: false }] };
      }
      return { rows: [{ ok: 1 }] };
    });
    const { getHealthPayload } = await loadHealth();

    const payload = await getHealthPayload();

    expect(payload.status).toBe("fail");
    expect(payload.checks.pgvector).toMatchObject({
      status: "fail",
      message: "pgvector extension is not installed",
    });
  });

  it("fails closed when required Redis is unavailable", async () => {
    mocks.getRateLimitRedisClient.mockRejectedValue(new Error("redis down"));
    const { getHealthPayload } = await loadHealth();

    const payload = await getHealthPayload();

    expect(payload.status).toBe("fail");
    expect(payload.checks.redis).toMatchObject({
      status: "fail",
      required: true,
      message: "redis down",
    });
  });

  it("keeps readiness ok when optional embedder has no key and no call happened yet", async () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    process.env.HEALTH_REQUIRE_EMBED_OK = "false";
    mocks.getEmbedderHealthSnapshot.mockReturnValue({ status: "unknown" });
    const { getHealthPayload } = await loadHealth();

    const payload = await getHealthPayload();

    expect(payload.status).toBe("ok");
    expect(payload.checks.embedder).toMatchObject({
      status: "unknown",
      probe: "disabled",
    });
    expect(mocks.probeEmbedding).not.toHaveBeenCalled();
  }, 30_000);

  it("fails clearly when discovery_sources is missing required migration columns", async () => {
    mocks.dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return { rows: [{ installed: true }] };
      }
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            { column_name: "enabled" },
            { column_name: "last_fetch_at" },
          ],
        };
      }
      return { rows: [{ ok: 1 }] };
    });
    const { getHealthPayload } = await loadHealth();

    const payload = await getHealthPayload();

    expect(payload.status).toBe("fail");
    expect(payload.checks.discoverySources).toMatchObject({
      status: "fail",
      missingColumns: [
        "priority",
        "source_type",
        "scraping_url",
        "scraping_selector",
      ],
      message:
        "discovery_sources schema drift: missing columns priority, source_type, scraping_url, scraping_selector. Run pnpm run db:migrate before starting collectors/news.",
    });
  });
});

describe("health route compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.RATE_LIMIT_REDIS_REQUIRED = "true";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    delete process.env.HEALTH_REQUIRE_EMBED_OK;
    delete process.env.HEALTH_EMBED_PROBE_ENABLED;

    mocks.dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return { rows: [{ installed: true }] };
      }
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            { column_name: "priority" },
            { column_name: "source_type" },
            { column_name: "scraping_url" },
            { column_name: "scraping_selector" },
            { column_name: "enabled" },
            { column_name: "last_fetch_at" },
          ],
        };
      }
      return { rows: [{ ok: 1 }] };
    });
    mocks.redisPing.mockResolvedValue("PONG");
    mocks.getRateLimitRedisClient.mockResolvedValue({ ping: mocks.redisPing });
    mocks.probeEmbedding.mockResolvedValue([0.1, 0.2]);
    mocks.getEmbedderHealthSnapshot.mockReturnValue({
      status: "ok",
      lastOkAt: new Date().toISOString(),
    });
  });

  it("serves /api/healthz with the same readiness payload as /api/health", async () => {
    const { createHealthRouter } = await import("../routes/health");
    const app = express();
    const healthRouter = createHealthRouter();
    app.use("/api/health", healthRouter);
    app.use("/api/healthz", healthRouter);

    const health = await request(app).get("/api/health").expect(200);
    const healthz = await request(app).get("/api/healthz").expect(200);
    const healthBody = health.body as HealthPayload;
    const healthzBody = healthz.body as HealthPayload;

    expect(healthzBody).toMatchObject({
      status: healthBody.status,
      checks: {
        db: { status: healthBody.checks.db.status },
        redis: { status: healthBody.checks.redis.status },
        pgvector: { status: healthBody.checks.pgvector.status },
        embedder: { status: healthBody.checks.embedder.status },
      },
    });
  }, 30_000);
});
