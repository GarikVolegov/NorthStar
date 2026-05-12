# RouterAgent

File: `packages/ai-server/src/growth-agent/router-agent.ts`

## Cosa fa
Classifica il messaggio dell'utente in un **dominio** (career, mindset, habits, trading, finance, relationships, general) e un **intento** (explore, problem_solve, plan, reflect, vent, ask_info). Usa GPT-4o-mini per la classificazione, con threshold adattivo basato su intent, lunghezza messaggio, cronologia e matching keyword.

## Input
- `userMessage: string` — testo dell'utente
- `history: ChatMessage[]` — ultimi messaggi della conversazione
- `requestId?: string` — trace ID opzionale

## Output
- `Promise<RouteDecision>` — oggetto con domain, intent, confidence, threshold, reasoning, handoffContext, secondaryRoute opzionale

## Invarianti
- Non deve mai chiamare LLM se il messaggio è <3 caratteri (usa keyword matching come fallback)
- Se LLM fallisce, torna `{ domain: "general", intent: "explore", isFallback: true }` — mai throw
- secondaryRoute richiede confidence >= 0.45 e dominio diverso dal primario
- Vent/reflect hanno threshold più basso (0.50 base) per rispondere a sfoghi emotivi con poco segnale

## Costo
- 1 chiamata GPT-4o-mini (chatOnce) per richiesta: ~200-400 token in + ~150 out
