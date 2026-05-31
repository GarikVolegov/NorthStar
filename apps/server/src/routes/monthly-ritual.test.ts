import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMonthlyRitualRouter } from "./monthly-ritual";
import type {
  MonthlyRitualRunRecord,
  MonthlyRitualUserStore,
} from "../services/monthly-ritual/monthly-ritual.service";

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

function token(journeyType = "autonomo") {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store: MonthlyRitualUserStore, now: Date) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/monthly-ritual", createMonthlyRitualRouter({ store, now: () => now }));
  return instance;
}

describe("monthly ritual routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    await request(app(createMemoryStore(), new Date("2026-05-07T10:00:00.000Z")))
      .get("/api/monthly-ritual/current")
      .expect(401);
  });

  it("returns inactive state outside the 7th with the next ritual date", async () => {
    const response = await request(app(createMemoryStore(), new Date("2026-05-08T10:00:00.000Z")))
      .get("/api/monthly-ritual/current")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      active: false,
      phase: "inactive",
      run: null,
    });
    expect(response.body.nextRitualDate).toBe("2026-06-07");
  });

  it("returns and creates the active ritual run on the 7th", async () => {
    const store = createMemoryStore();
    const response = await request(app(store, new Date("2026-05-07T10:00:00.000Z")))
      .get("/api/monthly-ritual/current")
      .set("Authorization", `Bearer ${token("azienda")}`)
      .expect(200);

    expect(response.body).toMatchObject({
      active: true,
      phase: "active",
      run: {
        ritualMonth: "2026-05",
        challengeKey: "review_customer_need",
        status: "pending",
      },
    });
    expect(store.createdCount).toBe(1);
  });

  it("opens and completes the current Scintilla", async () => {
    const store = createMemoryStore();
    await request(app(store, new Date("2026-05-07T10:00:00.000Z")))
      .post("/api/monthly-ritual/current/open")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    const response = await request(app(store, new Date("2026-05-07T11:00:00.000Z")))
      .post("/api/monthly-ritual/current/challenge/complete")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.run.status).toBe("challenge_completed");
    expect(response.body.run.completedAt).toBeTruthy();
  });

  it("updates ritual preferences", async () => {
    const store = createMemoryStore();
    const response = await request(app(store, new Date("2026-05-08T10:00:00.000Z")))
      .patch("/api/monthly-ritual/preferences")
      .set("Authorization", `Bearer ${token()}`)
      .send({ ritualEnabled: false, emailReminderEnabled: true })
      .expect(200);

    expect(response.body.preferences).toMatchObject({
      ritualEnabled: false,
      emailReminderEnabled: true,
    });
  });
});

function createMemoryStore(): MonthlyRitualUserStore & { createdCount: number } {
  let id = 0;
  const runs = new Map<string, MonthlyRitualRunRecord>();
  const preferences = new Map<number, { ritualEnabled: boolean; emailReminderEnabled: boolean }>();
  return {
    createdCount: 0,
    async getRunByUserAndMonth(userId, ritualMonth) {
      return runs.get(`${userId}:${ritualMonth}`) ?? null;
    },
    async createRun(input) {
      const run = { ...input, id: ++id };
      runs.set(`${run.userId}:${run.ritualMonth}`, run);
      this.createdCount += 1;
      return run;
    },
    async listEligibleUsers() {
      return [];
    },
    async getPreferences(userId) {
      return preferences.get(userId) ?? { ritualEnabled: true, emailReminderEnabled: false };
    },
    async updatePreferences(userId, patch) {
      const next = {
        ritualEnabled: patch.ritualEnabled ?? preferences.get(userId)?.ritualEnabled ?? true,
        emailReminderEnabled: patch.emailReminderEnabled ?? preferences.get(userId)?.emailReminderEnabled ?? false,
      };
      preferences.set(userId, next);
      return next;
    },
    async updateRun(idToUpdate, patch) {
      for (const [key, run] of runs.entries()) {
        if (run.id !== idToUpdate) continue;
        const next = { ...run, ...patch };
        runs.set(key, next);
        return next;
      }
      throw new Error("run not found");
    },
    async getRecentRuns(userId) {
      return [...runs.values()].filter((run) => run.userId === userId);
    },
  };
}
