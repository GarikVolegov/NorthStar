#!/bin/bash
# NorthStar autonomous development loop — durable overnight runner.
#
# Evolves ralph.sh from a per-PRD loop into a CONTINUOUS, backlog-driven loop:
# each iteration runs the iteration brain (iterate.prompt.md) headless, reacts to
# the sentinel it emits, refills the backlog via discovery when empty, and backs
# off after repeated failures. The kill-switch (scripts/ralph/STOP) pauses it.
#
# Usage: scripts/ralph/loop.sh [max_iterations]
#   - mode (dry-run|pr-only|full-auto), maxIterations, maxFailures come from
#     loop.config.json unless overridden by the arg.
#
# Safety: this calls `claude --dangerously-skip-permissions` for unattended work.
# Run it ONLY with the working tree on a feature branch and loop.config.json in
# the mode you intend (start at dry-run).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLI="node $SCRIPT_DIR/ralph-cli.mjs"
STOP_FILE="$SCRIPT_DIR/STOP"
RUN_LOG="$SCRIPT_DIR/journal/run-$(date +%Y-%m-%d).log"
mkdir -p "$SCRIPT_DIR/journal"

# Resolve knobs (arg overrides config).
MAX_ITERATIONS="${1:-$($CLI config maxIterations 2>/dev/null || echo 12)}"
MAX_FAILURES="$($CLI config maxFailures 2>/dev/null || echo 3)"
MODE="$($CLI mode 2>/dev/null || echo dry-run)"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$RUN_LOG"; }

run_brain() {
  # $1 = prompt file. Returns claude's stdout; never aborts the loop on failure.
  claude --dangerously-skip-permissions --print < "$1" 2>&1 | tee -a "$RUN_LOG"
}

log "=== Ralph loop start — mode=$MODE max_iter=$MAX_ITERATIONS max_fail=$MAX_FAILURES ==="

consecutive_failures=0

for i in $(seq 1 "$MAX_ITERATIONS"); do
  # Kill-switch check before each iteration.
  if [ -f "$STOP_FILE" ]; then
    log "STOP file present — pausing loop at iteration $i."
    exit 0
  fi

  log "--- Iteration $i/$MAX_ITERATIONS ---"
  OUTPUT="$(run_brain "$SCRIPT_DIR/iterate.prompt.md")"

  if echo "$OUTPUT" | grep -q "<promise>STOP</promise>"; then
    log "Brain reported STOP — exiting."
    exit 0
  elif echo "$OUTPUT" | grep -q "<promise>NO_WORK</promise>"; then
    log "Backlog empty — running a discovery iteration to refill it."
    run_brain "$SCRIPT_DIR/discover.prompt.md" >/dev/null
    # If discovery added nothing, the next `next` will still be null → stop to avoid spinning.
    if [ "$($CLI next)" = "null" ]; then
      log "Discovery found no new work — stopping."
      exit 0
    fi
    consecutive_failures=0
  elif echo "$OUTPUT" | grep -q "<promise>BLOCKED</promise>"; then
    consecutive_failures=$((consecutive_failures + 1))
    log "Iteration BLOCKED ($consecutive_failures/$MAX_FAILURES consecutive)."
    if [ "$consecutive_failures" -ge "$MAX_FAILURES" ]; then
      log "Backoff ceiling reached — halting. See journal for the report."
      exit 1
    fi
  elif echo "$OUTPUT" | grep -q "<promise>ITERATION_DONE</promise>"; then
    consecutive_failures=0
    log "Iteration $i complete."
  else
    consecutive_failures=$((consecutive_failures + 1))
    log "No sentinel emitted — treating as failure ($consecutive_failures/$MAX_FAILURES)."
    if [ "$consecutive_failures" -ge "$MAX_FAILURES" ]; then
      log "Backoff ceiling reached — halting."
      exit 1
    fi
  fi

  sleep 2
done

log "=== Reached max iterations ($MAX_ITERATIONS). Stopping. ==="
exit 0
