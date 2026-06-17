/**
 * applications.integration.test.ts — test DB-REALE (no mock DB) del CRUD candidature.
 *
 * Opt-in: gira SOLO con `RUN_DB_INTEGRATION=1` + una DATABASE_URL di test SICURA
 * (es. `RUN_DB_INTEGRATION=1 DATABASE_URL=<test-db> vitest run ...`). Saltato di
 * default — il .env del repo fornisce sempre una DATABASE_URL (prod). Eseguilo in
 * CI `quality` / staging. Conforme a DB_RULES.md (DB reale, niente mock del DB).
 */
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("../lib/jwt-secret", () => ({ JWT_SECRET: "test-secret" }));

import { db, usersTable, jobApplicationsTable } from "@workspace/db";
import applicationsRouter from "./applications";

// Opt-in ESPLICITO: gira solo con RUN_DB_INTEGRATION=1 + una DATABASE_URL di test
// SICURA. NON guardare solo su DATABASE_URL: il .env del repo fornisce sempre una
// DATABASE_URL (prod), quindi un `pnpm test` distratto la eseguirebbe contro prod.
const runIntegration = process.env.RUN_DB_INTEGRATION === "1";

function token(userId: number, email: string): string {
  return jwt.sign(
    {
      userId,
      name: "Test",
      email,
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
  instance.use("/api/applications", applicationsRouter);
  return instance;
}

interface AppBody {
  id: number;
  company: string;
  status: string;
}
interface ListBody {
  applications: AppBody[];
}

describe.skipIf(!runIntegration)("applications CRUD (DB-real integration)", () => {
  let ownerId = 0;
  let otherId = 0;

  beforeAll(async () => {
    const stamp = Date.now();
    const [owner] = await db
      .insert(usersTable)
      .values({ name: "IT Owner", email: `it-owner-${stamp}@test.local` })
      .returning({ id: usersTable.id });
    const [other] = await db
      .insert(usersTable)
      .values({ name: "IT Other", email: `it-other-${stamp}@test.local` })
      .returning({ id: usersTable.id });
    ownerId = owner!.id;
    otherId = other!.id;
  });

  afterAll(async () => {
    await db.delete(jobApplicationsTable).where(eq(jobApplicationsTable.userId, ownerId));
    await db.delete(usersTable).where(eq(usersTable.id, ownerId));
    await db.delete(usersTable).where(eq(usersTable.id, otherId));
  });

  it("requires auth", async () => {
    await request(app()).get(`/api/applications/${ownerId}`).expect(401);
  });

  it("creates, lists, updates and enforces ownership", async () => {
    const ownerToken = token(ownerId, "o@test.local");
    const otherToken = token(otherId, "x@test.local");

    // create — FE status "interview" persists as DB "interviewing", reads back as "interview"
    const created = await request(app())
      .post("/api/applications")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ company: "Acme", role: "Dev", status: "interview" })
      .expect(201);
    const createdBody = created.body as AppBody;
    expect(createdBody.company).toBe("Acme");
    expect(createdBody.status).toBe("interview");
    const appId = createdBody.id;

    // owner lists it
    const list = await request(app())
      .get(`/api/applications/${ownerId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect((list.body as ListBody).applications.some((a) => a.id === appId)).toBe(true);

    // other user does NOT see it
    const otherList = await request(app())
      .get(`/api/applications/${otherId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect((otherList.body as ListBody).applications.some((a) => a.id === appId)).toBe(false);

    // other user cannot patch it (owner-scoped → 404)
    await request(app())
      .patch(`/api/applications/${appId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ status: "offer" })
      .expect(404);

    // owner updates status
    const patched = await request(app())
      .patch(`/api/applications/${appId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "offer" })
      .expect(200);
    expect((patched.body as AppBody).status).toBe("offer");

    // owner deletes
    await request(app())
      .delete(`/api/applications/${appId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    // gone
    const after = await request(app())
      .get(`/api/applications/${ownerId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect((after.body as ListBody).applications.some((a) => a.id === appId)).toBe(false);
  });
});
