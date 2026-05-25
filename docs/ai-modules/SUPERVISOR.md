# SupervisorAgent

File: `packages/ai-server/src/growth-agent/supervisor-agent.ts`

## Cosa fa
Quality gate post-generazione. Valuta la bozza di risposta su 4 dimensioni (actionability, platitudeFree, lengthOk, onTopic). Se il punteggio composito < 0.70, riscrive la risposta via GPT-4o-mini.

## Input (evaluate)
- `userMessage: string`, `draft: string`, `domain: Domain`, `intent: Intent`

## Output (evaluate)
- `SupervisorResult` — pass (boolean), score (0-1), dimensions, reasons, rewritten

## Output (rewrite)
- `Promise<string>` — bozza riscritta (o originale se la riscrittura peggiora la qualità)

## Pesi per intento
- plan: actionability=0.45 (deve avere azioni concrete)
- vent: actionability=0.00 (non penalizzare sfoghi per mancanza di azioni)
- reflect: actionability=0.05
- ask_info: onTopic=0.45 (deve rispondere alla domanda)

## Invarianti
- Rewrite è single-shot, mai in loop
- Se rewrite peggiora lo score (rewriteScore < originalScore), mantiene la bozza originale
- Se LLM rewrite fallisce (eccezione), mantiene la bozza originale
- DB logging è fire-and-forget — non blocca mai la response stream
