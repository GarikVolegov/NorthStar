/**
 * market-intelligence.integration.test.ts — test DB-REALE (no mock DB).
 *
 * Verifica: /overview (free) restituisce il radar settori; /signals è gated Pro
 * (402 per free via requireFeature('weak_signals'), dati per Pro). Richiede un
 * Postgres reale via DATABASE_URL; `describe.skipIf` lo salta quando assente.
 */
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("../lib/jwt-secret", () => ({ JWT_SECRET: "test-secret" }));

import { db, usersTable, sectorsTable, subscriptionsTable } from "@workspace/db";
import marketRouter from "./market-intelligence";

const hasDb = !!process.env.DATABASE_URL;

function token(userId: number): string {
  return jwt.sign(
    {
      userId,
      name: "Test",
      email: `u${userId}@test.local`,
      role: "user",
      onboardingCompleted: true,
      journeyType: null,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/market", marketRouter);
  return instance;
}

interface OverviewBody {
  sectors: { id: number; name: string }[];
}
interface SignalsBody {
  signals: unknown[];
  emergingSkills: unknown[];
}

describe.skipIf(!hasDb)("market intelligence (DB-real integration)", () => {
  let freeId = 0;
  let proId = 0;
  let sectorId = 0;

  beforeAll(async () => {
    const stamp = Date.now();
    const [free] = await db
      .insert(usersTable)
      .values({ name: "IT Free", email: `it-free-${stamp}@test.local` })
      .returning({ id: usersTable.id });
    const [pro] = await db
      .insert(usersTable)
      .values({ name: "IT Pro", email: `it-pro-${stamp}@test.local` })
      .returning({ id: usersTable.id });
    freeId = free!.id;
    proId = pro!.id;

    const [sector] = await db
      .insert(sectorsTable)
      .values({
        name: `IT Test Sector ${stamp}`,
        description: "Settore di test integrazione",
        avgSalaryMin: 28000,
        avgSalaryMax: 55000,
        growthRate: 12.5,
        automationRisk: "low",
        scalability: "high",
        trend: "growing",
        timeToAutonomy: "12-18 mesi",
      })
      .returning({ id: sectorsTable.id });
    sectorId = sector!.id;

    // Subscription Pro per l'utente pro (getEffectivePlan legge da DB).
    await db.insert(subscriptionsTable).values({
      userId: proId,
      plan: "pro",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, proId));
    await db.delete(sectorsTable).where(eq(sectorsTable.id, sectorId));
    await db.delete(usersTable).where(eq(usersTable.id, freeId));
    await db.delete(usersTable).where(eq(usersTable.id, proId));
  });

  it("requires auth on /overview", async () => {
    await request(app()).get("/api/market/overview").expect(401);
  });

  it("/overview returns the sector radar for a free user", async () => {
    const res = await request(app())
      .get("/api/market/overview")
      .set("Authorization", `Bearer ${token(freeId)}`)
      .expect(200);
    const body = res.body as OverviewBody;
    expect(Array.isArray(body.sectors)).toBe(true);
    expect(body.sectors.some((s) => s.id === sectorId)).toBe(true);
  });

  it("/signals is gated: 402 for free, data for Pro", async () => {
    const free = await request(app())
      .get("/api/market/signals")
      .set("Authorization", `Bearer ${token(freeId)}`)
      .expect(402);
    expect((free.body as { code?: string }).code).toBe("PLAN_REQUIRED");

    const pro = await request(app())
      .get("/api/market/signals")
      .set("Authorization", `Bearer ${token(proId)}`)
      .expect(200);
    const body = pro.body as SignalsBody;
    expect(Array.isArray(body.signals)).toBe(true);
    expect(Array.isArray(body.emergingSkills)).toBe(true);
  });
});
