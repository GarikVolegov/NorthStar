# AI_RULES.md — NorthStar

> Leggi questo file PRIMA di modificare qualsiasi file in lib/ai/, routes che usano AI, o qualsiasi chiamata OpenAI/Groq/Anthropic.

---

## 🔴 SICUREZZA — API Key: no logging mai

> Una API key nel log è equivalente a una API key in chiaro su GitHub. I log vengono condivisi, esportati, indicizzati.

### Anti-pattern: cosa NON fare mai

```typescript
// ❌ SBAGLIATO — API key in console.log
console.log('Inizializzo OpenAI con key:', process.env.OPENAI_API_KEY);
console.log('Config AI:', { apiKey: openai.apiKey, model: 'gpt-4o' });

// ❌ SBAGLIATO — API key loggata da Pino (automatico su oggetti)
logger.info({ config: openai }, 'Client OpenAI inizializzato'); // openai include la key!
logger.debug(requestOptions, 'Chiamata AI');  // requestOptions include headers con Bearer

// ❌ SBAGLIATO — Morgan body logging che cattura headers con Authorization
app.use(morgan('combined')); // logga headers incluso Authorization: Bearer sk-...

// ❌ SBAGLIATO — oggetto intero con key nested
logger.info({ env: process.env }, 'Env vars');  // include OPENAI_API_KEY, JWT_SECRET, tutto!

// ❌ SBAGLIATO — request/response AI loggati con headers
logger.debug({ request: aiRequest }, 'AI request'); // headers: { Authorization: 'Bearer sk-...' }

// ❌ SBAGLIATO — errore che espone la key nel message
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
try { ... } catch(e) {
  logger.error(`Errore OpenAI con key ${client.apiKey}: ${e.message}`); // NO
}
```

### Pattern corretto: cosa loggare

```typescript
// ✅ CORRETTO — logga solo metadati non sensibili
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY non configurata');

// Log di inizializzazione: solo presenza e lunghezza parziale
logger.info({
  provider: 'openai',
  keyConfigured: !!apiKey,
  keyPrefix: apiKey.slice(0, 7) + '***',  // es. "sk-proj***" — non identificativo
}, 'AI provider inizializzato');

// ✅ CORRETTO — log chiamata AI senza headers/auth
logger.info({
  provider: 'openai',
  model:    'gpt-4o-mini',
  useCase:  'growth_agent_chat',
  userId:   req.user.id,           // OK: ID numerico non è un secret
  tokens:   response.usage?.total_tokens,
}, 'AI call completata');

// ✅ CORRETTO — log errore senza esporre la key
try {
  const result = await openai.chat.completions.create({ ... });
} catch (e) {
  logger.error({
    provider: 'openai',
    error:    e.message,     // il message di OpenAI non contiene la key
    status:   e.status,      // 429, 500, ecc.
    useCase:  'wendy_chat',
  }, 'Errore chiamata AI');
  throw new AppError(503, 'Servizio AI temporaneamente non disponibile', 'AI_ERROR');
}

// ✅ CORRETTO — Morgan: logga solo metodo, path, status (no headers, no body)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
// Oppure usa Pino HTTP con redazione esplicita:
app.use(pinoHttp({
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
}));
```

### Regola per `process.env` nei log

```typescript
// ❌ SBAGLIATO — mai loggare process.env intero
logger.debug({ env: process.env }, 'Avvio server');

// ✅ CORRETTO — logga solo le variabili non sensibili
logger.info({
  nodeEnv:   process.env.NODE_ENV,
  port:      process.env.PORT,
  aiModel:   process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  // NON includere: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, STRIPE_*, ecc.
}, 'Configurazione server');
```

### Checklist pre-commit AI

