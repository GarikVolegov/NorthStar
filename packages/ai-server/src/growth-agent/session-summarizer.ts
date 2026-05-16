/**
 * session-summarizer.ts — Phase 10: session context window.
 *
 * WHAT IT DOES:
 *   After a coaching session ends, this module:
 *   1. Takes the full message history
 *   2. Asks GPT-4o-mini to produce a 3-4 sentence summary + key themes + mood
 *   3. Saves to session_summaries table
 *
 * HOW IT'S USED:
 *   - Called by chat.ts in the post-stream setImmediate block (fire-and-forget)
 *   - The result is read by loadRecentSummaries() in the NEXT session's prompt
 *
 * WHY GPT-4o-mini:
 *   Speed + cost. The summary is a lightweight distillation task.
 *   A 20-message session summarised in ~1s at <0.01$ per session.
 */
import { openai } from "../client";
import { db } from "@workspace/db";
import { sessionSummariesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { ChatMessage } from "./agent";
import { logger } from "../logger";
import { selectModelFor } from "../model-router";

const SUMMARIZER_SYSTEM = `
Sei un assistente che produce riepiloghi concisi di sessioni di coaching.

Dato uno storico di messaggi, genera un JSON con:
- summary:   3-4 frasi che descrivono gli argomenti principali, l'obiettivo dell'utente e le conclusioni raggiunte. Max 500 caratteri.
- keyThemes: array di 2-4 stringhe brevi (es. ["cambiamento carriera", "ansia da performance"])
- mood:      uno di: "positive" | "neutral" | "negative" | "mixed" (tono emotivo prevalente dell'utente)

Rispondi SOLO con JSON valido. Nessun testo fuori dal JSON.
`.trim();

interface SummaryResponse {
  summary:   string;
  keyThemes: string[];
  mood:      "positive" | "neutral" | "negative" | "mixed";
}

export async function summarizeSession(
  userId:    number,
  sessionId: number,
  messages:  ChatMessage[],
): Promise<void> {
  if (!messages.length) return;

  // Build a compact transcript (max last 20 messages, 200 chars each)
  const transcript = messages
    .slice(-20)
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");

  try {
    const route = selectModelFor("session-summarize");
    const res = await openai.chat.completions.create({
      model:           route.model,
      messages: [
        { role: "system", content: SUMMARIZER_SYSTEM },
        { role: "user",   content: `Trascrizione sessione:\n${transcript}` },
      ],
      temperature:     0.2,
      max_tokens:      300,
      response_format: { type: "json_object" },
    });

    const raw    = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<SummaryResponse>;

    if (!parsed.summary) {
      logger.warn({ userId, sessionId }, "empty summary returned, skipping save");
      return;
    }

    await db.insert(sessionSummariesTable).values({
      userId,
      sessionId,
      summary:   parsed.summary.slice(0, 500),
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes.slice(0, 4) : [],
      mood:      (["positive", "neutral", "negative", "mixed"] as const).includes(parsed.mood as any)
                   ? (parsed.mood as "positive" | "neutral" | "negative" | "mixed")
                   : "neutral",
    });

    logger.info({ userId, sessionId }, "session summarized");
  } catch (err) {
    logger.warn({ err, userId, sessionId }, "session summarizer failed");
  }
}

/**
 * Load the last N session summaries for a user.
 * Used by chat.ts to inject context into the next session's system prompt.
 */
export async function loadRecentSummaries(
  userId: number,
  limit  = 3,
): Promise<Array<{ summary: string; keyThemes: string[]; mood: string }>> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        summary:   sessionSummariesTable.summary,
        keyThemes: sessionSummariesTable.keyThemes,
        mood:      sessionSummariesTable.mood,
      })
      .from(sessionSummariesTable)
      .where(eq(sessionSummariesTable.userId, userId))
      .orderBy(desc(sessionSummariesTable.createdAt))
      .limit(limit);
    return rows as Array<{ summary: string; keyThemes: string[]; mood: string }>;
  } catch {
    return [];
  }
}

/**
 * Format recent summaries as a section for injection into the system prompt.
 */
export function buildSessionHistorySection(
  summaries: Array<{ summary: string; keyThemes: string[]; mood: string }>,
): string {
  if (!summaries.length) return "";
  const lines = summaries.map((s, i) =>
    `Sessione precedente ${i + 1}:\n  ${s.summary}\n  Temi: ${(s.keyThemes ?? []).join(", ")}\n  Tono: ${s.mood}`,
  );
  return `\n\n## Contesto sessioni recenti\n${lines.join("\n\n")}`;
}
