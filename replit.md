# NorthStar — Career Orientation SaaS per utenti europei

> Piattaforma di coaching per carriera, crescita personale e formazione. Test RIASEC + AI agents + feed Discovery personalizzato.

---

## Avvio rapido

| Servizio | Comando | Porta |
|---|---|---|
| Frontend (Vite) | `PORT=5000 pnpm --filter @workspace/orientamento run dev` | 5000 |
| API Server (Express) | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| Python AI (FastAPI) | `cd artifacts/ai-agents && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000` | 8000 |

```bash
# DB migrations
pnpm --filter @workspace/db exec drizzle-kit push

# Build completo
pnpm run build

# Typecheck
pnpm run typecheck

# E2E tests (richiede tutti i servizi attivi)
pnpm test:e2e
```

### Variabili d'ambiente

**Obbligatorie:** `DATABASE_URL`, `ADMIN_KEY`, `AI_AGENTS_URL`, `JWT_SECRET`

**Opzionali:**
```
JWT_SECRET
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
GNEWS_API_KEY, TAVILY_API_KEY
RESEND_API_KEY
EMAIL_FROM                  # mittente email verificato (es. noreply@tuodominio.eu) — OBBLIGATORIO per email a utenti reali
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
GOOGLE_CLIENT_ID
AI_INTEGRATIONS_OPENAI_BASE_URL   # Replit proxy OpenAI
AI_INTEGRATIONS_OPENAI_API_KEY
AI_MODEL                    # modello OpenAI per agenti orchestratore (default: gpt-4o-mini). Valori validi: gpt-4o-mini, gpt-4.1, gpt-4o
CORS_ORIGIN                 # origin frontend in produzione (es. https://northstar.app) — senza questo CORS è limitato a localhost:5000
```

---

## Stack tecnico

| Layer | Tecnologie |
|---|---|
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, Radix UI, Wouter, TanStack React Query, Recharts, Framer Motion, i18next |
| **Backend** | Express 5, TypeScript, Drizzle ORM, Pino logging, esbuild (custom `build.mjs`) |
| **AI** | Python 3.11, FastAPI, LangChain, LangGraph — microservizio su porta 8000 |
| **LLM** | `gpt-4o-mini` via Replit proxy (`AI_INTEGRATIONS_OPENAI_BASE_URL`) per Discovery enricher e agenti orchestratore. Modello configurabile via env `AI_MODEL` (default `gpt-4o-mini`). |
| **Database** | PostgreSQL (Replit managed), Drizzle ORM |
| **Auth** | JWT custom (bcryptjs + `JWT_SECRET` persistente) |
| **Monorepo** | pnpm workspaces + catalog |
| **E2E** | Playwright (chromium), specs in `e2e/` |
| **DOCX** | libreria `docx` (server-side, `api-server`) — installare con `pnpm add docx --filter api-server` |

---

## Struttura del progetto

```
artifacts/
  orientamento/          # React/Vite frontend (porta 5000)
    src/
      pages/             # ~30 pagine (home, dashboard, discovery, admin...)
      components/        # UI components (navbar, cards, wizard, admin panels)
        cv/              # CV Builder components
          CvGeneratorModal.tsx   # modale principale generazione CV (3 template)
          CvSection.tsx          # card dashboard CV: upload, genera, modifica, download
          CvEditorDrawer.tsx     # drawer editor manuale CV (sezioni collassabili)
          CvDownloadMenu.tsx     # dropdown download PDF / DOCX / JSON
      hooks/             # useSSEStream, useTTS, useDiscoveryFeed...
      lib/               # brand.ts, chart-theme.ts, queryClient...
  api-server/            # Express API (porta 8080)
    src/
      routes/            # 40+ route files organizzati per dominio
        cv.ts            # CV Builder — upload, generate, edit, PDF, DOCX, tailor, cover letter, ATS score
        discovery/       # feed.ts, saved.ts
        admin/           # agent-health, discovery-collect, discovery-sources,
                         # discovery-items, discovery-enrich, analyze-supervisor
        growth-agent/    # chat, knowledge, memory, analytics, notifications
      jobs/              # cron.ts (collector 6h, enricher 2h, personalizer 3h)
      middleware/        # jwt.ts, startup-check.ts
  ai-agents/             # Python FastAPI (porta 8000)
lib/
  db/
    src/schema/          # Drizzle schema — source of truth
    drizzle/             # SQL migrations
  integrations-openai-ai-server/
    src/discovery-agent/ # collector-agent.ts, enricher-agent.ts, personalizer-agent.ts
  integrations-openai-ai-react/
    src/
      admin/             # AdminDashboard, AdminEnricherPanel, AdminCollectorPanel...
      discovery/         # DiscoveryFeedPage, DiscoveryItemCard, useDiscoveryFeed
      growth-agent/      # GrowthChatPanel, GrowthAnalyticsDashboard...
  api-spec/              # OpenAPI spec + Orval codegen config
  api-zod/               # Zod schemas generati
  api-client-react/      # TanStack React Query hooks generati
e2e/                     # Playwright specs (auth, riasec, admin, objectives)
```

