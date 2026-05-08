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

# E2E tests (richiede tutti i servizi attivi)
pnpm test:e2e
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
| **E2E** | Playwright (chromium), specs in `e2e/` |
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
    src/
      app.ts             # Express app — middleware stack (security, Pino HTTP, CORS, rate limit)
      lib/
        ai/              # AI Router — PUNTO DI INGRESSO UNICO per tutte le call AI
          index.ts       # ai.chat(), ai.agent(), ai.embed() — API pubblica
          router.ts      # use case → provider + modello; override env
          types.ts       # AIUseCase, AIProviderName, AIRouterConfig...
          providers/     # implementazioni per ogni provider
        logger.ts        # istanza Pino condivisa
        security-headers.ts  # helmet-like security middleware
        global-rate-limiter.ts  # 200 req/min per IP
      middlewares/       # 🔲 da popolare: errorHandler, requestId, validateBody
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
e2e/                     # Playwright specs (auth, riasec, admin, objectives)
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

#### Stato attuale in `app.ts`

`app.ts` usa già `pinoHttp` con `logger` da `lib/logger.ts`. Il `req.id` è già popolato da pino-http (UUID auto-generato). **Manca** un error handler Express a 4 argomenti che lo usa.

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
  const requestId = (req as any).id;  // popolato da pino-http

  // Errori di validazione Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      requestId,
      issues: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  // Errori applicativi espliciti
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code ?? 'APP_ERROR',
      message: err.message,
      requestId,
    });
    return;
  }

  // Errori inattesi — logga stack, non esporre dettagli al client
  logger.error({ err, requestId, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    requestId,
    message: 'Si è verificato un errore interno.',
  });
}
```

#### 🔲 Registrazione in `app.ts`

Aggiungere **dopo** `app.use("/api/v1", v1Router)` — l'error handler Express deve essere l'**ultimo** middleware:

```typescript
import { errorHandler } from './middlewares/errorHandler';

// ... tutto il resto ...
app.use("/api/v1", v1Router);

// ─── ULTIMO middleware — error handler a 4 argomenti ─────────────────────────
app.use(errorHandler);
```

#### Come usarlo nelle route

```typescript
// In qualsiasi route handler — usa next(err) invece di try/catch inline
import { AppError } from '../middlewares/errorHandler';

