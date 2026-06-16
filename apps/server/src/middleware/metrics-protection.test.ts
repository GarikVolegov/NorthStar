import express from "express";
import request from "supertest";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("./logger", () => ({
  rootLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { metricsProtection } from "./metrics-protection";

function appWithProtection() {
  const app = express();
  // Nota: trust proxy NON impostato → req.ip = socket (127.0.0.1), gli header
  // x-forwarded-for NON influenzano req.ip. Simula che un header spoofato non
  // possa più concedere accesso.
  app.get("/metrics", metricsProtection, (_req, res) => res.send("ok"));
  return app;
}

const ENV_KEYS = ["METRICS_TOKEN", "ALLOWED_IPS"] as const;
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
    delete saved[k];
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string) {
  saved[key] = process.env[key];
  process.env[key] = value;
}

describe("metricsProtection", () => {
  it("denies when no token and no allowlist configured", async () => {
    await request(appWithProtection()).get("/metrics").expect(401);
  });

  it("does NOT honor a spoofed X-Forwarded-For for the IP allowlist", async () => {
    setEnv("ALLOWED_IPS", "9.9.9.9");
    // L'attaccante prova a fingersi 9.9.9.9 via header: req.ip resta 127.0.0.1.
    await request(appWithProtection())
      .get("/metrics")
      .set("X-Forwarded-For", "9.9.9.9")
      .expect(401);
  });

  it("grants access with the correct Bearer token", async () => {
    setEnv("METRICS_TOKEN", "s3cret-metrics-token");
    await request(appWithProtection())
      .get("/metrics")
      .set("Authorization", "Bearer s3cret-metrics-token")
      .expect(200);
  });

  it("denies with a wrong Bearer token", async () => {
    setEnv("METRICS_TOKEN", "s3cret-metrics-token");
    await request(appWithProtection())
      .get("/metrics")
      .set("Authorization", "Bearer wrong")
      .expect(401);
  });
});
