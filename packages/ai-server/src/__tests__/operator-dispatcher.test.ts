import { describe, expect, it, vi } from "vitest";
import {
  dispatchQueuedAgentTasks,
  recoverStaleAgentTasks,
  type OperatorDispatcherStore,
} from "../operator/dispatcher";

describe("operator dispatcher", () => {
  it("dispatches queued agent tasks through the executor", async () => {
    const executeTask = vi.fn(async () => undefined);
    const store: OperatorDispatcherStore = {
      listQueuedAgentTasks: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
      markStaleAgentTasksFailed: vi.fn(),
    };

    const result = await dispatchQueuedAgentTasks({ store, executeTask, limit: 2 });

    expect(result).toEqual({ scanned: 2, dispatched: 2, failed: 0 });
    expect(executeTask).toHaveBeenCalledWith(1, expect.objectContaining({ source: "operator" }));
    expect(executeTask).toHaveBeenCalledWith(2, expect.objectContaining({ source: "operator" }));
  });

  it("marks stale running tasks as failed instead of retrying without attempts", async () => {
    const now = new Date("2026-05-30T10:00:00.000Z");
    const store: OperatorDispatcherStore = {
      listQueuedAgentTasks: vi.fn(),
      markStaleAgentTasksFailed: vi.fn(async () => [5, 8]),
    };

    const result = await recoverStaleAgentTasks({
      store,
      now,
      runningTimeoutMs: 30 * 60 * 1000,
    });

    expect(result).toEqual({ recovered: 2, failedTaskIds: [5, 8] });
    expect(store.markStaleAgentTasksFailed).toHaveBeenCalledWith({
      cutoff: new Date("2026-05-30T09:30:00.000Z"),
      now,
      errorMessage: "stale_operator_recovery",
      limit: 25,
    });
  });
});
