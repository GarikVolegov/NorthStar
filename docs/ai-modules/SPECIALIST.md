# SpecialistAgent

File: `packages/ai-server/src/growth-agent/specialist-agent.ts`

## Cosa fa
Abstract base per specialisti di dominio (career, mindset, habits, trading). Ogni specialista ha: un system prompt specifico, query web personalizzata e sezione dominio opzionale. Esegue retrieval + CoT + self-eval + generazione + supervisor in un flusso autonomo.

## Specialist implementati
- **CareerAgent** (`specialists/career-agent.ts`) — CV, colloqui, carriera
- **MindsetAgent** (`specialists/mindset-agent.ts`) — credenze limitanti, pattern cognitivi
- **HabitsAgent** (`specialists/habits-agent.ts`) — abitudini, routine, produttività
- **TradingAgent** (`specialists/trading-agent.ts`) — trading psicologia, strategie

## Input (run)
- `SpecialistRunOptions` — userId, userContext, history, userMessage, routeDecision, ...

## Output (run)
- `AsyncGenerator<SpecialistEvent>` — token, status, done, error

## Invarianti
- Non deve mai chiamare LLM se self-evaluator score < 0.45 (torna al flusso generale)
- Ogni specialista registra se stesso via `registerSpecialist()` all'import — deve essere importato prima dell'uso
- Memory save è fire-and-forget con timeout 8s
- Supervisor gate viene eseguito sempre dopo la generazione
