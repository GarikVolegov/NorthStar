# 🌿 GIT_RULES.md — Git Policy

## NorthStar / Orientamento — github.com/GarikVolegov/NorthStar

### pnpm Monorepo · Replit · TypeScript 93%

> Documento operativo. Leggilo prima di ogni commit o push.
> Un commit ben scritto oggi è debugging risparmiato domani.
> Un secret nel repo è un’emergenza di sicurezza — non esistono eccezioni.

-----

## 1. STATO ATTUALE DEL REPO E WORKFLOW

### Cosa ho visto analizzando il repo

```
Branch attivi:  solo main (154 commit diretti)
.gitignore:     esiste ma incompleto — mancano .env, *.sql, secrets AI
attached_assets/ → potenziale accumulo di file grandi non necessari
.agents/         → output agenti Replit — non vanno nel repo
1 PR aperta      → primo segnale di branching, da consolidare
```

### Workflow Consigliato (solista su Replit)

Non servono 10 branch. Serve un sistema semplice che funzioni:

```
main
  └─ SEMPRE stabile e deployabile su Replit
  └─ Nessun push diretto per feature nuove

feature/<nome>   ← branch di lavoro (max 5-7 giorni)
fix/<nome>       ← correzione bug
hotfix/<nome>    ← fix urgente su main (emergenze)
```

```bash
# Ciclo completo per una feature

git checkout main && git pull origin main
git checkout -b feature/ai-router-groq

# ... lavori, committi ...

git fetch origin
git rebase origin/main          # tieni il branch aggiornato

git push origin feature/ai-router-groq
# → apri PR su GitHub verso main
# → mergia dopo test
# → elimina il branch

git branch -d feature/ai-router-groq
git push origin --delete feature/ai-router-groq
```

### Regola d’Oro sul Branch main

```
❌ MAI: git checkout main → git commit → git push
✅ SEMPRE: branch → commit → PR → merge
```

-----

## 2. CONVENTIONAL COMMITS — STANDARD NORTHSTAR

### Formato

```
<tipo>(<scope>): <descrizione breve in italiano>

[corpo opzionale — spiega il PERCHÉ, non il cosa]
```

### Tipi

```
feat      → nuova feature
fix       → correzione bug
perf      → ottimizzazione performance
refactor  → refactoring senza cambi di comportamento
style     → formattazione, whitespace
docs      → documentazione, file .md, commenti
chore     → dipendenze, config, build
db        → migration, schema, seed           (custom NorthStar)
ai        → prompt, modelli, logica AI        (custom NorthStar)
hotfix    → fix urgente su main               (custom NorthStar)
revert    → annulla commit precedente
```

### Scope — Aree del Progetto

```
auth        grafo       agent       stripe
users       rag         embedding   admin
test        wiki        objectives  news
sectors     roadmap     favorites   sse
ai-router   db          deps        config
```

### Esempi Reali per NorthStar

```bash
# ── FEAT ─────────────────────────────────────────────────────
feat(ai-router): aggiunge provider Groq per streaming SSE
feat(grafo): aggiunge modalità link tra nodi con ctrl+click
feat(stripe): gestisce invoice.payment_failed nel webhook
feat(objectives): aggiunge priorità e data scadenza

# ── FIX ──────────────────────────────────────────────────────
fix(sse): chiude stream se client disconnette — memory leak
fix(auth): risolve FOUC su ProtectedRoute durante authReady
fix(stripe): aggiunge express.raw() prima del json parser
fix(grafo): corregge posizione edge dopo pan viewport

# ── PERF ─────────────────────────────────────────────────────
perf(app): converte pagine a lazy import — bundle -58%
perf(grafo): usa useRef per drag state, setState solo a mouseup
perf(news): prefetch tutte le categorie al mount

# ── DB ───────────────────────────────────────────────────────
db: aggiunge migration 0042 — colonna timezone in users
db: corregge seed idempotente per tabella sectors
db: aggiunge indice userId su knowledge_nodes

# ── AI ───────────────────────────────────────────────────────
ai(agent): aggiorna prompt con sezione Cinque Spiriti
ai(wiki): riduce max_tokens 1500→1000 — risparmio costi
ai(embedding): aggiunge soglia similarità 0.6 nel retrieval

# ── REFACTOR ─────────────────────────────────────────────────
refactor(wiki): migra da EventSource inline a hook useSSEStream
refactor(roadmap): estrae buildRoadmapPrompt in lib/prompts/

# ── CHORE ────────────────────────────────────────────────────
chore(deps): aggiunge @anthropic-ai/sdk v0.24.0
chore(deps): aggiorna drizzle-orm v0.30→v0.31
chore: aggiunge GIT_RULES.md in root

# ── HOTFIX ───────────────────────────────────────────────────
hotfix(auth): corregge bypass JWT su route /api/admin
hotfix(stripe): webhook non verificava firma — vulnerabilità
```

