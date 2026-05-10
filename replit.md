# NorthStar — Career Orientation SaaS per utenti europei

> Piattaforma di coaching per carriera, crescita personale e formazione. Test RIASEC + AI agents + feed Discovery personalizzato.

---

## ⚠️ Regola 0 — Leggi le RULES prima di toccare codice

> Prima di aprire qualsiasi file del progetto, apri il documento di riferimento corrispondente all’area che stai modificando.

| Area | File da leggere prima |
|---|---|
| API / Express / route / middleware | `API_RULES.md` |
| Database / Drizzle / migrazioni / schema | `DB_RULES.md` |
| UI React / Tailwind / shadcn / componenti | `FRONTEND_RULES.md` |
| AI agents / Wendy / LLM router / streaming | `AI_RULES.md` |
| Branch / commit / PR / merge | `GIT_RULES.md` |

**Perché?** Ogni file di RULES contiene pattern obbligatori, checklist, gotchas e anti-pattern specifici per quell’area. Ignorarli introduce bug architetturali difficili da tracciare.

---

## Avvio rapido

| Servizio | Comando | Porta |
|---|---|---|
| Frontend (Vite) | `PORT=5000 pnpm --filter @workspace/orientamento run dev` | 5000 |
| API Server legacy (Express) | `PORT=8080 pnpm --filter @workspace/api-server run dev` | 8080 |
| NorthStar Server nuovo (Express) | `pnpm dev:server` oppure `pnpm dev` | 3001 |
| Python AI (FastAPI) | `cd artifacts/ai-agents && python3.11 -m uvicorn main:app --host 0.0.0.0 --port 8000` | 8000 |

```bash
# ─── Dev (nuovo server apps/server/) ────────────────────────────────────────────
pnpm dev            # avvia solo northstar-server (:3001)
pnpm dev:server     # alias diretto @northstar/server
pnpm dev:web        # avvia solo @northstar/web
pnpm dev:all        # server + web insieme (concurrently, label colorati)

# ─── Build & Start ────────────────────────────────────────────────────────────
pnpm build:server   # compila TypeScript apps/server → dist/
pnpm start:server   # avvia server compilato (produzione)

# ─── Lint ───────────────────────────────────────────────────────────────────
pnpm lint:server    # ESLint su apps/server/src

# ─── DB migrations ────────────────────────────────────────────────────────────
pnpm --filter @workspace/db exec drizzle-kit push

# ─── Build completo ────────────────────────────────────────────────────────────
pnpm run build

# ─── Typecheck ─────────────────────────────────────────────────────────────────
pnpm run typecheck

# ─── Testing ─────────────────────────────────────────────────────────────────
pnpm --filter @workspace/api-server run test:unit          # Vitest unit
pnpm --filter @workspace/api-server run test:integration   # Vitest + Supertest
pnpm --filter @workspace/api-server run test:coverage      # coverage report
pnpm test:e2e                                              # Playwright API spec
pnpm test:e2e:browser                                      # Playwright browser spec
pnpm test:e2e:all                                          # tutti i test Playwright

# ─── DB Security (una tantum, da superuser) ──────────────────────────────────────
psql -U postgres -d northstar -f scripts/db-roles.sql
psql -U postgres -d northstar -f scripts/verify-db-privileges.sql
```

### Variabili d’ambiente

> Copia `.env.example` in `.env` e compila i valori. Non committare mai `.env`.

**Obbligatorie:** `DATABASE_URL`, `DATABASE_URL_MIGRATOR`, `ADMIN_KEY`, `AI_AGENTS_URL`, `JWT_SECRET`

