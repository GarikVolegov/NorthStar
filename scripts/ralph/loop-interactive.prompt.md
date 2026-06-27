# Ralph Interactive Loop — drive the loop LIVE, in this session

You are the NorthStar autonomous loop running **interactively**, so the founder watches
every step. You run work cycles back-to-back ("continuous with checkpoints"), each fully
visible, until a stop condition fires. Same loop as `loop.sh`, but the work is done by YOU
here (no headless spawn) — observable and interruptible.

## Setup (once)
1. `MAX` = the `/ralph-loop` argument if given, else
   `node scripts/ralph/ralph-cli.mjs config maxIterations` (fallback 12).
2. `MAX_FAILURES` = `node scripts/ralph/ralph-cli.mjs config maxFailures` (fallback 3).
3. Create a todo list with two live counters you keep updated so the founder sees them:
   `iteration N/MAX` and `consecutive failures F/MAX_FAILURES`. Start N=1, F=0.

## The loop (repeat until a STOP CONDITION fires)
For each cycle N:

1. **Kill-switch.** If `scripts/ralph/STOP` exists → print the checkpoint with
   `--result STOP` and END with `<promise>STOP</promise>`.

2. **Run one cycle.** Execute the full protocol in `scripts/ralph/iterate.prompt.md` for a
   single item — live, showing your work (selection, pre-flight gate, area rules, TDD,
   verify, commit/push, the deterministic `decide`, recording, retro). Capture for the
   checkpoint: item id, the emitted sentinel (ITERATION_DONE / NO_WORK / BLOCKED / STOP),
   gate (green/red), the `decide` decision, the commit short-sha (if any), and whether you
   pushed (yes/no).

3. **React to the sentinel** (mirrors `loop.sh`):
   - `ITERATION_DONE` → set F=0.
   - `NO_WORK` → run a discovery cycle live following `scripts/ralph/discover.prompt.md`
     to refill the backlog, then re-check `node scripts/ralph/ralph-cli.mjs next`; if still
     `null` → print the checkpoint and END (no work). Otherwise set F=0.
   - `BLOCKED` (or a red gate you could not make green) → F = F+1.
   - `STOP` → print the checkpoint and END.

4. **Checkpoint.** Print the status block with this cycle's values:
   ```
   node scripts/ralph/ralph-cli.mjs checkpoint \
     --iter N --max MAX --item <ID> --result <SENTINEL> \
     --gate <green|red> --decision <decision> --commit <sha> --push <yes|no> \
     --failures F --max-failures MAX_FAILURES
   ```
   Update the todo counters (N, F) so they stay visible.

5. **Backoff.** If F ≥ MAX_FAILURES → print a one-line halt summary and END with
   `<promise>BLOCKED</promise>` (anti-thrash).

6. **Advance.** If N ≥ MAX → END (reached max iterations). Otherwise N = N+1 and go to 1.

## Stop conditions (any one ends the run)
- STOP file present before a cycle → `<promise>STOP</promise>`.
- Backlog empty and discovery found nothing → end normally.
- F ≥ MAX_FAILURES → `<promise>BLOCKED</promise>`.
- N ≥ MAX → end normally.
- The founder types anything → stop at the current cycle boundary.

## Rules
- Never violate the non-negotiable barriers in `iterate.prompt.md` (no secrets, no
  force-push, real-DB tests, userId from `req.user.id`, atomic commits, security gate,
  never edit `.env*` except `.env.example`).
- Do NOT spawn a headless `claude` — YOU are the agent for every cycle.
- One item per cycle; keep each cycle's work focused and minimal.
