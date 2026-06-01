# PLAN — Fase 1: Sblocco + Scoperta (fondazione "La Bussola")

**Obiettivo:** dare all'indeciso un profilo *vivo* costruito dal comportamento. Crea il modello dati condiviso, il Diagnostico del blocco, Lo Specchio (scene-card a preferenze rivelate), il Dossier dell'Energia, e i tool Wendy della Bussola.
**Dipendenze:** nessuna (fondazione). Tutte le altre fasi dipendono da questa.
**Esito stage:** utente entra `zero_ideas`, esce con `revealedRiasec` popolato e prime `hypotheses` low-confidence.

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6
  DB      recompute  Route   Wendy    UI       Test+Gate
```

---

## Step 1 — DB: tabelle Bussola + content delle scene

### File da creare
- `packages/db/src/schema/compassSignal.ts` — vedi schema in `OVERVIEW.md`
- `packages/db/src/schema/compassProfile.ts` — vedi schema in `OVERVIEW.md`
- `packages/db/src/schema/sceneCard.ts` — contenuto del deck dello Specchio (no PII, content table)

### File da modificare
- `packages/db/src/schema/index.ts` — re-export delle 3 nuove tabelle (segue il pattern degli altri export)

### Schema `scene_cards`
```typescript
// packages/db/src/schema/sceneCard.ts (NEW)
export const sceneCardsTable = pgTable("scene_cards", {
  id:        serial("id").primaryKey(),
  // Momento reale di lavoro, NON una domanda astratta:
  // "È venerdì sera, un sistema è andato giù e hai 4 ore per capirlo."
  prompt:    text("prompt").notNull(),
  imageUrl:  text("image_url"),
  // dimensioni RIASEC che la scena "carica" se l'utente reagisce positivamente
  riasecWeights: jsonb("riasec_weights").$type<Record<string, number>>().notNull().default({}),
  // settori/professioni a cui la scena è collegata (per propagare il segnale)
  linkedSectorIds: text("linked_sector_ids").array().notNull().default([]),
  linkedRoleIds:   text("linked_role_ids").array().notNull().default([]),
  tags:      text("tags").array().notNull().default([]),
  active:    boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ activeIdx: index("scene_cards_active_idx").on(t.active) }));
```

### Migration
`pnpm db:generate` → `00NN_indeciso_compass.sql`. Verifica che contenga: 3 `CREATE TABLE`, le FK `user_id` con `ON DELETE CASCADE`, gli indici. Poi `pnpm db:migrate`.

### Seed
- `scripts/src/seed-scene-cards.ts` — 40 scene iniziali (8 per macro-cluster RIASEC + miste). Pattern: vedi `scripts/src/seed-catalog.ts` / `seed-rag.ts`.

### Criteri di successo
- [ ] `pnpm db:generate` produce la migration; review diff: solo `CREATE TABLE` + indici, nessun ALTER su tabelle esistenti
- [ ] `pnpm db:migrate` applica senza errori
- [ ] Seed inserisce ≥40 `scene_cards` con `active=true`
- [ ] `SELECT count(*) FROM compass_profiles;` = 0 (popolata on-demand)

### Security gate (`gate-db`)
- `fk-on-delete` ✓ — `compass_signals.user_id` e `compass_profiles.user_id` CASCADE
- `cascade-on-user-data` ✓ — cancellare l'utente cancella i suoi segnali e profilo
- `pii-no-bare-text` ✓ — `scene_cards` è contenuto pubblico, no PII; `compass_*` per-utente protette da auth
- **GDPR sweep:** aggiungi `compass_signals`, `compass_profiles` alla cancellazione account (`apps/server/src/routes/account.ts` — verifica il delete handler)

### Non fare
- Non mettere `NOT NULL` su `revealed_riasec`/`hypotheses` senza default `{}`/`[]`
- Non salvare in `compass_signals.payload` testo confessionale grezzo del diario (solo aggregati/dimensioni — vedi Step 3 Dossier)

---

## Step 2 — Logica: `recomputeCompass()` (il cuore del FitEngine-per-la-persona)

### Obiettivo
Funzione pura+IO che legge `compass_signals` di un utente e (ri)scrive `compass_profiles`. Idempotente, chiamabile dopo ogni batch di segnali.

### File da creare
- `apps/server/src/services/compass/recompute.ts`
- `apps/server/src/services/compass/recompute.test.ts`
- `apps/server/src/services/compass/scoring.ts` — funzioni pure testabili (no DB)

### Logica (`scoring.ts`, pura)
```typescript
// Pesi con decadimento temporale: segnali recenti contano di più.
export function weightedRiasec(signals: CompassSignal[]): Record<string, number> {
  // per ogni signal con payload.dims, applica weight * recencyDecay(createdAt)
  // normalizza 0..5 per coerenza con riasecScores del test
}

