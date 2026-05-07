# 🛡️ DB_RULES.md — Database Change Policy

## NorthStar / Orientamento SaaS

**Stack: Drizzle ORM · PostgreSQL · Replit · Node.js / TypeScript**

> ⚠️ **LEGGI QUESTO FILE INTEGRALMENTE** prima di toccare qualsiasi schema, migration o seed. Nessuna modifica al database è autorizzata senza aver completato la checklist corrispondente. Questo documento è legge. Non esistono eccezioni "rapide" o "tanto è una cosa piccola".

---

## 📋 INDICE

1. [Principi Fondamentali](#1-principi-fondamentali)
2. [Anatomia del Database NorthStar](#2-anatomia-del-database-northstar)
3. [Classificazione del Rischio](#3-classificazione-del-rischio)
4. [Pre-Flight Checklist — Prima di QUALSIASI modifica](#4-pre-flight-checklist)
5. [Regole di Schema Drizzle](#5-regole-di-schema-drizzle)
6. [Regole sulle Migration](#6-regole-sulle-migration)
7. [Regole sul Seed](#7-regole-sul-seed)
8. [Regole sulle Foreign Key e Relazioni](#8-regole-sulle-foreign-key-e-relazioni)
9. [Regole sugli Indici](#9-regole-sugli-indici)
10. [Regole sui Nullable e Default](#10-regole-sui-nullable-e-default)
11. [Operazioni Proibite](#11-operazioni-proibite)
12. [Runbook per Tipo di Operazione](#12-runbook-per-tipo-di-operazione)
13. [Gestione degli Errori in Production](#13-gestione-degli-errori-in-production)
14. [Rollback Procedure](#14-rollback-procedure)
15. [Audit Trail e Changelog](#15-audit-trail-e-changelog)
16. [Ambiente Replit — Regole Specifiche](#16-ambiente-replit--regole-specifiche)

---

## 1. PRINCIPI FONDAMENTALI

### Il Manifesto del Database Sano

1. **I dati degli utenti sono sacri.**
   Un bug nel codice si fixxa. I dati persi non tornano.

2. **Ogni migration deve essere reversibile.**
   Se non sai come fare il rollback, non fai la migration.

3. **Il database non è il tuo sandbox.**
   Testa SEMPRE in locale o su un DB di staging prima.

4. **La paura è una feature, non un bug.**
   Se stai per fare `DROP COLUMN` e non hai paura, stai sbagliando qualcosa.

5. **La velocità è nemica della solidità.**
   Una migration fatta in fretta che corrompe dati costa 10x il tempo di farla bene.

### Regola d'Oro — La Tripla Verifica

Prima di eseguire **qualsiasi** comando Drizzle o SQL diretto:

- ✅ So ESATTAMENTE cosa fa questo comando?
- ✅ Ho verificato l'impatto sui dati esistenti?
- ✅ Ho un piano di rollback documentato?

→ Se anche solo UNA risposta è "no" o "forse": **STOP.**

---

## 2. ANATOMIA DEL DATABASE NORTHSTAR

### Mappa delle Tabelle e Dipendenze

```
┌─────────────────────────────────────────────────────────────┐
│                        CORE USER FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  test_sessions ──────────────────────────────────────┐     │
│        │ (riasecScores, spiritScores,                 │     │
│        │  recommendations, confirmedSector)           │     │
│        │                                              │     │
│        └──────────► users ◄────────────────────────┘      │
│                        │ (stripeCustomerId,                 │
│                        │  stripeSubscriptionId,             │
│                        │  workPreference, autonomyPref.)    │
│                        │                                    │
│              ┌─────────┴────────┐                          │
│              │                  │                          │
│     user_objectives      user_favorites                     │
│     (goals, progress,    (sectors, articles)               │
│      dueDate, completed)                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                       CONTENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  sectors ──────────────────────► professions               │
│  (riasecTypes, salary,           │ (sectorId FK,           │
│   growthRate, pros, cons)        │  skills, workModes)     │
│                                  │                         │
│                                  └──► profession_          │
│                                        education_paths     │
│                                              │             │
│  education_paths ◄───────────────────────────┘            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     AI / KNOWLEDGE LAYER                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  knowledge_nodes ──────────────► knowledge_edges           │
│  (userId FK, embedding jsonb,    (sourceId FK,             │
│   embedded_text, type, url)       targetId FK, label)      │
│                                                             │
│  news_articles                   growth_articles           │
│  (url_hash UNIQUE,               (slug UNIQUE)             │
│   sectorNames[], category)                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    ADMIN / REVIEW LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  agent_runs ──────────────────► agent_suggestions          │
│                                          │                 │
│                                    review_queue            │
│                                                             │
│  audit_logs                                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tabelle per Criticità

| Criticità | Tabella | Motivo |
|-----------|---------|--------|
| 🔴 CRITICA | `users` | Identity, Stripe IDs, auth |
| 🔴 CRITICA | `test_sessions` | Risultati RIASEC/Spiriti — core del prodotto |
| 🟠 ALTA | `knowledge_nodes` | Embeddings vettoriali — costosi da rigenerare |
| 🟠 ALTA | `knowledge_edges` | Relazioni del grafo personale |
| 🟠 ALTA | `user_objectives` | Goals utente con progresso |
| 🟡 MEDIA | `sectors` / `professions` | Contenuto seeded — recuperabile ma laborioso |
| 🟡 MEDIA | `agent_suggestions` / `review_queue` | Workflow admin |
| 🟢 BASSA | `news_articles` / `growth_articles` | Rigenerabili via Tavily/LLM |
| 🟢 BASSA | `audit_logs` / `agent_runs` | Logs, nessun dato utente diretto |

---

## 3. CLASSIFICAZIONE DEL RISCHIO

Ogni modifica al DB rientra in una delle seguenti categorie:

### 🟢 RISCHIO BASSO — Eseguibile con cautela standard

- Aggiungere una nuova tabella senza FK verso tabelle critiche
- Aggiungere una colonna NULLABLE a una tabella non critica
- Creare un nuovo indice (non UNIQUE) su dati esistenti
- Modificare un DEFAULT su colonna senza dati esistenti
- Aggiungere articoli/settori via seed su DB vuoto

### 🟡 RISCHIO MEDIO — Richiede Pre-Flight Checklist completa

- Aggiungere una colonna NOT NULL con DEFAULT su tabella con dati
- Aggiungere un indice UNIQUE su colonna con dati esistenti
- Modificare il tipo di una colonna (es. `varchar` → `text`)
- Aggiungere una FK su tabella esistente
- Modificare la logica del seed su tabelle 🟡 o superiori

### 🟠 RISCHIO ALTO — Richiede backup + revisione del piano

- Qualsiasi modifica su `knowledge_nodes` (embeddings!)
- Rinominare una colonna usata nel codice applicativo
- Aggiungere colonna NOT NULL senza DEFAULT su tabella 🔴/🟠
- Modificare vincoli UNIQUE esistenti
- Cambiare il tipo di una colonna con dati incompatibili

### 🔴 RISCHIO CRITICO — Richiede backup verificato + staging test

- Qualsiasi DROP (colonna, tabella, indice, FK)
- Modifiche alla struttura di `users` o `test_sessions`
- Modifiche alle colonne `stripeCustomerId`, `stripeSubscriptionId`
- Operazioni bulk UPDATE/DELETE su tabelle critiche
- Modifica dello schema `embedding` in `knowledge_nodes`
- Rinominare tabelle

---

## 4. PRE-FLIGHT CHECKLIST

### ✈️ Checklist Universale (ogni modifica)

```markdown
## Pre-Flight — [NOME MIGRATION] — [DATA]

### Identificazione
- [ ] Ho nominato questa migration in modo descrittivo?
      Formato: YYYYMMDD_descrizione_breve (es: 20260507_add_timezone_to_users)
- [ ] Ho identificato la categoria di rischio? [BASSO / MEDIO / ALTO / CRITICO]
- [ ] Ho letto la sezione del Runbook corrispondente all'operazione?

### Impatto sui Dati Esistenti
- [ ] Quante righe esistono nelle tabelle coinvolte?
      Verificare con: SELECT COUNT(*) FROM <tabella>;
- [ ] Ci sono dati che potrebbero violare il nuovo vincolo?
      Verificare con query specifiche (vedi Runbook per tipo)
- [ ] La migration è additiva (aggiunge) o distruttiva (modifica/rimuove)?

### Dipendenze Applicative
- [ ] Ho cercato nel codice tutti gli usi della colonna/tabella modificata?
      Comando: grep -r "nomeColonna\|nomeTabella" artifacts/ lib/
- [ ] I tipi TypeScript generati da Drizzle sono allineati?
- [ ] Le Zod schema in lib/api-zod sono allineate?
- [ ] Le query TanStack React Query nel frontend sono allineate?

### Reversibilità
- [ ] Ho scritto il SQL di rollback prima di eseguire la migration?
- [ ] Il rollback è testato (almeno mentalmente)?
- [ ] In caso di rollback, i dati scritti dopo la migration sono recuperabili?

### Ambiente
- [ ] Sto operando sul DB corretto? (non confondere staging/prod)
- [ ] Il server Express è spento o in modalità maintenance?
      (Per migration rischio ALTO/CRITICO: il server DEVE essere spento)
- [ ] Ho notificato eventuali altri sviluppatori attivi?
```

### ✈️ Checklist Aggiuntiva per Rischio ALTO e CRITICO

```markdown
### Backup
- [ ] Ho eseguito un backup manuale del DB nelle ultime 2 ore?
      Comando: pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
- [ ] Ho verificato che il backup sia leggibile (non file vuoto, non corrotto)?
      Comando: wc -l backup_*.sql  (deve avere migliaia di righe)
- [ ] Il backup è salvato FUORI dal container Replit (es. download locale)?

### Staging Test
- [ ] Ho testato questa migration su un DB di staging o locale?
- [ ] Il test ha incluso dati realistici (non solo schema vuoto)?
- [ ] Ho verificato che il server si avvii correttamente dopo la migration?
- [ ] Ho verificato che il seed non si ri-esegua su dati esistenti?

### Piano di Comunicazione
- [ ] Se la migration causa downtime, è stato comunicato?
- [ ] Ho stimato il tempo di esecuzione? (per tabelle grandi può durare minuti)
```

---

## 5. REGOLE DI SCHEMA DRIZZLE

### 5.1 Naming Convention

```typescript
// ✅ CORRETTO — snake_case per colonne, camelCase per variabili Drizzle
export const users = pgTable('users', {
  id:                    serial('id').primaryKey(),
  stripeCustomerId:      text('stripe_customer_id'),       // camelCase var, snake_case DB
  stripeSubscriptionId:  text('stripe_subscription_id'),
  emailVerified:         boolean('email_verified').default(false).notNull(),
  createdAt:             timestamp('created_at').defaultNow().notNull(),
  updatedAt:             timestamp('updated_at').defaultNow().notNull(),
});

// ❌ SBAGLIATO
export const users = pgTable('Users', {           // mai PascalCase per tabelle
  stripeCustomerID: text('stripeCustomerID'),     // mai camelCase nel DB
  stripe_customer_id: text('stripe_customer_id'), // var e colonna identiche → confusione
});
```

### 5.2 Tipi Obbligatori

```typescript
// Ogni tabella DEVE avere:
id:        serial('id').primaryKey(),           // PK sempre serial o uuid
createdAt: timestamp('created_at').defaultNow().notNull(),
// updatedAt è consigliato per tabelle mutabili

// Per tabelle con ownership utente DEVE esserci:
userId: integer('user_id').references(() => users.id, {
  onDelete: 'cascade'  // quando user viene cancellato, cancella anche questi record
}).notNull(),

// UUID come alternativa a serial per tabelle esposte pubblicamente (no ID guessing):
id: uuid('id').defaultRandom().primaryKey(),
```

### 5.3 Tipi di Dato — Scelte Obbligate

| Caso d'uso | Tipo Drizzle | Tipo PostgreSQL | Note |
|------------|-------------|-----------------|------|
| ID primario | `serial()` o `uuid()` | SERIAL / UUID | Mai `integer` manuale |
| Testo corto (<255) | `varchar(n)` | VARCHAR(n) | Specificare n |
| Testo lungo / JSON | `text()` | TEXT | No limite |
| Booleano | `boolean()` | BOOLEAN | Mai `integer(1)` |
| Numero intero | `integer()` | INTEGER | |
| Decimale (prezzi) | `numeric('col', { precision: 10, scale: 2 })` | NUMERIC | **MAI** `float` per soldi |
| Timestamp | `timestamp()` | TIMESTAMP | Con `.defaultNow()` |
| JSON strutturato | `jsonb()` | JSONB | Mai `json()` (non indicizzabile) |
| Array | `text('col').array()` | TEXT[] | Es: `sectorNames[]` |
| Embedding vettoriale | `jsonb()` | JSONB | Come in `knowledge_nodes` |
| Enum piccolo | `text()` con check | TEXT | O `pgEnum` se stabile |

### 5.4 Struttura File Schema

```
lib/db/src/schema/
├── core.ts          ← users, test_sessions
├── content.ts       ← sectors, professions, education_paths
├── user.ts          ← user_objectives, user_favorites
├── knowledge.ts     ← knowledge_nodes, knowledge_edges
├── articles.ts      ← news_articles, growth_articles
├── agentReview.ts   ← agent_runs, agent_suggestions, review_queue, audit_logs
└── index.ts         ← re-export di tutto

// REGOLA: mai mettere più di 3-4 tabelle per file
// REGOLA: mai definire relazioni circolari nello stesso file
```

---

## 6. REGOLE SULLE MIGRATION

### 6.1 Workflow Obbligatorio

```bash
# STEP 1 — Modifica lo schema in lib/db/src/schema/
# Fai le modifiche al file .ts

# STEP 2 — Genera la migration (MAI editare i file generati a mano)
pnpm --filter @workspace/db exec drizzle-kit generate

# STEP 3 — LEGGI il file SQL generato prima di applicarlo
cat lib/db/migrations/XXXX_nome.sql
# Verifica che corrisponda a ciò che intendevi

# STEP 4 — Applica in locale/staging
pnpm --filter @workspace/db exec drizzle-kit migrate

# STEP 5 — Verifica schema
pnpm --filter @workspace/db exec drizzle-kit studio
# Oppure: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tabella';

# STEP 6 — Ribuildo le dichiarazioni TypeScript
pnpm --filter @workspace/db exec tsc -b

# STEP 7 — Verifica che il server si avvii senza errori
# STEP 8 — Solo dopo tutti questi step: applica in production
```

### 6.2 Regole sui File di Migration

- ✅ I file migration sono **IMMUTABILI** una volta committati
- ✅ Non editare mai un file `.sql` già applicato
- ✅ Ogni migration ha un unico scopo (no mega-migration)
- ✅ Il nome descrive l'operazione: `0001_add_timezone_users.sql`
- ✅ Ogni migration include il SQL di rollback nei commenti iniziali
- ❌ Non cancellare file migration dalla cartella
- ❌ Non rinumerare le migration
- ❌ Non applicare migration in ordine diverso da quello numerico
- ❌ Non eseguire SQL diretto sul DB production che bypassi Drizzle

### 6.3 Template Migration File (commenti obbligatori)

```sql
-- Migration: 0042_add_timezone_to_users
-- Data: 2026-05-07
-- Autore: [nome]
-- Rischio: MEDIO
-- Descrizione: Aggiunge colonna timezone agli utenti per personalizzare
--              la visualizzazione delle date nel calendar agent.
--
-- ROLLBACK:
--   ALTER TABLE users DROP COLUMN timezone;
--
-- VERIFICA POST-MIGRATION:
--   SELECT COUNT(*) FROM users WHERE timezone IS NULL;
--   (deve restituire 0 se DEFAULT è stato applicato correttamente)
-- ============================================================

ALTER TABLE users
ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Rome';
```

---

## 7. REGOLE SUL SEED

### 7.1 Il Problema del Seed Automatico

> ⚠️ **ATTENZIONE CRITICA — SPECIFICA PER NORTHSTAR**
>
> Il seed (`artifacts/api-server/src/lib/seed.ts`) viene eseguito **automaticamente ad ogni avvio del server**.
>
> Una migration mal gestita + restart del server può triggerare il seed su dati già esistenti, causando:
> - Duplicazione di settori
> - Sovrascrittura di dati modificati manualmente
> - Violazioni di vincoli UNIQUE → **crash del server al boot**

### 7.2 Regola Fondamentale del Seed

```typescript
// ✅ OBBLIGATORIO — Ogni seed DEVE essere idempotente
// Usare sempre INSERT ... ON CONFLICT DO NOTHING
// o verificare l'esistenza prima di inserire

async function seedSectors(db: Database) {
  const existing = await db.select().from(sectors).limit(1);
  
  // Guard assoluto — se esistono dati, non fare nulla
  if (existing.length > 0) {
    console.log('[seed] Sectors already seeded, skipping.');
    return;
  }
  // Solo se il DB è vuoto procedi
  await db.insert(sectors).values(INITIAL_SECTORS);
  console.log('[seed] Sectors seeded successfully.');
}

// ❌ MAI fare così:
async function seedSectors(db: Database) {
  await db.delete(sectors); // CANCELLA TUTTO prima di inserire — DISTRUTTIVO
  await db.insert(sectors).values(INITIAL_SECTORS);
}

// ❌ ANCHE QUESTO è pericoloso:
async function seedSectors(db: Database) {
  await db.insert(sectors).values(INITIAL_SECTORS); // Nessun guard → duplicate error
}
```

### 7.3 Regole Aggiuntive per il Seed

- ✅ Il seed legge sempre prima di scrivere (SELECT prima di INSERT)
- ✅ Ogni funzione di seed è autonoma e wrappata in `try/catch`
- ✅ Il seed non usa `DELETE` o `TRUNCATE` **mai**
- ✅ Il seed logga ogni operazione con prefisso `[seed]`
- ✅ Se il seed fallisce, il server deve avviarsi comunque (non crashare)
- ✅ I dati del seed sono in file separati di costanti, non inline
- ❌ Non aggiungere dati user-specifici nel seed
- ❌ Non inserire dati che dipendono da ID generati (usa slug/nome come lookup)
- ❌ Non cambiare i dati seed esistenti senza migration per i dati già produzione

### 7.4 Aggiungere Nuovi Dati al Seed

```typescript
// STEP 1 — Aggiungere i dati al file costanti
// artifacts/api-server/src/lib/seed-data/sectors.ts
export const INITIAL_SECTORS = [
  // ... settori esistenti ...
  {
    name: 'Nuovo Settore',
    slug: 'nuovo-settore',   // usare slug come chiave idempotente
    riasecTypes: ['I', 'C'],
    // ...
  }
];

// STEP 2 — Aggiornare il seed con upsert per i nuovi dati
await db.insert(sectors)
  .values(INITIAL_SECTORS)
  .onConflictDoNothing({ target: sectors.slug }); // slug è UNIQUE
```

---

## 8. REGOLE SULLE FOREIGN KEY E RELAZIONI

### 8.1 Comportamenti onDelete Obbligatori

```typescript
// Regola: ogni FK deve dichiarare esplicitamente onDelete

// ✅ Cascade — dati dell'utente che non esistono senza l'utente
userId: integer('user_id')
  .references(() => users.id, { onDelete: 'cascade' })
  .notNull()
// Applicare a: user_objectives, user_favorites, knowledge_nodes,
//              knowledge_edges, test_sessions (se user è cancellato)

// ✅ Set Null — dati che possono esistere senza il riferimento
confirmedSectorId: integer('confirmed_sector_id')
  .references(() => sectors.id, { onDelete: 'set null' })
// Applicare a: colonne opzionali che puntano a content, non a users

// ✅ Restrict — impedire cancellazione se ci sono dati collegati
sectorId: integer('sector_id')
  .references(() => sectors.id, { onDelete: 'restrict' })
  .notNull()
// Applicare a: professions → sectors (non cancellare un settore con professioni)

// ❌ MAI lasciare onDelete implicito (default PostgreSQL è RESTRICT ma non è ovvio)
```

### 8.2 Aggiungere una FK su Tabella con Dati

```sql
-- PRIMA verificare che non ci siano orfani:
SELECT COUNT(*)
FROM tabella_figlio tf
LEFT JOIN tabella_padre tp ON tf.padre_id = tp.id
WHERE tp.id IS NULL;
-- Deve restituire 0 prima di aggiungere la FK

-- Se ci sono orfani, decidere cosa farne:
-- Opzione A: cancellare gli orfani
DELETE FROM tabella_figlio WHERE padre_id NOT IN (SELECT id FROM tabella_padre);

-- Opzione B: assegnare un padre di default
UPDATE tabella_figlio SET padre_id = 1 WHERE padre_id NOT IN (SELECT id FROM tabella_padre);

-- Solo dopo, aggiungere il vincolo
ALTER TABLE tabella_figlio
ADD CONSTRAINT fk_tabella_figlio_padre
FOREIGN KEY (padre_id) REFERENCES tabella_padre(id) ON DELETE CASCADE;
```

---

## 9. REGOLE SUGLI INDICI

### 9.1 Indici Obbligatori

```typescript
// Ogni tabella con userId DEVE avere indice su userId
export const userObjectives = pgTable('user_objectives', {
  // ... colonne ...
}, (table) => ({
  userIdIdx: index('user_objectives_user_id_idx').on(table.userId),
  // Se si fa spesso query per userId + completed:
  userCompletedIdx: index('user_objectives_user_completed_idx')
    .on(table.userId, table.completed),
}));

// Colonne usate in WHERE frequenti DEVONO avere indice:
// - test_sessions.userId
// - knowledge_nodes.userId
// - knowledge_edges.sourceId, knowledge_edges.targetId
// - news_articles.url_hash (già UNIQUE = indice automatico)
// - agent_suggestions.status
```

### 9.2 Prima di Creare un Indice UNIQUE su Dati Esistenti

```sql
-- OBBLIGATORIO: verificare duplicati prima
SELECT colonna, COUNT(*) as cnt
FROM tabella
GROUP BY colonna
HAVING COUNT(*) > 1;
-- Deve restituire 0 righe

-- Se ci sono duplicati, risolverli prima di creare l'indice UNIQUE
-- (vedi Runbook sezione duplicati)
```

### 9.3 Indici da Evitare

- ❌ Indice su colonne booleane a bassa cardinalità (es: `is_active TRUE/FALSE`)
  → Peggiora le performance invece di migliorarle
- ❌ Troppi indici su tabelle con molti INSERT (es: `audit_logs`)
  → Rallentano le write
- ❌ Indici su colonne `jsonb` intere (solo su campi specifici con operatori jsonb)
- ❌ Indice sull'embedding `jsonb` di `knowledge_nodes`
  → Per similarità coseno usare pgvector o calcolo in-memory (già gestito così)

---

## 10. REGOLE SUI NULLABLE E DEFAULT

### 10.1 Decision Tree: Nullable o NotNull?

```
La colonna può logicamente non avere valore?
│
├─ NO → .notNull() OBBLIGATORIO
│       Aggiungere anche .default() se ha un valore sensato
│
└─ SÌ → nullable (omettere .notNull())
         Documentare nel commento perché è nullable
```

### 10.2 Aggiungere NOT NULL su Tabella con Dati

```sql
-- ❌ QUESTO FALLISCE se ci sono righe esistenti con NULL:
-- ALTER TABLE users ADD COLUMN timezone text NOT NULL;

-- ✅ PROCEDURA CORRETTA in 3 step:

-- STEP 1: Aggiungere nullable con default
ALTER TABLE users ADD COLUMN timezone text DEFAULT 'Europe/Rome';

-- STEP 2: Popolare i NULL esistenti
UPDATE users SET timezone = 'Europe/Rome' WHERE timezone IS NULL;

-- STEP 3: Aggiungere il vincolo NOT NULL
ALTER TABLE users ALTER COLUMN timezone SET NOT NULL;
```

```typescript
// In Drizzle, fare questo in DUE migration separate:
// Migration 1: colonna nullable con default
// Migration 2 (dopo il deploy): aggiungere NOT NULL
```

### 10.3 Default Values Obbligatori per Tipo

```typescript
boolean()    → .default(false).notNull()   // mai boolean senza default
timestamp()  → .defaultNow().notNull()     // per createdAt/updatedAt
integer()    → .default(0) se è un contatore
text()       → NO default se è un campo libero, default se ha valore standard
jsonb()      → .default({}) o .default([]) se struttura sempre presente
```

---

## 11. OPERAZIONI PROIBITE

### 🚫 Lista Nera Assoluta

**Queste operazioni non possono essere eseguite mai in production senza:**
1. Backup verificato
2. Staging test completato
3. Orario di basso traffico (o maintenance mode)

```sql
-- ❌ PROIBITE SENZA PROCEDURA COMPLETA:
DROP TABLE <qualsiasi>;
TRUNCATE TABLE <qualsiasi>;
DROP COLUMN <colonna critica>;
ALTER TABLE users DROP COLUMN <qualsiasi>;
ALTER TABLE test_sessions DROP COLUMN <qualsiasi>;
DELETE FROM users;
DELETE FROM test_sessions;
UPDATE users SET <colonna_critica> = <valore>;    -- bulk update senza WHERE specifico
ALTER TABLE knowledge_nodes DROP COLUMN embedding; -- perdi tutti gli embedding

-- ❌ PROIBITE IN ASSOLUTO (richiedono meeting + decisione di team):
DROP DATABASE;
REVOKE privileges;
-- Modificare il JWT_SECRET senza piano di re-login utenti
-- Cancellare stripe_customer_id o stripe_subscription_id
```

### 🚫 Anti-Pattern di Codice Proibiti

```typescript
// ❌ MAI eseguire SQL raw non parametrizzato (SQL injection)
db.execute(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SEMPRE usare Drizzle ORM o prepared statements
db.select().from(users).where(eq(users.email, email));

// ❌ MAI fare select * in produzione su tabelle critiche
db.execute('SELECT * FROM users');

// ✅ SEMPRE specificare le colonne
db.select({ id: users.id, email: users.email }).from(users);

// ❌ MAI fare operazioni bulk senza transazione
await db.delete(knowledgeEdges).where(eq(knowledgeEdges.userId, userId));
await db.delete(knowledgeNodes).where(eq(knowledgeNodes.userId, userId));
// (se la seconda fallisce, hai orfani)

// ✅ SEMPRE wrappare operazioni correlate in transazione
await db.transaction(async (tx) => {
  await tx.delete(knowledgeEdges).where(eq(knowledgeEdges.userId, userId));
  await tx.delete(knowledgeNodes).where(eq(knowledgeNodes.userId, userId));
});
```

---

## 12. RUNBOOK PER TIPO DI OPERAZIONE

### 📋 R01 — Aggiungere una Nuova Tabella

```bash
# 1. Definire lo schema in lib/db/src/schema/<file>.ts
# 2. Esportare da lib/db/src/schema/index.ts
# 3. pnpm --filter @workspace/db exec drizzle-kit generate
# 4. Leggere il SQL generato
# 5. pnpm --filter @workspace/db exec drizzle-kit migrate
# 6. pnpm --filter @workspace/db exec tsc -b
# 7. Verificare con drizzle-kit studio o psql
# 8. Aggiornare api-zod se la tabella ha endpoint esposti
# Rischio: BASSO (se nessuna FK critica) / MEDIO (se FK verso users)
```

### 📋 R02 — Aggiungere una Colonna

```bash
# CASO A: Colonna nullable, nessun dato critico
# 1. Aggiungere la colonna nello schema Drizzle (nullable, con o senza default)
# 2. drizzle-kit generate → leggere SQL → drizzle-kit migrate
# 3. tsc -b → verificare TypeScript
# Rischio: BASSO

# CASO B: Colonna NOT NULL su tabella con dati
# 1. Migration 1: aggiungere nullable con DEFAULT
# 2. Deploy + verifica che i NULL siano 0
# 3. Migration 2: ALTER COLUMN SET NOT NULL
# Rischio: MEDIO → ALTO

# CASO C: Colonna NOT NULL senza DEFAULT su tabella 🔴/🟠
# → Seguire procedura rischio CRITICO
# → Sempre in due migration separate
# Rischio: CRITICO
```

### 📋 R03 — Rinominare una Colonna

```bash
# Drizzle NON rileva i rename automaticamente — genera DROP + ADD
# Questo causa perdita di dati!

# PROCEDURA SICURA in 3 step:
# Migration 1: Aggiungere nuova colonna con il nuovo nome
# Deploy: aggiornare il codice per scrivere su ENTRAMBE le colonne
# Migration 2: Copiare i dati dalla vecchia alla nuova
#   UPDATE tabella SET nuova_col = vecchia_col WHERE nuova_col IS NULL;
# Deploy: aggiornare il codice per leggere solo dalla nuova
# Migration 3: DROP vecchia_col (solo dopo aver verificato che nuova_col è completa)
# Rischio: ALTO → CRITICO
```

### 📋 R04 — Eliminare una Colonna

```bash
# STEP 1: Verificare che nessun codice legga ancora la colonna
grep -r "nomeColonna" artifacts/ lib/ --include="*.ts" --include="*.tsx"
# Deve restituire 0 risultati (escluso il file schema)

# STEP 2: Verificare che non sia referenziata in FK
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE kcu.column_name = 'nome_colonna' AND tc.constraint_type = 'FOREIGN KEY';

# STEP 3: Rimuovere dallo schema Drizzle
# STEP 4: drizzle-kit generate → verificare che l'SQL sia SOLO ALTER TABLE DROP COLUMN
# STEP 5: Backup → migration
# Rischio: ALTO (tabelle non critiche) / CRITICO (tabelle 🔴/🟠)
```

### 📋 R05 — Modificare gli Embedding in knowledge_nodes

```bash
# Gli embedding sono costosi: ogni nodo richiede una chiamata OpenAI
# (text-embedding-3-small, 1536 dimensioni)

# ❌ MAI fare questo:
# ALTER TABLE knowledge_nodes DROP COLUMN embedding;
# ALTER TABLE knowledge_nodes ADD COLUMN embedding jsonb;
# → Perdi TUTTI gli embedding di TUTTI gli utenti

# ✅ Se devi cambiare il modello di embedding:
# 1. Aggiungere colonna embedding_v2 jsonb
# 2. Aggiornare il codice per scrivere su embedding_v2 per i nuovi nodi
# 3. Eseguire il backfill graduale con /api/knowledge/embeddings/backfill
#    (già implementato, max 30 per volta)
# 4. Solo quando embedded_v2 è completo per tutti gli utenti attivi:
#    DROP COLUMN embedding (vecchio)
#    RENAME COLUMN embedding_v2 TO embedding
# Rischio: CRITICO — stimare tempo: ~N_nodi × 0.1s per il backfill
```

### 📋 R06 — Operazioni Stripe (stripeCustomerId, stripeSubscriptionId)

```bash
# REGOLA ASSOLUTA: Non modificare mai questi campi via migration diretta

# Se devi fare cleanup di ID Stripe non validi:
# 1. Identificare gli ID da correggere via Stripe Dashboard
# 2. Scrivere uno script TypeScript dedicato con dry-run mode
#    (stampa cosa farebbe senza eseguire)
# 3. Far girare il dry-run e verificare l'output
# 4. Eseguire con backup verificato
# 5. Verificare via Stripe Dashboard che i customer esistano ancora

# Se devi aggiungere una nuova colonna Stripe:
# → Procedura R02 CASO B
# → Aggiornare anche auth-google.ts e safeUser
# Rischio: CRITICO
```

---

## 13. GESTIONE DEGLI ERRORI IN PRODUCTION

### Cosa Fare se una Migration Fallisce a Metà

```bash
# STEP 1: NON riavviare il server immediatamente
# Una migration parziale può lasciare la DB in stato inconsistente

# STEP 2: Valutare lo stato attuale
# Connettersi al DB e verificare cosa è stato eseguito:
SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;

# STEP 3: Verificare se la tabella/colonna esiste parzialmente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tabella_modificata';

# STEP 4A: Se la migration è parzialmente applicata → completare manualmente con psql
# STEP 4B: Se lo stato è incerto → rollback manuale (vedi sezione 14)

# STEP 5: Documentare l'incidente in CHANGELOG.md
```

### Cosa Fare se il Server non si Avvia dopo una Migration

```bash
# Il sintomo più comune: ZodError o TypeScript type mismatch

# STEP 1: Leggere l'errore completo nel log
# STEP 2: Identificare la tabella/colonna che causa il problema
# STEP 3: Verificare che lo schema Drizzle TypeScript corrisponda al DB reale
#   Spesso il problema è: lib/api-zod non è stato rigenerato dopo la migration

# Fix rapido per ZodError "Expected string, received date":
# (già documentato nei Bug Fixes di replit.md)
# Aggiungere serializzazione prima del parsing Zod:
const result = { ...rawResult, createdAt: rawResult.createdAt.toISOString() };

# STEP 4: Se non risolvibile rapidamente → rollback (sezione 14)
```

---

## 14. ROLLBACK PROCEDURE

### Rollback Livello 1 — Schema Rollback (migration inversa)

```bash
# Creare una nuova migration che inverte la precedente
# NON cancellare la migration originale

# Esempio: rollback di ADD COLUMN
# 0043_rollback_timezone_users.sql:
-- ROLLBACK of 0042_add_timezone_to_users
ALTER TABLE users DROP COLUMN IF EXISTS timezone;

pnpm --filter @workspace/db exec drizzle-kit migrate
```

### Rollback Livello 2 — Ripristino da Backup

```bash
# Usare solo se il rollback di schema non è sufficiente
# o se i dati sono stati corrotti

# STEP 1: Spegnere il server completamente

# STEP 2: Ripristinare il backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# STEP 3: Verificare integrità
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM test_sessions;
SELECT COUNT(*) FROM knowledge_nodes;

# STEP 4: Verificare che i dati siano coerenti con il codice attuale
# (se il rollback porta a una versione precedente dello schema,
#  potrebbe essere necessario fare anche rollback del codice)

# STEP 5: Riavviare il server con cautela
# STEP 6: Verificare i log per i primi 5 minuti
```

---

## 15. AUDIT TRAIL E CHANGELOG

### Ogni Modifica al DB deve essere Registrata

Aggiungere una entry in `CHANGELOG.md` (nella root del progetto) nel formato:

```markdown
## [DB] 2026-05-07 — Aggiunta colonna timezone in users

**Migration:** 0042_add_timezone_to_users
**Rischio:** MEDIO
**Autore:** [nome]
**Tabelle coinvolte:** users
**Descrizione:** Aggiunta colonna `timezone` (text, NOT NULL, default 'Europe/Rome')
  per supportare il CalendarAgent nella generazione di eventi localizzati.
**Rollback:** ALTER TABLE users DROP COLUMN timezone;
**Test:** ✅ Staging | ✅ TypeScript | ✅ Seed idempotente verificato
**Note:** Aggiornato anche safeUser in auth.ts per includere timezone nel JWT payload.
```

---

## 16. AMBIENTE REPLIT — REGOLE SPECIFICHE

### Criticità Replit da Tenere a Mente

- ⚠️ Il DB Replit può essere resettato in caso di inattività prolungata sul piano free. **Avere sempre un backup esterno aggiornato.**
- ⚠️ Il server si riavvia automaticamente → **il seed gira ad ogni restart.** Ogni migration DEVE essere testata con restart del server.
- ⚠️ Non esistono branch del database su Replit. Staging = DB separato manuale o test in locale con pg locale.
- ⚠️ I secret (`DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`) sono legati al Replit project. **Non metterli mai nel codice o nei file .md.**
- ⚠️ Il `JWT_SECRET` è ora persistito in `.local/.jwt-secret` (da `auth-jwt.ts`). **Non cancellare quella directory senza piano di re-autenticazione utenti.**

### Backup su Replit

```bash
# Creare un backup manuale prima di ogni migration rischio ALTO/CRITICO
# Eseguire nella Replit Shell:
pg_dump $DATABASE_URL \
  --no-owner \
  --no-acl \
  --format=plain \
  > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql

# Scaricare il file tramite la Replit file browser
# (Files → cliccare il file → Download)
# Il file rimane in /tmp solo fino al prossimo restart

# Verificare che il backup abbia contenuto:
wc -l /tmp/backup_*.sql
# Deve avere migliaia di righe per un DB con dati reali
```

### Variabili d'Ambiente Critiche — Non Toccare Senza Piano

| Secret | Impatto se cambiato | Piano necessario |
|--------|---------------------|-----------------|
| `DATABASE_URL` | Server non si connette | Migration + restart coordinato |
| `JWT_SECRET` | Tutti gli utenti vengono scollegati | Comunicazione + graceful re-auth |
| `STRIPE_SECRET_KEY` | Pagamenti non funzionano | Solo se si cambia account Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Checkout non funziona | Aggiornare anche il frontend |
| `GNEWS_API_KEY` | News live → fallback statico | Nessun impatto sui dati |
| `TAVILY_API_KEY` | Research scheduler disabilitato | Nessun impatto sui dati |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Tutte le feature AI si spengono | Nessun impatto sui dati |

---

## ✍️ FIRMA DI LETTURA

Chiunque esegua modifiche al database firma qui:

```
Ho letto e compreso questo documento integralmente.
Mi impegno a seguire tutte le procedure indicate.

Data: ________________
Operazione pianificata: ________________
Categoria di rischio: ________________
```

---

*DB_RULES.md — NorthStar / Orientamento · Versione 1.0 — Maggio 2026 · Da tenere in root del repo e leggere prima di ogni modifica al database.*
