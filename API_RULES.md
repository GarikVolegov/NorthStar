# 🔌 API_RULES.md — Backend API Engineering Policy

## NorthStar / Orientamento SaaS

### Stack: Express 5 · TypeScript · Drizzle ORM · JWT · Stripe · Zod

> **Leggi questo file prima di aggiungere, modificare o eliminare qualsiasi endpoint.**
> Queste regole proteggono la sicurezza degli utenti, l’integrità dei dati e la stabilità economica del progetto.
> Una route mal scritta può esporre dati privati, abilitare frodi Stripe o far crashare il server in produzione.

-----

## 📋 INDICE

1. [Principi Fondamentali](#1-principi-fondamentali)
1. [Anatomia degli Endpoint NorthStar](#2-anatomia-degli-endpoint-northstar)
1. [Classificazione degli Endpoint per Rischio](#3-classificazione-degli-endpoint-per-rischio)
1. [Regole di Autenticazione e Autorizzazione](#4-regole-di-autenticazione-e-autorizzazione)
1. [Regole di Validazione Input (Zod)](#5-regole-di-validazione-input-zod)
1. [Regole di Design degli Endpoint](#6-regole-di-design-degli-endpoint)
1. [Regole di Gestione degli Errori](#7-regole-di-gestione-degli-errori)
1. [Regole Stripe](#8-regole-stripe)
1. [Regole SSE Streaming](#9-regole-sse-streaming)
1. [Regole di Rate Limiting](#10-regole-di-rate-limiting)
1. [Regole di Isolamento Dati Utente](#11-regole-di-isolamento-dati-utente)
1. [Regole sui Middleware](#12-regole-sui-middleware)
1. [Operazioni Proibite](#13-operazioni-proibite)
1. [Checklist Pre-Deploy Endpoint](#14-checklist-pre-deploy-endpoint)
1. [Pattern di Riferimento](#15-pattern-di-riferimento)

-----

## 1. PRINCIPI FONDAMENTALI

### Il Manifesto dell’API Sicura

```
1. Ogni endpoint è pubblico finché non lo proteggi esplicitamente.
   Il default è NEGARE l'accesso, non concederlo.

2. Non fidarti mai del client.
   userId, ruoli e permessi vengono dal JWT server-side, MAI dal body o query string.

3. Valida tutto ciò che entra, sanitizza tutto ciò che esce.
   Un input non validato è una vulnerabilità. Un output non filtrato è un data leak.

4. Stripe è denaro reale.
   Un webhook senza verifica della firma è una porta aperta alle frodi.

5. Gli errori non devono insegnare agli attaccanti.
   Stack trace, nomi di tabelle e dettagli interni non escono mai in produzione.
```

### La Regola dei 3 Controlli

Prima di rispondere a qualsiasi richiesta, ogni endpoint esegue **in questo ordine**:

```
1. AUTENTICAZIONE  → Chi sei? (JWT valido?)
2. AUTORIZZAZIONE  → Hai il permesso? (Il tuo userId corrisponde alla risorsa?)
3. VALIDAZIONE     → I dati che mandi sono corretti? (Schema Zod)

→ Se anche solo UN controllo fallisce: 4xx e stop. Mai proseguire.
```

-----

## 2. ANATOMIA DEGLI ENDPOINT NORTHSTAR

### Mappa Completa delle Route per Area

```
artifacts/api-server/src/routes/
│
├── auth.ts
│   ├── POST /api/auth/register          [PUBLIC]
│   ├── POST /api/auth/login             [PUBLIC]
│   ├── GET  /api/auth/me                [AUTH]
│   └── POST /api/auth/logout            [AUTH]
│
├── users.ts
│   ├── GET  /api/users/:id              [AUTH + OWNER]
│   ├── PATCH /api/users/:id             [AUTH + OWNER]
│   └── DELETE /api/users/:id           [AUTH + OWNER + CRITICAL]
│
├── test.ts
│   ├── POST /api/test/start             [AUTH]
│   ├── POST /api/test/answer            [AUTH]
│   ├── GET  /api/test/sessions/:id      [AUTH + OWNER]
│   └── GET  /api/test/sessions/latest   [AUTH]
│
├── sectors.ts
│   ├── GET  /api/sectors                [PUBLIC — contenuto statico]
│   ├── GET  /api/sectors/:id            [PUBLIC]
│   ├── GET  /api/sectors/:id/stats      [PUBLIC]
│   └── GET  /api/sectors/:id/roles      [PUBLIC]
│
├── roadmap.ts
│   ├── GET  /api/roadmap/:sectorId      [AUTH + PREMIUM?]
│   └── GET  /api/roadmap/:sectorId/stream  [AUTH + PREMIUM — SSE]
│
├── wiki.ts
│   ├── POST /api/wiki/:sectorId/ask     [AUTH + PREMIUM — SSE]
│   └── GET  /api/wiki/:sectorId/summary [AUTH]
│
├── knowledge.ts
│   ├── GET  /api/knowledge/graph        [AUTH + OWNER]
│   ├── POST /api/knowledge/nodes        [AUTH + OWNER]
│   ├── PATCH /api/knowledge/nodes/:id   [AUTH + OWNER]
│   ├── DELETE /api/knowledge/nodes/:id  [AUTH + OWNER]
│   ├── POST /api/knowledge/edges        [AUTH + OWNER]
│   ├── DELETE /api/knowledge/edges/:id  [AUTH + OWNER]
│   └── POST /api/knowledge/chat         [AUTH + OWNER — SSE]
│
├── objectives.ts
│   ├── GET  /api/objectives             [AUTH + OWNER]
│   ├── POST /api/objectives             [AUTH + OWNER]
│   ├── PATCH /api/objectives/:id        [AUTH + OWNER]
│   └── DELETE /api/objectives/:id      [AUTH + OWNER]
│
├── stripe.ts
│   ├── POST /api/stripe/create-checkout [AUTH]
│   ├── POST /api/stripe/portal          [AUTH]
│   └── POST /api/stripe/webhook         [STRIPE_SIGNATURE — NO JWT]
│
├── news.ts
│   ├── GET  /api/news                   [AUTH]
│   └── GET  /api/news/premium           [AUTH + PREMIUM]
│
└── admin.ts
    ├── GET  /api/admin/review-queue     [AUTH + ADMIN]
    ├── POST /api/admin/approve/:id      [AUTH + ADMIN]
    ├── POST /api/admin/reject/:id       [AUTH + ADMIN]
    └── GET  /api/admin/audit-logs       [AUTH + ADMIN]
```

### Legenda Livelli di Accesso

|Tag                 |Significato                        |Middleware richiesto            |
|--------------------|-----------------------------------|--------------------------------|
|`[PUBLIC]`          |Nessuna autenticazione             |Nessuno                         |
|`[AUTH]`            |JWT valido richiesto               |`requireAuth`                   |
|`[AUTH + OWNER]`    |JWT + risorsa appartiene all’utente|`requireAuth` + check ownership |
|`[AUTH + PREMIUM]`  |JWT + subscription Stripe attiva   |`requireAuth` + `requirePremium`|
|`[AUTH + ADMIN]`    |JWT + ruolo admin                  |`requireAuth` + `requireAdmin`  |
|`[STRIPE_SIGNATURE]`|Firma webhook Stripe               |`verifyStripeSignature`         |

-----

## 3. CLASSIFICAZIONE DEGLI ENDPOINT PER RISCHIO

### 🔴 RISCHIO CRITICO

- Qualsiasi modifica a `users` (DELETE, PATCH email/password)
- Stripe webhook handler
- Endpoint che ritornano dati di più utenti
- Nuovi endpoint su route già esistenti (rischio di shadowing)
- Modifica della logica di `requireAuth` o `requireAdmin`

### 🟠 RISCHIO ALTO

- Nuovi endpoint AUTH + OWNER su tabelle critiche
- Endpoint che eseguono operazioni AI (costo OpenAI)
- Endpoint SSE (gestione connessioni persistenti)
- Nuovi endpoint premium (logica subscription)

### 🟡 RISCHIO MEDIO

- Nuovi endpoint CRUD su tabelle utente (objectives, favorites)
- Modifica di endpoint esistenti pubblici
- Aggiunta di nuovi parametri a endpoint esistenti

### 🟢 RISCHIO BASSO

- Nuovi endpoint GET su contenuto pubblico (sectors, education)
- Aggiunta di campi opzionali al response
- Nuovi endpoint admin (accesso già ristretto)

-----

## 4. REGOLE DI AUTENTICAZIONE E AUTORIZZAZIONE

### 4.1 Middleware requireAuth — Implementazione Canonica

```typescript
// middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../lib/auth-jwt';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Estendere il tipo Request per includere l'utente autenticato
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'user' | 'admin';
        stripeSubscriptionId: string | null;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // ✅ Verifica presenza header
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  const token = authHeader.slice(7);

  try {
    // ✅ Verifica firma JWT
    const payload = verifyJWT(token);

    // ✅ Verifica che l'utente esista ancora nel DB
    // (evita che token validi di utenti cancellati funzionino)
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    // ✅ Attacca l'utente alla request — mai fidarsi del body per userId
    req.user = user;
    next();

  } catch {
    // ❌ Non esporre il dettaglio dell'errore JWT
    return res.status(401).json({ error: 'Token non valido' });
  }
}
```

### 4.2 Middleware requirePremium

```typescript
// middleware/premium.ts

export function requirePremium(req: Request, res: Response, next: NextFunction) {
  // requireAuth deve essere eseguito prima
  if (!req.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  if (!req.user.stripeSubscriptionId) {
    return res.status(403).json({
      error: 'Subscription richiesta',
      code: 'PREMIUM_REQUIRED',  // il frontend usa questo code per redirect
    });
  }

  next();
}

// Utilizzo:
router.get('/wiki/:sectorId/stream', requireAuth, requirePremium, wikiStreamHandler);
```

### 4.3 Middleware requireAdmin

```typescript
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  if (req.user.role !== 'admin') {
    // ✅ Ritornare 404 invece di 403 per non rivelare l'esistenza della route
    return res.status(404).json({ error: 'Not found' });
  }

  next();
}
```

### 4.4 Regola Fondamentale — userId dal Token, MAI dal Client

```typescript
// ❌ PROIBITO ASSOLUTO — userId dalla request (manipolabile dal client)
router.get('/objectives', requireAuth, async (req, res) => {
  const userId = req.query.userId;        // ← VULNERABILITÀ: chiunque può mettere userId altrui
  const userId = req.body.userId;         // ← VULNERABILITÀ
  const userId = req.params.userId;       // ← VULNERABILITÀ se non verificato contro req.user
});

// ✅ UNICO MODO CORRETTO — userId dal token verificato
router.get('/objectives', requireAuth, async (req, res) => {
  const userId = req.user!.id;            // ← dal JWT verificato server-side
  const objectives = await db
    .select()
    .from(userObjectives)
    .where(eq(userObjectives.userId, userId));
  res.json(objectives);
});
```

### 4.5 Verifica Ownership su Risorse Specifiche

```typescript
// ✅ Pattern obbligatorio per endpoint AUTH + OWNER con ID nella route

router.patch('/objectives/:id', requireAuth, async (req, res) => {
  const objectiveId = parseInt(req.params.id);
  const userId = req.user!.id;

  // STEP 1: Recuperare la risorsa
  const [objective] = await db
    .select()
    .from(userObjectives)
    .where(eq(userObjectives.id, objectiveId))
    .limit(1);

  // STEP 2: Verificare che esista
  if (!objective) {
    return res.status(404).json({ error: 'Obiettivo non trovato' });
  }

  // STEP 3: Verificare che appartenga all'utente autenticato
  if (objective.userId !== userId) {
    // ✅ Ritornare 404, non 403 — non rivelare che la risorsa esiste ma non è tua
    return res.status(404).json({ error: 'Obiettivo non trovato' });
  }

  // STEP 4: Solo ora procedere con la modifica
  const validated = updateObjectiveSchema.parse(req.body);
  const [updated] = await db
    .update(userObjectives)
    .set(validated)
    .where(eq(userObjectives.id, objectiveId))
    .returning();

  res.json(updated);
});
```

-----

## 5. REGOLE DI VALIDAZIONE INPUT (ZOD)

### 5.1 Principio — Ogni Input è Sospetto

```typescript
// ✅ REGOLA ASSOLUTA: ogni endpoint che riceve dati deve validarli con Zod
// Non esistono eccezioni "tanto sono dati semplici"

// Struttura file Zod schemas:
// lib/api-zod/
// ├── auth.schemas.ts
// ├── user.schemas.ts
// ├── objectives.schemas.ts
// ├── knowledge.schemas.ts
// └── index.ts
```

### 5.2 Schema Pattern per Tipo di Operazione

```typescript
import { z } from 'zod';

// CREATE schema — tutti i campi required (escludendo id, createdAt)
export const createObjectiveSchema = z.object({
  text:        z.string().min(1).max(500),
  targetDate:  z.string().datetime().optional(),
  priority:    z.enum(['low', 'medium', 'high']).default('medium'),
});

// UPDATE schema — tutti i campi optional (PATCH semantics)
export const updateObjectiveSchema = z.object({
  text:        z.string().min(1).max(500).optional(),
  progress:    z.number().int().min(0).max(100).optional(),
  completed:   z.boolean().optional(),
  targetDate:  z.string().datetime().nullable().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Almeno un campo da aggiornare è richiesto' }
);

// QUERY PARAMS schema — per GET con filtri
export const listObjectivesQuerySchema = z.object({
  completed: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  limit:     z.coerce.number().int().min(1).max(100).default(50),
  offset:    z.coerce.number().int().min(0).default(0),
});
```

### 5.3 Utilizzo in Route — Pattern Obbligatorio

```typescript
router.post('/objectives', requireAuth, async (req, res) => {
  // ✅ Validare PRIMA di qualsiasi logica business
  const result = createObjectiveSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Dati non validi',
      details: result.error.flatten().fieldErrors,  // dettaglio per il frontend
    });
  }

  const data = result.data;  // TypeScript ora sa esattamente il tipo
  const userId = req.user!.id;

  // Proseguire con dati validati e tipati
  const [objective] = await db
    .insert(userObjectives)
    .values({ ...data, userId })
    .returning();

  res.status(201).json(objective);
});
```

### 5.4 Sanitizzazione Output — Campi Sensibili

```typescript
// ✅ Non esporre mai campi sensibili nella response

// Campo allowlist — definire esplicitamente cosa esce
const safeUserSchema = z.object({
  id:                   z.number(),
  email:                z.string(),
  name:                 z.string().nullable(),
  role:                 z.enum(['user', 'admin']),
  stripeSubscriptionId: z.string().nullable(),
  createdAt:            z.string(),
  // ❌ NON includere: passwordHash, jwtSecret, stripeCustomerId (raw)
});

// Applicare prima di inviare
router.get('/auth/me', requireAuth, async (req, res) => {
  const safeUser = safeUserSchema.parse({
    ...req.user,
    createdAt: req.user.createdAt.toISOString(),
  });
  res.json(safeUser);
});

// ❌ PROIBITO — mandare l'oggetto raw del DB direttamente
router.get('/auth/me', requireAuth, async (req, res) => {
  res.json(dbUser);  // ← potrebbe contenere passwordHash, campi interni
});
```

-----

## 6. REGOLE DI DESIGN DEGLI ENDPOINT

### 6.1 Metodi HTTP — Semantica Obbligatoria

```
GET     → Lettura, idempotente, nessuna modifica di stato
POST    → Creazione di nuova risorsa, o azione non idempotente (es: trigger AI)
PATCH   → Aggiornamento parziale di risorsa esistente
PUT     → Sostituzione completa (usare raramente, preferire PATCH)
DELETE  → Eliminazione di risorsa

✅ CORRETTO:
POST   /api/objectives           → crea obiettivo
GET    /api/objectives           → lista obiettivi
PATCH  /api/objectives/:id       → aggiorna parzialmente
DELETE /api/objectives/:id       → elimina

❌ SBAGLIATO:
GET    /api/objectives/delete/:id  → DELETE via GET
POST   /api/objectives/update      → UPDATE via POST generico
GET    /api/objectives/create      → CREATE via GET
```

### 6.2 Naming delle Route — Convenzioni

```
Risorse al plurale:     /api/sectors, /api/objectives, /api/knowledge/nodes
ID nella path:          /api/objectives/:id
Sub-risorse:            /api/sectors/:id/stats
Azioni non-CRUD:        /api/knowledge/chat  (azione, non risorsa)
Stream endpoints:        /api/roadmap/:id/stream  (suffisso /stream)
Webhook esterni:         /api/stripe/webhook  (non /api/webhooks/stripe)

✅ Naming coerente:
/api/knowledge/nodes     → lista nodi
/api/knowledge/nodes/:id → nodo singolo
/api/knowledge/edges     → lista edges
/api/knowledge/chat      → azione di chat RAG

❌ Naming inconsistente:
/api/getKnowledgeNodes
/api/knowledge_node/:nodeId
/api/knowledgeEdge
```

### 6.3 Response Format — Standard

```typescript
// ✅ Successo — risposta diretta (non wrappare in { data: ... })
res.status(200).json(objective);           // oggetto singolo
res.status(200).json(objectives);          // array
res.status(201).json(newObjective);        // creazione → 201

// ✅ Errore — formato standard consistente
res.status(400).json({
  error: 'Messaggio leggibile',           // sempre presente
  code: 'VALIDATION_ERROR',               // opzionale, per il frontend
  details: { field: ['messaggio'] },      // opzionale, per validazione
});

// ✅ Operazione riuscita senza body
res.status(204).send();                   // DELETE riuscito

// ❌ PROIBITI — formati inconsistenti
res.json({ success: true, data: obj });   // wrapping inutile
res.json({ status: 'ok', result: obj });  // naming inconsistente
res.json({ message: 'Created', id: 1 }); // mix message + id
```

### 6.4 Status Code — Guida Rapida

```
200 OK           → GET, PATCH, PUT riusciti
201 Created      → POST che crea una risorsa
204 No Content   → DELETE riuscito, PATCH senza body di risposta
400 Bad Request  → Validazione Zod fallita, parametri mancanti
401 Unauthorized → Token mancante, scaduto, non valido
403 Forbidden    → Autenticato ma senza permesso (usare raramente — vedi 404)
404 Not Found    → Risorsa non trovata OPPURE risorsa trovata ma non tua (IDOR protection)
409 Conflict     → Email già esistente, vincolo UNIQUE violato
422 Unprocessable → Input valido ma logicamente scorretto (es: data nel passato)
429 Too Many     → Rate limit superato
500 Internal     → Errore non gestito — loggare, non dettagliare
```

-----

## 7. REGOLE DI GESTIONE DEGLI ERRORI

### 7.1 Error Handler Globale — Obbligatorio

```typescript
// middleware/errorHandler.ts
// ✅ Registrare SEMPRE come ultimo middleware in app.ts

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dati non validi',
      details: err.flatten().fieldErrors,
    });
  }

  // Drizzle/PostgreSQL constraint violations
  if (err instanceof Error && 'code' in err) {
    const dbError = err as { code: string; constraint?: string };
    if (dbError.code === '23505') {  // unique_violation
      return res.status(409).json({ error: 'Risorsa già esistente' });
    }
    if (dbError.code === '23503') {  // foreign_key_violation
      return res.status(400).json({ error: 'Riferimento non valido' });
    }
  }

  // ✅ Log dettagliato SERVER-SIDE
  console.error('[API Error]', {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  // ❌ MAI mandare stack trace o dettagli interni al client
  res.status(500).json({ error: 'Errore interno del server' });
}
```

### 7.2 Try-Catch — Regole

```typescript
// ✅ OBBLIGATORIO — wrappare ogni handler asincrono
// Express 5 gestisce automaticamente le Promise rejected nelle route
// ma il wrapping esplicito rende il codice più leggibile

router.post('/objectives', requireAuth, async (req, res) => {
  try {
    // logica
    res.status(201).json(result);
  } catch (err) {
    // Rilanciare al globalErrorHandler
    throw err;
    // OPPURE in Express 5: semplicemente non catturare — viene gestito automaticamente
  }
});

// ✅ Per Express 5 (già nel progetto) — le async route errors sono auto-propagate
// Non serve wrappare manualmente in try-catch se si usa il globalErrorHandler
```

### 7.3 Logging Strutturato

```typescript
// ✅ Log con contesto — permette di tracciare problemi in produzione
console.error('[API Error]', {
  method: req.method,
  path: req.path,
  userId: req.user?.id,          // utile per debugging
  ip: req.ip,                    // utile per rate limiting manuale
  error: err.message,
  timestamp: new Date().toISOString(),
});

// ✅ Log di audit per operazioni sensibili
console.info('[AUDIT]', {
  action: 'user.delete',
  targetUserId: parseInt(req.params.id),
  performedBy: req.user!.id,
  timestamp: new Date().toISOString(),
});

// ❌ PROIBITO — log che espongono dati sensibili
console.log('User data:', dbUser);       // potrebbe loggare passwordHash
console.log('Stripe key:', process.env.STRIPE_SECRET_KEY);
console.log('JWT payload:', decodedToken);
```

-----

## 8. REGOLE STRIPE

### 8.1 Verifica Firma Webhook — Non Negoziabile

```typescript
// routes/stripe.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// ✅ OBBLIGATORIO — raw body per la verifica della firma
// Il body parser JSON standard NON deve essere applicato a questo endpoint
// Registrare PRIMA del json() middleware globale in app.ts

router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),  // raw body — NON json()
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Signature mancante' });
    }

    let event: Stripe.Event;

    try {
      // ✅ Verifica crittografica della firma — previene webhook falsi
      event = stripe.webhooks.constructEvent(
        req.body,                                        // raw buffer
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!              // secret dal dashboard Stripe
      );
    } catch (err) {
      console.error('[Stripe] Webhook signature invalid:', err);
      return res.status(400).json({ error: 'Firma non valida' });
    }

    // ✅ Rispondere subito a Stripe (entro 5 secondi)
    // poi processare l'evento in modo asincrono
    res.status(200).json({ received: true });

    // Processare l'evento dopo aver risposto
    await handleStripeEvent(event);
  }
);
```

### 8.2 Handler degli Eventi Stripe

```typescript
async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = parseInt(session.metadata?.userId ?? '0');

      if (!userId) {
        console.error('[Stripe] Missing userId in session metadata');
        return;
      }

      await db
        .update(users)
        .set({
          stripeCustomerId:     session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        })
        .where(eq(users.id, userId));

      console.info('[Stripe] Subscription activated for user:', userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      await db
        .update(users)
        .set({ stripeSubscriptionId: null })
        .where(eq(users.stripeSubscriptionId, subscription.id));

      console.info('[Stripe] Subscription cancelled:', subscription.id);
      break;
    }

    case 'invoice.payment_failed': {
      // Loggare ma non revocare immediatamente — Stripe ritenta
      const invoice = event.data.object as Stripe.Invoice;
      console.warn('[Stripe] Payment failed for subscription:', invoice.subscription);
      break;
    }

    default:
      // ✅ Ignorare eventi non gestiti silenziosamente
      console.info('[Stripe] Unhandled event type:', event.type);
  }
}
```

### 8.3 Regole Generali Stripe

```typescript
// ✅ Passare sempre userId nel metadata del checkout session
const session = await stripe.checkout.sessions.create({
  customer_email: user.email,
  metadata: { userId: String(user.id) },  // ← recuperato nel webhook
  // ...
});

// ✅ Verificare lo stato subscription dal DB, non da Stripe a ogni richiesta
// (costoso e lento — usare il DB come cache)
const isPremium = !!req.user.stripeSubscriptionId;  // già nel JWT

// ❌ Non fare chiamate Stripe per verificare subscription ad ogni richiesta
const subscription = await stripe.subscriptions.retrieve(subscriptionId);  // troppo lento

// ✅ Sincronizzare via webhook — il DB è sempre aggiornato da Stripe
// ✅ Usare test mode keys in development, production keys solo in production
// ✅ Non loggare mai la stripe_secret_key
// ✅ Il STRIPE_WEBHOOK_SECRET è diverso dalla STRIPE_SECRET_KEY — non confonderli
```

-----

## 9. REGOLE SSE STREAMING

### 9.1 Setup Headers SSE — Standard

```typescript
// ✅ OBBLIGATORIO — headers corretti per SSE

function setupSSEHeaders(res: Response) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Nginx: disabilita buffering proxy
  res.flushHeaders();
}

function sendSSEChunk(res: Response, data: string) {
  res.write(`data: ${JSON.stringify({ delta: data })}\n\n`);
}

function sendSSEDone(res: Response) {
  res.write('data: [DONE]\n\n');
  res.end();
}

function sendSSEError(res: Response, message: string) {
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  res.end();
}
```

### 9.2 Pattern Completo Endpoint SSE

```typescript
router.post('/wiki/:sectorId/ask', requireAuth, requirePremium, async (req, res) => {
  const { sectorId } = req.params;
  const userId = req.user!.id;

  // ✅ Validare prima di aprire lo stream
  const { message } = askSchema.parse(req.body);

  // ✅ Setup headers
  setupSSEHeaders(res);

  // ✅ Gestire disconnessione del client
  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
    console.info('[SSE] Client disconnected:', userId);
  });

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: buildWikiPrompt(sectorId, message),
      max_tokens: 1500,
    });

    for await (const chunk of stream) {
      // ✅ Controllare se il client è ancora connesso prima di scrivere
      if (!isClientConnected) {
        stream.controller.abort();
        break;
      }

      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) sendSSEChunk(res, delta);
    }

    if (isClientConnected) sendSSEDone(res);

  } catch (err) {
    console.error('[SSE] Error in wiki stream:', err);
    if (isClientConnected) {
      sendSSEError(res, 'Errore durante la generazione');
    }
  }
});
```

### 9.3 Regole SSE

```
✅ Validare l'input PRIMA di aprire lo stream (no stream aperto su input invalido)
✅ Gestire sempre req.on('close') per pulire risorse se il client disconnette
✅ Abortire lo stream OpenAI se il client disconnette (risparmio costi)
✅ Ogni errore durante lo stream viene comunicato al client via SSE error event
✅ Il client SSE usa sempre requireAuth (niente stream pubblici)
✅ Loggare la disconnessione del client per monitoraggio

❌ Non usare JSON middleware su endpoint SSE (headers incompatibili)
❌ Non mettere logica pesante dopo res.flushHeaders() in modo sincrono
❌ Non dimenticare X-Accel-Buffering: no (Nginx bufferizza SSE per default)
❌ Non aprire più stream per lo stesso utente contemporaneamente senza limite
```

-----

## 10. REGOLE DI RATE LIMITING

### 10.1 Limiti per Tipo di Endpoint

```typescript
import rateLimit from 'express-rate-limit';

// ✅ Rate limiter per endpoint AI (costosi)
export const aiRateLimit = rateLimit({
  windowMs:         60 * 1000,     // 1 minuto
  max:              10,             // 10 richieste AI al minuto
  keyGenerator:     (req) => String(req.user?.id ?? req.ip),
  message:          { error: 'Troppe richieste AI, attendi un momento', code: 'AI_RATE_LIMIT' },
  standardHeaders:  true,
  legacyHeaders:    false,
});

// ✅ Rate limiter per auth (prevenire brute force)
export const authRateLimit = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 minuti
  max:              10,               // 10 tentativi di login per IP
  keyGenerator:     (req) => req.ip ?? 'unknown',
  message:          { error: 'Troppi tentativi, riprova tra 15 minuti' },
  skipSuccessfulRequests: true,       // non contare i login riusciti
});

// ✅ Rate limiter generico per tutte le API
export const generalRateLimit = rateLimit({
  windowMs:    60 * 1000,   // 1 minuto
  max:         100,          // 100 request al minuto per utente/IP
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message:     { error: 'Troppe richieste' },
});
```

### 10.2 Applicazione dei Rate Limiter

```typescript
// app.ts — rate limiter globale
app.use('/api', generalRateLimit);

// routes/auth.ts — rate limiter specifico per login
router.post('/login', authRateLimit, loginHandler);
router.post('/register', authRateLimit, registerHandler);

// routes/wiki.ts, roadmap.ts, knowledge.ts — rate limiter AI
router.post('/wiki/:sectorId/ask', requireAuth, requirePremium, aiRateLimit, wikiHandler);
router.get('/roadmap/:sectorId/stream', requireAuth, aiRateLimit, roadmapHandler);
router.post('/knowledge/chat', requireAuth, aiRateLimit, ragChatHandler);
```

-----

## 11. REGOLE DI ISOLAMENTO DATI UTENTE

### 11.1 Principio di Minimo Privilegio

```typescript
// ✅ OGNI query su dati utente DEVE filtrare per userId
// Non esiste eccezione: neanche per admin (usa query separate con audit)

// ✅ Pattern obbligatorio per lista risorse utente
const objectives = await db
  .select()
  .from(userObjectives)
  .where(eq(userObjectives.userId, req.user!.id))  // ← sempre
  .orderBy(desc(userObjectives.createdAt));

// ✅ Pattern obbligatorio per risorsa singola
const [node] = await db
  .select()
  .from(knowledgeNodes)
  .where(
    and(
      eq(knowledgeNodes.id, nodeId),
      eq(knowledgeNodes.userId, req.user!.id)  // ← double check ownership
    )
  )
  .limit(1);

if (!node) return res.status(404).json({ error: 'Non trovato' });
// (404 anche se esiste ma appartiene ad altri — IDOR protection)
```

### 11.2 Query Admin — Separate e Auditate

```typescript
// ✅ Le query admin che vedono dati di più utenti sono separate
// e SEMPRE accompagnate da audit log

router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  // ✅ Audit log prima di eseguire la query
  await db.insert(auditLogs).values({
    action: 'admin.list_users',
    performedBy: req.user!.id,
    metadata: { ip: req.ip },
  });

  // ✅ Paginazione obbligatoria su query admin (no full scan)
  const { limit, offset } = adminQuerySchema.parse(req.query);

  const usersList = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      // ❌ NON includere stripeCustomerId o altri campi sensibili
    })
    .from(users)
    .limit(Math.min(limit, 100))   // max 100 per query
    .offset(offset);

  res.json(usersList);
});
```

-----

## 12. REGOLE SUI MIDDLEWARE

### 12.1 Ordine Obbligatorio in app.ts

```typescript
// app.ts — ordine dei middleware CRITICO

// 1. Security headers (primo di tutto)
app.use(helmet());

// 2. CORS (prima del body parsing)
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));

// 3. Rate limiter globale
app.use('/api', generalRateLimit);

// 4. Stripe webhook PRIMA del json parser (raw body necessario)
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// 5. Body parsing
app.use(express.json({ limit: '1mb' }));  // limite esplicito

// 6. Route handlers
app.use('/api/auth', authRouter);
app.use('/api/sectors', sectorsRouter);
// ... altre route

// 7. 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route non trovata' }));

// 8. Error handler SEMPRE ULTIMO
app.use(globalErrorHandler);
```

### 12.2 Helmet — Headers di Sicurezza

```typescript
// ✅ Helmet attivo con configurazione di base
app.use(helmet({
  contentSecurityPolicy: false,  // gestito dal frontend Vite
  crossOriginEmbedderPolicy: false,
}));

// Helmet aggiunge automaticamente:
// X-Content-Type-Options: nosniff
// X-Frame-Options: DENY
// X-XSS-Protection: 1; mode=block
// Strict-Transport-Security (su HTTPS)
```

-----

## 13. OPERAZIONI PROIBITE

### 🚫 Sicurezza — Proibiti Assoluti

```typescript
// ❌ userId dal body/query (IDOR vulnerability)
const userId = req.body.userId;
const userId = req.query.userId;

// ❌ Endpoint protetto senza requireAuth
router.get('/objectives', async (req, res) => { ... });

// ❌ Stripe webhook senza verifica firma
router.post('/stripe/webhook', express.json(), async (req, res) => { ... });

// ❌ Stack trace nel response
res.status(500).json({ error: err.stack });
res.status(500).json({ error: err.message, stack: err.stack });

// ❌ SQL non parametrizzato
db.execute(`SELECT * FROM users WHERE id = ${req.params.id}`);

// ❌ Risposta senza filtro campi sensibili
res.json(await db.select().from(users).where(eq(users.id, id)));
// (potrebbe contenere passwordHash, segreti interni)

// ❌ Admin endpoint senza audit log
router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  await db.delete(users).where(eq(users.id, parseInt(req.params.id)));
  res.status(204).send();
  // ← nessun log di chi ha cancellato cosa — PROIBITO
});
```

### 🚫 Design — Proibiti

```
❌ Logica business dentro i middleware (i middleware fanno solo guard)
❌ Chiamate database nei middleware di auth (eccetto requireAuth che verifica user)
❌ Endpoint che fanno più di una cosa (violazione single responsibility)
❌ Risposta con 200 per operazioni fallite (es: { success: false } con status 200)
❌ Route non registrate in app.ts (route "fantasma" difficili da tracciare)
❌ Hard-coded secrets nel codice (usare process.env.*)
❌ Dipendenza circolare tra route files
```

-----

## 14. CHECKLIST PRE-DEPLOY ENDPOINT

```markdown
## Pre-Deploy — [NOME ENDPOINT] — [DATA]

### Autenticazione e Autorizzazione
- [ ] L'endpoint ha il livello di accesso corretto? [PUBLIC/AUTH/OWNER/PREMIUM/ADMIN]
- [ ] Se AUTH: usa requireAuth middleware?
- [ ] Se OWNER: verifica ownership della risorsa con doppio filtro?
- [ ] Se PREMIUM: usa requirePremium middleware?
- [ ] Se ADMIN: usa requireAdmin E ha audit log?
- [ ] userId viene solo da req.user.id (mai da body/query/params)?

### Validazione
- [ ] Tutti gli input sono validati con Zod schema?
- [ ] I parametri URL (req.params.id) sono convertiti al tipo corretto?
- [ ] L'output non contiene campi sensibili (passwordHash, chiavi, ecc.)?

### Errori
- [ ] Tutti i path di errore ritornano il status code corretto?
- [ ] Gli errori non rivelano informazioni interne (stack trace, nomi tabelle)?
- [ ] L'endpoint è wrappato nel globalErrorHandler (registrato in app.ts)?

### Stripe (se applicabile)
- [ ] Il webhook usa express.raw() e non express.json()?
- [ ] La firma viene verificata con stripe.webhooks.constructEvent()?
- [ ] Il metadata contiene userId per recuperarlo nel webhook?

### SSE (se applicabile)
- [ ] I headers SSE sono impostati correttamente?
- [ ] req.on('close') gestisce la disconnessione del client?
- [ ] Lo stream OpenAI viene abortito se il client disconnette?
- [ ] L'input è validato PRIMA di aprire lo stream?

### Rate Limiting
- [ ] L'endpoint ha il rate limiter appropriato?
- [ ] Gli endpoint AI hanno aiRateLimit?
- [ ] Gli endpoint auth hanno authRateLimit?

### Performance
- [ ] Le query hanno WHERE su colonne indicizzate?
- [ ] Le liste hanno LIMIT (nessuna query unbounded)?
- [ ] Le query N+1 sono state eliminate?

### Documentazione
- [ ] L'endpoint è aggiunto alla mappa delle route in questo file?
- [ ] Il livello di accesso è annotato nel commento della route?
```

-----

## 15. PATTERN DI RIFERIMENTO

### Pattern A — CRUD Completo con Ownership

```typescript
// routes/objectives.ts — template per qualsiasi risorsa utente

const router = express.Router();

// LIST — GET /api/objectives
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const query  = listQuerySchema.parse(req.query);

  const items = await db
    .select()
    .from(userObjectives)
    .where(eq(userObjectives.userId, userId))
    .orderBy(desc(userObjectives.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  res.json(items);
});

// CREATE — POST /api/objectives
router.post('/', requireAuth, async (req, res) => {
  const userId  = req.user!.id;
  const data    = createObjectiveSchema.parse(req.body);

  const [item] = await db
    .insert(userObjectives)
    .values({ ...data, userId })
    .returning();

  res.status(201).json(item);
});

// UPDATE — PATCH /api/objectives/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id     = parseInt(req.params.id);
  const data   = updateObjectiveSchema.parse(req.body);

  const [existing] = await db.select().from(userObjectives)
    .where(and(eq(userObjectives.id, id), eq(userObjectives.userId, userId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: 'Non trovato' });

  const [updated] = await db
    .update(userObjectives)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(userObjectives.id, id))
    .returning();

  res.json(updated);
});

// DELETE — DELETE /api/objectives/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id     = parseInt(req.params.id);

  const [existing] = await db.select().from(userObjectives)
    .where(and(eq(userObjectives.id, id), eq(userObjectives.userId, userId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: 'Non trovato' });

  await db.delete(userObjectives).where(eq(userObjectives.id, id));
  res.status(204).send();
});

export default router;
```

### Pattern B — Endpoint Pubblico con Cache Header

```typescript
// ✅ Per contenuto statico (sectors, professions) — aggiungere cache headers
router.get('/sectors', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');

  const sectors = await db
    .select()
    .from(sectorsTable)
    .orderBy(asc(sectorsTable.name));

  res.json(sectors);
});
```

-----

*API_RULES.md — NorthStar / Orientamento SaaS*
*Versione 1.0 — Maggio 2026*
*Da leggere prima di ogni nuovo endpoint, middleware o modifica alle route.*
*Tenere in root insieme a DB_RULES.md e FRONTEND_RULES.md*