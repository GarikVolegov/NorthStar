---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]], [[../../30_Process/_MOC]]
tags: [L3, product, pipeline, external]
updated: 2026-05-28
---

# Pipeline — development

**Classe**: external · **Skill**: `gsd:ns-step` · **Plan file**: `.planning/PLAN.md`
**Commit convention**: `feat(aaas): Step N — [step name]`

Pipeline step-typed per Claude Code. Implementa step di `PLAN.md` con security gate baked-in. Commit bloccato fino a passaggio del gate.

## Step types (= types di lavoro)

| Type | GSD entry | Gate id | Highlight check |
|---|---|---|---|
| `db` | execute --interactive | `gate-db` | `fk-on-delete`, `cascade-on-user-data` (critical: GDPR) |
| `api` | execute --interactive | `gate-api` | `auth-before-query` (critical), `cross-user-check` (critical) |
| `worker` | plan --tdd | `gate-worker` | `timeout-enforced`, `no-credentials-in-logs` (critical) |
| `agent` | plan --tdd | `gate-agent` | `no-pii-in-llm-context`, `llm-error-handled` |
| `delivery` | plan | `gate-delivery` | `resend-rate-limit`, `no-pii-in-delivery-logs` |
| `ai-tool` | plan | `gate-ai-tool` | `confirm-before-destructive` (critical) |
| `ui-component` | execute --interactive | `gate-ui-component` | `no-dangerous-html` (critical) |
| `ui-page` | plan | `gate-ui-page` | `auth-guard` (critical) |
| `test` | execute --interactive | `gate-test` | `no-real-credentials` (critical), `real-db-not-mock` |
| `gate` | execute --interactive | `gate-gate` | `kill-switch`, `default-on-safe` |

Definizioni complete: `.planning/pipeline-registry.json` (vedi sezione `pipelines.development.step_types`).
