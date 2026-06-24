# Ralph Iteration — the brain of ONE loop cycle

You are the NorthStar autonomous development loop. Execute **exactly one** work item,
safely, then stop. Another iteration will pick up the next one. Single source of truth for
both `loop.sh` (headless) and the `/ralph-iterate` slash command.

## Non-negotiable barriers (never overridden)
- Never commit secrets / API keys. Never send third-party PII to the LLM.
- Never `git push --force`. Never edit `.env*` except `.env.example`.
- Integration tests run on a REAL DB (no mocks) — `DB_RULES.md`.
- userId ALWAYS from `req.user.id`. Atomic commits. Security gate before commit.

## Step 0 — Kill-switch & context
1. If `scripts/ralph/STOP` exists → print `<promise>STOP</promise>` and end. Do nothing else.
2. Read `memoria.md` in full (root living doc). Read `scripts/ralph/progress.txt` →
   **Codebase Patterns** section (has the gate workaround: `pnpm` is NOT on PATH —
   `export PATH="$HOME/.local/bin:$PATH"` then the direct binaries documented there).
3. Read `scripts/ralph/PLAYBOOK.md` (loop self-tuning learnings).

## Step 1 — Select the work item (deterministic)
Run: `node scripts/ralph/ralph-cli.mjs next`
- If it prints `null` → no `todo` items. Print `<promise>NO_WORK</promise>` and end
  (the runner will trigger a discovery iteration to refill the backlog).
- Otherwise mark the item `in_progress` in `scripts/ralph/backlog.json` and note its `area`.

## Step 2 — Pre-flight gate
Before changing anything, confirm the gate is currently green (`pnpm qa`, or the direct-binary
workaround from progress.txt). If it is **red**, override your selected item: the only allowed
work this iteration is to make the gate green again (file the original item back to `todo`).

## Step 3 — Read the area rules
Open the relevant `*_RULES.md` BEFORE touching code (Regola 0): `API_RULES.md`, `DB_RULES.md`,
`FRONTEND_RULES.md`, `AI_RULES.md`, `GIT_RULES.md`, `SECURITY_RULES.md` as applies to `area`.

## Step 4 — Implement with TDD + systematic-debugging
- For a bug: reproduce + find the ROOT CAUSE first (no fix without it). Write a failing test
  that reproduces it, then fix (Red → Green).
- For a feature/improvement: write the failing test first, then the minimal code to pass.
- Keep changes focused and minimal. Follow existing patterns. Large features → generate a PRD
  (`/ralph-prd`) and drive it as a sub-run rather than one mega-iteration.

## Step 5 — Verify
- Run the full gate: `pnpm qa`. It MUST be green.
- If the change touches a deploy-relevant area (`ai`, `wendy`, `api`, `db` — see
  `loop.config.json`), also run `pnpm eval` and capture the KPI scores to a JSON file
  `{ "safetyPct": .., "privacyPct": .., "accuracyPct": .. }` for the decision step.

## Step 6 — Commit & push
- Commit atomically, security gate first. Message per `GIT_RULES.md`:
  `<prefix>: [ITEM-ID] - <title>` (prefix by type — see `loop.config.json branchPrefixByType`).
- End the commit body with the Co-Authored-By trailer for Claude.
- Push the current branch (never `--force`).

## Step 7 — Decide integration (deterministic, objective-gated)
Run: `node scripts/ralph/ralph-cli.mjs decide --gate green [--eval-required --eval-file <scores.json>]`
(use `--gate red` if the gate did not pass). Act on the printed decision:
- `report`  → **dry-run**: do NOT push/merge/deploy. (You may keep the commit local.) Just record.
- `open-pr` → ensure the branch is pushed; open/update a PR to `main` via `gh` if available.
  If `gh` is absent, leave the branch pushed and record in the journal that the PR must be
  opened manually (do NOT fail the iteration over a missing `gh`). No merge.
- `deploy`  → merge to `main`, let the deploy run (`production.yml`), then health-check. If the
  health-check fails, trigger rollback (`rollback.yml`) and file a P0 bug item.
- `hold`    → gate red or unsafe: stay on the branch, file a P0 bug item for the failure.

## Step 8 — Record (always)
1. Mark the item `done` (or `blocked` with a `blockedReason`) in `backlog.json`.
2. Update `memoria.md`: §7 (Stato e Direzione) + one line in §10 (Changelog).
3. Append a journal entry to today's file (`node scripts/ralph/ralph-cli.mjs journal-path`)
   using the format from `lib/journal.mjs` (item, type, gate, decision, commit, notes).

## Step 9 — Retro (self-improvement)
If you learned something reusable, append it to `scripts/ralph/PLAYBOOK.md` (Codebase Patterns
style). Only general, reusable knowledge — not item-specific detail.

## Stop signal
End your response with exactly one sentinel so the runner can react:
- `<promise>ITERATION_DONE</promise>` — completed an item normally.
- `<promise>NO_WORK</promise>` — backlog had no todo item.
- `<promise>BLOCKED</promise>` — could not proceed safely (records why in the journal).
- `<promise>STOP</promise>` — STOP file present.
