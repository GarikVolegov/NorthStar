# NorthStar 🧭

> **Career orientation SaaS for Italian users** — RIASEC test + AI-powered career tools

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Tailwind v4, Radix UI, TanStack Query, Framer Motion |
| Backend | Express 5, TypeScript, Drizzle ORM, Pino logging |
| AI Microservice | Python 3.11, FastAPI, LangChain, LangGraph |
| Database | PostgreSQL (Drizzle ORM) |
| Auth | Custom JWT (bcryptjs + HS256) |
| Monorepo | pnpm workspaces + catalog |
| E2E Tests | Playwright (chromium) |

## Quick Start

```bash
cp .env.example .env
# Fill in: DATABASE_URL, ADMIN_KEY, AI_AGENTS_URL, JWT_SECRET (required)

pnpm install
pnpm --filter @workspace/db exec drizzle-kit push
```

Then start **three separate terminals**:

```bash
# Terminal 1 — Frontend (port 5000)
PORT=5000 pnpm --filter @workspace/orientamento run dev

# Terminal 2 — API Server (port 8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 3 — Python AI Microservice (port 8000)
cd artifacts/ai-agents && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Architecture

OpenAPI-first monorepo. The source of truth flows in one direction:

```
DB Schema → OpenAPI spec → Zod schemas + React Query hooks → UI
```

Never write API calls by hand in the frontend. Always update `lib/api-spec/openapi.yaml` first, then run `pnpm orval` to regenerate typed hooks.

## Where Things Live

```
artifacts/
  orientamento/      # React/Vite frontend (port 5000)
  api-server/        # Express API (port 8080)
    src/routes/      # 40+ route files
    src/lib/         # seed, email, auth-jwt, schedulers, startup-check
    build.mjs        # custom esbuild bundler
  ai-agents/         # Python FastAPI AI microservice (port 8000)
lib/
  db/                # Drizzle schema + migrations (source of truth)
  api-spec/          # openapi.yaml — update this first for any new endpoint
  api-zod/           # auto-generated Zod schemas
  api-client-react/  # auto-generated TanStack React Query hooks
e2e/                 # Playwright E2E test specs
```

## Feature Development Flow

Follow this order for every new feature — no shortcuts:

1. `lib/db/src/schema/` → add/update schema, then `drizzle-kit push`
2. `lib/api-spec/openapi.yaml` → define the endpoint contract
3. Run `pnpm orval` → regenerates Zod + React Query hooks
4. `artifacts/api-server/src/routes/` → implement the route
5. `artifacts/orientamento/src/` → build the UI using generated hooks
6. `e2e/` → write at least one Playwright happy-path test

## Useful Commands

```bash
pnpm run build          # build all packages
pnpm run typecheck      # TypeScript check across all workspaces
pnpm test:e2e           # Playwright E2E (requires all 3 services running)
pnpm --filter @workspace/db exec drizzle-kit push   # apply DB migrations
```

## PR Checklist

Before every commit/PR, verify:

- [ ] `pnpm run typecheck` → zero **new** errors introduced
- [ ] New env vars added to `startup-check.ts` under `REQUIRED` or `OPTIONAL`
- [ ] Admin-key-only routes registered **before** `calendarRouter` in `routes/index.ts`
- [ ] No `any` types introduced in route handlers
- [ ] `openapi.yaml` updated if you added or removed endpoints
- [ ] At least one E2E test covers the new happy path

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_KEY` | Secret key for `/admin/*` routes |
| `AI_AGENTS_URL` | Python AI service URL (e.g. `http://localhost:8000`) |
| `JWT_SECRET` | Min 32-char secret for signing JWT tokens |

All other variables are optional — the server logs which features are disabled at startup.

## Known Gotchas

- **Ports are fixed:** Frontend=5000 (Replit preview), API=8080, Python AI=8000
- **Route ordering:** Admin-key-only routes MUST be registered before `calendarRouter`/`notificationsRouter`/`pushRouter` in `routes/index.ts` — those routers apply JWT auth middleware at root level
- **pnpm workspace:** Always run commands from repo root or use `--filter`
- **esbuild:** Many native packages are externalized in `build.mjs` — do not import them via bundled paths
- **Playwright cache:** `PLAYWRIGHT_BROWSERS_PATH` defaults to `.cache/ms-playwright`; set `BASE_URL`/`API_URL` env vars when testing against staging
- **`completion/me`:** Uses raw SQL for `streak_days`/`last_active_at` — Drizzle types are auto-refreshed after schema push

## Key Pointers

- DB schema: `lib/db/src/schema/index.ts`
- API route registration: `artifacts/api-server/src/routes/index.ts`
- Frontend routes: `artifacts/orientamento/src/App.tsx`
- Startup env check: `artifacts/api-server/src/lib/startup-check.ts`
