# Diagnostics Scripts

Read-only scripts for checking local or remote NorthStar setup.

Run them through the workspace package, for example:

```bash
pnpm --filter @workspace/scripts run diagnostic:db:schema
```

Do not add scripts here if they modify database state.
