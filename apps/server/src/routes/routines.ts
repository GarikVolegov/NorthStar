import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { computeNextRun } from "../lib/routine-schedule";
import { requireAuth } from "../middleware/auth";

export interface RoutineRecord {
  id: number;
  userId: number;
  type: "job_monitor" | "market_report" | "mindset_exercise" | "growth_briefing" | "interview_prep" | "discovery_nudge";
  name: string;
  schedule: string;
  parameters: Record<string, unknown>;
  outputChannel: "email" | "in_app" | "wendy_context" | "all";
  active: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineExecutionRecord {
  id: number;
  routineId: number;
  userId: number;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaTarget: string | null;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface RoutinesStore {
  listRoutines(userId: number): Promise<RoutineRecord[]>;
  createRoutine(input: Omit<RoutineRecord, "id" | "lastRunAt" | "createdAt" | "updatedAt">): Promise<RoutineRecord>;
  updateRoutine(userId: number, id: number, patch: Partial<Pick<RoutineRecord, "name" | "schedule" | "parameters" | "outputChannel" | "active">>): Promise<RoutineRecord | null>;
  deleteRoutine(userId: number, id: number): Promise<void>;
  listFeed(userId: number, filters: { type?: string; limit: number }): Promise<RoutineExecutionRecord[]>;
  markFeedRead(userId: number, id: number): Promise<void>;
}

const routineTypeSchema = z.enum(["job_monitor", "market_report", "mindset_exercise", "growth_briefing", "interview_prep", "discovery_nudge"]);
const outputChannelSchema = z.enum(["email", "in_app", "wendy_context", "all"]);

const createRoutineSchema = z.object({
  type: routineTypeSchema,
  name: z.string().trim().min(1).max(120).optional(),
  schedule: z.string().trim().min(1).max(80).default("weekly"),
  parameters: z.record(z.string(), z.unknown()).default({}),
  outputChannel: outputChannelSchema.default("all"),
  active: z.boolean().default(true),
}).strict();

const updateRoutineSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  schedule: z.string().trim().min(1).max(80).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  outputChannel: outputChannelSchema.optional(),
  active: z.boolean().optional(),
}).strict();

export function createRoutinesRouter({ store = dbRoutinesStore }: { store?: RoutinesStore } = {}) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const routines = await store.listRoutines(req.user!.id);
    res.json({ routines: routines.map(serializeRoutine), meta: buildMeta(routines) });
  });

  router.post("/", requireAuth, async (req, res) => {
    const parsed = createRoutineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Routine non valida" });
      return;
    }

    const routines = await store.listRoutines(req.user!.id);
    const meta = buildMeta(routines);
    if (!meta.canCreate) {
      res.status(409).json({ error: "Limite routine attive raggiunto" });
      return;
    }

    const now = new Date();
    const name = parsed.data.name ?? defaultRoutineName(parsed.data.type, parsed.data.parameters);
    const routine = await store.createRoutine({
      userId: req.user!.id,
      type: parsed.data.type,
      name,
      schedule: parsed.data.schedule,
      parameters: parsed.data.parameters,
      outputChannel: parsed.data.outputChannel,
      active: parsed.data.active,
      nextRunAt: computeNextRun(parsed.data.schedule, now),
    });
    res.status(201).json({ routine: serializeRoutine(routine) });
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    const id = readPositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID routine non valido" });
      return;
    }
    const parsed = updateRoutineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Routine non valida" });
      return;
    }
    const patch: Partial<Pick<RoutineRecord, "name" | "schedule" | "parameters" | "outputChannel" | "active">> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.schedule !== undefined) patch.schedule = parsed.data.schedule;
    if (parsed.data.parameters !== undefined) patch.parameters = parsed.data.parameters;
    if (parsed.data.outputChannel !== undefined) patch.outputChannel = parsed.data.outputChannel;
    if (parsed.data.active !== undefined) patch.active = parsed.data.active;
    const routine = await store.updateRoutine(req.user!.id, id, patch);
    if (!routine) {
      res.status(404).json({ error: "Routine non trovata" });
      return;
    }
    res.json({ routine: serializeRoutine(routine) });
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    const id = readPositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID routine non valido" });
      return;
    }
    await store.deleteRoutine(req.user!.id, id);
    res.json({ ok: true });
  });

  router.get("/feed", requireAuth, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const filters: { type?: string; limit: number } = { limit };
    if (type !== undefined) filters.type = type;
    const feed = await store.listFeed(req.user!.id, filters);
    res.json({ feed: feed.map(serializeExecution) });
  });

  router.patch("/feed/:id/read", requireAuth, async (req, res) => {
    const id = readPositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID feed non valido" });
      return;
    }
    await store.markFeedRead(req.user!.id, id);
    res.json({ ok: true });
  });

  return router;
}

