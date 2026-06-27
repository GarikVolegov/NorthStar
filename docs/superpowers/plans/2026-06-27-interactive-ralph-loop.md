# Interactive Ralph Loop (`/ralph-loop`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-session `/ralph-loop` that runs the autonomous loop live (no headless spawn), continuous with a deterministic status checkpoint between cycles.

**Architecture:** A pure `renderCheckpoint(state)` function (unit-tested) is exposed through a new `ralph-cli.mjs checkpoint` subcommand that merges per-cycle facts (flags) with file-derived state (backlog, next item, mode). A new prose brain `loop-interactive.prompt.md` ports `loop.sh`'s control flow (STOP → backoff → discovery-on-empty → max-iter) to be executed by *this* agent, reusing the single-sourced per-iteration brain `iterate.prompt.md`. `loop.sh` is untouched.

**Tech Stack:** Node ESM (`node --test`), Claude Code slash commands (`.claude/commands/*.md`), existing `scripts/ralph/lib/*.mjs`.

## Global Constraints

- pnpm is NOT on PATH: `export PATH="$HOME/.local/bin:$PATH"` before any pnpm/node gate command.
- Loop tests run via `pnpm ralph:test` = `node --test scripts/ralph/lib/*.test.mjs` (new `*.test.mjs` in that dir is auto-included).
- Non-negotiable barriers (inherited from `iterate.prompt.md`): no secrets committed, no `git push --force`, real-DB integration tests, `userId` from `req.user.id`, atomic commits, security gate before commit, never edit `.env*` except `.env.example`.
- Commit message format (GIT_RULES / loop): `<type>: <desc>` lowercase; end body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Existing lib API (do not change): `summarize(items)` → `{ total, byStatus, next }`; `selectNextItem(items)` → item | null.

---

### Task 1: `renderCheckpoint` pure function + unit tests

**Files:**
- Create: `scripts/ralph/lib/checkpoint.mjs`
- Test: `scripts/ralph/lib/checkpoint.test.mjs`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `renderCheckpoint(state) -> string`, where `state` is
  `{ iter:number, max:number, item:{id,type,priority,title}|null, result:string,
  gate:'green'|'red'|null, decision:string|null, commit:string|null,
  pushed:boolean|null, failures:number, maxFailures:number,
  next:{id,type,priority,title}|null, byStatus:Record<string,number>, mode:string }`.

- [ ] **Step 1: Write the failing tests**

```javascript
// scripts/ralph/lib/checkpoint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCheckpoint } from './checkpoint.mjs';

const base = {
  iter: 3, max: 12,
  item: { id: 'CHORE-001', type: 'chore', priority: 'P0', title: 'verify gate green' },
  result: 'ITERATION_DONE', gate: 'green', decision: 'report', commit: 'abc1234', pushed: true,
  failures: 0, maxFailures: 3,
  next: { id: 'IMP-001', type: 'improvement', priority: 'P2', title: 'deprecate route-paths.ts' },
  byStatus: { todo: 2, in_progress: 0, blocked: 3, done: 3 },
  mode: 'pr-only',
};

test('renders the worked item and the next item', () => {
  const out = renderCheckpoint(base);
  assert.match(out, /CHORE-001 · chore\/P0 · "verify gate green"/);
  assert.match(out, /IMP-001 · improvement\/P2 · "deprecate route-paths.ts"/);
});

test('shows iteration and failure ratios', () => {
  const out = renderCheckpoint(base);
  assert.match(out, /iterazione 3\/12/);
  assert.match(out, /fail\s+0\/3/);
});

test('maps gate to an icon, with a dash when unknown', () => {
  assert.match(renderCheckpoint(base), /🟢 green/);
  assert.match(renderCheckpoint({ ...base, gate: 'red' }), /🔴 red/);
  assert.match(renderCheckpoint({ ...base, gate: null }), /gate\s+—/);
});

test('derives backlog counts from byStatus, defaulting missing keys to 0', () => {
  const out = renderCheckpoint({ ...base, byStatus: { todo: 5 } });
  assert.match(out, /todo 5 · in_progress 0 · blocked 0 · done 0/);
});

test('handles a null next item (no todo left)', () => {
  assert.match(renderCheckpoint({ ...base, next: null }), /prossimo  \(nessuno\)/);
});

test('renders push state as sì / no / —', () => {
  assert.match(renderCheckpoint(base), /push\s+sì/);
  assert.match(renderCheckpoint({ ...base, pushed: false }), /push\s+no/);
  assert.match(renderCheckpoint({ ...base, pushed: null }), /push\s+—/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/checkpoint.test.mjs`
Expected: FAIL — `Cannot find module './checkpoint.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

```javascript
// scripts/ralph/lib/checkpoint.mjs
// Pure renderer for the interactive loop's per-iteration status block.
// Deterministic: same state in -> same string out (unit-tested in checkpoint.test.mjs).