---

## CV Builder

Sistema completo per generare, modificare manualmente e scaricare il CV in più formati.

### Flusso principale

1. **Upload CV** — `POST /api/cv/mine/upload` (PDF o TXT, max 5 MB) → AI estrae JSON strutturato
2. **Genera da profilo** — `POST /api/cv/mine/generate` → AI genera CV da grafo conoscenze + profilo RIASEC; scegli template (Classic / Minimal / Bold)
3. **Modifica manuale** — icona matita → apre `CvEditorDrawer` (drawer laterale 520px)
4. **Scarica** — dropdown `CvDownloadMenu` con 3 formati

### CvEditorDrawer — Editor manuale

Drawer `Sheet` full-height diviso in sezioni collassabili; salva via `PATCH /api/cv/mine/generated`.

| Sezione | Campi |
|---|---|
| 👤 Informazioni personali | Nome, Titolo, Email, Telefono, Sede, LinkedIn, Sito, Ruolo target |
| ✦ Profilo / Sommario | Textarea libera |
| 💼 Esperienze | CRUD card per card — ruolo, azienda, periodo, sede, descrizione (con `→` bullet), tag skill |
| 🎓 Formazione | CRUD — titolo, istituto, anno, note |
| 🔧 Competenze & Strumenti | Tag-editor separato per `skills` e `tools` (Enter o `+`) |
| 🌐 Lingue | Riga per lingua + livello |
| 🏅 Certificazioni | Tag-editor |

Footer fisso con bottone **Salva** + badge verde "Salvato!" per 3 secondi. Annulla chiude senza salvare.

### CvDownloadMenu — Formati di download

| Formato | Endpoint / Meccanismo |
|---|---|
| **PDF** | `GET /api/cv/:userId/pdf?template=` — usa il template salvato (`classic` / `minimal` / `bold`) |
| **Word (DOCX)** | `GET /api/cv/:userId/docx` — generato server-side con libreria `docx`; heading H1 nome, H2 sezioni con bordo verde, bullet `→`, stile Calibri |
| **JSON** | `Blob` costruito client-side dal `generatedCvData` in memoria — nessuna call API |

### API CV — riepilogo endpoint

```
GET    /api/cv/mine                    → lista CV utente autenticato
POST   /api/cv/mine/upload             → upload PDF/TXT + estrazione AI
POST   /api/cv/mine/generate           → genera CV da profilo (body: { template })
PATCH  /api/cv/mine/generated          → salva modifiche manuali (body: { generated })
DELETE /api/cv/mine                    → elimina tutto

GET    /api/cv/:userId/pdf?template=   → download PDF binario
GET    /api/cv/:userId/docx            → download DOCX binario
POST   /api/cv/:userId/tailor          → adatta CV a offerta di lavoro (AI)
GET    /api/cv/:userId/versions        → lista versioni salvate
POST   /api/cv/:userId/versions        → salva nuova versione con nome
POST   /api/cv/:userId/cover-letter    → genera lettera di accompagnamento (AI)
GET    /api/cv/:userId/cover-letter/pdf → PDF lettera
POST   /api/cv/:userId/ats-score       → score compatibilità CV-offerta (AI, 0-100)
```

### Struttura dati GeneratedCv

```typescript
interface GeneratedCv {
  personalInfo: { name, title?, email?, phone?, location?, linkedin?, website? };
  summary?: string;
  experience: Array<{ id, title, company, period, location?, description, skills[] }>;
  education:  Array<{ id, degree, institution, year, description? }>;
  skills:     string[];
  tools:      string[];
  languages:  Array<{ language, level }>;
  certifications: string[];
  targetRole?: string;
  template?:  "classic" | "minimal" | "bold";
  generatedAt?: string;
  savedAt?:   string;
}
```

### Template PDF

