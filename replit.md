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
      lib/
        ai/              # AI Router — PUNTO DI INGRESSO UNICO per tutte le call AI
          index.ts       # ai.chat(), ai.agent(), ai.embed() — API pubblica
          router.ts      # use case → provider + modello; override env
          types.ts       # AIUseCase, AIProviderName, AIRouterConfig...
          providers/     # implementazioni per ogni provider
      routes/            # 40+ route files organizzati per dominio
        cv.ts            # CV Builder — upload, generate, edit, PDF, DOCX, tailor, cover letter, ATS score
        discovery/       # feed.ts, saved.ts
        admin/           # agent-health, discovery-collect, discovery-sources,
                         # discovery-items, discovery-enrich, analyze-supervisor
        growth-agent/    # chat, knowledge, memory, analytics, notifications
      jobs/              # cron.ts (collector 6h, enricher 2h, personalizer 3h)
      middleware/        # jwt.ts, startup-check.ts
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

> Questa sezione documenta l'evoluzione pianificata dell'infrastruttura verso un'architettura cloud-native e portabile. Le voci contrassegnate con 🔲 sono da implementare; quelle con ✅ sono già in produzione.

### 1. Portabilità da Replit — dipendenze da eliminare

L'app attualmente dipende da variabili specifiche di Replit (`AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, database managed). L'obiettivo è renderla deployabile su qualsiasi cloud (Railway, Fly.io, GCP, AWS) senza modifiche al codice.

#### 🔲 Variabili d'ambiente cross-platform con `direnv`

Usa `direnv` per caricare automaticamente `.env` in sviluppo locale — equivalente al comportamento Replit, ma funziona ovunque:

```bash
# Installazione
brew install direnv  # macOS
apt install direnv   # Linux

# Nel shell rc (.zshrc / .bashrc)
eval "$(direnv hook zsh)"

# .envrc alla root del progetto (già listato in .gitignore)
export DATABASE_URL="postgresql://user:pass@localhost:5432/northstar"
export JWT_SECRET="..."
export ADMIN_KEY="..."
export AI_AGENTS_URL="http://localhost:8000"
# ... tutte le variabili opzionali

# Prima volta nella directory
direnv allow
```

Il file `.envrc` non va mai committato — contiene segreti locali. Aggiungere `.envrc` a `.gitignore`.

#### 🔲 Secret Manager in produzione

In produzione non usare file `.env` — usare il secret manager del cloud provider:

| Cloud | Servizio | Integrazione |
|---|---|---|
| **AWS** | Secrets Manager | SDK `@aws-sdk/client-secrets-manager`, fetch a startup |
| **GCP** | Secret Manager | `@google-cloud/secret-manager`, fetch a startup |
| **Railway / Fly.io** | Variables UI | Iniettate come env vars, stessa interfaccia `.env` |
| **Replit (attuale)** | Secrets tab | Iniettate come env vars automaticamente |

Pattern consigliato per il fetch a startup (da aggiungere in `startup-check.ts`):
```typescript
// Esempio GCP
if (process.env.NODE_ENV === 'production' && process.env.USE_SECRET_MANAGER) {
  const secrets = await fetchGCPSecrets(['JWT_SECRET', 'DATABASE_URL', ...]);
  Object.assign(process.env, secrets);
}
```

#### ✅ DATABASE_URL già standardizzato

Drizzle ORM usa già `DATABASE_URL` nella forma `postgresql://user:pass@host:5432/db`. Cambiare provider DB non richiede modifiche al codice — solo aggiornare la variabile d'ambiente.

---

### 2. Containerizzazione — ambienti dev/prod separati

#### 🔲 `docker-compose.yml` (sviluppo locale)

Ambienti separati tramite Docker Compose profiles. Obiettivo: `docker compose up` avvia tutto senza configurazione manuale.