```
# ─── Database: due connessioni separate per ruolo ─────────────────────────────────
DATABASE_URL             # northstar_app — solo DML (SELECT/INSERT/UPDATE/DELETE)
DATABASE_URL_MIGRATOR    # northstar_migrator — DDL completo (solo per CI/deploy)

JWT_SECRET
JWT_EXPIRES_IN           # default: 7d
ADMIN_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
GNEWS_API_KEY, TAVILY_API_KEY
RESEND_API_KEY
EMAIL_FROM
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
GOOGLE_CLIENT_ID
OPENAI_API_KEY
OPENAI_MODEL             # default: gpt-4o-mini
AI_MODEL
AI_MODEL_OVERRIDE

# Override provider per use case (senza redeploy)
AI_STREAMING_PROVIDER       # default: groq
AI_AGENT_PROVIDER           # default: anthropic
AI_EMBEDDING_PROVIDER       # default: openai
AI_RESEARCH_PROVIDER        # default: groq
AI_JSON_PROVIDER            # default: groq
CORS_ORIGIN                 # origin frontend in produzione
ALLOWED_ORIGINS             # usato da northstar-server (virgola-separati)

# ─── Frontend (Vite) ─────────────────────────────────────────────────────────────────
VITE_API_URL             # URL base API vista dal browser (default: /api)
VITE_APP_URL             # URL pubblico app (default: http://localhost:3000)

# ─── Redis (cache profilo — opzionale, degrada silenziosamente se assente) ────────
REDIS_URL                     # es. redis://localhost:6379
PROFILE_CACHE_TTL_SECONDS     # default: 300 (5 minuti)

# ─── Affiliate ───────────────────────────────────────────────────────────────────
AFFILIATE_COMMISSION_PCT          # default: 20
AFFILIATE_MIN_WITHDRAWAL_EUR      # default: 10

# ─── Test E2E (solo .env.test) ──────────────────────────────────────────────────────
TEST_USER_EMAIL
TEST_USER_PASSWORD
TEST_AFFILIATE_EMAIL        # utente con isAffiliate=true
TEST_AFFILIATE_PASSWORD
```

---

## Stack tecnico

| Layer | Tecnologie |
|---|---|
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, Radix UI, Wouter, TanStack React Query, Recharts, Framer Motion, i18next |
| **Backend** | Express 5, TypeScript, Drizzle ORM, Pino logging, esbuild (custom `build.mjs`) |
| **AI** | Python 3.11, FastAPI, LangChain, LangGraph — microservizio su porta 8000 |
| **LLM Router** | `artifacts/api-server/src/lib/ai/` — router multi-provider (Groq / Anthropic / OpenAI / Google) con fallback automatico |
| **Database** | PostgreSQL — Drizzle ORM, due ruoli separati (`northstar_app` DML-only, `northstar_migrator` DDL) |
| **Cache** | Redis (ioredis) — cache profilo `/api/auth/me`, TTL configurabile, fallback silenzioso se assente |
| **Auth** | JWT custom (bcryptjs + `JWT_SECRET` persistente), middleware `requireAuth` / `requireAdmin` / `requirePremium` |
| **Security** | Rate limiting per route (express-rate-limit), RBAC admin (timing-safe key check), db-guard anti-injection |
| **Pagamenti** | Stripe |
| **Monorepo** | pnpm workspaces + catalog |
| **Testing** | Vitest (unit + integration) + Supertest + Playwright (E2E) |
| **CI/CD** | GitHub Actions — `.github/workflows/ci.yml` |
| **Deploy** | Replit / Docker |

---

## Struttura del progetto

```
artifacts/
  orientamento/          # React/Vite frontend (porta 5000)
    src/
      pages/
      components/
        cv/
      hooks/
      lib/
      i18n.ts
      locales/           # it, en, es, fr, de
  api-server/            # Express API legacy (porta 8080)
    vitest.config.ts
    src/
      __tests__/
        unit/
        integration/
      app.ts
      lib/
        ai/              # router multi-provider + circuit breaker + retry
        rate-limiters.ts
        db-guard.ts
      middlewares/
        requireAuth.ts
        requireAdmin.ts
        errorHandler.ts
        validateBody.ts
      routes/
  ai-agents/             # FastAPI Python (porta 8000)
apps/
  server/                # NorthStar Express server NUOVO (porta 3001)
    src/
      index.ts
      middleware/jwt.ts
      lib/cache.ts       # Redis cache profilo ✅
      routes/
        profile.ts       # GET /me con cache Redis ✅
        affiliate.ts
        growth-agent/
    Dockerfile
  web/
    src/
      components/affiliate/
      pages/wendy.tsx
lib/
  db/src/schema/
  integrations-openai-ai-react/src/
    growth-agent/        # AffiliateDashboard, GrowthChatPanel, useGrowthChat, ecc.
      index.ts           # public API del package ✅
  integrations-openai-ai-server/src/
  api-spec/
  api-zod/
  api-client-react/
scripts/
  db-roles.sql
  verify-db-privileges.sql
e2e/
  helpers/auth.ts
  auth.spec.ts
  test-riasec.spec.ts
  objectives.spec.ts
  admin.spec.ts
  api.spec.ts
  affiliate.spec.ts
  affiliate-dashboard.spec.ts
  referral-flow.spec.ts  # percorso critico registrazione → link → referral ✅
  cv-builder.spec.ts
  discovery-feed.spec.ts
  wendy.spec.ts
.github/workflows/ci.yml
docker-compose.yml
docker-compose.prod.yml
.env.example
.env.staging.example
```