| Template | Stile |
|---|---|
| `classic` | Verde scuro `#1a2e1a`, 2 colonne, header verde |
| `minimal` | Bianco, 1 colonna, tipografia pulita |
| `bold` | Navy `#0f172a` + Arancio `#f97316`, alto contrasto |

---

## Sistema Discovery (Agenti AI)

Pipeline a 3 stadi che raccoglie, arricchisce e personalizza contenuti per ogni utente.

### 1. Collector Agent — `collector-agent.ts`
- Raccoglie da fonti RSS configurabili (gestite via admin) + API (GNews, Tavily)
- Parser RSS con gestione redirect 301/302
- Deduplication via `url_hash` (SHA-256)
- Salva in `discovery_items` con `is_enriched = false`
- Schedule: **ogni 6 ore** via cron
- Admin route: `POST /api/admin/discovery/collect`

### 2. Enricher Agent — `enricher-agent.ts`
- Arricchisce i raw items con **gpt-4o-mini** (JSON mode) — modello fisso, non configurabile via AI_MODEL
- **Priority queue:** opportunity (5) > formation (4) > sector_trend (3) > news (2) > growth (1)
- **Concorrenza:** 5 chiamate GPT parallele (`pLimit` interno)
- **Retry:** 2 tentativi con backoff esponenziale; dopo 3 fallimenti totali → skip definitivo
- **Filtro rilevanza:** items con `relevance_score < 0.25` non appaiono nel feed utente
- Output per item: `relevanceScore`, `skillTags[]`, `insightText` (IT), `journeyTypes[]`, `difficulty`
- Costo: ~$0.0009/run (20 item) — circa **$0.10/mese** con schedule 2h
- Schedule: **ogni 2 ore** + trigger automatico 1 min dopo ogni collect
- Admin route: `POST /api/admin/discovery/enrich`, `GET /api/admin/discovery/enrich/status`

### 3. Personalizer Agent — `personalizer-agent.ts`
- Sovrascrive `personalScore` per ogni utente in base al suo profilo RIASEC + journeyType
- Schedule: **ogni 3 ore**

### Schema DB — `lib/db/src/schema/discoveryItems.ts`

```typescript
// Campi enrichment (popolati da enricher-agent)
isEnriched:     boolean   // true dopo GPT run
enrichedAt:     timestamp
enrichRetries:  integer   // max 3, poi skip definitivo
relevanceScore: real      // 0-1
skillTags:      text[]    // max 5 competenze
insightText:    text      // "perché ti riguarda" in italiano
journeyTypes:   text[]    // developer|designer|marketer|...
difficulty:     text      // easy|medium|advanced (solo type=formation)
```

> **Dopo ogni aggiornamento schema:** `pnpm --filter @workspace/db exec drizzle-kit push`

---

## Admin Dashboard

Percorso: `/admin` → `<AdminDashboard />` (6 sezioni).

| Sezione | Contenuto |
|---|---|
| 📊 **Overview** | KPI cards (items totali, enriched, fonti, ultimo collect) + azioni rapide + schedule cron + agent health preview |
| ⚡ **Collector** | Trigger manuale, progress, risultati per fonte |
| ✨ **Enricher** | Badge pending (poll 30s), config batchSize/concurrency, costo stimato live, ring progress %, error log |
| 📡 **Fonti RSS** | CRUD completo fonti — toggle, test feed, edit inline |
| 📝 **Item recenti** | Tabella ultimi 20 item con filtri tipo/stato |
| 📍 **Agent Health** | Stato agenti con badge ok/warning/error + timestamp |

Layout: sidebar sticky su desktop, bottom tab bar su mobile.

---

## Feed Discovery — UX

`DiscoveryFeedPage` → `DiscoveryItemCard`

**Filtri disponibili:**
- **Tipo:** Tutto / Opportunità / Formazione / Notizie / Crescita / Trend
- **Per chi (journeyType):** Dev / Design / Marketing / Career switch / Imprenditore / Studente (filtro collassabile)

**Anatomia della card:**
```
[badge tipo] [badge difficoltà con dot colorato] [badge ⏳ se non ancora enriched]
[titolo — cliccabile]
[💡 pill insight GPT — espandibile tap/click]
  └ quando aperto: testo completo + barra rilevanza colorata (verde/giallo/grigio)
[sommario breve — solo se insight collassato]
[journey type chips — max 2]
[skill tags — max 4 + overflow +N]
[footer: fonte | data | 🔖 bookmark | ↗ apri]
```