// Fonde RIASEC dichiarato (test) + rivelato (comportamento). Rivelato pesa di più
// quanti più segnali ci sono (fiducia crescente nel comportamento).
export function blendRiasec(declared: Record<string,number>, revealed: Record<string,number>,
                            signalCount: number): Record<string, number> {
  const w = Math.min(0.7, signalCount / 50); // max 70% peso al comportamento
  // blend = declared*(1-w) + revealed*w
}

// Produce ipotesi rankate da RIASEC fuso + scene/professioni toccate positivamente.
export function deriveHypotheses(blended: Record<string,number>,
                                 positiveRefs: {sectorId:number,score:number}[]): Hypothesis[];

// Avanza lo stage in base a quante ipotesi superano soglia confidence.
export function nextStage(current: Stage, hypotheses: Hypothesis[]): Stage;
```

### Logica (`recompute.ts`, IO)
1. Carica gli ultimi N segnali dell'utente + (se esiste) l'ultimo `test_sessions.riasecScores`.
2. `weightedRiasec` → `blendRiasec` → `deriveHypotheses` (usa `matchSectors` esistente come baseline, vedi `test-sessions.ts:75`).
3. Upsert `compass_profiles` (`onConflictDoUpdate` su `userId`).

### Criteri di successo
- [ ] Test puro: 10 segnali "R" alti → `revealedRiasec.R` dominante
- [ ] Test puro: `blendRiasec` con `signalCount=0` ⇒ = declared; con `signalCount≥50` ⇒ ~70% revealed
- [ ] Test puro: 3 ipotesi sopra soglia ⇒ `nextStage` passa `zero_ideas`→`hypotheses`
- [ ] Test IO: upsert idempotente (2 run stesso input ⇒ stesso profilo)

### Non fare
- Non far dipendere `scoring.ts` dal DB (deve restare puro e testabile)
- Non azzerare `hypotheses` esistenti se i nuovi segnali sono pochi (merge, non replace brusco)

---

## Step 3 — Route server: `/api/compass`

### File da creare
- `apps/server/src/routes/compass.ts`
- `apps/server/src/routes/compass.test.ts`

### File da modificare
- `apps/server/src/route-config.ts` — registra il router (pattern riga 157):
  `{ path: "/api/compass", router: compassRouter, auth: "authenticated", description: "Bussola indeciso" }`

### Endpoint
| Metodo | Path | Scopo |
|---|---|---|
| `GET`  | `/api/compass` | profilo Bussola dell'utente (crea vuoto se assente) |
| `GET`  | `/api/compass/scenes?limit=12` | prossime scene non ancora viste dall'utente |
| `POST` | `/api/compass/signal` | registra 1 segnale → `recomputeCompass()` async |
| `POST` | `/api/compass/diagnose` | risposte diagnostico blocco → set `block_type` |
| `POST` | `/api/compass/energy` | check-in dossier energia (aggregato, no testo grezzo) |

Tutti con `requireAuth`, `userId = req.user!.id`, validazione zod (pattern `normalizeAnswers` in `test-sessions.ts:64`).

### Diagnostico blocco (`POST /diagnose`)
5–6 domande a scelta → mappa a `blockType`. Esempi di item e mapping:
- "Ho troppe cose che mi interessano e non riesco a sceglierne una" → `too_many_interests` (scanner)
- "Niente mi accende davvero" → `no_interests`
- "Ho paura di non guadagnare abbastanza" → `fear_economic`
- "C'è chi si aspetta che io faccia una cosa precisa" → `external_pressure`
- "Ho paura di scegliere e poi essere mediocre" → `fear_mediocrity`

Il `blockType` instrada l'UI (Step 5) e il tono di Wendy.

### Criteri di successo
- [ ] `GET /api/compass` su utente nuovo ⇒ 200 con profilo `stage:"zero_ideas"`
- [ ] `POST /api/compass/signal` (scene_swipe) ⇒ segnale persistito + profilo ricomputato
- [ ] `GET /api/compass/scenes` non restituisce scene già viste (anti-duplicato via `compass_signals`)
- [ ] `POST /api/compass/diagnose` ⇒ `block_type` aggiornato
- [ ] Ogni endpoint rifiuta richieste non autenticate (401)

### Security gate (`gate-route`)
- `auth-required` ✓ — `requireAuth` su tutti
- `owner-scoped` ✓ — `WHERE user_id = req.user!.id` su ogni query
- `input-validated` ✓ — zod su body, clamp dei valori numerici
- `rate-limit` ✓ — limita `POST /signal` (es. 120/min) per evitare flooding del profilo

### Non fare
- Non accettare `userId` dal body (sempre da `req.user`)
- Non ricomputare in modo sincrono bloccante se i segnali sono >1000 (usa batch/coda)

---

## Step 4 — Wendy: tool della Bussola + persona indeciso

### File da modificare
- `packages/ai-server/src/wendy-router/tool-registry.ts` — 3 entry in `ALL_TOOLS` + aggiunta a `INTENT_TOOLS` (`conversation`, `planning`, `deep_analysis`)
- `packages/ai-server/src/wendy-router/tool-handlers.ts` — dispatch dei 3 case + import handler
- nuovo `packages/ai-server/src/wendy-router/tool-handlers-compass.ts` — handler (pattern `tool-handlers-market.ts`)
- `packages/ai-server/src/growth-agent/prompt-builder.ts` — persona-toggle quando `journeyType === "indeciso"`

### Tool
```typescript
// tool-registry.ts — ALL_TOOLS additions
get_compass: {
  name: "get_compass",
  description: "Legge la Bussola dell'utente indeciso: stage del percorso, tipo di blocco, ipotesi di carriera con confidence, profilo di energia. Usare per orientare la conversazione di un utente che non sa ancora cosa fare.",
  parameters: [],
},
record_compass_signal: {
  name: "record_compass_signal",
  description: "Registra un segnale emerso in chat (es. l'utente si è acceso parlando di un tema). Prepara la scrittura: richiede conferma esplicita nel client.",
  parameters: [
    { name: "signalType", type: "string", description: "energy_checkin | tournament_choice | bridge_input", required: true },
    { name: "refType",    type: "string", description: "profession | sector | skill" },
    { name: "refId",      type: "string", description: "ID dell'entità" },
    { name: "valence",    type: "number", description: "Reazione -1 (spento) .. 1 (acceso)", required: true },
  ],
},
propose_next_compass_step: {
  name: "propose_next_compass_step",
  description: "Suggerisce il prossimo passo concreto in base allo stage della Bussola (es. fai lo Specchio, prova una simulazione, avvia uno spike). Non dà verdetti.",
  parameters: [],
},
```

- `get_compass` / `propose_next_compass_step`: read-only.
- `record_compass_signal`: **write** → usa il pattern `wendyAction` (vedi `tool-handlers.ts:67`, `requiresConfirmation: true`, `risk: "low"`). Aggiungilo a `WRITE_TOOLS` (riga 451).

### Persona-toggle (`prompt-builder.ts`)
Quando `pageContext.journeyType === "indeciso"`, appendi al system prompt:
> "L'utente è INDECISO. Non dare verdetti né spingere una singola professione. Rispecchia i pattern che emergono, fai domande riflessive, e usa `get_compass`/`propose_next_compass_step` per guidarlo al prossimo passo. Il successo è farlo avanzare di uno stage, non dargli una risposta."

### Criteri di successo
- [ ] `get_compass` restituisce stage+hypotheses dell'utente loggato (mai di altri)
- [ ] `record_compass_signal` genera un `wendyAction` con `requiresConfirmation: true` (nessuna scrittura senza conferma client)
- [ ] Con `journeyType:"indeciso"`, in una chat di test Wendy NON propone un singolo "fai il X" ma rispecchia + propone un passo
- [ ] `tool-registry.test.ts` aggiornato: i 3 tool sono registrati e mappati agli intent giusti

### Security gate (`gate-ai-tool`)
- `confirm-before-destructive` ✓ — `record_compass_signal` via `wendyAction`
- `rate-limited-per-user` ✓ — riusa il rate limit dei tool esistenti
- `owner-scoped` ✓ — handler usa `userId` iniettato server-side (mai dai param LLM)
- `tool-registered-in-index` ✓ — verifica bootstrap `toolRegistry.register` (riga 469)

### Non fare
- Non aggiungere un nuovo valore a `WendyIntent` (sono classi di complessità, non domini)
- Non far scrivere a `record_compass_signal` senza il giro di conferma client

---

## Step 5 — Frontend: hub Bussola + Specchio + Diario + Diagnostico

### File da creare
- `apps/web/src/pages/bussola.tsx` — hub: stage, ipotesi, prossimo passo, CTA alle attività
- `apps/web/src/pages/bussola-specchio.tsx` — deck swipe di scene-card (gestione gesture + tempo di reazione)
- `apps/web/src/pages/bussola-diario.tsx` — check-in energia (2 tap: "cosa ti ha acceso/spento")
- `apps/web/src/pages/bussola-blocco.tsx` — diagnostico 5–6 domande
- `apps/web/src/features/compass/useCompass.ts` — hook dati (pattern `apps/web/src/hooks/useProactiveInsights.ts`)
- `apps/web/src/features/compass/SceneCard.tsx`, `CompassStageBar.tsx`, `HypothesisCard.tsx`

### File da modificare
- `apps/web/src/App.tsx` — 4 route lazy (pattern riga 29–37 + `<Route path>` blocchi):
  `/bussola`, `/bussola/specchio`, `/bussola/diario`, `/bussola/blocco` (protette)
- `apps/web/src/pages/percorso.tsx:98` — `JOURNEY_DESTINATION.indeciso: "/bussola"` (oggi `/test`). Il test RIASEC resta accessibile *dentro* la Bussola come uno dei segnali, non come gate iniziale.

### UX chiave dello Specchio
- Scena a tutto schermo, swipe ↑(accende) / ↓(spegne) / →(salva per dopo).
- Cattura **tempo di reazione** (`reactionMs` in payload): esitazione = segnale.
- Dopo 12 scene mostra un mini-rispecchiamento ("ti accendono i problemi da risolvere in autonomia; ti spengono i compiti ripetitivi").

### Routing per `blockType`
La hub `bussola.tsx` adatta il primo invito all'azione al blocco:
- `too_many_interests` → "Restringiamo: parti dal Torneo" (Fase 3)
- `no_interests` → "Esploriamo: parti dallo Specchio"
- `fear_economic` → mostra dati salari/trend reali (RAG) accanto alle ipotesi
- `fear_mediocrity` → enfatizza lo Spike reversibile (Fase 4): "è un test, non un matrimonio"

### Criteri di successo
- [ ] `/bussola` mostra stage + ipotesi reali dall'API
- [ ] Lo Specchio invia un `scene_swipe` per ogni gesto e non ripropone scene viste
- [ ] Dopo ~12 swipe lo stage/ipotesi cambiano in modo osservabile
- [ ] `indeciso` da `/percorso` atterra su `/bussola`, non più su `/test`
- [ ] Verifica preview: nessun errore console, snapshot coerente, screenshot dello Specchio

### Non fare
- Non bloccare l'utente dietro login per *provare* lo Specchio (sessione anon → assegna come `test_sessions`, vedi `assign-user`)
- Non inviare testo libero del diario al backend: solo tap strutturati + dimensioni

---

## Step 6 — Test + Gate finale

### File coinvolti
- `recompute.test.ts`, `scoring.test.ts`, `compass.test.ts`, `tool-registry.test.ts`
- `apps/web/src/features/compass/__tests__/` — render hub + swipe

### E2E manuale
1. `pnpm dev` → registra utente nuovo → `/percorso` → "Indeciso" → atterra `/bussola`
2. Fai il diagnostico → `block_type` salvato
3. 12 swipe nello Specchio → `compass_profiles.signal_count ≥ 12`, `revealed_riasec` popolato
4. Chat con Wendy ("non so cosa fare") → usa `get_compass`, propone un passo, **niente verdetto**
5. `SELECT stage FROM compass_profiles WHERE user_id=?` → avanzato se ipotesi sopra soglia

### Criteri finali (per `/gsd:verify-work`)
- [ ] Tutti i test passano: `pnpm test`
- [ ] Migration applicata; seed scene attivo
- [ ] Tutti i gate (`gate-db`, `gate-route`, `gate-ai-tool`) verdi
- [ ] Tabelle `compass_*` incluse nello sweep GDPR
- [ ] Demo end-to-end registrata (screenshot Specchio + profilo che avanza)

### Non fare
- Non committare prima di aver visto il profilo avanzare di stage con swipe reali
- Non skippare i test di `scoring.ts` (è il cuore della logica)
