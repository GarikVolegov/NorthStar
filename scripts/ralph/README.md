# NorthStar Autonomous Development Loop

A bounded-autonomy loop that keeps working on NorthStar — finding problems, improvements, and
new features, building them, and improving its own process — while you sleep. Built on the
existing Ralph pattern (`ralph.sh` / `prd.json` / `progress.txt`), it adds a continuous
prioritized backlog, an objective deploy gate, and hard safety guards.

## TL;DR

```bash
node scripts/ralph/ralph-cli.mjs status   # what the loop sees right now
touch scripts/ralph/STOP                   # pause the loop (kill-switch)
rm scripts/ralph/STOP                      # resume
bash scripts/ralph/loop.sh                 # run the loop (uses loop.config.json mode)
node --test scripts/ralph/lib/*.test.mjs   # run the loop's own unit tests
```

## Prerequisites & first real run

Run from a normal terminal (NOT from inside a Claude Code session — a nested
`--dangerously-skip-permissions` agent is blocked by design):

- **`claude` CLI** on PATH (the iteration brain) + **`node`** + **`pnpm`** (the gate). `loop.sh`
  prepends `~/.local/bin` to PATH and fails fast if `node`/`claude` are missing.
- **`gh`** only for `pr-only`/`full-auto` (PR creation). Without it the loop still pushes the
  branch and notes that the PR needs opening manually.
- **A reachable non-prod `DATABASE_URL`** so the gate's real-DB tests can pass locally
  (no mocks — `DB_RULES.md`). Without a DB the first iteration will find the gate red and its
  only job becomes "make the gate green" — which it can't do without the DB. So: point the loop
  at a staging/test DB, or run it where the gate is already green.

Verify the plumbing without spawning the real brain (uses a stub):

```bash
RALPH_BRAIN_CMD='echo "<promise>ITERATION_DONE</promise>"' bash scripts/ralph/loop.sh 1
```

`RALPH_BRAIN_CMD` overrides the brain command (default
`claude --dangerously-skip-permissions --print`, prompt fed on stdin) — used for testing the
control flow.

## How it works (one iteration)

`loop.sh` runs the iteration brain (`iterate.prompt.md`) headless, over and over:

1. **Kill-switch** — if `STOP` exists, stop.
2. **Select** (deterministic) — `ralph-cli.mjs next` picks the top `todo` item.
   Priority: **security/bug > improvement/chore > feature**; ties FIFO. Logic in
   `lib/backlog.mjs` (unit-tested).
3. **Pre-flight gate** — if `pnpm qa` is red, the only allowed work is making it green.
4. **Implement** — read the area `*_RULES.md`, then TDD (test → code → green).
5. **Verify** — `pnpm qa`; plus `pnpm eval` for deploy-relevant areas (ai/wendy/api/db).
6. **Commit & push** — atomic, security gate first, `GIT_RULES.md` message.
7. **Decide** (deterministic) — `ralph-cli.mjs decide` returns `report` / `open-pr` /
   `deploy` / `hold` based on `mode` + gate + eval. **A red gate always holds.** Logic in
   `lib/deploy-gate.mjs` (unit-tested).
8. **Record** — update `memoria.md` (§7 + §10), mark the item done, append the journal.
9. **Retro** — append reusable learnings to `PLAYBOOK.md`.

When the backlog runs dry, `loop.sh` runs a **discovery iteration** (`discover.prompt.md`),
which dispatches three hunters (`discovery/*.md`) to refill it.

## The safety rollout ladder (`loop.config.json` → `mode`)

Full autonomy (merge to main + deploy) is reached in three steps; each is one config change:

| mode | what happens | use it to |
|---|---|---|
| `dry-run` | everything up to the local gate, then **report only** (no push/merge/deploy) | validate selection, TDD, gate, journal |
| `pr-only` | commit + push + open PR; **never** merge/deploy | watch one observed night |
| `full-auto` | merge to `main` + deploy + auto-rollback, **objective-gated** | steady state |

**Objective deploy gate:** in `full-auto`, a deploy-relevant change deploys only when the gate
is green AND `pnpm eval` clears the KPI thresholds (safety/privacy 100%, accuracy > 80%);
otherwise it falls back to a PR. No human gate — but no reckless deploy either.

## Hard safety guards (never bypassed)

- **Kill-switch:** `scripts/ralph/STOP` (gitignored) pauses the loop before the next iteration.
- **PreToolUse guard** (`lib/guard-hook.mjs`, wired in `.claude/settings.json`): blocks
  force-push, `--no-verify`, `rm -rf` of root/home, and edits to `.env*` (except `.env.example`)
  — and it still runs under `--dangerously-skip-permissions` (which bypasses allow/deny lists).
- **Backoff:** after `maxFailures` consecutive failures the loop halts and writes a report.
- **Non-negotiable barriers:** no secrets committed, no third-party PII to the LLM, real DB in
  tests — enforced by the gate, the guard, and `iterate.prompt.md`.

## Files

| File | Role |
|---|---|
| `loop.config.json` | the one control surface (mode, maxIterations, maxFailures, discoverEvery) |
| `backlog.json` | the prioritized work queue (discovery appends here) |
| `loop.sh` | durable overnight runner (evolves `ralph.sh`) |
| `iterate.prompt.md` | the brain of one iteration |
| `discover.prompt.md` + `discovery/*.md` | discovery iteration + the three hunters |
| `ralph-cli.mjs` | deterministic CLI: `status` / `next` / `decide` / `mode` / `config` |
| `lib/*.mjs` (+ `*.test.mjs`) | tested pure logic: selection, deploy decision, safety, journal, guard |
| `PLAYBOOK.md` | the loop's self-tuning knowledge (retro appends here) |
| `journal/YYYY-MM-DD.md` | the morning-readable audit trail |
| `prd.json` / `progress.txt` / `CLAUDE.md` | the original Ralph PRD flow (used for large features) |

## Relationship to the original Ralph

The original `CLAUDE.md` + `prd.json` drive a single PRD to completion. The new loop is the
layer above: it keeps a mixed backlog full and, for a large feature, generates a PRD and drives
it as a Ralph sub-run. Both coexist.
