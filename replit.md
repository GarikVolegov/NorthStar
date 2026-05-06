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
**E2E tests:** `pnpm test:e2e` (Playwright, requires services running)

**Required env vars:** `DATABASE_URL`, `ADMIN_KEY`, `AI_AGENTS_URL`  
**Optional:** `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GNEWS_API_KEY`, `TAVILY_API_KEY`, `RESEND_API_KEY`, `VAPID_*`, `GOOGLE_CLIENT_ID`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Radix UI, Wouter, TanStack React Query, Recharts, Framer Motion, i18next
- **Backend:** Express 5, TypeScript, Drizzle ORM, Pino logging, esbuild (custom build.mjs)
- **AI Microservice:** Python 3.11, FastAPI, LangChain, LangGraph, Uvicorn
- **Database:** PostgreSQL (Replit managed), Drizzle ORM
- **Auth:** Custom JWT (bcryptjs + persistent JWT_SECRET)
- **Package manager:** pnpm workspaces (monorepo)
- **E2E:** Playwright (chromium), tests in `e2e/`

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
e2e/                 # Playwright E2E test specs
playwright.config.ts # Playwright config (baseURL port 5000, API port 8080)
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
- **P3** Admin Catalogs CRUD: `GET/POST/PATCH/DELETE /api/admin/catalogs/{sectors|professions|education-paths|growth-articles}` → `admin-cataloghi.tsx` (tabbed UI)
- **P4** Agent Health Dashboard: `GET /api/admin/agent-health` → `admin-agenti.tsx` (success rate, latency, errors per agent)
- **P5** Setup Wizard: `admin-status.tsx` per-integration guide cards (Stripe, GNews, Tavily, Resend, Push, Google OAuth)
- **P6** Career Climber Mode: `user_mode` col on users, `PATCH /api/profile/:id/mode`, `UserModeCard` in profilo, `ClimberToolsSection` in dashboard
- **P7** Post-test Funnel: `PostTestWizard.tsx` overlay (3 steps: work-mode → objectives → calendar) triggered from results page
- **P8** E2E Playwright: `e2e/auth.spec.ts`, `e2e/test-riasec.spec.ts`, `e2e/admin.spec.ts`, `e2e/objectives.spec.ts`; `pnpm test:e2e`
- **P9** Growth Queue: `GET/POST /api/admin/growth-queue` + approve/reject/delete → `admin-crescita.tsx`
- **P10** Admin Discovery vs Execution: `admin-home.tsx` — visual map of all admin sections
- **P11** Business Idea Validator: `POST /api/business-ideas` → async AI validation → `GET /api/business-ideas/:id`; `POST /api/business-ideas/:id/find-incubators` → incubator/grant report. DB: `business_ideas` table. Python agents: `business_validator.py` (score 0-10, 12 structured fields) + `incubator_finder.py` (5-7 Italian/EU funding opportunities + pitch + canvas). Frontend: `/validatore-idea` (split-pane: sidebar list + detail view with tabs Validazione / Incubatori). Accessible from navbar user dropdown → "Validatore Idea".

## UI/UX System — Dark Brand (martes-ai inspired)

- **Theme:** Dark-first. Background `hsl(0 0% 5%)` ≈ `#0d0d0d`, foreground `hsl(0 0% 96%)`.
- **Primary accent:** Vibrant green `hsl(142 69% 58%)` ≈ `#4ade80` (like martes-ai lime-green). Used for CTAs, active nav, highlights.
- **Brand tokens file:** `src/lib/brand.ts` — canonical color hex values + typography + radius + shadows.
- **CSS variables:** `src/index.css` — all Tailwind theme vars mapped; `--brand` = green; `--glow-primary` for glow effects; `.glass`, `.pill-nav`, `.glow-primary`, `.text-display`, `.text-italic-serif`, `.text-label` utility classes.
- **Logo:** `/public/logo.svg` (North Star + compass SVG — 4-pointed Polaris star with compass ring + N cardinal marker) + `/public/favicon.svg` (same mark, 64×64).
- **Navbar:** Fixed floating pill (`pill-nav` class), centered links in UPPERCASE, green pill CTA, language switcher, user dropdown. Adds `<div class="h-20" />` spacer.
- **Typography:** Inter (sans, bold display) + Playfair Display italic serif for accent words in hero headings.
- **Fonts loaded in:** `index.html` Google Fonts (`Inter` + `Playfair Display:ital,wght@0,700;1,400;1,700`).
- **Skeleton variants:** `skeleton.tsx` supports `variant="card|avatar|badge|text"` + `lines` prop (backward compat)
- **MatchBadge:** `components/ui/match-badge.tsx` — reusable score badge
- **Chart theme:** `lib/chart-theme.ts` — `CHART_COLORS` + `CHART_DEFAULTS`
- **SSE hook:** `hooks/useSSEStream.ts` + `components/ui/streaming-indicator.tsx`
- **Dashboard Hub:** "I tuoi strumenti" section in `dashboard.tsx` + Climber section (when userMode=climber)
- **Results page:** Hero layout — top sector as full-width card with animated match badge; PostTestWizard overlay on `?onboarding=1`
- **Design rule:** Never use light backgrounds (`bg-white`, `bg-gray-*`) — use `bg-background`, `bg-card`, `bg-muted` or Tailwind dark-safe classes only.

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
- Existing tsc errors (api-client-react unbuilt dist, any-typed params in ruolo/sector etc.) are pre-existing, not introduced by new features
- **Route ordering rule:** `notificationsRouter` and `pushRouter` apply `router.use(authMiddleware)` at root (no path). Any admin route using only `x-admin-key` (no JWT) MUST be registered in `routes/index.ts` BEFORE `calendarRouter` (line ~78), or it will receive 401 from those routers' global auth middleware.
- Playwright cache: `PLAYWRIGHT_BROWSERS_PATH` defaults to `.cache/ms-playwright` in project root; set `BASE_URL`/`API_URL` env vars when running tests against staging

## Pointers

- DB schema: `lib/db/src/schema/index.ts`
- API routes: `artifacts/api-server/src/routes/index.ts`
- Frontend routes: `artifacts/orientamento/src/App.tsx` or router file
- OpenAI integration docs: `.local/skills/integrations/SKILL.md`
