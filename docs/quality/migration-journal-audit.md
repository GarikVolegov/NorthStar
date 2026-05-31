# Drizzle migration journal audit — 2026-05-31

> **Status: PROPOSAL. No migration has been run and no file renamed/edited.**
> This document records findings and a recommended fix for review.

## Findings

### 1. `_journal.json` is missing 11 migrations
`migrate.ts` (the stated production runner — its header says *"Applies all
pending SQL migrations from the ./drizzle folder. Run this in CI/CD BEFORE
starting the API server. Never run drizzle-kit push in production."*) uses
`drizzle-orm/node-postgres/migrator`, which applies **only** the migrations
listed in `packages/db/drizzle/meta/_journal.json`.

The journal has 40 entries (idx 0–39) but the `drizzle/` folder has **50 SQL
files**. Missing from the journal:

| Missing SQL file | Schema it creates |
|---|---|
| `0035_ai_request_log_phase2.sql` | ai_request_log phase-2 columns |
| `0036_memory_2_decay_embeddings.sql` | memory decay/embeddings |
| `0037_wendy_optimizer_proposals.sql` | wendy_optimizer_proposals |
| `0038_wendy_config_overrides.sql` | wendy_config_overrides |
| `0039_ai_cost_log.sql` | ai_cost_log |
| `0040_memory_embeddings.sql` | memory embeddings |
| `0041_discovery_sources_fast_lane.sql` | discovery sources |
| `0042_wendy_brain.sql` | **wendy_brain** (3 tables) |
| `0048_nft_milestone_certificates.sql` | nft milestone cert columns |
| `0049_agent_orchestration_events.sql` | agent_orchestration_events |
| `0049_user_objectives_runtime_columns.sql` | user_objectives runtime columns |

The journal jumps from idx 34 (`0034_rag_routing_keys`) straight to idx 35
(`0043_brain_obsidian_path`).

### 2. Duplicate migration number `0049`
Two files share the `0049` prefix (`agent_orchestration_events` and
`user_objectives_runtime_columns`) — they came from two parallel branches.
A drizzle-kit `generate`/`check` run will choke on this.

### 3. `meta/` snapshots almost entirely absent
Only `0000_snapshot.json` and `0005_snapshot.json` exist. drizzle-kit
normally keeps one snapshot per migration. Snapshots are used by
`drizzle-kit generate`/`check`, **not** by the runtime `migrate()`, so this
breaks `generate`/`check` but not `migrate`.

## Root cause
Not a regression from the fase2 merge. Git history shows the journal **never**
contained 0035–0042/0048/0049. The team has been applying schema in dev via
`db:push` (schema-diff), and the journal has been hand-maintained and left
incomplete. The duplicate `0049` *is* new (branch collision).

## Risk
A fresh production migrate (`migrate.ts`) against an empty DB would apply only
the 40 journal-listed migrations and **silently skip 11**, leaving tables like
`wendy_brain`, `ai_cost_log`, `agent_orchestration_events`, and the
`user_objectives` runtime columns absent — while the TS schema references them.
`push` (forbidden in prod by the header) is currently masking this in dev.

## Mitigating fact: the missing migrations are idempotent
All 11 use `IF NOT EXISTS` on `CREATE TABLE` / `ADD COLUMN`, so re-applying
them on a DB that already has the objects (e.g. one built via `push`) is a
safe no-op. This makes journal reconstruction low-risk on the SQL side.

## Proposed fix (for review — do NOT run without answering the open questions)

1. **Resolve the duplicate `0049` (hygiene, safe regardless of mechanism):**
   rename `0049_user_objectives_runtime_columns.sql` → `0050_user_objectives_runtime_columns.sql`.
2. **Rebuild `_journal.json`** to list all 51 migrations (0000–0050) in order
   with monotonic `when` timestamps and `version: "7"` (matching existing
   entries). This can be generated mechanically from the filenames.
3. **Verify on a throwaway DB before trusting in prod:** point
   `DATABASE_URL_MIGRATOR` at an empty Postgres, run `tsx migrate.ts`, confirm
   all 51 apply cleanly, then run `drizzle-kit push --dry-run`/`check` and
   confirm **zero diff** vs the TS schema. Only then is the journal trustworthy.

## Open questions (blockers before applying to a real environment)
- **How is prod/staging schema actually applied today** — `migrate.ts` or
  `push`? If everything so far went through `push`, prod already has the
  tables and the journal is informational.
- **Does prod have a `__drizzle_migrations` table, and what's in it?**
  Rebuilding the journal changes idx/hashes; on a DB where `migrate.ts`
  previously ran with the partial journal, the migrator will re-evaluate
  entries by hash. The `IF NOT EXISTS` guards make re-runs safe, but the
  `__drizzle_migrations` bookkeeping must be reconciled so the migrator's
  view matches reality.

## Recommendation
Adopt the fix above **after** confirming the prod application mechanism and
`__drizzle_migrations` state. If the answer is "prod is and will stay
push-based", the lower-effort alternative is to (a) fix the duplicate `0049`
filename, (b) correct the `migrate.ts` header to reflect that `push` is the
real mechanism, and (c) stop treating the journal as authoritative — but that
leaves no working `migrate.ts` path, which is risky for disaster recovery.
