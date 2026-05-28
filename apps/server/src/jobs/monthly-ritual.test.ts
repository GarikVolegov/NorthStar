import { describe, expect, it, vi } from "vitest";
import { runMonthlyRitualPushLaunchJob, runMonthlyRitualVigilEmailJob } from "./monthly-ritual";
import type {
  MonthlyRitualNotificationStore,
  MonthlyRitualRunRecord,
} from "../services/monthly-ritual/monthly-ritual.service";

describe("monthly ritual jobs", () => {
  it("sends the vigil email only on the 6th and only once per run", async () => {
    const store = createNotificationStore([
      {
        id: 1,
        email: "ada@example.com",
        name: "Ada",
        journeyType: "dipendente",
        lastActiveAt: new Date("2026-05-01T00:00:00.000Z"),
        ritualEnabled: true,
        emailReminderEnabled: true,
      },
      {
        id: 2,
        email: "skip@example.com",
        name: "Skip",
        journeyType: "autonomo",
        lastActiveAt: new Date("2026-05-01T00:00:00.000Z"),
        ritualEnabled: true,
        emailReminderEnabled: false,
      },
    ]);
    const sendEmail = vi.fn(async () => undefined);

    const first = await runMonthlyRitualVigilEmailJob({
      now: new Date("2026-05-06T10:00:00.000Z"),
      store,
      sendEmail,
    });
    const second = await runMonthlyRitualVigilEmailJob({
      now: new Date("2026-05-06T18:00:00.000Z"),
      store,
      sendEmail,
    });

    expect(first).toMatchObject({ phase: "vigil", candidates: 1, sent: 1, skippedAlreadySent: 0 });
    expect(second).toMatchObject({ phase: "vigil", candidates: 1, sent: 0, skippedAlreadySent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      "ada@example.com",
      expect.objectContaining({ userName: "Ada", ritualUrl: "/dashboard?ritual=notte-fondazione" }),
    );
  });

  it("does nothing outside the vigil day", async () => {
    const sendEmail = vi.fn(async () => undefined);
    const summary = await runMonthlyRitualVigilEmailJob({
      now: new Date("2026-05-07T10:00:00.000Z"),
      store: createNotificationStore([]),
      sendEmail,
    });

    expect(summary).toMatchObject({ phase: "active", candidates: 0, sent: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends launch push on the 7th and creates fallback insight when push fails", async () => {
    const store = createNotificationStore([
      {
        id: 1,
        email: "ada@example.com",
        name: "Ada",
        journeyType: "investitore",
        lastActiveAt: new Date("2026-05-01T00:00:00.000Z"),
        ritualEnabled: true,
        emailReminderEnabled: false,
        push: { endpoint: "https://push.example/fail", p256dh: "key", auth: "secret" },
      },
      {
        id: 2,
        email: "ok@example.com",
        name: "Ok",
        journeyType: "indeciso",
        lastActiveAt: new Date("2026-05-01T00:00:00.000Z"),
        ritualEnabled: true,
        emailReminderEnabled: false,
        push: { endpoint: "https://push.example/ok", p256dh: "key", auth: "secret" },
      },
    ]);
    const sendPush = vi.fn(async (subscription: { endpoint: string }) => ({
      ok: subscription.endpoint.endsWith("/ok"),
    }));
    const notifyLaunch = vi.fn(async () => undefined);

    const summary = await runMonthlyRitualPushLaunchJob({
      now: new Date("2026-05-07T10:00:00.000Z"),
      store,
      sendPush,
      notifyLaunch,
    });

    expect(summary).toMatchObject({
      phase: "active",
      candidates: 2,
      sent: 1,
      failed: 1,
      fallbackInsights: 1,
    });
    expect(store.fallbacks).toEqual([{ userId: 1, challengeKey: "save_trend_to_watch" }]);
    expect(notifyLaunch).toHaveBeenCalledTimes(2);
    expect(notifyLaunch).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      ritualMonth: "2026-05",
      ctaTarget: "/dashboard?ritual=notte-fondazione",
    }));
  });
});

interface UserFixture {
  id: number;
  email: string;
  name: string;
  journeyType: string | null;
  lastActiveAt: Date | null;
  ritualEnabled: boolean;
  emailReminderEnabled: boolean;
  push?: { endpoint: string; p256dh: string; auth: string };
}

function createNotificationStore(users: UserFixture[]): MonthlyRitualNotificationStore & {
  fallbacks: Array<{ userId: number; challengeKey: string }>;
} {
  let id = 0;
  const runs = new Map<string, MonthlyRitualRunRecord>();
  return {
    fallbacks: [],
    async getRunByUserAndMonth(userId, ritualMonth) {
      return runs.get(`${userId}:${ritualMonth}`) ?? null;
    },
    async createRun(input) {
      const run = { ...input, id: ++id };
      runs.set(`${run.userId}:${run.ritualMonth}`, run);
      return run;
    },
    async listEligibleUsers(activeSince) {
      return users.filter((user) => Boolean(user.lastActiveAt && user.lastActiveAt >= activeSince));
    },
    async getPreferences(userId) {
      const user = users.find((candidate) => candidate.id === userId);
      return {
        ritualEnabled: user?.ritualEnabled ?? true,
        emailReminderEnabled: user?.emailReminderEnabled ?? false,
      };
    },
    async updatePreferences(userId, patch) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) return { ritualEnabled: true, emailReminderEnabled: false };
      if (patch.ritualEnabled !== undefined) user.ritualEnabled = patch.ritualEnabled;
      if (patch.emailReminderEnabled !== undefined) user.emailReminderEnabled = patch.emailReminderEnabled;
      return { ritualEnabled: user.ritualEnabled, emailReminderEnabled: user.emailReminderEnabled };
    },
    async updateRun(runId, patch) {
      for (const [key, run] of runs.entries()) {
        if (run.id !== runId) continue;
        const next = { ...run, ...patch };
        runs.set(key, next);
        return next;
      }
      throw new Error("run not found");
    },
    async getRecentRuns(userId) {
      return [...runs.values()].filter((run) => run.userId === userId);
    },
    async listEmailReminderCandidates(activeSince) {
      return users
        .filter((user) => Boolean(user.lastActiveAt && user.lastActiveAt >= activeSince))
        .filter((user) => user.ritualEnabled && user.emailReminderEnabled)
        .map(({ id: userId, email, name, journeyType, lastActiveAt }) => ({
          userId,
          email,
          name,
          journeyType,
          lastActiveAt,
        }));
    },
    async savePushSubscription(input) {
      const user = users.find((candidate) => candidate.id === input.userId);
      if (user) user.push = { endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth };
    },
    async revokePushSubscription(userId, endpoint) {
      const user = users.find((candidate) => candidate.id === userId);
      if (user && (!endpoint || user.push?.endpoint === endpoint)) delete user.push;
    },
    async listPushReminderCandidates(activeSince) {
      return users
        .filter((user) => Boolean(user.lastActiveAt && user.lastActiveAt >= activeSince))
        .filter((user) => user.ritualEnabled && user.push)
        .map((user) => ({
          userId: user.id,
          name: user.name,
          journeyType: user.journeyType,
          lastActiveAt: user.lastActiveAt,
          subscription: {
            userId: user.id,
            endpoint: user.push!.endpoint,
            p256dh: user.push!.p256dh,
            auth: user.push!.auth,
          },
        }));
    },
    async createRitualFallbackInsight(userId, run) {
      this.fallbacks.push({ userId, challengeKey: run.challengeKey });
    },
  };
}