router.get('/profile', async (req, res, next) => {
  try {
    const user = await getUser(req.userId);
    if (!user) throw new AppError(404, 'Utente non trovato', 'USER_NOT_FOUND');
    res.json(user);
  } catch (err) {
    next(err);  // passa all'errorHandler centralizzato
  }
});
```

#### Escludere `/health` dai log Pino

In `app.ts`, nel `pinoHttp`, aggiungere `autoLogging` per filtrare la route di health check:

```typescript
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/api/health' || req.url === '/api/v1/health',
    },
    serializers: { /* ... esistente ... */ },
  }),
);
```

---

### 3. Circuit Breaker + Retry esponenziale nel Router AI

Il router AI (`lib/ai/router.ts`) fa già fallback automatico al provider secondario. Il miglioramento consiste nell'aggiungere:
- **Retry esponenziale** con jitter per errori temporanei (timeout, rate limit 429)
- **Circuit breaker** che smette di chiamare un provider già in errore per N secondi, evitando cascate

#### 🔲 Pattern retry esponenziale — da integrare in ogni `providers/*.ts`

```typescript
// lib/ai/utils/retry.ts
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
      // Backoff esponenziale con jitter: delay = base * 2^attempt + random(0..base)
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    // Rate limit o timeout
    return err.message.includes('429') ||
           err.message.includes('timeout') ||
           err.message.includes('ECONNRESET');
  }
  return false;
}
```

#### 🔲 Pattern circuit breaker — da integrare in `router.ts`

```typescript
// lib/ai/utils/circuit-breaker.ts
type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 30_000,  // 30s
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

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState() { return this.state; }
}

// Istanze singleton per provider — una per processo
export const circuitBreakers = {
  groq:      new CircuitBreaker('groq'),
  anthropic: new CircuitBreaker('anthropic'),
  openai:    new CircuitBreaker('openai'),
  google:    new CircuitBreaker('google'),
};
```

**Integrazione in `router.ts`**: ogni chiamata a un provider viene wrappata in `circuitBreakers[provider].execute(() => withRetry(() => callProvider(...)))`. Se il circuit è `open`, il router salta direttamente al fallback.

#### Tabella stati circuit breaker

| Stato | Significato | Comportamento router |
|---|---|---|
| `closed` | Provider funziona | Chiamata normale |
| `open` | Provider in errore (>5 fail) | Skip immediato → fallback |
| `half-open` | Recovery time scaduto | Ritenta una volta → se ok torna `closed` |

---

### 4. Validazione Zod sui payload in ingresso

TypeScript protegge a compile-time, ma i payload JSON arrivano a runtime come `unknown`. Zod valida la forma reale e lancia errori strutturati (catturati dall'`errorHandler`).

#### 🔲 `middlewares/validateBody.ts` — da creare

```typescript
// artifacts/api-server/src/middlewares/validateBody.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);  // passa ZodError → errorHandler lo formatta come 400
      return;
    }
    req.body = result.data;  // body sostituito con dati tipati e sanitizzati
    next();
  };
}
```

#### Uso nelle route

```typescript
import { z } from 'zod';
import { validateBody } from '../middlewares/validateBody';

const TailorCvSchema = z.object({
  jobTitle:       z.string().min(1).max(200),
  jobDescription: z.string().min(10).max(5000),
  targetCompany:  z.string().max(200).optional(),
});

router.post(
  '/:userId/tailor',
  authMiddleware,
  validateBody(TailorCvSchema),   // ← validazione automatica
  async (req, res, next) => {
    try {
      const { jobTitle, jobDescription } = req.body;  // già tipato
      // ...
    } catch (err) {
      next(err);
    }
  },
);
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

#### Regola generale

> **Ogni route che accetta un `req.body` da client non autenticato DEVE avere `validateBody(ZodSchema)` come middleware.** Le route admin-only (protette da `x-admin-key`) possono usare Zod in modo più permissivo, ma è comunque consigliato.

---

### Checklist qualità per ogni nuova route backend

- [ ] Registrata sotto `/api/v1/` (non `/api/` diretto)
- [ ] `req.body` validato con `validateBody(ZodSchema)` se accetta payload
- [ ] Tutti i `catch` usano `next(err)` — mai `res.status(500).json(...)` inline
- [ ] Nessuna chiamata diretta a provider AI — sempre `ai.chat()` / `ai.stream()` / `ai.embed()`
- [ ] Errori applicativi usano `throw new AppError(statusCode, message, code)`

---

## Qualità del Codice Frontend & UX

> **Stato attuale**: React 19 ✅, TanStack Query ✅, i18next 5 lingue ✅, Framer Motion ✅.
> **Ottimizzazioni consigliate**: memoization su componenti pesanti, `useTransition` per operazioni AI, audit i18n su lingue secondarie.

### 1. React.memo su componenti pesanti

`React.memo` evita re-render costosi quando il componente padre cambia stato ma le props del figlio rimangono identiche. È particolarmente utile per componenti che contengono molto JSX o logica interna.

#### Candidati prioritari nel codebase

| Componente | Perché memoizzare |
|---|---|
| `CvDocument` (in `CvGeneratorModal.tsx`) | Renderizza l'intero A4 — si ricostruisce ad ogni keystroke dell'`EditPanel` anche se `cv` non è cambiato |
| `CvSection` (in `CvGeneratorModal.tsx`) | Piccolo ma renderizzato ~8 volte per ogni update del documento |
| `EditBlock` (in `CvGeneratorModal.tsx`) | Componente collassabile — si re-renderizza anche quando altri blocchi cambiano |
| `DiscoveryItemCard` | Lista potenzialmente lunga — ogni update del feed parent causa re-render di tutti i card |
| `TagInput` | Usato più volte nell'`EditPanel` — riceve `items` e `onChange` stabili se wrappati correttamente |

#### Pattern da seguire

```typescript
// Prima — si re-renderizza ad ogni update del parent
function CvDocument({ cv }: { cv: GeneratedCv }) {
  return <div id="cv-document">...</div>;
}

// Dopo — si re-renderizza solo se `cv` cambia (confronto shallow)
const CvDocument = React.memo(function CvDocument({ cv }: { cv: GeneratedCv }) {
  return <div id="cv-document">...</div>;
});
```

#### Regole per l'efficacia di `React.memo`

1. **Le prop devono essere stabili.** Se passi `onChange={() => ...}` inline, `memo` non serve — la funzione è nuova ad ogni render. Soluzione: `useCallback`.
2. **`CvGeneratorModal` usa già `useCallback` per `handleCvChange`** — ottimo, `memo` su `EditPanel` funzionerà correttamente.
3. **Non memoizzare tutto.** Componenti semplici (< 5 elementi DOM) costano più da confrontare che da re-renderizzare. Target: componenti con 20+ nodi o lista di item.

```typescript
// Combinazione corretta: memo + useCallback
const CvDocument = React.memo(function CvDocument({ cv }: { cv: GeneratedCv }) {
  // ...
});

// Nel parent (CvGeneratorModal) — già presente, da mantenere
const handleCvChange = useCallback((updated: GeneratedCv) => {
  setGenerated(updated);
  setHasUnsavedChanges(true);
  setSaveStatus("idle");
}, []);  // deps vuote: funzione stabile per tutta la vita del modale
```

---

### 2. `useTransition` per operazioni AI asincrone

`useTransition` (React 18+) marca un aggiornamento di stato come "non urgente", permettendo a React di mantenere l'interfaccia responsiva durante calcoli pesanti o fetch. L'utente può continuare a interagire (es. chiudere il modale) mentre la generazione è in corso.

#### Stato attuale in `CvGeneratorModal`

`generate()`, `tailorCv()`, `analyzeAts()` usano un semplice `useState` booleano (`loading`, `tailorStatus`). Il bottone viene disabilitato ma la UI si blocca finché il Promise non risolve.

#### Pattern con `useTransition`

```typescript
import { useTransition } from 'react';

// Nel componente
const [isPending, startTransition] = useTransition();

async function generate() {
  setError(null);
  startTransition(() => {
    // Gli aggiornamenti di stato qui dentro sono "non urgenti"
    // React può interromperli per gestire input urgenti (es. click su X)
    setLoading(true);
    setHasUnsavedChanges(false);
  });

  try {
    const res = await fetch(`${BASE}api/cv/generate`, { /* ... */ });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    startTransition(() => {
      setGenerated(data.generated);
      setIsEditing(false);
      setSaveStatus("idle");
      setLoading(false);
    });
  } catch (err: any) {
    setError(err.message || "Errore di rete.");
    setLoading(false);
  }
}
```

#### Differenza pratica

| Senza `useTransition` | Con `useTransition` |
|---|---|
| Click su "✕ Chiudi" durante fetch → nessuna risposta fino al completamento | Click su "✕ Chiudi" risponde immediatamente — React prioritizza l'evento |
| `isPending` non disponibile — serve stato `loading` manuale | `isPending` automatico — può sostituire parte degli stati `loading` |
| Re-render bloccante durante `setGenerated(largeObject)` | React può rimandare il re-render fino al frame disponibile |

#### Dove applicarlo nel progetto

```typescript
// CvGeneratorModal — generazione e tailor
const [isGenerating, startGenerate] = useTransition();
const [isTailoring, startTailor] = useTransition();
const [isAnalyzing, startAts] = useTransition();

