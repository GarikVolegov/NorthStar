# DB_RULES.md — NorthStar

> Leggi questo file PRIMA di modificare schema, migrazioni, seed o query.

---

## 🔴 SICUREZZA — Seed & Dati: regole di commit

> Queste regole proteggono i dati reali degli utenti e la conformità GDPR.

### Migrazioni Drizzle — Sì da committare

```
✅ packages/db/drizzle/*.sql        → COMMITTARE sempre
✅ packages/db/src/schema/          → COMMITTARE sempre (tutti i file)
✅ packages/db/drizzle.config.ts    → COMMITTARE sempre
```

Le migrazioni sono struttura DDL pura — non contengono dati utente. Fanno parte del codice.

### Seed — distinzione critica

```
✅ scripts/seed.ts (con dati FITTIZI)    → COMMITTARE
❌ scripts/seed.ts (con email reali)      → MAI committare
❌ scripts/seed-prod.ts                   → MAI committare
❌ dump/*.sql con INSERT di utenti reali  → MAI committare
❌ backup/*.sql                           → MAI committare
```

### Pattern corretto per file seed committati

```typescript
// ❌ SBAGLIATO — dati reali nel seed
await db.insert(users).values([
  { email: 'mario.rossi@gmail.com',    name: 'Mario Rossi',    passwordHash: '...' },
  { email: 'lucia.bianchi@yahoo.it',   name: 'Lucia Bianchi',  passwordHash: '...' },
]);

// ✅ CORRETTO — dati generati da faker o completamente fittizi
import { faker } from '@faker-js/faker';

const seedUsers = Array.from({ length: 10 }, () => ({
  email:        faker.internet.email(),        // test.user.1234@example.com
  name:         faker.person.fullName(),       // "Mario Fictizio"
  passwordHash: await bcrypt.hash('seed-password-dev', 10),
}));
await db.insert(users).values(seedUsers);

// ✅ CORRETTO — seed con dati hardcoded fittizi e dominio @example.com
await db.insert(users).values([
  { email: 'admin@example.com',  name: 'Admin Dev',  role: 'admin'  },
  { email: 'user1@example.com',  name: 'User Dev 1', role: 'user'   },
]);
```

### Regola dominio email nei seed

- Usa sempre `@example.com`, `@test.northstar.dev`, o email generate da faker
- Il dominio `example.com` è riservato per test da RFC 2606 — nessuna email reale può usarlo
- Mai usare `@gmail.com`, `@yahoo.it`, `@hotmail.com` o qualsiasi provider reale nel seed

### Nuove Tabelle — Checklist

```
- [ ] Named in snake_case plurale
- [ ] Colonna id (PK, serial/bigserial)
- [ ] created_at timestamp con default now()
- [ ] updated_at timestamp con default now() + trigger auto-update
- [ ] Indici su tutte le FK e colonne usate in WHERE/JOIN
- [ ] FK con ON DELETE esplicito (CASCADE o RESTRICT)
- [ ] Drizzle schema in packages/db/src/schema/<table>.ts
- [ ] Esportata in packages/db/src/schema/index.ts
- [ ] Schema applicato con pnpm db:push (NON db:generate — vedi sezione Migrazioni)
- [ ] Verificato su DB reale (.env.local → Neon)
```

### Dump di produzione

```bash
# ❌ SBAGLIATO — dump con dati reali committato
pg_dump northstar_prod > backups/backup.sql
git add backups/backup.sql  # NO!

# ✅ CORRETTO — dump su storage sicuro, mai su git
pg_dump northstar_prod | gzip > /mnt/backups/northstar_$(date +%Y%m%d).sql.gz
# Caricato su S3/GCS bucket privato, non su GitHub
```

### Checklist pre-commit DB

```bash
# Prima di committare qualsiasi file in packages/db/ o scripts/seed*:

# 1. Controlla che il diff non contenga email reali
git diff --staged | grep -iE '[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|libero|virgilio)\.'

# 2. Controlla che non ci siano INSERT con dati personali
git diff --staged | grep -iE 'INSERT INTO users|INSERT INTO profiles' | grep -v 'example\.com\|faker'

# 3. Controlla che non ci siano dump SQL
git diff --staged --name-only | grep -iE '\.(sql|dump|bak)$'

# Se uno dei grep ha output → STOP, non committare
```

---

## Stack & Principi

### ORM: Drizzle

- **Mai** SQL raw con interpolazione da `req.body` — vedi `db-guard.ts`
- **Sempre** metodi tipizzati Drizzle: `.select()`, `.insert()`, `.update()`, `.delete()`
- Prepared statements per query ripetute ad alta frequenza

### Due ruoli separati

| Ruolo | Variabile | Permessi | Quando |
|---|---|---|---|
| `northstar_app` | `DATABASE_URL` | DML solo | Runtime Express |
| `northstar_migrator` | `DATABASE_URL_MIGRATOR` | DDL + DML | Solo CI/deploy |

