# Ralph Loop Playbook — self-tuning knowledge

The loop's evolving operating manual. Each iteration's retro appends reusable learnings here;
a weekly meta-iteration consolidates them and tunes the loop. Keep entries **general and
reusable** — item-specific detail belongs in `progress.txt` / the journal, not here.

## Codebase Patterns (read before every iteration)
- READ FIRST: `memoria.md` (root) + the relevant `*_RULES.md` for the area you touch.
- GATE: `pnpm` is NOT on PATH here. `export PATH="$HOME/.local/bin:$PATH"` first, then the
  direct binaries documented in `progress.txt` Codebase Patterns (tsc, eslint, vitest per workspace).
- BRANCHES: work from the active integration branch (see `memoria.md` header), never from a stale
  `main`. Branch prefix by item type — see `loop.config.json branchPrefixByType`.
- TESTS: integration tests use a REAL DB (no mocks); guard DB-needing tests with
  `describe.skipIf(!process.env.DATABASE_URL)` and note they run in CI/staging.
- DB: schema is the authority via `drizzle-kit push` (db:migrate is deprecated — memoria §8).

## How the loop works (orientation)
- `loop.config.json mode` walks the safety ladder: `dry-run` → `pr-only` → `full-auto`.
- Selection is deterministic: `node scripts/ralph/ralph-cli.mjs next` (priority: security/bug >
  improvement/chore > feature; ties FIFO).
- The integration decision is deterministic: `ralph-cli.mjs decide` (a red gate always `hold`s).
- Kill-switch: `touch scripts/ralph/STOP` to pause before the next iteration.

## Tuning log (meta-iteration appends here)
- _2026-06-24_ — Loop bootstrapped. Starting mode: `dry-run`. First target: CHORE-001 (verify
  the gate is green) to establish a baseline before any autonomous change.

## Metrics to watch (weekly meta-iteration)
- items completed / night · % iterations that failed the gate · % changes later reverted ·
  Wendy eval scores (safety/privacy must stay 100%) · average iteration wall-clock.
- If gate-fail rate is high → tighten the pre-flight gate or shrink item scope.
- If revert rate is high → require `pr-only` for the offending area before `full-auto`.
