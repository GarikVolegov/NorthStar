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
AI_MODEL                    # modello OpenAI per agenti orchestratore legacy (default: gpt-4o-mini)
AI_MODEL_OVERRIDE           # override globale modello nel router (opzionale)

# Override provider per use case (senza redeploy)
AI_STREAMING_PROVIDER       # default: groq
AI_AGENT_PROVIDER           # default: anthropic
AI_EMBEDDING_PROVIDER       # default: openai
AI_RESEARCH_PROVIDER        # default: groq
AI_JSON_PROVIDER            # default: groq
CORS_ORIGIN                 # origin frontend in produzione (es. https://northstar.app)
```

---

## Stack tecnico

| Layer | Tecnologie |
|---|---|
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, Radix UI, Wouter, TanStack React Query, Recharts, Framer Motion, i18next |
| **Backend** | Express 5, TypeScript, Drizzle ORM, Pino logging, esbuild (custom `build.mjs`) |
| **AI** | Python 3.11, FastAPI, LangChain, LangGraph — microservizio su porta 8000 |
| **LLM Router** | `artifacts/api-server/src/lib/ai/` — router multi-provider (Groq / Anthropic / OpenAI / Google) con fallback automatico |
| **Database** | PostgreSQL (Replit managed → obiettivo: qualsiasi provider via `DATABASE_URL`), Drizzle ORM |
| **Auth** | JWT custom (bcryptjs + `JWT_SECRET` persistente) |
| **Monorepo** | pnpm workspaces + catalog |
| **Testing** | Vitest (unit + integration) + Supertest + Playwright (E2E) |
| **CI/CD** | GitHub Actions — `.github/workflows/ci.yml` |
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
      i18n.ts            # setup i18next (5 lingue: it, en, es, fr, de)
      locales/
        it/translation.json
        en/translation.json
        es/translation.json
        fr/translation.json
        de/translation.json
  api-server/            # Express API (porta 8080)
    vitest.config.ts     # config Vitest (unit + integration)
    src/
      __tests__/
        setup.ts         # env vars globali per tutti i test
        unit/            # test unitari (AI router, circuit breaker, retry, errorHandler, validateBody)
        integration/     # test integration con Supertest (health, cv-routes, admin-routes)
      app.ts             # Express app — middleware stack (security, Pino HTTP, CORS, rate limit)
      lib/
        ai/              # AI Router — PUNTO DI INGRESSO UNICO per tutte le call AI
          index.ts       # ai.chat(), ai.agent(), ai.embed() — API pubblica
          router.ts      # use case → provider + modello; override env
          types.ts       # AIUseCase, AIProviderName, AIRouterConfig...
          providers/     # implementazioni per ogni provider
          utils/         # circuit-breaker.ts, retry.ts 🔲
        logger.ts        # istanza Pino condivisa
        security-headers.ts  # helmet-like security middleware
        global-rate-limiter.ts  # 200 req/min per IP
      middlewares/       # errorHandler.ts 🔲, validateBody.ts 🔲
      routes/            # 40+ route files organizzati per dominio
        cv.ts            # CV Builder — upload, generate, edit, PDF, DOCX, tailor, cover letter, ATS score
        discovery/       # feed.ts, saved.ts
        admin/           # agent-health, discovery-collect, discovery-sources,
                         # discovery-items, discovery-enrich, analyze-supervisor
        growth-agent/    # chat, knowledge, memory, analytics, notifications
      jobs/              # cron.ts (collector 6h, enricher 2h, personalizer 3h)
  ai-agents/             # Python FastAPI (porta 8000)
lib/
  db/
    src/schema/          # Drizzle schema — source of truth
    drizzle/             # SQL migrations
  integrations-openai-ai-server/
    src/
      client.ts          # OpenAI Proxy Replit (legacy, usato da enricher)
      discovery-agent/   # collector-agent.ts, enricher-agent.ts, personalizer-agent.ts
  integrations-openai-ai-react/
    src/
      admin/             # AdminDashboard, AdminEnricherPanel, AdminCollectorPanel...
      discovery/         # DiscoveryFeedPage, DiscoveryItemCard, useDiscoveryFeed
      growth-agent/      # GrowthChatPanel, GrowthAnalyticsDashboard...
  api-spec/              # OpenAPI spec + Orval codegen config
  api-zod/               # Zod schemas generati
  api-client-react/      # TanStack React Query hooks generati
e2e/                     # Playwright specs
  auth.spec.ts           # Login, register, logout
  test-riasec.spec.ts    # Flusso test RIASEC completo
  objectives.spec.ts     # Gestione obiettivi
  admin.spec.ts          # Admin dashboard
  api.spec.ts            # API-only (health, auth protection, admin)
  cv-builder.spec.ts     # CV Builder: genera, template, download, ATS 🔲
  discovery-feed.spec.ts # Discovery: feed, filtri, bookmark, insight 🔲
.github/
  workflows/
    ci.yml               # Pipeline CI: typecheck → unit → integration → E2E
.envrc                   # direnv — carica .env automaticamente (locale, non committare)
docker-compose.yml       # dev: tutti i servizi in locale
docker-compose.prod.yml  # prod: immagini ottimizzate, health check, no volume mount
```

