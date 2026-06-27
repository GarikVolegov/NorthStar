# Per-Iteration Multi-Agent Review Pipeline (loop Sub-1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every loop modification "perfect" by reviewing the work commit with a risk-scaled panel of specialist reviewer subagents before integration; an unresolved Critical/Important finding makes the review red, and a red review `hold`s integration like a red gate.

**Architecture:** Deterministic triage (`lib/review-panel.mjs`) picks which of 5 reviewers run, by item type/area/whether code changed. `decideIntegration` gains a `reviewGreen` input (red gate OR red review → `hold`). The CLI exposes `review-panel` and `decide --review`. The iteration brain (`iterate.prompt.md`) gets a new Step 6.5 that dispatches the reviewers in parallel and runs a bounded fix-loop. Reviewer behavior is prose (reusing `/code-review`, `/security-review`, the `*_RULES.md`); the control logic is deterministic and unit-tested.

**Tech Stack:** Node ESM (`node --test`), existing `scripts/ralph/lib/*.mjs`, Claude Code subagents/slash-commands.

## Global Constraints

- pnpm is NOT on PATH: `export PATH="$HOME/.local/bin:$PATH"` before any pnpm/node gate command.
- Loop tests: `pnpm ralph:test` = `node --test scripts/ralph/lib/*.test.mjs` (new `*.test.mjs` there is auto-included).
- Reviewer ids (exact, in panel order): `'correctness'`, `'security'`, `'tests'`, `'design'`, `'consistency'`.
- Deploy-relevant areas (from `loop.config.json`): `api`, `db`, `ai`, `wendy`.
- Backward compatibility: `decideIntegration` must behave exactly as today when `reviewGreen` is not passed → default it to `true`. Same for `decide` CLI when `--review` is absent.
- Commit message format: `<type>: <desc>` lowercase; body ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Non-negotiable barriers (unchanged): no secrets committed, no `git push --force`, real-DB integration tests, `userId` from `req.user.id`, atomic commits, never edit `.env*` except `.env.example`.

---

### Task 1: `reviewPanel` deterministic triage + unit tests

**Files:**
- Create: `scripts/ralph/lib/review-panel.mjs`
- Test: `scripts/ralph/lib/review-panel.test.mjs`

**Interfaces:**
- Produces: `reviewPanel({ type, area, hasCodeChange }) -> string[]` — subset of
  `['correctness','security','tests','design','consistency']` in that order.

- [ ] **Step 1: Write the failing tests**

```javascript
// scripts/ralph/lib/review-panel.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPanel } from './review-panel.mjs';

test('FULL panel for a bug or security item (any area)', () => {
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'web', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
  assert.deepEqual(reviewPanel({ type: 'security', area: 'repo', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
});

test('FULL panel for a deploy-relevant area even on a chore', () => {
  for (const area of ['api', 'db', 'ai', 'wendy']) {
    assert.deepEqual(reviewPanel({ type: 'chore', area, hasCodeChange: true }),
      ['correctness', 'security', 'tests', 'design', 'consistency']);
  }
});

test('STANDARD panel for frontend code (no server-consistency)', () => {
  assert.deepEqual(reviewPanel({ type: 'improvement', area: 'web', hasCodeChange: true }),
    ['correctness', 'security', 'tests', 'design']);
});

test('LIGHT panel for other code areas', () => {
  assert.deepEqual(reviewPanel({ type: 'chore', area: 'repo', hasCodeChange: true }),
    ['correctness', 'security', 'design']);
  assert.deepEqual(reviewPanel({ type: 'improvement', area: 'scripts', hasCodeChange: true }),
    ['correctness', 'security', 'design']);
});

test('MINIMAL panel (design only) when no code changed', () => {
  assert.deepEqual(reviewPanel({ type: 'chore', area: 'ci', hasCodeChange: false }), ['design']);
  // deploy-relevant area but docs/config only → still minimal
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'api', hasCodeChange: false }), ['design']);
});

test('security is present in every panel that touches code', () => {
  for (const area of ['api', 'web', 'repo', 'db']) {
    assert.ok(reviewPanel({ type: 'chore', area, hasCodeChange: true }).includes('security'));
  }
});

test('consistency runs only in the FULL panel', () => {
  assert.ok(reviewPanel({ type: 'chore', area: 'api', hasCodeChange: true }).includes('consistency'));
  assert.ok(!reviewPanel({ type: 'chore', area: 'web', hasCodeChange: true }).includes('consistency'));
  assert.ok(!reviewPanel({ type: 'chore', area: 'repo', hasCodeChange: true }).includes('consistency'));
});

test('hasCodeChange defaults to true', () => {
  assert.deepEqual(reviewPanel({ type: 'bug', area: 'api' }),
    ['correctness', 'security', 'tests', 'design', 'consistency']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/review-panel.test.mjs`
