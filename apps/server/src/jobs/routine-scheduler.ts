import { and, asc, eq, lte } from "drizzle-orm";
import { computeVitalSigns, type VitalSigns } from "@workspace/ai-server";
import { computeNextRun } from "../lib/routine-schedule";
import { rootLogger } from "../middleware/logger";

export interface SchedulerRoutine {
  id: number;
  userId: number;
  type: string;
  name: string;
  schedule: string;
  parameters: Record<string, unknown>;
  outputChannel: string;
  active: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

export interface RoutineExecutionInput {
  routineId: number;
  userId: number;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaTarget?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RoutineSchedulerStore {
  listDueRoutines(now: Date, limit?: number): Promise<SchedulerRoutine[]>;
  createExecution(input: RoutineExecutionInput): Promise<void>;
  markRoutineRan(routineId: number, patch: { lastRunAt: Date; nextRunAt: Date }): Promise<void>;
}

export interface RunDueRoutinesOptions {
  now?: Date;
  limit?: number;
  store?: RoutineSchedulerStore;
  computeVitals?: (sectorId: number, geography?: string) => Promise<VitalSigns>;
}

const VITAL_LABELS = {
  pulse: "Pulse",
  oxygen: "Oxygen",
  temperature: "Temperature",
  pressure: "Pressure",
  adrenaline: "Adrenaline",
} as const;

export async function runDueRoutines({
  now = new Date(),
  limit = 25,
  store = dbRoutineSchedulerStore,
  computeVitals = computeVitalSigns,
}: RunDueRoutinesOptions = {}): Promise<{ scanned: number; executed: number; failed: number }> {
  const routines = await store.listDueRoutines(now, limit);
  let executed = 0;
  let failed = 0;

  for (const routine of routines) {
    try {
      const execution = await buildRoutineExecution(routine, computeVitals);
      await store.createExecution(execution);
      await store.markRoutineRan(routine.id, {
        lastRunAt: now,
        nextRunAt: computeNextRun(routine.schedule, now),
      });
      executed += 1;
    } catch (err) {
      failed += 1;
      rootLogger.warn({ err, routineId: routine.id }, "[routine-scheduler] routine failed");
    }
  }

  return { scanned: routines.length, executed, failed };
}

async function buildRoutineExecution(
  routine: SchedulerRoutine,
  computeVitals: (sectorId: number, geography?: string) => Promise<VitalSigns>,
): Promise<RoutineExecutionInput> {
  if (routine.type === "market_report") {
    return buildMarketReportExecution(routine, computeVitals);
  }

  return {
    routineId: routine.id,
    userId: routine.userId,
    title: routine.name,
    body: `La routine ${routine.name} e' pronta per essere configurata con un handler dedicato.`,
    metadata: { type: routine.type },
  };
}

async function buildMarketReportExecution(
  routine: SchedulerRoutine,
  computeVitals: (sectorId: number, geography?: string) => Promise<VitalSigns>,
): Promise<RoutineExecutionInput> {
  const sectorId = readPositiveNumber(routine.parameters.sectorId ?? routine.parameters.sector);
  const geography = readString(routine.parameters.geography) ?? "IT";
  const includeVitals = routine.parameters.includeVitals === true;

  const sections = [`# ${routine.name}`, "", "Report di mercato settimanale generato da Wendy."];
  const metadata: Record<string, unknown> = {
    type: "market_report",
    sectorId,
    geography,
    includeVitals,
  };

  if (includeVitals && sectorId) {
    const vitals = await computeVitals(sectorId, geography);
    metadata.vitals = vitals;
    sections.push("", "## Sector Vital Signs", "", formatVitals(vitals));
  }

  return {
    routineId: routine.id,
    userId: routine.userId,
    title: routine.name,
    body: sections.join("\n"),
    ctaLabel: sectorId ? "Apri settore" : null,
    ctaTarget: sectorId ? `/sector/${sectorId}` : null,
    metadata,
  };
}

function formatVitals(vitals: VitalSigns): string {
  return Object.entries(VITAL_LABELS)
    .map(([key, label]) => {
      const sign = vitals.signs[key as keyof typeof VITAL_LABELS];
      return `- **${label}**: ${sign.status} (${Math.round(sign.value)}, ${sign.delta > 0 ? "+" : ""}${sign.delta}%)`;
    })
    .join("\n");
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const dbRoutineSchedulerStore: RoutineSchedulerStore = {
  async listDueRoutines(now, limit = 25) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(userRoutinesTable)
      .where(and(eq(userRoutinesTable.active, true), lte(userRoutinesTable.nextRunAt, now)))
      .orderBy(asc(userRoutinesTable.nextRunAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      name: row.name,
      schedule: row.schedule,
      parameters: row.parameters as Record<string, unknown>,
      outputChannel: row.outputChannel,
      active: row.active,
      lastRunAt: row.lastRunAt,
      nextRunAt: row.nextRunAt,
    }));
  },

  async createExecution(input) {
    const { db, routineExecutionsTable } = await import("@workspace/db");
    await db.insert(routineExecutionsTable).values(input);
  },

  async markRoutineRan(routineId, patch) {
    const { db, userRoutinesTable } = await import("@workspace/db");
    await db
      .update(userRoutinesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userRoutinesTable.id, routineId));
  },
};

export async function safeRunRoutineScheduler(): Promise<void> {
  try {
    rootLogger.info("[routine-scheduler] starting");
    const result = await runDueRoutines();
    rootLogger.info(result, "[routine-scheduler] complete");
  } catch (err) {
    rootLogger.error({ err }, "[routine-scheduler] failed");
  }
}
