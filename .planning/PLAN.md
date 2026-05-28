# PLAN — Fase 1: Ritual Engine + Dashboard Personalizzabile

**Branch:** `feature/fase1-ritual-engine`
**Obiettivo:** Trasformare NorthStar da SaaS reattivo a SaaS+AaaS con agenti autonomi user-level e dashboard personalizzabile.

**Architettura di riferimento:** `.claude/plans/voglio-rendere-la-mia-polished-cocke.md`

---

## Mappa dei task

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7 → Step 8 → Step 9
  DB        API     Worker   Agents  Delivery  AI Tool   UI-Dash  UI-Rout  Tests+Gate
```

Ogni step ha: **cosa fare**, **file coinvolti**, **criteri di successo**, **non fare**.

---

## Step 1 — DB Schema: `userRoutines` + `userDashboardLayout`

### Obiettivo
Creare le due nuove tabelle Drizzle seguendo esattamente il pattern delle tabelle esistenti (es. `proactiveInsight.ts`, `subscription.ts`).

### File da creare
- `packages/db/src/schema/userRoutines.ts`
- `packages/db/src/schema/userDashboardLayout.ts`

### File da modificare
- `packages/db/src/schema/index.ts` (o barrel export esistente) — aggiungere i due nuovi export

### Schema `userRoutines`

```typescript
// packages/db/src/schema/userRoutines.ts
import { pgTable, serial, integer, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userRoutinesTable = pgTable("user_routines", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type:          text("type", {
                   enum: ["job_monitor", "market_report", "mindset_exercise", "growth_briefing", "interview_prep"]
                 }).notNull(),
  name:          text("name").notNull(),                    // nome human-readable
  schedule:      text("schedule").notNull(),                // cron expression: "0 9 * * 4" oppure preset: "every_thursday"
  parameters:    jsonb("parameters").notNull().default({}), // {role, city, seniority, ...}
  outputChannel: text("output_channel", {
                   enum: ["email", "in_app", "wendy_context", "all"]
                 }).notNull().default("all"),
  active:        boolean("active").notNull().default(true),
  lastRunAt:     timestamp("last_run_at", { withTimezone: true }),
  nextRunAt:     timestamp("next_run_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:       index("user_routines_user_idx").on(t.userId),
  activeIdx:     index("user_routines_active_idx").on(t.active, t.nextRunAt),
  typeIdx:       index("user_routines_type_idx").on(t.type),
}));

export type UserRoutine    = typeof userRoutinesTable.$inferSelect;
export type NewUserRoutine = typeof userRoutinesTable.$inferInsert;
```

### Schema `userDashboardLayout`

```typescript
// packages/db/src/schema/userDashboardLayout.ts
import { pgTable, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userDashboardLayoutTable = pgTable("user_dashboard_layout", {
  userId:    integer("user_id").primaryKey()
               .references(() => usersTable.id, { onDelete: "cascade" }),
  layout:    jsonb("layout").notNull().default([]), // WidgetLayout[]
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("user_dashboard_layout_user_idx").on(t.userId),
}));

