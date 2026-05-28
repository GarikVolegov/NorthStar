---
layer: process
status: in-progress
runtime: true
owner: garik
links_to: [[../../20_Product/Subsystems/Wendy]], [[../../20_Product/Subsystems/RAG-Pipeline]], [[../../20_Product/_MOC]]
tags: [L3.5, process, phase, fase-2, brain-runtime]
updated: 2026-05-28
---

# Fase 2 - Cervello Runtime

## Obiettivo
Rendere il vault `.brain/` interrogabile da Wendy a runtime tramite pgvector, riusando `rag_sources` e `rag_chunks` con `source_type = "brain"`.

## Stato
- Bootstrap `.brain/` completato nella fase precedente: L1-L3.5 sono versionati, `90_Code` resta output Graphify ignorato.
- DB: `obsidian_path` identifica in modo idempotente le sorgenti brain.
- Worker: `vault-ingest` legge solo note Markdown con `runtime: true`.
- Wendy: `search_brain` separa il cervello interno dal RAG di mercato.

## File chiave
- `.planning/phases/fase-2-cervello-runtime/PLAN.md`
- `apps/server/src/jobs/vault-ingest.ts`
- `packages/ai-server/src/wendy-router/tool-handlers-market.ts`
- `packages/db/src/schema/ragSource.ts`

## Cartographer
Al termine della fase, invocare `/cartographer phase-sync HEAD~1..HEAD` per proporre aggiornamenti a MOC, note subsystem e label semantiche delle community Graphify.
