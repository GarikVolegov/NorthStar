/**
 * agents.ts — Route per il sistema agenti AI dipendenti.
 *
 * GET  /api/agents                  — lista agenti disponibili
 * GET  /api/agents/tasks            — task dell'utente corrente
 * POST /api/agents/tasks            — crea e avvia un nuovo task
 * GET  /api/agents/tasks/:id        — dettaglio task con output
 * POST /api/agents/tasks/:id/cancel — cancella task
 */
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, inArray, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import { db, agentEmployeesTable, agentTasksTable } from "@workspace/db";
import { isOneOf } from "../lib/type-guards";
import { agentRegistry } from "../lib/agent-registry";
import { appendOperatorEvent } from "@workspace/ai-server";
import { notifyAgentTaskFinished } from "../services/agents/agent-task-notifications";

const router = Router();
const log = rootLogger.child({ module: "agents" });
const AGENT_TASK_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
const AGENT_TASK_QUEUE_LOCK_NAMESPACE = 3001;

router.get("/operator/status", requireAuth, async (_req, res) => {
  try {
    const snapshot = await agentRegistry.getSnapshot();
    res.json({
      ok: true,
      health: snapshot.aggregates.executing > snapshot.aggregates.online ? "degraded" : "ok",
      generatedAt: snapshot.generatedAt,
      snapshot,
    });
  } catch (e) {
    log.error({ e }, "[agents] operator status error");
    res.status(500).json({ error: "Errore nel recupero dello stato operator" });
  }
});

// ── GET /api/agents ────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  try {
    const agents = await db
      .select({
        slug: agentEmployeesTable.slug,
        name: agentEmployeesTable.name,
        role: agentEmployeesTable.role,
        domain: agentEmployeesTable.domain,
        avatar: agentEmployeesTable.avatar,
        color: agentEmployeesTable.color,
        description: agentEmployeesTable.description,
        capabilities: agentEmployeesTable.capabilities,
        sortOrder: agentEmployeesTable.sortOrder,
      })
      .from(agentEmployeesTable)
      .where(eq(agentEmployeesTable.isActive, true))
      .orderBy(agentEmployeesTable.sortOrder);

    res.json({ agents });
  } catch (e) {
    log.error({ e }, "[agents] list error");
    res.status(500).json({ error: "Errore nel recupero degli agenti" });
  }
});

// ── GET /api/agents/tasks ─────────────────────────────────────────────────────

router.get("/tasks", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
  const status = req.query.status as string | undefined;

  try {
    let query = db
      .select({
        id: agentTasksTable.id,
        agentSlug: agentTasksTable.agentSlug,
        title: agentTasksTable.title,
        status: agentTasksTable.status,
        queuedAt: agentTasksTable.queuedAt,
        completedAt: agentTasksTable.completedAt,
        durationMs: agentTasksTable.durationMs,
        errorMessage: agentTasksTable.errorMessage,
      })
      .from(agentTasksTable)
      .where(
        status && isOneOf(status, AGENT_TASK_STATUSES)
          ? and(
              eq(agentTasksTable.userId, userId),
              eq(agentTasksTable.status, status),
            )
          : eq(agentTasksTable.userId, userId),
      )
      .orderBy(desc(agentTasksTable.queuedAt))
      .limit(limit);

    const tasks = await query;
    res.json({ tasks });
  } catch (e) {
    log.error({ e, userId }, "[agents] list tasks error");
    res.status(500).json({ error: "Errore nel recupero dei task" });
  }
});

// ── POST /api/agents/tasks ────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  agentSlug: z.string().min(1),
  title: z.string().min(2).max(200),
  prompt: z.string().min(10).max(4000),
  contextType: z.string().optional(),
  contextId: z.number().int().positive().optional(),
  contextData: z.record(z.unknown()).optional(),
});

