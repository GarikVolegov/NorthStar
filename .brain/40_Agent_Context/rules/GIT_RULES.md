# GIT_RULES.md — NorthStar

> Leggi questo file PRIMA di creare branch, fare commit, aprire PR o fare merge.

---

## 🔴 SICUREZZA — Secret: regole di commit

> Queste regole si applicano a OGNI commit. Violazioni = secret esposti su GitHub.

### File da non committare MAI

| File/Pattern | Motivo |
|---|---|
| `.env.*` | Contiene secret reali/locali |
| `secrets.json` | Contiene secret reali |
| Qualsiasi file con `sk-`, `Bearer `, `password=` | API key o token |

### Regola esplicita per `.env`

```
✅ CORRETTO — solo placeholder, nessun valore reale
JWT_SECRET=
OPENAI_API_KEY=
DATABASE_URL=postgresql://user:password@localhost:5432/northstar

❌ SBAGLIATO — valori reali o di default
JWT_SECRET=eyJhbGci...   # MAI un JWT valido
OPENAI_API_KEY=sk-proj-ABC123  # MAI una chiave reale
```

### Checklist sicurezza pre-commit

Prima di ogni `git commit` verifica:

```bash
# 1. Cerca pattern di secret nel diff
git diff --staged | grep -iE '(sk-|sk-proj-|Bearer |password=|secret=|api_key=|OPENAI|JWT_SECRET)'

# 2. Cerca file di ambiente
git diff --staged --name-only | grep -iE '\.env$'

# 3. Se il grep torna output → STOP, non committare
# 4. Rimuovi il secret: `.env` e' solo template, i valori reali stanno in `.env.local` o secret manager
```

---

## Convenzioni branch

### Nomenclatura

```
feat/<nome-feature>       # nuova funzionalità
fix/<nome-bug>            # correzione bug
chore/<task>              # manutenzione, aggiornamenti, refactor
docs/<cosa>               # solo documentazione
test/<cosa>               # solo test
hotfix/<nome>             # fix urgente su main/prod
```

**Esempi validi:**
- `feat/wendy-onboarding`
- `fix/affiliate-withdraw-race`
- `chore/update-drizzle`
- `docs/api-endpoints`

**Esempi non validi:**
- `feature-wendy` (manca prefisso con `/`)
- `fix` (troppo generico)
- `garik/test` (username nel branch)

### Branch base

- Feature e fix partono sempre da `main` aggiornato
- Mai creare branch da un altro branch feature (a meno di PR dipendenti documentate)

```bash
git checkout main && git pull origin main
git checkout -b feat/<nome>
```

---

## Conventional Commits

### Formato obbligatorio

```
<type>(<scope>): <descrizione in minuscolo>

[body opzionale]

[footer opzionale: BREAKING CHANGE, closes #N]
```

### Tipi validi

| Tipo | Quando usarlo |
|---|---|
| `feat` | Nuova funzionalità visibile all'utente |
| `fix` | Correzione di un bug |
| `chore` | Dipendenze, build, config, manutenzione |
| `docs` | Solo documentazione |
| `test` | Solo test (aggiunta o modifica) |
| `refactor` | Refactoring senza cambi di funzionalità |
| `perf` | Ottimizzazione performance |
| `ci` | Modifiche a CI/CD |
| `security` | Fix o rafforzamento sicurezza |

### Scope suggeriti

`auth`, `cv`, `affiliate`, `growth-agent`, `wendy`, `discovery`, `admin`, `db`, `ai`, `infra`, `deps`

### Esempi

```
feat(wendy): aggiunge streaming SSE per la chat
fix(affiliate): corregge race condition nel prelievo
chore(deps): aggiorna drizzle-orm a 0.32
docs(replit.md): aggiunge sezione sicurezza API key
security(jwt): aumenta scadenza token da 1d a 7d
```

### Regole messaggi

- Prima riga max 72 caratteri
- Usa il presente imperativo: "aggiunge", "corregge", "rimuove" (non "aggiunto", "ho corretto")
- Non terminare con punto
- Se il commit ha BREAKING CHANGE: metti `BREAKING CHANGE: <spiegazione>` nel footer