---

## Roadmap Infrastruttura

> Le voci con 🔲 sono da implementare; quelle con ✅ sono già in produzione.

### 1. Portabilità da Replit

#### 🔲 `direnv` + `.envrc` per sviluppo locale

```bash
brew install direnv  # macOS / apt install direnv Linux
eval "$(direnv hook zsh)"  # nel .zshrc

# .envrc (mai committare — aggiungere a .gitignore)
export DATABASE_URL="postgresql://user:pass@localhost:5432/northstar"
export JWT_SECRET="..."
export ADMIN_KEY="..."
export AI_AGENTS_URL="http://localhost:8000"

direnv allow  # prima volta
```

#### 🔲 Secret Manager in produzione

| Cloud | Servizio |
|---|---|
| AWS | Secrets Manager — `@aws-sdk/client-secrets-manager` |
| GCP | Secret Manager — `@google-cloud/secret-manager` |
| Railway / Fly.io | Variables UI — iniettate come env vars |
| Replit (attuale) | Secrets tab — iniettate automaticamente |

#### ✅ DATABASE_URL già standardizzato

Drizzle usa `postgresql://user:pass@host:5432/db` — cambiare provider non richiede modifiche al codice.

---

### 2. Containerizzazione dev/prod

Vedi `docker-compose.yml` (dev con hot reload + DB locale) e `docker-compose.prod.yml` (immagini buildate, restart always, health check conservativi). In produzione il frontend è su CDN — non va containerizzato.

---

### 3. Health Check Endpoint

✅ **Express**: `GET /api/health` già presente in `app.ts` — risponde `{ status: "ok" }` senza auth.

🔲 **Express avanzato** (da migliorare): aggiungere check DB e AI agents come sub-check con risposta `200 healthy` / `503 degraded`. Vedi pattern in sezione **Qualità del Codice Backend**.

🔲 **FastAPI**: aggiungere `GET /health` in `artifacts/ai-agents/main.py`:
```python
import time
from datetime import datetime, timezone
_start_time = time.time()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _start_time),
    }
```

Regole: nessun auth, timeout < 1s, 200/503, non loggare le request `/health`.

---

## Testing & CI/CD

> **Strategia a 3 livelli**: Unit (Vitest, senza DB) → Integration (Vitest + Supertest, con DB reale) → E2E (Playwright, tutti i servizi). I livelli superiori girano solo se quelli inferiori passano.

### Panoramica livelli

| Livello | Tool | DB | Servizi | Velocità | Cosa testa |
|---|---|---|---|---|---|
| **Unit** | Vitest | ❌ | ❌ | < 5s | Logica pura: AI router, circuit breaker, retry, errorHandler, validateBody |
| **Integration** | Vitest + Supertest | ✅ PostgreSQL test | ❌ | < 30s | Endpoint Express con middleware stack reale, validazione, auth |
| **E2E** | Playwright | ✅ PostgreSQL e2e | ✅ tutti e 3 | ~2 min | Flussi utente completi: login, RIASEC, CV builder, discovery |

### Installazione dipendenze di test

```bash
# Vitest + Supertest per api-server
pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest --filter @workspace/api-server

# Playwright già presente nella root
# Verifica: pnpm exec playwright --version
```

### Script `package.json` da aggiungere in `api-server`

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

---

### 1. Unit Test — Vitest

I test unitari non toccano il database né la rete. Ogni modulo viene testato in isolamento usando `vi.mock()` per isolare i provider AI.

#### File presenti in `src/__tests__/unit/`

| File | Cosa testa | Test cases |
|---|---|---|
| `ai-router.test.ts` | Mapping use case → provider, override env, fallback logic | 7 |
| `circuit-breaker.test.ts` | Stati closed/open/half-open, threshold, recovery time | 6 |
| `retry.test.ts` | Backoff esponenziale, retryable errors, maxAttempts | 5 |
| `error-handler.test.ts` | ZodError → 400, AppError → statusCode, generic → 500, requestId | 5 |
| `validate-body.test.ts` | Body valido, invalido, strip campi extra, campo opzionale, null | 5 |

#### Pattern mock provider AI

```typescript
// Il mock viene dichiarato prima dell'import del modulo sotto test
const mockGroqCall = vi.fn();
vi.mock('../../lib/ai/providers/groq', () => ({ groqProvider: { chat: mockGroqCall } }));

// Ogni test resetta i mock
beforeEach(() => vi.clearAllMocks());

// Test: verifica che il router usi Groq per json_extraction
it('json_extraction usa Groq come provider default', () => {
  const provider = resolveProvider('json_extraction');
  expect(provider).toBe('groq');
});

// Test: verifica fallback su OpenAI se Groq fallisce
it('passa al fallback se il provider primary lancia errore', async () => {
  mockGroqCall.mockRejectedValueOnce(new Error('Groq 429 rate limit'));
  mockOpenAICall.mockResolvedValueOnce({ content: 'fallback response' });
  const result = await callWithFallback('json_extraction', { messages: [] });
  expect(result.content).toBe('fallback response');
});
```