```bash
# Prima di committare qualsiasi file che tocca AI/LLM:

# 1. Cerca log con API key
git diff --staged | grep -iE '(console\.log|logger\.|pino\().*api.?key'

# 2. Cerca log di process.env intero
git diff --staged | grep -iE 'process\.env[^.\[]'

# 3. Cerca Morgan combined (logga headers)
git diff --staged | grep -iE "morgan\('combined'\|morgan\('dev'"

# 4. Cerca log di oggetti che potrebbero contenere key
git diff --staged | grep -iE '(logger|console)\.(log|debug|info|error).*openai\|anthropic\|groq'

# Se uno dei grep ha output → rivedi il log e rimuovi i campi sensibili
```

---

## Architettura AI — Growth Agent Multi-Agente

> Il codice AI risiede in `packages/ai-server/`. La struttura è modulare per sotto-sistemi.

```
packages/ai-server/src/
├── growth-agent/       ← Sistema multi-agente principale (Growth Agent)
│   ├── agent.ts                  — Orchestratore principale (runGrowthAgent)
│   ├── router-agent.ts           — Classifica intento utente in domini
│   ├── specialist-agent.ts       — Classe base per specialisti di dominio
│   ├── specialists/              — Implementazioni specialistiche
│   │   ├── career-agent.ts       — Carriera (CV, colloqui, job search)
│   │   ├── mindset-agent.ts      — Mindset (credenze limitanti)
│   │   ├── habits-agent.ts       — Abitudini (routine, produttività)
│   │   └── trading-agent.ts      — Trading (psicologia, strategie)
│   ├── supervisor-agent.ts       — Quality gate post-generazione
│   ├── self-evaluator.ts         — Valutazione euristica pre-generazione
│   ├── retriever.ts              — RAG retrieval (pgvector / JS fallback)
│   ├── embedder.ts               — Generazione embedding
│   ├── chain-of-thought.ts       — Ragionamento strutturato con caching
│   ├── memory-manager.ts         — Memoria persistente utente (LLM-enhanced)
│   ├── parallel-handoff.ts       — Dispatch multi-specialista parallelo
│   ├── prompt-builder.ts         — Costruzione prompt di sistema
│   ├── session-summarizer.ts     — Riassunto sessioni chat
│   ├── socratic-engine.ts        — Domande socratiche
│   ├── tone-adapter.ts           — Adattamento tono
│   ├── ui-tools.ts               — Generazione UI tool definitions
│   ├── web-search.ts             — Integrazione ricerca web (Tavily)
│   ├── ingest.ts                 — Ingest documenti
│   ├── platform-ingest.ts        — Ingest contenuti piattaforma
│   ├── pdf-parser.ts             — Parsing PDF
│   └── router-memory.ts          — Persistenza storico routing
│
├── audio/               ← OpenAI TTS (text-to-speech)
├── batch/               ← Utilità batch processing
├── image/               ← Generazione immagini (DALL-E)
├── llm/                 ← Provider LLM astratto (OpenAI / Groq)
├── discovery-agent/     ← Agente discovery content
├── feature-flags.ts     ← Feature flags (FF_*)
├── metrics.ts           ← Metriche Prometheus
└── logger.ts            ← Pino logger strutturato
```

## LLM Provider — `packages/ai-server/src/llm/`

Supporto multi-provider con fallback automatico:

| Provider | Modelli | Casi d'uso |
|---|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini | Chat, analisi, embedding, TTS, vision |
| **Groq** | LLaMA 3.3 70B (mapping da gpt-4o-mini) | Chat streaming veloce, fallback economico |

- Retry con backoff esponenziale (max 3 tentativi, 1s/2s/4s) su errori transitori (429, 503, timeout)
- Nessun retry su 400, 401, 403 (errori logici)

## Feature Flags

Definiti in `packages/ai-server/src/feature-flags.ts`:

| Flag | Default | Descrizione |
|---|---|---|
| `FF_PARALLEL_HANDOFF` | false | Dispatch multi-specialista parallelo |
| `FF_GENERATIVE_UI` | false | Generazione UI tools (roadmap, grafi) |
| `FF_CHAIN_OF_THOUGHT` | true | Ragionamento strutturato CoT |
| `FF_SUPERVISOR` | true | Quality gate supervisor post-generazione |
| `FF_MEMORY` | true | Memoria persistente utente |

