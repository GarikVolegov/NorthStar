# Code Autopsy — packages/ai-server
Date: 2026-05-29 · Critic: The Critic · Baseline: e088add

## Verdict
**Sano, sopra la media.** 190 file, ~25k LOC, e i segnali di marciume di
superficie sono quasi assenti: **1 solo `any`** in tutto il package, zero
`@ts-ignore`, zero TODO/FIXME/HACK, zero `catch {}` vuoti, `parseInt` sempre con
radix, `console.*` quasi inesistente (logger `pino` ovunque). I `JSON.parse` su
input esterni/LLM sono protetti da try/catch (`tool-call-parser.ts`,
`growth-agent/agent.ts`). Baseline test: **259 test verdi su 45 file, 9s.**
La maggiore passività è una telemetria fuorviante in un cron job. Non c'è
emergenza: questo è hardening fine, non un salvataggio.

> ⚠️ **Scope onesto:** prima + seconda passata mirata. Recon metrica
> sull'intero package + lettura approfondita degli hotspot principali
> (`wendy-neural/index.ts`, `llm/client.ts`, `model-router.ts`,
> `llm/tool-call-parser.ts`, estratti di `agent.ts`). NON ho letto riga-per-riga
> tutti i 190 file. L'autopsia è iterativa.
>
> `model-router.ts` (402 LOC) esaminato a fondo: **pulito**, nessun difetto reale.

## Findings by Severity

### CRITICAL
_Nessuno._

### HIGH
_Nessuno confermato in questa passata._

### MEDIUM
- [ ] **`llm/client.ts:62-69` — `withTimeout` perde il timer e non annulla la
  richiesta.** `Promise.race([promise, setTimeout(reject)])`: il `setTimeout`
  **non viene mai `clearTimeout`-ato**, quindi ad ogni chiamata riuscita resta un
  timer pendente di 15-30s; e quando scatta il timeout la richiesta HTTP
  sottostante **non viene abortita** (nessun `AbortController`) → continua a
  girare e a costare. Sotto carico: timer pendenti accumulati + richieste upstream
  sprecate. **Fix:** `clearTimeout` in `finally`; passare un `AbortSignal` all'SDK
  e abortire allo scadere del timeout.
- [ ] **`llm/client.ts:472-478` — `getLLMForRoute` crea un client SDK nuovo ad
  ogni chiamata.** Bypassa il singleton (commento lo ammette): per il routing
  per-richiesta significa `new OpenAI()`/`new Groq()` (nuovo connection pool) ad
  ogni turno. **Fix:** memoizzare i provider per `route.provider` con una piccola
  `Map`, come fa `_provider` ma con chiave.
- [ ] **`wendy-neural/index.ts:480-503` — `applyNeuralEdgeDecay` ritorna un valore
  fuorviante.** Ritorna `{ archivedBefore }`, ma `archivedBefore` è la *finestra
  di decadimento in giorni* (default 30), **non** il numero di edge archiviati.
  I due `UPDATE` (decay + archiviazione) scartano il loro rowCount.
  **Blast radius (confermato):** `apps/server/src/jobs/cron.ts:209-211` logga
  `archivedBefore: result.archivedBefore` nella metadata di **ogni** run del cron
  `wendy-neural-decay` → la telemetria mostra sempre "30", indistinguibile da
  "30 edge archiviati". Osservabilità inquinata.
  **Fix:** catturare il conteggio reale degli edge archiviati (es. `.returning({...})`
  o rowCount del secondo UPDATE) e ritornare `{ archivedEdges, decayDays }`;
  aggiornare il mapper in `cron.ts`.

### LOW
- [ ] **`wendy-neural/index.ts:194-201` — cast non verificato su risultato esterno.**
  `result.data as { chunks?: [...] }` su output di `handleSearchBrain`. Se la
  forma cambia, fallimento silenzioso (mitigato da `?? []`). Considerare uno
  schema zod o un type guard.
- [ ] **`llm/client.ts:160,289,434` — cast cieco di `finishReason`.**
  `res.choices[0]?.finish_reason as ...stop|tool_calls|length` può etichettare
  male `content_filter`/`function_call` restituiti dal provider. Mappare
  esplicitamente i valori non previsti su `"stop"`.
- [ ] **`llm/client.ts` (Groq/OpenRouter `chat` streaming) — fallback solo alla
  creazione.** `try/catch` e `pRetry` coprono la *creazione* dello stream, non gli
  errori a metà streaming: un crash dopo il primo token non fa scattare il
  fallback. Limitazione nota; almeno documentarla.

### NIT
- ⛔ **DECLINED — `wendy-neural/index.ts:167` doppio prefisso `itemRef`.**
  `tool:${tool.name}` + `safeRef()` → `tool:tool:search_rag`. **Non corretto
  di proposito:** `itemRef` è persistito e usato come chiave negli unique index
  di `wendy_neural_edges`; cambiarlo orfanerebbe gli edge storici per un puro
  cosmetico. Conservative-in-action: non si taglia ciò che non è provato sicuro.
- ↩️ **WITHDRAWN — `growth-agent/agent.ts:433,455` `saveAssistantMemory`.**
  Falso allarme: `saveAssistantMemory` ritorna `void` (avvolge
  `scheduleMemorySave`, che gestisce il fire-and-forget internamente). Nessuna
  promise fluttuante al call site. Evidence over opinion → ritirato.

## Lightening Opportunities
_Nessuna rimozione sicura identificata in questa passata._ I file più grandi
(`wendy-neural/index.ts` 519, `growth-agent/agent.ts` 511, `tool-registry.ts` 489)
sono grandi per ricchezza di dominio, non per gonfiore evidente. Un'analisi
Graphify dedicata (orfani/duplicati semantici) sui restanti ~187 file è il
prossimo passo per individuare dead code con certezza.

## Recon (metrica, intero package)
- `any`: 1 · `@ts-ignore`: 0 · `catch {}` vuoti: 0 · TODO/FIXME: 0
- `parseInt` senza radix: 0 · `JSON.parse` non protetti: 0 trovati
- Hotspot per dimensione: wendy-neural/index (519), growth-agent/agent (511),
  wendy-router/tool-registry (489), llm/client (478), growth-agent/memory-manager (445)

## Resolution Log
- **`71418c1`** — `fix(ai-server): harden llm/client resilience and resource handling`.
  withTimeout → AbortController + clearTimeout (9 call site); getLLMForRoute
  memoizzato per provider (+ resetLLM); finishReason mappato esplicitamente.
  Test: 259 verdi.
- **`0e744e3`** — `fix(ai-server): report real archived-edge count from neural decay`.
  applyNeuralEdgeDecay → `{ archivedEdges, decayDays }` via `.returning()`;
  cron.ts logga il conteggio reale; guard `Array.isArray` sui brain chunk.
  Test: 259 verdi.
- **NIT itemRef** — declined (data-safety). **NIT saveAssistantMemory** — withdrawn (falso allarme).

## Before / After
| Metric | Before | After |
|---|---|---|
| Test files | 45 passed | 45 passed |
| Tests | 259 passed | 259 passed |
| Typecheck (libs + server) | green | green (verificato) |
| MEDIUM aperti | 3 | 0 |
| LOW aperti | 3 | 1 (streaming mid-fallback, documentato) |
| Telemetria cron decay | costante fuorviante | conteggio reale |
