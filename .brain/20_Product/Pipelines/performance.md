---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]]
tags: [L3, product, pipeline, internal, performance]
updated: 2026-05-28
---

# Pipeline — performance

**Classe**: internal · **Agent**: `gsd-code-reviewer`
**Schedule**: lun 9:00, `on:staging-deploy` · **Output**: `.reports/PERF-REPORT.md`

Regression check settimanale.

## Checks
- `pg-slow-queries`
- `bundle-size-delta`
- `api-latency-p99-regression`
- `cron-execution-time-regression`
