# REVIEW — `packages/db` + `scripts/migrate-*` (2026-05-28)

Scope: schema Drizzle, migrazioni SQL, script di migrazione monorepo legacy.

## Sintesi rapida

DB layer in stato **molto solido**:
- 81 schema files in `packages/db/src/schema/`, exporting 79 modules (audit passa).
- 22 migration SQL ben strutturate, ma con **divario di naming**: 14 file numerati `0042_*.sql` ... `0057_*.sql` + 8 file legacy unprefixed (`add-pgvector.sql`, `add-coach-memory.sql`, ecc.).
- `scripts/check-migration-safety.mjs` esiste come safety net.

Il vero "junk" è in `scripts/`: 6 script `migrate-v*` one-shot per ristrutturare il monorepo, già eseguiti, candidati ad archiviazione.

## Findings classificati

### F-DB-1 · 6 script `migrate-v*` legacy in `scripts/`
- Severità: **MEDIUM** · Azione: **REMOVE** (archiviare)
- File: `migrate-v2.ps1`, `migrate-v3.cjs`, `migrate-v4.cjs`, `migrate-structure.ps1`, `migrate-structure.bat`, `migrate-to-vscode.mjs`
- Evidenza: tutti hanno `ROOT = "C:\Users\osman\Documents\GitHub\NorthStar"` hardcoded; commenti dichiarano "ristruttura il monorepo da Replit a VSCode"; sono one-shot già applicati.
- Proposta: spostare in `scripts/archive/migrate-history/` con un README di 3 righe ("storico delle migrazioni del layout monorepo 2024-2025") o REMOVE puro.
- Costo: 5 minuti.

### F-DB-2 · 8 file di migration unprefixed (naming inconsistente)
- Severità: **MEDIUM** · Azione: **DOCUMENT** o **RENAME**
- File:
  - `add-pgvector.sql`
  - `add-referral-tracking.sql`
  - `add-username.sql`
  - `add-affiliate-tables.sql`
  - `add-coach-memory.sql`
  - `add-coach-notifications.sql`
  - `add-coach-sessions.sql`
- Evidenza: gli altri 14 file seguono il pattern `00XX_descrizione.sql` (Drizzle Kit standard). Questi 8 sono pre-Drizzle (manuali) o un'epoca diversa.
- Domanda: Drizzle li tracking tramite la tabella `__drizzle_migrations`? Se sì, RENAME con prefix `0001_...` ecc. potrebbe rompere il tracking. Verificare prima.
- Proposta: leggere `drizzle.config.ts` + tabella `__drizzle_migrations` in produzione. Se tracked → DOCUMENT (aggiungere README in `migrations/` che spieghi il pattern misto). Se NON tracked → spostare in `archive/` perché significa che sono già stati applicati a mano.
- Costo: 30 min verifica + 15 min doc.

### F-DB-3 · `db-guardian` subagent — confermare scope
- Severità: **LOW** · Azione: **DOCUMENT**
- Evidenza: subagent esiste e copre questo dominio. Va bene per la Fase 5.
- Proposta: nessuna modifica al subagent. Solo conferma nel REVIEW-MASTER che `db-guardian` resta owner.

### F-DB-4 · `migrate-google.mjs` e `seed-crescita.mjs` in root di `packages/db`
- Severità: **LOW** · Azione: **REORGANIZE**
- Evidenza: due script in root del pacchetto db. Convenzione mista con `scripts/` interno.
- Proposta: spostare in `packages/db/scripts/` per coerenza con `backfill-embeddings.ts`, `check-migration-safety.mjs`, `push.mjs`.
- Costo: 10 min (richiede aggiornare eventuali path nei comandi npm/pnpm).

## Cosa NON è un problema

- 81 schema files: `db-types` audit passa, tutti gli export sono allineati.
- 14 migration numerate: ordine pulito, naming Drizzle-standard.
- `drizzle.config.ts` + `migrate.ts` + `push.mjs` + `check-migration-safety.mjs`: tooling completo.
- pgvector usage (presente in migrations + rag pipeline): OK, audit ai-server non ha sollevato issue.

## Riepilogo conteggio

| Severità | Conta |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
