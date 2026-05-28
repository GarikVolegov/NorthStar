---
layer: memory
status: stable
owner: garik
updated: 2026-05-28
---

# NorthStar Claude Constitution

This file is the project memory layer for Claude Code. It is always project-scoped:
do not write to `~/.claude/` from this repo.

## Project Map

- `.brain/` is the curated NorthStar brain. Start at `.brain/_ROOT_MOC.md`.
- `.planning/phases/` contains active GSD phase plans.
- `apps/server/` owns API, jobs, cron, and server runtime.
- `apps/web/` owns the user-facing React app.
- `packages/ai-server/` owns Wendy routing, tools, prompts, and AI orchestration.
- `packages/db/` owns Drizzle schema and migrations.
- `graphify-out/` is generated output. Do not hand-edit it.

## Operating Rules

- Read the relevant rule file before touching its area:
  - `AI_RULES.md` for AI, Wendy, prompts, LLM, RAG.
  - `DB_RULES.md` for schema, migrations, seed, SQL.
  - `GIT_RULES.md` for commits, branches, PRs, and secret checks.
  - `FRONTEND_RULES.md` for UI work.
  - `SECURITY_RULES.md` for auth, PII, secrets, and production safety.
- Keep `.brain/90_Code/` untouched; it is a junction to generated Graphify output.
- Keep `.claude/worktrees/` untouched; it is execution scratch space.
- Treat `.env` and real secrets as off-limits. `.env.example` may contain placeholders only.
- Prefer review-first maintenance: proposed diffs before writes for brain/cartography changes.

## Current GSD Context

- Current branch: `feature/fase2-cervello-runtime`.
- Current process note: `.brain/30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md`.
- Runtime brain path: `.brain/` with selected `runtime: true` markdown ingested by `vault-ingest`.
- Wendy should prefer `search_brain` for internal NorthStar/product questions and `search_rag` for labor-market/domain knowledge.

## Agent Development Kit Layers

- L1 Memory: `.claude/CLAUDE.md`.
- L2 Skills: `.claude/skills/*.md`.
  - `agent-browser` is the preferred project skill for browser QA, screenshots,
    form flows, exploratory testing, and dashboard dogfooding.
  - `.agents/skills/browser-use` remains the existing fallback/alternative
    browser automation skill.
- L3 Hooks: `.claude/settings.json` plus `.claude/hooks/*.ps1`.
- L4 Subagents: `.claude/agents/*.md`. Roster (7) — pick the narrowest fit:
  - `brain-cartographer` — `.brain` notes, MOCs, Graphify community labels (review-first).
  - `code-reviewer` — diff quality, regressions, maintainability, tests. Delegates security/DB/legacy.
  - `db-guardian` — schema, migrations, seed, pgvector/RAG storage safety.
  - `legacy-hunter` — dead code, orphans, semantic duplicates, superseded subsystems.
  - `security-auditor` — auth, admin routes, secrets, rate limit, CSRF, input validation.
  - `test-runner` — focused verification commands, failure summaries.
  - `wendy-rag-reviewer` — Wendy tools, RAG, brain search, Fase 2 boundary check.
- L5 Plugin bundle: `plugins/northstar-agent-kit/`.

## Sync Loop

After a GSD phase, subsystem change, or Graphify refresh:

1. Run or invoke Cartographer in review-first mode.
2. Compare `.planning/phases/**/PLAN.md`, changed files, `.brain` MOCs, and Graphify communities.
3. Propose diffs to `.brain` and agent-kit docs.
4. Write only after explicit approval.
