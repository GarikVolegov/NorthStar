# Orientamento — SaaS di Orientamento e Crescita Personale

## Overview

A freemium SaaS platform that helps Italian users discover their ideal career path through a RIASEC-based personality test combined with the Five Spirits (Cinque Spiriti) inner compass. The system understands who you are externally (skills/interests) and internally (energy/will/vision), then shows compatible career sectors with real data.

## Architecture

### Monorepo Structure (pnpm workspace)

```
artifacts/
  api-server/       — Express 5 API backend
  orientamento/     — React + Vite frontend (served at /)
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
- **Database:** PostgreSQL via Drizzle ORM
- **Payments:** Stripe (direct API keys via secrets STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY)
- **API:** OpenAPI-first, codegen via Orval

## Database Schema

- **sectors** — Career sectors with RIASEC types, salary ranges, growth rates, pros/cons
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

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/sectors` — List all sectors
- `GET /api/sectors/:id` — Get sector detail
- `GET /api/sectors/:id/stats` — Sector statistics
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

### Roadmap Dettagliata (`/roadmap/:sectorId`)
- AI-generated step-by-step career plan via streaming
- JSON output parsed: phases (emoji, title, duration, actions, resources, milestone)
- Progress bar during generation (~20-30 seconds)
- Accordion-style phase cards (expandable)
- Salary progression table, top roles, key tip
- Model: `gpt-5.1`, max 2048 tokens

### Grafo della Conoscenza (`/grafo/:sectorId`)
- AI-generated knowledge graph: 5 roles, 7 skills, 5 tools, 4 certifications (21 nodes)
- In-memory server-side cache per sectorId (persists until server restart)
- SVG radial layout: roles (r=140), skills (r=255), tools+certs (r=360)
- Hover tooltip: node description + connection count
- Connected nodes highlighted on hover, inactive nodes dimmed
- Color-coded by type: indigo (role), emerald (skill), amber (tool), violet (cert)
- Model: `gpt-5.1`, max 2048 tokens

### Aggiornamenti
- Existing news page (`/news`) with sector-specific content

### Backend Routes
- `POST /api/wiki/:sectorId/ask` — streaming SSE chat
- `POST /api/roadmap/:sectorId/generate` — streaming SSE roadmap generation
- `GET /api/grafo/:sectorId` — graph data (cached)

### AI Integration Setup
- `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set via Replit
- Lib: `lib/integrations-openai-ai-server/` (copied from template)
- Package: `@workspace/integrations-openai-ai-server` added to api-server

## Sector Page Premium Panel

Added 3 card links directly on `/settore/:id` above the tabs:
- Wiki AI → `/wiki/:id` (indigo)
- Roadmap Dettagliata → `/roadmap/:id` (emerald)
- Grafo della Conoscenza → `/grafo/:id` (violet)

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

## Roadmap (Future Phases)

- **Phase 2:** Fix Stripe key + seed products, activate premium checkout
- **Phase 5:** B2B (schools, enterprises)