---

## Pull Request

### Dimensioni

- PR piccole: max 400 righe cambiate (esclusi file generati e lockfiles)
- PR grandi: dividere in sotto-PR con dipendenze dichiarate nel body

### Template PR (body)

```markdown
## Cosa fa questa PR
<!-- 2-3 righe che spiegano il cambiamento -->

## Tipo di cambiamento
- [ ] feat — nuova feature
- [ ] fix — correzione bug
- [ ] chore — manutenzione
- [ ] security — sicurezza
- [ ] breaking change

## Checklist
- [ ] Nessun secret in commit (API key, password, token)
- [ ] Typecheck passa (`pnpm typecheck`)
- [ ] Test passano (`pnpm test:unit`)
- [ ] `*_RULES.md` aggiornato se cambio pattern o convenzioni
- [ ] README.md aggiornato se cambio architettura o setup
- [ ] Docs AI (`docs/ai-modules/`) aggiornate se cambio AI pipeline

## Screenshot / output (se UI o API)
<!-- Incolla output curl, screenshot, ecc. -->
```

### Merge

- **Squash merge** per feature branch (storia pulita su main)
- **Merge commit** solo per release o hotfix (traceabilità)
- Mai `--force-push` su `main`
- Eliminare il branch dopo il merge

---

## CI/CD — GitHub Actions Workflows

I workflow sono in `.github/workflows/`:

| Workflow | Trigger | Cosa fa |
|---|---|---|
| `ci.yml` | Push main/develop, PR main | Typecheck, test unitari (Vitest), test AI server, test Python, eval regression, E2E (Playwright) |
| `staging.yml` | Push develop | Typecheck → test → DB migration → Deploy Railway staging → Sentry release |
| `production.yml` | Push main | Typecheck → test → DB migration → Deploy Railway production → Sentry release |
| `rollback.yml` | Manuale | Rollback trigger |
| `mobile-qa.yml` | Schedule/trigger | Lighthouse CI + Playwright mobile tests |

### Regole CI/CD

- **Non mergiare su main** se CI fallisce (typecheck, test, o eval)
- **Sentry release** automatica su staging e production
- **Migration DB automatica** in staging e production — assicurati che la migration sia safe (non-breaking)
- **Eval regression** blocca il merge se il quality score scende sotto soglia

## pnpm Workspace — Convenzioni

- Usa `pnpm --filter <package>` per eseguire comandi in un workspace specifico
- Usa `pnpm -r` per eseguire comandi in tutti i workspace
- Le dipendenze condivise vanno nel catalogo `pnpm-workspace.yaml` (sezione `catalog`)
- `pnpm-lock.yaml` va SEMPRE committato

## .gitignore — checklist

Assicurati che questi pattern siano presenti:

```gitignore
# Env vars — MAI committare
.env
.env.*
!/.env

# Build output
dist/
build/
.next/

# Dipendenze
node_modules/

# Test
coverage/
test-results/
playwright-report/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/
```

---

## Gotchas git

- **`git add .`**: attenzione, può raccogliere file temporanei. Usa sempre `git add -p` o `git add <file>` specifici.
- **`pnpm-lock.yaml`**: va committato. Mai ignorarlo o cancellarlo manualmente.
- **`packages/ml-service/uv.lock`**: va committato (Python deps).
- **`dist/`**: NON committare — build artefatto, generato dalla CI.
- **Secret nel diff**: se hai già committato un secret per errore, non basta fare un nuovo commit che lo rimuove. Devi fare `git filter-branch` o contattare GitHub per rimuoverlo dalla storia.
- **Workspace cross-deps**: se modifichi `packages/db/`, ricordati di rigenerare i tipi per `packages/api-client-react/` con `pnpm build:api-client`
- **Drizzle migration**: genera SEMPRE una migration dopo aver modificato lo schema (`pnpm db:generate`) prima di committare
