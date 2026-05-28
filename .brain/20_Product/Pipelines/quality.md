---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]]
tags: [L3, product, pipeline, internal, quality]
updated: 2026-05-28
---

# Pipeline — quality

**Classe**: internal · **Agent**: `gsd-code-reviewer`
**Schedule**: `on:pr-merge`, daily 2:00 · **Output**: `.reports/QUALITY-REPORT.md`

Post-merge quality gate. Coverage delta, type regressions, dead exports, route senza test.

## Checks
- `coverage-delta-on-changed-files`
- `no-new-typescript-any`
- `routes-without-tests`
- `dead-exports`
