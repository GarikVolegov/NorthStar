// Safety guards for the autonomous loop: kill-switch + anti-thrash backoff.
//
// Kill-switch: drop a file named STOP in the ralph dir to pause the loop before
// the next iteration (`touch scripts/ralph/STOP`); remove it to resume.
// Backoff: if N iterations in a row fail the gate, halt and write a report
// instead of thrashing.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Name of the kill-switch file. Present in `dir` => the loop must stop. */
export const STOP_FILE = 'STOP';

/** True when a STOP file is present in `dir`. */
export function isStopped(dir) {
  return existsSync(join(dir, STOP_FILE));
}

/** True once consecutive gate failures reach the ceiling (default 3). */
export function shouldHalt(consecutiveFailures, maxFailures = 3) {
  return consecutiveFailures >= maxFailures;
}