#### Pattern mock req/res per middleware

```typescript
// Crea mock leggero di req/res Express senza installare librerie aggiuntive
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);  // chainable: res.status(400).json(...)
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}

const mockReq = { id: 'req-123', url: '/test', method: 'GET' };

// Uso nel test errorHandler:
errorHandler(new AppError(404, 'Not found', 'USER_NOT_FOUND'), mockReq, mockRes(), vi.fn());
expect(res.status).toHaveBeenCalledWith(404);
```

#### Fake timer per test retry e circuit breaker

```typescript
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('riprova dopo backoff esponenziale', async () => {
  const fn = vi.fn()
    .mockRejectedValueOnce(new Error('429 rate limit'))
    .mockResolvedValueOnce('ok dopo retry');

  const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
  await vi.runAllTimersAsync();  // avanza i timer senza aspettare davvero
  const result = await promise;
  expect(result).toBe('ok dopo retry');
  expect(fn).toHaveBeenCalledTimes(2);
});
```

---

### 2. Integration Test — Vitest + Supertest

I test di integrazione creano una app Express minimale con lo **stesso middleware stack del reale** (`validateBody`, `errorHandler`, `authMiddleware`), ma mockano i provider AI con `vi.mock()`. Il database è un PostgreSQL reale (locale o container CI).

#### File presenti in `src/__tests__/integration/`

| File | Endpoint testati | Focus |
|---|---|---|
| `health.test.ts` | `GET /api/health`, `GET /api/sectors`, `GET /api/objectives` | Public endpoints + auth protection |
| `cv-routes.test.ts` | `POST /api/cv/mine/generate`, `POST /api/cv/:id/tailor` | AI mock, validateBody, auth, error propagation |
| `admin-routes.test.ts` | `GET /api/admin/metrics`, `GET /api/admin/agent-health`, `GET /api/admin/growth-queue` | x-admin-key auth, struttura risposta |

#### Pattern Supertest

```typescript
import request from 'supertest';
import { app } from '../../app';  // l'app Express, senza .listen()

// Supertest crea un server temporaneo per ogni test — nessuna porta occupata
it('POST /api/cv/42/tailor con body valido → 200', async () => {
  mockAiChat.mockResolvedValueOnce({ tailored: true });

  const res = await request(app)
    .post('/api/cv/42/tailor')
    .set('Authorization', 'Bearer test-token')
    .send({
      jobTitle: 'Backend Engineer',
      jobDescription: 'Build scalable APIs for our European SaaS platform',
    });

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('tailored');
  expect(mockAiChat).toHaveBeenCalledWith(
    expect.objectContaining({ useCase: 'json_extraction' }),
  );
});
```

#### Regola: `app.ts` NON deve chiamare `listen()`

Per permettere a Supertest di gestire il server, `app.ts` deve **esportare `app`** e il `listen()` deve stare in `index.ts`:

```typescript
// app.ts — SOLO configurazione middleware + route
export const app = express();
app.use(express.json());
// ... middleware e route ...

// index.ts — SOLO avvio server
import { app } from './app';
const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => logger.info(`Server on port ${PORT}`));
```

#### Mock AI nei test di integrazione

```typescript
// Mock globale per tutti i test del file — nessuna chiamata reale a Groq/OpenAI
const mockAiChat = vi.fn();
vi.mock('../../lib/ai', () => ({ ai: { chat: mockAiChat } }));

// Reset tra i test per evitare interferenze
beforeEach(() => vi.clearAllMocks());

// Verifica che il router AI venga chiamato con il use case corretto
expect(mockAiChat).toHaveBeenCalledWith(
  expect.objectContaining({ useCase: 'json_extraction' }),
);
```

---

### 3. E2E Test — Playwright

I test E2E testano i flussi utente completi con browser reale (Chromium). Richiedono tutti e 3 i servizi attivi.

#### Spec esistenti + nuove

| File | Flusso | Status |
|---|---|---|
| `auth.spec.ts` | Login, register, logout | ✅ esistente |
| `test-riasec.spec.ts` | Test RIASEC completo 28 domande | ✅ esistente |
| `objectives.spec.ts` | Crea, aggiorna, completa obiettivo | ✅ esistente |
| `admin.spec.ts` | Admin dashboard, catalogs, agent health | ✅ esistente |
| `api.spec.ts` | API health, sectors, auth protection, admin | ✅ esistente |
| `cv-builder.spec.ts` | Genera CV, scegli template, download menu, ATS, ESC | 🔲 nuovo |
| `discovery-feed.spec.ts` | Feed cards, filtri tipo, insight pill, bookmark | 🔲 nuovo |

#### Convenzione `data-testid`

I selettori E2E usano `data-testid` — mai classi CSS o testo visibile (fragili ai refactor).

