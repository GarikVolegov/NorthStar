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

# ─── Testing ─────────────────────────────────────────────────────────
pnpm --filter @workspace/api-server run test:unit          # Vitest unit
pnpm --filter @workspace/api-server run test:integration   # Vitest + Supertest
pnpm --filter @workspace/api-server run test:coverage      # coverage report
pnpm test:e2e                                              # Playwright (tutti i servizi attivi)
pnpm test:e2e:api                                          # Playwright API-only (no browser)

# ─── DB Security (una tantum, da superuser) ───────────────────────────
psql -U postgres -d northstar -f scripts/db-roles.sql
psql -U postgres -d northstar -f scripts/verify-db-privileges.sql
```

### Variabili d'ambiente

**Obbligatorie:** `DATABASE_URL`, `DATABASE_URL_MIGRATOR`, `ADMIN_KEY`, `AI_AGENTS_URL`, `JWT_SECRET`

```
# ─── Database: due connessioni separate per ruolo ─────────────────────
DATABASE_URL             # northstar_app — solo DML (SELECT/INSERT/UPDATE/DELETE)
DATABASE_URL_MIGRATOR    # northstar_migrator — DDL completo (solo per CI/deploy)

JWT_SECRET
ADMIN_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
GNEWS_API_KEY, TAVILY_API_KEY
RESEND_API_KEY
EMAIL_FROM
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
GOOGLE_CLIENT_ID
AI_INTEGRATIONS_OPENAI_BASE_URL
AI_INTEGRATIONS_OPENAI_API_KEY
AI_MODEL
AI_MODEL_OVERRIDE

# Override provider per use case (senza redeploy)
AI_STREAMING_PROVIDER       # default: groq
AI_AGENT_PROVIDER           # default: anthropic
AI_EMBEDDING_PROVIDER       # default: openai
AI_RESEARCH_PROVIDER        # default: groq
AI_JSON_PROVIDER            # default: groq
CORS_ORIGIN                 # origin frontend in produzione
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
| **Auth** | JWT custom (bcryptjs + `JWT_SECRET` persistente), middleware `requireAuth` / `requireAdmin` / `requirePremium` |
| **Security** | Rate limiting per route (express-rate-limit), RBAC admin (timing-safe key check), db-guard anti-injection |
| **Monorepo** | pnpm workspaces + catalog |
| **Testing** | Vitest (unit + integration) + Supertest + Playwright (E2E) |
| **CI/CD** | GitHub Actions — `.github/workflows/ci.yml` |
| **DOCX** | libreria `docx` (server-side, `api-server`) |

---

## Struttura del progetto

