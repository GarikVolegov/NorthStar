# Orientamento — SaaS di Orientamento e Crescita Personale

## Overview

A freemium SaaS platform that helps Italian users discover their ideal career path through a RIASEC-based personality test combined with the Five Spirits (Cinque Spiriti) inner compass. The system understands who you are externally (skills/interests) and internally (energy/will/vision), then shows compatible career sectors with real data.

## Architecture

### Monorepo Structure (pnpm workspace)

```
artifacts/
  api-server/       — Express 5 API backend (port 8080)
  orientamento/     — React + Vite frontend (served at /)
  ai-agents/        — Python FastAPI + LangChain/LangGraph microservice (port 8000)
  mockup-sandbox/   — UI component prototyping (internal)
lib/
  api-spec/         — OpenAPI spec + Orval codegen config
  api-client-react/ — Generated React Query hooks
  api-zod/          — Generated Zod validation schemas
  db/               — Drizzle ORM + PostgreSQL schema
scripts/
  src/seed-products.ts — Stripe product seeding script
```

### Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Wouter (routing), TanStack React Query, Recharts, Lucide icons, Radix UI
- **Backend:** Express 5, TypeScript, Pino logging
- **AI Microservice:** Python FastAPI + LangChain + LangGraph (port 8000)
- **Database:** PostgreSQL via Drizzle ORM
- **Payments:** Stripe (direct API keys via secrets STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY)
- **API:** OpenAPI-first, codegen via Orval
- **LLM:** OpenAI via Replit AI Integrations proxy (AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY)

## Database Schema

- **sectors** — Career sectors with RIASEC types, salary ranges, growth rates, pros/cons
- **professions** — Roles/professions with sectorId FK, description, skills, work modes, salary, growth, autonomyScore, stabilityScore
- **education_paths** — Education paths (university, bootcamp, online, professional)
- **profession_education_paths** — Join table linking professions ↔ education paths
- **test_sessions** — User test answers, RIASEC scores, spirit scores, recommendations, confirmed sector
- **users** — Registered users linked to test sessions (with stripeCustomerId, stripeSubscriptionId)
- **user_objectives** — Career goals per user: text, category (formazione/certificazione/networking/esperienza/altro), progress 0–100, dueDate, completed, completedAt
- **user_favorites** — Saved sectors and articles per user

## Key Features (MVP)

1. **Landing page** — Hero section with animated stats, how-it-works flow
2. **17-question Test** — 12 RIASEC + 5 Cinque Spiriti (with transition screen "Bussola Interiore")
3. **Results page** — RIASEC profile + Bussola Interiore panel (spirit bars + insight) + top 3 sector recommendations with match scores
4. **Sector detail page** — Full deep-dive with tabs: overview, skills, data/trend charts (Recharts)
5. **Registration page** — Save test results, link session to user account
6. **Premium page** — Subscription plans loaded from Stripe, checkout flow

## Five Spirits (Cinque Spiriti) System

Added as a second layer of personality analysis after RIASEC:

| Spirit | Key | Focus |
|--------|-----|-------|
| ✨ Shen | `shen` | Coscienza, presenza, chiarezza emotiva |
| 🌙 Hun  | `hun`  | Visione, immaginazione, direzione futura |
| ⚡ Po   | `po`   | Istinto, energia corporea, percezione immediata |
| 🔮 Yi   | `yi`   | Concentrazione, logica, memoria, analisi |
| 🔥 Zhi  | `zhi`  | Volontà, resilienza, portare a termine |

**Scoring logic:**
- 5 answers (1–5 scale), stored as `spiritScores: Record<string,number>` on test_session
- `dominantSpirit` = highest score spirit
- Spirit boosts (0–5 pts) are added to the RIASEC match score for sector alignment
- Sector-spirit weights defined in `artifacts/api-server/src/lib/spirits.ts`

