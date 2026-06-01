# Staging Setup Guide — NorthStar

> Leggi questo file per configurare l'ambiente staging da zero.
> Tempo stimato: 30-45 minuti.

---

## Prerequisiti

- Accesso al repo GitHub con ruolo `Admin` o `Maintainer`
- Account Railway (o Fly.io) attivo
- Account Stripe con progetto test già creato
- Account Sentry (free tier sufficiente)
- PostgreSQL accessibile da Railway (es. Railway Postgres addon)

---

## Step 1 — Crea il database staging

### Su Railway

```bash
# Aggiungi un nuovo servizio PostgreSQL al progetto Railway staging
# Railway UI: New Service → Database → PostgreSQL
# Oppure via CLI:
railway add --plugin postgresql
```

Crea i ruoli separati come da `scripts/db-roles.sql`:

```bash
# Ottieni la CONNECTION STRING da Railway UI
psql "$STAGING_DATABASE_URL_SUPERUSER" -f scripts/db-roles.sql
psql "$STAGING_DATABASE_URL_SUPERUSER" -f scripts/verify-db-privileges.sql
```

### Naming convention DB staging

```
Database:  northstar_staging
Ruolo app: northstar_app   → DATABASE_URL
Ruolo DDL: northstar_migrator → DATABASE_URL_MIGRATOR
```

---

## Step 2 — Configura GitHub Environment "staging"

NorthStar mantiene un solo template env versionato in root: `.env`.
Per staging non esiste piu un template duplicato: crea un `.env.staging` locale solo se ti serve testare il deploy manualmente, partendo da `.env` e applicando i valori staging sotto.

1. Vai su **GitHub → Repo → Settings → Environments**
2. Crea un environment chiamato esattamente `staging`
3. Aggiungi i seguenti **Secret** (valori reali da non condividere):

| Secret name | Dove trovarlo |
|---|---|
| `STAGING_DATABASE_URL` | Railway → Postgres → Variables → `DATABASE_URL` (ruolo app) |
| `STAGING_DATABASE_URL_MIGRATOR` | Railway → Postgres → Variables → `DATABASE_URL` (ruolo migrator) |
| `STAGING_JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STAGING_ADMIN_KEY` | Stesso comando sopra |
| `RAILWAY_STAGING_API_TOKEN` | Railway → Account → API Tokens → New Token |
| `RAILWAY_STAGING_SERVICE_ID` | Railway → Servizio → Settings → Service ID |
| `SLACK_WEBHOOK_URL` | Slack → Incoming Webhooks (opzionale) |
| `STRIPE_SECRET_KEY` | Stripe test mode, formato `sk_test_*` |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint staging in Stripe |
| `GNEWS_API_KEY` | Provider news test/staging |
| `TAVILY_API_KEY` | Provider ricerca test/staging |
| `SENTRY_DSN` | Progetto Sentry `northstar-staging` |

4. Aggiungi le seguenti **Variables** (non secret, visibili nei log):

| Variable name | Valore esempio |
|---|---|
| `STAGING_URL` | `https://northstar-staging.up.railway.app` |
| `SLACK_NOTIFY` | `true` o `false` |
| `AI_MOCK_MODE` | `true` per evitare costi LLM |
| `ENVIRONMENT` | `staging` |
| `ALLOWED_ORIGINS` | URL frontend staging |
| `VITE_API_URL` | URL API staging con `/api` |

---

## Step 3 — Configura Stripe TEST per staging

1. Vai su [dashboard.stripe.com](https://dashboard.stripe.com)
2. Assicurati di essere in modalità **Test** (toggle in alto a destra)
3. Crea un nuovo webhook endpoint:
   - URL: `https://northstar-staging-api.up.railway.app/api/webhooks/stripe`
   - Events: `invoice.paid`, `customer.subscription.deleted`, `payment_intent.payment_failed`
4. Copia il **Webhook signing secret** → `STRIPE_WEBHOOK_SECRET` nei secret/variables di staging
5. Usa `sk_test_*` come `STRIPE_SECRET_KEY` — mai `sk_live_*` in staging

### Test pagamento finto con Stripe CLI

```bash
# Installa Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhook verso localhost (dev locale)
stripe listen --forward-to localhost:8080/api/webhooks/stripe

# Simula invoice.paid
stripe trigger invoice.paid
```

---

## Step 4 — AI Mock Mode

In staging usiamo `AI_MOCK_MODE=true` per evitare costi LLM.

Cosa cambia con mock mode attivo:
- `ai.chat()` → risposta statica `[MOCK] Risposta simulata`
- `ai.stream()` → stream di un singolo chunk mock
- `ai.embed()` → vettore zero (1536 dimensioni)
- Nessuna chiamata a OpenAI / Groq / Anthropic
- Nessun costo

Per testare l'AI reale in staging:
```bash
# In `.env.staging` locale, oppure nelle variables dell'environment staging:
AI_MOCK_MODE=false
OPENAI_API_KEY=sk-proj-REAL_KEY_HERE
```

---

## Step 5 — Crea il branch `develop`

```bash
git checkout main
git pull origin main
git checkout -b develop
git push origin develop
```

Da questo momento ogni push su `develop` trigghera il workflow `.github/workflows/staging.yml`.

---

## Step 6 — Verifica il deploy

1. Fai un push di test su `develop`:
   ```bash
   git checkout develop
   echo "# staging test" >> docs/staging-setup.md
   git add . && git commit -m "chore(staging): test deploy"
   git push origin develop
   ```
2. Vai su **GitHub → Actions → Deploy Staging** e controlla che tutti i job passino
3. Verifica che `GET https://northstar-staging-api.up.railway.app/api/health` risponda `200`

---

## Step 7 — Sentry (monitoring)

1. Vai su [sentry.io](https://sentry.io) → Crea progetto `northstar-staging`
2. Seleziona platform: **Node.js**
3. Copia il DSN → `SENTRY_DSN` nel GitHub Environment `staging`
4. Aggiungi `SENTRY_DSN` anche a Railway → Servizio → Variables

---

## Criterio di accettazione (Fase 0 completa)

- [ ] `GET /api/health` su staging → `200 OK`
- [ ] Login e registrazione funzionano in staging
- [ ] Pagamento Stripe test (`4242 4242 4242 4242`) → upgrade premium
- [ ] Wendy risponde (anche in mock mode)
- [ ] GitHub Actions → Deploy Staging → tutti i job verdi
- [ ] Nessun costo LLM generato (AI_MOCK_MODE=true)
- [ ] Sentry cattura un errore di test:
  ```bash
  curl -X POST https://northstar-staging-api.up.railway.app/api/test-sentry
  ```

---

## Rollback staging

Se il deploy staging rompe qualcosa:

```bash
# Opzione 1 — revert commit su develop
git revert HEAD
git push origin develop
# Il workflow staging.yml parte automaticamente

# Opzione 2 — rollback manuale via GitHub Actions
# Actions → Rollback Production → Run workflow
# Inserisci SHA target e seleziona environment: staging
```