```
artifacts/
  orientamento/          # React/Vite frontend (porta 5000)
    src/
      pages/
      components/
        cv/
          CvGeneratorModal.tsx
          CvSection.tsx
          CvEditorDrawer.tsx
          CvDownloadMenu.tsx
      hooks/
      lib/
      i18n.ts
      locales/           # it, en, es, fr, de
  api-server/            # Express API (porta 8080)
    vitest.config.ts
    src/
      __tests__/
        setup.ts
        unit/            # ai-router, circuit-breaker, retry, error-handler,
                         # validate-body, rate-limiters, require-admin, db-guard
        integration/     # health, cv-routes, admin-routes, security
      app.ts             # Express app — middleware stack
      lib/
        ai/
          index.ts       # ai.chat(), ai.agent(), ai.embed()
          router.ts
          types.ts
          providers/
          utils/         # circuit-breaker.ts 🔲, retry.ts 🔲
        logger.ts
        security-headers.ts
        global-rate-limiter.ts   # 200 req/min per IP (globale)
        rate-limiters.ts         # limiter per route: auth, admin, ai, upload, reset ✅
        db-guard.ts              # anti-injection helper + Drizzle cheat sheet ✅
      middlewares/
        errorHandler.ts  🔲
        validateBody.ts  🔲
        requireAuth.ts   # JWT verify, popola req.user ✅
        requireAdmin.ts  # x-admin-key timing-safe + requireAdminRole ✅
      routes/
        cv.ts
        discovery/
        admin/
        growth-agent/
      jobs/
  ai-agents/
lib/
  db/
    src/schema/
    drizzle/
  integrations-openai-ai-server/src/
  integrations-openai-ai-react/src/
  api-spec/
  api-zod/
  api-client-react/
scripts/
  db-roles.sql           # Crea ruoli northstar_app + northstar_migrator ✅
  verify-db-privileges.sql  # Verifica privilegi post-setup ✅
e2e/
  auth.spec.ts
  test-riasec.spec.ts
  objectives.spec.ts
  admin.spec.ts
  api.spec.ts
  cv-builder.spec.ts     🔲
  discovery-feed.spec.ts 🔲
.github/workflows/ci.yml
.envrc
docker-compose.yml
docker-compose.prod.yml
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

Vedi `docker-compose.yml` (dev) e `docker-compose.prod.yml` (prod). In produzione il frontend è su CDN.

---

### 3. Health Check Endpoint

✅ **Express**: `GET /api/health`.

🔲 **Express avanzato**: aggiungere check DB e AI agents — `200 healthy` / `503 degraded`.

🔲 **FastAPI**:
```python
@app.get("/health")
async def health_check():
    return { "status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat() }
```

---

## Sicurezza

> **Principio guida**: ogni livello ha il minimo accesso necessario per funzionare. Nessun componente può fare più di quello che gli serve.

### 1. Ruoli DB — Principio del Minimo Privilegio

File: `scripts/db-roles.sql` · Verifica: `scripts/verify-db-privileges.sql`

#### Due ruoli separati

| Ruolo | Connessione | Permessi | Quando usato |
|---|---|---|---|
| `northstar_app` | `DATABASE_URL` | SELECT, INSERT, UPDATE, DELETE | Runtime Express — sempre attivo |
| `northstar_migrator` | `DATABASE_URL_MIGRATOR` | DDL completo (CREATE, ALTER, DROP) + DML | Solo in CI durante `drizzle-kit push` |

L'applicazione a runtime **non può mai** eseguire `DROP TABLE`, `ALTER TABLE`, `CREATE TABLE` — anche in caso di SQL injection riuscita il danno è limitato ai dati, non alla struttura.

#### Setup iniziale (una tantum da superuser)

```bash
# 1. Crea i ruoli
psql -U postgres -d northstar -f scripts/db-roles.sql

# 2. Verifica — il risultato deve mostrare solo SELECT/INSERT/UPDATE/DELETE per northstar_app
psql -U postgres -d northstar -f scripts/verify-db-privileges.sql

# 3. Aggiorna le env vars
# DATABASE_URL=postgresql://northstar_app:PASSWORD@host:5432/northstar
# DATABASE_URL_MIGRATOR=postgresql://northstar_migrator:PASSWORD@host:5432/northstar
```

#### Configurazione Drizzle per due ruoli

```typescript
// lib/db/src/index.ts — connessione runtime (northstar_app)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// drizzle.config.ts — connessione migrazione (northstar_migrator)
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './lib/db/src/schema/index.ts',
  out: './lib/db/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL!,
  },
});
```

#### Aggiornamento CI — usa `DATABASE_URL_MIGRATOR` per le migrazioni

In `.github/workflows/ci.yml`, il job `integration-tests` già esegue `drizzle-kit push`. Deve usare l'utente migrator:

```yaml
- name: Run DB migrations
  run: pnpm --filter @workspace/db exec drizzle-kit push
  env:
    DATABASE_URL_MIGRATOR: postgresql://northstar:northstar@localhost:5432/northstar_test
    # northstar_app usa la stessa password nel container CI — in produzione separare
    DATABASE_URL: postgresql://northstar:northstar@localhost:5432/northstar_test
