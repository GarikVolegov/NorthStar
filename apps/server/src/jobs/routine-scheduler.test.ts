import { describe, expect, it, vi } from "vitest";
import { runDueRoutines, type RoutineSchedulerStore } from "./routine-scheduler";

const signs = {
  pulse: { key: "pulse", value: 10, status: "green", sparkline: Array(12).fill(10), delta: 0, source: "job" },
  oxygen: { key: "oxygen", value: 10, status: "yellow", sparkline: Array(12).fill(10), delta: 0, source: "role" },
  temperature: { key: "temperature", value: 10, status: "green", sparkline: Array(12).fill(10), delta: 0, source: "news" },
  pressure: { key: "pressure", value: 10, status: "green", sparkline: Array(12).fill(10), delta: 0, source: "pressure" },
  adrenaline: { key: "adrenaline", value: 10, status: "red", sparkline: Array(12).fill(10), delta: 0, source: "weak" },
} as const;

describe("routine scheduler", () => {
  it("includes sector vital signs in market reports when requested", async () => {
    const executions: Array<{ title: string; body: string; metadata: Record<string, unknown> | null }> = [];
    const onOperatorEvent = vi.fn(async () => undefined);
    const store: RoutineSchedulerStore = {
      async listDueRoutines() {
        return [{
          id: 1,
          userId: 42,
          type: "market_report",
          name: "Monitor Tecnologia",
          schedule: "weekly",
          parameters: { sectorId: 7, includeVitals: true, geography: "IT" },
          outputChannel: "wendy_context",
          active: true,
          lastRunAt: null,
          nextRunAt: new Date("2026-05-28T09:00:00.000Z"),
        }];
      },
      async createExecution(input) {
        executions.push({ title: input.title, body: input.body, metadata: input.metadata ?? null });
      },
      async markRoutineRan() {},
    };

    const result = await runDueRoutines({
      now: new Date("2026-05-28T10:00:00.000Z"),
      store,
      computeVitals: vi.fn(async () => ({
        sectorId: 7,
        computedAt: "2026-05-28T10:00:00.000Z",
        geography: "IT",
        signs,
      })),
      onOperatorEvent,
    });

    expect(result.executed).toBe(1);
    expect(onOperatorEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      source: "routine_scheduler",
      triggerType: "routine_execution_created",
      decision: "routine",
      targetType: "routine",
      targetId: "1",
      status: "completed",
    }));
    expect(executions[0]?.body).toContain("Pulse");
    expect(executions[0]?.body).toContain("Oxygen");
    expect(executions[0]?.body).toContain("Temperature");
    expect(executions[0]?.body).toContain("Pressure");
    expect(executions[0]?.body).toContain("Adrenaline");
  });
});
