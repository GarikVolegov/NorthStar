# DEPLOY — percorso al primo euro (NorthStar)

> Checklist operativa per portare NorthStar in produzione e incassare il primo
> pagamento. Aggiornato da Opus 4.8 (2026-06-24: deploy schema via `drizzle-kit push`, §2).
> Riferimenti: [`vercel.json`](../vercel.json), [`.github/workflows/production.yml`](../.github/workflows/production.yml),
> [`RUNBOOK.md`](../RUNBOOK.md), [`memoria.md`](../memoria.md) §8, [`.env.example`](../.env.example).

## 0. Decisione architetturale (da prendere PRIMA)

Il server (`apps/server/src/index.ts`) avvia **cron job, WebSocket, scheduler, leader-lock,
plugin AI** → è un **processo long-running**, NON un handler serverless stateless.

- **Target consigliato: Railway** per l'API (`production.yml` fa già `railway up`), **Vercel** solo per la SPA statica che punta all'API Railway (`VITE_API_URL`).
- In alternativa Vercel serverless per l'API **non eseguirebbe** cron/WS/scheduler → da evitare finché il codice è così.

## 1. Prerequisiti legali/account (lead-time più lungo — avviare SUBITO, in parallelo)

- [ ] **Identità legale**: P.IVA / ditta individuale o SRL. Inserire ragione sociale, P.IVA e sede nella **privacy policy** (oggi è una bozza con titolare "NorthStar" senza dati reali — `apps/web/src/locales/it/translation.json` chiave `privacy.s1P1`). Obbligatorio per fatturare in EU.
- [ ] **Account Stripe** + completare il **KYC**. Finché in KYC, restare in **test mode**.
- [ ] Far validare privacy + termini da un professionista (oggi auto-dichiarati "bozza operativa").

## 2. Schema DB: `drizzle-kit push` come fonte di verità (su STAGING, mai prod) — rischio #1

