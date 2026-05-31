# PLAN — Fase 4: Commit reversibile (Spike di Carriera)

**Obiettivo:** quando emerge un'ipotesi, NON forzare un grande impegno. Proporre un micro-esperimento di 2 settimane con un **kill-criterion** esplicito definito *prima*. Abbassa la paura ("è un test, non un matrimonio") e fa decidere per piccoli bet reversibili — il modo in cui le persone decise decidono davvero.
**Dipendenze:** Fase 1 (Bussola), idealmente Fasi 2–3 (ipotesi nitide). Riusa `objectives` + `calendar` esistenti.
**Esito stage:** `hypotheses` → `experimenting` → (a esito) `committed` o ritorno informato a `hypotheses`.

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
  DB      Spike-logic  Route+Wendy  UI    Test+Gate
```

---

## Step 1 — DB: career spikes

### File da creare
- `packages/db/src/schema/careerSpike.ts`

### File da modificare
- `packages/db/src/schema/index.ts` — re-export

### Schema `career_spikes`
```typescript
// packages/db/src/schema/careerSpike.ts (NEW)
export const careerSpikesTable = pgTable("career_spikes", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull()
                    .references(() => usersTable.id, { onDelete: "cascade" }),
  hypothesisLabel: text("hypothesis_label").notNull(),   // "UX Designer"
  refType:        text("ref_type"),                       // profession | sector | skill
  refId:          text("ref_id"),
  // l'azione concreta del micro-esperimento
  action:         text("action").notNull(),               // "Completa il modulo 1 di un corso UX + intervista 1 UX designer"
  // il criterio di kill DEFINITO PRIMA (riduce l'auto-inganno)
  killCriterion:  text("kill_criterion").notNull(),       // "Se dopo 2h mi annoio più che curiosarmi, stop"
  startDate:      timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  reviewDate:     timestamp("review_date", { withTimezone: true }).notNull(),  // start + ~2 settimane
  status:         text("status", {
                    enum: ["active","completed_continue","completed_kill","abandoned"],
                  }).notNull().default("active"),
  // esito strutturato alla review
  outcome:        jsonb("outcome").$type<{ energy?: number; learned?: string; decision?: string }>(),
  // collegamenti alle strutture esistenti (objectives/calendar) per non duplicare
  objectiveId:    integer("objective_id"),                // FK soft a userObjectives
  calendarEventId: integer("calendar_event_id"),          // FK soft a calendar
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:   index("career_spikes_user_idx").on(t.userId),
  statusIdx: index("career_spikes_status_idx").on(t.status),
}));
```

### Criteri di successo
- [ ] `db:generate` + `migrate` ok; FK `user_id` CASCADE; tabella nello sweep GDPR

### Security gate (`gate-db`)
- `fk-on-delete` ✓ · `cascade-on-user-data` ✓ · `pii-no-bare-text` ✓ (azioni/criteri sono testo dell'utente — coperti da auth + cascade)

### Non fare
- Non rendere `kill_criterion` opzionale: senza criterio non è uno spike, è un buon proposito

---

## Step 2 — Logica Spike: dalla ipotesi all'esperimento reversibile

### Obiettivo
Da un'ipotesi della Bussola, generare uno spike *piccolo, concreto, con kill-criterion*, e a fine periodo elaborarne l'esito come segnale forte sulla Bussola.

### File da creare
- `apps/server/src/services/spike/propose.ts` — genera azione + kill-criterion suggeriti per un'ipotesi
- `apps/server/src/services/spike/resolve.ts` — applica l'esito → stage Bussola + segnale
- `apps/server/src/services/spike/*.test.ts`

### Logica
1. **propose** (`propose.ts`): dato `{ hypothesisLabel, refId }`, costruisce 1–3 azioni candidate *piccole e verificabili* (≤ qualche ora/2 settimane). Fonti: `get_learning_paths` (un primo modulo), `get_skill_cooccurrences` (una skill-ponte da testare), suggerimento "intervista 1 persona del ruolo". Genera un kill-criterion default basato su energia ("se ti annoia più che incuriosirti").
2. **on create:** crea in parallelo un `userObjective` (riusa `save_objective` semantica) e un `calendar` event alla `reviewDate` (riusa `add_calendar_event`). Salva gli ID in `career_spikes`. Stage → `experimenting`.
3. **resolve** (`resolve.ts`): alla review, l'utente sceglie continue/kill + energia + cosa ha imparato.
   - `completed_continue` con energia alta → segnale Bussola fortissimo (`weight` alto) → confidence ipotesi ↑↑; se supera soglia, stage → `committed`.
   - `completed_kill` → confidence ipotesi ↓, ma è **progresso** (ha eliminato per esperienza, non per paura) → stage resta `hypotheses`, l'ipotesi viene marcata "testata e scartata".

### Criteri di successo
- [ ] `propose` produce azioni piccole+verificabili e un kill-criterion non vuoto
- [ ] create → crea objective + calendar event collegati (ID salvati)
- [ ] `resolve(continue, energia alta)` → confidence ↑, possibile `committed`
- [ ] `resolve(kill)` → ipotesi marcata testata; nessuna penalità "morale", solo dato

### Security gate
- `owner-scoped` ✓ · `input-validated` ✓

### Non fare
- Non generare azioni grandi ("iscriviti a una laurea"): lo spike è deliberatamente piccolo e reversibile
- Non trattare un `kill` come fallimento nell'UI/copy: è informazione acquisita

---

## Step 3 — Route server + tool Wendy

### File da creare
- `apps/server/src/routes/spikes.ts` + `.test.ts`

### File da modificare
- `apps/server/src/route-config.ts` — `{ path: "/api/spikes", router: spikesRouter, auth: "authenticated", description: "Spike di carriera" }`
- `packages/ai-server/src/wendy-router/tool-registry.ts` — 2 tool: `propose_spike`, `log_spike_outcome` (intent `planning`, `conversation`)
- `packages/ai-server/src/wendy-router/tool-handlers-compass.ts` (creato in Fase 1) — handler
- `packages/ai-server/src/wendy-router/tool-handlers.ts` — dispatch + `WRITE_TOOLS`

### Endpoint
| Metodo | Path | Scopo |
|---|---|---|
| `GET`  | `/api/spikes` | spike dell'utente (active/past) |
| `POST` | `/api/spikes/propose` | `{ hypothesisLabel, refId }` → azioni+kill candidati |
| `POST` | `/api/spikes` | crea spike (+ objective + calendar event) |
| `POST` | `/api/spikes/:id/resolve` | `{ decision, energy, learned }` → esito + Bussola |

### Tool Wendy
- `propose_spike` (read-only): dato un'ipotesi, propone un micro-esperimento con kill-criterion. Wendy lo usa quando l'utente è in stage `hypotheses` e tentenna.
- `log_spike_outcome` (**write**, `wendyAction` con conferma): registra l'esito raccontato in chat.

System prompt (persona indeciso): *"Quando l'utente ha un'ipotesi ma ha paura di impegnarsi, proponi uno SPIKE: piccolo, 2 settimane, con un criterio di stop deciso prima. Ricordagli che è un test reversibile, non una scelta definitiva."*

### Criteri di successo
- [ ] `POST /api/spikes` crea spike + objective + calendar event collegati
- [ ] `resolve` aggiorna stato + Bussola; il calendar event alla `reviewDate` esiste
- [ ] `propose_spike` (Wendy) restituisce azione piccola + kill-criterion
- [ ] `log_spike_outcome` non scrive senza conferma client (`wendyAction`)
- [ ] Owner-scoped su tutto

### Security gate (`gate-route` + `gate-ai-tool`)
- `auth-required` ✓ · `owner-scoped` ✓ · `input-validated` ✓
- `confirm-before-destructive` ✓ — `log_spike_outcome` via `wendyAction`
- `tool-registered-in-index` ✓

### Non fare
- Non creare l'evento calendario nel passato (la `reviewDate` deve essere futura — vincolo già in `add_calendar_event`)
- Non far scrivere l'esito senza conferma

---

## Step 4 — Frontend: Spike board

### File da creare
- `apps/web/src/pages/bussola-spike.tsx` — proponi/gestisci spike + review
- `apps/web/src/features/compass/SpikeCard.tsx`, `KillCriterionField.tsx`, `SpikeReviewModal.tsx`

### File da modificare
- `apps/web/src/App.tsx` — route `/bussola/spike` (protetta, lazy)
- `apps/web/src/pages/bussola.tsx` — su ogni ipotesi ad alta confidence: CTA "Mettila alla prova (2 settimane)"
- (opz.) `apps/web/src/pages/calendar.tsx` — mostra gli eventi di review spike con badge

### UX
- Creazione spike in 3 campi: **azione** (precompilata da `propose`), **kill-criterion** (obbligatorio, con esempi), **data review** (default +14gg).
- Alla `reviewDate`: notifica + `SpikeReviewModal` → continue/kill + energia + "cosa ho imparato".
- Copy che normalizza il kill: *"Hai scoperto che non fa per te in 2 settimane invece che in 2 anni. È una vittoria."*

### Criteri di successo
- [ ] Creo uno spike → compare in board + in calendario alla review date
- [ ] La review aggiorna lo stato e la Bussola; `committed` raggiungibile
- [ ] Un `kill` è presentato come progresso, non fallimento
- [ ] Verifica preview: screenshot board + modal di review

### Non fare
- Non permettere creazione senza kill-criterion (validazione client+server)
- Non nascondere gli spike conclusi: lo storico "testato e scartato" è prezioso

---

## Step 5 — Test + Gate finale + chiusura percorso

### E2E manuale (intero arco indeciso)
1. Utente nuovo `indeciso` → diagnostico → Specchio → (energia) → Simulatore → Torneo → **1 ipotesi alta confidence**
2. Sull'ipotesi → "Mettila alla prova" → spike con kill-criterion → objective + calendar event creati
3. Avanza a `experimenting`; alla review: continue+energia alta → `committed`
4. Variante: kill → ipotesi marcata testata, utente torna a `hypotheses` informato (non frustrato)

### Criteri finali (`/gsd:verify-work` + DoD OVERVIEW)
- [ ] `pnpm test` verde (propose, resolve, route)
- [ ] Spike crea correttamente objective + calendar collegati
- [ ] `compass_profiles.stage` percorre `zero_ideas → … → committed` in una run reale
- [ ] Wendy modalità indeciso: nessun verdetto secco (check `docs/eval-wendy`)
- [ ] Tutte le tabelle del percorso (`compass_*`, `simulation_*`, `future_*`, `tournament_*`, `career_spikes`, `scene_cards`) nello sweep GDPR
- [ ] Tutti i security gate verdi su tutte e 4 le fasi

### Non fare
- Non chiudere il percorso senza la demo end-to-end registrata (è la prova che il servizio funziona)
- Non presentare `committed` come irreversibile: anche dopo, l'utente può aprire un nuovo spike