## Growth Agent Pipeline

```
Input Utente → RouterAgent (classifica dominio)
             → MemoryManager (carica contesto)
             → SpecialistAgent (se confidenza ≥ 0.45)
               ├─ Retriever (RAG knowledge base)
               ├─ WebSearch (fallback)
               ├─ ChainOfThought (ragionamento)
               └─ SelfEvaluator (euristica, zero LLM cost)
             → SupervisorAgent (quality gate, riscrive se score < 0.70)
             → Memory Extraction (fire-and-forget)
             → SSE Response
```

Documentazione dettagliata di ogni modulo in `docs/ai-modules/`:
- `RETRIEVER.md` — Recupero knowledge base via pgvector/JS
- `ROUTER.md` — Classificazione intento con soglia adattiva
- `SELF-EVALUATOR.md` — Valutazione euristica (4 dimensioni pesate)
- `SPECIALIST.md` — Specialisti di dominio con self-evaluator gate
- `SUPERVISOR.md` — Quality gate con pesi dinamici per intento

## Wendy AI — Regole Specifiche

### Endpoint
- `POST /api/wendy/ask` — Chat streaming con RAG (SSE, rate limit 30/min)
- `POST /api/wendy/voice` — Text-to-speech via OpenAI TTS
- `POST /api/wendy/vision` — Analisi immagini/vision

### Sanitizzazione Contesto
- Il contesto utente (`userContext`) va sempre sanitizzato prima del prompt
- Mai includere `passwordHash`, `paymentMethod`, `cardLast4`
- `userId` numerico OK nei log; email e nome sono PII — hash o ometti

### TTS (Text-to-Speech)
- Provider: OpenAI TTS
- Endpoint: `POST /api/wendy/voice`
- Frontend hook: `useWendyOpenAITTS`, `useWendyVoice`, `useVoiceChat`
- Rate limiting: 30 richieste/minuto

### Streaming Wendy
- Timeout client-side 30s — se scade, mostra messaggio di retry UI
- SSE pattern: `data: { delta: "testo" }\n\n` con `data: [DONE]\n\n` finale
- Feature flag: `FF_GENERATIVE_UI` per UI tools nelle risposte

## Eval Framework

Suite di valutazione in `eval/` per testare qualità e regressioni delle risposte AI:

```bash
pnpm eval    # esegue eval suite
```

```
eval/
├── run-eval.ts       — Runner valutazione
├── samples.json      — Campioni di test (domande + attese)
├── history.json      — Storico valutazioni
└── ...
```

## Metriche AI (Prometheus)

Esposte su `GET /api/admin/wendy-metrics` e `GET /api/metrics`:

| Metrica | Tipo | Labels |
|---|---|---|
| `wendy_requests_total` | Counter | domain, intent |
| `wendy_latency_seconds` | Histogram | phase |
| `wendy_supervisor_rewrites_total` | Counter | domain |
| `wendy_llm_tokens_total` | Counter | model |
| `wendy_router_confidence_histogram` | Histogram | domain, intent |

## Checklist nuova feature AI

- [ ] Feature flag in `feature-flags.ts` (se applicabile)
- [ ] Metriche Prometheus (counter/histogram se rilevante)
- [ ] Rate limiter appropriato (30/min Wendy, 10/min altre AI)
- [ ] Nessuna API key nei log (vedi sezione sicurezza sopra)
- [ ] `userContext` sanitizzato (no email, no passwordHash, no payment info)
- [ ] Retry solo su errori transitori (429, 503, timeout)
- [ ] Streaming: SSE corretto con `[DONE]` finale
- [ ] Test mock per LLM: `vi.mock('packages/ai-server/src/llm/client')`
