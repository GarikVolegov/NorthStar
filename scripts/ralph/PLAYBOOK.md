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

## Codebase Patterns (cont.)
- CI/docs-only items (area `ci`, changing `.github/workflows/*.yml` or `docs/*.md`) are
  OUTSIDE the lint/typecheck/vitest gate scope and `ci` is not a deploy-relevant area
  (no eval). Validate the relevant thing instead: parse the workflow YAML. No global
  `yaml`/`js-yaml` on PATH, but the pnpm store has one — `require(<repo>/node_modules/.pnpm/yaml@<v>/node_modules/yaml).parse(...)`.
- When changing a GH-Actions job's PURPOSE, keep its `job-id` stable so downstream
  `needs:` refs stay valid; rename only the human-facing `name:` + step labels.
- DB deploy authority is `drizzle-kit push` (`db:push`), NOT `db:migrate` — the SQL chain
  is structurally incomplete (memoria §8). Workflows now reflect this (CHORE-002).
- A guard/audit that LOCKS IN a policy (e.g. `check-playwright-e2e.mjs` asserting the deploy
  config) must be updated in the SAME change that reverses the policy. Otherwise the guard
  keeps enforcing the OLD policy and turns `pnpm qa` red later — exactly what happened after
  US-003 (vercel buildCommand) and CHORE-002 (db:push): the guard still demanded the reversed
  rules. When you change a deploy/config decision, grep for the audit that pins it and flip it too.
- `pnpm qa` is `&&`-chained, so it STOPS at the first red step and hides the rest. After fixing
  one audit, re-run the WHOLE chain (or each remaining `audit:*`) — there may be more reds behind it.
- `pnpm qa` can OOM in this env when the 3 coverage suites run together (exit 137). Run the
  pieces separately: `lint:ci`, `typecheck`, each `audit:*`, and `test:{ai,server,web}:coverage`
  one at a time. The OOM is an env limit, not a code failure.
- file-size ratchet baseline lives at `docs/quality/file-size-baseline.json` (limits: apps 600,
  packages 400). A "new offender" or a grown file fails it; to bless intentional growth, update
  that file's `offenders` list. knip ignores live in `knip.json` (`.design-sync/**` = design tooling).
- LLM cost is recorded in TWO ledgers: `ai_cost_log` (via `recordAiCall` — ai-wendy, wiki) and
  `llm_usage` (via `recordLlmUsage` — roadmap, cv, briefings, coach, cover-letter, skills-gap).
  `costGuard` (middleware/cost-guard.ts) sums BOTH for the monthly limit. When you add an LLM
  generation route: (1) mount `costGuard` (or a `checkMonthlyFreemium` gate) on it, and (2) make
  sure its spend lands in one of those two tables — otherwise the monthly ceiling can't see it.
- Some server tests are CWD-sensitive (e.g. `refresh-wikillm-graphs-script.test.ts` resolves
  `process.cwd()/../../scripts/...`). Run the server suite with cwd = `apps/server`
  (`(cd apps/server && node_modules/.bin/vitest run ... --configLoader runner)` or
  `pnpm --filter @northstar/server run test`), NOT from the repo root, or you get false failures.

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