Expected: FAIL — `Cannot find module './review-panel.mjs'`.

- [ ] **Step 3: Write the implementation**

```javascript
// scripts/ralph/lib/review-panel.mjs
// Deterministic review triage: which specialist reviewers run for a change, scaled by risk.
// Pure, unit-tested. The iteration brain calls this (via `ralph-cli.mjs review-panel`) so the
// panel is consistent and not left to in-prompt judgment. Tiers (spec §4):
//   FULL     bug/security item OR deploy-relevant area  -> all 5
//   STANDARD frontend code (web)                        -> no server-consistency
//   LIGHT    other code (repo/scripts/…)                -> correctness+security+design
//   MINIMAL  no code change (docs/ci/config only)       -> design sanity only
// Security is present in every code-touching tier.

const DEPLOY_RELEVANT = new Set(['api', 'db', 'ai', 'wendy']);

export function reviewPanel({ type, area, hasCodeChange = true } = {}) {
  if (!hasCodeChange) return ['design'];

  const highRisk = type === 'bug' || type === 'security' || DEPLOY_RELEVANT.has(area);
  if (highRisk) return ['correctness', 'security', 'tests', 'design', 'consistency'];
  if (area === 'web') return ['correctness', 'security', 'tests', 'design'];
  return ['correctness', 'security', 'design'];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/review-panel.test.mjs`
Expected: PASS — all tests pass.

- [ ] **Step 5: Run the whole loop suite**

Run: `export PATH="$HOME/.local/bin:$PATH"; pnpm ralph:test`
Expected: PASS — all lib tests green.

- [ ] **Step 6: Commit**

```bash
git add scripts/ralph/lib/review-panel.mjs scripts/ralph/lib/review-panel.test.mjs
git commit -m "feat(ralph): deterministic review-panel triage for the loop review pipeline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `decideIntegration` gains `reviewGreen`

**Files:**
- Modify: `scripts/ralph/lib/deploy-gate.mjs`
- Test: `scripts/ralph/lib/deploy-gate.test.mjs`

**Interfaces:**
- Consumes: existing `decideIntegration`.
- Produces: `decideIntegration({ mode, gateGreen, reviewGreen = true, evalRequired, evalScores })`
  — invariant: `!gateGreen || !reviewGreen` → `'hold'`.

- [ ] **Step 1: Add the failing tests**

Append to `scripts/ralph/lib/deploy-gate.test.mjs` (before the final line if any, or at end):

```javascript
test('a red review always holds — even with a green gate, in every mode', () => {
  for (const mode of ['dry-run', 'pr-only', 'full-auto']) {
    assert.equal(decideIntegration({ mode, gateGreen: true, reviewGreen: false }), 'hold');
  }
});

test('an explicit green review preserves the normal per-mode behavior', () => {
  assert.equal(decideIntegration({ mode: 'dry-run', gateGreen: true, reviewGreen: true }), 'report');
  assert.equal(decideIntegration({ mode: 'pr-only', gateGreen: true, reviewGreen: true }), 'open-pr');
  assert.equal(decideIntegration({ mode: 'full-auto', gateGreen: true, reviewGreen: true, evalRequired: false }), 'deploy');
});

