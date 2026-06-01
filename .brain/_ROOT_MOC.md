---
layer: root
status: stable
runtime: false
owner: garik
tags: [moc, root]
updated: 2026-05-28
---

# NorthStar — Cervello

Homepage del vault. Cervello dell'applicazione strutturato in layer gerarchici verticali, dal "chi sono" al codice e al contesto operativo degli agenti.

**Vault root**: `.brain/` (versionato git). Gli output Graphify sono rigenerabili on demand e non restano versionati nella root.

## Layer

| Livello | Cartella | Cos'è | Tag |
|---|---|---|---|
| L1 | [[00_Identity/_MOC\|Identity]] | Chi sono io, perché esiste NorthStar, valori, glossario | `#L1` |
| L2 | [[10_Domain/_MOC\|Domain]] | Career coaching IT, mercato lavoro, personas, vincoli | `#L2` |
| L3 | [[20_Product/_MOC\|Product]] | Sottosistemi NorthStar (Wendy, AAaS, RAG, Dashboard) + Pipelines | `#L3` |
| L3.5 | [[30_Process/_MOC\|Process]] | Fasi GSD attive, workstream, piano corrente | `#L3.5` |
| L3.6 | [[40_Agent_Context/AGENT_CONTEXT\|Agent Context]] | Contesto unico per Claude, Codex, OpenCode, skill, workflow e regole | `#L3.6` |
| L4 | graphify-out | Grafo auto-generato on demand, ignorato da Git | `#L4` |

## Regola d'oro
Ogni nodo curato ha YAML frontmatter con: `layer`, `status`, `runtime`, `owner`, `links_to`, `tags`, `updated`.
Tag `runtime: true` → indicizzato in pgvector per Wendy.

## Query utili (richiede plugin Dataview)

Tutti i nodi runtime esposti a Wendy:
~~~dataview
table layer, status from "" where runtime = true sort layer asc
~~~

Draft da rivedere:
~~~dataview
list from "" where status = "draft"
~~~

## Manutenzione
- `pnpm graphify:refresh` rigenera i grafi WikiLLM/Graphify quando servono.
- [[40_Agent_Context/AGENT_CONTEXT]] e' la fonte unica per qualunque agente AI.
- [[30_Process/Agent-Development-Kit]] descrive i layer operativi ora consolidati in `40_Agent_Context/`
- [[30_Process/GSD-Phases/Fase-3-Wendy-Neural-Attention]] descrive il layer neurale persistente di Wendy
- `/cartographer` propone diff agli L2/L3/L3.5 a fine fase GSD (skill progetto in `40_Agent_Context/claude/skills/cartographer.md`)
- Verifica freshness: confronta `git rev-parse HEAD` con `manifest.json`
