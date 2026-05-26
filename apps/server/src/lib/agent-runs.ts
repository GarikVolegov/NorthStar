import { agentRunsTable, db } from "@workspace/db";

export async function writeAgentRunSnapshot(params: {
  agentName: string;
  taskType: string;
  startedAt: Date;
  status: "completed" | "failed";
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
}) {
  const finishedAt = new Date();
  const [run] = await db
    .insert(agentRunsTable)
    .values({
      agentName: params.agentName,
      taskType: params.taskType,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      status: params.status,
      startedAt: params.startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - params.startedAt.getTime(),
      errorMessage: params.errorMessage,
    })
    .returning();
  if (!run) {
    throw new Error("Agent run snapshot insert failed");
  }
  return run;
}