test('reviewGreen defaults to true (backward compatible)', () => {
  assert.equal(decideIntegration({ mode: 'pr-only', gateGreen: true }), 'open-pr');
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/deploy-gate.test.mjs`
Expected: FAIL on "a red review always holds" (current code ignores `reviewGreen`, returns `report`/`open-pr`/`deploy`).

- [ ] **Step 3: Update `decideIntegration`**

In `scripts/ralph/lib/deploy-gate.mjs`, change the signature and the invariant line.

Replace:
```javascript
export function decideIntegration({ mode, gateGreen, evalRequired = false, evalScores = null }) {
  // Invariant: a red gate never pushes, merges, or deploys.
  if (!gateGreen) return 'hold';
```
with:
```javascript
export function decideIntegration({ mode, gateGreen, reviewGreen = true, evalRequired = false, evalScores = null }) {
  // Invariant: a red gate OR a red multi-agent review never pushes, merges, or deploys.
  if (!gateGreen || !reviewGreen) return 'hold';
```

Also update the JSDoc above the function: add a line
```javascript
 * @param {boolean} [o.reviewGreen] multi-agent review found no unresolved Critical/Important (default true)
```
immediately after the existing `@param {boolean} o.gateGreen   pnpm qa passed` line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/deploy-gate.test.mjs`
Expected: PASS — new tests pass, all existing tests still pass (they omit `reviewGreen` → default true).

- [ ] **Step 5: Commit**

```bash
git add scripts/ralph/lib/deploy-gate.mjs scripts/ralph/lib/deploy-gate.test.mjs
git commit -m "feat(ralph): review becomes an objective integration gate (decideIntegration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: CLI — `review-panel` subcommand + `decide --review`

**Files:**
- Modify: `scripts/ralph/ralph-cli.mjs`

**Interfaces:**
- Consumes: `reviewPanel` (Task 1), `decideIntegration` with `reviewGreen` (Task 2), existing `opt()`.
- Produces: `ralph-cli.mjs review-panel --type T --area A [--code true|false]` (prints a JSON array);
  `ralph-cli.mjs decide … --review green|red` (absent → green).

- [ ] **Step 1: Add the import**

In `scripts/ralph/ralph-cli.mjs`, after `import { renderCheckpoint } from './lib/checkpoint.mjs';` add:
```javascript
import { reviewPanel } from './lib/review-panel.mjs';
```

- [ ] **Step 2: Add the `review-panel` case**

Immediately before `case 'config': {`, insert:
```javascript
  case 'review-panel': {
    const codeOpt = opt('code');
    console.log(
      JSON.stringify(
        reviewPanel({
          type: opt('type'),
          area: opt('area'),
          hasCodeChange: codeOpt == null ? true : codeOpt !== 'false',
        }),
      ),
    );
    break;
  }
```

- [ ] **Step 3: Wire `--review` into the `decide` case**

In `case 'decide': {`, replace:
```javascript
    const decision = decideIntegration({ mode: config.mode, gateGreen, evalRequired, evalScores });
```
with:
```javascript
    const reviewGreen = opt('review') !== 'red'; // absent or 'green' => green; only 'red' blocks
    const decision = decideIntegration({ mode: config.mode, gateGreen, reviewGreen, evalRequired, evalScores });
```

- [ ] **Step 4: Update the help/usage line**

Replace:
```javascript
    console.error(`Commands: status | next | mode | decide | journal-path | checkpoint | config`);
```
with:
```javascript
    console.error(`Commands: status | next | mode | decide | journal-path | checkpoint | review-panel | config`);
```

- [ ] **Step 5: Verify the CLI**

Run:
```bash
node scripts/ralph/ralph-cli.mjs review-panel --type bug --area api
node scripts/ralph/ralph-cli.mjs review-panel --type chore --area web
node scripts/ralph/ralph-cli.mjs review-panel --type chore --area ci --code false
node scripts/ralph/ralph-cli.mjs decide --gate green --review red
node scripts/ralph/ralph-cli.mjs decide --gate green --review green
```
Expected, in order:
`["correctness","security","tests","design","consistency"]`
`["correctness","security","tests","design"]`
`["design"]`
`hold`
`open-pr`  (mode is `pr-only` in loop.config.json)

- [ ] **Step 6: Confirm the suite still passes**

Run: `export PATH="$HOME/.local/bin:$PATH"; pnpm ralph:test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/ralph/ralph-cli.mjs
git commit -m "feat(ralph): CLI review-panel subcommand + decide --review flag

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Observability — checkpoint `review` line + journal `review` field

**Files:**
- Modify: `scripts/ralph/lib/checkpoint.mjs`
- Modify: `scripts/ralph/lib/checkpoint.test.mjs`
- Modify: `scripts/ralph/lib/journal.mjs`
- Modify: `scripts/ralph/lib/journal.test.mjs`

**Interfaces:**
- Produces: `renderCheckpoint(state)` accepts `state.review:string|null` and prints a ` review ` line;
  `formatJournalEntry(entry)` accepts `entry.review:string` and renders a `- **review:** …` line.

- [ ] **Step 1: Add the checkpoint test**

Append to `scripts/ralph/lib/checkpoint.test.mjs`:
```javascript
test('renders the review line, defaulting to an em-dash', () => {
  assert.match(renderCheckpoint({ ...base, review: '🟢 5 rev · 0 crit · 1 imp (fixed)' }),
    /review\s+🟢 5 rev · 0 crit · 1 imp \(fixed\)/);
  assert.match(renderCheckpoint(base), /review\s+—/); // base has no review field
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/checkpoint.test.mjs`
Expected: FAIL — no `review` line in the output yet.

- [ ] **Step 3: Add `review` to the checkpoint renderer**

In `scripts/ralph/lib/checkpoint.mjs`, add `review = null` to the destructured state (next to `mode = 'unknown',`):
```javascript
    mode = 'unknown',
    review = null,
  } = state;
```
Then add a review line to the returned array, immediately after the ` gate … decisione …` line:
```javascript
    ` gate      ${gateStr}        decisione  ${decision ?? '—'}`,
    ` review    ${review ?? '—'}`,
```

- [ ] **Step 4: Run the checkpoint tests**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/checkpoint.test.mjs`
Expected: PASS — all checkpoint tests pass (existing ones unaffected; they match on substrings).

- [ ] **Step 5: Add the journal test**

Append to `scripts/ralph/lib/journal.test.mjs`:
```javascript
test('formatJournalEntry renders the review field when present', () => {
  const out = formatJournalEntry({ itemId: 'BUG-009', review: '🟢 panel: correctness,security; 0 crit, 1 imp fixed' });
  assert.match(out, /- \*\*review:\*\* 🟢 panel: correctness,security; 0 crit, 1 imp fixed/);
});

test('formatJournalEntry omits the review field when absent', () => {
  const out = formatJournalEntry({ itemId: 'BUG-009' });
  assert.ok(!out.includes('**review:**'));
});
```
(If `formatJournalEntry` is not already imported at the top of `journal.test.mjs`, add it to the existing import from `./journal.mjs`.)

- [ ] **Step 6: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/journal.test.mjs`
Expected: FAIL — `review` field not rendered.

- [ ] **Step 7: Add `review` to `formatJournalEntry`**

In `scripts/ralph/lib/journal.mjs`, add `review` to the destructured entry and render it between `gate` and `decision`.

Replace:
```javascript
  const { time, itemId, type, title, gate, decision, action, commit, pr, deploy, notes } = entry;
```
with:
```javascript
  const { time, itemId, type, title, gate, review, decision, action, commit, pr, deploy, notes } = entry;
```
And in the returned string, add `line('review', review) +` immediately after `line('gate', gate) +`:
```javascript
    line('gate', gate) +
    line('review', review) +
    line('decision', decision) +
```

- [ ] **Step 8: Run both suites**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/journal.test.mjs && pnpm ralph:test`
Expected: PASS — journal tests pass; whole loop suite green.

- [ ] **Step 9: Commit**

```bash
git add scripts/ralph/lib/checkpoint.mjs scripts/ralph/lib/checkpoint.test.mjs scripts/ralph/lib/journal.mjs scripts/ralph/lib/journal.test.mjs
git commit -m "feat(ralph): surface the review outcome in the checkpoint + journal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Reviewer prompts + adjudication + wire Step 6.5 into the iteration brain

**Files:**
- Create: `scripts/ralph/review/correctness.md`, `security.md`, `tests.md`, `design.md`, `consistency.md`, `adjudicate.md`
- Modify: `scripts/ralph/iterate.prompt.md` (Step 6 commit-local, new Step 6.5, Step 7 decide `--review`, Step 8 journal note)
- Modify: `scripts/ralph/PLAYBOOK.md` (document the pipeline)

**Interfaces:**
- Consumes: `ralph-cli.mjs review-panel` (Task 3), `decide --review` (Task 3), the journal `review` field (Task 4).
- Produces: the per-iteration review procedure the loop follows.

- [ ] **Step 1: Create the 5 reviewer prompt files**

`scripts/ralph/review/correctness.md`:
```markdown
# Loop reviewer — Correctness

You review ONE change for **correctness only**. Read-only — do NOT fix anything.

Inputs you are given: the diff package (`BASE..HEAD` of the work commit) and the item brief.
Read the diff once. Inspect a call site outside the diff only to confirm a concrete, named risk.

Find: bugs, wrong logic, unhandled edge cases, off-by-one, null/undefined hazards, race
conditions, broken error handling, and regressions in the code this diff touches.

Output: findings as **Critical / Important / Minor**, each with `file:line`, what's wrong, why it
matters, and how to fix. Critical/Important = behavior is wrong or fragile. Minor = polish. If the
change is correct, say so explicitly. Begin directly with the verdict; no preamble.
```

`scripts/ralph/review/security.md`:
```markdown
# Loop reviewer — Security

You review ONE change for **security only**. Read-only. Read `SECURITY_RULES.md` first.

Inputs: the diff package and the item brief.

Find: IDOR / broken authorization (userId MUST come from `req.user.id`, never the body/query/params),
secrets committed or logged, third-party PII sent to the LLM, injection (SQL / command / prompt),
unsafe deserialization, and expensive endpoints with no rate/cost limit. A real auth-bypass,
secret-exposure, or PII-to-LLM issue is **Critical**.

Output **Critical / Important / Minor** with `file:line`, why it matters, and the fix. If clean, say
so. Begin directly with the verdict.
```

`scripts/ralph/review/tests.md`:
```markdown
# Loop reviewer — Test quality

You review ONE change's **tests only**. Read-only. Read `DB_RULES.md` first.

Inputs: the diff package and the item brief.

Find: tests that assert nothing or only assert mock behavior; missing edge cases for the changed
logic; integration tests that mock the DB (DB_RULES: integration uses a REAL DB, no mocks — guard
DB-needing tests with `describe.skipIf(!process.env.DATABASE_URL)`); missing TDD evidence when the
item required it. New logic with no test at all is **Important**.

Output **Critical / Important / Minor** with `file:line`. If the testing is sound, say so. Begin
directly with the verdict.
```

`scripts/ralph/review/design.md`:
```markdown
# Loop reviewer — Design / reuse / rules

You review ONE change for **design quality and rule compliance**. Read-only. Read the area's
`*_RULES.md` (API/DB/FRONTEND/AI — Regola 0) first.

Inputs: the diff package and the item brief.

Find: duplicated logic that should reuse an existing helper, tangled responsibilities, files growing
too large (file-size ratchet), dead code, over-engineering (YAGNI), and violations of the area rules
(e.g. frontend API URLs not via `API_ENDPOINTS`, raw `fetch()` instead of `apiFetch`). Spirit of
`/simplify`.

Output **Critical / Important / Minor** with `file:line`. If the design is clean, say so. Begin
directly with the verdict.
```

`scripts/ralph/review/consistency.md`:
```markdown
# Loop reviewer — Server / API consistency

You review ONE change for **backend contract consistency**. Read-only.

Inputs: the diff package and the item brief.

Find drift: a route added/changed without its OpenAPI (`packages/api-spec`) + generated Zod
(`api-zod`) + React Query client (`api-client-react`); `apps/server/src/route-config.ts` not updated
for a new router; a DB schema change that leaves `db-types` invalid; a stale `docs/api-routes.md`.
If a specific doubt arises, run the one relevant audit (`audit:db-types`, `audit:api-fetch`,
`audit:feature-protocol`) — never the whole gate. Contract drift is **Important**.

Output **Critical / Important / Minor** with `file:line`. If contracts are consistent, say so. Begin
directly with the verdict.
```

- [ ] **Step 2: Create the adjudication procedure**

`scripts/ralph/review/adjudicate.md`:
```markdown
# Loop review — adjudication & fix-loop

After the panel's reviewers return, you (the iteration agent — you are the implementer) adjudicate:

1. **Aggregate** all findings across reviewers by severity.
2. **Minor** → record them in the journal `review` field (and, with dedup, you MAY file P3 backlog
   items). They do NOT block.
3. **Critical / Important** → fix them yourself, inline:
   - make the minimal fix,
   - re-run the gate (`pnpm qa` or the direct-binary workaround) — it MUST stay green,
   - re-commit (amend the work commit, or add a focused fix commit),
   - re-dispatch ONLY the reviewers that flagged, on the new diff.
4. **Cap = 2 rounds.** If you believe a finding is a false positive, write a short justification; if
   the reviewer re-flags it after your justification, it counts as **UNRESOLVED**.
5. **reviewResult** = `red` if any Critical/Important remains after the cap, else `green`.
6. Pass it to the decision: `node scripts/ralph/ralph-cli.mjs decide --gate <green|red> --review <green|red>`.
   - `--review red` → `decide` returns `hold`: end the iteration **BLOCKED**, file a **P1 bug** that
     captures the unresolved findings (id `BUG-…`, area = the item's area), keep the work on the
     branch (no push / PR / merge).
```

- [ ] **Step 3: Rework `iterate.prompt.md` Step 6 (commit local, not push)**

In `scripts/ralph/iterate.prompt.md`, replace the Step 6 block:
```markdown
## Step 6 — Commit & push
- Commit atomically, security gate first. Message per `GIT_RULES.md`:
  `<prefix>: [ITEM-ID] - <title>` (prefix by type — see `loop.config.json branchPrefixByType`).
- End the commit body with the Co-Authored-By trailer for Claude.
- Push the current branch (never `--force`).
```
with:
```markdown
## Step 6 — Commit (local)
- Commit atomically, security gate first. Message per `GIT_RULES.md`:
  `<prefix>: [ITEM-ID] - <title>` (prefix by type — see `loop.config.json branchPrefixByType`).
- End the commit body with the Co-Authored-By trailer for Claude.
- Do NOT push yet — the multi-agent review (Step 6.5) gates integration. Pushing happens in
  Step 7 only if `decide` says so (never `--force`).
```

- [ ] **Step 4: Insert Step 6.5 (multi-agent review)**

In `scripts/ralph/iterate.prompt.md`, immediately after the Step 6 block and before `## Step 7`, insert:
```markdown
## Step 6.5 — Multi-agent review (objective quality gate)
Review the WORK commit before integrating (not the Step 8 bookkeeping commit).
1. Determine the panel deterministically:
   `node scripts/ralph/ralph-cli.mjs review-panel --type <type> --area <area> --code <true|false>`
   (`--code false` only when the work commit touched no `.ts/.tsx/.js/.jsx/.mjs/.sql`).
2. Generate a diff package for the work commit (e.g. `git show` / `git diff <base>..HEAD`).
3. Dispatch the listed reviewers as subagents IN PARALLEL, each with its prompt file
   (`scripts/ralph/review/<id>.md`), the diff package, the item brief, and the relevant
   `*_RULES.md`. Scale each reviewer's model to the diff size (tiny diff → cheap tier).
4. Adjudicate per `scripts/ralph/review/adjudicate.md`: fix Critical/Important inline (gate must stay
   green), re-review the flagging reviewers, cap 2 rounds → produce `reviewResult` (green|red).
Record the panel + findings summary for the journal `review` field and the checkpoint `review` line.
```

- [ ] **Step 5: Update Step 7 (decide) to pass `--review`**

In `scripts/ralph/iterate.prompt.md`, replace the Step 7 command line:
```markdown
Run: `node scripts/ralph/ralph-cli.mjs decide --gate green [--eval-required --eval-file <scores.json>]`
(use `--gate red` if the gate did not pass). Act on the printed decision:
```
with:
```markdown
Run: `node scripts/ralph/ralph-cli.mjs decide --gate green --review <green|red> [--eval-required --eval-file <scores.json>]`
(use `--gate red` if the gate did not pass; `--review red` if Step 6.5 stayed red). A red gate OR a
red review → `hold`. Act on the printed decision:
```
And replace the `hold` bullet:
```markdown
- `hold`    → gate red or unsafe: stay on the branch, file a P0 bug item for the failure.
```
with:
```markdown
- `hold`    → gate red OR review red: stay on the branch (no push/PR/merge), file a P1 bug item
  capturing the failure (red gate) or the unresolved Critical/Important findings (red review).
```

- [ ] **Step 6: Update Step 8 journal note to include review**

In `scripts/ralph/iterate.prompt.md`, replace:
```markdown
3. Append a journal entry to today's file (`node scripts/ralph/ralph-cli.mjs journal-path`)
   using the format from `lib/journal.mjs` (item, type, gate, decision, commit, notes).
```
with:
```markdown
3. Append a journal entry to today's file (`node scripts/ralph/ralph-cli.mjs journal-path`)
   using the format from `lib/journal.mjs` (item, type, gate, **review**, decision, commit, notes).
   The bookkeeping commit (backlog/memoria/journal) is NOT itself reviewed.
```

- [ ] **Step 7: Document the pipeline in PLAYBOOK.md**

Append to the "Codebase Patterns (cont.)" section of `scripts/ralph/PLAYBOOK.md`:
```markdown
- Every iteration runs a multi-agent review on the WORK commit before integrating (iterate Step 6.5):
  a deterministic risk-scaled panel (`ralph-cli.mjs review-panel`) of specialist reviewers
  (`scripts/ralph/review/*.md`) runs in parallel; Critical/Important findings are fixed in a 2-round
  fix-loop; an unresolved one makes the review red, and `decide --review red` → `hold` (review is an
  objective gate alongside the green gate). The bookkeeping commit is not reviewed.
```

- [ ] **Step 8: Validate structure (no live loop run needed here)**

Run:
```bash
ls scripts/ralph/review/
export PATH="$HOME/.local/bin:$PATH"; pnpm ralph:test
node scripts/ralph/ralph-cli.mjs review-panel --type bug --area api
```
Expected: the 6 `.md` files exist; `pnpm ralph:test` green; the panel command prints the FULL panel.
(A live one-iteration dry-run that actually dispatches reviewers is a manual main-session smoke,
out of scope for a subagent — note it in the report.)

- [ ] **Step 9: Commit**

```bash
git add scripts/ralph/review/ scripts/ralph/iterate.prompt.md scripts/ralph/PLAYBOOK.md
git commit -m "feat(ralph): wire the multi-agent review pipeline into the iteration brain

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** §3 files → Task 1 (review-panel), Task 2 (deploy-gate), Task 3 (CLI), Task 4
(checkpoint+journal), Task 5 (review/*.md + iterate + PLAYBOOK). §4 triage+reviewers → Task 1 +
Task 5 Step 1. §5 adjudication/review-as-gate → Task 2 (decide invariant) + Task 5 Step 2/5. §6
observability → Task 4 + Task 5 (work-commit-only scoping in Steps 4/6). §7 testing → Tasks 1-4 unit
tests + Task 5 Step 8. §8 (Sub-2, adjudicator, cost telemetry) explicitly out of scope — no task.

**Placeholder scan:** none — all code, prompt text, and edits are literal.

**Type consistency:** reviewer ids `['correctness','security','tests','design','consistency']`
identical across Task 1 (impl + tests), Task 3 (CLI output), Task 5 (the 5 filenames + Step 4 panel
call). `reviewGreen` param name identical in Task 2 (impl + tests) and Task 3 (`decide` call).
`review` state/entry field identical across Task 4 (checkpoint + journal) and Task 5 (Step 6 journal
note, Step 4 records it). `decide --review green|red` identical in Task 3 and Task 5 (adjudicate +
Step 5).
