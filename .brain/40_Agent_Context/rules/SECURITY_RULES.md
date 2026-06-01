# SECURITY_RULES.md — NorthStar

> Leggi questo file PRIMA di modificare route server, middleware di autenticazione, gestione password, o qualsiasi logica che tocchi dati utente.
> Aggiornato automaticamente dall'agente di sicurezza (`packages/ai-server/src/security-agent/`).

---

## Come usare l'agente di sicurezza

### Via API (admin only)
```http
POST /api/security/scan
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "autoDetect": true,
  "applyFixes": false
}
```

Risponde con SSE stream:
```
data: {"type":"status","value":"🔍 Scansione di 12 file in corso..."}
data: {"type":"finding","finding":{"severity":"HIGH","file":"...","title":"..."}}
data: {"type":"done","findings":[...],"totalFiles":12,"costUsd":0.002}
```

### Via CLI (locale / CI)
```bash
# Scansiona solo i file modificati
pnpm --filter @workspace/scripts run security:scan

# Scansiona tutto il repo
pnpm --filter @workspace/scripts run security:scan:all
```

Env vars richieste:
```bash
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=...
# oppure
OPENROUTER_API_KEY=...
```

---

## Regole fisse (da rispettare sempre)

### 🔐 Autenticazione

- **Usa sempre `bcrypt` con salt rounds ≥ 12** per l'hashing delle password. Mai SHA-256, MD5 o SHA-1 per password.
  ```typescript
  // ✅ CORRETTO
  const hash = await bcrypt.hash(password, 12);
  const ok   = await bcrypt.compare(plain, hash);

  // ❌ SBAGLIATO — SHA-256 senza salt
  crypto.createHash('sha256').update(password).digest('hex');
  ```

- **JWT_SECRET deve essere almeno 256 bit** (32 byte random). Verifica sempre con `process.env.JWT_SECRET` e fallisci fast se mancante.

- **`requireAuth` e `requireAdmin`** devono essere il primo middleware sulle route protette. Non aggiungere logica di bypass.

- **I seed script di test devono usare lo stesso algoritmo bcrypt del server** — altrimenti i test E2E non possono autenticarsi.

### 💉 Injection

- **Mai concatenare input utente in query SQL**. Usa sempre i template `sql\`...\`` di Drizzle o query parametrizzate.
  ```typescript
  // ✅ CORRETTO
  sql`SELECT * FROM users WHERE email = ${email}`

  // ❌ SBAGLIATO — SQL injection
  `SELECT * FROM users WHERE email = '${email}'`
  ```

- **Mai usare `eval()`, `new Function()` o `child_process.exec()` con input utente**.

- **Path traversal**: normalizza sempre i percorsi file con `path.resolve()` e verifica che il risultato sia dentro la directory consentita.

### 🔑 Segreti

- **Mai fare commit di segreti reali** (API key, password production) nel codice sorgente.
- I valori di fallback nei seed script devono essere solo per ambienti di test isolati (non puntare a production DB).
- Variabili d'ambiente richieste: documentarle nel template versionato `.env`, non nei commenti del codice.

### 🌐 API e CORS

- **`ALLOWED_ORIGINS`** in produzione deve essere una lista esplicita, mai `*`.
- **Validazione input** con zod su tutte le route che accettano body da client.
- **Limita i campi esposti** nelle response API — non restituire `passwordHash`, token interni, o dati di altri utenti.

### 🤖 Agenti AI

- **Non loggare mai** il contenuto dei messaggi utente o la risposta LLM in produzione (PII).
- **Non loggare** API key, Authorization header, o JWT in chiaro.
- Il costo LLM viene tracciato via `recordLlmUsage()` — usarlo sempre per nuovi agenti.
- I prompt injection verso gli LLM **non sono considerati vulnerabilità** in questo progetto (gli LLM sono trusted per output, non per esecuzione di codice).

### 🗄️ Database

- **Row-level isolation**: ogni query che legge dati utente deve filtrare su `userId = req.user.id`. Non fidarsi di `userId` passato dal client.
- **Migrations**: usare `drizzle-kit` con migration trackate. Mai `ALTER TABLE` manuali in produzione senza migration file.

---

## Regole Automatiche

_(Questa sezione viene aggiornata automaticamente dall'agente di sicurezza ad ogni scan)_

---

## Scan 2026-05-16

**File analizzati:** 0 | **🔴 High:** 0 | **🟡 Medium:** 0 | **🟢 Low:** 0

_Nessuna vulnerabilità trovata — baseline pulita al momento della creazione di questo documento._

**Note dalla review manuale (2026-05-16):**
- I seed script E2E usavano SHA-256 per l'hashing delle password invece di bcrypt → **corretto**.
- I `vercel.json` avevano comandi `cd ../..` che fallivano nel container di build → **corretto**.
- Tutti i finding dell'analisi automatica erano falsi positivi (test-only scope, no auth boundary violations).
