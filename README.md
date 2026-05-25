# 🌟 NorthStar

> Piattaforma SaaS di orientamento professionale con AI agent, test RIASEC, CV builder e sistema di affiliazione.

---

## ⚠️ Regola 0 — quale RULES leggere PRIMA di toccare codice

Prima di modificare qualsiasi area del progetto, apri **sempre** il file di regole specifico.

| Area di lavoro                                     | File da leggere                            |
| -------------------------------------------------- | ------------------------------------------ |
| Backend API / Express / router / middleware / auth | [`API_RULES.md`](./API_RULES.md)           |
| Database / Drizzle ORM / migrations / seed         | [`DB_RULES.md`](./DB_RULES.md)             |
| Frontend React / UI / Tailwind / Vite              | [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) |
| AI agent / OpenAI / Wendy / prompt                 | [`AI_RULES.md`](./AI_RULES.md)             |
| Git / branching / commit / PR                      | [`GIT_RULES.md`](./GIT_RULES.md)           |

Per capire dove posizionare file, script e documentazione, consulta anche
[`docs/REPOSITORY_STRUCTURE.md`](./docs/REPOSITORY_STRUCTURE.md).

---

## 🏗️ Architettura di NorthStar

NorthStar è una piattaforma SaaS modulare composta da:

### Servizi Docker

| Servizio             | Base/Image                    | Porta | Scopo                          |
| -------------------- | ----------------------------- | ----- | ------------------------------ |
| **PostgreSQL**       | postgres:16-alpine            | 5432  | Database principale            |
| **Redis**            | redis:7-alpine                | 6379  | Cache + rate limiting          |
| **AI Agents (ML)**   | Python FastAPI (`main.py`)    | 8000  | ML training/predizione modelli |
| **NorthStar Server** | Express + TS (`apps/server/`) | 3001  | API REST principale            |
| **Frontend**         | React + Vite (`apps/web/`)    | 5173  | SPA frontend                   |
| **Jaeger**           | jaegertracing/all-in-one      | 16686 | Distributed tracing UI         |

### Pacchetti Condivisi (pnpm workspace)

| Package                       | Path                         | Ruolo                                           |
| ----------------------------- | ---------------------------- | ----------------------------------------------- |
| `@workspace/ai-server`        | `packages/ai-server/`        | Orchestrazione AI multi-agente (Growth Agent)   |
| `@workspace/db`               | `packages/db/`               | Schema Drizzle ORM, migrazioni, pool PostgreSQL |
| `@workspace/api-zod`          | `packages/api-zod/`          | Schemi di validazione Zod condivisi             |
| `@workspace/api-spec`         | `packages/api-spec/`         | Specifica OpenAPI + codegen Orval               |
| `@workspace/api-client-react` | `packages/api-client-react/` | Client API React generato                       |
| `@workspace/ws-server`        | `packages/ws-server/`        | Server WebSocket per eventi real-time           |
| `@workspace/design-tokens`    | `packages/design-tokens/`    | Design system CSS tokens (tema Deep Navy)       |
| `@workspace/ml-client`        | `packages/ml-client/`        | Client TypeScript per ML API Python             |

### Comunicazione tra Servizi

- I servizi comunicano tramite rete interna Docker in produzione
- In sviluppo locale: `pnpm dev` avvia server + frontend con hot reload
- Health checks assicurano che i servizi siano pronti prima delle dipendenze
- **Frontend (Vite:5173)** ↔ **NorthStar Server (Express:3001)** via REST API + SSE
- **NorthStar Server** ↔ **PostgreSQL (5432)** via Drizzle ORM
- **NorthStar Server** ↔ **Redis (6379)** per cache e rate limiting
- **NorthStar Server** ↔ **WebSocket Server** (montato sullo stesso HTTP server)
- **NorthStar Server** ↔ **OpenAI/Groq API** per LLM e TTS
- **Python ML Service (8000)** ← **ml-client** per training/predizione modelli
- **Jaeger (16686)** ← **OpenTelemetry** da NorthStar Server per tracing

---

## 🔧 Setup e Configurazione

### Prerequisiti

- Docker e Docker Compose
- Git
- Node.js (>=20.10 <25; validato su Node 20 e Node 24) e pnpm (v10+) — per sviluppo locale
- Python 3.11+ — per il microservizio AI

