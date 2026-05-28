/**
 * routine-scheduler.test.ts — unit tests for the user-level routine scheduler.
 *
 * Strategy: spy on global.setInterval to capture the tick callback, then call
 * it directly. This avoids fake-timer + OOM issues from repeated timer advances.
 *
 * Tests:
 *  - Dispatches each due routine via executeRoutine
 *  - Advances next_run_at BEFORE calling executeRoutine (double-dispatch prevention)
 *  - Returns dispatched=0 when no routines are due
 *  - Handles executor errors gracefully without aborting the tick
 *  - DB errors in tick are caught — interval itself never throws
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mutable state ─────────────────────────────────────────────────────

const dueRoutines       = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const updateCapture     = vi.hoisted(() => ({ patches: [] as Array<Record<string, unknown>> }));
const executeRoutineMock = vi.hoisted(() => vi.fn<() => Promise<void>>());

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../middleware/logger", () => ({
  rootLogger: {
    child: vi.fn(() => ({
      info:  vi.fn(),
      error: vi.fn(),
      warn:  vi.fn(),
    })),
  },
}));

vi.mock("../lib/routine-schedule", () => ({
  computeNextRun: vi.fn((_schedule: string, _from?: Date) =>
    new Date("2026-06-12T09:00:00.000Z"),
  ),
}));

vi.mock("./routine-executor", () => ({
  executeRoutine: executeRoutineMock,
}));

vi.mock("@workspace/db", () => {
  const userRoutinesTable = {
    id:        "user_routines.id",
    userId:    "user_routines.user_id",
    type:      "user_routines.type",
    schedule:  "user_routines.schedule",
    active:    "user_routines.active",
    nextRunAt: "user_routines.next_run_at",
    lastRunAt: "user_routines.last_run_at",
    updatedAt: "user_routines.updated_at",
  };

  function selectChain() {
    type Chain = {
      from:  ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then:  (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
    };
    const chain: Chain = {
      from:  vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(dueRoutines.rows)),
      then:  (resolve, reject) => Promise.resolve(dueRoutines.rows).then(resolve, reject),
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => selectChain()),
      update: vi.fn(() => ({
        set: vi.fn((patch: Record<string, unknown>) => {
          updateCapture.patches.push(patch);
          return { where: vi.fn(async () => undefined) };
        }),
      })),
    },
    userRoutinesTable,
  };
});

// ── Import subject AFTER mocks ────────────────────────────────────────────────

import { startRoutineScheduler } from "./routine-scheduler";
import { db } from "@workspace/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRoutine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:        1,
    userId:    42,
    type:      "job_monitor",
    schedule:  "every_thursday",
    active:    true,
    nextRunAt: new Date("2026-05-28T09:00:00.000Z"),
    lastRunAt: null,
    ...overrides,
  };
}

/**
 * Spy on setInterval to capture the tick callback, then return a helper
 * that invokes it and waits for all microtasks to settle.
 */
function setupScheduler() {
  let capturedTick: (() => void) | null = null;

  const spy = vi.spyOn(global, "setInterval").mockImplementation(
    (fn: TimerHandler) => {
      capturedTick = fn as () => void;
      return 0 as unknown as ReturnType<typeof setInterval>;
    },
  );

  startRoutineScheduler();

  return {
    intervalSpy: spy,
    runTick: async () => {
      if (!capturedTick) throw new Error("setInterval was never called");
      capturedTick();
      // Drain microtask queue to allow all awaited promises in the tick to settle
      for (let i = 0; i < 6; i++) await Promise.resolve();
      // Give fire-and-forget .catch() promises a chance to resolve
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("startRoutineScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dueRoutines.rows      = [];
    updateCapture.patches = [];
    executeRoutineMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers a setInterval when started", () => {
    const { intervalSpy } = setupScheduler();
    expect(intervalSpy).toHaveBeenCalledOnce();
  });

  it("does not call executeRoutine when no routines are due", async () => {
    dueRoutines.rows = [];
    const { runTick } = setupScheduler();
    await runTick();
    expect(executeRoutineMock).not.toHaveBeenCalled();
  });

  it("calls executeRoutine for each due routine", async () => {
    dueRoutines.rows = [
      makeRoutine({ id: 1, type: "job_monitor" }),
      makeRoutine({ id: 2, type: "market_report" }),
    ];
    const { runTick } = setupScheduler();
    await runTick();
    expect(executeRoutineMock).toHaveBeenCalledTimes(2);
  });

  it("dispatches 3 due routines in one tick", async () => {
    dueRoutines.rows = [
      makeRoutine({ id: 1 }),
      makeRoutine({ id: 2 }),
      makeRoutine({ id: 3 }),
    ];
    const { runTick } = setupScheduler();
    await runTick();
    expect(executeRoutineMock).toHaveBeenCalledTimes(3);
  });

  it("updates lastRunAt and nextRunAt for each dispatched routine", async () => {
    dueRoutines.rows = [makeRoutine({ id: 1 })];
    const { runTick } = setupScheduler();
    await runTick();
    expect(updateCapture.patches.length).toBeGreaterThanOrEqual(1);
    expect(updateCapture.patches[0]).toHaveProperty("lastRunAt");
    expect(updateCapture.patches[0]).toHaveProperty("nextRunAt");
  });

  it("advances next_run_at BEFORE calling executeRoutine", async () => {
    dueRoutines.rows = [makeRoutine({ id: 1 })];

    const callOrder: string[] = [];

    vi.mocked(db.update).mockImplementation(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        callOrder.push("update");
        updateCapture.patches.push(patch);
        return { where: vi.fn(async () => undefined) };
      }),
    } as unknown as ReturnType<typeof db.update>));

    executeRoutineMock.mockImplementation(async () => {
      callOrder.push("execute");
    });

    const { runTick } = setupScheduler();
    await runTick();

    expect(callOrder.indexOf("update")).toBeLessThan(callOrder.indexOf("execute"));
  });

  it("continues dispatching when one executor rejects", async () => {
    dueRoutines.rows = [
      makeRoutine({ id: 1 }),
      makeRoutine({ id: 2 }),
    ];

    executeRoutineMock
      .mockRejectedValueOnce(new Error("executor failure"))
      .mockResolvedValueOnce(undefined);

    const { runTick } = setupScheduler();
    await runTick();

    expect(executeRoutineMock).toHaveBeenCalledTimes(2);
  });

  it("tick catches DB errors and does not throw", async () => {
    vi.mocked(db.select).mockImplementationOnce(() => {
      throw new Error("DB connection lost");
    });

    const { runTick } = setupScheduler();
    await expect(runTick()).resolves.not.toThrow();
  });
});
