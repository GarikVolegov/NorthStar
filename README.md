# 🌟 NorthStar

> Piattaforma SaaS di orientamento professionale con AI agent, test RIASEC, CV builder e sistema di affiliazione.

---

## ⚠️ Regola 0 — quale RULES leggere PRIMA di toccare codice

Prima di modificare qualsiasi area del progetto, apri **sempre** il file di regole specifico.

| Area di lavoro | File da leggere |
|---|---|
| Backend API / Express / router / middleware / auth | [`API_RULES.md`](./API_RULES.md) |
| Database / Drizzle ORM / migrations / seed | [`DB_RULES.md`](./DB_RULES.md) |
| Frontend React / UI / Tailwind / Vite | [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) |
| AI agent / OpenAI / Wendy / prompt | [`AI_RULES.md`](./AI_RULES.md) |
| Git / branching / commit / PR | [`GIT_RULES.md`](./GIT_RULES.md) |

---

## 🏗️ Architettura di NorthStar

NorthStar è una piattaforma SaaS modulare composta da:

### Servizi Principali
- **PostgreSQL** — Database principale (postgres:16-alpine)
- **Redis** — Cache per endpoint frequenti (redis:7-alpine)
- **AI Agents** — Microservizio Python per compiti AI specifici (porta 8000)
- **API Server Legacy** — Express server in `artifacts/` (porta 8080)
- **NorthStar Server** — Express server moderno in `apps/server/` (porta 3001)
- **Frontend** — React/Vite applicazione (porta 5173)
- **Jaeger** — UI per distributed tracing (porta 16686)

### Comunicazione tra Servizi
- I servizi comunicano tramite rete interna Docker
- Variabili d'ambiente configurano gli endpoint (es. `AI_AGENTS_URL=http://ai-agents:8000`)
- Health checks assicurano che i servizi siano pronti prima del dipendenza

---

## 🔧 Setup e Configurazione

### Prerequisiti
- Docker e Docker Compose
- Git
- Node.js (v20+) e pnpm (v10+) — per sviluppo locale
- Python 3.11+ — per il microservizio AI

### Setup in 3 comandi

```bash
cp .env.example .env   # compila i valori in .env
pnpm install            # installa dipendenze
pnpm dev                # avvia northstar-server :3001 + frontend :5173
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
- Usare `git diff --staged -- README.md | grep -iE '(sk-|password|secret|key)=.'` per verificare

---

## 🐳 Docker Compose

### Servizi Definiti
Vedere [`docker-compose.yml`](./docker-compose.yml) per la configurazione completa.

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
- AI Agents: `curl -f http://localhost:8000/health`
- API Server: `curl -f http://localhost:8080/api/health`
- NorthStar Server: `curl -f http://localhost:3001/api/health`

---

## 🐍 Microservizio Python AI

### Posizione
Il microservizio AI si trova nella radice del progetto come server FastAPI indipendente.

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
uv pip install -r pyproject.toml
uvicorn main:app --host 0.0.0.0 --port 8000

# Oppure con pip tradizionale
pip install -r pyproject.toml
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
pnpm dev               # sviluppo completo (server + frontend)
pnpm dev:web           # solo frontend Vite
pnpm dev:server        # solo northstar-server
pnpm build             # build per produzione
pnpm typecheck         # controlla tipi TypeScript
pnpm lint              # esegue ESLint
pnpm test:e2e          # test end-to-end
pnpm db:generate       # genera migrazioni Drizzle
pnpm db:migrate        # applica migrazioni
pnpm db:seed           # esegue seed dati
pnpm secrets           # genera JWT_SECRET e ADMIN_KEY
```

---

## 🤖 AI Agent e Task End-to-End

### Architettura degli AI Agent
Gli agenti AI seguono un pattern modulare:
1. **Input** — Richiesta da frontend o altro servizio
2. **Processing** — Logica agente in `packages/ai-server/src/*-agent/`
3. **Output** — Risposta strutturata o azione eseguita
4. **Memory** — Utilizzo di `memory-manager.ts` per contesto
5. **Evaluation** — `self-evaluator.ts` per auto-valutazione qualità

### Aggiungere un Nuovo Task AI
1. Crea nuovo agente in `packages/ai-server/src/[nome]-agent/`
2. Implementa logica principale in `[nome]-agent.ts`
3. Aggiungi endpoint in `router-agent.ts` se necessario
4. Aggiorna `index.ts` per esportare nuovo agente
5. Testa con script dedicati o tramite API

### Esempio di Flusso End-to-End
```
Frontend → NorthStar Server (Express) → AI Agent (Python)
→ Elaborazione → Risposta → Frontend
```

---

## 📊 Monitoraggio e Tracing

### Jaeger
- UI disponibile su `http://localhost:16686` quando eseguito via Docker Compose
- Configurato per ricevere tracce OTLP sulla porta 4318
- Abilitato tramite variabili d'ambiente:
  - `OTEL_SERVICE_NAME=northstar-api`
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318`

### Metriche e Logging
- Strutturato logging in tutti i servizi
- Health check endpoints per monitoring esterno
- Tracing distribuito tramite OpenTelemetry

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

### "pnpm non disponibile"
- Alcuni ambienti potrebbero non avere pnpm disponibile
- Soluzione: Usare configurazione Nix che installa pnpm globalmente

### Problemi di Connessione Database
- Verificare che il servizio PostgreSQL sia sano: `docker compose ps postgres`
- Controllare logs: `docker compose logs postgres`
- Assicurarsi che le variabili d'ambiente `DATABASE_URL` siano corrette

### Microservizio AI Non Risponde
- Controllare health endpoint: `curl http://localhost:8000/health`
- Verificare logs: `docker compose logs ai-agents`
- Assicurarsi che le variabili d'ambiente necessarie siano impostate (es. `OPENAI_API_KEY`)

### Porte già in Uso
- Cambiare le porte mappate in `docker-compose.yml` se necessario
- Esempio: cambiare `"8000:8000"` in `"8001:8000"` per evitare conflitti

---

## 📝 Note Importanti

1. **Documentazione Vivente** — Questo file deve essere aggiornato ogni volta che cambia l'architettura o il setup
2. **Zero Segreti** — Mai committare chiavi API, password o token in questo file o qualsiasi altro file nel repository
3. **Ambienti Diversi** — Le configurazioni possono variare tra sviluppo, staging e produzione
4. **Controlli Automatici** — Usare gli script di migrazione e i controlli pre-commit per mantenere la qualità

---

## 📚 Risorse Correlate

- [`API_RULES.md`](./API_RULES.md) — Dettagli su autenticazione, rate limiting, struttura rotte
- [`DB_RULES.md`](./DB_RULES.md) — Schema DB, convenzioni naming, indicazioni su migrazioni
- [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) — Componenti UI, stato globale, styling guidelines
- [`AI_RULES.md`](./AI_RULES.md) — Prompt engineering, modelli utilizzati, gestione costo
- [`GIT_RULES.md`](./GIT_RULES.md) — Convenzioni commit, strategie branching, PR template
- [`docker-compose.yml`](./docker-compose.yml) — Configurazione Docker completa
- [OpenAPI Spec](./packages/api-spec/openapi.yaml) — Specifica API