### Regole sul Messaggio

```
✅ Riga soggetto: MAX 72 caratteri
✅ In italiano, imperativo presente ("aggiunge", "corregge", "migra")
✅ Descrive COSA è cambiato — il corpo spiega il PERCHÉ se non ovvio

❌ "fix bug"
❌ "aggiornamento"
❌ "wip"
❌ "."
❌ commit vuoti
```

### Quando Usare il Corpo

```bash
# Usalo quando il perché non è ovvio dalla riga soggetto

git commit -m "perf(grafo): usa useRef per drag state, setState solo a mouseup

Il drag con useState causava re-render ad ogni pixel del mousemove,
portando il framerate sotto 30fps con 20+ nodi.
Il pattern con useRef aggiorna il DOM direttamente durante il drag
e committa lo stato React solo al mouseup (1 re-render per interazione).

Prima: 8fps — Dopo: 58fps, misurato su 30 nodi con Chrome DevTools."
```

-----

## 3. .GITIGNORE — AGGIORNAMENTO NECESSARIO

### Cosa aggiungere al tuo .gitignore attuale

Il `.gitignore` esistente copre `node_modules`, `dist`, `.DS_Store`, `.local/`
ma mancano questi pattern critici — aggiungili subito:

```gitignore
# ── Segreti e Ambiente ── CRITICO ────────────────────────────
.env
.env.local
.env.development
.env.production
.env.staging
.env.*
!.env.example          # l'esempio va committato, le chiavi reali NO

# ── Database — backup e dump ─────────────────────────────────
*.sql
backup_*.sql
dump_*.sql
*.db
*.sqlite

# ── AI e Cache locale ────────────────────────────────────────
*.embeddings.json
prompt_cache/
ai_responses/
ai_cache/

# ── Replit — output agenti ───────────────────────────────────
.agents/outputs/
__pycache__/

# ── Log con potenziali dati utente ───────────────────────────
logs/
*.log

# ── File grandi in attached_assets ───────────────────────────
attached_assets/*.mp4
attached_assets/*.mov
attached_assets/*.zip
attached_assets/*.pdf
```

### .env.example — Crealo e committalo

```bash
# .env.example — struttura pubblica, nessun valore reale
# Committare questo. MAI committare .env con valori reali.

DATABASE_URL=postgresql://user:password@host:5432/northstar

JWT_SECRET=stringa-casuale-minimo-32-caratteri

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

GNEWS_API_KEY=...
TAVILY_API_KEY=...

VITE_API_URL=http://localhost:3000
```

-----

## 4. LISTA NERA — COSA NON COMMITTARE MAI

### 🔴 Emergenza se committato — ruotare la chiave subito

```
.env con valori reali
OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
DATABASE_URL con password reale
JWT_SECRET
.local/.jwt-secret          ← già ignorato, non rimuovere mai da .gitignore
Qualsiasi Bearer token o API key
```

### 🟠 Problematico — rimuovere prima del push

```
Backup del DB (*.sql, dump_*.sql, backup_*.sql)
Log con email utente o userId leggibili
node_modules/ di qualsiasi workspace
dist/ e .vite/ (output di build)
*.tsbuildinfo
Output degli agenti Replit (.agents/outputs/)
```

### 🟡 Da evitare

```
Screenshot o GIF > 1MB in attached_assets/
File temporanei creati durante sviluppo locale
IDE settings personali (.idea/, .vscode/settings.json)
skills-lock.json se viene aggiornato automaticamente ad ogni run
```

### Verifica Pre-Push in 3 Secondi

```bash
# Cerca pattern sospetti nel diff
git diff --staged | grep -iE "(api_key|secret|password|sk-|pk_|whsec|DATABASE_URL)"

# Verifica che .env non sia in staging
git diff --staged --name-only | grep "\.env"
# → deve restituire vuoto

# Panoramica di cosa stai committando
git diff --staged --stat
```

-----

## 5. MONOREPO PNPM — REGOLE SPECIFICHE

```
Workspace NorthStar:
  artifacts/orientamento/   ← frontend React + Vite
  artifacts/api-server/     ← backend Express 5
  lib/db/                   ← schema Drizzle + migration
  lib/api-client-react/     ← client tipato condiviso
  scripts/                  ← script di utilità
```

```bash
# ✅ Scope del commit = package coinvolto
feat(orientamento): aggiunge lazy loading pagine
fix(api-server): corregge CORS su route /api/admin
db: aggiunge migration 0043 — tabella roadmaps

# ✅ pnpm-lock.yaml VA committato — garantisce versioni identiche
# ✅ pnpm-workspace.yaml VA committato

# ❌ Mai committare node_modules/ di nessun package
# ❌ Mai committare dist/ dei singoli package
```

-----

## 6. TAG E VERSIONI