```yaml
# docker-compose.yml — sviluppo
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: northstar
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev']
      interval: 5s
      timeout: 5s
      retries: 5

  api-server:
    build:
      context: .
      dockerfile: artifacts/api-server/Dockerfile.dev
    ports: ['8080:8080']
    env_file: .env
    volumes:
      - ./artifacts/api-server/src:/app/src  # hot reload
    depends_on:
      db:
        condition: service_healthy

  ai-agents:
    build:
      context: ./artifacts/ai-agents
      dockerfile: Dockerfile.dev
    ports: ['8000:8000']
    env_file: .env
    volumes:
      - ./artifacts/ai-agents:/app  # hot reload
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build:
      context: ./artifacts/orientamento
      dockerfile: Dockerfile.dev
    ports: ['5000:5000']
    env_file: .env
    volumes:
      - ./artifacts/orientamento/src:/app/src  # hot reload

volumes:
  pgdata:
```

#### 🔲 `docker-compose.prod.yml` (produzione)

```yaml
# docker-compose.prod.yml — produzione
version: '3.9'

services:
  api-server:
    image: ghcr.io/tuborg/northstar-api:latest
    restart: always
    env_file: .env.prod  # NO segreti in chiaro — usare secret manager
    ports: ['8080:8080']
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      ai-agents:
        condition: service_healthy

  ai-agents:
    image: ghcr.io/tuborg/northstar-ai:latest
    restart: always
    env_file: .env.prod
    ports: ['8000:8000']
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

# Nota: in prod il frontend è servito da CDN (Vercel/Cloudflare Pages)
# Non containerizzare il frontend — build statica deployata su edge
```

**Differenze chiave dev vs prod:**

| Aspetto | Dev | Prod |
|---|---|---|
| Hot reload | ✅ volume mount `src/` | ❌ immagine buildata |
| DB | Container locale | RDS / Cloud SQL / Neon |
| Frontend | Container Vite dev server | Build statica su CDN |
| Segreti | `.env` file | Secret Manager / env vars piattaforma |
| Restart policy | no | `always` |
| Health check | veloce (5s) | conservativo (30s + start_period) |

---

### 3. Health Check Endpoint — standard per tutti i servizi

Ogni servizio deve esporre `GET /health` che risponde entro 1 secondo. Usato da Docker, load balancer, Kubernetes readiness probe, e monitoraggio esterno.

#### 🔲 Express — `GET /health`

Aggiungere in `artifacts/api-server/src/routes/index.ts` **prima** di qualsiasi middleware auth:

```typescript
// routes/index.ts — prima riga, nessun middleware
app.get('/health', async (req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Check DB
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Check AI agents proxy
  try {
    const r = await fetch(`${process.env.AI_AGENTS_URL}/health`, { signal: AbortSignal.timeout(2000) });
    checks.ai_agents = r.ok ? 'ok' : 'error';
  } catch {
    checks.ai_agents = 'error';
  }

  const status = Object.values(checks).every(v => v === 'ok') ? 200 : 503;
  res.status(status).json({
    status: status === 200 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    checks,
  });
});
```

Risposta attesa (200 healthy):
```json
{
  "status": "healthy",
  "timestamp": "2026-05-08T12:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "ai_agents": "ok"
  }
}
```

#### 🔲 FastAPI — `GET /health`

Aggiungere in `artifacts/ai-agents/main.py`:

```python
import time
from fastapi import FastAPI
from datetime import datetime, timezone

app = FastAPI()
_start_time = time.time()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _start_time),
    }
```

#### Regole per `GET /health`

- **Nessun auth** — accessibile senza token o API key
- **Timeout massimo 1s** — se risponde dopo 1s, il check fallisce
- **200** se tutti i check passano, **503** se anche solo uno fallisce
- **Non loggare** le richieste `/health` (escludere da Pino/access log per evitare rumore)
- **Non includere segreti** nella risposta — solo stati `ok`/`error`
- Il frontend può esporre `GET /` che serve `index.html` — il health check del CDN è automatico

