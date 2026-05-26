/**
 * agent-executor.ts — Engine di esecuzione degli agenti AI dipendenti.
 *
 * Ogni agente è un "dipendente" specializzato con una persona e capability.
 * I task vengono eseguiti in background (fire-and-forget dalla route)
 * e i risultati salvati in agent_tasks.
 *
 * L'executor usa il modello LLM appropriato via selectModelFor()
 * e ha accesso ai tool RAG/weak-signals se il dominio lo richiede.
 */
import { db, agentTasksTable, agentEmployeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";
import { logger } from "../logger";

// ── Tool definitions per gli agenti ───────────────────────────────────────────

const AGENT_TOOLS_BY_DOMAIN: Record<string, string[]> = {
  career:   ["search_professions", "get_sector_detail", "get_user_context", "search_rag"],
  market:   ["search_rag", "get_weak_signals", "get_job_posting_trend"],
  business: ["search_rag", "get_sector_detail"],
  learning: ["get_learning_paths", "get_growth_articles", "search_rag", "get_skill_cooccurrences"],
  mindset:  ["get_user_context", "get_user_objectives", "get_growth_articles"],
  rabbit:   ["get_rabbit_care_guide", "check_food_safety", "get_breed_info", "search_rabbit_kb", "get_user_context"],
};

// ── Executor principale ────────────────────────────────────────────────────────

export async function executeAgentTask(taskId: number): Promise<void> {
  const t0 = Date.now();
  const log = logger.child({ taskId });

  try {
    // 1. Carica il task
    const [task] = await db
      .select()
      .from(agentTasksTable)
      .where(eq(agentTasksTable.id, taskId))
      .limit(1);

    if (!task) {
      log.warn("[agent-executor] task not found");
      return;
    }

    if (task.status !== "queued") {
      log.warn({ status: task.status }, "[agent-executor] task not in queued state");
      return;
    }

    // 2. Carica il profilo dell'agente
    const [agent] = await db
      .select()
      .from(agentEmployeesTable)
      .where(eq(agentEmployeesTable.slug, task.agentSlug))
      .limit(1);

    if (!agent || !agent.isActive) {
      await db.update(agentTasksTable)
        .set({ status: "failed", errorMessage: `Agente ${task.agentSlug} non trovato`, updatedAt: new Date() })
        .where(eq(agentTasksTable.id, taskId));
      return;
    }

    // 3. Segna come "running"
    await db.update(agentTasksTable)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(agentTasksTable.id, taskId));

    log.info({ agentSlug: task.agentSlug, userId: task.userId }, "[agent-executor] task started");

    // 4. Seleziona modello appropriato per il dominio dell'agente
    const modelRoute = selectModelFor("specialist-chat", { isPremium: false });
    const llm = getLLMForRoute({ provider: modelRoute.provider });

    // 5. Costruisce il contesto e chiama l'LLM
    const systemPrompt = `${agent.systemPrompt}

CONTESTO TASK:
- Sei stato assegnato questo task dall'utente tramite NorthStar
- Il tuo compito è fornire una risposta dettagliata, strutturata e azionabile
- Usa formato Markdown per la risposta (headings, bullet points, grassetto per punti chiave)
- Sii specifico e pratico — niente generalità
- Al termine, includi una sezione "## Prossimi Passi" con 3 azioni concrete

TOOL DISPONIBILI PER IL TUO DOMINIO: ${(AGENT_TOOLS_BY_DOMAIN[agent.domain] ?? []).join(", ")}`;

    const userMessage = task.prompt;

    // Stream + accumula la risposta
    let outputMarkdown = "";
    const toolsCalled: string[] = [];

    try {
      const stream = await llm.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        {
          model:       modelRoute.model,
          temperature: 0.7,
          maxTokens:   2000,
        },
      );

      for await (const chunk of stream) {
        outputMarkdown += chunk;
      }
    } catch (llmErr) {
      // Fallback: genera una risposta strutturata senza LLM
      outputMarkdown = `## Analisi di ${agent.name}\n\n**Task**: ${task.title}\n\n_Servizio AI temporaneamente non disponibile. Riprova tra qualche minuto._`;
      log.warn({ llmErr, taskId }, "[agent-executor] LLM error, using fallback");
    }

    const durationMs = Date.now() - t0;

    // 6. Salva il risultato
    await db.update(agentTasksTable)
      .set({
        status:          "completed",
        outputMarkdown,
        outputMeta:      { modelUsed: modelRoute.model, toolsCalled },
        completedAt:     new Date(),
        durationMs,
        updatedAt:       new Date(),
      })
      .where(eq(agentTasksTable.id, taskId));

    log.info({ taskId, durationMs }, "[agent-executor] task completed");

  } catch (err) {
    const durationMs = Date.now() - t0;
    log.error({ err, taskId }, "[agent-executor] task failed");

    await db.update(agentTasksTable)
      .set({
        status:       "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt:  new Date(),
        durationMs,
        updatedAt:    new Date(),
      })
      .where(eq(agentTasksTable.id, taskId));
  }
}
