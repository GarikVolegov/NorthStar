/**
 * routine-executor.ts — dispatches a UserRoutine to the correct executor.
 *
 * Responsibilities:
 *   1. Look up the executor for the routine's type in executorMap.
 *   2. Load the owning user from the DB (needed by most executors).
 *   3. Run the executor with a 30-second safety timeout.
 *   4. Hand the result off to deliverRoutineResult.
 *   5. Log duration and any errors without re-throwing (caller uses .catch()).
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rootLogger } from "../middleware/logger";
import { deliverRoutineResult } from "./routine-delivery";
import { executorMap } from "./executors/index";
import type { UserRoutine } from "@workspace/db";

const log = rootLogger.child({ module: "routine-executor" });

const EXECUTOR_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`[executor] timeout after ${ms}ms — ${label}`)), ms),
  );
  return Promise.race([promise, timeout]);
}

export async function executeRoutine(routine: UserRoutine): Promise<void> {
  const executor = executorMap[routine.type];
  if (!executor) {
    log.warn({ routineId: routine.id, type: routine.type }, "[executor] no executor registered for type");
    return;
  }

  // Load user record — required by most executors for personalisation
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, routine.userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    log.warn({ routineId: routine.id, userId: routine.userId }, "[executor] user not found, skipping");
    return;
  }

  const startMs = Date.now();

  const result = await withTimeout(
    executor(routine, user),
    EXECUTOR_TIMEOUT_MS,
    `routineId=${routine.id} type=${routine.type}`,
  );

  const durationMs = Date.now() - startMs;

  await deliverRoutineResult(routine, routine.userId, result);

  log.info(
    { routineId: routine.id, userId: routine.userId, type: routine.type, durationMs },
    "[executor] done",
  );
}