const GATE_ICON = { green: '🟢', red: '🔴' };

function itemLine(item) {
  if (!item) return '(nessuno)';
  return `${item.id} · ${item.type}/${item.priority} · "${item.title}"`;
}

export function renderCheckpoint(state) {
  const {
    iter, max,
    item = null,
    result = '—',
    gate = null,
    decision = null,
    commit = null,
    pushed = null,
    failures = 0,
    maxFailures = 3,
    next = null,
    byStatus = {},
    mode = 'unknown',
  } = state;

  const gateStr = gate ? `${GATE_ICON[gate] ?? '—'} ${gate}` : '—';
  const pushStr = pushed == null ? '—' : pushed ? 'sì' : 'no';
  const counts = ['todo', 'in_progress', 'blocked', 'done']
    .map((k) => `${k} ${byStatus[k] ?? 0}`)
    .join(' · ');

  return [
    `─── Ralph · iterazione ${iter}/${max} ─────────────────────────`,
    ` item      ${itemLine(item)}`,
    ` gate      ${gateStr}        decisione  ${decision ?? '—'}`,
    ` commit    ${commit ?? '—'}         push       ${pushStr}`,
    ` esito     ${result}  fail       ${failures}/${maxFailures}`,
    ` prossimo  ${itemLine(next)}`,
    ` backlog   ${counts}   mode ${mode}`,
    `──────────────────────────────────────────────────────`,
  ].join('\n');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `export PATH="$HOME/.local/bin:$PATH"; node --test scripts/ralph/lib/checkpoint.test.mjs`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Confirm the suite still globs it in**

Run: `export PATH="$HOME/.local/bin:$PATH"; pnpm ralph:test`
Expected: PASS — all lib tests green (now including checkpoint).

- [ ] **Step 6: Commit**

```bash
git add scripts/ralph/lib/checkpoint.mjs scripts/ralph/lib/checkpoint.test.mjs
git commit -m "feat(ralph): deterministic checkpoint renderer for the interactive loop

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `checkpoint` subcommand in `ralph-cli.mjs`

**Files:**
- Modify: `scripts/ralph/ralph-cli.mjs` (add import + a `case 'checkpoint'`, and the help line)

**Interfaces:**
- Consumes: `renderCheckpoint` (Task 1); existing `selectNextItem`, `summarize`, `config`, `items`, `opt()`.
- Produces: CLI `node scripts/ralph/ralph-cli.mjs checkpoint [flags]` printing the block.
  Flags: `--iter N --max N --item <id> --result <s> --gate <green|red> --decision <s> --commit <sha> --push <yes|no> --failures N --max-failures N`.

- [ ] **Step 1: Add the import**

In `scripts/ralph/ralph-cli.mjs`, after the existing `import { journalPathFor } ...` line, add:

```javascript
import { renderCheckpoint } from './lib/checkpoint.mjs';
```

- [ ] **Step 2: Add the `checkpoint` case**

In the `switch (cmd)` block, immediately before `case 'config': {`, insert:

```javascript
  case 'checkpoint': {
    const findItem = (id) => items.find((i) => i.id === id) ?? (id ? { id } : null);
    const s = summarize(items);
    const pushOpt = opt('push');
    console.log(
      renderCheckpoint({
        iter: Number(opt('iter') ?? 0),
        max: Number(opt('max') ?? config.maxIterations ?? 12),
        item: findItem(opt('item')),
        result: opt('result') ?? '—',
        gate: opt('gate') ?? null,
        decision: opt('decision') ?? null,
        commit: opt('commit') ?? null,
        pushed: pushOpt == null ? null : pushOpt === 'yes',
        failures: Number(opt('failures') ?? 0),
        maxFailures: Number(opt('max-failures') ?? config.maxFailures ?? 3),
        next: selectNextItem(items),
        byStatus: s.byStatus,
        mode: config.mode,
      }),
    );
    break;
  }
```

- [ ] **Step 3: Update the help/usage line**

Replace the default-case help string:

```javascript
    console.error(`Commands: status | next | mode | decide | journal-path`);
```

with:

```javascript
    console.error(`Commands: status | next | mode | decide | journal-path | checkpoint | config`);
```

- [ ] **Step 4: Run it and verify the block renders**

Run:
```bash
node scripts/ralph/ralph-cli.mjs checkpoint --iter 1 --max 12 --item CHORE-001 \
  --result ITERATION_DONE --gate green --decision report --commit abc1234 --push yes --failures 0
```
Expected: prints the box; first line matches `─── Ralph · iterazione 1/12`, an `item` line containing `CHORE-001`, a `gate` line containing `🟢 green`, and a `backlog` line containing `mode pr-only` (values reflect the live `backlog.json`/`loop.config.json`).

- [ ] **Step 5: Confirm the lib suite is still green**

Run: `export PATH="$HOME/.local/bin:$PATH"; pnpm ralph:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/ralph/ralph-cli.mjs
git commit -m "feat(ralph): add 'checkpoint' subcommand to render loop status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Interactive loop brain + `/ralph-loop` command + README

**Files:**
- Create: `scripts/ralph/loop-interactive.prompt.md`
- Create: `.claude/commands/ralph-loop.md`
- Modify: `scripts/ralph/README.md` (document the two run modes)

**Interfaces:**
- Consumes: `iterate.prompt.md` (per-cycle brain), `discover.prompt.md` (refill), the
  `checkpoint` subcommand (Task 2), `ralph-cli.mjs config|next`.
- Produces: the `/ralph-loop [max]` slash command.

- [ ] **Step 1: Write the interactive loop brain**

Create `scripts/ralph/loop-interactive.prompt.md` with exactly:

````markdown
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
````

- [ ] **Step 2: Write the `/ralph-loop` slash command**

Create `.claude/commands/ralph-loop.md` with exactly:

```markdown
---
description: Run the NorthStar autonomous loop LIVE in this session — watch each iteration, with a checkpoint between cycles. Continuous until STOP / max-iter / no work.
argument-hint: [max-iterations]
---

Drive the interactive autonomous loop by following, to the letter, the protocol in
`scripts/ralph/loop-interactive.prompt.md`. Max iterations: `$1` if provided, else the
`maxIterations` from `scripts/ralph/loop.config.json`. Honor the kill-switch
(`scripts/ralph/STOP`) and the rollout `mode`. Each cycle reuses the per-iteration brain
in `scripts/ralph/iterate.prompt.md`; print the checkpoint via
`node scripts/ralph/ralph-cli.mjs checkpoint ...` between cycles.
```

- [ ] **Step 3: Document the two run modes in the README**

In `scripts/ralph/README.md`, add a section (place it after the existing run/usage section):

```markdown
## Two ways to run the loop

- **`/ralph-loop [max]` — interactive, attended.** Runs the loop LIVE in your Claude Code
  session: you watch every reasoning step, tool call, and decision, and a compact
  checkpoint prints between cycles. Continuous with checkpoints; stops on the `STOP` file,
  `maxFailures` consecutive failures, empty backlog (after discovery), or `maxIterations`.
  Interrupt anytime by typing. Brain: `loop-interactive.prompt.md`.
- **`scripts/ralph/loop.sh [max]` — headless, unattended.** Spawns `claude … --print` per
  iteration for overnight runs; output goes to `journal/run-YYYY-MM-DD.log`. Same
  deterministic core (`ralph-cli.mjs next`/`decide`) and the same per-iteration brain
  (`iterate.prompt.md`).

Both share the deterministic selection and integration-decision logic; the interactive
loop additionally renders status via `ralph-cli.mjs checkpoint`.
```

- [ ] **Step 4: Verify the command resolves and a single live cycle works**

Run a one-cycle smoke (manual, in-session): invoke `/ralph-loop 1` and confirm:
- it runs one cycle live (you see the work), and
- it prints the checkpoint block at the end.
Then verify the kill-switch path: `touch scripts/ralph/STOP`, invoke `/ralph-loop 1`,
confirm it ends immediately with `<promise>STOP</promise>` and prints a checkpoint with
`esito STOP`; finally `rm scripts/ralph/STOP`.

- [ ] **Step 5: Commit**

```bash
git add scripts/ralph/loop-interactive.prompt.md .claude/commands/ralph-loop.md scripts/ralph/README.md
git commit -m "feat(ralph): /ralph-loop — watch the autonomous loop live in-session

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** §4 components → Task 1 (checkpoint.mjs+test), Task 2 (CLI subcommand),
Task 3 (loop-interactive.prompt.md, ralph-loop.md, README). §5 checkpoint format → Task 1
renderer + Task 2 wiring. §6 control flow → Task 3 brain. §7 testing → Task 1 unit tests +
`pnpm ralph:test` + Task 3 Step 4 manual acceptance. §8 (Approach B) is explicitly out of
scope — no task, correct.

**Placeholder scan:** none — all code and file contents are literal.

**Type consistency:** `renderCheckpoint(state)` shape is identical in Task 1 (definition),
Task 1 tests, and Task 2 (call site): `iter,max,item,result,gate,decision,commit,pushed,
failures,maxFailures,next,byStatus,mode`. `summarize().byStatus` and `selectNextItem()`
used per their verified signatures. CLI flags in Task 2 match those emitted in Task 3 Step 1
(`--iter/--max/--item/--result/--gate/--decision/--commit/--push/--failures/--max-failures`).
