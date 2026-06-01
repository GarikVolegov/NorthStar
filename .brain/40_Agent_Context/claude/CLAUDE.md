---
layer: memory
status: stable
owner: garik
updated: 2026-05-28
---

# NorthStar Claude Source Notes

This file preserves Claude-specific source notes inside the shared Brain. The
canonical entry point for every AI tool is root `AGENTS.md`, followed by
`.brain/40_Agent_Context/AGENT_CONTEXT.md`.

## Project Map

- `.brain/` is the curated NorthStar brain. Start at `.brain/_ROOT_MOC.md`.
- `.brain/30_Process/Planning/phases/` contains active GSD phase plans.
- `apps/server/` owns API, jobs, cron, and server runtime.
- `apps/web/` owns the user-facing React app.
- `packages/ai-server/` owns Wendy routing, tools, prompts, and AI orchestration.
- `packages/db/` owns Drizzle schema and migrations.
- `graphify-out/` is generated output. Do not hand-edit it.

## Operating Rules

- Read the relevant rule file before touching its area:
  - `.brain/40_Agent_Context/rules/AI_RULES.md` for AI, Wendy, prompts, LLM, RAG.
  - `.brain/40_Agent_Context/rules/DB_RULES.md` for schema, migrations, seed, SQL.
  - `.brain/40_Agent_Context/rules/GIT_RULES.md` for commits, branches, PRs, and secret checks.
  - `.brain/40_Agent_Context/rules/FRONTEND_RULES.md` for UI work.
  - `.brain/40_Agent_Context/rules/SECURITY_RULES.md` for auth, PII, secrets, and production safety.
- Keep generated Graphify output untouched; it is rebuilt on demand and ignored by Git.
- Check `git worktree list --porcelain` before removing temporary worktrees.
- Treat `.env.local` and real secrets as off-limits. Root `.env` is the versioned placeholder template only.
- Prefer review-first maintenance: proposed diffs before writes for brain/cartography changes.

## Current GSD Context

- Current branch: `feature/fase2-cervello-runtime`.
- Current process note: `.brain/30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md`.
- Runtime brain path: `.brain/` with selected `runtime: true` markdown ingested by `vault-ingest`.
- Wendy should prefer `search_brain` for internal NorthStar/product questions and `search_rag` for labor-market/domain knowledge.

## Agent Development Kit Layers

- L1 Memory: `AGENTS.md` + `.brain/40_Agent_Context/AGENT_CONTEXT.md`.
- L2 Skills: `.brain/40_Agent_Context/claude/skills/*.md`.
  - `agent-browser` is the preferred project skill for browser QA, screenshots,
    form flows, exploratory testing, and dashboard dogfooding.
  - `.brain/40_Agent_Context/agent-skills/skills/browser-use` remains the existing fallback/alternative
    browser automation skill.
- L3 Hooks: `.brain/40_Agent_Context/claude/settings.json` plus `.brain/40_Agent_Context/claude/hooks/*.ps1`.
- L4 Subagents: `.brain/40_Agent_Context/claude/agents/*.md`. Roster (7) — pick the narrowest fit:
  - `brain-cartographer` — `.brain` notes, MOCs, Graphify community labels (review-first).
  - `code-reviewer` — diff quality, regressions, maintainability, tests. Delegates security/DB/legacy.
  - `db-guardian` — schema, migrations, seed, pgvector/RAG storage safety.
  - `legacy-hunter` — dead code, orphans, semantic duplicates, superseded subsystems.
  - `security-auditor` — auth, admin routes, secrets, rate limit, CSRF, input validation.
  - `test-runner` — focused verification commands, failure summaries.
  - `wendy-rag-reviewer` — Wendy tools, RAG, brain search, Fase 2 boundary check.
- L5 Plugin bundle: `.brain/40_Agent_Context/plugins/northstar-agent-kit/`.

## Sync Loop

After a GSD phase, subsystem change, or Graphify refresh:

1. Run or invoke Cartographer in review-first mode.
2. Compare `.brain/30_Process/Planning/phases/**/PLAN.md`, changed files, `.brain` MOCs, and Graphify communities.
3. Propose diffs to `.brain` and agent-kit docs.
4. Write only after explicit approval.