---

## Roadmap Infrastruttura

> Le voci con 🔲 sono da implementare; quelle con ✅ sono già in produzione.

### 1. Portabilità da Replit

#### 🔲 `direnv` + `.envrc` per sviluppo locale

```bash
brew install direnv
eval "$(direnv hook zsh)"

# .envrc — mai committare
export DATABASE_URL="postgresql://northstar_app:PASSWORD@localhost:5432/northstar"
export DATABASE_URL_MIGRATOR="postgresql://northstar_migrator:PASSWORD@localhost:5432/northstar"
export JWT_SECRET="..."
export ADMIN_KEY="..."
export AI_AGENTS_URL="http://localhost:8000"

direnv allow
```

#### 🔲 Secret Manager in produzione

| Cloud | Servizio |
|---|---|
| AWS | Secrets Manager — `@aws-sdk/client-secrets-manager` |
| GCP | Secret Manager — `@google-cloud/secret-manager` |
| Railway / Fly.io | Variables UI — iniettate come env vars |
| Replit (attuale) | Secrets tab — iniettate automaticamente |

#### ✅ DATABASE_URL già standardizzato

---

### 2. Containerizzazione dev/prod

Vedi `docker-compose.yml` (dev) e `docker-compose.prod.yml` (prod).

| Servizio | Porta | Dockerfile |
|---|---|---|
| `postgres` | 5432 | image postgres:16-alpine |
| `redis` | 6379 | image redis:7-alpine ✅ |
| `ai-agents` | 8000 | `artifacts/ai-agents/Dockerfile` |
| `api-server` | 8080 | `artifacts/api-server/Dockerfile` (legacy) |
| `northstar-server` | 3001 | `apps/server/Dockerfile` ✅ |
| `frontend` | 5000 | `artifacts/orientamento/Dockerfile` |
| `jaeger` | 16686 | image jaegertracing/all-in-one |

```bash
# Solo DB locale (dev veloce)
docker compose up postgres

# DB + server + Redis
docker compose up postgres redis northstar-server

# Stack completo
docker compose up --build
```

---

### 3. Health Check Endpoint

✅ **Express**: `GET /api/health`.
✅ **NorthStar Server**: `GET /api/health` (porta 3001).

🔲 **Express avanzato**: aggiungere check DB e AI agents — `200 healthy` / `503 degraded`.

---

## Sicurezza

> **Principio guida**: ogni livello ha il minimo accesso necessario per funzionare.

### 1. Ruoli DB — Principio del Minimo Privilegio

| Ruolo | Connessione | Permessi | Quando usato |
|---|---|---|---|
| `northstar_app` | `DATABASE_URL` | SELECT, INSERT, UPDATE, DELETE | Runtime Express — sempre attivo |
| `northstar_migrator` | `DATABASE_URL_MIGRATOR` | DDL completo + DML | Solo in CI durante `drizzle-kit push` |

```bash
psql -U postgres -d northstar -f scripts/db-roles.sql
psql -U postgres -d northstar -f scripts/verify-db-privileges.sql
```

### 2. Rate Limiting per Route

| Limiter | Finestra | Max req | Route protette |
|---|---|---|---|
| `globalRateLimiter` | 1 min | 200 | `/*` tutte |
| `authLimiter` | 15 min | 10 | `POST /auth/login`, `/auth/register` |
| `passwordResetLimiter` | 30 min | 3 | `POST /auth/reset-password` |
| `adminLimiter` | 1 min | 60 | `/api/admin/*` |
| `aiLimiter` | 1 min | 20 | `/cv/generate`, `/cv/tailor`, `/chat` |
| `uploadLimiter` | 10 min | 5 | `POST /cv/*/upload` |

### 3. Protezione Injection — Drizzle ORM + db-guard

> **MAI usare `db.execute(sql\`...\`)` con interpolazione diretta da `req.body`.** Sempre e solo Drizzle ORM con metodi tipizzati.

### 4. RBAC Admin

```typescript
// Livello 1 — solo x-admin-key
router.get('/metrics', requireAdmin, metricsHandler);
// Livello 2 — x-admin-key + JWT con role='admin'
router.delete('/items/:id', requireAdmin, requireAuth, requireAdminRole, deleteHandler);
```

