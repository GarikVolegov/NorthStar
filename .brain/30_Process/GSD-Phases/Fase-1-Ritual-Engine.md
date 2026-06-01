---
layer: process
status: in-progress
runtime: true
owner: garik
links_to: [[../../20_Product/Subsystems/AAaS-Ritual]], [[../../20_Product/Subsystems/Dashboard]], [[../../20_Product/Pipelines/development]]
tags: [L3.5, process, phase, fase-1]
updated: 2026-05-28
---

# Fase 1 — Ritual Engine + Dashboard Personalizzabile

**Branch**: `feature/fase1-ritual-engine` · **Plan**: `.brain/30_Process/Planning/`
**Architettura ref**: contesto storico consolidato in `.brain/40_Agent_Context/`

## Obiettivo
Trasformare NorthStar da SaaS reattivo a SaaS+AaaS con agenti autonomi user-level e dashboard personalizzabile.

## Mappa step

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7 → Step 8 → Step 9
  DB      API     Worker   Agents  Delivery  AI Tool  UI-Dash  UI-Rout  Tests+Gate
```

## Stato (da recent commits)
| Step | Tipo | Stato | Commit ref |
|---|---|---|---|
| 1 | db | ✅ done | (history) |
| 2 | api | ✅ done | |
| 3 | worker | ✅ done | |
| 4 | agent | ✅ done | `d2454db feat(aaas): Step 4 — implement 5 routine executors` |
| 5 | delivery | ✅ done | |
| 6 | ai-tool | ✅ done | `a9a45a6 feat(aaas): Step 6 — configure_routine Wendy tool` |
| 7+8 | ui-component / ui-page | ✅ done | `2a131af feat(aaas): Steps 7+8 — dashboard personalizzabile + pagina /routines` |
| 9 | test+gate | 🟡 in-progress | `747dcfb feat(aaas): Step 9 (partial) — test coverage` |

## Tabelle introdotte
- `userRoutinesTable` (`packages/db/src/schema/userRoutines.ts`)
- `userDashboardLayoutTable` (`packages/db/src/schema/userDashboardLayout.ts`)

## Verifica freshness
Confronta lo step più recente in `git log --oneline` con questa tabella. Se diverge → Cartographer da rilanciare.
