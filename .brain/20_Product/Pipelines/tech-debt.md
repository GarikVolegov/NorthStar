---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]]
tags: [L3, product, pipeline, internal, tech-debt]
updated: 2026-05-28
---

# Pipeline — tech-debt

**Classe**: internal · **Agent**: `gsd-code-reviewer`
**Schedule**: mensile (`0 10 1 * *`) · **Output**: `.reports/TECH-DEBT-REPORT.md`

Audit mensile debito tecnico.

**Fail threshold**: ≥3 critical items.

## Checks
- `npm-outdated-major`
- `todo-fixme-age`
- `db-schema-without-migration`
- `duplicate-packages-in-monorepo`