```typescript
// ❌ Fragile — dipende dal testo tradotto e dalla classe CSS
await page.click('.btn-primary >> text=Genera CV');

// ✅ Stabile — data-testid sopravvive a refactor di stile e i18n
await page.locator('[data-testid="cv-generate-btn"]').click();
```

#### `data-testid` obbligatori nei nuovi componenti CV

```typescript
// CvSection.tsx — aggiungere
<section data-testid="cv-section">
  <Button data-testid="cv-generate-btn">...</Button>
  <div data-testid="cv-download-menu">...</div>
  <Button data-testid="cv-ats-btn">...</Button>
</section>

// CvGeneratorModal.tsx — aggiungere
<div data-testid="cv-generator-modal">
  <div data-testid="template-classic">...</div>
  <div data-testid="template-minimal">...</div>
  <div data-testid="template-bold">...</div>
  <Button data-testid="cv-start-generate-btn">...</Button>
  <div data-testid="cv-generating-loader">...</div>
</div>

// CvDownloadMenu.tsx — aggiungere
<DropdownMenuItem data-testid="download-pdf-btn">PDF</DropdownMenuItem>
<DropdownMenuItem data-testid="download-docx-btn">DOCX</DropdownMenuItem>
```

#### `data-testid` obbligatori per Discovery

```typescript
// DiscoveryItemCard.tsx
<article data-testid="discovery-item-card">
  <span data-testid={`badge-${item.type}`}>{item.type}</span>
  <button data-testid="insight-pill">...</button>
  <div data-testid="insight-expanded">...</div>
  <button data-testid="bookmark-btn" aria-label={isBookmarked ? 'Rimuovi bookmark' : 'Aggiungi bookmark'}>
    ...
  </button>
</article>

// DiscoveryFeedPage.tsx — filtri
<button data-testid="filter-article">Articoli</button>
<button data-testid="filter-video">Video</button>
```

#### Utente di test — seed in CI

I test E2E che richiedono login usano `test@northstar.app` / `testpassword123`. Questo utente deve esistere nel DB di test. Aggiungere uno script di seed:

```typescript
// scripts/seed-test-user.ts
import { db } from '@workspace/db';
import bcrypt from 'bcryptjs';

await db.insert(users).values({
  email: 'test@northstar.app',
  passwordHash: await bcrypt.hash('testpassword123', 10),
  name: 'Test User',
  isPremium: true,  // necessario per testare feature premium
}).onConflictDoNothing();

console.log('✅ Test user creato/già esistente');
```

```bash
# Eseguire prima dei test E2E in CI
pnpm --filter @workspace/db tsx scripts/seed-test-user.ts
```

---

### 4. Pipeline CI — GitHub Actions

File: `.github/workflows/ci.yml`

#### Flusso pipeline

```
push a main/develop o PR verso main
        │
        ├── [typecheck]      TypeScript noEmit — blocca PR con errori di tipo
        ├── [unit-tests]     Vitest unit — nessun DB, < 5s
        ├── [integration-tests]  Vitest + Supertest — PostgreSQL container
        └── [e2e-tests]      Playwright — solo se unit + integration passano
                              └── PostgreSQL container
                              └── Build frontend + API
                              └── wait-on per health check
                              └── Playwright chromium
```

#### Ottimizzazioni pipeline

| Tecnica | Dove | Beneficio |
|---|---|---|
| `concurrency: cancel-in-progress` | tutti i job | Annulla run precedenti sullo stesso branch |
| `needs: [unit-tests, integration-tests]` | `e2e-tests` | Non esegue E2E (costoso) se i test veloci falliscono |
| `cache: 'pnpm'` | `setup-node` | Riusa `node_modules` tra run — ~60s risparmio |
| `upload-artifact` su failure | Playwright report | Debug rapido senza rieseguire |
| Coverage upload sempre | unit coverage | Storico copertura nel tempo |

#### Soglie coverage (`vitest.config.ts`)

```typescript
coverage: {
  thresholds: {
    lines:     70,  // minimo 70% righe coperte
    functions: 70,  // minimo 70% funzioni
    branches:  60,  // minimo 60% branch (if/else)
  },
}
```

Se la copertura scende sotto le soglie, Vitest esce con codice 1 e la CI fallisce.

---

### Checklist testing per ogni nuova feature

- [ ] **Unit test** per ogni nuovo modulo di business logic (router, middleware, utility)
- [ ] **Integration test** per ogni nuovo endpoint con `validateBody` — testare almeno: 200 con body valido, 400 con body invalido, 401 senza auth
- [ ] **`data-testid`** su tutti i nuovi elementi interattivi visibili all'utente
- [ ] **E2E spec** per ogni nuovo flusso utente critico (aggiungerlo a `e2e/`)
- [ ] Mock AI con `vi.mock('../../lib/ai')` nei test di integrazione — mai chiamate reali
- [ ] `beforeEach(() => vi.clearAllMocks())` in ogni describe che usa mock

---

## Qualità del Codice Backend

