# CLAUDE.md — Contesto progetto NorthStar

> Questo file è caricato automaticamente da Claude Code a ogni sessione.

## 🛑 Prima lettura obbligatoria

Leggi **[`memoria.md`](memoria.md)** prima di qualunque cosa. È il documento-radice
vivente del progetto (identità, architettura, stato, direzione) e contiene il
**Protocollo di revisione** che devi seguire — incluso l'obbligo di **aggiornarlo** a
fine lavoro significativo.

Le istruzioni operative complete per gli agenti sono in **[`AGENTS.md`](AGENTS.md)**
(stesso contenuto valido per tutti gli strumenti AI). Segui quelle.

## In breve

- `memoria.md` è un **indice radice**: linka `*_RULES.md`, `ARCHITECTURE.md`, `docs/`, `.brain/` senza duplicarli.
- **Regola 0:** prima di toccare un'area, apri il `*_RULES.md` pertinente.
- **Ciclo:** leggi `memoria.md` → leggi i RULES dell'area → verifica i fatti contro il codice → a fine lavoro aggiorna `memoria.md` (header, §7 Stato e Direzione, §10 Changelog).
- **Non negoziabili:** niente segreti committati, commit atomici + security gate, DB reale nei test (no mock), niente PII al LLM.
