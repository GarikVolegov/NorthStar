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

## Roadmap (Future Phases)

- **Phase 2:** Fix Stripe key + seed products, activate premium checkout
- **Phase 3:** LLM Wiki with spirit pages (one page per spirit with exercises, sector advice)
- **Phase 4:** Knowledge graph (Neo4j) — spirit/sector/role relationships
- **Phase 5:** AI chat coach, personalized growth plans
- **Phase 6:** B2B (schools, enterprises)