**UX flow:**
1. 12 RIASEC questions → transition screen introducing the Cinque Spiriti → 5 spirit questions → completion → submit
2. Results page shows: RIASEC profile header + "Bussola Interiore" panel + top 3 sectors

## AI Microservice (artifacts/ai-agents)

Python FastAPI + LangChain + LangGraph running on port 8000. Proxied via Express at `/api/ai-agents/*`.

### Python Agents (LangChain structured output, all in Italian)

| Agent | Task Type | Model |
|-------|-----------|-------|
| `PersonalityInsightAgent` | `personality_insight` | gpt-4.1-mini (free) / gpt-5.4 (premium) |
| `SectorMotivationAgent` | `sector_motivation` | gpt-4.1-mini |
| `WorkModeAdvisorAgent` | `work_mode_advice` | gpt-4.1-mini (free) / gpt-5.4 (premium) |
| `AffiliationMaterialsAgent` | `affiliation_materials` | gpt-4.1-mini |
| `CareerChatAgent` | via `/chat` | gpt-4.1-mini (free) / gpt-5.4 (premium) |

### Express Proxy Routes (require JWT auth)

- `POST /api/ai-agents/run` — Run an AI agent task
- `POST /api/ai-agents/chat` — Conversational career Q&A
- `GET /api/ai-agents/health` — Proxy health (no auth)

### LangGraph Orchestration

`artifacts/ai-agents/agents/orchestrator.py` — StateGraph with conditional routing: routes by `task_type` to the appropriate LangChain agent, or returns error for unknown tasks.

### Frontend Hooks (artifacts/orientamento/src/hooks/useAIAgents.ts)

- `usePersonalityInsight()` — TanStack Query hook for AI personality narrative
- `useSectorMotivation()` — AI-generated sector motivations
- `useWorkModeAdvice()` — Premium AI work mode advice
- `useCareerChat()` — useMutation for conversational chat

### Frontend Components (artifacts/orientamento/src/components/ai/)

- `PersonalityInsightCard` — Shows AI narrative, headline, unique value, shadow, growth path
- `CareerChat` — Chat widget with starter questions and full conversation history

### Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy base URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy API key (auto-set)
- `AI_AGENTS_URL` — Internal Python service URL (default: `http://localhost:8000`)

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/sectors` — List all sectors
- `GET /api/sectors/:id` — Get sector detail
- `GET /api/sectors/:id/stats` — Sector statistics
- `GET /api/sectors/:id/roles` — List roles (professions) for a sector
- `GET /api/roles/:id` — Role detail with linked education paths
- `GET /api/stats/summary` — Platform statistics summary
- `POST /api/test-sessions` — Submit test answers (RIASEC + spirits) → get recommendations
- `GET /api/test-sessions/:id` — Get test session with recommendations + spirit data
- `POST /api/test-sessions/:id/confirm` — Confirm a sector choice
- `POST /api/users` — Register user (saves test session)
- `GET /api/stripe/products` — List active products with prices from Stripe
- `POST /api/stripe/checkout` — Create Stripe checkout session
- `GET /api/stripe/subscription/:userId` — Check user subscription status
- `POST /api/stripe/portal` — Create Stripe billing portal session

## RIASEC + Spirit Matching Algorithm

- 12 RIASEC questions → scores per type (R/I/A/S/E/C, max 10 each)
- 5 Spirit questions → scores per spirit (1–5 scale)
- Sector match score = RIASEC overlap (55–99%) + spirit boost (0–5 pts), capped at 99%
- Top 3 sectors by match score shown as recommendations

## Seeded Data

6 pre-seeded sectors on startup (if DB is empty):
1. Tecnologia & Software (I/R/C)
2. Salute & Benessere (S/I/R)
3. Creatività & Design (A/E/I)
4. Business & Imprenditoria (E/C/S)
5. Educazione & Formazione (S/A/E)
6. Finanza & Investimenti (C/E/I)

## Stripe Configuration

- Uses direct API keys from Replit Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- **NOTE:** Stripe integration was not connected via Replit OAuth — using env secrets instead
- To seed products in Stripe: `pnpm --filter @workspace/scripts exec tsx src/seed-products.ts`
  - Requires a valid `STRIPE_SECRET_KEY` secret
  - Creates "Orientamento Premium" product with €9/mese and €90/anno prices
- Webhook secret (optional): `STRIPE_WEBHOOK_SECRET`

## Development Notes

- The `lib/api-zod/src/index.ts` barrel must only export from `./generated/api`
- The `lib/db` package uses `tsc -b` to rebuild declarations after schema changes
- CORS is enabled on the API server for local development
- DB is seeded via `artifacts/api-server/src/lib/seed.ts` called at server startup
- Spirit weights per sector are in `artifacts/api-server/src/lib/spirits.ts` — modify to tune recommendations

## News Module

### Endpoints
- `GET /api/news?category=technology&limit=6` — Free news per categoria
- `GET /api/news?multi=true&categories=general,technology,business&perCategory=2` — Feed misto
- `GET /api/news/sector/:sector&limit=8` — News premium per settore

### Categorie Free
general, business, technology, science, health, finance, education

### Settori Premium
ai, data-science, cybersecurity, fintech, green-energy, healthcare, e-commerce, marketing, robotica, turismo, educazione, finanza

### Fonte dati
- Se `GNEWS_API_KEY` è presente: fetcha live da GNews API (italiano, `lang=it`)
- Se assente: mostra contenuto editoriale statico (7 articoli curati in italiano)
- Cache in-memory da 30 minuti per ridurre le chiamate API

### Per attivare news live
1. Registrarsi su https://gnews.io (piano free: 100 req/giorno)
2. Aggiungere il secret `GNEWS_API_KEY` nelle variabili d'ambiente Replit

### Frontend — `/news`
- Tab per categoria con emoji
- Card con titolo, descrizione, fonte, ora relativa, link esterno
- Sezione Premium bloccata con CTA verso `/premium`
- Skeleton loading durante il fetch

## Premium Features (AI-powered)

Built using Replit AI Integrations (OpenAI, no API key needed). Accessible to all registered users.

### Wiki AI (`/wiki/:sectorId`)
- Full-screen chat interface with streaming AI responses
- System prompt: expert on the chosen sector in Italy
- Message history maintained client-side (last 10 messages sent as context)
- Suggested questions on empty state
- Auto-scrolling, inline markdown rendering (bold, lists, numbered lists)
- Model: `gpt-5.1`, max 1024 tokens

### Roadmap personalizzata multi-percorso (`/roadmap/:sectorId`)
- AI esplora 3-5 percorsi alternativi per entrare nel settore (Università, ITS, Bootcamp, Apprendistato, Autodidatta + certificazioni, Master, Formazione professionale)
- Ogni percorso include: tipo, durata, costo stimato, fitScore 0-100 personalizzato, fitReason che cita i dati dell'utente, "bestFor" (profilo ideale), pros[], cons[], 4-6 fasi con azioni/risorse/milestone
- Top-level: `userProfileSummary`, `recommendedPathId` + `recommendationReason`, `comparison`, `alternativeFormativePaths[]` (percorsi formativi laterali tipo lingua/soft skills/cert tecnica), `salaryProgression`, `topRoles`, `keyTip`
- Personalizzazione: route usa `optionalAuthMiddleware`, fetch user (workPreference, autonomyPreference, stabilityPreference, cvJson per età/istruzione) + testSession (RIASEC, primaryTypes, dominantSpirit, spiritScores, profileSummary, recommendations.matchScore per il settore)
- Streaming SSE, model `gpt-5.1`, `max_completion_tokens: 8192`
- Frontend: card selettore con fitScore colorato e badge "Consigliato per te", dettaglio percorso selezionato con pros/cons, fasi accordion, sezione "Confronto onesto" + "Percorsi formativi laterali"
- File: `artifacts/api-server/src/routes/roadmap.ts`, `artifacts/orientamento/src/pages/roadmap.tsx`

### Grafo della Conoscenza personale (`/grafo`) — Obsidian-like + RAG
- Personal, persistent knowledge graph per user (notes, skills, documents, roles, tools, certifications, concepts, links)
- DB-backed: `knowledge_nodes` (with `embedding` jsonb + `embedded_text`) + `knowledge_edges`
- Full SVG canvas: pan, wheel-zoom, drag nodes (positions persisted via debounced bulk PATCH `/api/knowledge/nodes/positions`)
- Side panel editor: title, type, URL (link/document), markdown content, edge list with delete
- Link mode: click-to-connect two nodes with optional edge label
- Search + type filter, auto-circle layout for unpositioned nodes
- **RAG (Retrieval-Augmented Generation)**: ogni nodo viene embeddato (`text-embedding-3-small`, 1536 dims) all'insert/update; route `POST /api/knowledge/ask` (SSE streaming) calcola similarità coseno tra domanda e nodi, prende top-K=6, espande con i vicini diretti tramite gli archi del grafo, e passa tutto a `gpt-5.1` con istruzione di rispondere SOLO dai nodi citando `[#id]`. Frontend: pannello chat laterale "Chiedi al grafo" con suggerimenti, citazioni cliccabili che focalizzano il nodo, indicatori di stato (embedding/retrieving/answering).
- Backfill: `POST /api/knowledge/embeddings/backfill` rigenera gli embedding mancanti; il route `/ask` fa anche backfill inline (max 30 per volta) se trova nodi senza embedding.
- Routes: `GET /api/knowledge/graph`, `POST/PATCH/DELETE /api/knowledge/nodes(/:id)`, `POST/DELETE /api/knowledge/edges(/:id)`, `POST /api/knowledge/ask`, `POST /api/knowledge/embeddings/backfill` — tutte auth-protected e user-scoped
- Schema: `lib/db/src/schema/knowledge.ts`; route: `artifacts/api-server/src/routes/knowledge.ts`; page: `artifacts/orientamento/src/pages/grafo-conoscenza.tsx`

### Grafo competenze settore (legacy, `/grafo/:sectorId`)
- AI-generated per-sector graph (still available): 5 roles, 7 skills, 5 tools, 4 certs
- In-memory server cache, SVG radial layout, model `gpt-5.1`

### Aggiornamenti
- Existing news page (`/news`) with sector-specific content

### Backend Routes
- `POST /api/wiki/:sectorId/ask` — streaming SSE chat
- `POST /api/roadmap/:sectorId/generate` — streaming SSE roadmap generation
- `GET /api/grafo/:sectorId` — sector graph data (cached, AI-generated)
- `GET /api/knowledge/graph` — personal knowledge graph nodes + edges (Obsidian-like)
- `POST/PATCH/DELETE /api/knowledge/nodes(/:id)`, `POST /api/knowledge/nodes/positions`, `POST/DELETE /api/knowledge/edges(/:id)`
- `POST /api/knowledge/ask` — RAG streaming SSE (embed query → cosine sim → top-K + neighbors → gpt-5.1 with citations)
- `POST /api/knowledge/embeddings/backfill` — regenerate missing embeddings for the user's nodes

### AI Integration Setup
- `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set via Replit
- Lib: `lib/integrations-openai-ai-server/` (copied from template)
- Package: `@workspace/integrations-openai-ai-server` added to api-server

## Sector Page Premium Panel

Added 3 card links directly on `/settore/:id` above the tabs:
- Wiki AI → `/wiki/:id` (indigo)
- Roadmap Dettagliata → `/roadmap/:id` (emerald)
- Grafo della Conoscenza personale → `/grafo` (violet) — note, competenze, documenti collegati per utente

## Bug Fixes

- `GET /api/sectors` and `GET /api/sectors/:id` now serialize `createdAt` as ISO string before Zod parsing (fixes ZodError "Expected string, received date")

## Auth Hardening (May 2026)

- **JWT_SECRET persistente**: `artifacts/api-server/src/lib/auth-jwt.ts` ora salva il secret in `artifacts/api-server/.local/.jwt-secret` (mode 0600) se `JWT_SECRET` env non è impostato. I token sopravvivono ai restart del server (prima ogni restart scollegava tutti gli utenti).
- **Codici di verifica sicuri**: sostituito `Math.random()` con `crypto.randomInt(100000, 1000000)`.
- **Email failure surfacing**: gli endpoint `/auth/register`, `/auth/login`, `/auth/resend-verification`, `/auth/forgot-password` ora restituiscono `emailSent: boolean` (e `emailError` in dev). Il frontend può avvisare l'utente quando l'email non parte.
- **`GET /api/auth/me`**: nuovo endpoint protetto da `authMiddleware` per validare il token al mount dell'app.
- **AuthContext con validazione mount**: al primo render, se c'è un token in localStorage, chiama `/auth/me` per validarlo. Se 401 → logout silenzioso (niente flash di "loggato" seguito da kick mid-session). Espone `authReady` per consumer che vogliono attendere.
- **api-fetch**: l'evento `northstar:auth-expired` ora scatta SOLO se la chiamata aveva effettivamente un token attaccato. 401 su endpoint pubblici non scollega più l'utente.
- **`safeUser` esteso**: include `emailVerified`, `stripeSubscriptionId`, `workPreference`, `autonomyPreference`, `stabilityPreference`, `timezone`. Allineato anche `auth-google.ts`.
- **Deliverability**: l'email `FROM` di default è `onboarding@resend.dev`. Resend free tier consente l'invio solo all'email del proprietario dell'account a meno che il dominio non sia verificato. Per produzione: impostare `EMAIL_FROM` con un dominio verificato su Resend.

## AI Orchestrator — Agent System

### Architecture
Multi-agent orchestration pipeline (`artifacts/api-server/src/agents/`):
- **OrchestratorAgent** (`orchestrator.ts`) — routes tasks, manages shared state, runs parallel agents
- **PersonalityAgent** — derives RIASEC primaryTypes from raw scores
- **SectorAgent** — matches sectors to RIASEC profile
- **ProfessionAgent** — free: 3 professions, premium: 6 (with skills, salary, growth outlook, RIASEC alignment)
- **NewsAgent** — relevant news from DB or curated sources
- **GrowthAgent** — personalized growth article suggestions
- **WorkModeAgent** — premium-only: recommended work mode (dipendente/autonomo/ibrido) with reasoning
- **EducationAgent** — premium-only: education paths (type, duration, cost, steps, career outcomes)
- **CalendarAgent** — premium-only: career calendar events
- **ValidatorAgent** — validates orchestrator output

### API
- `POST /api/agent` — authenticated, taskType: "full_profile" (main use case)
- `GET /api/agent/health` — agent status

### Frontend integration (Task #12)
- **`/risultati/:id`** — AI Analysis section auto-triggers when user is logged in; shows professions (with salary, skills, growth), work mode (premium), education paths (premium), premium upsell, "vai alla Dashboard AI" link
- **`/dashboard`** — dedicated AI dashboard page; fetches latest session, runs full_profile pipeline, shows all agent outputs with loading state; linked from results page and user dashboard
- **`UserDashboard` (home page)** — "Professioni consigliate per te" section appears after sector recommendations, with agent loading skeletons and premium upsell pill
- **`useAgentAnalysis` hook** (`artifacts/orientamento/src/hooks/useAgentAnalysis.ts`) — shared hook with 10-min staleTime and session-keyed cache

## Research Scheduler (Tavily AI Web Search)

Requires `TAVILY_API_KEY` env secret (now configured).

### Agents
- **`news-research.ts`** (`artifacts/api-server/src/agents/research/`) — searches Tavily for Italian career news every 6h; deduplicates by URL hash; stores in `news_articles` table
- **`growth-research.ts`** — searches Tavily for career growth topics every 24h; generates full articles via LLM from web context; stores in `growth_articles` table; deduplicates by slug

### Scheduler
- `artifacts/api-server/src/lib/research-scheduler.ts` — starts 90s after server boot, then ticks every 30 min; checks if news (6h) or growth (24h) interval elapsed; disabled automatically if TAVILY_API_KEY is missing

### Database
- `news_articles` table — title, url, url_hash (unique), source, summary, publishedAt, sectorNames[], category, relevanceScore, searchQuery, createdAt

### Admin API
- `POST /admin/research/news/run` — manually trigger news research (with optional sectorNames[])
- `POST /admin/research/growth/run` — manually trigger growth article generation
- `GET /research/news` — list persisted news articles (supports ?sector= and ?limit= params)

### Tavily client
- `artifacts/api-server/src/lib/tavily.ts` — search wrapper with URL normalization and lightweight URL hashing for deduplication

## Admin Review Dashboard

Backoffice at `/admin/review` for reviewing AI agent outputs before publication. Uses the same `ADMIN_KEY` + `x-admin-key` header auth as other admin pages.

### Database Tables
- `agent_runs` — tracks agent execution (name, input/output summary, duration, errors)
- `agent_suggestions` — entity proposals with confidence scores, status flow: draft → pending_review → approved/rejected → archived
- `review_queue` — human review workflow with priority levels (high/normal/low)
- `audit_logs` — tracks all admin actions (approve/reject/edit/archive) with metadata

### API Endpoints (all require `x-admin-key` header)
- `GET /api/admin/stats` — dashboard statistics (pending/approved/rejected/archived counts)
- `GET /api/admin/queue` — review queue with status/priority/entity_type filters
- `GET /api/admin/suggestions` — all suggestions with status/entity_type/search filters + pagination
- `GET /api/admin/suggestions/:id` — detail view with linked agent run and queue item
- `POST /api/admin/suggestions/:id/approve` — approve suggestion
- `POST /api/admin/suggestions/:id/reject` — reject with optional notes
- `PATCH /api/admin/suggestions/:id` — edit suggestion fields (entityName, payloadJson, notes, confidenceScore)
- `POST /api/admin/suggestions/:id/archive` — archive suggestion
- `GET /api/admin/agent-runs` — agent execution logs with agent name filter
- `GET /api/admin/logs` — audit trail with action filter

### Frontend (`/admin/review`)
- Sidebar navigation: Queue, Suggestions, Agent Runs, Audit Log, Settings
- Stats panel: pending/approved/rejected/runs counts
- List/detail split view with filters (status, entity type, search)
- Approve/Reject/Archive actions with rejection notes
- Confidence score badges, entity type badges, status badges
- Schema: `lib/db/src/schema/agentReview.ts`
- Route: `artifacts/api-server/src/routes/admin-review.ts`
- Page: `artifacts/orientamento/src/pages/admin-review.tsx`

## Performance & Reliability (May 2026)

### Lazy Loading + Code Splitting
- All 35+ pages converted to `React.lazy()` + `Suspense` with `<PageLoader />` fallback
- Vite manual chunks: `vendor-react`, `vendor-ui`, `vendor-radix`, `vendor-charts`, `vendor-query`, `vendor-motion`, `vendor-forms`
- `PageLoader` component: `artifacts/orientamento/src/components/PageLoader.tsx`

### Error Boundaries
- `ErrorBoundary` class component wraps all routes (public and admin)
- Shows a localized Italian fallback UI with Retry + Home buttons on any render crash
- File: `artifacts/orientamento/src/components/ErrorBoundary.tsx`

### TanStack Query — Retry Logic
- `QueryClient` configured with exponential backoff retry (max 2 retries, up to 10s delay)
- Skips retry on 401/403/404 responses
- Default `staleTime: 30s`

### Workflow Configuration
- Frontend: `PORT=8081 BASE_PATH=/ pnpm --filter @workspace/orientamento run dev`
- API Server: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- DB migration: `cd lib/db && pnpm exec drizzle-kit migrate`

### OpenAI Integration Fix
- `lib/integrations-openai-ai-server/src/image/client.ts` refactored to lazy-initialize — server no longer crashes at startup when `AI_INTEGRATIONS_OPENAI_BASE_URL` is not set

## Fase 2 — PWA, Skeleton Screens, Form Validation (May 2026)

### PWA (Progressive Web App)
- `vite-plugin-pwa` installato e configurato in `vite.config.ts`
- Manifest: nome, short_name, theme_color `#4f46e5`, display `standalone`, lingua `it`
- Workbox: precache di JS/CSS/HTML/SVG/PNG/woff2 + runtime cache per `/api/sectors` e `/api/stats` (StaleWhileRevalidate, 1h TTL)
- L'app è ora installabile come PWA su mobile e desktop

### Skeleton Screens condivisi
- `artifacts/orientamento/src/components/skeletons/NewsCardSkeleton.tsx` — skeleton card notizie + `NewsGridSkeleton`
- `artifacts/orientamento/src/components/skeletons/SectorCardSkeleton.tsx` — skeleton card settore + `SectorGridSkeleton`
- `artifacts/orientamento/src/components/skeletons/ResultsSkeleton.tsx` — skeleton pagina risultati completa (header, RIASEC bars, Bussola Interiore, top 3 settori)
- `pages/results.tsx`: loading state sostituito con `<ResultsSkeleton />`
- `pages/news.tsx`: skeleton inline rimosso, usa `<NewsGridSkeleton count={6} />`

### React Hook Form + Zod — Form validation
Migrati 3 form da stato manuale a RHF + Zod con validazione inline:
- **`register.tsx`**: schema `name` (min 2) + `email` (valida), errori inline, `noValidate`
- **`contatti.tsx`**: schema completo con `name`, `email`, `subject` (Controller), `message` (min 10, max 1000, contatore caratteri live), sidebar ricostruita, `noValidate`
- **`profilo.tsx` — ChangePasswordForm**: schema `oldPassword` + `newPassword` (min 6) + `confirm` con `.refine()` cross-field, reset automatico al successo

## Fase 3 — Testing, SEO, Mobile UX (May 2026)

### Vitest — Test unitari
- Configurazione standalone in `artifacts/orientamento/vitest.config.ts` (separata da vite.config.ts che richiede PORT a runtime)
- Setup file: `src/__tests__/setup.ts` con `@testing-library/jest-dom`
- **31 test passati** in 3 suite:
  - `work-mode-utils.test.ts` — 14 test per `getWorkModeAlignment` (null/undefined/unknown, ibrido, dipendente, autonomo)
  - `motion.test.ts` — 11 test per costanti springs/durations/easings e variants Framer Motion
  - `seo.test.ts` — 6 test per `buildSectorMeta` (type, path, OG image, JSON-LD, salary, noIndex)
- Script aggiunti a `package.json`: `test`, `test:watch`, `test:ui`, `test:coverage`

### SEO — index.html migliorato
Aggiunti tag statici mancanti per crawlers e social previews:
- `og:url`, `og:image` (opengraph.jpg 1200×630), `og:image:alt/width/height`
- `twitter:image`, `twitter:image:alt`
- PWA mobile: `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-*`, `apple-touch-icon`

### DB — Fix migrazione professions
- Colonne mancanti (`sector_id`, `description`, `autonomy_score`, `stability_score`) aggiunte con migrazione `0007_add_professions_columns.sql`
- Seed ora completa senza errori: `Sectors, professions and education paths seeded successfully`

## Roadmap (Future Phases)

- **Phase 4:** Stripe key + seed prodotti, attivazione checkout premium
- **Phase 5:** B2B (schools, enterprises)
