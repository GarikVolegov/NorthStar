---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[Wendy]], [[../../10_Domain/Job-Market-Italy]], [[../Pipelines/eval-wendy]], [[../../30_Process/GSD-Phases/Fase-2-Cervello-Runtime]]
tags: [L3, product, rag, pgvector]
updated: 2026-05-28
---

# RAG Pipeline

## Ruolo
Grounding di Wendy su dati reali: knowledge base interna, snapshot job posting, weak signals, skill cooccurrence. Trasforma il LLM da "opinatore" a "analista che cita fonti".

## Stato (Step 6 — vedi `step6_rag_intelligence.md`)
Implementato ma migration `0014_step6_rag_weak_signals.sql` da applicare in produzione (verifica).

## Schema (`packages/db/src/schema/`)
- `ragSource.ts` → `ragSourcesTable` (trust_score per fonte)
- `ragChunk.ts` → `ragChunksTable` (embedding pgvector 1536 dim, indice IVFFlat lists=100)
- `weakSignal.ts` → `weakSignalsTable`
- `jobPostingSnapshot.ts` → `jobPostingSnapshotsTable`
- `skillCooccurrence.ts` → `skillCooccurrencesTable`
- `proactiveInsight.ts` → `proactiveInsightsTable`

## Tool Wendy esposti
| Tool | Funzione |
|---|---|
| `search_rag(query, filters, topK)` | Ricerca semantica knowledge base |
| `search_brain(query, layer?, limit?)` | Ricerca nel cervello interno `.brain/` con `obsidianPath` |
| `get_weak_signals(sectorId?, status?, geography?, limit?)` | Segnali emergenti |
| `get_job_posting_trend(roleTitle?, professionId?, geography, periods[])` | Trend posting |
| `get_skill_cooccurrences(skillName, professionId?, limit?)` | Skill correlate |

Handler in `packages/ai-server/src/wendy-router/tool-handlers.ts`, dispatcher `executeToolCall`.

## Cervello Runtime
- `rag_sources.obsidian_path` identifica le note `.brain` e permette upsert idempotente.
- `vault-ingest` chunkza i `.md` con `runtime: true` e salva chunk con `source_type = "brain"`.
- `search_brain` filtra sempre `source_type = "brain"` per separare note interne e fonti di mercato.
