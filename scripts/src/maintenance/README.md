# Maintenance Scripts

Operational scripts that can modify database state or perform one-off recovery tasks.

Run only with the right environment loaded and after checking the matching migration or
schema source of truth.

```bash
pnpm --filter @workspace/scripts run maintenance:db:fix-roles
```

Prefer normal Drizzle migrations over these scripts for product schema changes.