### Checklist sicurezza per ogni nuova route

- [ ] `requireAdmin` per route admin
- [ ] `requireAuth` prima di `req.user`
- [ ] `requirePremium` dopo `requireAuth`
- [ ] `aiLimiter` per route con costo LLM
- [ ] `authLimiter` su `/auth/*`
- [ ] `uploadLimiter` su route upload
- [ ] Query DB — **sempre Drizzle ORM**
- [ ] Campi stringa critici — `.refine((v) => !hasSqlInjectionPattern(v))`
- [ ] Log warning su ogni accesso negato

---

## Testing & CI/CD

### Strategia a 3 livelli

| Livello | Tool | DB | Velocità |
|---|---|---|---|
| **Unit** | Vitest | ❌ | < 5s |
| **Integration** | Vitest + Supertest | ✅ | < 30s |
| **E2E** | Playwright | ✅ | ~2 min |

### Pipeline CI

```
typecheck → unit-tests → integration-tests → e2e-tests
```

### E2E Playwright — spec

| File | Status |
|---|---|
| `auth.spec.ts` | ✅ |
| `test-riasec.spec.ts` | ✅ |
| `objectives.spec.ts` | ✅ |
| `admin.spec.ts` | ✅ |
| `api.spec.ts` | ✅ |
| `affiliate.spec.ts` | ✅ |
| `affiliate-dashboard.spec.ts` | ✅ |
| `referral-flow.spec.ts` | ✅ percorso critico: registrazione → link → referral |
| `cv-builder.spec.ts` | 🔲 |
| `discovery-feed.spec.ts` | 🔲 |
| `wendy.spec.ts` | 🔲 |

**Convenzione**: usare sempre `[data-testid="..."]` — mai classi CSS o testo.

---

## Qualità del Codice Backend

