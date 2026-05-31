# AGENTS.md — Istruzioni per ogni agente AI su NorthStar

> Questo file è caricato automaticamente dagli strumenti AI (OpenCode, Cursor, Codex,
> Gemini CLI, GitHub Copilot agent, ecc.). Claude Code legge `CLAUDE.md`, che punta qui.

## 🛑 Prima regola, senza eccezioni

**Leggi [`memoria.md`](memoria.md) PRIMA di qualunque altra cosa.** È il documento-radice
vivente del progetto: contiene identità, architettura, stato attuale, direzione e il
**Protocollo di revisione** che sei tenuto a seguire. Non iniziare a ragionare o a
scrivere codice prima di averlo letto.

`memoria.md` è un **indice radice**: non duplica la documentazione, la collega. Da lì
raggiungi le regole di dettaglio (`*_RULES.md`, `ARCHITECTURE.md`, `docs/`, `.brain/`).

## Ciclo di lavoro obbligatorio

1. **Inizio sessione** → leggi `memoria.md` per intero.
2. **Prima di toccare un'area** → apri il `*_RULES.md` pertinente (vedi "Regola 0" in `memoria.md`).
3. **Verifica prima di fidarti** → la memoria invecchia; se un fatto nomina file/tabelle/flag/branch, controlla che esistano ancora. Vince il codice.
4. **Fine lavoro significativo** (fase GSD chiusa, commit/PR rilevante, cambio architettura/decisione) → aggiorna `memoria.md`: header, §7 Stato e Direzione, e una riga al §10 Changelog.

## Non negoziabili (sintesi — il dettaglio è in `memoria.md` e nei RULES)

- Mai committare segreti / API key.
- Commit atomici e verificabili; security gate prima del commit (`SECURITY_RULES.md`).
- Test di integrazione su DB reale, niente mock DB.
- Nessuna PII al LLM in chiaro.
- Italiano per strategia/prodotto, inglese tecnico per il codice.

> Se hai imparato qualcosa che il prossimo modello rischierebbe di ri-scoprire da zero, scrivilo in `memoria.md`.
