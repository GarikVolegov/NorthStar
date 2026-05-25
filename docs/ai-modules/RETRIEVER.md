# Retriever

File: `packages/ai-server/src/growth-agent/retriever.ts`

## Cosa fa
Recupera chunk rilevanti dalla knowledge base usando embedding vettoriali. Supporta due modalità: **pgvector** (query vettoriale PostgreSQL) e **JS fallback** (cosine similarity in-process).

## Input
- `query: string` — testo da cercare
- `userId: number` — utente per filtrare contenuti personali
- `opts.topK?: number` — max risultati (default 6)
- `opts.minScore?: number` — similarità minima (default 0.35)
- `opts.sourceTypes?: SourceType[]` — filtri per tipo (persona_example, document, user_note, platform_content, web)

## Output
- `Promise<RetrievedChunk[]>` — array di chunk con id, content, source, sourceType, score, metadata

## Invarianti
- Platform content (userId=0) viene sempre incluso automaticamente se sourceTypes include "platform_content"
- JS fallback ha limite di 500 righe e timeout di 3s — se scatta, logga warning e torna []
- Non deve mai chiamare LLM — usa solo embedding + similarity
- Se pgvector non è configurato, degrada a JS fallback automaticamente

## Costo
- 1 chiamata text-embedding-3-small per query (~~$0.0001)
- 1 query SQL (pgvector) o scansione in-memory (JS)
