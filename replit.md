# NorthStar — Career orientation SaaS for Italian users (RIASEC test + AI career tools)

## Run & Operate

| Service | Command | Port |
|---------|---------|------|
| Frontend (Vite) | `PORT=5000 pnpm --filter @workspace/orientamento run dev` | 5000 (preview) |
| API Server (Express) | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| Python AI (FastAPI) | `cd artifacts/ai-agents && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000` | 8000 |

**DB migrations:** `pnpm --filter @workspace/db exec drizzle-kit push`  
**Build all:** `pnpm run build`  
**Typecheck:** `pnpm run typecheck`

**Required env vars:** `DATABASE_URL`, `ADMIN_KEY`, `AI_AGENTS_URL`  
**Optional:** `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GNEWS_API_KEY`, `TAVILY_API_KEY`, `RESEND_API_KEY`, `VAPID_*`, `GOOGLE_CLIENT_ID`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Radix UI, Wouter, TanStack React Query, Recharts, Framer Motion, i18next
- **Backend:** Express 5, TypeScript, Drizzle ORM, Pino logging, esbuild (custom build.mjs)
- **AI Microservice:** Python 3.11, FastAPI, LangChain, LangGraph, Uvicorn
- **Database:** PostgreSQL (Replit managed), Drizzle ORM
- **Auth:** Custom JWT (bcryptjs + persistent JWT_SECRET)
- **Package manager:** pnpm workspaces (monorepo)

## Where things live

```
artifacts/
  orientamento/      # React/Vite frontend (port 5000)
  api-server/        # Express API (port 8080)
    src/routes/      # 40+ route files
    src/lib/         # seed, email, auth-jwt, schedulers...
    build.mjs        # esbuild bundler
  ai-agents/         # Python FastAPI AI microservice (port 8000)
lib/
  db/                # Drizzle schema + migrations
    src/schema/      # DB schema (source of truth)
    drizzle/         # SQL migration files
  api-spec/          # OpenAPI spec + Orval codegen config
  api-zod/           # Generated Zod schemas
  api-client-react/  # Generated TanStack React Query hooks
  integrations-openai-ai-server/  # OpenAI server-side utils
```

## Architecture decisions

- **OpenAPI-first:** `lib/api-spec/openapi.yaml` → Orval generates Zod schemas + typed React Query hooks
- **Monorepo workspaces:** pnpm with catalog for shared dependency versions
- **esbuild bundler:** Custom `build.mjs` bundles the Express server; excludes native modules (satori, resvg-js, nodemailer, etc.)
- **AI proxy pattern:** Express proxies AI-heavy requests to Python FastAPI on port 8000; Python uses LangGraph agents
- **Startup check:** Server validates all required env vars before binding to port; fails fast with clear messages
- **Replit AI Integration:** OpenAI accessed via `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit proxy)

## Product

- RIASEC + Five Spirits personality test (17 questions) → career sector matching
- 28 career sectors with match scores, roadmaps, salary data
- AI features (premium): Wiki AI chat, Roadmap generator, Skills Gap Analysis, Interview Simulator, Career Coach, Knowledge Graph with RAG
- News module (GNews or curated), Research Scheduler (Tavily)
- Admin dashboard with metrics, review queue, AI prompt management
- Email notifications (Resend), Web Push, Calendar reminders, Weekly digest
- Stripe subscription for premium tier
- **T001** Test session history: `GET /api/test-sessions/history` → TestHistoryCard in profilo
- **T002** Profile completion bar: `GET /api/completion/me` → ProfileCompletionCard (5 steps, % score)
- **T003** Objectives ↔ calendar: POST/DELETE objectives auto-sync calendarEventsTable
- **T004** Candidature Kanban drag-and-drop (HTML5 drag API, no lib dep)
- **T005** AI cover letter: `POST /api/cover-letter/generate` → CoverLetterDialog (Sparkles btn on AppCard)
- **T006** Streak + badge gamification: `streak_days`/`last_active_at` on users, 6 badges in profilo
- **T008** Onboarding banner: first-login checklist in UserDashboard (localStorage dismiss)

## User preferences

- Iterative development with detailed explanations
- Ask before major changes

## Gotchas

- Frontend MUST run on port 5000 for Replit webview preview
- API server runs on port 8080, Python AI on port 8000
- `startup-check.ts` will block server if `DATABASE_URL`, `ADMIN_KEY`, or `AI_AGENTS_URL` are missing
- esbuild externalizes many native packages (see `build.mjs` external list)
- pnpm workspace — always run from root or use `--filter` flag
- Growth research scheduler expects OpenAI to return valid JSON; may warn if model truncates output
- `completion/me` uses raw SQL for `streak_days`/`last_active_at` (schema pushed, Drizzle types auto-refreshed)
- Existing tsc errors (api-client-react unbuilt dist, any-typed params in ruolo/sector etc.) are pre-existing, not introduced by T001-T008
- **Route ordering rule:** `notificationsRouter` and `pushRouter` apply `router.use(authMiddleware)` at root (no path). Any admin route using only `x-admin-key` (no JWT) MUST be registered in `routes/index.ts` BEFORE `calendarRouter` (line ~78), or it will receive 401 from those routers' global auth middleware.

## Pointers

- DB schema: `lib/db/src/schema/index.ts`
- API routes: `artifacts/api-server/src/routes/index.ts`
- Frontend routes: `artifacts/orientamento/src/App.tsx` or router file
- OpenAI integration docs: `.local/skills/integrations/SKILL.md`
