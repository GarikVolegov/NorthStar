# DB_RULES.md — NorthStar

> Leggi questo file PRIMA di modificare schema, migrazioni, seed o query.

---

## 🔴 SICUREZZA — Seed & Dati: regole di commit

> Queste regole proteggono i dati reali degli utenti e la conformità GDPR.

### Migrazioni Drizzle — Sì da committare

```
✅ lib/db/drizzle/*.sql        → COMMITTARE sempre
✅ lib/db/src/schema/index.ts  → COMMITTARE sempre
✅ drizzle.config.ts           → COMMITTARE sempre
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

### Dump di produzione

```bash
# ❌ SBAGLIATO — dump con dati reali committato
pg_dump northstar_prod > lib/db/backup.sql
git add lib/db/backup.sql  # NO!

# ✅ CORRETTO — dump su storage sicuro, mai su git
pg_dump northstar_prod | gzip > /mnt/backups/northstar_$(date +%Y%m%d).sql.gz
# Caricato su S3/GCS bucket privato, non su GitHub
```

### Checklist pre-commit DB

```bash
# Prima di committare qualsiasi file in lib/db/ o scripts/seed*:

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

- Tabelle: `snake_case` plurale (`users`, `referral_codes`, `withdrawal_requests`)
- Colonne: `snake_case` (`created_at`, `is_premium`, `referral_code`)
- Indici: `idx_<tabella>_<colonna>` (`idx_users_email`)
- FK: `<tabella>_id` (`user_id`, `referral_id`)

### Migrazioni

```bash
# Genera migration dopo aver modificato lo schema
pnpm db:generate

# Applica in dev locale
pnpm db:push

# Applica via migration file (produzione)
pnpm db:migrate
```

- Una migration per feature/branch — mai accumulare modifiche non correlate in una migration
- Le migration sono idempotenti: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Mai cancellare file di migration già applicati in produzione
- Mai modificare una migration già committata — crea una nuova

### Schema changes checklist

- [ ] Nuova colonna con default o nullable (non breaking)
- [ ] Indice su colonne usate in `WHERE` / `JOIN` frequenti
- [ ] FK con `ON DELETE` esplicito (CASCADE o RESTRICT)
- [ ] `created_at` e `updated_at` su ogni nuova tabella
- [ ] Drizzle schema aggiornato in `lib/db/src/schema/index.ts`
- [ ] Migration generata con `pnpm db:generate`
- [ ] Migration testata in locale con `pnpm db:push`
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
