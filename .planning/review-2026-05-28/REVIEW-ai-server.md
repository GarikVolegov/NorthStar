# REVIEW — `packages/ai-server` (2026-05-28)

Scope: Wendy router, tools, RAG, brain, neural, memory-graph, model-router, multi-agent.

## Sintesi rapida

Il pacchetto `ai-server` è **denso ma molto sano**. Zero issue critici. La Fase 2 "Cervello Runtime" ha aggiunto `wendy-brain.ts` come pipeline di ingestion del vault Obsidian SENZA rimuovere la pipeline precedente; le due **convivono in modo complementare** (verificato: `wendy-neural/index.ts` importa `searchWendyBrain`). Non c'è dunque la "vecchia pipeline da rottamare" che si poteva sospettare.

I findings reali sono concentrati su: barrel orfani, file enormi, e una valutazione esplicita del rapporto `wendy-brain` ↔ `wendy-neural` ↔ `memory-graph`.

## Findings classificati

### F-AI-1 · `packages/ai-server/src/tools/index.ts` orfano
- Severità: **MEDIUM** · Azione: **REMOVE** o **RECONNECT**
- Evidenza: knip lo segnala unused. Verificato: `wendy-brain.ts` importa `./tools/registry` direttamente, bypassando il barrel.
- Proposta: rimuovere il file barrel (3 righe) **oppure** rifattorizzare gli import per passare per il barrel (più pulito ma diff più grande).
- Costo: 5 minuti rimozione, 30 min refactor.

### F-AI-2 · `wendy-neural/index.ts` da splittare (520 righe)
- Severità: **LOW** · Azione: **REFACTOR**
- Evidenza: [baseline/file-size.txt:27](baseline/file-size.txt) — supera la soglia 400 righe per packages.
- Proposta: estrarre il sotto-modulo "activation candidates" e "memory section builder" in file separati. Non urgente: il file è coeso.
- Costo: 1-2 ore.

### F-AI-3 · `wendy-router/tool-registry.ts` (478 righe) e `tool-handlers-rabbit.ts` (431 righe)
- Severità: **LOW** · Azione: **REFACTOR**
- Evidenza: file-size audit.
- Proposta: il registry ha 12 tool dichiarativi — naturale che sia lungo. Considerare split per dominio (`tool-registry/calendar.ts`, `tool-registry/objectives.ts`, ecc.) solo se si pianifica di aggiungere altri tool. Altrimenti accettare il debito.
- Costo: 2-3 ore se si fa.

### F-AI-4 · `growth-agent/agent.ts` (480) + `growth-agent/memory-manager.ts` (446) + `model-router.ts` (403) + `llm/client.ts` (479)
- Severità: **LOW** · Azione: **REFACTOR** (opzionale)
- Evidenza: file-size audit.
- Proposta: nessuno è dead, tutti sono nuclei semantici importanti (34 importer per model-router, growth-agent è il sotto-sistema principale). Lasciare a meno che la lettura risulti onerosa.

### F-AI-5 · `wendy-brain` vs `wendy-neural` — chiarire la separazione nel codice
- Severità: **LOW** · Azione: **DOCUMENT**
- Evidenza: i due nomi sono ambigui per un nuovo lettore. In realtà:
  - `wendy-brain` = ingestion store del vault Obsidian (Fase 2, scrive in `wendyBrainNodesTable`, espone `search_brain` tool)
  - `wendy-neural` = orchestratore di attivazioni neuro-simboliche (memory + brain + tool intent), tabelle `wendyNeural*`
- Proposta: aggiungere docstring di apertura a entrambi i file (3-5 righe) che chiarisca il ruolo e le tabelle DB di proprietà. Aggiornare [.brain/30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md](.brain/30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md) se non già fatto.
- Costo: 30 minuti.

### F-AI-6 · `memory-graph.ts` overlap potenziale con `wendy-brain`
- Severità: **MEDIUM** · Azione: **CONSOLIDATE** (decisione di prodotto)
- Evidenza: entrambi sono "knowledge stores" indicizzati. `index.ts` esporta entrambi. Esiste anche `apps/server/src/routes/admin/memory-graph.ts`.
- Domanda aperta: cosa scrive in `memoryGraph*` table vs `wendyBrain*` table? Sono usi diversi (user-specific vs project-shared)? Se sì, ok; se no, una delle due è candidata a deprecation.
- Proposta: **non rimuovere niente ora**. Chiedere all'owner: "memory-graph è ancora utilizzato per qualche feature attiva oltre l'admin route?". Se no, archive-candidate dopo grace period.

### F-AI-7 · `rag/ingestors/` vs `vault-ingest` worker
- Severità: **LOW** · Azione: **DOCUMENT**
- Evidenza: `packages/ai-server/src/rag/ingestors/` contiene `json-ingestor.ts`, `pdf-ingestor.ts`, `rss-ingestor.ts`. `apps/server/src/jobs/vault-ingest.ts` è la nuova ingestion Fase 2. Diversi: i primi sono ingestor RAG generici, vault-ingest è specifico del cervello.
- Proposta: aggiungere a `AI_RULES.md` o a `wendy-brain` docstring un breve "Ingestion landscape" che mappi i 4 ingestor (3 RAG + 1 vault).

## Cosa NON è un problema (false positives chiariti)

- `wendy-neural.ts` (file in root, 1 riga, re-export verso cartella `wendy-neural/`) — pattern di facciata, va bene.
- `model-router.ts` (403 righe) + `model-router/catalog.ts` — pattern intenzionale, 34 importer di `selectModelFor`. Lasciare.
- 7 sottocartelle `*-agent/` (`discovery`, `growth`, `search`, `sector-data`, `security`) — ognuna ha responsabilità chiara, no overlap detection necessaria qui.

## Riepilogo conteggio

| Severità | Conta |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 (F-AI-1, F-AI-6) |
| LOW | 5 |
