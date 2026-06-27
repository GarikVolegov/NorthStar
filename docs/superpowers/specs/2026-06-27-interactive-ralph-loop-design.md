# Interactive Ralph Loop (`/ralph-loop`) — Design

> **Status:** approved (founder, 2026-06-27) · **Author:** Opus 4.8
> **Topic:** make the autonomous loop observable by running it live, in-session.

## 1. Problem

The autonomous loop today runs only via `scripts/ralph/loop.sh`, which spawns
`claude --dangerously-skip-permissions --print` per iteration (headless), captures
stdout to a run-log file, and reacts to the `<promise>` sentinel. The founder cannot
**watch** it work — it is fire-and-forget, visible only as a log after the fact.

> Founder, verbatim: *"voglio creare un agente vero e proprio che lavora in loop e non
> un loop a caso che non posso neanche vedere che sta facendo."*

## 2. Goal & decisions

Run the loop **inside an interactive Claude Code session** so every reasoning step,
tool call, and decision streams live and can be interrupted at any time.

Decisions taken during brainstorming:
- **Experience:** watch it live in the terminal (the loop runs in-session; *this* agent
  does the work — no headless `--print`).
- **Cadence:** continuous with checkpoints — after each iteration print a compact status
  block, then start the next automatically until a stop condition fires.
- **Launch:** a new dedicated `/ralph-loop` slash command. `loop.sh` **stays** for
  unattended overnight headless runs. Deterministic logic is shared.
- **Approach A** (chosen): thin skill + a deterministic checkpoint renderer in the CLI.
  Full extraction of the control flow into the CLI (Approach B) is an optional follow-up
  if drift is felt.

Non-goals (YAGNI): a separate web/TUI dashboard (explicitly rejected); per-step
human approval (not requested); changing the per-iteration brain or the deterministic
selection/decision logic.

## 3. Key principle — no duplication of the brain

`loop.sh` does two jobs: (1) the **control flow** (STOP → backoff → discovery-on-empty →
max-iter) and (2) **spawning headless claude**. The interactive loop keeps (1) and drops
(2): the live agent performs the work. The **per-iteration brain stays single-sourced**
in `scripts/ralph/iterate.prompt.md` (already reused by `/ralph-iterate` and `loop.sh`).
The deterministic selection/decision logic already lives in `ralph-cli.mjs`
(`next` / `decide`); the interactive loop calls the same commands.

## 4. Components

| File | Role | Change |
|---|---|---|
| `.claude/commands/ralph-loop.md` | New slash command `/ralph-loop [max]`. Thin: delegates to the interactive-loop brain. | new |
| `scripts/ralph/loop-interactive.prompt.md` | The in-session loop brain: control flow executed **by this agent**, reusing `iterate.prompt.md` for each cycle, and printing a checkpoint between cycles. | new |
| `scripts/ralph/ralph-cli.mjs` | Add a `checkpoint` subcommand that renders the status block deterministically (same state `loop.sh` would observe). | modify |
| `scripts/ralph/lib/checkpoint.mjs` (+ `.test.mjs`) | Pure `renderCheckpoint(state)` → block string. Unit-tested with `node --test` (part of `pnpm ralph:test`). | new |
| `scripts/ralph/README.md` | Document the two modes: `/ralph-loop` (live, attended) vs `loop.sh` (headless, overnight). | modify |

`loop.sh` is **not** touched — zero risk to the working overnight runner.

## 5. Per-iteration flow (live)

Each cycle, fully visible:
1. Execute the `iterate.prompt.md` protocol for one item (select → pre-flight gate →
   area rules → TDD → verify → commit/push → decide → record → retro). Reasoning and
   tool calls stream in real time.
2. Print the **checkpoint** (below), then — "continuous with checkpoints" — immediately
   begin the next cycle unless a stop condition fires.

### Checkpoint format

Rendered by `ralph-cli.mjs checkpoint` (deterministic; pure function in `lib/checkpoint.mjs`):

```
─── Ralph · iterazione 3/12 ─────────────────────────
 item      CHORE-001 · chore/P0 · "verify gate green"
 gate      🟢 green        decisione  report (dry-run)
 commit    abc1234         push       sì
 esito     ITERATION_DONE  fail       0/3
 prossimo  IMP-001 · improvement/P2 · "deprecate route-paths.ts"
 backlog   todo 2 · in_progress 0 · blocked 3 · done 3   mode pr-only
──────────────────────────────────────────────────────
```

The CLI command accepts the iteration-local facts as flags (iteration number, last item,
result, gate, decision, commit, consecutive failures) and derives the rest from files
(backlog summary, next item, mode, STOP). This keeps rendering centralized and identical
across surfaces.

Example:
`node scripts/ralph/ralph-cli.mjs checkpoint --iter 3 --max 12 --item CHORE-001 --result ITERATION_DONE --gate green --decision report --commit abc1234 --failures 0`

## 6. Control flow (in-session, ported from `loop.sh`)

Executed by the agent, mirroring `loop.sh`:
- **STOP**: before each cycle, check `scripts/ralph/STOP`. If present → print the last
  checkpoint and end with `<promise>STOP</promise>`.
- **NO_WORK**: empty backlog → run a discovery cycle (`discover.prompt.md`) to refill it;
  if still empty, stop (no spinning).
- **BLOCKED / red gate**: increment the consecutive-failure counter; at `maxFailures`
  (default 3) → halt with a summary (anti-thrash backoff).
- **max-iter**: after `maxIterations` (default 12, overridable via `/ralph-loop <n>`),
  stop cleanly.
- **Interrupt**: being in-session, the founder typing anything stops the agent at the
  current cycle boundary.

Iteration-local counters (cycle number, consecutive failures) are tracked in-session via
the todo list so the founder **sees** them; all other state (backlog, next, mode, STOP)
is read by the CLI from files — single source of truth.

## 7. Testing

- `lib/checkpoint.mjs` is a pure function → unit tests with `node --test` covering the
  rendered layout and the backlog counts, added to `pnpm ralph:test` (currently green).
- The control flow is prose in the skill (like `iterate.prompt.md`), not code — no test.
- Manual acceptance: run `/ralph-loop 1` and confirm one cycle runs live and the
  checkpoint renders; run with `STOP` present and confirm it ends immediately.

## 8. Out of scope / follow-ups

- **Approach B**: extract the control flow into a shared `ralph-cli.mjs loop-control`
  (state-file backed) consumed by both `loop.sh` and the skill — do this only if drift
  between the two control-flow implementations becomes a real problem.
