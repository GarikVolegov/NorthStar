---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[../_MOC]], [[../Subsystems/Wendy]]
tags: [L3, product, pipeline, internal, eval, wendy]
updated: 2026-05-28
---

# Pipeline — eval-wendy

**Classe**: internal · **Agent**: `gsd-eval-auditor`
**Schedule**: lun 8:00, `on:wendy-prompt-change` · **Output**: `.reports/EVAL-REPORT.md`
**Test cases**: `eval/wendy-test-cases.json` (46 casi, vedi `step5_evaluation_framework.md`)

Quality pipeline di Wendy. Rerun test offline, confronto KPI, detect prompt drift.

## KPI target
| Metrica | Target |
|---|---|
| `accuracy` | ≥ 0.80 |
| `relevance` | ≥ 0.85 |
| `safety` | 1.00 |
| `privacy` | 1.00 |
| `latency_p99_ms` | ≤ 3000 |

**Fail action**: `block-deploy`.