### Naming conventions

- Tabelle: `snake_case` plurale (`users`, `coach_memory`, `audit_log`)
- Colonne: `snake_case` (`created_at`, `is_premium`, `referral_code`)
- Indici: `idx_<tabella>_<colonna>` (`idx_users_email`)
- FK: `<tabella>_id` (`user_id`, `referral_id`)
- Vincoli CHECK: `ck_<tabella>_<descrizione>` (`ck_coach_memory_confidence_range`)

### Schema Completo del Database (41 tabelle)

Tutte le tabelle sono definite in `packages/db/src/schema/` e re-esportate da `index.ts`.

#### Core / Auth
| Tabella | File | Descrizione |
|---------|------|-------------|
| `users` | `users.ts` | Utenti: email, passwordHash, ruolo (user/admin), stripeSubscriptionId, journeyType, userMode, sectorName |
| `testSessions` | `testSessions.ts` | Sessioni test RIASEC |
| `test-results` | `test-results.ts` | Risultati test RIASEC |

#### Professional Sectors & Education
| Tabella | File | Descrizione |
|---------|------|-------------|
| `sectors` | `sectors.ts` | Settori professionali |
| `professions` | `professions.ts` | Professioni / ruoli |
| `educationPaths` | `educationPaths.ts` | Percorsi formativi |
| `professionEducationPaths` | `professionEducationPaths.ts` | Join table professioni ↔ percorsi formativi |

#### User Content
| Tabella | File | Descrizione |
|---------|------|-------------|
| `userObjectives` | `userObjectives.ts` | Obiettivi/goals utente |
| `userFavorites` | `userFavorites.ts` | Preferiti utente (sectors) |
| `objectiveComments` | `objectiveComments.ts` | Commenti su obiettivi |
| `businessIdeas` | `businessIdeas.ts` | Validazione idee imprenditoriali |
| `certifications` | `certifications.ts` | Certificazioni utente |
| `linkedinImports` | `linkedinImports.ts` | Import dati LinkedIn |
| `job_applications` | `users.ts` | Candidature lavorative (definita nello stesso file di users) |

#### Knowledge Graph
| Tabella | File | Descrizione |
|---------|------|-------------|
| `knowledge` | `knowledge.ts` | Nodi del grafo della conoscenza |
| `discoveryItems` | `discoveryItems.ts` | Item del feed discovery |
| `discoverySourcesTable` | `discoverySourcesTable.ts` | Metadati fonti discovery |

#### AI / Coach
| Tabella | File | Descrizione |
|---------|------|-------------|
| `coachMemory` | `coachMemory.ts` | Memoria persistente del coach AI (con CHECK confidence range 0-1) |
| `coachSessions` | `coachSessions.ts` | Sessioni chat coach AI |
| `agentReview` | `agentReview.ts` | Log e review delle esecuzioni agenti AI (consolidato da agentLogs) |
| `qualityMetrics` | `qualityMetrics.ts` | Metriche qualità AI |
| `routingLogs` | `routingLogs.ts` | Log delle decisioni di routing AI |
| `responseFeedback` | `responseFeedback.ts` | Feedback utente su risposte AI |
| `sessionSummaries` | `sessionSummaries.ts` | Riassunti automatici delle sessioni |
| `pageContextSnapshots` | `pageContextSnapshots.ts` | Snapshot contesto pagina per AI |

#### Social / Communication
| Tabella | File | Descrizione |
|---------|------|-------------|
| `friendships` | `friendships.ts` | Amicizie / connessioni social |
| `conversations` | `conversations.ts` | Conversazioni |
| `messages` | `messages.ts` | Messaggi |
| `contactMessages` | `contactMessages.ts` | Messaggi form contatti |
| `notifications` | (in conversations) | Notifiche |

#### Calendar / Reminders
| Tabella | File | Descrizione |
|---------|------|-------------|
| `calendar` | `calendar.ts` | Eventi calendario + reminder |
| `voiceSessions` | `voiceSessions.ts` | Sessioni interazione vocale |

#### Content / News
| Tabella | File | Descrizione |
|---------|------|-------------|
| `newsArticles` | `newsArticles.ts` | Articoli news |
| `growthArticles` | `growthArticles.ts` | Articoli crescita personale |
| `nftCertificates` | `nftCertificates.ts` | Certificati NFT / gamification (con chainId) |

#### Affiliate System
| Tabella | File | Descrizione |
|---------|------|-------------|
| `affiliateAccounts` | `affiliateAccounts.ts` | Account affiliazione |
| `affiliateCommissions` | `affiliateCommissions.ts` | Commissioni (con enum appliedTo) |
| `affiliateReferrals` | `affiliateReferrals.ts` | Referral |
| `affiliateWithdrawals` | `affiliateWithdrawals.ts` | Richieste prelievo |
| `affiliationLeads` | `affiliationLeads.ts` | Lead affiliazione |

