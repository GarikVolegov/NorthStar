---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]], [[../../10_Domain/Regulatory-GDPR]]
tags: [L3, product, pipeline, internal, compliance, gdpr]
updated: 2026-05-28
---

# Pipeline — compliance

**Classe**: internal · **Agent**: `gsd-security-auditor`
**Schedule**: mensile (`0 10 1 * *`), `on:db-migration` · **Output**: `.reports/COMPLIANCE-REPORT.md`

GDPR, PII inventory, data retention, audit log coverage.

## Checks
- `pii-table-inventory`
- `gdpr-cascade-delete-coverage`
- `data-retention-policy-enforcement`
- `sensitive-action-audit-log-coverage`

Vedi anche [[../../10_Domain/Regulatory-GDPR]] per il razionale normativo.
