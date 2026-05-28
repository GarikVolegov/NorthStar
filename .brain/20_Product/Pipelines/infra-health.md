---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]], [[../Subsystems/AAaS-Ritual]]
tags: [L3, product, pipeline, internal, infra]
updated: 2026-05-28
---

# Pipeline — infra-health

**Classe**: internal · **Agent**: `infra-health-agent`
**Schedule**: `*/15 * * * *` · **Output**: alert-on-threshold

Monitor operativo continuo: cron job, routine failure, DB pool, email delivery.

## Soglie
| Metrica | Soglia |
|---|---|
| `routine_failure_rate_24h` | 5% |
| `cron_overdue_multiplier` | 2.0× |
| `job_stuck_minutes` | 10 |
| `email_bounce_rate_24h` | 2% |
| `db_pool_usage_pct` | 85% |
