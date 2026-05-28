---
layer: identity
status: stable
runtime: true
owner: garik
links_to: [[Garik]]
tags: [L1, identity, principles, engineering]
updated: 2026-05-28
---

# Values & Principles

Regole non-negoziabili che valgono per ogni decisione di codice e prodotto.

## Engineering
1. **No mock DB nei test di integrazione** — bruciati nel passato da mock che mascheravano bug di migrazione. Vedi pipeline `quality` check `real-db-not-mock`.
2. **Atomic commits + GSD-first** — ogni step di una fase = un commit verificabile. Mai `--no-verify`.
3. **Security gate prima del commit** — i gate in `pipeline-registry.json` step_types sono obbligatori per il tipo corrispondente.
4. **Auth before query** — ogni handler legge `req.userId` prima di toccare il DB. Vedi `gate-api`.
5. **PII non passa al LLM in chiaro** — vedi `gate-agent` check `no-pii-in-llm-context`.
6. **Cascade-on-user-data** — ogni FK verso `usersTable` deve avere `onDelete: "cascade"` (GDPR).

## Prodotto
1. **Agenti chiedono conferma prima di azioni destructive** — `action: "preview"` poi `action: "confirm"`. Vedi `gate-ai-tool`.
2. **Rate limit per-user su ogni tool Wendy** — anti-abuso.
3. **Feature flag con kill-switch** — ogni `FF_*` deve essere disattivabile da env var.

## Memoria & contesto
1. **Date assolute, non relative** — quando salvi in memoria, "giovedì" → "2026-03-05".
2. **Memoria invecchia** — verifica contro il codice corrente prima di asserire.