---

## Sistema AI — Router e Modelli

> **⚠️ REGOLA FONDAMENTALE: ogni nuova funzionalità che usa l'AI DEVE passare dal router `artifacts/api-server/src/lib/ai/index.ts` via `ai.chat()`, `ai.agent()` o `ai.embed()`. Non chiamare mai direttamente OpenAI/Groq/Anthropic nelle route.**

### Architettura router

```
route.ts
  └→ ai.chat({ useCase: "json_extraction", messages })
       └→ router.ts: risolve provider (groq) + modello (llama-3.1-70b-versatile)
            └→ providers/groq.ts: chiama API, gestisce timeout
                 └→ fallback: providers/openai.ts se groq fallisce
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

Quando si aggiunge una nuova feature che richiede un modello AI, seguire questo albero decisionale:

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

Per cambiare provider o modello su un use case specifico senza toccare il codice:

```bash
# Spostare tutto il JSON extraction su OpenAI (es. se Groq ha problemi)
AI_JSON_PROVIDER=openai

# Usare un modello specifico globalmente (override AI_MODEL_OVERRIDE)
AI_MODEL_OVERRIDE=gpt-4.1

# Override per il solo agent analysis
AI_AGENT_PROVIDER=openai
```

Valori validi per `AI_*_PROVIDER`: `groq` | `anthropic` | `openai` | `google`.
Se viene passato un valore non valido, il router logga un warning e usa il default.

### Aggiungere un nuovo use case

Se una feature non rientra in nessuno dei 5 use case esistenti:

1. Aggiungere il tipo in `types.ts`:
   ```typescript
   export type AIUseCase =
     | "streaming_chat" | "agent_analysis" | "embedding"
     | "research" | "json_extraction"
     | "nuovo_use_case";  // ← aggiungere qui
   ```
2. Aggiungere il mapping in `router.ts` (`DEFAULT_ROUTER`, `FALLBACK_ROUTER`, `ENV_OVERRIDES`)
3. Aggiungere la riga nella tabella qui sopra nel `replit.md`
4. Aggiungere la env var di override (`AI_NUOVOUSECASE_PROVIDER`) nella sezione **Variabili d'ambiente**

### Regola fallback

- Il router tenta sempre il provider **primary**
- In caso di timeout (30s) o errore 5xx, ritenta sul **fallback** (se configurato)
- `embedding` non ha fallback: se OpenAI è giù, l'operazione fallisce con `AIRouterError`
- Il fallback è sempre **OpenAI** (proxy Replit garantito attivo)

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
Setup in `src/i18n.ts`; file di traduzione in `src/locales/{lang}/translation.json`.

### Regole per ogni componente frontend

1. **Importa sempre `useTranslation`**
   ```tsx
   import { useTranslation } from "react-i18next";

   export function MioComponente() {
     const { t } = useTranslation();
     return <h1>{t("sezione.titolo")}</h1>;
   }
   ```

2. **Zero stringhe hardcoded nel JSX** — qualsiasi testo visibile (label, placeholder, tooltip, messaggio di errore, bottone, heading, badge, descrizione) deve passare da `t("chiave")`.
   ```tsx
   // ❌ VIETATO
   <Button>Salva</Button>
   <p>Nessun dato trovato.</p>

   // ✅ CORRETTO
   <Button>{t("common.save")}</Button>
   <p>{t("common.noData")}</p>
   ```

3. **Chiavi strutturate per dominio** — usa namespace a punti per raggruppare le chiavi logicamente:
   ```
   common.*          — azioni generiche (save, cancel, delete, loading, error…)
   cv.*              — CV Builder (upload, generate, edit, download…)
   dashboard.*       — Dashboard utente
   discovery.*       — Feed Discovery
   onboarding.*      — Wizard onboarding
   auth.*            — Login, registrazione
   admin.*           — Admin panel
   profile.*         — Pagina profilo
   settings.*        — Impostazioni lingua/profilo
   errors.*          — Messaggi di errore API
   ```

4. **Aggiorna sempre tutti e 5 i file** — quando aggiungi nuove chiavi, le aggiungi in tutti i file:
   - `src/locales/it/translation.json` (lingua base, testo definitivo)
   - `src/locales/en/translation.json`
   - `src/locales/es/translation.json`
   - `src/locales/fr/translation.json`
   - `src/locales/de/translation.json`

5. **Interpolazione variabili**
   ```tsx
   t("cv.generatedAt", { date: formatDate(cv.uploadedAt) })
   ```

6. **Plurali**
   ```tsx
   t("cv.experienceCount", { count: cv.experience.length })
   ```

7. **`title`, `aria-label`, `placeholder` — anch'essi tradotti**
   ```tsx
   <input placeholder={t("cv.namePlaceholder")} />
   ```

8. **Non tradurre nel backend** — le API restituiscono dati grezzi. La traduzione avviene solo nel frontend.

9. **Wrapper `ui/`** — ricevono il testo già tradotto come prop, non hardcoded internamente.

10. **PR** — stringhe hardcoded in JSX → rifiutata.

### Checklist per ogni nuovo componente

- [ ] `useTranslation()` importato e usato
- [ ] Zero stringhe visibili hardcoded in JSX
- [ ] Chiavi aggiunte in tutti e 5 i file `translation.json`
- [ ] `placeholder`, `title`, `aria-label` usano `t()`
- [ ] Messaggi di errore/successo usano chiavi `errors.*` o `common.*`
- [ ] Valori dinamici usano interpolazione `{{var}}`

---

## CV Builder

Sistema completo per generare, modificare manualmente e scaricare il CV in più formati.

### Flusso principale

1. **Upload CV** — `POST /api/cv/mine/upload` (PDF o TXT, max 5 MB) → AI estrae JSON strutturato
2. **Genera da profilo** — `POST /api/cv/mine/generate` → AI genera CV da grafo conoscenze + profilo RIASEC
3. **Modifica manuale** — icona matita → apre `CvEditorDrawer` (drawer laterale 520px)
4. **Scarica** — dropdown `CvDownloadMenu` con 3 formati

### CvEditorDrawer — Editor manuale

| Sezione | Campi |
|---|---|
| 👤 Informazioni personali | Nome, Titolo, Email, Telefono, Sede, LinkedIn, Sito, Ruolo target |
| ✦ Profilo / Sommario | Textarea libera |
| 💼 Esperienze | CRUD — ruolo, azienda, periodo, sede, descrizione, tag skill |
| 🎓 Formazione | CRUD — titolo, istituto, anno, note |
| 🔧 Competenze & Strumenti | Tag-editor per `skills` e `tools` |
| 🌐 Lingue | Riga per lingua + livello |
| 🏅 Certificazioni | Tag-editor |

### CvDownloadMenu — Formati

| Formato | Endpoint / Meccanismo |
|---|---|
| **PDF** | `GET /api/cv/:userId/pdf?template=` |
| **Word (DOCX)** | `GET /api/cv/:userId/docx` — server-side via `docx` |
| **JSON** | Blob client-side dal `generatedCvData` |

### API CV — endpoint

```
GET    /api/cv/mine                    → lista CV
POST   /api/cv/mine/upload             → upload + estrazione AI
POST   /api/cv/mine/generate           → genera da profilo
PATCH  /api/cv/mine/generated          → salva modifiche manuali
DELETE /api/cv/mine                    → elimina tutto
GET    /api/cv/:userId/pdf?template=   → PDF
GET    /api/cv/:userId/docx            → DOCX
POST   /api/cv/:userId/tailor          → adatta a offerta (AI)
GET    /api/cv/:userId/versions        → lista versioni
POST   /api/cv/:userId/versions        → salva versione
POST   /api/cv/:userId/cover-letter    → genera cover letter (AI)
GET    /api/cv/:userId/cover-letter/pdf → PDF cover letter
POST   /api/cv/:userId/ats-score       → ATS score 0-100 (AI)
```

### Template PDF

| Template | Stile |
|---|---|
| `classic` | Verde scuro `#1a2e1a`, 2 colonne |
| `minimal` | Bianco, 1 colonna |
| `bold` | Navy `#0f172a` + Arancio `#f97316` |

