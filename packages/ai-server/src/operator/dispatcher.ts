import { and, asc, eq, lt, sql } from "drizzle-orm";
import { executeAgentTask, type ExecuteAgentTaskOptions } from "../agents/agent-executor";

export interface QueuedAgentTaskRef {
  id: number;
}

export interface MarkStaleAgentTasksFailedInput {
  cutoff: Date;
  now: Date;
  errorMessage: string;
  limit: number;
}

export interface OperatorDispatcherStore {
  listQueuedAgentTasks(limit: number): Promise<QueuedAgentTaskRef[]>;
  markStaleAgentTasksFailed(input: MarkStaleAgentTasksFailedInput): Promise<number[]>;
}

export interface DispatchQueuedAgentTasksOptions {
  limit?: number;
  store?: OperatorDispatcherStore;
  executeTask?: (taskId: number, options?: ExecuteAgentTaskOptions) => Promise<void>;
}

export interface RecoverStaleAgentTasksOptions {
  now?: Date;
  runningTimeoutMs?: number;
  limit?: number;
  store?: OperatorDispatcherStore;
}

export async function dispatchQueuedAgentTasks({
  limit = 10,
  store = dbOperatorDispatcherStore,
  executeTask = executeAgentTask,
}: DispatchQueuedAgentTasksOptions = {}): Promise<{ scanned: number; dispatched: number; failed: number }> {
  const tasks = await store.listQueuedAgentTasks(limit);
  let dispatched = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      await executeTask(task.id, { source: "operator" });
      dispatched += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: tasks.length, dispatched, failed };
}

export async function recoverStaleAgentTasks({
  now = new Date(),
  runningTimeoutMs = 60 * 60 * 1000,
  limit = 25,
  store = dbOperatorDispatcherStore,
}: RecoverStaleAgentTasksOptions = {}): Promise<{ recovered: number; failedTaskIds: number[] }> {
  const cutoff = new Date(now.getTime() - runningTimeoutMs);
  const failedTaskIds = await store.markStaleAgentTasksFailed({
    cutoff,
    now,
    errorMessage: "stale_operator_recovery",
    limit,
  });
  return { recovered: failedTaskIds.length, failedTaskIds };
}

export const dbOperatorDispatcherStore: OperatorDispatcherStore = {
  async listQueuedAgentTasks(limit) {
    const { db, agentTasksTable } = await import("@workspace/db");
    return db
      .select({ id: agentTasksTable.id })
      .from(agentTasksTable)
      .where(eq(agentTasksTable.status, "queued"))
      .orderBy(asc(agentTasksTable.queuedAt))
      .limit(limit);
  },

  async markStaleAgentTasksFailed(input) {
    const { db, agentTasksTable } = await import("@workspace/db");
    const staleRows = await db
      .select({ id: agentTasksTable.id })
      .from(agentTasksTable)
      .where(
        and(
          eq(agentTasksTable.status, "running"),
          lt(sql`coalesce(${agentTasksTable.startedAt}, ${agentTasksTable.updatedAt})`, input.cutoff),
        ),
      )
      .limit(input.limit);

    const ids = staleRows.map((row) => row.id);
    if (ids.length === 0) return [];

    await Promise.all(
      ids.map((id) =>
        db
          .update(agentTasksTable)
          .set({
            status: "failed",
            errorMessage: input.errorMessage,
            completedAt: input.now,
            updatedAt: input.now,
          })
          .where(and(eq(agentTasksTable.id, id), eq(agentTasksTable.status, "running"))),
      ),
    );

    return ids;
  },
};
