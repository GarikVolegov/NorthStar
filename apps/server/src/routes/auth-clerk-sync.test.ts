import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectRows = vi.hoisted(() => ({ queue: [] as Array<Array<Record<string, unknown>>> }));
const insertBehavior = vi.hoisted(() => ({
  throwUnique: false,
  rows: [] as Array<Record<string, unknown>>,
}));
const profileInsertMock = vi.hoisted(() => vi.fn());
const userUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => {
  const usersTable = {
    id: "users.id",
    name: "users.name",
    email: "users.email",
    role: "users.role",
    clerkId: "users.clerkId",
    testSessionId: "users.testSessionId",
    emailVerified: "users.emailVerified",
    stripeSubscriptionId: "users.stripeSubscriptionId",
    journeyType: "users.journeyType",
    avatarUrl: "users.avatarUrl",
    onboardingCompleted: "users.onboardingCompleted",
    updatedAt: "users.updatedAt",
  };
  const userProfileSettingsTable = {
    userId: "profile.userId",
    username: "profile.username",
    workPreference: "profile.workPreference",
    autonomyPreference: "profile.autonomyPreference",
    stabilityPreference: "profile.stabilityPreference",
    timezone: "profile.timezone",
    userMode: "profile.userMode",
    isPublic: "profile.isPublic",
    isAffiliate: "profile.isAffiliate",
    referredByAffiliateId: "profile.referredByAffiliateId",
    referralConvertedAt: "profile.referralConvertedAt",
  };

  function selectChain() {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => selectRows.queue.shift() ?? []),
    };
    return chain;
  }

  return {
    usersTable,
    userProfileSettingsTable,
    generateUsername: vi.fn((name: string, id: number) => `${name.toLowerCase()}-${id}`),
    protectedDbQuery: vi.fn(async (fn: () => Promise<unknown>) => await fn()),
    db: {
      select: vi.fn(() => selectChain()),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: userUpdateMock,
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn(() => ({
          onConflictDoNothing:
            table === userProfileSettingsTable
              ? profileInsertMock.mockResolvedValue([])
              : undefined,
          returning: vi.fn(async () => {
            if (insertBehavior.throwUnique) {
              const err = new Error("duplicate key");
              Object.assign(err, { code: "23505" });
              throw err;
            }
            return insertBehavior.rows;
          }),
        })),
      })),
    },
  };
});

import { registerClerkSyncRoute } from "./auth-clerk-sync";

interface ClerkSyncResponseBody {
  id: number;
  email: string;
  northstar_token: string;
}

function app() {
  const router = express.Router();
  registerClerkSyncRoute(router);
  const instance = express();
  instance.use(express.json());
  instance.use("/api/auth", router);
  return instance;
}

function clerkJwt(sub: string) {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `${header}.${payload}.sig`;
}

function syncedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: "Ada",
    email: "ada@example.com",
    role: "user",
    testSessionId: null,
    emailVerified: true,
    stripeSubscriptionId: null,
    workPreference: "unknown",
    autonomyPreference: 5,
    stabilityPreference: 5,
    timezone: "Europe/Rome",
    userMode: "explorer",
    journeyType: "indeciso",
    avatarUrl: null,
    isPublic: false,
    isAffiliate: false,
    onboardingCompleted: false,
    ...overrides,
  };
}

describe("auth clerk-sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.queue = [];
    insertBehavior.throwUnique = false;
    insertBehavior.rows = [];
  });

  it("recovers from duplicate inserts caused by repeated Clerk sync requests", async () => {
    insertBehavior.throwUnique = true;
    selectRows.queue = [
      [],
      [],
      [syncedUser({ id: 42, name: "Ada Lovelace" })],
    ];

    const response = await request(app())
      .post("/api/auth/clerk-sync")
      .set("Authorization", `Bearer ${clerkJwt("clerk-1")}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        clerkId: "clerk-1",
        email: "ada@example.com",
        name: "Ada Lovelace",
      }))
      .expect(200);

    const body = response.body as ClerkSyncResponseBody;
    expect(body.id).toBe(42);
    expect(body.email).toBe("ada@example.com");
    expect(body.northstar_token).toEqual(expect.any(String));
  });

  it("creates a user and profile settings for first Clerk sync", async () => {
    insertBehavior.rows = [{ id: 43 }];
    selectRows.queue = [
      [],
      [],
      [syncedUser({ id: 43, email: "new@example.com" })],
    ];

    const response = await request(app())
      .post("/api/auth/clerk-sync")
      .set("Authorization", `Bearer ${clerkJwt("clerk-2")}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        clerkId: "clerk-2",
        email: "new@example.com",
        name: "New User",
      }))
      .expect(201);

    expect(profileInsertMock).toHaveBeenCalled();
    const body = response.body as ClerkSyncResponseBody;
    expect(body.id).toBe(43);
    expect(body.email).toBe("new@example.com");
    expect(body.northstar_token).toEqual(expect.any(String));
  });

  it("accepts sync requests without a bearer token and does not return 500", async () => {
    insertBehavior.rows = [{ id: 44 }];
    selectRows.queue = [
      [],
      [],
      [syncedUser({ id: 44, email: "tokenless@example.com" })],
    ];

    const response = await request(app())
      .post("/api/auth/clerk-sync")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        clerkId: "clerk-tokenless",
        email: "tokenless@example.com",
        name: "Tokenless User",
      }))
      .expect(201);

    const body = response.body as ClerkSyncResponseBody;
    expect(body.id).toBe(44);
    expect(body.northstar_token).toEqual(expect.any(String));
  });

  it("recovers when profile settings already exist during email linking", async () => {
    profileInsertMock.mockRejectedValueOnce(Object.assign(new Error("duplicate profile"), { code: "23505" }));
    selectRows.queue = [
      [],
      [{ id: 45 }],
      [syncedUser({ id: 45, email: "linked@example.com" })],
    ];

    const response = await request(app())
      .post("/api/auth/clerk-sync")
      .set("Authorization", `Bearer ${clerkJwt("clerk-linked")}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        clerkId: "clerk-linked",
        email: "linked@example.com",
        name: "Linked User",
      }));

    expect(response.status, JSON.stringify(response.body)).not.toBe(500);
  });

  it("rejects linking an email that is already attached to another Clerk user", async () => {
    selectRows.queue = [
      [],
      [{ id: 46, clerkId: "clerk-existing" }],
    ];

    const response = await request(app())
      .post("/api/auth/clerk-sync")
      .set("Authorization", `Bearer ${clerkJwt("clerk-new")}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({
        clerkId: "clerk-new",
        email: "linked@example.com",
        name: "Wrong Link",
      }))
      .expect(409);

    expect(response.body).toMatchObject({
      code: "CLERK_SYNC_EMAIL_ALREADY_LINKED",
      error: expect.any(String),
    });
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
