/**
 * mindset-exercise executor — generates a personalised mindset exercise.
 *
 * parameters: { tone?: "energico" | "calmo" | "riflessivo", focus?: string }
 */
import { db, coachMemoryFactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:mindset-exercise" });

export const mindsetExerciseExecutor: RoutineExecutor = async (routine, user): Promise<RoutineResult> => {
  const params = routine.parameters as { tone?: "energico" | "calmo" | "riflessivo"; focus?: string };
  const tone   = params.tone  ?? "calmo";
  const focus  = params.focus ?? "crescita personale";

  // Build topic label for title
  const topicLabel = focus ?? tone;

  try {
    // 1. Read coach memory facts for personalisation
    const facts = await db
      .select({ key: coachMemoryFactsTable.key, value: coachMemoryFactsTable.value })
      .from(coachMemoryFactsTable)
      .where(eq(coachMemoryFactsTable.userId, user.id))
      .limit(5);

    const memoryContext = facts.length > 0
      ? facts.map((f) => `${f.key}: ${f.value}`).join("\n")
      : "Nessun profilo disponibile.";

    let body: string;
    try {
      const llm  = getLLM();
      body = await llm.chatOnce(
        [
          {
            role:    "system",
            content: "Sei un coach di mindset. Genera esercizi pratici e brevi in italiano. Usa formato Markdown leggero.",
          },
          {
            role:    "user",
            content: `Tono: ${tone}. Focus: ${focus}. Profilo utente:\n${memoryContext}\n\nGenera un esercizio di mindset da 3-5 minuti con istruzioni passo passo.`,
          },
        ],
        { model: "gpt-4o-mini", temperature: 0.7, maxTokens: 500 },
      );
    } catch (llmErr) {
      log.warn({ llmErr, routineId: routine.id }, "[mindset-exercise] LLM failed, using fallback");
      body = `**Esercizio di mindset — ${tone}**\n\nPrendi 3 minuti per te. Siediti in modo comodo, chiudi gli occhi e concentrati sul respiro.\n\n1. Inspira lentamente per 4 secondi.\n2. Trattieni per 4 secondi.\n3. Espira lentamente per 6 secondi.\n4. Ripeti per 5 cicli.\n\nAl termine, scrivi un pensiero positivo sulla tua giornata.`;
    }

    return {
      title:     `🧠 Esercizio mindset: ${topicLabel}`,
      body,
      ctaLabel:  "Parla con Wendy",
      ctaTarget: "/chat",
      metadata:  { tone, focus, exerciseType: "mindset" },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[mindset-exercise] executor failed");
    return {
      title:     `🧠 Esercizio mindset: ${topicLabel}`,
      body:      "Non è stato possibile generare l'esercizio al momento. Riprova più tardi.",
      ctaLabel:  "Parla con Wendy",
      ctaTarget: "/chat",
      metadata:  { tone, focus, exerciseType: "mindset", error: String(err) },
    };
  }
};