**Logica visuale insight:**
- `isEnriched=false` → spinner animato "Analisi GPT..."
- `relevanceScore >= 0.25` → pill 💡 espandibile
- `relevanceScore < 0.25` → item filtrato lato server, non arriva al client

---

## Prodotto — Funzionalità

### Core
- **RIASEC + Five Spirits test** (17 domande) → matching 28 settori con score, roadmap, dati salary
- **AI features (premium):** Wiki AI chat, Roadmap generator, Skills Gap Analysis, Interview Simulator, Career Coach, Knowledge Graph con RAG
- **Stripe subscription** per tier premium
- **Auth:** JWT custom (bcryptjs)

### User Features
- **Journey Types:** `indeciso / dipendente / autonomo / azienda / investitore` — personalizza tutta la UI
- **Career Climber Mode:** `user_mode` col, `ClimberToolsSection` in dashboard
- **NorthStar Score pubblico:** `GET /api/journey-score/:userId` — score 0-100, pagina pubblica `/score/:userId`
- **Certificazioni trackabili:** DB `certifications`, CRUD `/api/certifications`, sezione in `/profilo`
- **Onboarding Wizard:** overlay 3 step (journey type → obiettivi → conferma), trigger da home per nuovi utenti
- **PostTest Funnel:** `PostTestWizard.tsx` overlay 3 step dopo il test RIASEC
- **Job Board con match score:** `/lavori` — 12 job listings scorati contro settore RIASEC
- **Business Idea Validator:** `POST /api/business-ideas` → AI validation (score 0-10, 12 campi) + incubator finder
- **Calendario + .ics export:** `GET /api/calendar/export.ics` — RFC-5545 per Google/Apple/Outlook
- **Audio TTS articoli:** `useTTS` hook (Web Speech API) + `TTSButton`
- **Peer Review obiettivi:** `objective_comments` table, commenti/reazioni su obiettivi pubblici
- **CV Builder completo:**
  - Upload PDF/TXT → estrazione AI (personalInfo, summary, esperienze, educazione, skill, lingue, certificazioni)
  - Generazione AI da profilo con scelta template (Classic / Minimal / Bold)
  - **Editor manuale** — `CvEditorDrawer` con CRUD per ogni sezione, tag-editor, salvataggio esplicito
  - **Download multi-formato** — PDF (3 template), DOCX (generato server-side via `docx`), JSON (client-side)
  - Tailor CV su offerta di lavoro, ATS score 0-100, cover letter AI, versioning (max 20)

### Admin Features
- **Admin Catalogs CRUD:** `GET/POST/PATCH/DELETE /api/admin/catalogs/{sectors|professions|education-paths|growth-articles}`
- **Agent Health Dashboard:** `GET /api/admin/agent-health`
- **Growth Queue:** `GET/POST /api/admin/growth-queue` + approve/reject
- **Setup Wizard:** `admin-status.tsx` — guide card per-integrazione (Stripe, GNews, Tavily, Resend, Push, Google OAuth)

### Moduli feed & research
- **News module:** GNews API o curated
- **Research Scheduler:** Tavily
- **Email notifications:** Resend (richiede `EMAIL_FROM` con dominio verificato per utenti reali)
- **Web Push:** VAPID

---

## Design System — Deep Navy Brand

- **Background:** `hsl(224 24% 8%)` = `#0e1018` — mai usare `bg-white` o `bg-gray-*`
- **Foreground:** `hsl(220 14% 93%)` = `#e6e8ed`
- **Accent Gold:** `hsl(43 44% 57%)` = `#c19e4a` — CTA, nav attivo, highlights, glow
- **Growth Green:** `hsl(152 26% 62%)` = `#7db89a`
- **Destructive:** `#d94f45`
- **Brand tokens:** `src/lib/brand.ts` + `lib/design-tokens/northstar-theme.css`
- **CSS vars:** `src/index.css` — `.glass`, `.pill-nav`, `.glow-primary`, `.text-display`, `.text-italic-serif`, `.text-label`
- **Logo:** `/public/logo.svg` (stella Polaris 4 punte + anello bussola + marker N) + `/public/favicon.svg`
- **Typography:** Inter (bold display) + Playfair Display italic per accent in hero
- **Fonts:** `index.html` Google Fonts — `Inter` + `Playfair Display:ital,wght@0,700;1,400;1,700`
- **Chart theme:** `lib/chart-theme.ts` — `CHART_COLORS` + `CHART_DEFAULTS`