### Setup in 3 comandi

```bash
cp .env.example .env   # compila i valori in .env
pnpm install            # installa dipendenze
pnpm dev                # avvia Docker (postgres, redis) + northstar-server :3001 + frontend :5173
```

### Variabili d'Ambiente

Copiare `.env.example` in `.env` e compilare:

```bash
cp .env.example .env
```

Le variabili necessarie includono:

- `OPENAI_API_KEY` — Chiave API OpenAI
- `JWT_SECRET` — Segreto per firme JWT
- `DATABASE_URL` — Connessione PostgreSQL

Opzionali:

- `TAVILY_API_KEY` — Chiave API Tavily
- `ADMIN_KEY` — Chiave per amministrazione
- `STRIPE_SECRET_KEY` — Chiave segreta Stripe
- `RESEND_API_KEY` — Chiave API Resend per email
- `GNEWS_API_KEY` — Chiave API GNews

> ⚠️ **NESSUNA** di queste chiavi deve essere committata nel repository.

### Regole di Sicurezza (vedi `GIT_RULES.md`)

- Controlli pre-commit impediscono l'aggiunta di segreti
- Usare `git diff --staged | grep -iE '(sk-|password|secret|key)=.'` per verificare

---

## 🐳 Docker Compose

### Servizi Definiti

Vedere [`docker-compose.yml`](./docker-compose.yml) per la configurazione completa (postgres, redis, ai-agents, northstar-server, frontend, jaeger).

### Comandi Utili

```bash
# Avvia solo il database (per sviluppo locale)
docker compose up postgres

# Avvio completo con build
docker compose up --build

# Avvio specifico servizi
docker compose up postgres northstar-server

# Visualizza logs
docker compose logs -f

# Arresta e rimuovi tutto
docker compose down -v
```

### Health Checks

Ogni servizio ha un health check configurato:

- PostgreSQL: `pg_isready -U northstar`
- Redis: `redis-cli ping`
- AI Agents (ML): `curl -f http://localhost:8000/health`
- NorthStar Server: `curl -f http://localhost:3001/api/health`

---

## 🐍 Microservizio Python AI

### Posizione

Il microservizio AI vive in root come servizio FastAPI indipendente, montato da `docker-compose.yml`.

### File Correlati

- `main.py`: punto di ingresso del server
- `pyproject.toml`: definisce le dipendenze e i metadati
- `uv.lock`: file di blocco delle dipendenze generato da `uv`
- `.python-version`: specifica la versione di Python (3.11)

### Dipendenze Principali

- fastapi, uvicorn — web framework
- langchain, langchain-openai, langgraph — AI orchestration
- openai — OpenAI API client
- scikit-learn, numpy, pandas — ML/data
- torch, tensorflow — deep learning (opzionali)

### Esecuzione

```bash
# Con uv (raccomandato)
uv sync
uvicorn main:app --host 0.0.0.0 --port 8000

# Oppure con pip tradizionale
pip install -e .
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Endpoints Disponibili

- `GET /` — Informazioni sul servizio
- `GET /health` — Health check
- `POST /train` — Avvia training modello ML in background
- `GET /train/{task_id}` — Controlla stato training
- `POST /predict` — Effettua predizioni
- `GET /models` — Lista modelli disponibili
- `GET /models/{model_id}` — Info su modello specifico
- `POST /models/{model_id}/load` — Carica modello pre-addestrato
- `POST /models/{model_id}/save` — Salva modello su disco

Documentazione API interattiva disponibile su `http://localhost:8000/docs` quando il server è in esecuzione.

> ℹ️ Il server AI è opzionale e non richiesto per l'esecuzione dell'applicazione principale.

---

## 💾 Database e Migrazioni

### Struttura

Il database utilizza PostgreSQL con schema gestito da Drizzle ORM.

### Eseguire Migrazioni

```bash
# Genera nuova migrazione
pnpm db:generate

# Applica migrazioni al database
pnpm db:migrate

# Esegui seed iniziali
pnpm db:seed
```

### Gestione Dati

- I seed iniziali contengono dati di esempio per sviluppo
- **NON** eseguire i seed in produzione senza cautela
- Per evitare sovrascritture in produzione, usare file di seed diversi o controllare l'ambiente