### Error Handler Centralizzato

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message); this.name = 'AppError';
  }
}
// In app.ts — ULTIMO middleware
app.use(errorHandler);
```

### Checklist nuova route backend

- [ ] Sotto `/api/v1/`
- [ ] `validateBody(ZodSchema)` se accetta `req.body`
- [ ] `catch` usa `next(err)` — mai `res.status(500)` inline
- [ ] Solo `ai.chat()` / `ai.stream()` — mai provider diretti
- [ ] Integration test: 200 + 400 + 401 minimi

---

## Sistema AI — Router

> **⚠️ REGOLA: ogni call AI passa SEMPRE da `ai.chat()` / `ai.agent()` / `ai.embed()` — mai provider diretti nelle route.**

| Use Case | Provider default | Fallback |
|---|---|---|
| `streaming_chat` | Groq | OpenAI |
| `agent_analysis` | Anthropic | OpenAI |
| `embedding` | OpenAI | — |
| `research` | Groq | OpenAI |
| `json_extraction` | Groq | OpenAI |

---

## Cache Redis — Profilo

File: `apps/server/src/lib/cache.ts`

- Chiave: `profile:me:{userId}`
- TTL: `PROFILE_CACHE_TTL_SECONDS` (default 300s)
- Fallback silenzioso se `REDIS_URL` non configurata
- Invalidata su: `PATCH /me`, `POST /me/objectives`, `POST /me/avatar`
- Per produzione multi-istanza: usare Upstash o Redis Cloud

```env
REDIS_URL=redis://localhost:6379
PROFILE_CACHE_TTL_SECONDS=300
```

---

## Sistema Affiliazione

- Route: `GET /api/affiliate/dashboard` (richiede `isAffiliate=true`)
- Dashboard: `lib/integrations-openai-ai-react/src/growth-agent/AffiliateDashboard.tsx`
- Wrapper web: `apps/web/src/components/affiliate/AffiliateDashboard.tsx`
- Commissione: `AFFILIATE_COMMISSION_PCT` (default 20%)
- Soglia ritiro: `AFFILIATE_MIN_WITHDRAWAL_EUR` (default 10€)
- Test E2E percorso critico: `e2e/referral-flow.spec.ts`

---

## Gotchas & regole

- **Porta 5000 obbligatoria** per il frontend — Replit webview
- **Ordine route critico:** admin con solo `x-admin-key` PRIMA di `calendarRouter`
- **Error handler:** DEVE essere l’ultimo `app.use()` in `app.ts`
- **ZodError → errorHandler:** `validateBody` chiama `next(result.error)` — non wrappare in AppError
- **Circuit breaker — singleton:** si resetta a cold start in serverless — comportamento atteso
- **Retry su streaming:** `withRetry` solo su `ai.chat()` + `ai.embed()` — mai su `ai.stream()`
- **React.memo:** inutile senza `useCallback` sulle prop-funzioni
- **useTransition:** non gestisce Promise direttamente — wrappare solo update di stato
- **i18n — returnObjects:** `cv.tailorSteps` ecc. DEVONO essere JSON array
- **`app.ts` no listen:** Supertest richiede `export app` senza `listen()`
- **Vitest fake timer:** `vi.useFakeTimers()` + `vi.runAllTimersAsync()` per retry/backoff
- **Playwright:** mai CSS selectors o testo visibile — solo `data-testid`
- **CI E2E:** `needs: [unit-tests, integration-tests]` — non spreca minuti se i test veloci falliscono
- **DB ruoli:** `DATABASE_URL` → `northstar_app` (DML); `DATABASE_URL_MIGRATOR` → `northstar_migrator` (DDL)
- **`db.execute(sql\`...\`)` con req.body:** MAI — usare sempre metodi tipizzati Drizzle
- **Rate limiter multi-istanza:** store in-memory non condiviso tra Pod — usare RedisStore in produzione
- **Redis cache:** `isPremium` cachato per TTL — se vuoi coerenza immediata post-Stripe chiama `invalidateProfileCache` nel webhook
- **`requirePremium`** dipende da `requireAuth` — usare sempre in sequenza
- **AffiliateDashboard:** logica SOLO in `lib/` — `apps/web/.../AffiliateDashboard.tsx` è un wrapper
- **northstar-server env:** usa `ALLOWED_ORIGINS` (virgola-separati) invece di `CORS_ORIGIN`
- **attached_assets/:** ignorata da `.gitignore` — non committare asset temporanei Replit

---

## Pointers rapidi

| Cosa | Dove |
|---|---|
| Schema DB | `lib/db/src/schema/index.ts` |
| App Express (legacy) | `artifacts/api-server/src/app.ts` |
| **NorthStar Server entry** | `apps/server/src/index.ts` ✅ |
| **NorthStar Server routes** | `apps/server/src/routes/` ✅ |
| **Redis cache profilo** | `apps/server/src/lib/cache.ts` ✅ |
| **NorthStar JWT middleware** | `apps/server/src/middleware/jwt.ts` ✅ |
| **NorthStar Dockerfile** | `apps/server/Dockerfile` ✅ |
| **Growth Agent public API** | `lib/integrations-openai-ai-react/src/growth-agent/index.ts` ✅ |
| **AffiliateDashboard (lib)** | `lib/integrations-openai-ai-react/src/growth-agent/AffiliateDashboard.tsx` ✅ |
| **AffiliateDashboard (web)** | `apps/web/src/components/affiliate/AffiliateDashboard.tsx` (wrapper) ✅ |
| **Wendy page** | `apps/web/src/pages/wendy.tsx` ✅ |
| **Test referral flow E2E** | `e2e/referral-flow.spec.ts` ✅ |
| **Test auth helpers** | `e2e/helpers/auth.ts` ✅ |
| CV routes | `artifacts/api-server/src/routes/cv.ts` |
| CV components | `artifacts/orientamento/src/components/cv/` |
| Cron jobs | `artifacts/api-server/src/jobs/cron.ts` |
| AI Router | `artifacts/api-server/src/lib/ai/router.ts` |
| **requireAuth** | `artifacts/api-server/src/middlewares/requireAuth.ts` ✅ |
| **requireAdmin** | `artifacts/api-server/src/middlewares/requireAdmin.ts` ✅ |
| **Rate limiters** | `artifacts/api-server/src/lib/rate-limiters.ts` ✅ |
| **DB Guard** | `artifacts/api-server/src/lib/db-guard.ts` ✅ |
| **DB Roles SQL** | `scripts/db-roles.sql` ✅ |
| Logger | `artifacts/api-server/src/lib/logger.ts` |
| Unit tests | `artifacts/api-server/src/__tests__/unit/` |
| Integration tests | `artifacts/api-server/src/__tests__/integration/` |
| CI/CD pipeline | `.github/workflows/ci.yml` |
| E2E specs | `e2e/` |
| i18n setup | `artifacts/orientamento/src/i18n.ts` |
| **Env template** | `.env.example` ✅ |
| **Staging env template** | `.env.staging.example` ✅ |
