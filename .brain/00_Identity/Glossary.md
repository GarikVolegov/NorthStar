---
layer: identity
status: stable
runtime: true
owner: garik
tags: [L1, identity, glossary]
updated: 2026-05-28
---

# Glossary

Termini interni ricorrenti. Se compaiono in chat con Wendy o nei prompt agli agenti, devono significare quello che dice qui.

| Termine | Significato |
|---|---|
| **NorthStar** | Il prodotto. Career intelligence SaaS+AaaS per professionisti IT |
| **Wendy** | Agente conversazionale (chat) — punto di contatto utente. Vedi [[../20_Product/Subsystems/Wendy]] |
| **AaaS** | Agents-as-a-Service. Le routine schedulate user-level che girano in background |
| **Routine** | Un'istanza di AaaS configurata da utente. Tipi: `job_monitor`, `market_report`, `mindset_exercise`, `growth_briefing`, `interview_prep` |
| **Briefing** | Output di una routine consegnato via email / in-app / wendy_context |
| **RAG** | Retrieval-augmented generation. Pipeline grounding Wendy su `ragChunksTable` (pgvector) |
| **Weak signal** | Trend emergente in `weakSignalsTable` (job posting, skill cooccurrence) |
| **Proactive insight** | Suggerimento generato per un utente specifico (`proactiveInsightsTable`) |
| **Cave** | Tool/skill `cavecrew` per subagenti compressi |
| **Cartographer** | (TBD) Agente che aggiorna il vault dopo ogni fase GSD |
| **GSD** | "Get Stuff Done" — il framework di phase/step/gate installato (67 comandi) |
| **Fase** | Unità di lavoro top-down di GSD (es. "Fase 1: Ritual Engine") |
| **Step** | Unità atomica dentro una fase (db / api / worker / agent / delivery / ai-tool / ui-component / ui-page / test / gate) |
| **Security gate** | Check eseguito prima del commit di uno step, definito in `pipeline-registry.json` |
| **L1..L4** | Livelli gerarchici del vault. L1=Identity, L2=Domain, L3=Product, L3.5=Process, L4=Code |
