# Sub-1 — Per-Iteration Multi-Agent Review Pipeline — Design

> **Status:** approved (founder, 2026-06-27) · **Author:** Opus 4.8
> **Topic:** make every loop modification "perfect" by reviewing it with a risk-scaled
> panel of specialist agents before it can be integrated.
> **Part of:** the "agente-loop a 360° + agenti in parallelo" initiative. This is
> **Sub-project 1** (quality). Sub-project 2 (parallel execution of independent items)
> is a separate later spec that *runs* this pipeline in parallel worktrees.

## 1. Problem

The autonomous loop's per-iteration brain (`scripts/ralph/iterate.prompt.md`) implements
a backlog item, runs the gate (`pnpm qa`), self-reviews, commits, and integrates. There is
**no independent review** of the change. During the 2026-06-27 "continua a oltranza" run,
7 items shipped on self-review alone — including a P1 cost/security bug (BUG-002) and DB
schema changes — with no second pair of eyes. The founder wants every modification held to
a high, multi-angle bar before it can be pushed/merged.

> Founder, verbatim: *"migliorare l'agente in loop per farlo lavorare bene a 360 gradi e
> farlo lavorare con altri agenti in parallelo per un risultato perfetto su ogni modifica."*

## 2. Goal & decisions

Insert a **multi-agent review** step into each iteration, after the change is committed and
the gate is green, **before** the integration decision. A **risk-scaled panel** of specialist
reviewer subagents runs **in parallel**; their findings drive a bounded fix-loop; an unresolved
Critical/Important finding makes the review **red**, which—like a red gate—**holds** integration.

Decisions taken during brainstorming:
- **Scope:** both quality (multi-angle review per change) and throughput (parallel items) were
  wanted; decomposed into Sub-1 (this spec) then Sub-2. Sub-1 first — it is the unit Sub-2 runs.
- **Review angles (5):** correctness/bugs · security · test-quality · design/reuse/rules ·
  **server/API consistency** (founder addition).