```

---

### 2. Rate Limiting per Route — Livelli Specifici

File: `artifacts/api-server/src/lib/rate-limiters.ts`

#### Strategia a 2 livelli

```
Ogni request
    │
    ├── [globalRateLimiter] — 200 req/min per IP (tutte le route)
    │
    └── [limiter specifico] — finestre più strette per route sensibili
             ├── authLimiter         → POST /auth/login, /auth/register
             ├── passwordResetLimiter → POST /auth/reset-password
             ├── adminLimiter        → GET|POST /api/admin/*
             ├── aiLimiter           → /cv/generate, /cv/tailor, /growth-agent/chat
             └── uploadLimiter       → POST /cv/*/upload
```

#### Tabella limiter

| Limiter | Finestra | Max req | Route protette | Obiettivo |
|---|---|---|---|---|
| `globalRateLimiter` | 1 min | 200 | `/*` tutte | DoS generico |
| `authLimiter` | 15 min | 10 | `POST /auth/login`, `/auth/register` | Brute force password |
| `passwordResetLimiter` | 30 min | 3 | `POST /auth/reset-password` | Email bombing, account enumeration |
| `adminLimiter` | 1 min | 60 | `/api/admin/*` | Scraping automatico pannello admin |
| `aiLimiter` | 1 min | 20 | `/cv/generate`, `/cv/tailor`, `/chat` | Costo API LLM |
| `uploadLimiter` | 10 min | 5 | `POST /cv/*/upload` | DoS via upload ripetuti |

#### Integrazione nelle route — pattern

```typescript
import { authLimiter, aiLimiter, uploadLimiter, adminLimiter } from '../lib/rate-limiters.js';

// Auth routes
router.post('/login',    authLimiter, loginHandler);
router.post('/register', authLimiter, registerHandler);
router.post('/reset-password', passwordResetLimiter, resetHandler);

// CV routes con costo AI
router.post('/mine/generate', requireAuth, aiLimiter, generateHandler);
router.post('/:id/tailor',    requireAuth, aiLimiter, validateBody(TailorSchema), tailorHandler);
router.post('/mine/upload',   requireAuth, uploadLimiter, uploadHandler);

// Admin routes
router.get('/metrics',     requireAdmin, adminLimiter, metricsHandler);
```

#### Risposta 429 strutturata

Ogni limiter risponde con headers RFC 9110 (`RateLimit-Policy`, `RateLimit-Reset`) + body JSON:

```json
{
  "error": "TOO_MANY_REQUESTS",
  "message": "Troppe richieste. Riprova tra qualche minuto.",
  "retryAfter": "1715170560"
}
```

#### Note implementative

- `skipSuccessfulRequests: true` su `authLimiter` — le login riuscite non consumano quota (mitiga falsi positivi per utenti legittimi)
- `standardHeaders: 'draft-7'` — header RFC 9110 compatibili con client moderni
- In produzione multi-istanza (es. 2+ Pod su Kubernetes): sostituire il store in-memory con **RedisStore** (`rate-limit-redis`)

```typescript
// Upgrade a Redis (produzione multi-istanza)
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
const store = new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) });

export const authLimiter = createLimiter('auth', { windowMs: 15 * 60 * 1000, max: 10, store });
```

---

### 3. Protezione Injection — Drizzle ORM + db-guard

File: `artifacts/api-server/src/lib/db-guard.ts`

#### Regola fondamentale

> **MAI usare `db.execute(sql`...`)` con interpolazione diretta da `req.body`. Sempre e solo Drizzle ORM con metodi tipizzati — genera prepared statements `$1, $2` automaticamente.**

#### Drizzle genera prepared statements automaticamente

Drizzle ORM con driver `node-postgres` serializza sempre i valori come parametri separati dalla query — il driver non può mai confondere dato e struttura SQL:

```typescript
// ✅ CORRETTO — Drizzle genera: SELECT * FROM users WHERE id = $1
import { db } from '@workspace/db';
import { users } from '@workspace/db/schema';
import { eq, and } from 'drizzle-orm';

