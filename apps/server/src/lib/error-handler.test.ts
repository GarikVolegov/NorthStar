import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../sentry", () => ({ captureServerException: vi.fn() }));
vi.mock("./execution-monitor", () => ({
  executionMonitor: { capture: vi.fn() },
}));
vi.mock("../middleware/logger", () => ({
  rootLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { globalErrorHandler } from "./error-handler";

function appThatThrows(makeError: () => unknown) {
  const app = express();
  app.get("/boom", () => {
    throw makeError();
  });
  app.use(globalErrorHandler);
  return app;
}

describe("globalErrorHandler", () => {
  it("maps ZodError → 400 with field errors", async () => {
    const app = appThatThrows(() => {
      try {
        z.object({ name: z.string() }).parse({});
      } catch (e) {
        return e;
      }
      return new Error("unreachable");
    });
    const res = await request(app).get("/boom").expect(400);
    expect(res.body).toMatchObject({ error: "Dati non validi" });
    expect((res.body as { details?: unknown }).details).toBeDefined();
  });

  it("maps PG unique violation (23505) → 409", async () => {
    const app = appThatThrows(() => Object.assign(new Error("dup"), { code: "23505" }));
    await request(app).get("/boom").expect(409);
  });

  it("maps PG FK violation (23503) → 400", async () => {
    const app = appThatThrows(() => Object.assign(new Error("fk"), { code: "23503" }));
    await request(app).get("/boom").expect(400);
  });

  it("maps schema drift (undefined table) → 503", async () => {
    const app = appThatThrows(() =>
      Object.assign(new Error('relation "x" does not exist'), { code: "42P01" }),
    );
    const res = await request(app).get("/boom").expect(503);
    expect(res.body).toMatchObject({ persistenceUnavailable: true });
  });

  it("falls back to 500 for unexpected errors", async () => {
    const app = appThatThrows(() => new Error("boom"));
    const res = await request(app).get("/boom").expect(500);
    expect(res.body).toMatchObject({ error: "Internal Server Error" });
  });
});