- **Cost vs rigor:** risk-scaled panel via a **deterministic** triage (not an LLM's judgment).
  Security is always included when code changes.
- **Adjudication:** review is an **objective gate**. Critical+Important block; a bounded
  fix-loop resolves them; if they persist → review red → `hold` + file a P1 bug. Minor recorded.
- **Placement:** inside `iterate.prompt.md` (new Step 6.5), identical for headless `loop.sh`
  and interactive `/ralph-loop`.

Non-goals (YAGNI): parallel execution of multiple items (Sub-2); a human-in-the-loop
adjudicator (the loop is autonomous); reviewing the loop's own bookkeeping commits.

## 3. Architecture & where it plugs in

Per-iteration flow becomes:

```
… implement → gate green → commit (WORK commit, local)
   → 6.5 REVIEW:  review-panel (deterministic) → reviewers in parallel (subagents)
                  → adjudicate (fix-loop, max 2) → reviewResult {green|red}
   → decide --gate green --review <green|red>   → report / open-pr / deploy / HOLD
   → record (journal/memoria/backlog = bookkeeping commit, NOT reviewed)
```

The per-iteration agent (the one already executing `iterate.prompt.md`, whether spawned by
`loop.sh` or acting in `/ralph-loop`) generates a **diff package** for the work commit and
dispatches the reviewer subagents. The critical control logic stays **deterministic and
tested** in `lib/*.mjs`; the *judgment* (findings) is the agents'; the reviewer prompts are
isolated reusable units.

### Files

| File | Role | Change |
|---|---|---|
| `scripts/ralph/lib/review-panel.mjs` (+`.test.mjs`) | Pure triage: `reviewPanel({type, area, hasCodeChange}) → string[]` reviewer ids. Unit-tested. | new |
| `scripts/ralph/lib/deploy-gate.mjs` | `decideIntegration` gains `reviewGreen`; invariant: red gate **or** red review → `hold`. | modify |
| `scripts/ralph/lib/deploy-gate.test.mjs` | Cases for `reviewGreen` across all modes. | modify |
| `scripts/ralph/ralph-cli.mjs` | subcommands `review-panel` (prints the reviewer list) + `decide --review green\|red`. | modify |
| `scripts/ralph/review/{correctness,security,tests,design,consistency}.md` | The 5 reviewer prompts; hook `/code-review`, `/security-review`, `/simplify`, the `*_RULES.md`, the `audit:*`/`api-spec`. | new |
| `scripts/ralph/review/adjudicate.md` | The fix-loop + severity-aggregation procedure the iteration agent follows. | new |
| `scripts/ralph/iterate.prompt.md` | New Step 6.5 + updated `decide` call. | modify |
| `scripts/ralph/lib/journal.mjs` | Journal entry records review outcome + findings by severity. | modify |
| `scripts/ralph/lib/checkpoint.mjs` (+ test) | Checkpoint adds a `review` line. | modify |

`loop.sh` structure is unchanged (only the brain it runs changes).

## 4. Deterministic triage + reviewer set

`reviewPanel({ type, area, hasCodeChange })` → reviewer ids, by tier:

| Tier | When | Reviewers |
|---|---|---|
| **FULL** | `type ∈ {bug, security}` **or** `area ∈ {api, db, ai, wendy}` | correctness, security, tests, design, consistency |
| **STANDARD** | `area === web` and code changed | correctness, security, tests, design |
| **LIGHT** | other code change (`repo`, `scripts`, …) | correctness, security, design |
| **MINIMAL** | `hasCodeChange === false` (docs/ci/config only) | design |

Rules encoded: **security is present in every tier that touches code** (FULL/STANDARD/LIGHT);
**consistency** runs only in FULL (server/API areas); **MINIMAL** is a single design/rules
sanity pass. `hasCodeChange` = the work-commit diff touches `.ts/.tsx/.js/.jsx/.mjs/.sql`
(not just `.md/.yml/.json` docs/config).

The 5 reviewers (parallel subagents). Each gets: the diff package (`BASE..HEAD` of the work
commit), the item brief, and the relevant rules file(s). Each returns severity-tagged findings
(Critical/Important/Minor) with `file:line`, in the task-reviewer output format.

| Reviewer | Looks for | Hooks |
|---|---|---|
| **correctness** | bugs, edge cases, regressions, wrong logic | `/code-review` semantics |
| **security** | IDOR/authz, secrets, PII→LLM, injection, `userId` from `req.user.id` | `/security-review` + `SECURITY_RULES.md` |
| **tests** | tests assert real behavior (not empty mocks), edge coverage, real-DB | `DB_RULES.md` |
| **design** | reuse vs duplication, file-size, area Regola-0 compliance | `/simplify` + `*_RULES.md` |
| **consistency** | OpenAPI↔Zod, `route-config`, `db-types`, generated client, `api-routes.md` | the `audit:*` + `api-spec`/`api-zod` |

**Model selection (cost):** security and correctness on a capable model; tests/design/
consistency mid-tier; all **scaled down for a tiny diff** (a few-line diff uses the cheap tier
even for the "capable" angles). Reviewers always run in parallel so wall-clock stays low.

## 5. Adjudication: fix-loop + review-as-gate

1. Aggregate findings across reviewers by max severity.
2. **Minor** → recorded (journal + optional dedup'd P3 backlog items); do **not** block.
3. **Critical/Important** → the iteration agent (it is the implementer, holds the context)
   fixes them **inline**, re-runs the **gate** (must stay green), re-commits (amend/fix-commit),
   then re-dispatches **only the reviewers that flagged** on the new diff.
4. **Fix-loop cap = 2 rounds.** If the implementer judges a finding a false positive, it must
   **justify** it in the fix report; if the reviewer re-flags after the justification, it counts
   as **unresolved** (review = objective gate, not arbiter).
5. If Critical/Important remain after the cap → **reviewResult = red**.

Deterministic decision (`decideIntegration`):
```js
if (!gateGreen || !reviewGreen) return 'hold';   // red gate OR red review → never integrate
// else: existing behavior by mode (dry-run→report, pr-only→open-pr, full-auto→deploy w/ eval)
```
- **review green** → integrate per `mode` as today.
- **review red** → `hold`: iteration ends **BLOCKED**, files a **P1 bug** capturing the
  unresolved findings, leaves the work **on the branch** (no push/PR/merge); anti-thrash
  backoff counts it as a failure.

## 6. Recording, observability & cost controls

**Observability:**
- **Journal** per iteration: the panel used, each reviewer's verdict, finding counts by
  severity (+ brief), fix-loop rounds, final review result.
- **Checkpoint** (`/ralph-loop` live): a new `review` line, e.g.
  `review  🟢 5 rev · 0 crit · 1 imp (fixed) · 2 minor` or `review  🔴 1 crit → HOLD`.
- **Minor** findings → a findings log and, with dedup, optional P3 backlog items.

**Cost controls (beyond the risk-scaled panel):**
- The review runs **only on the work commit**, never on the loop's bookkeeping commits
  (journal/memoria/backlog) — those are not product changes.
- **Model scaling by diff size** (tiny diff → cheap tier even for capable angles).
- **Parallel dispatch** keeps wall-clock low.

## 7. Testing

- `lib/review-panel.mjs`: unit tests for each tier (FULL/STANDARD/LIGHT/MINIMAL),
  "security always on code", "consistency only in FULL", "no-code → minimal".
- `lib/deploy-gate.mjs`: extend `deploy-gate.test.mjs` — red review → `hold` in **every** mode;
  green review → existing behavior.
- `lib/checkpoint.mjs`: extend tests for the new `review` line.
- Reviewer prompts + `adjudicate.md` are prose (like `iterate`/`discovery`) → validated by a
  **dry-run of one iteration**, not unit-tested.
- `pnpm ralph:test` stays green.

## 8. Out of scope / follow-ups

- **Sub-2 — parallel item execution**: a coordinator runs N independent items in separate
  git worktrees, each running this Sub-1 pipeline, integrating serially. Separate spec.
- An LLM **adjudicator** for contested findings (rejected for Sub-1: review stays a strict
  objective gate).
- Per-iteration review **token-cost telemetry** (could be added to the journal later).
