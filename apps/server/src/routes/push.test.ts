import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPushRouter } from "./push";
import type { MonthlyRitualNotificationStore } from "../services/monthly-ritual/monthly-ritual.service";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

vi.mock("../services/monthly-ritual/monthly-ritual.repository", () => ({
  dbMonthlyRitualStore: {},
}));

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "autonomo",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store: MonthlyRitualNotificationStore) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/push", createPushRouter({ store }));
  return instance;
}

describe("push routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a browser push subscription", async () => {
    const store = createPushStore();
    await request(app(store))
      .post("/api/push/subscribe")
      .set("Authorization", `Bearer ${token()}`)
      .send({ endpoint: "https://push.example/1", p256dh: "key", auth: "secret" })
      .expect(200);

    expect(store.saved).toEqual([
      { userId: 42, endpoint: "https://push.example/1", p256dh: "key", auth: "secret" },
    ]);
  });

  it("revokes a browser push subscription", async () => {
    const store = createPushStore();
    await request(app(store))
      .delete("/api/push/subscribe")
      .set("Authorization", `Bearer ${token()}`)
      .send({ endpoint: "https://push.example/1" })
      .expect(200);

    expect(store.revoked).toEqual([{ userId: 42, endpoint: "https://push.example/1" }]);
  });

  it("keeps compatibility with generated POST unsubscribe clients", async () => {
    const store = createPushStore();
    await request(app(store))
      .post("/api/push/unsubscribe")
      .set("Authorization", `Bearer ${token()}`)
      .send({ endpoint: "https://push.example/1" })
      .expect(200);

    expect(store.revoked).toEqual([{ userId: 42, endpoint: "https://push.example/1" }]);
  });
});

function createPushStore(): MonthlyRitualNotificationStore & {
  saved: Array<{ userId: number; endpoint: string; p256dh: string; auth: string }>;
  revoked: Array<{ userId: number; endpoint: string | null }>;
} {
  return {
    saved: [],
    revoked: [],
    async getRunByUserAndMonth() { return null; },
    async createRun(input) { return { ...input, id: 1 }; },
    async listEligibleUsers() { return []; },
    async getPreferences() { return { ritualEnabled: true, emailReminderEnabled: false }; },
    async updatePreferences() { return { ritualEnabled: true, emailReminderEnabled: false }; },
    async updateRun(_id, patch) {
      throw new Error(`unexpected updateRun ${JSON.stringify(patch)}`);
    },
    async getRecentRuns() { return []; },
    async listEmailReminderCandidates() { return []; },
    async savePushSubscription(input) {
      this.saved.push({
        userId: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      });
    },
    async revokePushSubscription(userId, endpoint) {
      this.revoked.push({ userId, endpoint: endpoint ?? null });
    },
    async listPushReminderCandidates() { return []; },
    async createRitualFallbackInsight() {},
  };
}
