import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));

vi.mock("@workspace/db", () => ({
  usersTable: {
    id: "id",
    role: "role",
  },
  auditLogTable: {},
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => dbRows.value),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  },
  hashIp: vi.fn(() => "hashed-ip"),
  checkDatabaseHealth: vi.fn(async () => true),
  pool: { totalCount: 1, idleCount: 1, waitingCount: 0 },
}));

vi.mock("../../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

import { requireAdminAccess } from "../../middleware/auth";
import adminWendyRouter from "./wendy";

function authToken(role: "user" | "admin") {
  return jwt.sign(
    {
      userId: 7,
      name: "Ada",
      email: "ada@example.com",
      role,
      onboardingCompleted: true,
      journeyType: null,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/admin", requireAdminAccess, adminWendyRouter);
  return testApp;
}

function parseSse(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as Record<string, unknown>);
}

describe("admin Wendy route", () => {
  beforeEach(() => {
    dbRows.value = [];
    process.env.WENDY_ADMIN_ENABLED = "true";
    process.env.WENDY_ADMIN_ACTION_SECRET = "test-action-secret";
  });

  it("returns 401 for unauthenticated requests and 403 for non-admin users", async () => {
    await request(app()).post("/api/admin/wendy").send({ message: "ciao" }).expect(401);

    dbRows.value = [{ role: "user" }];
    await request(app())
      .post("/api/admin/wendy")
      .set("Authorization", `Bearer ${authToken("user")}`)
      .send({ message: "ciao" })
      .expect(403);
  });

  it("streams status, token, and done for admins", async () => {
    dbRows.value = [{ role: "admin" }];
    const response = await request(app())
      .post("/api/admin/wendy")
      .set("Authorization", `Bearer ${authToken("admin")}`)
      .send({ message: "fammi una panoramica", adminContext: { section: "home" } })
      .expect(200);

    const events = parseSse(response.text);
    expect(events.map((event) => event.type)).toContain("status");
    expect(events.map((event) => event.type)).toContain("token");
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("streams admin action cards for write tools", async () => {
    dbRows.value = [{ role: "admin" }];
    const response = await request(app())
      .post("/api/admin/wendy")
      .set("Authorization", `Bearer ${authToken("admin")}`)
      .send({ message: "avvia agent collector", adminContext: { section: "agents" } })
      .expect(200);

    const toolEvent = parseSse(response.text).find((event) => event.type === "tool_call");
    expect(toolEvent).toMatchObject({ name: "admin_run_agent" });
    expect(toolEvent?.result).toMatchObject({
      wendyAction: {
        type: "admin_run_agent",
        actionToken: expect.any(String) as unknown as string,
      },
    });
  });

  it("rejects high-risk confirmation without exact text", async () => {
    dbRows.value = [{ role: "admin" }];
    const response = await request(app())
      .post("/api/admin/wendy")
      .set("Authorization", `Bearer ${authToken("admin")}`)
      .send({ message: "restart database", adminContext: { section: "status" } })
      .expect(200);
    const toolEvent = parseSse(response.text).find((event) => event.type === "tool_call");
    const action = (toolEvent?.result as { wendyAction?: { actionToken?: string } }).wendyAction;

    await request(app())
      .post("/api/admin/wendy/actions/confirm")
      .set("Authorization", `Bearer ${authToken("admin")}`)
      .send({ actionToken: action?.actionToken, confirmationText: "restart database" })
      .expect(400);
  });
});