// Nei bottoni — usa isPending al posto di loading state manuale
<Button disabled={isGenerating} onClick={() => startGenerate(() => generate())}>
  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
  {isGenerating ? t("cv.generating") : t("cv.regenerate")}
</Button>
```

#### Limitazione importante

`useTransition` non può wrappare direttamente una `async function`. Il pattern corretto è:

```typescript
// ❌ Non funziona — startTransition non gestisce Promise
startTransition(async () => {
  const data = await fetch(...);
  setState(data);
});

// ✅ Corretto — startTransition per aggiornamenti UI, await fuori
function handleGenerate() {
  startTransition(() => setLoading(true));  // UI update non urgente
  generate().finally(() => startTransition(() => setLoading(false)));
}
```

---

### 3. Validazione configurazione i18n

#### Stato attuale (da `i18n.ts`)

```typescript
// artifacts/orientamento/src/i18n.ts — già configurato correttamente
i18n.init({
  fallbackLng: "it",        // ✅ fallback definito
  supportedLngs: ["it", "en", "es", "fr", "de"],  // ✅ 5 lingue
  detection: {
    order: ["localStorage", "navigator"],
    lookupLocalStorage: "northstar_lang",  // ✅ chiave stabile
  },
});
```

La configurazione base è **solida**. I rischi sono nelle traduzioni, non nel setup.

#### Audit chiavi mancanti — pattern da adottare

Il comportamento di i18next quando una chiave manca: renderizza la **chiave grezza** (es. `cv.adaptCvTitle` invece del testo). Questo è visibile agli utenti nelle lingue secondarie se le chiavi non vengono aggiunte a tutti i file.

```typescript
// Hook da aggiungere in development — rileva chiavi mancanti in console
// artifacts/orientamento/src/i18n.ts
i18n.init({
  // ... config esistente ...
  saveMissing: import.meta.env.DEV,  // solo in dev
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`[i18n] Chiave mancante: "${key}" per lingue: ${lngs.join(', ')}`);
  },
});
```

#### Checklist stabilità lingue secondarie

`CvGeneratorModal` usa ~80 chiavi `cv.*`. Le lingue `en` e `de` sono quelle con più probabilità di avere gap perché l'italiano è la lingua di sviluppo primaria.

| Verifica | Come controllare |
|---|---|
| Chiavi `cv.*` presenti in `en` e `de` | `diff <(jq 'keys[]' locales/it/translation.json) <(jq 'keys[]' locales/en/translation.json)` |
| `t("cv.tailorSteps", { returnObjects: true })` ritorna array | Se la chiave non esiste, `map()` su una stringa causa crash silenzioso |
| Interpolazioni `{{var}}` consistenti | `cv.savedAt`, `cv.targetRole`, `cv.experienceN` usano `{{when}}`, `{{role}}`, `{{count}}` — devono essere presenti in tutte le lingue |
| Chiavi con `returnObjects: true` sono array | `cv.tailorSteps`, `cv.letterSteps`, `cv.atsSteps` — devono essere JSON array, non stringhe |

#### Script di audit rapido (da eseguire localmente)

```bash
# Trova chiavi presenti in IT ma mancanti in EN
node -e "
const it = require('./src/locales/it/translation.json');
const en = require('./src/locales/en/translation.json');

function flatKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v, prefix ? \`\${prefix}.\${k}\` : k)
      : [prefix ? \`\${prefix}.\${k}\` : k]
  );
}

const missing = flatKeys(it).filter(k => {
  const parts = k.split('.');
  let node = en;
  for (const p of parts) { node = node?.[p]; }
  return node === undefined;
});

console.log('Chiavi mancanti in EN:', missing.length);
missing.forEach(k => console.log(' -', k));
"
```

#### Regola per nuove chiavi

> Ogni nuova chiave aggiunta a `it/translation.json` **deve essere aggiunta nella stessa PR** a `en/translation.json`, `de/translation.json`, `es/translation.json`, `fr/translation.json`. Per le lingue secondarie è accettabile usare la traduzione italiana come placeholder temporaneo — l'importante è che la chiave esista e non renderizzi la chiave grezza.

---

### Checklist qualità per ogni nuovo componente frontend

- [ ] `React.memo` se il componente riceve oggetti/array come prop e il parent si re-renderizza spesso
- [ ] Funzioni passate come prop wrappate in `useCallback` (prerequisito per `memo`)
- [ ] Operazioni AI (fetch verso `/api/v1/cv/*`, `/api/v1/ai/*`) usano `useTransition` se bloccano la UI
- [ ] `useTranslation()` importato — zero stringhe visibili hardcoded in JSX
- [ ] Chiavi i18n aggiunte in tutti e 5 i file `translation.json`
- [ ] Chiavi con `returnObjects: true` sono JSON array in tutti i file lingua

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