---

## Sistema Discovery (Agenti AI)

Pipeline a 3 stadi che raccoglie, arricchisce e personalizza contenuti per ogni utente.

### 1. Collector Agent — `collector-agent.ts`
- Raccoglie da RSS configurabili + API (GNews, Tavily); deduplication via SHA-256
- Schedule: **ogni 6 ore** — `POST /api/admin/discovery/collect`

### 2. Enricher Agent — `enricher-agent.ts`
- **gpt-4o-mini** via proxy Replit legacy; 5 call parallele; retry max 3
- Priority queue: opportunity (5) > formation (4) > sector_trend (3) > news (2) > growth (1)
- Filtro: `relevanceScore < 0.25` → non appare nel feed
- Costo: ~$0.10/mese — Schedule: **ogni 2 ore**

### 3. Personalizer Agent — `personalizer-agent.ts`
- Sovrascrive `personalScore` per profilo RIASEC + journeyType — Schedule: **ogni 3 ore**

---

## Admin Dashboard

Percorso: `/admin` → `<AdminDashboard />` (6 sezioni: Overview, Collector, Enricher, Fonti RSS, Item recenti, Agent Health).

---

## Feed Discovery — UX

`DiscoveryFeedPage` → `DiscoveryItemCard` con filtri tipo/journeyType, pill insight GPT espandibile, bookmark, barra rilevanza colorata.

