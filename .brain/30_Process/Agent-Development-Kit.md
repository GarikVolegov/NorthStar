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

NorthStar usa un Agent Development Kit a 5 layer per rendere gli agenti piu
prevedibili, sincronizzati con il progetto e collegati al cervello `.brain`.

## Layer

| Layer | Percorso | Ruolo |
|---|---|---|
| L1 Memory | `.claude/CLAUDE.md` | Costituzione del progetto, mappa repo, regole operative |
| L2 Skills | `.claude/skills/` | Conoscenza modulare invocabile on demand |
| L3 Hooks | `.claude/settings.json`, `.claude/hooks/` | Guardrail deterministici sugli eventi agente |
| L4 Subagents | `.claude/agents/` | Deleghe con contesto e responsabilita isolate |
| L5 Plugins | `plugins/northstar-agent-kit/` | Bundle futuro per distribuire lo stack al team |

## Sincronizzazione

- `.claude/` e' la sorgente primaria per Claude Code.
- `.brain/` e' la memoria navigabile e runtime; questo nodo sintetico e'
  `runtime: true` per Wendy.
- `.claude/skills/agent-browser.md` e' la skill runtime-operativa per browser
  QA, screenshot, form flow, test esplorativi e dashboard dogfooding; usa la
  guida aggiornata del CLI `agent-browser skills get core`.
- `.agents/skills/` resta una libreria di skill pesanti gia versionate, senza
  duplicazione dentro `.claude/skills/`.
- Cartographer propone diff tra `.planning`, `.brain`, `.claude/skills`,
  `.claude/agents` e community Graphify.

## Guardrail

- Non editare `.brain/90_Code/**`.
- Non editare `.claude/worktrees/**`.
- Non attraversare `.opencode/node_modules/**`.
- Non salvare profili, auth state, screenshot sensibili o output
  `agent-browser` in percorsi tracciati.
- Nessun hook deve scrivere nel repo senza consenso esplicito.
- Cartographer e subagent operano review-first quando toccano memoria o MOC.
