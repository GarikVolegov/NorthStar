# PLAN — Fase 3: Convergenza (Torneo + Ponte competenze)

**Obiettivo:** far convergere l'indeciso da "tante possibilità nebulose" a "poche ipotesi nitide", sfruttando che sa dire "non questo" meglio di "questo", e mostrandogli quanto è già *vicino* a qualcosa.
**Dipendenze:** Fase 1 (Bussola). Parallelizzabile con Fase 2. Consuma `hypotheses`/`revealedRiasec` se presenti, ma funziona anche da soli.
**Esito stage:** `zero_ideas`/`hypotheses` → `hypotheses` con 1–3 ipotesi ad alta confidence.

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
  DB      Torneo-logic  Ponte    Route+UI  Test+Gate
```

---

## Step 1 — DB: sessioni torneo

### File da creare
- `packages/db/src/schema/tournamentSession.ts`

### File da modificare
- `packages/db/src/schema/index.ts` — re-export

Il **Ponte competenze** NON ha tabella propria: è read-only (input effimero → calcolo → output) e i suoi segnali confluiscono in `compass_signals(signal_type="bridge_input")`.

### Schema `tournament_sessions`
```typescript
// packages/db/src/schema/tournamentSession.ts (NEW)
export const tournamentSessionsTable = pgTable("tournament_sessions", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull()
               .references(() => usersTable.id, { onDelete: "cascade" }),
  // pool iniziale: professioni/settori candidati [{ refType, refId, label }]
  pool:      jsonb("pool").$type<Array<{refType:string; refId:string; label:string}>>().notNull().default([]),
  // scelte a coppie: [{ a, b, chosen, reactionMs }]
  choices:   jsonb("choices").$type<Array<Record<string, unknown>>>().notNull().default([]),
  // risultato: { winners:[...], avoided:[...], commonThread:string, implicitDims:{...} }
  result:    jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
  status:    text("status", { enum: ["in_progress","completed"] }).notNull().default("in_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userIdx: index("tournament_sessions_user_idx").on(t.userId) }));
```

### Criteri di successo
- [ ] `db:generate` + `migrate` ok; FK CASCADE; tabella nello sweep GDPR

### Security gate (`gate-db`)
- `fk-on-delete` ✓ · `cascade-on-user-data` ✓ · `pii-no-bare-text` ✓

---

## Step 2 — Logica Torneo: dalla scelta a coppie alla funzione di utilità implicita

### Obiettivo
Un bracket a coppie ("preferisci A o B?") che, invece di restituire "sei X", restituisce: *cosa eviti sistematicamente, verso cosa gravitati, e il filo comune tra i finalisti*.

### File da creare
- `apps/server/src/services/tournament/bracket.ts` — costruzione pool + accoppiamento + avanzamento
- `apps/server/src/services/tournament/infer.ts` — inferenza utilità implicita (puro, testabile)
- `apps/server/src/services/tournament/*.test.ts`

### Logica
1. **Pool** (`bracket.ts`): se la Bussola ha ipotesi, parte da quelle + vicini diversificati; altrimenti campiona professioni a RIASEC distanti (massima informazione). 8–16 elementi.
2. **Accoppiamento adattivo:** non bracket fisso — usa un ranking tipo Elo/Bradley-Terry così ogni confronto massimizza l'informazione (meno confronti, più segnale). `reactionMs` pesa la sicurezza della scelta.
3. **Inferenza** (`infer.ts`, puro): dai vincitori/perdenti estrai dimensioni latenti (autonomia, impatto-sulle-persone, struttura-vs-creatività, rischio) e il `commonThread` testuale. Output mappato anche su `dims` RIASEC per alimentare la Bussola.
4. **Feedback Bussola:** a `completed` → `compass_signal(tournament_choice)` con i `winners` come ref positivi → `recomputeCompass()` → confidence delle ipotesi vincenti ↑.

### Criteri di successo
- [ ] Test: con scelte coerenti pro-autonomia, `result.implicitDims.autonomy` alto e `avoided` contiene gli opposti
- [ ] Test: ranking adattivo converge in ≤ N confronti per pool di 12 (no bracket O(n) cieco)
- [ ] Test: `commonThread` non vuoto quando i finalisti condividono dimensioni
- [ ] `completed` → segnale Bussola + confidence aggiornata

### Security gate (`gate-route` a valle)
- `owner-scoped` ✓ · `input-validated` ✓ (la coppia votata deve essere quella realmente offerta — anti-tamper)

### Non fare
- Non restituire un'etichetta-verdetto ("sei un tipo I"): restituisci vettori + filo comune
- Non far dipendere `infer.ts` dal DB

---

## Step 3 — Ponte delle Competenze: dall'esperienza all'adiacente possibile

### Obiettivo
Reframe dell'indeciso che crede di "partire da zero": inserisce ciò che ha già fatto (hobby, lavoretti, studi, materie) → mappa delle professioni *a un passo* da lì, con le skill-ponte mancanti.

### File da creare
- `apps/server/src/routes/bridge.ts` + `.test.ts`
- `apps/server/src/services/bridge/adjacency.ts` — calcolo adiacenza

### File da modificare
- `apps/server/src/route-config.ts` — `{ path: "/api/bridge", router: bridgeRouter, auth: "authenticated", description: "Ponte competenze" }`

### Logica (`adjacency.ts`)
1. Input utente (testo libero esperienze) → estrazione skill canoniche (match contro catalogo skill; LLM tier `nano` per normalizzare).
2. Per ogni skill → `get_skill_cooccurrences` (tool/handler esistente, `tool-handlers-market.ts`) → skill co-occorrenti negli annunci.
3. Mappa le skill (possedute + adiacenti) sulle professioni (`search_professions` / catalogo) → ranking per **copertura** (quante skill hai già) e **distanza** (quante skill-ponte mancano).
4. Output: `[{ professionId, label, haveSkills[], bridgeSkills[], distance }]` ordinato per "più vicino".
5. Registra `compass_signal(bridge_input)` con le professioni più vicine come ref positivi soft.

### Endpoint
| Metodo | Path | Scopo |
|---|---|---|
| `POST` | `/api/bridge/analyze` | `{ experiences: string[] }` → mappa adiacenze |

### Criteri di successo
- [ ] Input "ho gestito un canale Instagram + Excel" → professioni con copertura su social/data, `bridgeSkills` sensate
- [ ] Ordinamento per distanza crescente (più vicino prima)
- [ ] Nessuna skill inventata: tutte dal catalogo / cooccorrenze reali
- [ ] Segnale Bussola registrato

### Security gate (`gate-route` + `gate-ai-tool`)
- `auth-required` ✓ · `owner-scoped` ✓ · `input-validated` ✓ (cap lunghezza/numero esperienze)
- `grounded-no-hallucination` ✓ — skill solo da catalogo/cooccorrenze, LLM solo per normalizzare

### Non fare
- Non passare il testo esperienze a provider esterni oltre la normalizzazione minima
- Non promettere "diventerai X in N mesi": mostra distanza in skill, non garanzie

---

## Step 4 — Frontend: Torneo + Ponte

### File da creare
- `apps/web/src/pages/bussola-torneo.tsx` — confronti a coppie + schermata risultato
- `apps/web/src/pages/bussola-ponte.tsx` — input esperienze + mappa adiacenze
- `apps/web/src/features/compass/DuelCard.tsx`, `AdjacencyMap.tsx`

### File da modificare
- `apps/web/src/App.tsx` — route `/bussola/torneo`, `/bussola/ponte` (protette, lazy)
- `apps/web/src/pages/bussola.tsx` — CTA condizionata al `blockType`:
  - `too_many_interests` → in evidenza il **Torneo**
  - chi crede di partire da zero → in evidenza il **Ponte**

### UX
- **Torneo:** due card grandi, scelta secca, progress "ti conosco al N%". Risultato come *rispecchiamento*, non verdetto: "Eviti sistematicamente i ruoli a bassa autonomia. I tuoi 3 finalisti condividono: impatto visibile + autonomia."
- **Ponte:** chip delle skill possedute (verdi) e skill-ponte (gialle) verso ogni professione; ordinate per "più vicine a te".

### Criteri di successo
- [ ] Il Torneo converge e mostra `commonThread` + `avoided`
- [ ] Dopo il Torneo, la hub mostra 1–3 ipotesi con confidence salita
- [ ] Il Ponte mostra professioni ordinate per distanza con skill-ponte reali
- [ ] Verifica preview: screenshot del duello e della mappa adiacenze

### Non fare
- Non presentare il risultato del Torneo come identità fissa
- Non bloccare il Ponte dietro un form lungo: bastano 3–5 esperienze

---

## Step 5 — Test + Gate finale

### E2E manuale
1. `block_type='too_many_interests'` → hub propone Torneo → 10 duelli → risultato con filo comune
2. Verifica `tournament_sessions.status='completed'` + segnale Bussola + confidence ipotesi ↑
3. `/bussola/ponte` con esperienze reali → professioni vicine + skill-ponte; segnale registrato
4. La hub ora mostra `stage='hypotheses'` con ipotesi nitide

### Criteri finali (`/gsd:verify-work`)
- [ ] `pnpm test` verde (bracket, infer, adjacency, route)
- [ ] Nessuna skill/professione inventata (grounding test)
- [ ] Torneo riduce davvero l'incertezza: confidence delle ipotesi aumenta in modo misurabile
- [ ] Gate `gate-db`/`gate-route`/`gate-ai-tool` verdi

### Non fare
- Non spedire un Torneo che produce verdetti-etichetta (contraddice la tesi di prodotto)
- Non saltare i test puri di `infer.ts`/`adjacency.ts`