> **Stato attuale** (da `app.ts`): Pino HTTP ✅, CORS ✅, rate limiting ✅, security headers ✅, health check base ✅.
> **Mancano**: API versioning, error handler centralizzato con `requestId`, circuit breaker nel router AI, validazione Zod sui payload.

### 1. API Versioning — `/api/v1/`

Attualmente tutte le route sono su `/api/*`. Introdurre `/api/v1/` permette di rilasciare breaking changes in futuro senza interrompere client esistenti.

#### Come aggiornare `app.ts`

Il cambio è chirurgico — sostituire una riga:

```typescript
// Prima (attuale)
app.use("/api", router);

// Dopo
const v1Router = express.Router();
v1Router.use(router);          // tutte le route esistenti su /v1
app.use("/api/v1", v1Router);

// Compatibilità backward — redireziona /api/* → /api/v1/* (opzionale)
app.use("/api", (req, res, next) => {
  res.redirect(308, `/api/v1${req.url}`);
});
```

**Regola**: il frontend generato da Orval usa `VITE_API_BASE_URL`. Aggiornare quella variabile a `http://localhost:8080/api/v1` per lo sviluppo — zero modifiche ai hook generati.

#### Struttura futura per breaking change

```typescript
// routes/index.ts
const v1 = express.Router();
const v2 = express.Router();

v1.use("/cv", cvRouter);
v2.use("/cv", cvRouterV2);  // quando serve

export { v1, v2 };

// app.ts
app.use("/api/v1", v1);
app.use("/api/v2", v2);  // quando serve
```

---

### 2. Error Handler Centralizzato + requestId + Logging strutturato

#### 🔲 `middlewares/errorHandler.ts` — da creare

```typescript
// artifacts/api-server/src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as any).id;

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      requestId,
      issues: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code ?? 'APP_ERROR',
      message: err.message,
      requestId,
    });
    return;
  }

  logger.error({ err, requestId, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    requestId,
    message: 'Si è verificato un errore interno.',
  });
}
```

#### 🔲 Registrazione in `app.ts`

```typescript
import { errorHandler } from './middlewares/errorHandler';
app.use("/api/v1", v1Router);
app.use(errorHandler);  // ULTIMO middleware
```

#### Escludere `/health` dai log Pino

```typescript
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/api/v1/health',
  },
}));
```

---

### 3. Circuit Breaker + Retry esponenziale nel Router AI

#### 🔲 `lib/ai/utils/retry.ts`

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; retryOn?: (err: unknown) => boolean } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 300, retryOn = isRetryableError } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !retryOn(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') ||
           err.message.includes('timeout') ||
           err.message.includes('ECONNRESET');
  }
  return false;
}
```

#### 🔲 `lib/ai/utils/circuit-breaker.ts`

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 30_000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.recoveryTimeMs) {
        throw new Error(`Circuit OPEN per provider ${this.name} — riprova tra ${Math.ceil((this.recoveryTimeMs - elapsed) / 1000)}s`);
      }
      this.state = 'half-open';
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() { this.failureCount = 0; this.state = 'closed'; }
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) this.state = 'open';
  }
  getState() { return this.state; }
}

export const circuitBreakers = {
  groq:      new CircuitBreaker('groq'),
  anthropic: new CircuitBreaker('anthropic'),
  openai:    new CircuitBreaker('openai'),
  google:    new CircuitBreaker('google'),
};
```

| Stato | Significato | Comportamento router |
|---|---|---|
| `closed` | Provider funziona | Chiamata normale |
| `open` | Provider in errore (>5 fail) | Skip immediato → fallback |
| `half-open` | Recovery time scaduto | Ritenta una volta → se ok torna `closed` |

---

### 4. Validazione Zod sui payload in ingresso

#### 🔲 `middlewares/validateBody.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) { next(result.error); return; }
    req.body = result.data;
    next();
  };
}
```

#### Route prioritarie da validare subito

| Route | Motivo |
|---|---|
| `POST /cv/mine/upload` | Evita DoS con file non validi |
| `POST /cv/:id/tailor` | Payload AI — input non valido → costo inutile |
| `POST /cv/:id/ats-score` | Come sopra |
| `POST /auth/register` | Sanitizza email/password prima di bcrypt |
| `POST /business-ideas` | Payload AI potenzialmente lungo |
| `POST /admin/discovery/collect` | Protegge cron manuale da input malformati |

---

### Checklist qualità per ogni nuova route backend

- [ ] Registrata sotto `/api/v1/`
- [ ] `req.body` validato con `validateBody(ZodSchema)`
- [ ] Tutti i `catch` usano `next(err)`
- [ ] Nessuna chiamata diretta a provider AI — sempre `ai.chat()` / `ai.stream()` / `ai.embed()`
- [ ] Errori applicativi usano `throw new AppError(statusCode, message, code)`
- [ ] Integration test con almeno: 200 (happy path), 400 (body invalido), 401 (no auth)

---

## Qualità del Codice Frontend & UX

> **Stato attuale**: React 19 ✅, TanStack Query ✅, i18next 5 lingue ✅, Framer Motion ✅.
> **Ottimizzazioni consigliate**: memoization su componenti pesanti, `useTransition` per operazioni AI, audit i18n su lingue secondarie.

### 1. React.memo su componenti pesanti

| Componente | Perché memoizzare |
|---|---|
| `CvDocument` (in `CvGeneratorModal.tsx`) | Renderizza l'intero A4 — si ricostruisce ad ogni keystroke dell'`EditPanel` anche se `cv` non è cambiato |
| `CvSection` (in `CvGeneratorModal.tsx`) | Piccolo ma renderizzato ~8 volte per ogni update del documento |
| `EditBlock` (in `CvGeneratorModal.tsx`) | Componente collassabile — si re-renderizza anche quando altri blocchi cambiano |
| `DiscoveryItemCard` | Lista potenzialmente lunga — ogni update del feed parent causa re-render di tutti i card |

```typescript
const CvDocument = React.memo(function CvDocument({ cv }: { cv: GeneratedCv }) {
  return <div id="cv-document">...</div>;
});

