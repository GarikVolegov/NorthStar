---
layer: process
status: draft
runtime: true
owner: garik
links_to: [[../_ROOT_MOC]], [[_MOC]], [[Active-Workstreams]], [[GSD-Phases/Fase-2-Cervello-Runtime]]
tags: [L3.5, process, agent-dev-kit, runtime]
updated: 2026-05-28
---

# Agent Development Kit

NorthStar usa un Agent Development Kit consolidato dentro `.brain` per rendere
gli agenti piu prevedibili, sincronizzati con il progetto e collegati allo
stesso contesto operativo.

## Layer

| Layer | Percorso | Ruolo |
|---|---|---|
| L1 Memory | `.brain/40_Agent_Context/AGENT_CONTEXT.md` | Costituzione comune per qualunque AI |
| L2 Rules | `.brain/40_Agent_Context/rules/` | Regole operative per API, DB, frontend, AI, git e security |
| L3 Skills | `.brain/40_Agent_Context/claude/skills/`, `.brain/40_Agent_Context/agent-skills/skills/` | Conoscenza modulare invocabile on demand |
| L4 Hooks/Subagents | `.brain/40_Agent_Context/claude/hooks/`, `.brain/40_Agent_Context/claude/agents/` | Guardrail e deleghe archiviate in un solo posto |
| L5 Plugins/Workflows | `.brain/40_Agent_Context/plugins/`, `.brain/40_Agent_Context/custom-workflows/` | Bundle, workflow e report agentici |

## Sincronizzazione

- `.brain/40_Agent_Context/` e' la sorgente primaria per Claude, Codex,
  OpenCode e strumenti affini.
- Il file ponte in root (`AGENTS.md`) rimanda allo stesso contesto per tutti.
- `.brain/40_Agent_Context/claude/skills/agent-browser.md` e' la skill runtime-operativa per browser
  QA, screenshot, form flow, test esplorativi e dashboard dogfooding; usa la
  guida aggiornata del CLI `agent-browser skills get core`.
- `.brain/40_Agent_Context/agent-skills/skills/` conserva le skill pesanti gia
  versionate senza disperderle in cartelle tool-specific.
- Cartographer propone diff tra planning in Brain, skill, agenti e community
  Graphify.

## Guardrail

- Non editare output Graphify generati.
- Non editare worktree temporanei se `git worktree list --porcelain` li mostra attivi.
- Non attraversare `node_modules/**` o scratch dir ricreati localmente.
- Non salvare profili, auth state, screenshot sensibili o output
  `agent-browser` in percorsi tracciati.
- Nessun hook deve scrivere nel repo senza consenso esplicito.
- Cartographer e subagent operano review-first quando toccano memoria o MOC.
