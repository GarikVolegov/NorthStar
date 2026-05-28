---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]], [[../../00_Identity/Values-Principles]]
tags: [L3, product, pipeline, internal, security]
updated: 2026-05-28
---

# Pipeline — security

**Classe**: internal · **Agent**: `gsd-security-auditor`
**Schedule**: `on:pr-merge`, lun 9:00 · **Output**: `.reports/SECURITY-REPORT.md`

Scansione codebase per auth gap, CVE, secret exposure, RBAC drift.

## Severity → azione
| Severity | Azione |
|---|---|
| low / medium | report-only |
| high | open-issue |
| critical | **block-deploy** |

## Checks
- `npm-audit-critical`
- `all-routes-have-auth-middleware`
- `no-secrets-in-codebase`
- `rbac-drift-detection`
- `env-var-exposure-in-logs`
