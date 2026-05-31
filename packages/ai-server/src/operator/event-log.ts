import type { OperatorDecision, OperatorEventInput, OperatorEventRecord, OperatorEventStatus, OperatorTargetType } from "./types";

export interface OperatorEventLogStore {
  append(input: OperatorEventInput): Promise<OperatorEventRecord>;
}

export async function appendOperatorEvent(
  input: OperatorEventInput,
  store: OperatorEventLogStore = dbOperatorEventLogStore,
): Promise<OperatorEventRecord> {
  return store.append(input);
}

export const dbOperatorEventLogStore: OperatorEventLogStore = {
  async append(input) {
    const { db, agentOrchestrationEventsTable } = await import("@workspace/db");
    const [row] = await db
      .insert(agentOrchestrationEventsTable)
      .values({
        userId: input.userId ?? null,
        source: input.source,
        triggerType: input.triggerType,
        decision: input.decision,
        targetType: input.targetType,
        targetId: input.targetId == null ? "none" : String(input.targetId),
        status: input.status,
        inputSummary: input.inputSummary ?? "",
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .returning();

    if (!row) {
      throw new Error("Operator event was not created");
    }

    return {
      id: row.id,
      userId: row.userId,
      source: row.source,
      triggerType: row.triggerType,
      decision: row.decision as OperatorDecision,
      targetType: row.targetType as OperatorTargetType,
      targetId: row.targetId,
      status: row.status as OperatorEventStatus,
      inputSummary: row.inputSummary,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
};
