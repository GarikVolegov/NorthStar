# OVERVIEW — Percorso dell'Indeciso · "La Bussola"

**Persona target:** `indeciso` (vedi `apps/web/src/pages/percorso.tsx:36`) — chi non sa ancora cosa fare.
**Base branch — ATTENZIONE (verificato 2026-06-01):** il merge PR #5 su `main`/HEAD corrente è **incompleto**: `packages/db/src/schema/index.ts` importa 8 moduli i cui file NON esistono su questa base (`wendyNeural`, `diary`, `userDashboardLayout`, `userRoutines`, `routineExecutions`, `monthlyRitual`, `appNotifications`, `userNavigationPreferences`) → `@workspace/db` non compila. **Pre-condizione obbligatoria prima di eseguire qualsiasi fase:** allineare la base a un branch che builda. Migliore opzione = `claude/dazzling-shamir-c08e92` (typecheck + lint:ci verdi); alternativa = `feature/fase2-cervello-runtime` (ha i file schema, ma senza i fix tsconfig/lint del primo). NON eseguire migrazioni o codice su HEAD così com'è.
**Stato attuale:** la persona `indeciso` viene spedita a `/test` (RIASEC one-shot) → `/results`. Usa <10% del motore disponibile (FitEngine, RAG, weak signals, job-posting trends, skill cooccurrences, 17 tool Wendy).

---

## La tesi di prodotto

L'indeciso non vuole una **mappa** ("ecco la professione X") — un verdetto lo spaventa perché chiude porte. Vuole una **bussola**: una direzione che si calibra nel tempo.

Tre principi su cui poggia tutto:

1. **Preferenze rivelate > preferenze dichiarate.** Il RIASEC cattura ciò che *dici*; il valore è ciò verso cui *ti muovi davvero*. Applichiamo la filosofia dei *weak signals* (già in `packages/db/src/schema/weakSignal.ts`) **alla persona**, non solo al mercato.
2. **L'indeciso sa dire "non questo" meglio di "questo".** Si costruisce per sottrazione (Fase 3, Torneo).
3. **Le etichette sono vuote; l'esperienza no.** "Data analyst" non significa niente finché non *senti* una sua giornata (Fase 2, Simulatore).

**Metrica nord:** non "ha trovato il lavoro", ma **"si è mosso di una casella"** nello `stage` della Bussola: `zero_ideas → hypotheses → experimenting → committed`.

---

## La spina dorsale: il modello dati "Bussola" (condiviso da tutte le fasi)

Due tabelle nuove, create in **Fase 1** e alimentate da ogni fase successiva. Profilo *event-sourced*: lo stream grezzo di segnali ricostruisce i vettori aggregati.

### `compass_signals` — stream append-only di micro-interazioni
Ogni swipe, check-in, reazione a una simulazione, scelta di torneo è un evento. Mai cancellato (storia = onestà del profilo).

```typescript
// packages/db/src/schema/compassSignal.ts (NEW)
export const compassSignalsTable = pgTable("compass_signals", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull()
                .references(() => usersTable.id, { onDelete: "cascade" }),  // gate-db: cascade-on-user-data
  signalType: text("signal_type", {
                enum: ["scene_swipe","energy_checkin","simulation_reaction",
                       "future_reaction","tournament_choice","bridge_input","block_answer"],
              }).notNull(),
  // riferimento opzionale all'entità toccata (settore/professione/skill/scena)
  refType:    text("ref_type"),         // "profession" | "sector" | "skill" | "scene"
  refId:      text("ref_id"),
  // segnale grezzo: { valence: -1..1, energy: -1..1, reactionMs, dims: {R,I,A,S,E,C}, raw }
  payload:    jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  weight:     real("weight").notNull().default(1),   // recency/confidence weighting
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("compass_signals_user_idx").on(t.userId),
  typeIdx: index("compass_signals_type_idx").on(t.signalType),
}));
```

### `compass_profiles` — vista materializzata del profilo direzionale (1 per utente)
Ricomputata dai segnali (vedi `recomputeCompass()` in Fase 1).