// Prerequisito: prop-funzioni stabili con useCallback
const handleCvChange = useCallback((updated: GeneratedCv) => {
  setGenerated(updated);
}, []);
```

### 2. `useTransition` per operazioni AI asincrone

```typescript
const [isGenerating, startGenerate] = useTransition();
const [isTailoring, startTailor] = useTransition();

// Corretto: startTransition per aggiornamenti UI, await fuori
function handleGenerate() {
  startGenerate(() => setLoading(true));
  generate().finally(() => startGenerate(() => setLoading(false)));
}
```

### 3. Validazione configurazione i18n

```typescript
i18n.init({
  saveMissing: import.meta.env.DEV,  // rileva chiavi mancanti in console
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] Chiave mancante: "${key}" per lingue: ${lngs.join(', ')}`);
  },
});
```

Chiavi con `returnObjects: true` (`cv.tailorSteps`, `cv.letterSteps`, `cv.atsSteps`) DEVONO essere JSON array in tutti i file lingua.

### Checklist qualità per ogni nuovo componente frontend

- [ ] `React.memo` se il componente riceve oggetti/array come prop e il parent si re-renderizza spesso
- [ ] Funzioni passate come prop wrappate in `useCallback`
- [ ] Operazioni AI usano `useTransition`
- [ ] `useTranslation()` importato — zero stringhe visibili hardcoded in JSX
- [ ] Chiavi i18n aggiunte in tutti e 5 i file `translation.json`
- [ ] `data-testid` su ogni elemento interattivo visibile all'utente

---

## Sistema AI — Router e Modelli

> **⚠️ REGOLA FONDAMENTALE: ogni nuova funzionalità che usa l'AI DEVE passare dal router `artifacts/api-server/src/lib/ai/index.ts` via `ai.chat()`, `ai.agent()` o `ai.embed()`. Non chiamare mai direttamente OpenAI/Groq/Anthropic nelle route.**

### Architettura router

```
route.ts
  └→ ai.chat({ useCase: "json_extraction", messages })
       └→ router.ts: risolve provider (groq) + modello (llama-3.1-70b-versatile)
            └→ circuitBreaker[groq].execute()
                 └→ withRetry(() => providers/groq.ts)
                      └→ fallback: providers/openai.ts se circuit OPEN o retry esaurito
```

### Mapping use case → provider → modello

| Use Case | Provider default | Modello default | Fallback | Quando usarlo |
|---|---|---|---|---|
| `streaming_chat` | **Groq** | `llama-3.1-70b-versatile` | OpenAI `gpt-4o-mini` | Chat SSE, wiki AI, career coach real-time |
| `agent_analysis` | **Anthropic** | `claude-sonnet-4-5` | OpenAI `gpt-4o-mini` | Ragionamento complesso, tool use, RIASEC analysis |
| `embedding` | **OpenAI** | `text-embedding-3-small` | — nessuno | Vettori knowledge graph, RAG, similarity search |
| `research` | **Groq** | `llama-3.1-70b-versatile` | OpenAI `gpt-4o-mini` | Background job: news enrichment, discovery collect |
| `json_extraction` | **Groq** | `llama-3.1-70b-versatile` | OpenAI `gpt-4o-mini` | CV parse/generate/tailor, ATS score, cover letter |

### Regola decisionale per ogni nuova funzionalità AI

```
1. Risposta in streaming (SSE)? → streaming_chat (Groq)
2. Ragionamento profondo / tool use? → agent_analysis (Anthropic)
3. Embedding / RAG? → embedding (OpenAI)
4. Job in background? → research (Groq)
5. Altrimenti → json_extraction (Groq)
```

### Override senza redeploy

```bash
AI_JSON_PROVIDER=openai
AI_MODEL_OVERRIDE=gpt-4.1
AI_AGENT_PROVIDER=openai
```

---

## Internazionalizzazione (i18n) — Regola obbligatoria

> **⚠️ REGOLA FONDAMENTALE: zero stringhe hardcoded nel JSX. Ogni testo visibile usa `t("chiave")`.**

5 lingue: `it` (default) · `en` · `es` · `fr` · `de`.

### Checklist per ogni nuovo componente

- [ ] `useTranslation()` importato e usato
- [ ] Chiavi aggiunte in tutti e 5 i file `translation.json`
- [ ] `placeholder`, `title`, `aria-label` usano `t()`
- [ ] Valori dinamici usano interpolazione `{{var}}`
- [ ] Chiavi con `returnObjects: true` sono JSON array in tutti i file

---

## CV Builder

### Flusso principale

1. **Upload** — `POST /api/v1/cv/mine/upload` (PDF/TXT max 5MB) → AI estrae JSON
2. **Genera** — `POST /api/v1/cv/mine/generate` → AI da profilo RIASEC + knowledge graph
3. **Modifica** — `CvEditorDrawer` (drawer 520px, sezioni collassabili, salva via PATCH)
4. **Scarica** — `CvDownloadMenu` — PDF / DOCX / JSON

### API CV — endpoint

```
GET    /api/v1/cv/mine
POST   /api/v1/cv/mine/upload
POST   /api/v1/cv/mine/generate
PATCH  /api/v1/cv/mine/generated
DELETE /api/v1/cv/mine
GET    /api/v1/cv/:userId/pdf?template=
GET    /api/v1/cv/:userId/docx
POST   /api/v1/cv/:userId/tailor
POST   /api/v1/cv/:userId/cover-letter
GET    /api/v1/cv/:userId/cover-letter/pdf
POST   /api/v1/cv/:userId/ats-score
GET    /api/v1/cv/:userId/versions
POST   /api/v1/cv/:userId/versions
```

### Template PDF

| Template | Stile |
|---|---|
| `classic` | Verde scuro `#1a2e1a`, 2 colonne |
| `minimal` | Bianco, 1 colonna |
| `bold` | Navy `#0f172a` + Arancio `#f97316` |

---

## Sistema Discovery (Agenti AI)

### Pipeline
1. **Collector** — RSS + GNews/Tavily, SHA-256 dedup, ogni 6h
2. **Enricher** — gpt-4o-mini legacy, 5 parallele, priority queue, ogni 2h
3. **Personalizer** — score per RIASEC + journeyType, ogni 3h

---

## Admin Dashboard

`/admin` → 6 sezioni: Overview, Collector, Enricher, Fonti RSS, Item recenti, Agent Health.

---

## Prodotto — Funzionalità

### Core
- **RIASEC + Five Spirits** → 28 settori, roadmap, salary
- **AI premium:** Wiki AI, Roadmap generator, Skills Gap, Interview Simulator, Career Coach, Knowledge Graph RAG
- **Stripe subscription**, **Auth JWT custom**

### User Features
Journey Types, Career Climber Mode, NorthStar Score, Certificazioni, Onboarding Wizard, PostTest Funnel, Job Board, Business Idea Validator, Calendario .ics, TTS, Peer Review, CV Builder completo

### Admin Features
Catalogs CRUD, Agent Health Dashboard, Growth Queue, Setup Wizard

---

## Design System — Deep Navy Brand

- **Background:** `#0e1018` — mai `bg-white` o `bg-gray-*`
- **Accent Gold:** `#c19e4a` — CTA, nav attivo
- **Growth Green:** `#7db89a`
- **Brand tokens:** `src/lib/brand.ts` + `lib/design-tokens/northstar-theme.css`
- **Typography:** Inter + Playfair Display italic

---

## Architettura — Decisioni chiave

- **OpenAPI-first:** Orval genera Zod schemas + React Query hooks — client base URL aggiornare a `/api/v1`
- **Monorepo pnpm workspaces** con catalog
- **esbuild custom `build.mjs`:** bundla Express, esternalizza native modules
- **AI Router pattern:** ogni call AI passa da `lib/ai/index.ts` con circuit breaker + retry esponenziale
- **AI proxy legacy:** Express → Python FastAPI porta 8000 (LangGraph)
- **Startup check:** fail-fast su env vars obbligatorie
- **API versioning:** `/api/v1/` via `express.Router()` — backward compat con redirect 308 da `/api/`
- **Error handling:** middleware a 4 argomenti in `middlewares/errorHandler.ts` — `AppError`, `ZodError` → JSON strutturato con `requestId`
- **Validation:** `middlewares/validateBody(ZodSchema)` su ogni route con `req.body` da client
- **React.memo:** componenti pesanti wrappati con `memo` + `useCallback` sulle prop-funzioni
- **useTransition:** operazioni AI asincrone usano `startTransition` per mantenere UI responsiva
- **i18n:** i18next + react-i18next; fallback `it`; `saveMissing: true` in DEV
- **Testing a 3 livelli:** Vitest unit (nessun DB) → Vitest + Supertest integration (PostgreSQL) → Playwright E2E (tutti i servizi)
- **CI/CD:** GitHub Actions `.github/workflows/ci.yml` — 4 job in sequenza con `needs`
- **data-testid:** ogni elemento interattivo visibile deve avere `data-testid` stabile (mai classi CSS o testo)
- **Portabilità:** `DATABASE_URL` standardizzato; obiettivo zero dipendenze Replit-specifiche
- **Health check:** `GET /api/health` su Express (già attivo); `GET /health` su FastAPI (🔲 da aggiungere)
- **CORS:** ristretto a `CORS_ORIGIN` env var
- **Auth rate limiting:** `/auth/*` — 5 req/15min per IP

---

## Gotchas & regole

- **Porta 5000 obbligatoria** per il frontend — Replit webview preview usa solo quella
- **Ordine route critico:** route admin con solo `x-admin-key` DEVONO essere registrate prima di `calendarRouter`
- **API versioning:** il client Orval usa `VITE_API_BASE_URL` — aggiornare a `http://localhost:8080/api/v1` quando si attiva il versioning
- **Error handler:** DEVE essere l'ultimo `app.use()` in `app.ts`
- **ZodError in errorHandler:** catturato automaticamente se `validateBody` chiama `next(result.error)` — non wrappare in AppError
- **Circuit breaker — singleton:** istanze module-level; in serverless si resettano a ogni cold start — comportamento atteso
- **Retry su streaming:** `withRetry` NON va usato su `ai.stream()` — solo su `ai.chat()` e `ai.embed()`
- **React.memo — prerequisito:** `memo` è inutile senza `useCallback` sulle prop-funzioni
- **useTransition — async:** `startTransition` non gestisce Promise direttamente — wrappare solo gli update di stato
- **useTransition — streaming:** non usare con SSE — già non-blocking per natura
- **i18n — returnObjects:** chiavi `cv.tailorSteps`, `cv.letterSteps`, `cv.atsSteps` DEVONO essere JSON array — se stringhe, `.map()` crasha silenziosamente
- **Vitest — `app.ts` no listen:** Supertest richiede che `app.ts` esporti `app` senza chiamare `listen()` — il listen sta in `index.ts`
- **Vitest — fake timer:** usare `vi.useFakeTimers()` + `vi.runAllTimersAsync()` per testare retry/backoff senza aspettare
- **Playwright — data-testid:** mai selettori CSS o testo visibile — fragili a refactor e i18n
- **CI — E2E dipende da unit+integration:** `needs: [unit-tests, integration-tests]` evita sprechi di minuti CI su Playwright se i test base falliscono
- **pnpm workspace:** esegui sempre dalla root o usa `--filter`
- **Discovery feed cache:** LRU 5min server-side + sessionStorage 10min — `?refresh=1` per bypass
- **Enricher retry cap:** dopo 3 fallimenti, item marcato `isEnriched=true` con `score=0` — non riprocessato
- **AI Router — mai chiamare provider direttamente** nelle route (eccetto enricher legacy)
- **CV DOCX install:** `pnpm add docx --filter api-server` dopo ogni clone/reset
- **i18n — lingua default:** `it`. Fallback sempre italiano se chiave manca nelle altre lingue

---

## Pointers rapidi

| Cosa | Dove |
|---|---|
| Schema DB | `lib/db/src/schema/index.ts` |
| **App Express (middleware stack)** | `artifacts/api-server/src/app.ts` |
| API routes entry | `artifacts/api-server/src/routes/index.ts` |
| CV routes | `artifacts/api-server/src/routes/cv.ts` |
| CV components | `artifacts/orientamento/src/components/cv/` |
| Frontend routes | `artifacts/orientamento/src/App.tsx` |
| Cron jobs | `artifacts/api-server/src/jobs/cron.ts` |
| **AI Router** | `artifacts/api-server/src/lib/ai/router.ts` |
| **AI public API** | `artifacts/api-server/src/lib/ai/index.ts` |
| **AI types** | `artifacts/api-server/src/lib/ai/types.ts` |
| **AI providers** | `artifacts/api-server/src/lib/ai/providers/` |
| **Circuit breaker** | `artifacts/api-server/src/lib/ai/utils/circuit-breaker.ts` 🔲 |
| **Retry utility** | `artifacts/api-server/src/lib/ai/utils/retry.ts` 🔲 |
| **Error handler** | `artifacts/api-server/src/middlewares/errorHandler.ts` 🔲 |
| **Validate body** | `artifacts/api-server/src/middlewares/validateBody.ts` 🔲 |
| Logger Pino | `artifacts/api-server/src/lib/logger.ts` |
| **Vitest config** | `artifacts/api-server/vitest.config.ts` |
| **Unit tests** | `artifacts/api-server/src/__tests__/unit/` |
| **Integration tests** | `artifacts/api-server/src/__tests__/integration/` |
| **CI/CD pipeline** | `.github/workflows/ci.yml` |
| **E2E specs** | `e2e/` |
| i18n setup | `artifacts/orientamento/src/i18n.ts` |
| Traduzioni (it) | `artifacts/orientamento/src/locales/it/translation.json` |
| Discovery agents | `lib/integrations-openai-ai-server/src/discovery-agent/` |
| Brand tokens | `artifacts/orientamento/src/lib/brand.ts` |