---

## Prodotto — Funzionalità

### Core
- **RIASEC + Five Spirits test** → matching 28 settori, roadmap, salary
- **AI features (premium):** Wiki AI, Roadmap generator, Skills Gap, Interview Simulator, Career Coach, Knowledge Graph RAG
- **Stripe subscription**, **Auth JWT custom**

### User Features
- Journey Types, Career Climber Mode, NorthStar Score pubblico, Certificazioni, Onboarding Wizard, PostTest Funnel, Job Board, Business Idea Validator, Calendario .ics, TTS, Peer Review obiettivi, CV Builder completo

### Admin Features
- Catalogs CRUD, Agent Health Dashboard, Growth Queue, Setup Wizard

---

## Design System — Deep Navy Brand

- **Background:** `#0e1018` — mai `bg-white` o `bg-gray-*`
- **Accent Gold:** `#c19e4a` — CTA, nav attivo
- **Growth Green:** `#7db89a`
- **Brand tokens:** `src/lib/brand.ts` + `lib/design-tokens/northstar-theme.css`
- **Typography:** Inter + Playfair Display italic

---

## Architettura — Decisioni chiave

- **OpenAPI-first:** Orval genera Zod schemas + React Query hooks
- **Monorepo pnpm workspaces** con catalog
- **esbuild custom `build.mjs`:** bundla Express, esternalizza native modules
- **AI Router pattern:** ogni call AI passa da `lib/ai/index.ts` — provider trasparente per le route
- **AI proxy legacy:** Express → Python FastAPI porta 8000 (LangGraph)
- **Startup check:** fail-fast su env vars obbligatorie
- **Portabilità:** `DATABASE_URL` standardizzato; obiettivo zero dipendenze Replit-specifiche nel codice
- **Health check:** `GET /health` su Express (porta 8080) e FastAPI (porta 8000) — nessun auth, risposta < 1s
- **Secret management:** `.envrc` + `direnv` in locale; secret manager cloud in produzione
- **C