// Tutti questi pattern sono sicuri:
const user = await db.select().from(users).where(eq(users.id, userId));
const active = await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true)));
await db.insert(users).values({ email, passwordHash, name });
await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
await db.delete(users).where(eq(users.id, userId));

// ✅ Prepared statement esplicito (performance-critical, N chiamate ripetute)
const getUser = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder('id')))
  .prepare('get_user_by_id');
const result = await getUser.execute({ id: userId });

// ❌ SBAGLIATO — interpolazione diretta: ${userId} non è un parametro Drizzle
await db.execute(sql`SELECT * FROM users WHERE id = ${req.body.id}`);

// ❌ SBAGLIATO — concatenazione manuale
await db.execute(`SELECT * FROM users WHERE email = '${email}'`);
```

#### db-guard — tripwire + rilevamento pattern

`lib/db-guard.ts` espone tre utility:

| Funzione | Scopo | Quando usare |
|---|---|---|
| `hasSqlInjectionPattern(value)` | Rileva pattern injection in stringa | Nei Zod `.refine()` per campi critici |
| `sanitizeStringParam(value)` | Rimuove control chars, fa trim | Ultima linea di difesa dopo Zod |
| `assertNoRawSqlFromUserInput(query, ctx)` | Lancia errore se query raw contiene injection | Code review tripwire nelle query legacy |

```typescript
// Uso in schema Zod per campo extra-sensibile (es. nome azienda in ricerca)
import { hasSqlInjectionPattern } from '../lib/db-guard.js';

const SearchSchema = z.object({
  company: z.string()
    .max(200)
    .refine(
      (val) => !hasSqlInjectionPattern(val),
      { message: 'Input non valido' },  // messaggio generico — non rivelare il motivo
    ),
});
```

#### Pattern injection rilevati da `hasSqlInjectionPattern`

| Pattern | Esempio | Tipo attacco |
|---|---|---|
| Quote singola/doppia escape | `' OR '1'='1` | Classic injection |
| `UNION SELECT` | `UNION SELECT password FROM users` | Data exfiltration |
| Commenti SQL `--` `/* */` | `admin'--` | Comment bypass |
| Statement terminator `;` | `foo; DROP TABLE users;` | Stacked queries |
| `WAITFOR DELAY` | `WAITFOR DELAY 0:0:5` | Time-based blind |
| Hex encoding | `0x41424344` | Obfuscation |
| DDL keywords | `DROP`, `ALTER`, `CREATE` | Structural damage |

**Importante**: questo rilevamento è best-effort e non sostituisce i prepared statements. È una difesa in profondità aggiuntiva per i campi stringa usati in contesti critici.

---

### 4. RBAC Admin — requireAdmin + requireAdminRole

File: `artifacts/api-server/src/middlewares/requireAdmin.ts`

#### Due livelli di protezione admin

```typescript
// Livello 1 — solo x-admin-key (route admin standard)
router.get('/metrics', requireAdmin, metricsHandler);

// Livello 2 — x-admin-key + JWT con role='admin' (operazioni distruttive)
router.delete('/discovery/items/:id', requireAdmin, requireAuth, requireAdminRole, deleteHandler);
```

#### Timing-safe key comparison

Il confronto della `ADMIN_KEY` usa `crypto.timingSafeEqual` di Node.js per prevenire timing attacks. Un confronto naïve (`===`) permette di dedurre la lunghezza e i prefissi corretti misurando i tempi di risposta:

```typescript
import { timingSafeEqual } from 'crypto';

function isValidAdminKey(provided: string): boolean {
  if (!ADMIN_KEY || !provided) return false;
  // timingSafeEqual richiede buffer di lunghezza uguale
  const a = Buffer.from(provided.padEnd(ADMIN_KEY.length, '\0'));
  const b = Buffer.from(ADMIN_KEY.padEnd(provided.length, '\0'));
  // Controllo lunghezza separato — timingSafeEqual da solo non basta
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b) && provided.length === ADMIN_KEY.length;
}
```

