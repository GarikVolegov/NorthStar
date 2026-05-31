import { describe, expect, it } from "vitest";
import {
  createOrGetMonthlyRitualRun,
  getMonthlyRitualPhase,
  MONTHLY_RITUAL_TIMEZONE,
  prepareMonthlyRitualRuns,
  selectMonthlyRitualChallenge,
  type MonthlyRitualEligibleUser,
  type MonthlyRitualRunRecord,
  type MonthlyRitualOrchestratorStore,
} from "./monthly-ritual.service";

describe("monthly ritual service", () => {
  it("recognizes the vigil and ritual days in Europe/Rome", () => {
    expect(MONTHLY_RITUAL_TIMEZONE).toBe("Europe/Rome");
    expect(getMonthlyRitualPhase(new Date("2026-05-06T10:00:00.000Z"))).toMatchObject({
      phase: "vigil",
      ritualMonth: "2026-05",
    });
    expect(getMonthlyRitualPhase(new Date("2026-05-07T10:00:00.000Z"))).toMatchObject({
      phase: "active",
      ritualMonth: "2026-05",
    });
    expect(getMonthlyRitualPhase(new Date("2026-05-08T10:00:00.000Z")).phase).toBe("inactive");
  });

  it("selects the Scintilla 24h catalog entry by journey type", () => {
    expect(selectMonthlyRitualChallenge("indeciso")).toMatchObject({
      key: "choose_three_directions",
    });
    expect(selectMonthlyRitualChallenge("dipendente")).toMatchObject({
      key: "update_career_goal",
    });
    expect(selectMonthlyRitualChallenge("autonomo")).toMatchObject({
      key: "validate_business_micro_hypothesis",
    });
    expect(selectMonthlyRitualChallenge("azienda")).toMatchObject({
      key: "review_customer_need",
    });
    expect(selectMonthlyRitualChallenge("investitore")).toMatchObject({
      key: "save_trend_to_watch",
    });
  });

  it("creates only one run for a user in the same ritual month", async () => {
    const store = createMemoryMonthlyRitualStore();
    const first = await createOrGetMonthlyRitualRun({
      userId: 42,
      journeyType: "autonomo",
      now: new Date("2026-05-07T08:00:00.000Z"),
      store,
    });
    const second = await createOrGetMonthlyRitualRun({
      userId: 42,
      journeyType: "autonomo",
      now: new Date("2026-05-07T18:00:00.000Z"),
      store,
    });

    expect(second.id).toBe(first.id);
    expect(second.ritualMonth).toBe("2026-05");
    expect(store.createdCount).toBe(1);
  });

  it("prepares the ritual during the vigil for users active in the last 90 days", async () => {
    const store = createMemoryMonthlyRitualStore([
      { id: 1, journeyType: "indeciso", lastActiveAt: new Date("2026-05-01T00:00:00.000Z") },
      { id: 2, journeyType: "dipendente", lastActiveAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);

    const summary = await prepareMonthlyRitualRuns({
      now: new Date("2026-05-06T10:00:00.000Z"),
      store,
    });

    expect(summary).toMatchObject({ phase: "vigil", considered: 1, created: 1, existing: 0 });
    expect(store.createdCount).toBe(1);
  });

  it("creates the ritual on day 7 without duplicating the same month", async () => {
    const store = createMemoryMonthlyRitualStore([
      { id: 1, journeyType: "autonomo", lastActiveAt: new Date("2026-05-01T00:00:00.000Z") },
    ]);

    await prepareMonthlyRitualRuns({ now: new Date("2026-05-07T08:00:00.000Z"), store });
    const summary = await prepareMonthlyRitualRuns({ now: new Date("2026-05-07T18:00:00.000Z"), store });

    expect(summary).toMatchObject({ phase: "active", considered: 1, created: 0, existing: 1 });
    expect(store.createdCount).toBe(1);
  });
});

function createMemoryMonthlyRitualStore(
  users: MonthlyRitualEligibleUser[] = [],
): MonthlyRitualOrchestratorStore & { createdCount: number } {
  let id = 0;
  const runs = new Map<string, MonthlyRitualRunRecord>();
  return {
    createdCount: 0,
    async getRunByUserAndMonth(userId, ritualMonth) {
      return runs.get(`${userId}:${ritualMonth}`) ?? null;
    },
    async listEligibleUsers(since) {
      return users.filter((user) => user.lastActiveAt && user.lastActiveAt >= since);
    },
    async createRun(input) {
      const run = { ...input, id: ++id };
      runs.set(`${run.userId}:${run.ritualMonth}`, run);
      this.createdCount += 1;
      return run;
    },
  };
}