router.post("/tasks", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const creation = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AGENT_TASK_QUEUE_LOCK_NAMESPACE}, ${userId})`);

      const [agent] = await tx
        .select({ slug: agentEmployeesTable.slug })
        .from(agentEmployeesTable)
        .where(
          and(
            eq(agentEmployeesTable.slug, parsed.data.agentSlug),
            eq(agentEmployeesTable.isActive, true),
          ),
        )
        .limit(1);

      if (!agent) return { status: "missing_agent" as const };

      const [taskCount] = await tx
        .select({ value: count() })
        .from(agentTasksTable)
        .where(
          and(
            eq(agentTasksTable.userId, userId),
            inArray(agentTasksTable.status, ["queued", "running"]),
          ),
        )
        .limit(1);

      if ((taskCount?.value ?? 0) >= 5) {
        return { status: "limit_reached" as const };
      }

      const [task] = await tx
        .insert(agentTasksTable)
        .values({
          userId,
          agentSlug: parsed.data.agentSlug,
          title: parsed.data.title,
          prompt: parsed.data.prompt,
          contextType: parsed.data.contextType,
          contextId: parsed.data.contextId,
          contextData: parsed.data.contextData,
          status: "queued",
        })
        .returning({ id: agentTasksTable.id });

      if (!task) {
        throw new Error("Task non creato");
      }

      return { status: "created" as const, task };
    });

    if (creation.status === "missing_agent") {
      res
        .status(404)
        .json({ error: `Agente ${parsed.data.agentSlug} non trovato` });
      return;
    }

    if (creation.status === "limit_reached") {
      res
        .status(429)
        .json({
          error:
            "Hai raggiunto il limite di task in coda (max 5). Attendi il completamento di alcuni.",
        });
      return;
    }

    const { task } = creation;

    const event = await safeAppendAgentTaskCreatedEvent({
      userId,
      source: "agent_route",
      triggerType: "agent_task_created",
      decision: "agent_task",
      targetType: "agent_task",
      targetId: String(task.id),
      status: "dispatched",
      inputSummary: parsed.data.title,
      metadata: {
        agentSlug: parsed.data.agentSlug,
        executionMode: "background",
        contextType: parsed.data.contextType ?? null,
        contextId: parsed.data.contextId ?? null,
      },
    });

    log.info(
      { userId, taskId: task.id, agentSlug: parsed.data.agentSlug },
      "[agents] task created",
    );

    // Esegui il task in background (fire-and-forget)
    import("@workspace/ai-server")
      .then(async ({ executeAgentTask }) => {
        await executeAgentTask(task.id, { source: "agent_route" });
        await notifyAgentTaskFinished(task.id);
      })
      .catch((err) =>
        log.error({ err, taskId: task.id }, "[agents] executor error"),
      );

    res.status(201).json({
      ok: true,
      taskId: task.id,
      ...(event ? { orchestrationEventId: event.id } : {}),
      executionMode: "background",
    });
  } catch (e) {
    log.error({ e, userId }, "[agents] create task error");
    res.status(500).json({ error: "Errore nella creazione del task" });
  }
});

async function safeAppendAgentTaskCreatedEvent(input: Parameters<typeof appendOperatorEvent>[0]) {
  try {
    return await appendOperatorEvent(input);
  } catch (err) {
    log.warn({ err, targetId: input.targetId }, "[agents] operator event append failed");
    return null;
  }
}

// ── GET /api/agents/tasks/:id ─────────────────────────────────────────────────

router.get("/tasks/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const taskId = parseInt(req.params.id ?? "", 10);
  if (isNaN(taskId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  try {
    const [task] = await db
      .select()
      .from(agentTasksTable)
      .where(
        and(eq(agentTasksTable.id, taskId), eq(agentTasksTable.userId, userId)),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task non trovato" });
      return;
    }
    res.json(task);
  } catch (e) {
    log.error({ e, taskId }, "[agents] get task error");
    res.status(500).json({ error: "Errore nel recupero del task" });
  }
});

// ── POST /api/agents/tasks/:id/cancel ────────────────────────────────────────

router.post("/tasks/:id/cancel", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const taskId = parseInt(req.params.id ?? "", 10);
  if (isNaN(taskId)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }

  try {
    const [updated] = await db
      .update(agentTasksTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(agentTasksTable.id, taskId),
          eq(agentTasksTable.userId, userId),
          eq(agentTasksTable.status, "queued"),
        ),
      )
      .returning({ id: agentTasksTable.id });

    if (!updated) {
      res.status(400).json({ error: "Task non cancellabile (non in coda)" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, taskId }, "[agents] cancel task error");
    res.status(500).json({ error: "Errore nella cancellazione del task" });
  }
});

export default router;
