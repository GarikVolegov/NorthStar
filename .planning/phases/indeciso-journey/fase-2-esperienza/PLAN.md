# PLAN — Fase 2: Esperienza (Simulatore + Macchina del Tempo)

**Obiettivo:** trasformare le etichette vuote ("data analyst") in *esperienza vissuta*. Due strumenti che fanno *sentire* una professione e un futuro, e le cui reazioni alimentano la Bussola.
**Dipendenze:** Fase 1 (tabelle `compass_*`, `recomputeCompass`, tool Wendy). Parallelizzabile con Fase 3.
**Esito stage:** le reazioni a simulazioni/futuri affinano `hypotheses` (confidence ↑/↓ per cluster).

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
  DB      Sim-engine  Route   UI       Test+Gate
                      (+ TimeMachine)
```

---

## Step 1 — DB: sessioni simulazione + scenari futuri

### File da creare
- `packages/db/src/schema/simulationSession.ts`
- `packages/db/src/schema/futureScenario.ts`

### File da modificare
- `packages/db/src/schema/index.ts` — re-export

### Schema `simulation_sessions`
```typescript
// packages/db/src/schema/simulationSession.ts (NEW)
export const simulationSessionsTable = pgTable("simulation_sessions", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull()
                  .references(() => usersTable.id, { onDelete: "cascade" }),
  professionId: integer("profession_id").references(() => professionsTable.id, { onDelete: "set null" }),
  professionTitle: text("profession_title").notNull(),
  // catena di scene dell'avventura: [{ scene, choices:[{label,nextHint}], chosen, reactionMs }]
  transcript:   jsonb("transcript").$type<Array<Record<string, unknown>>>().notNull().default([]),
  // reazioni aggregate: { energyDelta: -1..1, likedDims:{...}, dislikedMoments:string[] }
  reactions:    jsonb("reactions").$type<Record<string, unknown>>().notNull().default({}),
  status:       text("status", { enum: ["in_progress","completed","abandoned"] }).notNull().default("in_progress"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
}, (t) => ({ userIdx: index("sim_sessions_user_idx").on(t.userId) }));
```

### Schema `future_scenarios`
```typescript
// packages/db/src/schema/futureScenario.ts (NEW)
export const futureScenariosTable = pgTable("future_scenarios", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull()
               .references(() => usersTable.id, { onDelete: "cascade" }),
  // 3 futuri divergenti a 5 anni: [{ clusterId, title, narrative, salaryBand, lifestyle, dataRefs }]
  scenarios: jsonb("scenarios").$type<Array<Record<string, unknown>>>().notNull().default([]),
  // reazione per scenario: { [clusterId]: { pull: 0..1, push: 0..1, note } }
  reactions: jsonb("reactions").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userIdx: index("future_scenarios_user_idx").on(t.userId) }));
