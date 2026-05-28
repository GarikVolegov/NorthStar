---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[RAG-Pipeline]], [[Auth-Profile]], [[../../00_Identity/Vision-NorthStar]], [[../Pipelines/eval-wendy]]
tags: [L3, product, wendy, ai-agent]
updated: 2026-05-28
---

# Wendy

## Ruolo
Agente conversazionale di NorthStar. Punto di contatto principale dell'utente. Risponde con grounding RAG su mercato reale + tool calling per azioni (configurare routine, leggere segnali, ecc.).

## Confini
- **Cosa fa**: rispondere a domande career, configurare routine via tool, esporre weak signals, citare fonti
- **Cosa NON fa**: azioni destructive senza conferma esplicita (`action: "confirm"`), divulgazione PII di altri utenti, risposte mediche/legali

## Dipendenze upstream
- [[RAG-Pipeline]] — fornisce `search_rag`, `get_weak_signals`, `get_job_posting_trend`, `get_skill_cooccurrences`
- [[Auth-Profile]] — `req.userId` per personalizzazione e rate limiting
- [[AAaS-Ritual]] — tool `configure_routine` (Step 6 già implementato)

## Dipendenze downstream
- [[Dashboard]] — il `wendy_context` channel scrive negli insight visualizzati
- [[../Pipelines/eval-wendy]] — 46 test case offline + KPI targets (accuracy ≥0.80, safety 1.00, privacy 1.00)

## File chiave nel codice
- `apps/server/src/routes/ai-wendy.ts` — endpoint chat
- `apps/server/src/lib/admin-wendy-tools.ts` — tool registry lato admin
- `apps/server/src/services/wendy/wendy-prompt-builder.ts` — system prompt
- `apps/server/src/routes/admin/wendy.ts` — admin route
- `packages/ai-server/src/wendy-router/tool-handlers.ts` — handler dei tool RAG

```dataview
list from "90_Code/Nodes" where contains(file.name, "wendy")
```