---

## Architettura — Decisioni chiave

- **OpenAPI-first:** `lib/api-spec/openapi.yaml` → Orval genera Zod schemas + typed React Query hooks
- **Monorepo pnpm workspaces:** catalog per versioni condivise
- **esbuild custom:** `build.mjs` bundla il server Express; esternalizza native modules (satori, resvg-js, nodemailer...)
- **AI proxy pattern:** Express fa proxy delle richieste AI-heavy a Python FastAPI porta 8000; Python usa LangGraph agents
- **Startup check:** `startup-check.ts` valida le env vars obbligatorie prima del bind alla porta — fail fast con messaggi chiari
- **Replit AI Integration:** OpenAI via `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`
- **SSE streaming:** `hooks/useSSEStream.ts` + `components/ui/streaming-indicator.tsx`
- **CORS:** ristretto a `CORS_ORIGIN` env var in produzione (default: `http://localhost:5000`)
- **Auth rate limiting:** `/auth/*` ha rate limiter dedicato (5 req/15min per IP) via `authRateLimiter`
- **CV DOCX:** generazione server-side con libreria `docx` — dipendenza da aggiungere con `pnpm add docx --filter api-server`

---

## Gotchas & regole

- **Porta 5000 obbligatoria** per il frontend — Replit webview preview usa solo quella
- **Ordine route critico:** `notificationsRouter` e `pushRouter` applicano `authMiddleware` a root. Qualsiasi route admin che usa solo `x-admin-key` (no JWT) DEVE essere registrata in `routes/index.ts` **prima** di `calendarRouter` (riga ~78), altrimenti riceve 401
- **pnpm workspace:** esegui sempre dalla root o usa `--filter`
- **Growth scheduler:** si aspetta JSON valido da OpenAI; può warnare se il modello tronca l'output
- **`completion/me`:** usa SQL raw per `streak_days`/`last_active_at` (schema pushato, tipi Drizzle auto-refresh)
- **Errori tsc pre-esistenti:** `api-client-react` dist non buildata, params `any`-typed in ruolo/sector — non introdotti da feature nuove, ignorabili
- **Playwright:** `PLAYWRIGHT_BROWSERS_PATH` default `.cache/ms-playwright`; impostare `BASE_URL`/`API_URL` per staging
- **Discovery feed cache:** in-memory LRU 5min server-side + sessionStorage 10min client-side; passare `?refresh=1` per bypassare
- **Enricher retry cap:** dopo 3 fallimenti GPT, item marcato `isEnriched=true` con `score=0` — non riprocessato, non appare nel feed
- **News cache:** LRU in-memory cap 100 entries — evita crescita illimitata in RAM
- **Email prod:** impostare `EMAIL_FROM` con dominio Resend verificato; senza di esso le email arrivano solo all'owner account
- **AI_MODEL:** configura il modello OpenAI per gli agenti orchestratore. L'enricher usa sempre `gpt-4o-mini` direttamente.
- **CV editor:** `CvEditorDrawer` carica i dati via `GET /api/cv/:userId` al click dell'icona matita — se il CV generato non esiste ancora, il bottone è nascosto
- **CV DOCX install:** dopo ogni clone/reset eseguire `pnpm add docx --filter api-server` se la dipendenza non è nel `package.json` del server

---

## Pointers rapidi

| Cosa | Dove |
|---|---|
| Schema DB | `lib/db/src/schema/index.ts` |
| API routes | `artifacts/api-server/src/routes/index.ts` |
| CV routes | `artifacts/api-server/src/routes/cv.ts` |
| CV components | `artifacts/orientamento/src/components/cv/` |
| Frontend routes | `artifacts/orientamento/src/App.tsx` |
| Cron jobs | `artifacts/api-server/src/jobs/cron.ts` |
| Discovery agents | `lib/integrations-openai-ai-server/src/discovery-agent/` |
| Admin UI components | `lib/integrations-openai-ai-react/src/admin/` |
| Discovery UI | `lib/integrations-openai-ai-react/src/discovery/` |
| OpenAI client | `lib/integrations-openai-ai-server/src/client.ts` |
| OpenAI docs | `.local/skills/integrations/SKILL.md` |
| Brand tokens | `artifacts/orientamento/src/lib/brand.ts` |
| Design tokens CSS | `lib/design-tokens/northstar-theme.css` |
| Design tokens TS | `lib/design-tokens/tokens.ts` |
