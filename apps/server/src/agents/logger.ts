import { db, agentLogsTable } from "@workspace/db";
import type { AgentOutput } from "./types";
import { logger } from "../lib/logger";

export interface AgentLogEntry {
  agentName: string;
  userId?: number;
  taskType: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
  retryCount?: number;
}

export async function logAgentCall(entry: AgentLogEntry): Promise<void> {
  try {
    await db.insert(agentLogsTable).values({
      agentName: entry.agentName,
      userId: entry.userId,
      taskType: entry.taskType,
      inputSummary: entry.inputSummary ?? {},
      outputSummary: entry.outputSummary ?? {},
      durationMs: entry.durationMs,
      error: entry.error,
      retryCount: entry.retryCount ?? 0,
    });
  } catch (err) {
    logger.warn({ err, agentName: entry.agentName }, "Failed to write agent log");
  }
}

/**
 * Runs an agent function with:
 * - Retry once on both thrown errors AND returned {success: false}
 * - Structured logging to agent_logs table
 * - Fallback static response on persistent failure
 */
export async function withAgentLog(
  agentName: string,
  taskType: string,
  userId: number | undefined,
  inputSummary: Record<string, unknown>,
  fn: () => Promise<AgentOutput>,
): Promise<AgentOutput> {
  const start = Date.now();
  let retryCount = 0;

  const attempt = async (): Promise<AgentOutput> => {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        agentName,
        success: false,
        data: {},
        error: errorMsg,
      };
    }
  };

  let result = await attempt();

  if (!result.success) {
    retryCount = 1;
    logger.warn({ agentName, taskType, attempt: 1 }, "Agent failed on first attempt, retrying");
    result = await attempt();
  }

  const durationMs = Date.now() - start;

  await logAgentCall({
    agentName,
    userId,
    taskType,
    inputSummary,
    outputSummary: { success: result.success, hasError: !!result.error },
    durationMs,
    error: result.error,
    retryCount,
  });

  return result;
}
