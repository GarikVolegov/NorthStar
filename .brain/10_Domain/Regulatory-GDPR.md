---
layer: domain
status: stable
runtime: true
owner: garik
links_to: [[../00_Identity/Values-Principles]], [[../20_Product/Pipelines/compliance]]
tags: [L2, domain, regulatory, gdpr]
updated: 2026-05-28
---

# Regulatory — GDPR

Vincoli normativi non negoziabili per un SaaS che processa CV, email, dati di profilo professionale di residenti UE.

## Principi che impattano l'architettura
1. **Right to erasure** → `onDelete: "cascade"` obbligatorio su ogni FK verso `usersTable`. Pipeline `compliance` check `gdpr-cascade-delete-coverage`.
2. **Data minimization** → no PII inutile in tabelle, no PII raw in prompt LLM (vedi `gate-agent`).
3. **Audit trail su azioni sensibili** → pipeline `compliance` check `sensitive-action-audit-log-coverage`.
4. **Data retention policy** → da definire per tabelle high-volume (`ragChunksTable`, `jobPostingSnapshotsTable`).
5. **Consenso esplicito** → routine schedulate richiedono consenso utente per email delivery.

## Operativamente
- Pipeline `compliance` gira mensile (`0 10 1 * *`) e on:db-migration
- Inventory PII tracciato (`pii-table-inventory`)

## TODO
- DPA template per Resend, OpenAI, Anthropic, Groq, Supabase
- Privacy policy aggiornata se introduciamo nuove fonti RAG