Il file `index.ts` espone tre funzioni pubbliche:
- **`ai.chat(req)`** — per chiamate unary (JSON, analisi, generazione testo)
- **`ai.stream(req)`** — per SSE streaming (Wiki AI, career coach)
- **`ai.embed(req)`** — per embedding (knowledge graph, RAG)

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
1. Risposta in streaming (SSE) al client?
   → Sì  ┃ usa useCase: "streaming_chat"  (Groq — latenza < 200ms)
   → No  ┃
       2. Serve ragionamento profondo / tool calling / analisi multi-step?
          → Sì  ┃ usa useCase: "agent_analysis"  (Anthropic claude-sonnet-4-5)
          → No  ┃
              3. Serve embedding / similarità semantica / RAG?
                 → Sì  ┃ usa useCase: "embedding"  (OpenAI text-embedding-3-small)
                 → No  ┃
                     4. È un job in background (cron, pipeline batch)?
                        → Sì  ┃ usa useCase: "research"  (Groq — veloce, economico)
                        → No  ┃ usa useCase: "json_extraction"  (Groq — parse/generate JSON strutturato)
```

### Profili modelli disponibili

| Modello | Provider | Punti di forza | Costo relativo |
|---|---|---|---|
| `llama-3.1-70b-versatile` | Groq | Velocissimo (150+ tok/s), JSON mode, 128K ctx | 🟢 basso |
| `llama-3.3-70b-versatile` | Groq | Come sopra, migliorato su istruzioni | 🟢 basso |
| `claude-sonnet-4-5` | Anthropic | Ragionamento eccellente, tool use affidabile, 200K ctx | 🟡 medio |
| `claude-opus-4-5` | Anthropic | Max qualità, lento | 🔴 alto — solo casi critici |
| `gpt-4o-mini` | OpenAI | Bilanciato, fallback universale | 🟡 medio |
| `gpt-4.1` | OpenAI | Ragionamento avanzato, coding | 🔴 alto |
| `text-embedding-3-small` | OpenAI | Embedding 1536-dim, best-in-class | 🟢 basso |
| `gemini-1.5-flash` | Google | Alternativa rapida, multimodale | 🟢 basso |

### Override senza redeploy

```bash
AI_JSON_PROVIDER=openai        # sposta JSON extraction su OpenAI
AI_MODEL_OVERRIDE=gpt-4.1      # override globale modello
AI_AGENT_PROVIDER=openai       # sposta agent analysis su OpenAI
```

Valori validi per `AI_*_PROVIDER`: `groq` | `anthropic` | `openai` | `google`.

### Aggiungere un nuovo use case

1. Aggiungere tipo in `types.ts`
2. Aggiungere mapping in `router.ts` (`DEFAULT_ROUTER`, `FALLBACK_ROUTER`, `ENV_OVERRIDES`)
3. Aggiungere riga nella tabella sopra
4. Aggiungere env var di override nella sezione variabili d'ambiente

### Regola fallback e circuit breaker

- Il router tenta il provider **primary** → se circuit `open` o retry esaurito → **fallback**
- In caso di timeout (30s) o errore 5xx → retry esponenziale (max 3) con backoff
- `embedding` non ha fallback: se OpenAI è giù → `AIRouterError` — gestire esplicitamente
- Circuit breaker si apre dopo 5 fallimenti consecutivi, si chiude dopo 30s di recovery

### Costo operativo stimato

| Funzionalità | Use Case | Volume stimato | Costo/mese |
|---|---|---|---|
| Discovery enricher (20 item/run, ogni 2h) | `research` via enricher legacy | ~240 run | ~$0.10 |
| CV generate/tailor per utente | `json_extraction` | on-demand | ~$0.001/call |
| Wiki AI chat (streaming) | `streaming_chat` | on-demand | ~$0.0002/msg |
| Knowledge graph embedding | `embedding` | on-demand | ~$0.0001/call |
| RIASEC agent analysis | `agent_analysis` | on-demand | ~$0.003/call |

---

## Internazionalizzazione (i18n) — Regola obbligatoria

> **⚠️ REGOLA FONDAMENTALE: ogni componente React che mostra testo visibile all'utente DEVE usare `useTranslation`. Non esistono stringhe hardcoded in italiano (o altra lingua) nel JSX.**

L'app supporta **5 lingue**: `it` (default/fallback) · `en` · `es` · `fr` · `de`.

### Regole per ogni componente frontend

1. Importa sempre `useTranslation` e usa `t("chiave")`
2. Zero stringhe hardcoded nel JSX
3. Chiavi strutturate per dominio (`common.*`, `cv.*`, `dashboard.*`, `discovery.*`, `auth.*`, `admin.*`...)
4. Aggiorna sempre tutti e 5 i file `locales/{lang}/translation.json`
5. `placeholder`, `title`, `aria-label` usano `t()`
6. Non tradurre nel backend — solo nel frontend
7. Wrapper `ui/` ricevono testo già tradotto come prop
8. PR con stringhe hardcoded in JSX → rifiutata

### Checklist per ogni nuovo componente

- [ ] `useTranslation()` importato e usato
- [ ] Zero stringhe visibili hardcoded in JSX
- [ ] Chiavi aggiunte in tutti e 5 i file `translation.json`
- [ ] `placeholder`, `title`, `aria-label` usano `t()`
- [ ] Valori dinamici usano interpolazione `{{var}}`

---

## CV Builder

### Flusso principale

1. **Upload** — `POST /api/v1/cv/mine/upload` (PDF/TXT max 5MB) → AI estrae JSON
2. **Genera** — `POST /api/v1/cv/mine/generate` → AI da profilo RIASEC + knowledge graph
3. **Modifica** — `CvEditorDrawer` (drawer 520px, sezioni collassabili, salva via PATCH)
4. **Scarica** — `CvDownloadMenu` — PDF / DOCX / JSON

### API CV — endpoint

```
GET    /api/v1/cv/mine                    → lista CV
POST   /api/v1/cv/mine/upload             → upload + estrazione AI
POST   /api/v1/cv/mine/generate           → genera da profilo
PATCH  /api/v1/cv/mine/generated          → salva modifiche manuali
DELETE /api/v1/cv/mine                    → elimina tutto
GET    /api/v1/cv/:userId/pdf?template=   → PDF
GET    /api/v1/cv/:userId/docx            → DOCX
POST   /api/v1/cv/:userId/tailor          → adatta a offerta (AI)
POST   /api/v1/cv/:userId/cover-letter    → genera cover letter (AI)
GET    /api/v1/cv/:userId/cover-letter/pdf → PDF cover letter
POST   /api/v1/cv/:userId/ats-score       → ATS score 0-100 (AI)
GET    /api/v1/cv/:userId/versions        → lista versioni
POST   /api/v1/cv/:userId/versions        → salva versione
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
1. **Collector** (`collector-agent.ts`) — RSS + GNews/Tavily, SHA-256 dedup, ogni 6h
2. **Enricher** (`enricher-agent.ts`) — gpt-4o-mini legacy, 5 parallele, priority queue, ogni 2h, ~$0.10/mese
3. **Personalizer** (`personalizer-agent.ts`) — score per RIASEC + journeyType, ogni 3h