#### requireAuth + requirePremium

File: `artifacts/api-server/src/middlewares/requireAuth.ts`

```typescript
// Route premium-only
router.post('/cv/:id/tailor', requireAuth, requirePremium, aiLimiter, validateBody(TailorSchema), handler);

// req.user disponibile dopo requireAuth
interface JwtPayload {
  sub: number;        // user ID
  email: string;
  role: 'user' | 'admin';
  isPremium: boolean;
}
```

#### Errori standardizzati

| Scenario | Status | Error code |
|---|---|---|
| Header `x-admin-key` mancante | 401 | `UNAUTHORIZED` |
| Chiave admin errata | 403 | `FORBIDDEN` |
| JWT mancante | 401 | `UNAUTHORIZED` |
| JWT scaduto | 401 | `TOKEN_EXPIRED` |
| JWT invalido | 401 | `INVALID_TOKEN` |
| Utente non premium | 403 | `PREMIUM_REQUIRED` |
| Ruolo non admin | 403 | `FORBIDDEN` |

---

### Checklist sicurezza per ogni nuova route

- [ ] Route admin → `requireAdmin` come primo middleware dopo i limiter
- [ ] Route autenticate → `requireAuth` prima di accedere a `req.user`
- [ ] Route premium → `requirePremium` dopo `requireAuth`
- [ ] Route con payload AI → `aiLimiter` per limitare costo LLM
- [ ] Route `/auth/*` → `authLimiter` (10 req / 15 min)
- [ ] Route con upload → `uploadLimiter` (5 req / 10 min)
- [ ] Query DB → **sempre Drizzle ORM** — mai `db.execute(sql\`...\`)` con valori da `req.body`
- [ ] Campi stringa critici in ricerca → `.refine((v) => !hasSqlInjectionPattern(v))` nello schema Zod
- [ ] Errori 401/403 → corpo JSON generico senza stack trace
- [ ] Log warning su ogni accesso negato (già in `requireAdmin` e `requireAuth`)

---

## Testing & CI/CD

> **Strategia a 3 livelli**: Unit → Integration → E2E.

### Panoramica

| Livello | Tool | DB | Velocità |
|---|---|---|---|
| **Unit** | Vitest | ❌ | < 5s |
| **Integration** | Vitest + Supertest | ✅ | < 30s |
| **E2E** | Playwright | ✅ | ~2 min |

### Script `package.json` (`api-server`)

```json
{
  "scripts": {
    "test:unit":        "vitest run --reporter=verbose src/__tests__/unit",
    "test:integration": "vitest run --reporter=verbose src/__tests__/integration",
    "test:coverage":    "vitest run --coverage src/__tests__/unit src/__tests__/integration",
    "test:watch":       "vitest watch src/__tests__/unit"
  }
}
```

### File di test presenti

#### Unit (`src/__tests__/unit/`)

| File | Cosa testa | Tests |
|---|---|---|
| `ai-router.test.ts` | Use case → provider mapping, env override, fallback | 7 |
| `circuit-breaker.test.ts` | closed/open/half-open, threshold, recovery | 6 |
| `retry.test.ts` | Backoff esponenziale, retryable errors, fake timer | 5 |
| `error-handler.test.ts` | ZodError → 400, AppError → statusCode, 500, requestId | 5 |
| `validate-body.test.ts` | Valido, invalido, strip extra fields, null body | 5 |
| `rate-limiters.test.ts` | Config windowMs + max per ogni limiter | 5 |
| `require-admin.test.ts` | Header assente → 401, errato → 403, corretto → next(), timing-safe | 6 |
| `db-guard.test.ts` | Pattern injection, sanitize, assertNoRawSql | 9 |

#### Integration (`src/__tests__/integration/`)

