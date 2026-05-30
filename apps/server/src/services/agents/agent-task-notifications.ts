import { eq } from "drizzle-orm";
import { agentTasksTable, db } from "@workspace/db";
import { rootLogger } from "../../middleware/logger";
import { notificationService } from "../notifications/notification.service";

const log = rootLogger.child({ module: "agent-task-notifications" });

export async function notifyAgentTaskFinished(taskId: number): Promise<void> {
  try {
    const [task] = await db
      .select({
        id: agentTasksTable.id,
        userId: agentTasksTable.userId,
        title: agentTasksTable.title,
        status: agentTasksTable.status,
        errorMessage: agentTasksTable.errorMessage,
      })
      .from(agentTasksTable)
      .where(eq(agentTasksTable.id, taskId))
      .limit(1);

    if (!task?.userId || !["completed", "failed"].includes(task.status)) return;

    await notificationService.notify({
      userId: task.userId,
      source: "agent",
      type: `agent_task_${task.status}`,
      severity: task.status === "completed" ? "success" : "warning",
      title: task.status === "completed" ? "Task agente completato" : "Task agente interrotto",
      body:
        task.status === "completed"
          ? `${task.title} e' pronto.`
          : `${task.title} non e' stato completato${task.errorMessage ? `: ${task.errorMessage}` : "."}`,
      ctaLabel: "Apri dashboard",
      ctaUrl: "/dashboard",
      iconKey: "agent",
      dedupeKey: `agent-task-${task.status}:${task.id}`,
      metadata: { taskId: task.id, status: task.status },
      channels: ["in_app"],
    });
  } catch (err) {
    log.warn({ err, taskId }, "task notification failed");
  }
}