> **Decisione 2026-06-24 (founder):** staging/prod costruiscono lo schema con **`drizzle-kit push`**
> (lo schema Drizzle in `packages/db/src/schema/**` è l'**unica fonte di verità**), come già fanno
> dev, e2e e i test d'integrazione. Si **ritira** `db:migrate` journal-driven.

**Perché non `db:migrate`:** il chain SQL è **strutturalmente incompleto**, non solo "journal fermo a idx 34".
Il runtime migrator legge solo `meta/_journal.json` (idx 0–34) + `${tag}.sql`, ma alcune tabelle dello
schema (verificate: `coach_memory_patterns`, `coach_memory_facts`, `discovery_sources`, +altre) **non
hanno alcun `CREATE TABLE` in nessun `.sql`** — esistono solo via push. Quindi `db:migrate` su un DB
**fresco** fallirebbe (es. `ALTER TABLE coach_memory_patterns` in `0036` su tabella inesistente), e anche
riconciliando il journal resterebbe rotto. (Dettaglio: memoria utente `northstar-drizzle-migration-chain-incomplete`.)

- [ ] Creare un **DB di staging** (Neon branch o Postgres+pgvector separato). **MAI testare su prod.**
- [x] **Fatto (2026-06-24):** `staging.yml` e `production.yml` eseguono ora **`db:push`** (`drizzle-kit push`, con `DATABASE_URL_MIGRATOR`) al posto di `db:migrate`/`db:migrate:dry-run`. È il push **non forzato** (mai `push-force`): le modifiche additive sono idempotenti, quelle distruttive abortiscono il job invece di cancellare dati. **Validare prima su staging** (DB fresco → push → schema completo, pgvector OK).
- [ ] Far girare i **test d'integrazione DB-reale** contro lo staging. Sono **opt-in** (per non colpire mai il DB prod del `.env`): `RUN_DB_INTEGRATION=1 DATABASE_URL=<staging> vitest run src/routes/*.integration.test.ts --root apps/server`. Già verdi su DB di testing: `applications.integration`, `market-intelligence.integration`.
- [ ] **Prod esistente (già popolato):** il **primo** push va fatto con cautela — generare prima il diff (`drizzle-kit push --strict` / dry-run) e **rivederlo a mano** per escludere DROP distruttivi prima di applicarlo. Backup DB prima.
- [ ] I vecchi file `packages/db/drizzle/*.sql` + `meta/_journal.json` restano come storia; non sono più il driver del deploy (si possono lasciare o archiviare in seguito).

## 3. Variabili d'ambiente di produzione

**Obbligatorie** (l'app non parte / non incassa senza):
- [ ] `DATABASE_URL` + `DATABASE_URL_MIGRATOR` (Neon, con `?sslmode=require`).
- [ ] `JWT_SECRET` — **hard-fail al boot** se assente/<32 char (`apps/server/src/lib/jwt-secret.ts`). Generare con `pnpm secrets` (≥32 char, varietà).
- [ ] Almeno **una AI key**: consigliata `OPENROUTER_API_KEY` (free tier → costo LLM ~€0). Il model-router usa modelli `:free`/Groq di default.
- [ ] **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, e i 4 Price ID `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` / `STRIPE_TEAM_MONTHLY_PRICE_ID` / `STRIPE_TEAM_YEARLY_PRICE_ID` (+ gli `*_PRICE_EUR` per il display FE).
- [ ] `ALLOWED_ORIGINS` / `APP_BASE_URL` (per i success/cancel URL Stripe e CORS).

**Opzionali (degradano con grazia)**: `REDIS_URL` (cache + rate-limit + **quote freemium**: senza Redis i gate sono fail-open → consigliato in prod), `SENTRY_DSN` (errori dal giorno 1), `OPENAI_API_KEY` (solo per TTS/Whisper/embeddings OpenAI).

## 4. Stripe: da test a live

1. In **test mode**: crea i 4 Prodotti/Price (Pro mensile/annuale, Team mensile/annuale), copia i Price ID nelle env di staging, verifica il checkout end-to-end con [carta di test](https://docs.stripe.com/testing) `4242 4242 4242 4242`.
2. Verifica il **webhook**: endpoint `POST /api/subscription/webhook`, eventi `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`. Copia il `STRIPE_WEBHOOK_SECRET`.
3. Verifica il ritorno: dopo il pagamento Stripe redirige a `/premium/successo` (già allineato in `subscription.ts`).
4. Passa a **live** solo dopo KYC: ricrea i Price in live, aggiorna le env prod, ri-registra il webhook con l'URL prod.

## 5. Go-live (decisione umana)

> Merge su `main` = **deploy in produzione** (`production.yml`: typecheck → unit test → **schema DB prod via `db:push`** → `railway up` → health check `/api/health` → release Sentry). Lo step schema usa già `db:push` (§2); validarlo su staging **prima** del merge.

1. [ ] Configurare i secret dell'Environment GitHub "production" (`production.yml` linee 9-26: `PRODUCTION_DATABASE_URL_MIGRATOR`, `PRODUCTION_JWT_SECRET`, `RAILWAY_PROD_API_TOKEN`, `RAILWAY_PROD_SERVICE_ID`, env Stripe, `SENTRY_*`).
2. [ ] Merge `release/launch-candidate` → `main` (dopo aver mergiato `ralph/launch-completion` in `release/launch-candidate`).
3. [ ] **Smoke test post-deploy**: signup → test RIASEC → dashboard popolata → `/premium` checkout reale → webhook ricevuto → piano "Pro" attivo → **primo euro incassato**.

## 6. Costo infra mensile minimo

| Servizio | Piano minimo | Costo/mese |
|---|---|---|
| Neon (Postgres+pgvector) | Free → Launch | €0–19 |
| Railway (API long-running) | Hobby/Starter | ~€5–10 |
| Vercel (SPA statica) | Hobby | €0 |
| Upstash Redis | Free | €0 |
| AI (OpenRouter/Groq free) | Free tier | €0 (cost-guard `LLM_COST_LIMIT_FREE`) |
| Stripe | — | ~1.5%+€0.25 per transazione EU |
| Sentry | Developer | €0 |

**Totale realistico: ~€5–30/mese** all'inizio (Railway + eventuale Neon Launch), AI sul free tier.

## 7. Rischio singolo più alto

**§2 (schema DB).** Con lo switch a **`drizzle-kit push`** (fatto: §2), il rischio residuo è il
**primo push sul prod esistente**, che potrebbe proporre **DROP distruttivi**. Il job usa il push
**non forzato**, quindi una modifica data-loss **aborta il deploy** invece di applicarla — ma la
mitigazione resta: **validare su staging** e rivedere a mano il diff (`drizzle-kit push --strict`)
con backup, **prima** del merge su `main`. (Storico: il vecchio path `db:migrate` journal-driven
faceva nascere **monco** un DB fresco — chain SQL incompleto — ed è stato ritirato.)