| File | Endpoint testati | Focus |
|---|---|---|
| `health.test.ts` | `/api/health`, `/api/sectors`, `/api/objectives` | Public + auth protection |
| `cv-routes.test.ts` | `/cv/mine/generate`, `/cv/:id/tailor` | AI mock, validateBody, auth |
| `admin-routes.test.ts` | `/admin/metrics`, `/admin/agent-health` | x-admin-key auth, struttura risposta |
| `security.test.ts` | Admin RBAC, JWT + premium, no stack trace in 403 | RBAC completo |

### Pattern chiave

```typescript
// Mock req/res senza dipendenze aggiuntive
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}

// Fake timer per retry/backoff
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
await vi.runAllTimersAsync();

// Mock AI globale per integration test
const mockAiChat = vi.fn();
vi.mock('../../lib/ai', () => ({ ai: { chat: mockAiChat } }));
beforeEach(() => vi.clearAllMocks());
```

### Pipeline CI (`.github/workflows/ci.yml`)

```
typecheck → unit-tests → integration-tests → e2e-tests
```

E2E ha `needs: [unit-tests, integration-tests]` — non gira se i test veloci falliscono.

### Soglie coverage

```typescript
thresholds: { lines: 70, functions: 70, branches: 60 }
```

### E2E Playwright — spec

| File | Status |
|---|---|
| `auth.spec.ts` | ✅ |
| `test-riasec.spec.ts` | ✅ |
| `objectives.spec.ts` | ✅ |
| `admin.spec.ts` | ✅ |
| `api.spec.ts` | ✅ |
| `cv-builder.spec.ts` | 🔲 nuovo |
| `discovery-feed.spec.ts` | 🔲 nuovo |

**Convenzione**: usare sempre `[data-testid="..."]` — mai classi CSS o testo.

---

## Qualità del Codice Backend

### 1. API Versioning — `/api/v1/`

```typescript
const v1Router = express.Router();
v1Router.use(router);
app.use("/api/v1", v1Router);
app.use("/api", (req, res) => res.redirect(308, `/api/v1${req.url}`));
```

### 2. Error Handler Centralizzato

```typescript
// middlewares/errorHandler.ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message); this.name = 'AppError';
  }
}

export function errorHandler(err, req, res, _next) {
  const requestId = req.id;
  if (err instanceof ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', requestId, issues: ... });
  if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.code, message: err.message, requestId });
  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({ error: 'INTERNAL_ERROR', requestId });
}

// In app.ts — ULTIMO middleware
app.use(errorHandler);
```

### 3. Circuit Breaker + Retry (da creare in `lib/ai/utils/`)

| Stato CB | Comportamento |
|---|---|
| `closed` | Chiamata normale |
| `open` (>5 fail) | Skip → fallback immediato |
| `half-open` | Un tentativo → se ok torna `closed` |

### 4. validateBody Middleware

```typescript
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) { next(result.error); return; }
    req.body = result.data;  // dati tipati e sanitizzati
    next();
  };
}
```

### Checklist nuova route backend

- [ ] Sotto `/api/v1/`
- [ ] `validateBody(ZodSchema)` se accetta `req.body`
- [ ] `catch` usa `next(err)` — mai `res.status(500)` inline
- [ ] Solo `ai.chat()` / `ai.stream()` — mai provider diretti
- [ ] `throw new AppError(status, msg, code)` per errori applicativi
- [ ] `requireAuth` / `requireAdmin` / `requirePremium` secondo il livello
- [ ] Limiter appropriato (`authLimiter`, `aiLimiter`, ecc.)
- [ ] Integration test: 200 + 400 + 401 minimi

---

## Qualità Frontend & UX

### React.memo + useCallback

```typescript
const CvDocument = React.memo(function CvDocument({ cv }) { ... });
const handleChange = useCallback((updated) => setGenerated(updated), []);
```

### useTransition per AI

```typescript
const [isPending, startTransition] = useTransition();
function handleGenerate() {
  startTransition(() => setLoading(true));
  generate().finally(() => startTransition(() => setLoading(false)));
}
```

### i18n

```typescript
i18n.init({ saveMissing: import.meta.env.DEV });
```

