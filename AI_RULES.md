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

## AI Router — Regola fondamentale

> **OGNI chiamata AI passa da `ai.chat()` / `ai.agent()` / `ai.embed()`. Mai istanziare provider (OpenAI, Anthropic, Groq) direttamente nelle route.**

```typescript
// ❌ SBAGLIATO — provider diretto nella route
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
router.post('/chat', async (req, res) => {
  const result = await openai.chat.completions.create({ ... });
});

// ✅ CORRETTO — sempre tramite il router AI
import { ai } from '../lib/ai/index.js';
router.post('/chat', requireAuth, aiLimiter, async (req, res) => {
  const result = await ai.chat({ useCase: 'streaming_chat', messages: [...] });
});
```

## Use Case — Provider mapping

| Use Case | Provider default | Fallback | Quando usarlo |
|---|---|---|---|
| `streaming_chat` | Groq | OpenAI | Chat SSE, career coach, Wendy |
| `agent_analysis` | Anthropic | OpenAI | Ragionamento strutturato, tool use |
| `embedding` | OpenAI | — | RAG, similarity, discovery feed |
| `research` | Groq | OpenAI | Background jobs, enrichment |
| `json_extraction` | Groq | OpenAI | CV, ATS score, cover letter, onboarding |

## Streaming

```typescript
// ✅ SSE corretto per chat streaming
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

const stream = await ai.stream({ useCase: 'streaming_chat', messages });
for await (const chunk of stream) {
  res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
}
res.write('data: [DONE]\n\n');
res.end();

// ❌ Retry su streaming: withRetry solo su ai.chat() e ai.embed() — MAI su ai.stream()
```

## Circuit Breaker + Retry

```
closed  → chiamata normale
open    → fallback immediato (>5 fail)
half-open → un tentativo → se ok torna closed
```

- Retry: max 3 tentativi, backoff esponenziale 1s/2s/4s
- Solo su errori retryable: 429, 503, timeout di rete
- Mai retry su 400, 401, 403 (errori logici, non transitori)

## Wendy / Growth Agent — regole specifiche

- Il contesto utente (`userContext`) va sempre sanitizzato prima di passarlo al prompt
- Mai includere `passwordHash`, `paymentMethod`, `cardLast4` nel contesto AI
- Il `userId` numerico è accettabile nel log; email e nome sono PII — hash o ometti
- Streaming Wendy: timeout client-side 30s — se scade, mostra messaggio di retry UI

```typescript
// ✅ Sanitizza userContext prima del prompt
function sanitizeForAi(user: UserRow): WendyUserContext {
  return {
    name:         user.name,          // OK: nome di battesimo per personalizzazione
    journeyType:  user.journeyType,
    userMode:     user.userMode,
    sectorName:   user.sectorName,
    // NON includere: email, passwordHash, stripeCustomerId, cardLast4
  };
}
```

## Checklist nuova feature AI

- [ ] Chiamata sempre tramite `ai.chat()` / `ai.stream()` / `ai.embed()` — mai provider diretti
- [ ] `aiLimiter` sul router Express (20 req/min)
- [ ] Nessuna API key nei log (vedi sezione sicurezza sopra)
- [ ] `userContext` sanitizzato (no email, no passwordHash, no payment info)
- [ ] Retry solo su errori transitori (429, 503, timeout)
- [ ] Streaming: SSE corretto con `[DONE]` finale
- [ ] Test mock: `vi.mock('../../lib/ai', () => ({ ai: { chat: mockAiChat } }))`