```
Il repo non ha ancora release taggati — inizia ora.
Formato: vMAJOR.MINOR.PATCH

PATCH → bugfix, hotfix, piccoli fix UI
MINOR → nuova feature completata
MAJOR → cambio strutturale (nuovo schema auth, redesign)
```

```bash
# Dopo ogni merge su main stabile
git checkout main && git pull origin main
git tag -a v1.0.0 -m "Prima release stabile NorthStar

- Test RIASEC + Cinque Spiriti
- Agente NorthStar con analisi personalizzata
- Knowledge graph + RAG
- Wiki AI e Roadmap AI con streaming
- Stripe subscription"

git push origin v1.0.0

# Lista tag esistenti
git tag -l --sort=-version:refname
```

### CHANGELOG.md — Struttura Minima

```markdown
# CHANGELOG

## [Unreleased]
### Added
- AI Router con provider OpenAI, Anthropic, Groq

### Fixed
- Memory leak SSE alla disconnessione del client

---

## [v1.0.0] — 2026-05-09
Prima release stabile NorthStar / Orientamento
```

-----

## 7. EMERGENZA — SECRET COMMITTATO

**Agisci immediatamente. GitHub indicizza i secret in secondi.**

```bash
# STEP 1 — Ruota la chiave PRIMA di tutto

# OpenAI    → platform.openai.com → API Keys → Revoke
# Anthropic → console.anthropic.com → API Keys → Delete
# Groq      → console.groq.com → API Keys → Delete
# Stripe    → dashboard.stripe.com → Developers → Roll key
# DB        → Replit → cambia DATABASE_URL e password

# STEP 2A — Se il commit NON è ancora pushato
git reset --soft HEAD~1         # rimuove il commit, tiene i file
# rimuovi il segreto dal file
git add <file-corretto>
git commit -m "chore: rimuove segreto esposto"

# STEP 2B — Se il commit è già pushato
pip install git-filter-repo
git filter-repo --path .env --invert-paths --force
git push origin --force --all
git push origin --force --tags

# STEP 3 — Aggiorna .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: aggiunge .env a .gitignore"
git push origin main

# STEP 4 — Verifica finale
git log --all --full-history -S "sk-" -- "**"
# → deve restituire vuoto
```

-----

## 8. CHECKLIST PRE-PUSH

```
Contenuto
  ✅ Ho usato git add <file> specifici (mai git add .) ?
  ✅ git diff --staged mostra solo le modifiche che voglio?
  ✅ Il codice compila senza errori TypeScript?
  ✅ Nessun console.log di debug residuo?

Sicurezza
  ✅ Nessun .env in staging?
  ✅ Nessun *.sql o backup DB in staging?
  ✅ Nessuna API key nel diff?
     → git diff --staged | grep -iE "(api_key|secret|sk-|pk_|whsec)"

Commit Message
  ✅ Formato tipo(scope): descrizione?
  ✅ Riga soggetto sotto 72 caratteri?
  ✅ In italiano, descrive cosa E perché?

Branch
  ✅ Non sto pushando direttamente su main?
  ✅ Il branch è aggiornato con main?
```

-----

## 9. COMANDI RAPIDI

```bash
# Stato
git status
git diff --staged
git log --oneline --graph -15

# Branch
git checkout -b feature/nome
git branch -a
git branch -d feature/nome
git push origin --delete feature/nome

# Staging
git add <file>
git add -p                      # staging interattivo hunk per hunk
git restore --staged <file>     # rimuove da staging
git restore <file>              # scarta modifiche locali

# Annullare
git reset --soft HEAD~1         # annulla commit, tiene modifiche
git revert <hash>               # commit inverso (sicuro su main)
git commit --amend --no-edit    # aggiunge all'ultimo commit (solo locale)

# Allineare
git fetch origin
git rebase origin/main

# Pulizia
git fetch --prune
git branch --merged main | grep -v main | xargs git branch -d

# Sicurezza
git diff --staged | grep -iE "(api_key|secret|sk-|pk_|whsec)"
git log --all --full-history -- "**/.env*"
```

-----

## 10. PROIBITI ASSOLUTI

```bash
# ❌ Push diretto su main senza PR
git checkout main && git push origin main

# ❌ Force push su main
git push origin main --force

# ❌ git add . senza controllare il diff
git add .

# ❌ Commit message vuoti o inutili
git commit -m "fix"
git commit -m "wip"
git commit -m "."

# ❌ Committare node_modules
git add node_modules/

# ❌ Rebase su branch già pushati e condivisi
# Su branch personali non ancora condivisi: ok
```

-----

*GIT_RULES.md — NorthStar / GarikVolegov*
*Versione 1.0 — Maggio 2026*
*Basato sulla struttura reale del repo: branch main, 154 commit, monorepo pnpm.*
*Da leggere prima di ogni commit, push o operazione sul repository.*