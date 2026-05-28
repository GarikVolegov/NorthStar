---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[Wendy]], [[Dashboard]], [[../Pipelines/development]], [[../Pipelines/infra-health]]
tags: [L3, product, aaas, ritual, agents]
updated: 2026-05-28
---

# AAaS — Ritual Engine

## Ruolo
Engine di **routine schedulate user-level**. Gira agenti in background per conto dell'utente loggato (job monitor, market report, mindset, growth briefing, interview prep) e consegna l'output via email, in-app, o nel context di Wendy.

## Stato (Fase 1 — `feature/fase1-ritual-engine`)
Vedi [[../../30_Process/GSD-Phases/Fase-1-Ritual-Engine]].
- Step 1: DB schema (`user_routines`, `user_dashboard_layout`) ✅
- Step 4: 5 executor implementati ✅
- Step 6: tool Wendy `configure_routine` ✅
- Step 7-8: dashboard personalizzabile + pagina /routines ✅
- Step 9: test coverage in corso

## Confini
- **Cosa fa**: schedula via cron, esegue executor con timeout, registra `lastRunAt`/`nextRunAt`, consegna briefing
- **Cosa NON fa**: azioni cross-user, esecuzione senza `active: true`, batch senza `.limit()`

## Tipi di routine
| Tipo | Cosa fa | Output tipico |
|---|---|---|
| `job_monitor` | Scansiona nuovi posting matching profilo | Lista posting + match score |
| `market_report` | Aggrega snapshot mensili rilevanti | Trend report |
| `mindset_exercise` | Esercizio coaching schedulato | Prompt riflessivo |
| `growth_briefing` | Briefing settimanale crescita | Sintesi + azioni suggerite |
| `interview_prep` | Domande mirate al prossimo target | Set domande + framework |

## File chiave
- `apps/server/src/jobs/cron.ts` — scheduler
- `apps/server/src/jobs/routine-scheduler.test.ts`
- `apps/server/src/jobs/routine-types.ts`
- `apps/server/src/jobs/executors/index.ts` (+ un file per ogni tipo)
- `packages/db/src/schema/userRoutines.ts`
- `apps/web/src/components/dashboard/widgets/NextRoutineWidget.tsx`

## Security gates rilevanti
`gate-db`, `gate-worker`, `gate-agent`, `gate-delivery` — vedi [[../Pipelines/development]].