export type UserDashboardLayout    = typeof userDashboardLayoutTable.$inferSelect;
export type NewUserDashboardLayout = typeof userDashboardLayoutTable.$inferInsert;
```

### Criteri di successo
- [ ] `pnpm db:generate` genera la migration senza errori
- [ ] `pnpm db:migrate` applica le tabelle su DB locale
- [ ] Le due tabelle appaiono in `\dt` di psql
- [ ] Gli export sono disponibili da `@workspace/db`

### Non fare
- Non modificare tabelle esistenti
- Non aggiungere ancora dati di esempio

---

## Step 2 — API Backend: CRUD Route `/api/routines`

### Obiettivo
Creare la route REST per gestire le routine dell'utente autenticato. Seguire il pattern delle route esistenti (es. `apps/server/src/routes/profile.ts`).

### File da creare
- `apps/server/src/routes/routines.ts`

### File da modificare
- `apps/server/src/route-config.ts` — registrare la nuova route
- `apps/server/src/routes/index.ts` (se esiste) — aggiungere l'import

### Endpoint da implementare

| Method | Path | Descrizione |
|--------|------|-------------|
| `GET`  | `/api/routines` | Lista routine dell'utente autenticato |
| `POST` | `/api/routines` | Crea nuova routine (validate body con zod) |
| `PATCH`| `/api/routines/:id` | Aggiorna routine (attiva/disattiva, modifica parametri) |
| `DELETE`| `/api/routines/:id` | Elimina routine |

### Validazione (Zod)

```typescript
const CreateRoutineSchema = z.object({
  type: z.enum(["job_monitor", "market_report", "mindset_exercise", "growth_briefing", "interview_prep"]),
  name: z.string().min(1).max(100),
  schedule: z.string(),               // cron string o preset
  parameters: z.record(z.unknown()),
  outputChannel: z.enum(["email", "in_app", "wendy_context", "all"]).default("all"),
});
```

### Feature gate (piano)
Prima di creare, verificare il limite:
- Free: max 1 routine attiva → errore 403 se già ne ha 1
- Pro: max 5 routine attive
- Team: illimitate

Usare la funzione `checkFeatureAccess()` già esistente nel progetto.

### Criteri di successo
- [ ] `GET /api/routines` (autenticato) restituisce `[]` per nuovo utente
- [ ] `POST /api/routines` crea un record e restituisce `201` con la routine creata
- [ ] `PATCH /api/routines/:id` aggiorna `active` da `true` a `false`
- [ ] `DELETE /api/routines/:id` rimuove il record
- [ ] Utente Free che tenta di creare una seconda routine riceve `403`

### Non fare
- Non implementare l'esecuzione qui (è Step 3)
- Non esporre dati di altri utenti

---

## Step 3 — Worker: User-Level Scheduler

### Obiettivo
Creare un worker che scansiona `user_routines` ogni minuto, trova le routine con `next_run_at ≤ now()` e `active = true`, e le dispatcha all'esecutore corretto. Estende il sistema cron esistente in `apps/server/src/jobs/cron.ts`.

### File da creare
- `apps/server/src/jobs/routine-scheduler.ts` — il loop principale
- `apps/server/src/jobs/routine-executor.ts` — dispatch per tipo

### File da modificare
- `apps/server/src/jobs/cron.ts` — avviare il routine-scheduler all'interno di `startCronJobs()`

### Logica del loop

```typescript
// routine-scheduler.ts — ogni 60 secondi
async function runRoutineScheduler(): Promise<void> {
  const now = new Date();
  const due = await db.select()
    .from(userRoutinesTable)
    .where(
      and(
        eq(userRoutinesTable.active, true),
        lte(userRoutinesTable.nextRunAt, now),
      )
    )
    .limit(50); // max 50 per tick per evitare overload

  for (const routine of due) {
    // Aggiorna subito nextRunAt (evita doppia esecuzione)
    await db.update(userRoutinesTable)
      .set({ lastRunAt: now, nextRunAt: computeNextRun(routine.schedule) })
      .where(eq(userRoutinesTable.id, routine.id));

    // Dispatcha in background (non await, usa recordCronRun esistente)
    executeRoutine(routine).catch(err =>
      logger.error({ err, routineId: routine.id }, "[scheduler] routine execution failed")
    );
  }
}
```

### Funzione `computeNextRun(schedule: string): Date`
Converte cron expression o preset human-readable in un `Date`:
- Preset supportati: `"daily"`, `"every_monday"`, `"every_thursday"`, `"weekly"`, `"every_2_days"`
- Cron expressions: usare la libreria `croner` o `cron-parser` (già in monorepo o da aggiungere)

### Criteri di successo
- [ ] Una routine con `next_run_at` nel passato viene prelevata nel tick successivo
- [ ] `nextRunAt` viene aggiornato prima dell'esecuzione (idempotenza)
- [ ] Errore nell'esecuzione di una routine non blocca le altre
- [ ] Log strutturati per ogni esecuzione (routineId, userId, type, durationMs)

### Non fare
- Non eseguire più di 50 routine per tick (evita DoS)
- Non usare `setInterval` direttamente — usare il pattern `safeRun` + `recordCronRun` già in `cron.ts`

---

## Step 4 — Agenti Esecutori: 5 Template Routine

### Obiettivo
Implementare i 5 esecutori di routine come funzioni async che ricevono `(routine: UserRoutine, user: User)` e producono un `RoutineResult`.

### File da creare
- `apps/server/src/jobs/executors/job-monitor.ts`
- `apps/server/src/jobs/executors/market-report.ts`
- `apps/server/src/jobs/executors/mindset-exercise.ts`
- `apps/server/src/jobs/executors/growth-briefing.ts`
- `apps/server/src/jobs/executors/interview-prep.ts`
- `apps/server/src/jobs/executors/index.ts` — barrel export + dispatch map

### Interface comune

```typescript
export interface RoutineResult {
  title: string;
  body: string;              // markdown
  ctaLabel?: string;
  ctaTarget?: string;
  metadata?: Record<string, unknown>;
}

