# Admin Ops Control Panel

Admin Ops is meant for local development or a VPS where the NorthStar backend can reach Docker Compose directly.

It is deliberately conservative:

- `ADMIN_OPS_ENABLED=false` by default.
- Database shutdown is represented as application maintenance mode.
- Real Postgres restart stays disabled unless `ADMIN_OPS_ALLOW_DB_RESTART=true`.
- On Vercel, Docker ops are disabled by design even if `ADMIN_OPS_ENABLED=true`.
- Do not use `ADMIN_OPS_ALLOW_VERCEL=true` as a default operating mode.

## Local / VPS Setup

```env
ADMIN_OPS_ENABLED=true
ADMIN_OPS_COMPOSE_FILE=docker-compose.yml
ADMIN_OPS_ALLOWED_SERVICES=northstar-server,postgres,redis
ADMIN_OPS_ALLOW_DB_RESTART=false
ADMIN_OPS_REQUIRE_CONFIRMATION=true
```

Restart the API after changing these variables.

## Production Warning

If the backend itself is stopped, the same backend cannot start itself again.

For environments where Docker or Compose restarts are required, run NorthStar on a VPS or a platform with an external control plane such as Render, Fly.io, Railway, systemd, or direct Docker host access.

On Vercel, Docker ops stay disabled by design. Use Vercel only for the web/build surface and use Render/Fly/Railway/VPS for environments where admin-triggered service restarts are part of the operating model.
