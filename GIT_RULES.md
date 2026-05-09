# GIT_RULES.md — NorthStar

> Leggi questo file PRIMA di creare branch, fare commit, aprire PR o fare merge.

---

## 🔴 SICUREZZA — File Replit: regole di commit

> Queste regole si applicano a OGNI commit. Violazioni = secret esposti su GitHub.

### File Replit — cosa si può committare

| File | Committare? | Motivo |
|---|---|---|
| `replit.md` | ✅ Sì | Documentazione tecnica — **ZERO secret, ZERO env var reali** |
| `.replit` | ✅ Sì | Configurazione run/workflow — **solo comandi, nessun valore segreto** |
| `replit.nix` | ✅ Sì | Dipendenze di sistema — **nomi pacchetti, mai chiavi** |
| `.replitignore` | ✅ Sì | Pattern ignore |
| `.replit_integration_files/` | ⚠️ Solo se privi di secret | Controllare prima con `grep -r 'sk-\|Bearer\|password' .replit_integration_files/` |
| `.env` | ❌ MAI | Contiene secret reali |
| `.env.local` | ❌ MAI | Contiene secret reali |
| `secrets.json` | ❌ MAI | Contiene secret reali |

### Regole esplicite per `replit.md` e `replit.nix`

```
❌ SBAGLIATO — secret inline in replit.md
JWT_SECRET=eyJhbGci...
OPENAI_API_KEY=sk-proj-ABC123
DATABASE_URL=postgresql://northstar:password_reale@...

✅ CORRETTO — solo riferimento al nome della variabile
JWT_SECRET       # generato con pnpm secrets, iniettato da Replit Secrets tab
OPENAI_API_KEY   # da Replit Secrets tab
DATABASE_URL     # da Replit Secrets tab o .env locale (non committato)
```

```nix
# ❌ SBAGLIATO — mai in replit.nix
environment.variables.OPENAI_API_KEY = "sk-proj-ABC123";

# ✅ CORRETTO — replit.nix contiene SOLO pacchetti di sistema
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.postgresql
  ];
}
```

### Checklist sicurezza pre-commit

Prima di ogni `git commit` verifica:

```bash
# 1. Cerca pattern di secret nel diff
git diff --staged | grep -iE '(sk-|sk-proj-|Bearer |password=|secret=|api_key=|OPENAI|JWT_SECRET)'

# 2. Cerca in file Replit specificamente
git diff --staged -- replit.md .replit replit.nix | grep -iE '(sk-|password|secret|key)=.'

# 3. Se il grep torna output → STOP, non committare
# 4. Rimuovi il secret, usa solo il nome della variabile come riferimento
```

> **Tip Replit**: i secret vanno nella tab "Secrets" di Replit. Da lì vengono iniettati automaticamente come env vars senza mai toccare i file committati.

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
- [ ] File replit.md / .replit / replit.nix senza valori segreti
- [ ] Typecheck passa (`pnpm typecheck`)
- [ ] Test passano (`pnpm test:unit`)
- [ ] `replit.md` aggiornato se cambio architettura o nuovi file chiave
- [ ] `*_RULES.md` aggiornato se cambio pattern o convenzioni

## Screenshot / output (se UI o API)
<!-- Incolla output curl, screenshot, ecc. -->
```

### Merge

- **Squash merge** per feature branch (storia pulita su main)
- **Merge commit** solo per release o hotfix (traceabilità)
- Mai `--force-push` su `main`
- Eliminare il branch dopo il merge

---

## .gitignore — checklist

Assicurati che questi pattern siano presenti:

```gitignore
# Env vars — MAI committare
.env
.env.*
!.env.example

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

- **`git add .` su Replit**: attenzione, può raccogliere file temporanei. Usa sempre `git add -p` o `git add <file>` specifici.
- **`pnpm-lock.yaml`**: va committato. Mai ignorarlo o cancellarlo manualmente.
- **`uv.lock`**: va committato (Python deps).
- **`dist/`**: NON committare — build artefatto, generato dalla CI.
- **Secret nel diff**: se hai già committato un secret per errore, non basta fare un nuovo commit che lo rimuove. Devi fare `git filter-branch` o contattare GitHub per rimuoverlo dalla storia.
- **Replit Secrets tab**: è il posto giusto per i secret su Replit. Non usare mai `.env` committato come workaround.
