---
name: db-safety
description: Use when touching Drizzle schema, migrations, DB jobs, seed data, SQL, pgvector, RAG tables, or production-adjacent database commands.
---

# DB Safety

Database work must be typed, migration-backed, and secret-safe.

## Rules

- Read `.brain/40_Agent_Context/rules/DB_RULES.md` before schema or migration changes.
- Prefer Drizzle APIs over raw SQL in runtime code.
- Migration files are committed; production data dumps are never committed.
- Migrations must be idempotent where practical: `IF NOT EXISTS`, nullable/default-safe changes.
- Never run production `db:push`; use reviewed migrations.
- Never log `DATABASE_URL`, credentials, user PII, or seed real user data.

## Checks

- Schema and migration agree.
- New indexes match query filters.
- Local migration command or dry-run has fresh output before claiming success.
- No real email domains or secrets appear in staged DB diffs.
