# Self-Evaluator

File: `packages/ai-server/src/growth-agent/self-evaluator.ts`

## Cosa fa
Valuta se l'agente ha abbastanza contesto per rispondere bene, prima di generare la risposta. Usa solo euristiche locali — **zero chiamate API**.

## Input
- `userMessage: string`
- `documentChunks: RetrievedChunk[]`
- `webResults: RetrievedChunk[]`
- `cot: CoTResult | null`
- `memoryFactCount: number`

## Output
- `EvalResult` — score composito 0-1, level (high/medium/low), needsClarification, dimensioni, reasons

## Dimensioni pesate
- contextCoverage (35%) — similarità media dei chunk recuperati
- cotConfidence (30%) — confidenza del CoT
- questionClarity (25%) — lunghezza e specificità del messaggio
- memoryCoverage (10%) — quanti fatti biografici noti

## Soglie
- score >= 0.72 → high: risponde normalmente
- score >= 0.45 → medium: risponde con linguaggio cauto
- score < 0.45 → low: chiede chiarimento invece di rispondere

## Invarianti
- Non deve mai chiamare LLM (costo zero)
- Se `needsClarification === true`, la risposta deve essere una domanda di chiarimento, non una risposta generica
- Controllo eseguito PRIMA della generazione LLM
