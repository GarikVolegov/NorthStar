import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { buildOptions, globalLimiter, planQuotaLimiter, requestIpKey } from "./rate-limit";

describe("rate-limit middleware", () => {
  afterEach(() => {
    delete process.env.USE_MOCK_AI;
  });

  it("generates stable IP keys", () => {
    const req = {
      ip: "127.0.0.1",
      socket: { remoteAddress: "10.0.0.1" },
    } as express.Request;
    expect(requestIpKey(req)).toBe(requestIpKey(req));
  });

  it("builds shared options with JSON message", () => {
    expect(buildOptions("test:", {})).toMatchObject({
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Troppe richieste. Riprova tra poco." },
    });
  });

  it("skips global and plan quota limits in test/mock mode", async () => {
    process.env.USE_MOCK_AI = "true";
    const app = express();
    app.get("/global", globalLimiter, (_req, res) => res.json({ ok: true }));
    app.get("/plan", planQuotaLimiter, (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 3; i += 1) {
      await request(app).get("/global").expect(200);
      await request(app).get("/plan").expect(200);
    }
  });
});
