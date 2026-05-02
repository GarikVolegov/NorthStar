# Orientamento — SaaS di Orientamento e Crescita Personale

## Overview

A freemium SaaS platform that helps Italian users discover their ideal career path through a RIASEC-based personality test. The system understands who you are, shows compatible opportunities with real data, and lets you confirm your own direction.

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
```

### Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Wouter (routing), TanStack React Query, Recharts, Lucide icons, Radix UI
- **Backend:** Express 5, TypeScript, Pino logging
- **Database:** PostgreSQL via Drizzle ORM
- **API:** OpenAPI-first, codegen via Orval

## Database Schema

- **sectors** — Career sectors with RIASEC types, salary ranges, growth rates, pros/cons
- **test_sessions** — User test answers, RIASEC scores, recommendations, confirmed sector
- **users** — Registered users linked to test sessions

## Key Features (MVP)

1. **Landing page** — Hero section with animated stats, how-it-works flow
2. **RIASEC Personality Test** — 12-question step-by-step wizard (q1–q12 mapped to R/I/A/S/E/C)
3. **Results page** — Personality profile + top 3 sector recommendations with match scores, salary data, growth trends
4. **Sector detail page** — Full deep-dive with tabs: overview, skills, data/trend charts (Recharts)
5. **Registration page** — Save test results, link session to user account

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/sectors` — List all sectors
- `GET /api/sectors/:id` — Get sector detail
- `GET /api/sectors/:id/stats` — Sector statistics
- `GET /api/stats/summary` — Platform statistics summary
- `POST /api/test-sessions` — Submit test answers → get recommendations
- `GET /api/test-sessions/:id` — Get test session with recommendations
- `POST /api/test-sessions/:id/confirm` — Confirm a sector choice
- `POST /api/users` — Register user (saves test session)

## RIASEC Matching Algorithm

- 12 questions map to 6 RIASEC types (2 questions per type)
- Scores computed per type (1–5 scale per answer, max 10 per type)
- Sector match score = weighted overlap between user profile and sector's RIASEC types (clamped 55–99%)
- Top 3 sectors by match score shown as recommendations

## Seeded Data

6 pre-seeded sectors on startup (if DB is empty):
1. Tecnologia & Software (I/R/C) — booming
2. Salute & Benessere (S/I/R) — growing
3. Creatività & Design (A/E/I) — growing
4. Business & Imprenditoria (E/C/S) — growing
5. Educazione & Formazione (S/A/E) — growing
6. Finanza & Investimenti (C/E/I) — stable

## Development Notes

- The `lib/api-zod/src/index.ts` barrel must only export from `./generated/api` (orval generates a bad barrel with extra exports that need to be removed)
- The `lib/api-spec/orval.config.ts` has the `schemas` option removed to avoid naming conflicts
- CORS is enabled on the API server for local development
- DB is seeded via `artifacts/api-server/src/lib/seed.ts` called at server startup

## Roadmap (Future Phases)

- **Phase 2:** Premium dashboard, Stripe payments
- **Phase 3:** LLM Wiki (personalized knowledge base), semantic graph (Neo4j)
- **Phase 4:** AI chat, coaching integration
- **Phase 5:** B2B expansion (schools, enterprises)