### Backup e Ripristino

```bash
# Backup database
docker exec -t northstar-postgres-1 pg_dump -U northstar northstar > backup.sql

# Ripristino database
cat backup.sql | docker exec -i northstar-postgres-1 psql -U northstar northstar
```

---

## 📦 Script Disponibili

```bash
pnpm dev               # sviluppo completo (Docker + server + frontend)
pnpm dev:web           # solo frontend Vite
pnpm dev:server        # solo northstar-server
pnpm build             # build per produzione
pnpm typecheck         # controlla tipi TypeScript (root + pacchetti)
pnpm lint:ci           # alias del lint globale bloccante CI/Vercel
pnpm lint:legacy       # alias compatibile del lint globale
pnpm check             # lint globale + typecheck
pnpm qa                # lint globale, typecheck, coverage e audit/ratchet qualita'
pnpm audit:file-size   # ratchet file-size: blocca nuovi monoliti o crescita legacy
pnpm test:ai           # test AI server
pnpm test:e2e          # test end-to-end (Playwright)
pnpm db:generate       # genera migrazioni Drizzle
pnpm db:migrate        # applica migrazioni
pnpm db:push           # push schema in dev (drizzle-kit push)
pnpm db:seed           # esegue seed dati
pnpm eval              # esegue eval suite AI
pnpm secrets           # genera JWT_SECRET e ADMIN_KEY
```

---

## 🤖 AI Agent — Growth Agent Multi-Agente

### Architettura

Il sistema AI principale è il **Growth Agent**, un'architettura multi-agente in `packages/ai-server/src/growth-agent/` che orchestra diversi moduli specializzati:

```
Richiesta Utente
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  1. ROUTER AGENT  — classifica dominio/intento        │
│     (career / mindset / habits / trading / general)   │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  2. MEMORY MANAGER  — carica contesto utente         │
│     (memoria persistente da coachMemory table)        │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  3. SPECIALIST AGENT*  — esecuzione dominio-specifica │
│     ├─ CareerAgent (CV, interviste, job search)       │
│     ├─ MindsetAgent (credenze limitanti, pattern)     │
│     ├─ HabitsAgent (routine, produttività)            │
│     └─ TradingAgent (psicologia, strategie)           │
│     * Se confident score ≥ 0.45 (self-evaluator gate) │
└──────────────────────────────────────────────────────┘
    │
    ├── RAG RETRIEVER — recupero knowledge base (pgvector/JS)
    ├── WEB SEARCH   — fallback via Tavily
    ├── CHAIN OF THOUGHT — ragionamento strutturato
    └── SELF EVALUATOR — valutazione euristica (zero LLM cost)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  4. SUPERVISOR AGENT  — quality gate post-generazione  │
│     Valuta: actionability, platitudeFree, lengthOk,    │
│     onTopic. Se score < 0.70 → riscrive.              │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  5. MEMORY EXTRACTION  — salvataggio memoria (fire-   │
│     and-forget) e aggiornamento sessioni              │
└──────────────────────────────────────────────────────┘
    │
    ▼
 Risposta → SSE streaming al client
```

### Moduli Avanzati

| Modulo                 | File                    | Scopo                                                     |
| ---------------------- | ----------------------- | --------------------------------------------------------- |
| **Parallel Handoff**   | `parallel-handoff.ts`   | Dispatch multi-specialista parallelo con estrazione delta |
| **Chain of Thought**   | `chain-of-thought.ts`   | Ragionamento strutturato con caching in-sessione          |
| **Session Summarizer** | `session-summarizer.ts` | Riassunto automatico delle sessioni chat                  |
| **Tone Adapter**       | `tone-adapter.ts`       | Adattamento tono in base al profilo utente                |
| **Socratic Engine**    | `socratic-engine.ts`    | Domande socratiche per approfondimento                    |
| **UI Tools**           | `ui-tools.ts`           | Generazione UI dinamica (roadmap, grafi)                  |
| **Prompt Builder**     | `prompt-builder.ts`     | Costruzione prompt di sistema                             |
| **Platform Ingest**    | `platform-ingest.ts`    | Ingestione contenuti piattaforma                          |
| **PDF Parser**         | `pdf-parser.ts`         | Parsing PDF per documenti utente                          |