```typescript
// packages/db/src/schema/compassProfile.ts (NEW)
export const compassProfilesTable = pgTable("compass_profiles", {
  userId:     integer("user_id").primaryKey()
                .references(() => usersTable.id, { onDelete: "cascade" }),
  // Tipo di blocco diagnosticato (Fase 1 — instrada l'esperienza)
  blockType:  text("block_type", {
                enum: ["too_many_interests","no_interests","fear_economic",
                       "external_pressure","fear_mediocrity","unknown"],
              }).notNull().default("unknown"),
  // Vettore RIASEC "rivelato" dal comportamento (≠ dichiarato del test)
  revealedRiasec: jsonb("revealed_riasec").$type<Record<string, number>>().notNull().default({}),
  // Aggregati energia (da dossier): { energizers: string[], drainers: string[], dims }
  energyProfile:  jsonb("energy_profile").$type<Record<string, unknown>>().notNull().default({}),
  // Confidenza direzionale per cluster: [{ clusterId, label, confidence 0..1, source[] }]
  hypotheses: jsonb("hypotheses").$type<Array<{
                clusterId: string; label: string; confidence: number; source: string[];
              }>>().notNull().default([]),
  stage:      text("stage", {
                enum: ["zero_ideas","hypotheses","experimenting","committed"],
              }).notNull().default("zero_ideas"),
  signalCount: integer("signal_count").notNull().default(0),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

> **FitEngine:** oggi il "fit" vive in `apps/server/src/routes/test-sessions.ts` (`computeScores` + `matchSectors`). La Bussola lo **estende**, non lo sostituisce: `recomputeCompass()` fonde `revealedRiasec` (comportamento) con il `riasecScores` del test e produce `hypotheses` rankate. Quando il FitEngine unificato verrà estratto (vedi memoria `fit_engine.md`), `recomputeCompass` diventerà uno dei suoi consumer.

---

## Wendy in "modalità indeciso" (cross-cutting)

Non un nuovo `WendyIntent` (quelli sono classi di complessità, vedi `types.ts:17`), ma:

1. **Persona-toggle nel prompt-builder**: quando `pageContext.journeyType === "indeciso"`, il system prompt aggiunge la regola: *"Non spingere mai una singola risposta. Rispecchia i pattern, fai domande riflessive, aggiorna la Bussola. L'obiettivo è far muovere l'utente di uno stage, non dargli un verdetto."*
2. **Nuova famiglia di tool** registrata in `tool-registry.ts`, abilitata negli intent `conversation`/`planning`/`deep_analysis`:
   - `get_compass` (read) — stage, blockType, hypotheses, energia.
   - `record_compass_signal` (write, `wendyAction` con conferma) — Wendy registra un segnale emerso in chat.
   - `propose_next_compass_step` (read) — suggerisce la prossima azione in base allo stage.

Dettaglio implementativo di questi tool in **Fase 1, Step 4**.

---

## Sequenziamento delle 4 fasi

```
FASE 1 — Sblocco + Scoperta          (fondazione: dati + Specchio + Energia + Diagnostico blocco)
   │   crea compass_signals, compass_profiles, scene_cards, recomputeCompass(), tool Wendy
   ▼
FASE 2 — Esperienza                  (Simulatore "una giornata in...", Macchina del Tempo)
   │   le reazioni alimentano compass_signals → hypotheses si affinano
   ▼
FASE 3 — Convergenza                 (Torneo eliminazione, Ponte competenze)
   │   stage: zero_ideas/hypotheses → hypotheses con confidence alta
   ▼
FASE 4 — Commit reversibile          (Spike di carriera con kill-criterion)
       stage: hypotheses → experimenting → committed
```

Ogni fase è una **vertical slice** spedibile: DB → route server → tool Wendy → pagina React, con security gate prima del commit. Le fasi 2–4 dipendono dalla fondazione dati di Fase 1; **Fase 1 va eseguita per prima**. Fasi 2 e 3 sono parallelizzabili tra loro dopo la 1.

---

## Privacy & sicurezza (vincolo trasversale, non opzionale)

Questi dati sono i più sensibili dell'app (paure, energia, blocchi). Regole obbligatorie in ogni fase:

- **Ownership stretto:** ogni query ha `WHERE user_id = req.user!.id`. Mai esporre `compass_*` di altri utenti.
- **Cascade on delete:** tutte le tabelle utente con `onDelete: "cascade"` (gate-db).
- **No PII verso LLM:** il Simulatore e i prompt usano vettori/etichette, non testo libero confessionale. Diario e blocco non vengono inviati a provider esterni in chiaro senza minimizzazione.
- **GDPR:** export + delete coperti dal flusso account esistente (`apps/server/src/routes/account.ts`). Verificare che le nuove tabelle siano incluse nello sweep di cancellazione.
- **Constellation / cohort matching (idea #7 originale): RIMANDATA.** Richiede aggregazione cross-utente → progettare prima un layer di anonimizzazione/k-anonymity. Fuori da questo blocco di 4 fasi.

---

## Definition of Done dell'intero percorso

- [ ] Un utente `indeciso` nuovo può: diagnosticare il blocco → fare lo Specchio → loggare energia → provare 2 simulazioni → girare un torneo → uscire con **1 ipotesi ad alta confidence + 1 spike attivo in calendario**.
- [ ] `compass_profiles.stage` avanza in modo osservabile.
- [ ] Wendy in modalità indeciso non dà verdetti secchi (verificato con `docs/eval-wendy`).
- [ ] Tutti i security gate passano per ogni fase.
- [ ] Le nuove tabelle sono nello sweep GDPR di cancellazione account.