---

## Admin Dashboard

`/admin` → 6 sezioni: Overview, Collector, Enricher, Fonti RSS, Item recenti, Agent Health.

---

## Feed Discovery — UX

`DiscoveryFeedPage` → `DiscoveryItemCard` con filtri tipo/journeyType, pill insight GPT espandibile, bookmark, barra rilevanza colorata.

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
- **React.memo:** componenti pesanti (`CvDocument`, `CvSection`, `DiscoveryItemCard`) wrappati con `memo` + `useCallback` sulle prop-funzioni
- **useTransition:** operazioni AI asincrone (generate, tailor, ATS) usano `startTransition` per mantenere UI responsiva
- **i18n:** i18next + react-i18next; fallback `it`; `localStorage` key `northstar_lang`; `saveMissing: true` in DEV per audit chiavi mancanti
- **Portabilità:** `DATABASE_URL` standardizzato; obiettivo zero dipendenze Replit-specifiche
- **Health check:** `GET /api/health` su Express (già attivo); `GET /health` su FastAPI (🔲 da aggiungere)
- **Secret management:** `.envrc` + `direnv` in locale; secret manager cloud in produzione
- **CORS:** ristretto a `CORS_ORIGIN` env var
- **Auth rate limiting:** `/auth/*` — 5 req/15min per IP

