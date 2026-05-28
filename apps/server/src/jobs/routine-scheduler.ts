/**
 * routine-scheduler.ts — user-level routine scheduler.
 *
 * Every 60 seconds:
 *   1. Query `user_routines` WHERE active = true AND next_run_at <= now() LIMIT 50.
 *   2. For each due routine, update next_run_at + last_run_at BEFORE dispatching
 *      (prevents double execution if the process restarts mid-tick).
 *   3. Dispatch executeRoutine() in the background (non-blocking, errors caught).
 *
 * Integrates with the existing cron pattern:
 *   - Uses rootLogger.child() for structured logging.
 *   - safeRunRoutineScheduler() wraps the tick in try/catch so one bad tick
 *     does not kill the interval.
 */
import { db, userRoutinesTable } from "@workspace/db";
import { and, eq, lte, isNotNull } from "drizzle-orm";
import { rootLogger } from "../middleware/logger";
import { computeNextRun } from "../lib/routine-schedule";
import { executeRoutine } from "./routine-executor";

const log = rootLogger.child({ module: "routine-scheduler" });

const ROUTINE_SCHEDULER_INTERVAL_MS = Number(process.env.ROUTINE_SCHEDULER_INTERVAL_MS) || 60_000;
const ROUTINES_PER_TICK             = Number(process.env.ROUTINES_PER_TICK)              || 50;

// ── Tick ──────────────────────────────────────────────────────────────────────

async function runRoutineScheduler(): Promise<{ dispatched: number }> {
  const now = new Date();

  const due = await db
    .select()
    .from(userRoutinesTable)
    .where(
      and(
        eq(userRoutinesTable.active, true),
        isNotNull(userRoutinesTable.nextRunAt),
        lte(userRoutinesTable.nextRunAt, now),
      ),
    )
    .limit(ROUTINES_PER_TICK);

  if (due.length === 0) return { dispatched: 0 };

  for (const routine of due) {
    const nextRunAt = computeNextRun(routine.schedule, now);

    // Advance the schedule BEFORE execution to prevent double-dispatch
    // if the process crashes or restarts while executors are running.
    await db
      .update(userRoutinesTable)
      .set({ lastRunAt: now, nextRunAt, updatedAt: now })
      .where(eq(userRoutinesTable.id, routine.id));

    log.info(
      { routineId: routine.id, userId: routine.userId, type: routine.type, nextRunAt },
      "[scheduler] dispatching routine",
    );

    // Fire-and-forget — errors must not block the rest of the tick
    executeRoutine(routine).catch((err) =>
      log.error({ err, routineId: routine.id, userId: routine.userId }, "[scheduler] routine execution failed"),
    );
  }

  return { dispatched: due.length };
}

// ── Safe wrapper ──────────────────────────────────────────────────────────────

async function safeRunRoutineScheduler(): Promise<void> {
  try {
    const { dispatched } = await runRoutineScheduler();
    if (dispatched > 0) {
      log.info({ dispatched }, "[scheduler] tick complete");
    }
  } catch (err) {
    log.error({ err }, "[scheduler] tick failed");
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startRoutineScheduler(): void {
  log.info({ intervalMs: ROUTINE_SCHEDULER_INTERVAL_MS, limitPerTick: ROUTINES_PER_TICK }, "[scheduler] starting");
  setInterval(() => { void safeRunRoutineScheduler(); }, ROUTINE_SCHEDULER_INTERVAL_MS);
}
