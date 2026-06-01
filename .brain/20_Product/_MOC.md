---
layer: product
status: stable
runtime: false
owner: garik
tags: [moc, L3, product]
updated: 2026-05-28
---

# L3 — Product

Come NorthStar e realizzato. Ogni sottosistema linka al codice applicativo nei workspace `apps/` e `packages/`.

## Sottosistemi
- [[ARCHITECTURE]] - architettura generale, confini e flussi runtime
- [[Subsystems/Wendy]] — chat agent (RAG + tool calling)
- [[Subsystems/AAaS-Ritual]] — engine di routine schedulate user-level
- [[Subsystems/RAG-Pipeline]] — grounding su job market reale
- [[Subsystems/Dashboard]] — UI personalizzabile per insight + routine
- [[Subsystems/Auth-Profile]] — identità utente, onboarding, settings

## Pipelines (`.planning/pipeline-registry.json`)
| Nome | Classe | Trigger |
|---|---|---|
| [[Pipelines/development]] | external | manuale via `gsd:ns-step` |
| [[Pipelines/security]] | internal | on PR merge + lun 9:00 |
| [[Pipelines/quality]] | internal | on PR merge + daily 2:00 |
| [[Pipelines/compliance]] | internal | mensile + on db migration |
| [[Pipelines/infra-health]] | internal | ogni 15 min |
| [[Pipelines/eval-wendy]] | internal | lun 8:00 + on prompt change |
| [[Pipelines/performance]] | internal | lun 9:00 + on staging deploy |
| [[Pipelines/analytics]] | internal | lun 8:00 |
| [[Pipelines/tech-debt]] | internal | mensile |

Risale a → [[../10_Domain/_MOC|L2 Domain]]
Discende a [[../30_Process/_MOC|L3.5 Process]]
