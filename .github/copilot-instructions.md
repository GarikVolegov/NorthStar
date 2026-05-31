# GitHub Copilot — Istruzioni progetto NorthStar

> Caricato automaticamente da GitHub Copilot (VS Code e Copilot coding agent).

## Prima di tutto

Leggi e usa **[`memoria.md`](../memoria.md)**: è il documento-radice vivente del
progetto (identità, architettura, stato, direzione, regole). Le istruzioni operative
complete sono in **[`AGENTS.md`](../AGENTS.md)** — seguile.

## Essenziale

- `memoria.md` è l'**indice radice**: linka `*_RULES.md`, `ARCHITECTURE.md`, `docs/`, `.brain/`.
- Prima di modificare un'area, apri il `*_RULES.md` pertinente (API/DB/FRONTEND/AI/GIT/SECURITY).
- A fine lavoro significativo, **aggiorna `memoria.md`** (header, §7 Stato e Direzione, §10 Changelog).
- Non negoziabili: niente segreti committati · commit atomici + security gate · DB reale nei test (no mock) · niente PII al LLM in chiaro.
- Lingua: italiano per strategia/prodotto, inglese tecnico per il codice.
