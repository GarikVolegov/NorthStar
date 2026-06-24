# Design — NorthStar Autonomous Development Loop

_Date: 2026-06-24 · Model: Opus 4.8 · Status: implemented (mode starts at `dry-run`)_

## Problem

The founder (solo operator) wants to delegate continuous development of NorthStar to an AI loop
that keeps finding problems, improvements, and new features, builds them, and improves its own
process — running unattended (e.g. overnight) — **without being asked for approval each time**,
yet **reliably and safely** enough to trust.

## Founder decisions (brainstorming)

1. **Autonomy boundary:** full autonomy, including merge to `main` and deploy to production.
2. **Substrate:** local Ralph-style loop, self-paced (machine stays on overnight).
3. **New features:** build what is discovered (not only propose).
4. **Priority:** bugs & security first → improvements/debt → features.

## Guiding principle — bounded autonomy

"Full autonomy" is made safe by replacing the **human** gate with **objective** gates, not by
removing the gate. A change reaches production only when:

- the full gate is green (`pnpm qa` — 14 steps), **and**
- `pnpm eval` clears the KPI thresholds (safety/privacy 100%, accuracy > 80%) for
  deploy-relevant changes, **and**
- the post-deploy health-check passes (else auto-rollback via `rollback.yml`).

Because the known launch blockers (DB boundary, Clerk test key) are currently red, the
priority-ordered loop drives them green **before** any autonomous deploy can fire. Non-negotiable
barriers from the global CLAUDE.md and `SECURITY_RULES.md` always hold: no secrets committed, no
third-party PII to the LLM, no force-push, real DB in tests.

## Architecture (layers)

- **L0 Memory & rules** (existing): `memoria.md`, `*_RULES.md`, `.brain/`.
- **L1 Backlog**: `scripts/ralph/backlog.json` — prioritized queue; discovery appends.
- **L2 Loop runner**: `loop.sh` (durable, evolves `ralph.sh`) running `iterate.prompt.md`.
- **L3 Discovery**: `discover.prompt.md` + three hunters refill the backlog.
- **L4 Safety envelope**: kill-switch, objective deploy gate, backoff, PreToolUse guard, journal.
- **L5 Self-improvement**: per-iteration retro + weekly meta-iteration → `PLAYBOOK.md`.

## Key design choices

- **Deterministic where it matters.** Item selection (priority policy) and the integration
  decision are pure, unit-tested functions (`lib/backlog.mjs`, `lib/deploy-gate.mjs`) invoked via
  `ralph-cli.mjs` — not left to in-prompt judgement. This is what makes the loop *reliable*.
- **The guard is a hook, not a permission list.** The headless loop runs
  `--dangerously-skip-permissions`, which bypasses settings.json allow/deny. Hooks are not
  bypassed, so the hard barriers live in a `PreToolUse` hook (`lib/guard-hook.mjs`).
- **Staged rollout to full autonomy.** `loop.config.json mode` walks `dry-run → pr-only →
  full-auto`; each step is one config change and earns trust with journal evidence.
- **Build on Ralph, don't replace it.** Large features generate a PRD and run as a Ralph
  sub-run; the loop is the always-on layer that keeps the backlog full.

## Verification

- `node --test scripts/ralph/lib/*.test.mjs` — 31 unit tests (selection, deploy decision,
  safety, journal, guard).
- `node scripts/ralph/ralph-cli.mjs status` — shows mode, STOP, backlog counts, next item.
- Guard verified by piping sample tool-call JSON (blocks force-push / `.env`; allows safe ops).
- Kill-switch: `touch scripts/ralph/STOP` → status reports paused; the runner exits before the
  next iteration.

## Follow-ups (require founder or runtime)

- Wire the safety hooks into `.claude/settings.json` (agent self-modification is gated by the
  harness — see the loop README; apply manually or approve the edit).
- Provide the Clerk test publishable key (SEC-001) and a reachable non-prod DB (FEAT-001) to
  unblock those backlog items.
- Promote `mode` from `dry-run` → `pr-only` → `full-auto` as confidence grows.
