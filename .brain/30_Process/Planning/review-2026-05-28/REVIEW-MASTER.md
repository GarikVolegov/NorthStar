# REVIEW-MASTER — Revisione monorepo NorthStar (2026-05-28)

Sintesi di [REVIEW-ai-server.md](REVIEW-ai-server.md), [REVIEW-server.md](REVIEW-server.md), [REVIEW-web.md](REVIEW-web.md), [REVIEW-db.md](REVIEW-db.md).

## Verdetto generale

**Il codebase è in ottimo stato.** Nessun finding CRITICAL. La pipeline `quality:required` è seria, l'architettura è disciplinata (route-config centralizzato, 3 registry layer, feature-protocol audit, file-size ratchet), e la Fase 2 "Cervello Runtime" si è inserita in modo additivo senza lasciare relitti della vecchia pipeline.

I findings sono concentrati su: convergenza routing frontend (1 HIGH), 2 route file orfani backend (1 HIGH), file giganti, e cleanup di script di migrazione monorepo one-shot.

## Tabella di sintesi

| Dominio | CRITICAL | HIGH | MEDIUM | LOW | Totale |
|---|---:|---:|---:|---:|---:|
| ai-server | 0 | 0 | 2 | 5 | 7 |
| server | 0 | 1 | 4 | 2 | 7 |
| web | 0 | 1 | 3 | 2 | 6 |
| db | 0 | 0 | 2 | 2 | 4 |
| **TOTALE** | **0** | **2** | **11** | **11** | **24** |

## Findings HIGH — da affrontare per primi

### H1 · F-SV-1 — 2 route file mai registrati
- `apps/server/src/routes/wiki-telemetry.ts`
- `apps/server/src/routes/xp-constants.ts`
- Decidere: REMOVE o RECONNECT entro la prossima settimana.

### H2 · F-WB-1 — Routing duale frontend
- `route-config.ts` ↔ `App.tsx` definiscono path in due posti.
- Migrare le 12+ route da `App.tsx` dentro `route-config.ts` (eccetto i 2 catch-all Clerk + NotFound).

## Findings MEDIUM (11)

Da pianificare in 2-3 PR tematici:

**PR-cleanup-orphans** (1-2 ore):
- F-AI-1 · `packages/ai-server/src/tools/index.ts` orfano (REMOVE)
- F-SV-4 · `apps/server/src/lib/routine-schedule.ts` orfano (REMOVE)
- F-WB-2 · `pages/roadmap-sse.ts` + `pages/test-draft.ts` orfani (REMOVE)
- F-WB-3 · 6 widget dashboard morti (REMOVE)
- F-DB-1 · 6 script `migrate-v*` legacy (ARCHIVE)

**PR-naming-and-routing** (3-4 ore):
- F-SV-2 · Rinominare `routes/agent.ts` → `routes/agent-runner.ts`
- F-SV-7 · Consolidare `requireAdminAccess` vs `requireAdmin`
- F-WB-1 · Migrare le route App.tsx → route-config.ts (HIGH, già sopra)

**PR-file-size-split** (8-12 ore):
- F-SV-3 · Split `routes/admin/agents.ts` (685) + `routes/ai-wendy.ts` (696)
- F-WB-4 · Split `AgentsSection.tsx` (732), `types.ts` (640), `useWendyChat.ts` (625), `SearchDialog.tsx` (604)

**PR-db-hygiene** (1 ora):
- F-AI-6 · Decidere il futuro di `memory-graph.ts` (overlap con `wendy-brain`)
- F-DB-2 · Documentare il naming misto delle migration

## Findings LOW (11)

Non urgenti. Backlog di hygiene:
- F-AI-2/3/4: refactor file lunghi ai-server (non dead)
- F-AI-5/7: docstring brain/neural + ingestion landscape
- F-SV-5/6: rate-limit map espliciti + verifica CSRF su public POST
- F-WB-5/6: PATHS completo + audit hook overlap
- F-DB-3/4: docs db-guardian + reorg root scripts

## Cosa SI può fare subito (low-risk wins)

In una singola sessione di 60-90 minuti si possono chiudere:
- PR-cleanup-orphans (10 file dead + 6 script archive)
- F-SV-2 (rename agent.ts)
- F-DB-4 (move 2 script in db/scripts/)

Tutto il resto richiede decisioni semantiche (overlap brain/memory-graph, dual routing) o tempo di refactor.

## Riferimenti

- Output audit: [baseline/](baseline/)
- Mappa dipendenze: [dependency-map.md](dependency-map.md)
- Reports per dominio: REVIEW-ai-server.md · REVIEW-server.md · REVIEW-web.md · REVIEW-db.md
- Roster agent-kit aggiornato: vedi `.brain/40_Agent_Context/AGENT_CONTEXT.md`.
