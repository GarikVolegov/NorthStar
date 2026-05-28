---
layer: root
status: stable
runtime: false
owner: garik
tags: [moc, root]
updated: 2026-05-28
---

# NorthStar — Cervello

Homepage del vault. Cervello dell'applicazione strutturato in 4 layer gerarchici verticali, dal "chi sono" al codice.

**Vault root**: `.brain/` (versionato git). `90_Code/` è una **junction Windows** verso `graphify-out/obsidian-vault/90_Code/` (output auto di graphify, non versionato — rigenerabile).

## Layer

| Livello | Cartella | Cos'è | Tag |
|---|---|---|---|
| L1 | [[00_Identity/_MOC\|Identity]] | Chi sono io, perché esiste NorthStar, valori, glossario | `#L1` |
| L2 | [[10_Domain/_MOC\|Domain]] | Career coaching IT, mercato lavoro, personas, vincoli | `#L2` |
| L3 | [[20_Product/_MOC\|Product]] | Sottosistemi NorthStar (Wendy, AAaS, RAG, Dashboard) + Pipelines | `#L3` |
| L3.5 | [[30_Process/_MOC\|Process]] | Fasi GSD attive, workstream, piano corrente | `#L3.5` |
| L4 | [[90_Code/README\|Code]] | Grafo auto-generato (graphify update) | `#L4` |

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
- `graphify update .` rigenera `90_Code/` (zero costo API)
- `/cartographer` propone diff agli L2/L3/L3.5 a fine fase GSD (skill globale in `~/.claude/skills/cartographer/`)
- Verifica freshness: confronta `git rev-parse HEAD` con `manifest.json`