### Wendy AI Chat

L'assistente virtuale **Wendy** è disponibile tramite:

- `POST /api/wendy/ask` — Chat streaming con RAG + LLM (SSE)
- `POST /api/wendy/voice` — Text-to-speech via OpenAI TTS
- Feature flags in `packages/ai-server/src/feature-flags.ts`:
  - `FF_PARALLEL_HANDOFF` — handoff parallelo
  - `FF_GENERATIVE_UI` — UI tools
  - `FF_CHAIN_OF_THOUGHT` — CoT
  - `FF_SUPERVISOR` — quality gate
  - `FF_MEMORY` — memoria persistente

### LLM Provider (`packages/ai-server/src/llm/`)

Supporto multi-provider con fallback automatico:

- **OpenAI** — GPT-4o, GPT-4o-mini, TTS, embeddings
- **Groq** — LLaMA 3.3 70B (mapping automatico da gpt-4o-mini)

Retry con backoff esponenziale (max 3 tentativi, 1s/2s/4s) su errori transitori (429, 503).

### Metriche AI (Prometheus)

| Metrica                             | Tipo      | Labels         |
| ----------------------------------- | --------- | -------------- |
| `wendy_requests_total`              | Counter   | domain, intent |
| `wendy_latency_seconds`             | Histogram | phase          |
| `wendy_supervisor_rewrites_total`   | Counter   | domain         |
| `wendy_llm_tokens_total`            | Counter   | model          |
| `wendy_router_confidence_histogram` | Histogram | domain, intent |

### Python ML Service (`main.py`)

Microservizio FastAPI per training e predizione di modelli ML (scikit-learn):

| Endpoint                  | Metodo | Descrizione                       |
| ------------------------- | ------ | --------------------------------- |
| `/`                       | GET    | Info servizio                     |
| `/health`                 | GET    | Health check                      |
| `/train`                  | POST   | Training asincrono (RandomForest) |
| `/train/{task_id}`        | GET    | Stato training                    |
| `/predict`                | POST   | Predizione                        |
| `/models`                 | GET    | Lista modelli caricati            |
| `/models/{model_id}`      | GET    | Info modello                      |
| `/models/{model_id}/load` | POST   | Carica modello da disco           |
| `/models/{model_id}/save` | POST   | Salva modello su disco            |

### Eval Framework (`docs/eval-wendy/`)

Suite di valutazione AI in TypeScript per testare qualità e regressioni:

- `docs/eval-wendy/run-eval.ts` — Runner valutazione
- `docs/eval-wendy/samples.json` — Campioni di test
- `docs/eval-wendy/history.json` — Storico valutazioni

---

## 📊 Monitoraggio e Tracing

### Jaeger (Distributed Tracing)

- UI: `http://localhost:16686` (Docker Compose)
- Endpoint OTLP: porta 4318
- Env: `OTEL_SERVICE_NAME=northstar-api`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`
- Tracing attivo su: Wendy chat, RAG retrieval, Growth Agent pipeline

### Prometheus Metrics

- `GET /api/metrics` — Endpoint Prometheus su NorthStar Server
- `GET /api/admin/wendy-metrics` — Metriche specifiche Wendy (protetto da ADMIN_KEY)
- Metriche pubblicate: conteggio richieste, latenza (istogrammi), token LLM, rewrites supervisor

### Audit Logging

- Middleware `apps/server/src/middleware/audit.ts`
- Scrittura immutabile su tabella `auditLog` per tutte le operazioni sensibili
- IP hashing per conformità GDPR (con `IP_HASH_SALT`)

### Logging Strutturato

- Pino logger in tutti i servizi
- Middleware request-id (`apps/server/src/middleware/request-id.ts`) assegna UUID univoco per richiesta
- Logging con contesto: method, path, userId, requestId

---

## 🔄 Migrazione e Aggiornamenti

### Quando Cambiare Architettura

Se si modificano componenti fondamentali:

1. Aggiornare questo file per riflettere i cambiamenti
2. Testare completamente in ambiente di sviluppo prima del deploy

### Script di Migrazione

Gli script in `scripts/` gestiscono:

- Migrazione struttura file
- Aggiornamento configurazioni
- Pulizia file obsoleti

---

## 🚨 Risoluzione Problemi Comuni

### Porte già in Uso

- Usa lo script PowerShell: `scripts/kill-port-5173.ps1` per killare il processo sulla porta 5173
- Cambia le porte mappate in `docker-compose.yml` se necessario

### "pnpm non disponibile"

- Installare globalmente: `npm install -g pnpm`
- Oppure usare: `corepack enable && corepack prepare pnpm@latest --activate`

### Problemi di Connessione Database

- Verificare: `docker compose ps postgres`
- Logs: `docker compose logs postgres`
- Verificare `DATABASE_URL` nel `.env`

### Microservizio ML Python Non Risponde

- Health: `curl http://localhost:8000/health`
- Logs: `docker compose logs ai-agents`
- Assicurarsi `OPENAI_API_KEY` sia impostata