---

## Gotchas & regole

- **Porta 5000 obbligatoria** per il frontend — Replit webview preview usa solo quella
- **Ordine route critico:** route admin con solo `x-admin-key` DEVONO essere registrate prima di `calendarRouter` (~riga 78 in `routes/index.ts`), altrimenti ricevono 401
- **API versioning:** il client Orval usa `VITE_API_BASE_URL` — aggiornare a `http://localhost:8080/api/v1` quando si attiva il versioning
- **Error handler:** DEVE essere l'ultimo `app.use()` in `app.ts` — dopo tutte le route. Se messo prima non cattura gli errori
- **ZodError in errorHandler:** catturato automaticamente se il middleware `validateBody` chiama `next(result.error)` — non wrappare ZodError in AppError
- **Circuit breaker — singleton:** le istanze `circuitBreakers` in `circuit-breaker.ts` sono module-level. In ambienti serverless (cold start frequenti) il circuit si resetta ad ogni istanza — comportamento atteso
- **Retry su streaming:** `withRetry` NON va usato su `ai.stream()` — uno stream non può essere riavviato dal client. Il retry si applica solo a `ai.chat()` e `ai.embed()`
- **React.memo — prerequisito:** `memo` è inutile se le prop-funzioni non sono wrappate in `useCallback`. `CvGeneratorModal` usa già `useCallback` su `handleCvChange` — da mantenere
- **useTransition — async:** `startTransition` non gestisce Promise direttamente. Wrappare solo gli aggiornamenti di stato, non l'intera funzione async
- **useTransition — streaming:** non usare con `ai.stream()` SSE — lo streaming è già non-blocking per natura
- **i18n — returnObjects:** chiavi usate con `{ returnObjects: true }` (`cv.tailorSteps`, `cv.letterSteps`, `cv.atsSteps`) DEVONO essere JSON array in tutti i file lingua. Se sono stringhe, `.map()` crasherà silenziosamente
- **i18n — saveMissing:** attivare solo in DEV (`import.meta.env.DEV`) — in produzione genererebbe rumore nei log
- **pnpm workspace:** esegui sempre dalla root o usa `--filter`
- **Growth scheduler:** si aspetta JSON valido da OpenAI; può warnare se il modello tronca l'output
- **`completion/me`:** usa SQL raw per `streak_days`/`last_active_at`
- **Errori tsc pre-esistenti:** `api-client-react` dist non buildata, params `any`-typed — non introdotti da feature nuove, ignorabili
- **Playwright:** `BASE_URL`/`API_URL` per staging
- **Discovery feed cache:** LRU 5min server-side + sessionStorage 10min — `?refresh=1` per bypass
- **Enricher retry cap:** dopo 3 fallimenti, item marcato `isEnriched=true` con `score=0` — non riprocessato
- **AI_MODEL (legacy):** configura enricher proxy Replit — non influenza il router `lib/ai/`
- **AI Router — mai chiamare provider direttamente** nelle route (eccetto enricher legacy)
- **CV editor:** `CvEditorDrawer` carica dati via GET al click matita — bottone nascosto se CV non esiste
- **CV DOCX install:** `pnpm add docx --filter api-server` dopo ogni clone/reset
- **i18n — chiave mancante:** i18next renderizza la chiave grezza. Aggiungere sempre a tutti e 5 i file
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
| OpenAI legacy client | `lib/integrations-openai-ai-server/src/client.ts` |
| i18n setup | `artifacts/orientamento/src/i18n.ts` |
| Traduzioni (it) | `artifacts/orientamento/src/locales/it/translation.json` |
| **i18n audit script** | `artifacts/orientamento/scripts/i18n-audit.js` 🔲 |
| Discovery agents | `lib/integrations-openai-ai-server/src/discovery-agent/` |
| Admin UI components | `lib/integrations-openai-ai-react/src/admin/` |
| Brand tokens | `artifacts/orientamento/src/lib/brand.ts` |
| Design tokens CSS | `lib/design-tokens/northstar-theme.css` |
