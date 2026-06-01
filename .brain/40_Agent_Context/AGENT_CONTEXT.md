---
layer: agent-context
status: stable
runtime: true
owner: garik
links_to: [[../_ROOT_MOC]], [[../30_Process/Agent-Development-Kit]]
tags: [L3.6, agent-context, rules, runtime]
updated: 2026-06-01
---

# NorthStar Agent Context

Questa e' la fonte unica per qualsiasi agente AI che lavora su NorthStar.
L'unico file ponte in root e' `AGENTS.md`; non creare file root separati per
Claude, Codex, Gemini o altri tool.

## Prima Lettura

1. Apri `.brain/_ROOT_MOC.md` per la mappa del cervello NorthStar.
2. Apri questo file per il contratto operativo comune.
3. Apri la regola della tua area in `.brain/40_Agent_Context/rules/`.
4. Prima di modificare codice, controlla `docs/REPOSITORY_STRUCTURE.md`.

## Regole Unificate

| Area | File |
|---|---|
| Backend API | `.brain/40_Agent_Context/rules/API_RULES.md` |
| Database | `.brain/40_Agent_Context/rules/DB_RULES.md` |
| Frontend | `.brain/40_Agent_Context/rules/FRONTEND_RULES.md` |
| AI, Wendy, RAG, LLM | `.brain/40_Agent_Context/rules/AI_RULES.md` |
| Git, branch, commit | `.brain/40_Agent_Context/rules/GIT_RULES.md` |
| Security, auth, PII | `.brain/40_Agent_Context/rules/SECURITY_RULES.md` |

## Struttura Agenti

| Contenuto | Percorso canonico |
|---|---|
| Memoria Claude storica | `.brain/40_Agent_Context/claude/CLAUDE.md` |
| Skill Claude | `.brain/40_Agent_Context/claude/skills/` |
| Subagent Claude | `.brain/40_Agent_Context/claude/agents/` |
| Hook Claude archiviati | `.brain/40_Agent_Context/claude/hooks/` |
| Skill locali pesanti | `.brain/40_Agent_Context/agent-skills/skills/` |
| Piani OpenCode | `.brain/40_Agent_Context/opencode/plans/` |
| Agenti custom | `.brain/40_Agent_Context/custom-agents/` |
| Workflow custom e report | `.brain/40_Agent_Context/custom-workflows/` |
| Ralph loop | `.brain/40_Agent_Context/ralph/RALPH_INSTRUCTIONS.md` |
| Bundle agent kit | `.brain/40_Agent_Context/plugins/northstar-agent-kit/` |

## Guardrail

- Non toccare `.env` o segreti reali.
- Non editare `graphify-out/` o altri output Graphify generati.
- Prima di rimuovere worktree o scratch dir, controlla `git worktree list --porcelain`.
- Non modificare `apps/`, `api/`, `lib/` o `packages/` per pura pulizia senza test mirati.
- Prima di eliminare file, verifica se sono tracciati da git e se sono citati da codice, script o documentazione.

## Contratto Di Riorganizzazione

La root del repository deve restare piccola: manifest, configurazioni, README,
documentazione essenziale e file ponte per gli agenti. Le regole e il contesto
agentico vivono qui dentro, nel cervello versionato.