### NorthStar Server Non Si Avvia

- Verificare migrazioni DB: `pnpm db:migrate`
- Controllare .env: `JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`
- Porta 3001 già in uso? Cambiare `PORT` nel .env

---

## 🔄 CI/CD (GitHub Actions)

| Workflow         | Trigger                    | Descrizione                                                     |
| ---------------- | -------------------------- | --------------------------------------------------------------- |
| `ci.yml`         | Push main/develop, PR main | Audit, lint globale, typecheck, coverage gate, build, E2E       |
| `staging.yml`    | Push develop               | Migration versionate, deploy Railway staging, release Sentry    |
| `production.yml` | Push main                  | Dry-run migration, migration production, deploy Railway, Sentry |
| `rollback.yml`   | Manuale                    | Rollback applicativo con DB safety check                        |
| `mobile-qa.yml`  | Schedule/trigger           | Lighthouse CI + test mobile Playwright                          |

### Gate qualita locali

`lint:ci` e' il gate lint bloccante usato da CI e Vercel ed e' ora alias del lint globale. `lint:legacy` resta disponibile come alias compatibile per i comandi storici.

### Percorso nuovo contributor

1. Leggi `CONTRIBUTING.md` per setup locale, comandi obbligatori e checklist PR.
2. Leggi `ARCHITECTURE.md` per flussi web, server, AI/RAG, DB e auth.
3. Usa `RUNBOOK.md` per rollback, hotfix e risposta incident.

## 📝 Note Importanti

1. **Documentazione Vivente** — Questo file deve essere aggiornato ogni volta che cambia l'architettura o il setup
2. **Zero Segreti** — Mai committare chiavi API, password o token in questo file o qualsiasi altro file nel repository
3. **Ambienti Diversi** — Le configurazioni possono variare tra sviluppo, staging e produzione
4. **Controlli Automatici** — Usare gli script di migrazione e i controlli pre-commit per mantenere la qualità

---

## 📚 Risorse Correlate

- [`API_RULES.md`](./API_RULES.md) — Dettagli su autenticazione, rate limiting, struttura rotte
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Setup contributor, checklist PR e gate locali
- [`SECURITY.md`](./SECURITY.md) — Responsible disclosure pubblico
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Overview C4, flussi runtime e pattern di sviluppo
- [`RUNBOOK.md`](./RUNBOOK.md) — Incident response, rollback e hotfix
- [`DB_RULES.md`](./DB_RULES.md) — Schema DB, convenzioni naming, indicazioni su migrazioni
- [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) — Componenti UI, stato globale, styling guidelines
- [`AI_RULES.md`](./AI_RULES.md) — Architettura AI agent, provider LLM, feature flags
- [`GIT_RULES.md`](./GIT_RULES.md) — Convenzioni commit, strategie branching, PR template
- [`docs/ai-modules/`](./docs/ai-modules/) — Documentazione dettagliata moduli AI
- [`docs/SEO-GEO-SEM.md`](./docs/SEO-GEO-SEM.md) — SEO, Generative Engine Optimization, SEM
- [`docs/staging-setup.md`](./docs/staging-setup.md) — Setup ambiente staging
- [`docker-compose.yml`](./docker-compose.yml) — Configurazione Docker completa
- [OpenAPI Spec](./packages/api-spec/openapi.yaml) — Specifica API completa