Chiavi `cv.tailorSteps`, `cv.letterSteps`, `cv.atsSteps` → DEVONO essere JSON array in tutti e 5 i file.

### Checklist nuova feature frontend

- [ ] `React.memo` + `useCallback` su componenti con prop-funzioni
- [ ] `useTransition` per operazioni AI
- [ ] `useTranslation()` — zero stringhe hardcoded
- [ ] Chiavi i18n in tutti e 5 i file lingua
- [ ] `data-testid` su ogni elemento interattivo

---

## Sistema AI — Router

> **⚠️ REGOLA: ogni call AI passa SEMPRE da `ai.chat()` / `ai.agent()` / `ai.embed()` — mai provider diretti nelle route.**

| Use Case | Provider default | Fallback | Quando usarlo |
|---|---|---|---|
| `streaming_chat` | Groq | OpenAI | Chat SSE, career coach |
| `agent_analysis` | Anthropic | OpenAI | Ragionamento, tool use |
| `embedding` | OpenAI | — | RAG, similarity |
| `research` | Groq | OpenAI | Background jobs |
| `json_extraction` | Groq | OpenAI | CV, ATS score, cover letter |

---

## Internazionalizzazione (i18n)

> **⚠️ REGOLA: zero stringhe hardcoded nel JSX. Ogni testo usa `t("chiave")`.**

5 lingue: `it` (default) · `en` · `es` · `fr` · `de`.

---

## CV Builder

```
GET|POST|PATCH|DELETE /api/v1/cv/mine
POST   /api/v1/cv/mine/upload
POST   /api/v1/cv/mine/generate
GET    /api/v1/cv/:userId/pdf?template=
POST   /api/v1/cv/:userId/tailor
POST   /api/v1/cv/:userId/cover-letter
POST   /api/v1/cv/:userId/ats-score
GET|POST /api/v1/cv/:userId/versions
```

Template: `classic` (verde scuro), `minimal` (bianco), `bold` (navy + arancio).

---

## Architettura — Decisioni chiave

- **OpenAPI-first:** Orval genera Zod schemas + React Query hooks
- **Monorepo pnpm workspaces** con catalog
- **esbuild custom `build.mjs`**
- **AI Router** con circuit breaker + retry esponenziale
- **API versioning** `/api/v1/` + redirect 308
- **Error handling** centralizzato in `middlewares/errorHandler.ts`
- **Validation** `middlewares/validateBody(ZodSchema)`
- **Sicurezza DB** due ruoli separati: `northstar_app` (DML) + `northstar_migrator` (DDL)
- **Rate limiting a 2 livelli**: global 200 req/min + limiter specifici per route sensibili
- **RBAC**: `requireAdmin` (timing-safe) + `requireAuth` (JWT) + `requirePremium`
- **Injection guard**: Drizzle ORM prepared statements + `db-guard.ts` per rilevamento pattern
- **Testing a 3 livelli:** Vitest unit → Vitest + Supertest integration → Playwright E2E
- **CI/CD:** GitHub Actions, 4 job in sequenza con `needs`
- **data-testid** su ogni elemento interattivo
- **Health check:** `GET /api/health` (Express ✅, FastAPI 🔲)
- **CORS:** ristretto a `CORS_ORIGIN`

---

## Gotchas & regole