export function createMemoryRoutinesStore(): RoutinesStore {
  let nextRoutineId = 1;
  const routines = new Map<number, RoutineRecord>();
  const executions = new Map<number, RoutineExecutionRecord>();

  return {
    async listRoutines(userId) {
      return [...routines.values()].filter((routine) => routine.userId === userId);
    },
    async createRoutine(input) {
      const now = new Date();
      const routine: RoutineRecord = {
        ...input,
        id: nextRoutineId++,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now,
      };
      routines.set(routine.id, routine);
      return routine;
    },
    async updateRoutine(userId, id, patch) {
      const routine = routines.get(id);
      if (!routine || routine.userId !== userId) return null;
      const next = { ...routine, ...patch, updatedAt: new Date() };
      routines.set(id, next);
      return next;
    },
    async deleteRoutine(userId, id) {
      const routine = routines.get(id);
      if (routine?.userId === userId) routines.delete(id);
    },
    async listFeed(userId, filters) {
      return [...executions.values()]
        .filter((execution) => execution.userId === userId)
        .filter((execution) => !filters.type || execution.metadata?.type === filters.type)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, filters.limit);
    },
    async markFeedRead(userId, id) {
      const execution = executions.get(id);
      if (execution?.userId === userId) executions.set(id, { ...execution, readAt: new Date() });
    },
  };
}

export const dbRoutinesStore: RoutinesStore = {
  async listRoutines(userId) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(userRoutinesTable)
      .where(eq(userRoutinesTable.userId, userId))
      .orderBy(desc(userRoutinesTable.createdAt));
    return rows.map(normalizeRoutine);
  },
  async createRoutine(input) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    const [row] = await db.insert(userRoutinesTable).values(input).returning();
    if (!row) throw new Error("routine insert returned no row");
    return normalizeRoutine(row);
  },
  async updateRoutine(userId, id, patch) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    const [row] = await db
      .update(userRoutinesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(userRoutinesTable.id, id), eq(userRoutinesTable.userId, userId)))
      .returning();
    return row ? normalizeRoutine(row) : null;
  },
  async deleteRoutine(userId, id) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    await db
      .delete(userRoutinesTable)
      .where(and(eq(userRoutinesTable.id, id), eq(userRoutinesTable.userId, userId)));
  },
  async listFeed(userId, filters) {
    const { db, routineExecutionsTable, userRoutinesTable } = await import("@workspace/db");
    const rows = await db
      .select({
        id: routineExecutionsTable.id,
        routineId: routineExecutionsTable.routineId,
        userId: routineExecutionsTable.userId,
        title: routineExecutionsTable.title,
        body: routineExecutionsTable.body,
        ctaLabel: routineExecutionsTable.ctaLabel,
        ctaTarget: routineExecutionsTable.ctaTarget,
        metadata: routineExecutionsTable.metadata,
        readAt: routineExecutionsTable.readAt,
        createdAt: routineExecutionsTable.createdAt,
      })
      .from(routineExecutionsTable)
      .leftJoin(userRoutinesTable, eq(userRoutinesTable.id, routineExecutionsTable.routineId))
      .where(and(
        eq(routineExecutionsTable.userId, userId),
        filters.type ? eq(userRoutinesTable.type, filters.type as never) : undefined,
      ))
      .orderBy(desc(routineExecutionsTable.createdAt))
      .limit(filters.limit);
    return rows.map((row) => ({ ...row, metadata: row.metadata as Record<string, unknown> | null }));
  },
  async markFeedRead(userId, id) {
    const { db, routineExecutionsTable } = await import("@workspace/db");
    await db
      .update(routineExecutionsTable)
      .set({ readAt: new Date() })
      .where(and(eq(routineExecutionsTable.id, id), eq(routineExecutionsTable.userId, userId)));
  },
};

function normalizeRoutine(row: {
  id: number;
  userId: number;
  type: RoutineRecord["type"];
  name: string;
  schedule: string;
  parameters: unknown;
  outputChannel: RoutineRecord["outputChannel"];
  active: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RoutineRecord {
  return {
    ...row,
    parameters: isPlainRecord(row.parameters) ? row.parameters : {},
  };
}

function buildMeta(routines: RoutineRecord[]) {
  const activeCount = routines.filter((routine) => routine.active).length;
  const limit = 1;
  return {
    total: routines.length,
    activeCount,
    plan: "free",
    limit,
    canCreate: activeCount < limit,
  };
}

function defaultRoutineName(type: RoutineRecord["type"], parameters: Record<string, unknown>): string {
  if (type === "market_report") return `Market report settore ${String(parameters.sectorId ?? parameters.sector ?? "")}`.trim();
  return type.replace(/_/g, " ");
}

function serializeRoutine(routine: RoutineRecord) {
  return {
    ...routine,
    lastRunAt: routine.lastRunAt?.toISOString() ?? null,
    nextRunAt: routine.nextRunAt?.toISOString() ?? null,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  };
}

function serializeExecution(execution: RoutineExecutionRecord) {
  return {
    ...execution,
    readAt: execution.readAt?.toISOString() ?? null,
    createdAt: execution.createdAt.toISOString(),
  };
}

function readPositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default createRoutinesRouter();