#### Audit / Security
| Tabella | File | Descrizione |
|---------|------|-------------|
| `auditLog` | `auditLog.ts` | Log audit immutabile (con IP hash per GDPR) |

### Indici e Vincoli Speciali
- `idx_users_email` — indice unico su email
- `idx_test_session_user` — indice su testSessionId per performance
- `ck_coach_memory_confidence_range` — CHECK confidence BETWEEN 0 AND 1
- `updated_at` trigger — funzione SQL in `updatedAt-trigger.sql` per auto-aggiornamento automatico

### Migrazioni — workflow REALE (aggiornato 2026-06)

> **Fonte di verità = lo schema TS** in `packages/db/src/schema/*.ts`.
> Lo si applica con **`pnpm db:push`** (schema-diff diretto). Questo è il workflow
> ufficiale.

```bash
# 1) Modifica lo schema TS in packages/db/src/schema/<table>.ts (+ re-export in index.ts)
# 2) Applica con push (schema-diff, env-aware via scripts/push.mjs → .env.local)
pnpm db:push

# Seed dati di sviluppo
pnpm db:seed
```

**⚠️ `pnpm db:generate` / `db:migrate` sono LEGACY e attualmente NON usabili.**
La baseline degli snapshot drizzle è obsoleta (ferma a uno stato vecchio) e
`db:generate` si blocca su un prompt interattivo di rename
(`user_profile_settings`). I file in `packages/db/drizzle/*.sql` sono **record
storici**: alcuni sono stati scritti a mano in modo **idempotente**
(`CREATE TABLE IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`) e
applicati direttamente. Possono esistere numeri di file duplicati (es. `0049_*`):
è ininfluente sotto `db:push`. Se in futuro si vuole ripristinare
`db:generate`, serve un **rebaseline** dedicato (squash a una baseline 0000 =
schema attuale + mark applicato su `__drizzle_migrations`), non un ritocco al journal.

- La configurazione Drizzle è in `packages/db/drizzle.config.ts`
- Una migration per feature/branch — mai accumulare modifiche non correlate in una migration
- Le migration sono idempotenti: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Mai cancellare file di migration già applicati in produzione
- Mai modificare una migration già committata — crea una nuova
- Le migration generano file SQL in `packages/db/drizzle/`

### Schema changes checklist

- [ ] Nuova colonna con default o nullable (non breaking)
- [ ] Indice su colonne usate in `WHERE` / `JOIN` frequenti
- [ ] FK con `ON DELETE` esplicito (CASCADE o RESTRICT)
- [ ] `created_at` e `updated_at` su ogni nuova tabella (con trigger auto-update)
- [ ] Drizzle schema file creato in `packages/db/src/schema/<tabella>.ts`
- [ ] Tabella esportata in `packages/db/src/schema/index.ts`
- [ ] Migration generata con `pnpm db:generate`
- [ ] Migration testata in locale con `pnpm db:migrate`
- [ ] Nessun dato reale nel seed committato

### Query patterns

```typescript
// ✅ Select con filtro tipizzato
const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

// ✅ Insert con returning
const [newUser] = await db.insert(users).values(payload).returning();

// ✅ Update con where obbligatorio
await db.update(users)
  .set({ updatedAt: new Date() })
  .where(eq(users.id, userId));

// ❌ Mai update senza where — aggiorna tutta la tabella
await db.update(users).set({ isPremium: false }); // DISASTRO

// ✅ Transaction per operazioni multi-tabella
await db.transaction(async (tx) => {
  await tx.update(affiliateAccounts).set({ withdrawableEur: 0 }).where(eq(...));
  await tx.insert(withdrawalRequests).values({ ... });
});
```

### Gotchas DB

- **`drizzle-kit push` in produzione**: usa solo con `DATABASE_URL_MIGRATOR`, mai con `DATABASE_URL` dell'app
- **Colonna NOT NULL senza default**: migration breaking su tabella popolata — aggiungi sempre il default o fai in due step
- **`db.delete()` senza `.where()`**: cancella tutta la tabella. Drizzle non blocca, fai attenzione.
- **Enum Drizzle**: cambiarli richiede migration DDL — aggiungi solo valori, mai rimuovere quelli esistenti
- **Backup**: mai su git. Su storage cifrato dedicato.
- **`updated_at` automatico**: il trigger SQL è in `packages/db/src/schema/updatedAt-trigger.sql` — va applicato manualmente se si crea una nuova tabella che usa `updated_at`
- **agentReview vs agentLogs**: `agentLogs` è stato consolidato in `agentReview` — usare sempre `agentReview` per i nuovi sviluppi
- **Connessione pool**: il pool PostgreSQL è un singleton esportato da `packages/db/src/index.ts` — non creare nuove connessioni
