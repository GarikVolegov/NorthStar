# 🌟 NorthStar

> Piattaforma SaaS di orientamento professionale con AI agent, test RIASEC, CV builder e sistema di affiliazione.

---

## 📖 Documentazione

| Area | File |
|---|---|
| Architettura completa & changelog | [`replit.md`](./replit.md) |
| Backend API / Express / auth / middleware | [`API_RULES.md`](./API_RULES.md) |
| Database / Drizzle ORM / migrations / seed | [`DB_RULES.md`](./DB_RULES.md) |
| Frontend React / UI / Tailwind / Vite | [`FRONTEND_RULES.md`](./FRONTEND_RULES.md) |
| AI agent / OpenAI / Wendy / prompt | [`AI_RULES.md`](./AI_RULES.md) |
| Git / branching / commit / PR | [`GIT_RULES.md`](./GIT_RULES.md) |

> ⚠️ **Regola 0** — Prima di toccare qualsiasi area del codice, leggi il file RULES corrispondente. Non esistono eccezioni.

---

## 🚀 Setup rapido

### Prerequisiti
- Node.js ≥ 20
- pnpm ≥ 10
- PostgreSQL (locale o via Docker)
- Redis (opzionale — usato per cache profilo, degradazione silenziosa se assente)

### Installazione

```bash
git clone https://github.com/GarikVolegov/NorthStar.git
cd NorthStar

# Copia le variabili d'ambiente
cp .env.example .env
# Modifica .env con i tuoi valori

# Installa le dipendenze
pnpm install

# Esegui le migrazioni
pnpm db:migrate

# Avvia in sviluppo (server + web in parallelo)
pnpm dev
```

### Con Docker Compose

```bash
docker compose up postgres redis northstar-server
```

---

## 🔑 Variabili d'ambiente principali

Copia `.env.example` e compila i valori. Le variabili minime richieste:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/northstar

# Auth
JWT_SECRET=<secret-lungo-32-caratteri>

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis (opzionale)
REDIS_URL=redis://localhost:6379
PROFILE_CACHE_TTL_SECONDS=300
```

Vedi `.env.example` per l'elenco completo.

---

## 🏗️ Struttura del progetto

```
NorthStar/
├── apps/
│   ├── server/          # Express API (TypeScript)
│   └── web/             # React + Vite frontend
├── artifacts/           # Package condivisi (UI, tipi, agenti)
├── e2e/                 # Test Playwright end-to-end
├── scripts/             # Script utility (seed, secrets, deploy)
├── docs/                # Documentazione aggiuntiva
├── .github/             # GitHub Actions workflows
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .env.example
└── *.md                 # File RULES per area
```

---

## 🧪 Test

```bash
# Test E2E API
pnpm test:e2e

# Test E2E browser (auth, RIASEC, admin, obiettivi)
pnpm test:e2e:browser

# Test percorso critico referral
pnpm exec playwright test e2e/referral-flow.spec.ts

# Tutti i test
pnpm test:e2e:all
```

I test richiedono le variabili `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (e opzionalmente `TEST_AFFILIATE_EMAIL`, `TEST_AFFILIATE_PASSWORD`) nel file `.env.test`.

---

## 🛠️ Stack tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Cache | Redis (ioredis) |
| AI | OpenAI GPT-4o, multi-agent system |
| Pagamenti | Stripe |
| Deploy | Replit / Docker |
| Test | Playwright |
| Package manager | pnpm workspaces |
