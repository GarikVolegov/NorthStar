import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@workspace/ai-server", () => ({
  probeEmbedding: mocks.probeEmbedding,
  getEmbedderHealthSnapshot: mocks.getEmbedderHealthSnapshot,
}));

async function loadHealth() {
  vi.resetModules();
  return await import("./health");
}

describe("health checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-key";
    delete process.env.HEALTH_REQUIRE_EMBED_OK;
    delete process.env.HEALTH_EMBED_PROBE_ENABLED;

    mocks.dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("pg_extension")) {
        return { rows: [{ installed: true }] };
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

  it("marks embedder as degraded when probe is disabled and no call happened yet", async () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    process.env.HEALTH_REQUIRE_EMBED_OK = "false";
    mocks.getEmbedderHealthSnapshot.mockReturnValue({ status: "unknown" });
    const { getHealthPayload } = await loadHealth();

    const payload = await getHealthPayload();

    expect(payload.status).toBe("degraded");
    expect(payload.checks.embedder).toMatchObject({
      status: "unknown",
      probe: "disabled",
    });
    expect(mocks.probeEmbedding).not.toHaveBeenCalled();
  });
});