- **Porta 5000 obbligatoria** per il frontend — Replit webview
- **Ordine route critico:** admin con solo `x-admin-key` PRIMA di `calendarRouter`
- **Error handler:** DEVE essere l'ultimo `app.use()` in `app.ts`
- **ZodError → errorHandler:** `validateBody` chiama `next(result.error)` — non wrappare in AppError
- **Circuit breaker — singleton:** si resetta a cold start in serverless — comportamento atteso
- **Retry su streaming:** `withRetry` solo su `ai.chat()` + `ai.embed()` — mai su `ai.stream()`
- **React.memo:** inutile senza `useCallback` sulle prop-funzioni
- **useTransition:** non gestisce Promise direttamente — wrappare solo update di stato
- **i18n — returnObjects:** `cv.tailorSteps` ecc. DEVONO essere JSON array — se stringa `.map()` crasha
- **`app.ts` no listen:** Supertest richiede `export app` senza `listen()` — il listen sta in `index.ts`
- **Vitest fake timer:** `vi.useFakeTimers()` + `vi.runAllTimersAsync()` per retry/backoff
- **Playwright:** mai CSS selectors o testo visibile — solo `data-testid`
- **CI E2E:** `needs: [unit-tests, integration-tests]` — non spreca minuti se i test veloci falliscono
- **DB ruoli:** `DATABASE_URL` → `northstar_app` (DML); `DATABASE_URL_MIGRATOR` → `northstar_migrator` (DDL)
- **`db.execute(sql\`...\`)` con req.body:** MAI — usare sempre metodi tipizzati Drizzle
- **Rate limiter multi-istanza:** store in-memory non condiviso tra Pod — usare RedisStore in produzione
- **`timingSafeEqual` — lunghezza:** il controllo `provided.length === ADMIN_KEY.length` DEVE essere separato da `timingSafeEqual`
- **`requirePremium`** dipende da `requireAuth` — usare sempre in sequenza: `requireAuth, requirePremium`
- **Discovery feed cache:** LRU 5min server-side + sessionStorage 10min — `?refresh=1` bypass
- **Enricher retry cap:** 3 fallimenti → `isEnriched=true`, `score=0` — non riprocessato
- **CV DOCX:** `pnpm add docx --filter api-server` dopo clone

---

## Pointers rapidi

| Cosa | Dove |
|---|---|
| Schema DB | `lib/db/src/schema/index.ts` |
| App Express | `artifacts/api-server/src/app.ts` |
| API routes entry | `artifacts/api-server/src/routes/index.ts` |
| CV routes | `artifacts/api-server/src/routes/cv.ts` |
| CV components | `artifacts/orientamento/src/components/cv/` |
| Cron jobs | `artifacts/api-server/src/jobs/cron.ts` |
| AI Router | `artifacts/api-server/src/lib/ai/router.ts` |
| AI public API | `artifacts/api-server/src/lib/ai/index.ts` |
| AI providers | `artifacts/api-server/src/lib/ai/providers/` |
| Circuit breaker | `artifacts/api-server/src/lib/ai/utils/circuit-breaker.ts` 🔲 |
| Retry utility | `artifacts/api-server/src/lib/ai/utils/retry.ts` 🔲 |
| Error handler | `artifacts/api-server/src/middlewares/errorHandler.ts` 🔲 |
| Validate body | `artifacts/api-server/src/middlewares/validateBody.ts` 🔲 |
| **requireAuth** | `artifacts/api-server/src/middlewares/requireAuth.ts` ✅ |
| **requireAdmin** | `artifacts/api-server/src/middlewares/requireAdmin.ts` ✅ |
| **Rate limiters** | `artifacts/api-server/src/lib/rate-limiters.ts` ✅ |
| **DB Guard** | `artifacts/api-server/src/lib/db-guard.ts` ✅ |
| **DB Roles SQL** | `scripts/db-roles.sql` ✅ |
| **DB Roles verify** | `scripts/verify-db-privileges.sql` ✅ |
| Logger | `artifacts/api-server/src/lib/logger.ts` |
| Vitest config | `artifacts/api-server/vitest.config.ts` |
| Unit tests | `artifacts/api-server/src/__tests__/unit/` |
| Integration tests | `artifacts/api-server/src/__tests__/integration/` |
| CI/CD pipeline | `.github/workflows/ci.yml` |
| E2E specs | `e2e/` |
| i18n setup | `artifacts/orientamento/src/i18n.ts` |
| Traduzioni (it) | `artifacts/orientamento/src/locales/it/translation.json` |
| Discovery agents | `lib/integrations-openai-ai-server/src/discovery-agent/` |
| Brand tokens | `artifacts/orientamento/src/lib/brand.ts` |