```

### Criteri di successo
- [ ] `pnpm db:generate` + `db:migrate` ok; FK `user_id` CASCADE, `profession_id` SET NULL
- [ ] Tabelle nello sweep GDPR (account delete)

### Security gate (`gate-db`)
- `fk-on-delete` ✓ · `cascade-on-user-data` ✓ · `pii-no-bare-text` ✓ (transcript = scelte di gioco, non confessioni)

### Non fare
- Non salvare nel transcript prompt completi inviati al LLM (solo scene+scelte renderizzate)

---

## Step 2 — Sim-engine: avventura interattiva grounded

### Obiettivo
Generare una "giornata-tipo" giocabile di ~6–8 scene per una professione, fondata su dati reali (non allucinata): skill, salario, growth, RIASEC da `get_profession_detail`, segnali da `search_rag` / `get_job_posting_trend`.

### File da creare
- `packages/ai-server/src/simulator/day-in-life.ts` — orchestratore generazione scena → scelta → scena successiva
- `packages/ai-server/src/simulator/day-in-life.test.ts`
- `packages/ai-server/src/simulator/grounding.ts` — assembla il "fact sheet" della professione dai dati DB/RAG da iniettare nel prompt

### Logica
1. **Grounding** (`grounding.ts`): carica fact-sheet professione (riusa `handleGetProfessionDetail`, `handleGetMarketTrend`, `handleSearchRag` da `tool-handlers-*.ts`). Output: bullet di fatti verificati + fonti.
2. **Generazione scena** (`day-in-life.ts`): prompt LLM (tier `standard`, vedi `WendyRouterDecision`) con fact-sheet + storia scelte → 1 scena + 2–3 scelte. Vincolo di sistema: *"Usa SOLO i fatti forniti. Mostra il ritmo reale: le frustrazioni, gli imprevisti, le piccole vittorie. Niente patinato."*
3. **Reazione**: ogni scelta + `reactionMs` viene appesa al transcript; a fine run, `summarizeReactions()` → `energyDelta` + `likedDims`.
4. **Feedback alla Bussola**: a `completed`, POST interno → `compass_signals(signal_type="simulation_reaction", refType="profession", payload:{valence:energyDelta, dims:likedDims})` → `recomputeCompass()`.

### Costo/guardrail
- Cache fact-sheet per professione (riusa pattern `_embCache` in `tool-handlers.ts:23`).
- Log costo via `recordToolCall` / `aiCostLog` (schema esistente `aiCostLog.ts`).
- Max scene per sessione = 8 (taglio hard).

### Criteri di successo
- [ ] Test: una scena generata cita solo fatti del fact-sheet (no skill inventate) — asserzione su set di entità
- [ ] Test: scelta → scena successiva coerente con la scelta
- [ ] Test: `summarizeReactions` mappa scelte "energizzanti" su `likedDims` corretti
- [ ] Sessione `completed` genera 1 `compass_signal` e ricomputa il profilo

### Security gate (`gate-ai-tool`)
- `grounded-no-hallucination` ✓ — system prompt vincolato al fact-sheet; test di leakage
- `cost-logged` ✓ — `aiCostLog`
- `rate-limited-per-user` ✓ — max N simulazioni/giorno (premium: di più)

### Non fare
- Non generare scene senza fact-sheet (no professione → rifiuta con messaggio)
- Non promettere stipendi/sbocchi non presenti nei dati (gate hallucination)

---

## Step 3 — Route server: `/api/simulator` + `/api/timemachine`

### File da creare
- `apps/server/src/routes/simulator.ts` + `.test.ts`
- `apps/server/src/routes/timemachine.ts` + `.test.ts`

### File da modificare
- `apps/server/src/route-config.ts`:
  - `{ path: "/api/simulator",   router: simulatorRouter,   auth: "authenticated", description: "Simulatore giornata" }`
  - `{ path: "/api/timemachine", router: timemachineRouter, auth: "authenticated", description: "Macchina del tempo" }`

### Endpoint Simulatore
| Metodo | Path | Scopo |
|---|---|---|
| `POST` | `/api/simulator/start` | `{ professionId }` → crea sessione + prima scena |
| `POST` | `/api/simulator/:id/step` | `{ choiceIndex, reactionMs }` → prossima scena |
| `POST` | `/api/simulator/:id/finish` | chiude, calcola reazioni, segnale Bussola |
| `GET`  | `/api/simulator/history` | sessioni passate dell'utente |

### Endpoint Macchina del Tempo
| Metodo | Path | Scopo |
|---|---|---|
| `POST` | `/api/timemachine/generate` | genera 3 futuri da `compass_profiles.hypotheses` (o top match) |
| `POST` | `/api/timemachine/:id/react` | `{ clusterId, pull, push }` → segnale `future_reaction` |

**Macchina del Tempo — generazione:** prende le 3 ipotesi top dalla Bussola (o, se `zero_ideas`, 3 cluster diversificati). Per ciascuna costruisce una narrazione a 5 anni *vivibile*, fondata su: `get_job_posting_trend` (domanda futura), salari (`get_profession_detail`), `get_weak_signals` (dove sta andando). Framing minimizzazione-rimpianto: "quale rimpiangeresti di non aver provato?".

### Criteri di successo
- [ ] `start` → 201 con sessione + prima scena; `step` avanza; `finish` scrive segnale Bussola
- [ ] `timemachine/generate` → 3 scenari distinti con `dataRefs` (fonti reali)
- [ ] `react` con `pull` alto su un cluster ⇒ confidence di quel cluster ↑ dopo recompute
- [ ] Owner-scoped: utente A non può fare `step` sulla sessione di B (404/403)

### Security gate (`gate-route` + `gate-ai-tool`)
- `auth-required` ✓ · `owner-scoped` ✓ (sessione filtrata per `user_id`)
- `input-validated` ✓ (`choiceIndex` in range, `reactionMs` clamp)
- `grounded-no-hallucination` ✓ (eredita da Step 2)
- `cost-logged` ✓

### Non fare
- Non fidarsi del `choiceIndex` client senza validare contro le scelte realmente offerte nella scena precedente (anti-tamper)

---

## Step 4 — Frontend: Simulatore + Macchina del Tempo

### File da creare
- `apps/web/src/pages/bussola-prova.tsx` — selezione professione + player avventura
- `apps/web/src/pages/bussola-futuro.tsx` — 3 futuri affiancati, reazione pull/push
- `apps/web/src/features/compass/SimulatorPlayer.tsx` — scena, scelte, cattura `reactionMs`
- `apps/web/src/features/compass/FutureCard.tsx`

### File da modificare
- `apps/web/src/App.tsx` — route `/bussola/prova`, `/bussola/futuro` (protette, lazy)
- `apps/web/src/pages/bussola.tsx` (Fase 1) — CTA "Provala prima" e "Vedi i tuoi futuri" sulle ipotesi

### UX
- **Simulatore:** una scena per schermata, scelte come bottoni grandi; barra "energia" che oscilla in base alle scelte; a fine run schermata di rispecchiamento ("ti sei acceso quando dovevi risolvere; ti sei spento sulle riunioni").
- **Macchina del Tempo:** 3 card narrative; per ognuna due slider/emoji: *quanto ti tira* (pull) / *quanta paura* (push). Output: "Il futuro che ti tira di più senza spaventarti: ___".

### Criteri di successo
- [ ] Player avanza scena→scena, cattura `reactionMs`, chiude con rispecchiamento
- [ ] Reazioni ai 3 futuri aggiornano la confidence delle ipotesi nella hub
- [ ] Gating premium se previsto (riusa `UpgradeGate.tsx`) sulle simulazioni illimitate
- [ ] Verifica preview: nessun errore console, screenshot di una scena + dei 3 futuri

### Non fare
- Non far ripartire la generazione LLM ad ogni re-render (memoizza la scena corrente)
- Non mostrare futuri "garantiti": sono scenari, etichettali come tali

---

## Step 5 — Test + Gate finale

### E2E manuale
1. Da `/bussola`, su un'ipotesi → "Provala prima" → gioca 6 scene → rispecchiamento
2. Verifica `simulation_sessions.status='completed'` + nuovo `compass_signal` + profilo ricomputato
3. `/bussola/futuro` → 3 futuri → reagisci → la confidence dell'ipotesi preferita sale nella hub
4. Tenta tampering: `step` con `choiceIndex` fuori range → rifiutato

### Criteri finali (`/gsd:verify-work`)
- [ ] `pnpm test` verde (sim-engine, route, scoring)
- [ ] Nessuna allucinazione: test di grounding passa
- [ ] Costi loggati in `aiCostLog`
- [ ] Reazioni → Bussola → stage/confidence osservabilmente cambiati
- [ ] Gate `gate-db`/`gate-route`/`gate-ai-tool` verdi

### Non fare
- Non spedire senza test anti-allucinazione (è il rischio #1 di questa fase)
- Non committare con generazione LLM non cache-ata (costo)