export type RoutineExecutor = (
  routine: UserRoutine,
  user: User,
) => Promise<RoutineResult>;
```

### Implementazione per ciascun esecutore

#### `job-monitor.ts`
1. Legge `parameters.role`, `parameters.city`, `parameters.seniority`
2. Chiama `runJobPostingsAgent()` (già esiste in `@workspace/ai-server`) filtrato per utente
3. Oppure query diretta su `jobPostingSnapshotsTable` con filtri testuali
4. Formatta top 3-5 offerte in markdown
5. Restituisce `RoutineResult` con lista strutturata

#### `market-report.ts`
1. Legge `parameters.sector`, `parameters.length`
2. Chiama il Tavily search tool (già disponibile in `@workspace/ai-server`) con query settoriale
3. Chiama `runWeakSignalDetector()` (già esiste) filtrato per settore
4. Sintetizza con un LLM call (GPT-4o-mini per cost saving)
5. Restituisce report markdown

#### `mindset-exercise.ts`
1. Legge `parameters.tone`, `parameters.focus`
2. Genera esercizio personalizzato con LLM, usando il profilo psicologico utente (già in DB: `coachMemory`)
3. Breve, pratico, 3-5 minuti
4. Restituisce esercizio + istruzioni

#### `growth-briefing.ts`
1. Legge obiettivi utente da `userObjectivesTable`
2. Legge progressi recenti (ultimi 7 giorni)
3. Sintetizza stato avanzamento + suggerimenti
4. Restituisce briefing markdown personalizzato

#### `interview-prep.ts`
1. Legge `parameters.targetCompany`, `parameters.targetRole`
2. Ricerca news recenti sull'azienda (Tavily)
3. Genera 5 domande probabili + suggerimenti risposta
4. Restituisce report preparazione colloquio

### Criteri di successo
- [ ] Ogni esecutore può essere chiamato in isolamento con dati mock
- [ ] Tutti restituiscono un `RoutineResult` valido (non null, non undefined)
- [ ] `job-monitor` con parametri reali restituisce almeno 1 offerta lavoro
- [ ] `mindset-exercise` genera testo coerente con il tono specificato

### Non fare
- Non usare GPT-4o per esecutori semplici (usare GPT-4o-mini o Groq per cost saving)
- Non fare chiamate LLM se non strettamente necessarie (es. `job-monitor` può usare solo il DB)

---

## Step 5 — Sistema di Delivery: Email + In-App

### Obiettivo
Dopo che un esecutore produce un `RoutineResult`, consegnarlo all'utente via email e/o notifica in-app, in base a `outputChannel`.

### File da creare
- `apps/server/src/jobs/routine-delivery.ts` — funzione `deliverRoutineResult(routine, user, result)`
- `packages/db/src/schema/routineExecutions.ts` — storico esecuzioni (per in-app feed)

### Schema `routineExecutions`

```typescript
// storico delle esecuzioni — alimenta il feed in-app
export const routineExecutionsTable = pgTable("routine_executions", {
  id:          serial("id").primaryKey(),
  routineId:   integer("routine_id").notNull().references(() => userRoutinesTable.id, { onDelete: "cascade" }),
  userId:      integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  body:        text("body").notNull(),
  ctaLabel:    text("cta_label"),
  ctaTarget:   text("cta_target"),
  metadata:    jsonb("metadata"),
  readAt:      timestamp("read_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Logica delivery

```typescript
async function deliverRoutineResult(
  routine: UserRoutine,
  user: User,
  result: RoutineResult,
): Promise<void> {
  // 1. Salva sempre in DB (in-app feed)
  await db.insert(routineExecutionsTable).values({
    routineId: routine.id,
    userId: user.id,
    title: result.title,
    body: result.body,
    ctaLabel: result.ctaLabel,
    ctaTarget: result.ctaTarget,
    metadata: result.metadata,
  });

  // 2. Email (se channel = "email" | "all")
  if (routine.outputChannel === "email" || routine.outputChannel === "all") {
    await sendRoutineEmail(user, result); // via Resend (pattern già in codebase)
  }

  // 3. In-app notification (usando proactiveInsightsTable già esistente)
  if (routine.outputChannel === "in_app" || routine.outputChannel === "all") {
    await db.insert(proactiveInsightsTable).values({
      userId: user.id,
      insightType: "plan_update", // tipo più vicino
      title: result.title,
      body: result.body.slice(0, 500),
      ctaLabel: result.ctaLabel,
      ctaTarget: result.ctaTarget,
    });
  }
}
```

### Template email
Creare un template semplice Resend/React Email seguendo il pattern già usato per `wendyBriefing` email.

### API endpoint aggiuntivo
`GET /api/routines/feed` — restituisce le ultime 20 esecuzioni dell'utente (per il widget dashboard).

### Criteri di successo
- [ ] `routineExecutions` riceve un record dopo ogni esecuzione
- [ ] Email arriva in inbox con il contenuto corretto
- [ ] `proactiveInsights` ha il nuovo record visibile nell'app
- [ ] `GET /api/routines/feed` restituisce gli ultimi risultati

### Non fare
- Non inviare email per channel = "wendy_context" (il contesto va solo a Wendy, non per email)
- Non superare i limit Resend (rate limiting già in codebase)

---

## Step 6 — AI Tool: `configure_routine` per Wendy

### Obiettivo
Aggiungere a Wendy un tool che permette di configurare routine in linguaggio naturale. L'utente dice: *"voglio ogni giovedì 3 offerte developer a Milano"* → Wendy estrae i parametri → mostra anteprima → aspetta conferma → crea la routine via API interna.

### File da creare
- `packages/ai-server/src/tools/configure-routine.ts` — definizione tool + handler
- `packages/ai-server/src/tools/routine-types.ts` — tipi condivisi

### File da modificare
- `packages/ai-server/src/tools/index.ts` — registrare il nuovo tool
- `packages/ai-server/src/growth-agent/agent.ts` — includere il tool per gli intent "action" e "setup"

### Struttura del tool

```typescript
// configure-routine.ts
import { toolRegistry } from "./registry";

toolRegistry.register({
  name: "configure_routine",
  description: "Configura una routine automatica per l'utente. Usare quando l'utente vuole impostare notifiche periodiche, monitoraggio offerte lavoro, report settimanali, esercizi mindset programmati.",
  intents: ["action", "setup", "planning"],
  parameters: {
    type: "object",
    properties: {
      routineType: {
        type: "string",
        enum: ["job_monitor", "market_report", "mindset_exercise", "growth_briefing", "interview_prep"],
        description: "Tipo di routine da configurare"
      },
      name: { type: "string", description: "Nome human-readable per la routine" },
      schedule: { type: "string", description: "Frequenza: daily, weekly, every_monday, every_thursday, ogni_giorno, ogni_settimana, etc." },
      parameters: { type: "object", description: "Parametri specifici del tipo di routine" },
      outputChannel: {
        type: "string",
        enum: ["email", "in_app", "all"],
        default: "all"
      },
      action: {
        type: "string",
        enum: ["preview", "confirm", "cancel"],
        description: "preview = mostra anteprima senza creare; confirm = crea effettivamente; cancel = annulla"
      }
    },
    required: ["routineType", "schedule", "action"]
  },
  isUiTool: false,
  handler: async (args, context) => {
    if (args.action === "preview") {
      return {
        preview: true,
        routine: {
          type: args.routineType,
          name: args.name ?? defaultNameFor(args.routineType),
          schedule: args.schedule,
          parameters: args.parameters ?? {},
          outputChannel: args.outputChannel ?? "all",
        },
        message: "Ecco come sarà la tua routine. Vuoi confermare?"
      };
    }
    if (args.action === "confirm") {
      // Chiama l'API interna POST /api/routines
      const result = await createRoutineForUser(context.userId, {
        type: args.routineType,
        name: args.name ?? defaultNameFor(args.routineType),
        schedule: args.schedule,
        parameters: args.parameters ?? {},
        outputChannel: args.outputChannel ?? "all",
      });
      return { success: true, routine: result };
    }
    return { cancelled: true };
  }
});
```

### Flusso conversazionale
```
Utente: "voglio ogni giovedì offerte developer a Milano"
Wendy:  chiama configure_routine({ routineType: "job_monitor", schedule: "every_thursday",
          parameters: { role: "developer", city: "Milano" }, action: "preview" })
Wendy:  "✅ Ho preparato la tua routine: ogni giovedì mattina cercherò offerte developer 
         a Milano e te le manderò via email. Confermi?"
Utente: "sì"
Wendy:  chiama configure_routine({ ..., action: "confirm" })
Wendy:  "Perfetto! La tua routine è attiva. Ogni giovedì mattina riceverai le offerte."
```

### Criteri di successo
- [ ] Wendy riconosce l'intent "configura routine" e usa il tool (non risponde solo in testo)
- [ ] `action: "preview"` non crea record nel DB
- [ ] `action: "confirm"` crea il record e risponde con conferma
- [ ] Il tool è visibile nell'admin panel (`/admin-agenti`)

### Non fare
- Non creare la routine senza conferma esplicita dell'utente
- Non usare il tool per intent "career" o "mindset" generici (solo quando l'utente vuole impostare automazioni)

---

## Step 7 — Frontend: Dashboard Personalizzabile con Drag & Drop

### Obiettivo
Trasformare `apps/web/src/pages/dashboard.tsx` in una dashboard con widget riordinabili via drag & drop, con layout persistito per utente.

### Dipendenza da aggiungere
```
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter @workspace/web
```

### File da creare
- `apps/web/src/components/dashboard/DashboardLayout.tsx` — container drag & drop
- `apps/web/src/components/dashboard/WidgetGrid.tsx` — griglia widget con dnd-kit
- `apps/web/src/components/dashboard/widgets/` — directory widget
  - `ProgressWidget.tsx` — progress obiettivi
  - `JobFeedWidget.tsx` — ultime offerte lavoro dalla routine
  - `NextRoutineWidget.tsx` — prossima routine schedulata
  - `MindsetStreakWidget.tsx` — streak esercizi mindset
  - `InsightsWidget.tsx` — ultimi proactive insights

### File da modificare
- `apps/web/src/pages/dashboard.tsx` — sostituire il contenuto attuale con `<DashboardLayout />`

### Tipo `WidgetLayout`

```typescript
// shared type (può stare in packages/api-zod o nel componente)
export interface WidgetLayout {
  id: string;                   // "progress" | "job_feed" | "next_routine" | "mindset_streak" | "insights"
  position: number;             // ordine nel grid
  visible: boolean;             // widget può essere nascosto
  size: "sm" | "md" | "lg";    // larghezza del widget
}
```

### API calls
- `GET /api/dashboard/layout` — carica layout utente (nuovo endpoint semplice)
- `PUT /api/dashboard/layout` — salva layout dopo drag

### Logica UX
1. Al caricamento: fetch layout salvato, se non esiste usa default
2. Drag & drop riordina i widget → aggiorna stato locale
3. Debounce 800ms → `PUT /api/dashboard/layout` salva in background
4. Bottone "Personalizza" per mostrare/nascondere widget

### Backend aggiuntivo
- Aggiungere in `apps/server/src/routes/` un endpoint `GET/PUT /api/dashboard/layout`
- Leggere/scrivere da `userDashboardLayoutTable`

### Criteri di successo
- [ ] Dashboard carica con layout di default per nuovo utente
- [ ] Drag & drop riordina i widget visivamente
- [ ] Layout viene salvato e persiste dopo refresh della pagina
- [ ] Widget `NextRoutineWidget` mostra la prossima routine attiva dell'utente
- [ ] Widget `JobFeedWidget` mostra le ultime esecuzioni dalla `routineExecutions`

### Non fare
- Non riscrivere i widget esistenti (DashboardHero, DashboardObjectives, etc.) — integrarli come wrapper
- Non usare react-beautiful-dnd (deprecato) — usare dnd-kit
- Non fare layout a pixel fissi — usare CSS Grid con `grid-column: span X`

---

## Step 8 — Frontend: UI Gestione Routine

### Obiettivo
Creare una sezione nell'app dove l'utente può vedere, attivare/disattivare ed eliminare le sue routine. **Non** è un form di configurazione complesso — la configurazione avviene via Wendy (Step 6). Questa UI è solo per la gestione.

### File da creare
- `apps/web/src/components/routines/RoutinesList.tsx` — lista routine attive
- `apps/web/src/components/routines/RoutineCard.tsx` — card singola routine
- `apps/web/src/components/routines/RoutineFeed.tsx` — feed risultati routine
- `apps/web/src/pages/routines.tsx` — pagina `/routines`

### File da modificare
- `apps/web/src/route-config.ts` — aggiungere route `/routines`
- `apps/web/src/App.tsx` — aggiungere route nel router
- `apps/web/src/components/layout/MobileBottomNav.tsx` — aggiungere link routine (sostituisce o affianca voce esistente)

### UI della `RoutineCard`

```
┌─────────────────────────────────────────────┐
│ 🔍 Job Monitor — Developer a Milano          │
│ Ogni giovedì mattina · Email + App           │
│                                              │
│ Ultima esecuzione: ieri alle 09:00           │
│ Prossima: giovedì 29 maggio                  │
│                                              │
│ [Toggle ON/OFF]           [🗑️ Elimina]       │
└─────────────────────────────────────────────┘
```

### Criteri di successo
- [ ] Pagina `/routines` mostra tutte le routine dell'utente
- [ ] Toggle ON/OFF chiama `PATCH /api/routines/:id` e aggiorna UI
- [ ] Elimina chiama `DELETE /api/routines/:id` con confirm dialog
- [ ] Feed mostra ultimi 10 risultati delle routine
- [ ] Utente Free con 1 routine vede il badge "Piano Free: 1/1 routine"
- [ ] Link a `/routines` visibile nella navigazione

### Non fare
- Non creare form di configurazione manuale — rimandare a Wendy per creare nuove routine
- Non bloccare l'utente Free dalla pagina — mostrarla con upsell per il limite

---

## Step 9 — Test + Feature Gate

### Obiettivo
Coprire i percorsi critici con test, verificare i feature gate di monetizzazione, e assicurarsi che nulla di esistente sia rotto.

### Test da scrivere

#### Backend (Vitest/Jest)
- `apps/server/src/routes/routines.test.ts`
  - CRUD completo: crea, leggi, aggiorna, elimina
  - Feature gate: Free user → 403 alla seconda routine
  - Auth: utente non autenticato → 401
  - Cross-user: utente A non può modificare routine di utente B

- `apps/server/src/jobs/routine-scheduler.test.ts`
  - `computeNextRun("every_thursday")` restituisce il prossimo giovedì
  - Routine con `next_run_at` nel futuro non viene prelevata
  - Routine con `next_run_at = null` non viene prelevata

- `apps/server/src/jobs/executors/job-monitor.test.ts`
  - Con parametri mock restituisce un `RoutineResult` valido
  - Gestisce assenza di offerte lavoro (array vuoto) senza crash

#### Frontend (Vitest + Testing Library)
- `apps/web/src/components/routines/RoutineCard.test.tsx`
  - Render con routine mock
  - Toggle chiama `onToggle` con id corretto
  - Elimina mostra dialog di conferma

- `apps/web/src/components/dashboard/WidgetGrid.test.tsx`
  - Render con layout di default
  - Drag & drop aggiorna l'ordine (mock dnd-kit)

### Feature flags da aggiungere
In `packages/ai-server/src/feature-flags.ts`:
```typescript
FF_RITUAL_ENGINE: process.env.FF_RITUAL_ENGINE !== "false",  // default on
FF_DASHBOARD_CUSTOMIZATION: process.env.FF_DASHBOARD_CUSTOMIZATION !== "false",
```

### Verifiche manuali end-to-end
1. Aprire chat con Wendy → dire "voglio ogni giovedì offerte developer a Milano"
2. Wendy mostra anteprima routine
3. Confermare → routine creata
4. Navigare a `/routines` → vedere la routine nella lista
5. Navigare a `/dashboard` → widget `NextRoutineWidget` mostra la prossima esecuzione
6. Aspettare (o triggerare manualmente) l'esecuzione → email arriva + feed aggiornato
7. Toggle OFF sulla routine → worker non la esegue più

### Criteri di successo finali
- [ ] Tutti i test passano (`pnpm test`)
- [ ] Nessun test esistente è rotto
- [ ] `pnpm build` compila senza errori
- [ ] Flusso end-to-end completo funziona (verifica 1-7 sopra)
- [ ] Utente Free: limite 1 routine rispettato
- [ ] Utente Pro: fino a 5 routine
- [ ] Email delivery funzionante in staging

---

## Ordine di esecuzione raccomandato

```
1. Step 1 (DB)             → foundation, sblocca tutto il resto
2. Step 2 (API)            → sblocca Step 6 (tool Wendy) e Step 7/8 (frontend)
3. Step 5 (Delivery schema) → aggiunge routineExecutions, completare SUBITO dopo Step 2
4. Step 3 (Worker)         → can be parallel con Step 4
5. Step 4 (Esecutori)      → parallel con Step 3
6. Step 6 (AI Tool)        → dopo Step 2, indipendente dal worker
7. Step 7 (Dashboard)      → dopo Step 2 e Step 5
8. Step 8 (UI Routines)    → dopo Step 2 e Step 5
9. Step 9 (Test + Gate)    → ULTIMO, dopo tutto il resto
```

## Dipendenze critiche

```
Step 1 (DB) ──┬──► Step 2 (API) ──┬──► Step 6 (AI Tool)
              │                   ├──► Step 7 (Dashboard)
              │                   └──► Step 8 (UI Routines)
              │
              └──► Step 5 (Delivery schema)
                        │
                        ├──► Step 3 (Worker) ──► Step 4 (Esecutori)
                        └──► Step 7 (Dashboard - feed widget)
```

---

## Threat Model (sicurezza)

| Rischio | Mitigazione |
|---------|-------------|
| Utente esegue routine di un altro utente | Auth check su ogni endpoint (`req.userId === routine.userId`) |
| Spam di routine (DoS) | Feature gate: max 1/5/∞ per piano |
| Worker blocca il processo | `executeRoutine()` in background, non bloccante, timeout 30s |
| LLM injection nei parametri routine | Sanitizzare `parameters` (no HTML, no template injection) |
| Email flooding | Max 1 email per routine per esecuzione, rate limit Resend |

---

## File di riferimento da leggere prima di ogni step

| Step | File da leggere come pattern |
|------|------------------------------|
| 1 | `packages/db/src/schema/proactiveInsight.ts` |
| 2 | `apps/server/src/routes/profile.ts` |
| 3 | `apps/server/src/jobs/cron.ts`, `apps/server/src/lib/agent-runs.ts` |
| 4 | `apps/server/src/jobs/proactive-insight-generator.ts` |
| 5 | `apps/server/src/jobs/briefing-generator.ts` |
| 6 | `packages/ai-server/src/tools/registry.ts`, `packages/ai-server/src/tools/types.ts` |
| 7 | `apps/web/src/components/dashboard/DashboardObjectives.tsx` |
| 8 | `apps/web/src/pages/profilo.tsx` |
| 9 | `apps/server/src/routes/admin.test.ts` (se esiste) |
