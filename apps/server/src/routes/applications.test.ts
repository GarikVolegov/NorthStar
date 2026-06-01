import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplicationsRouter,
  createMemoryApplicationStore,
  type ApplicationRecord,
  type ApplicationStore,
} from "./applications";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token(overrides: { userId?: number; role?: string } = {}) {
  return jwt.sign(
    {
      userId: overrides.userId ?? 42,
      name: "Ada",
      email: "ada@example.com",
      role: overrides.role ?? "user",
      onboardingCompleted: true,
      journeyType: "autonomo",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function application(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    id: 7,
    userId: 42,
    company: "NorthStar",
    role: "UX Reliability",
    url: null,
    status: "saved",
    notes: null,
    salary: null,
    location: null,
    appliedAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    notesLog: null,
    ...overrides,
  };
}

function app(store: ApplicationStore = createMemoryApplicationStore()) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/applications", createApplicationsRouter({ store }));
  return instance;
}

describe("applications routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty status only when persistence is connected and no applications exist", async () => {
    const response = await request(app())
      .get("/api/applications/42")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      applications: [],
      status: "empty",
      totalCount: 0,
    });
  });

  it("rejects requests for another user's applications instead of returning an ambiguous empty state", async () => {
    const response = await request(app())
      .get("/api/applications/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(403);

    expect(response.body).toEqual({
      code: "APPLICATIONS_USER_MISMATCH",
      error: "Puoi consultare solo le tue candidature",
    });
  });

  it("lists persisted applications for the authenticated owner", async () => {
    const store = createMemoryApplicationStore([
      application({ updatedAt: "2026-05-20T00:00:00.000Z" }),
      application({
        id: 8,
        company: "Orbit",
        role: "Product Designer",
        status: "interview",
        updatedAt: "2026-05-25T00:00:00.000Z",
      }),
      application({ id: 9, userId: 99, company: "Hidden" }),
    ]);

    const response = await request(app(store))
      .get("/api/applications/42")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      totalCount: 2,
    });
    expect(response.body.applications.map((item: ApplicationRecord) => item.company)).toEqual([
      "Orbit",
      "NorthStar",
    ]);
  });

  it("creates applications with the authenticated user id and trims optional fields", async () => {
    const api = app(createMemoryApplicationStore());

    const created = await request(api)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        company: " NorthStar ",
        role: " UX Reliability ",
        url: " ",
        status: "interview",
        notes: " Follow up ",
      })
      .expect(201);

    expect(created.body).toMatchObject({
      id: 1,
      userId: 42,
      company: "NorthStar",
      role: "UX Reliability",
      url: null,
      status: "interview",
      notes: "Follow up",
    });
  });

  it("updates and deletes only applications owned by the authenticated user", async () => {
    const store = createMemoryApplicationStore([
      application(),
      application({ id: 8, userId: 99, company: "Other" }),
    ]);
    const api = app(store);

    const updated = await request(api)
      .patch("/api/applications/7")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "offer", location: "Milano" })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: 7,
      status: "offer",
      location: "Milano",
    });

    await request(api)
      .patch("/api/applications/8")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "rejected" })
      .expect(404);

    await request(api)
      .delete("/api/applications/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(204);

    await request(api)
      .delete("/api/applications/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(404);
  });

  it("adds and removes diary notes for owned applications", async () => {
    const api = app(createMemoryApplicationStore([application()]));

    const added = await request(api)
      .post("/api/applications/7/notes")
      .set("Authorization", `Bearer ${token()}`)
      .send({ text: " Sent follow-up " })
      .expect(200);

    expect(added.body.notesLog).toEqual([
      {
        text: "Sent follow-up",
        createdAt: expect.any(String),
      },
    ]);

    const removed = await request(api)
      .delete("/api/applications/7/notes/0")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(removed.body.notesLog).toBeNull();
  });

  it("keeps the setup state visible when the applications table is missing", async () => {
    const store = {
      ...createMemoryApplicationStore(),
      list: vi.fn().mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" })),
    };

    const response = await request(app(store))
      .get("/api/applications/42")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      applications: [],
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
      totalCount: 0,
    });
  });

  it("returns an actionable write error when persistence is unavailable", async () => {
    const store = {
      ...createMemoryApplicationStore(),
      create: vi.fn().mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" })),
    };

    const response = await request(app(store))
      .post("/api/applications")
      .set("Authorization", `Bearer ${token()}`)
      .send({ company: "NorthStar", role: "UX Reliability" })
      .expect(503);

    expect(response.body).toMatchObject({
      persistenceUnavailable: true,
      setupAction: "run_migrations",
    });
  });
});
