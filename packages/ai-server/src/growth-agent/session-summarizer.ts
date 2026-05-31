/**
 * session-summarizer.ts — Phase 10: session context window.
 *
 * COSA FA:
 *   Al termine (o durante) una sessione di coaching:
 *   1. Prende lo storico messaggi
 *   2. Chiede a un modello micro-tier un riepilogo 3-4 frasi + temi + mood
 *   3. Salva (upsert idempotente) su session_summaries
 *
 * COME VIENE USATO:
 *   - WRITE: coach.ts lo chiama fire-and-forget dopo lo stream, con throttle.
 *   - READ:  loadRecentSummaries() + buildSessionHistorySection() iniettano il
 *            contesto delle sessioni precedenti nel system prompt della
 *            sessione successiva, così Wendy mantiene continuità anche dopo
 *            giorni di inattività.
 *
 * PERCHÉ micro-tier:
 *   Velocità + costo. Il riepilogo è una distillazione leggera (~1s, <0.01$).
 *
 * RESILIENZA:
 *   Se nessun provider LLM è configurato esce subito; ogni errore è swallowed
 *   (fire-and-forget) per non impattare mai la risposta principale all'utente.
 */
import { openai, isLlmConfigured } from "../client";
import { db } from "@workspace/db";
import { sessionSummariesTable } from "@workspace/db";
import { and, eq, desc, isNull } from "drizzle-orm";
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

type Mood = "positive" | "neutral" | "negative" | "mixed";

interface SummaryResponse {
  summary:   string;
  keyThemes: string[];
  mood:      Mood;
}

function normalizeMood(value: unknown): Mood {
  return value === "positive" || value === "neutral" || value === "negative" || value === "mixed"
    ? value
    : "neutral";
}

/**
 * Genera e salva (upsert) il riepilogo di una sessione.
 * Idempotente per (userId, sessionId): aggiorna la riga esistente non
 * cancellata, oppure ne inserisce una nuova — evita il proliferare di righe
 * a ogni turno.
 */
export async function summarizeSession(
  userId:    number,
  sessionId: number,
  messages:  Array<{ role: string; content: string }>,
): Promise<void> {
  if (!messages.length) return;
  if (!db) return;
  if (!isLlmConfigured()) return;

  // Trascrizione compatta (ultimi 20 messaggi, 200 char ciascuno)
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

    const row = {
      summary:   parsed.summary.slice(0, 500),
      keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes.slice(0, 4) : [],
      mood:      normalizeMood(parsed.mood),
    };

    // Upsert idempotente: una sola riga di riepilogo per sessione.
    const [existing] = await db
      .select({ id: sessionSummariesTable.id })
      .from(sessionSummariesTable)
      .where(
        and(
          eq(sessionSummariesTable.userId, userId),
          eq(sessionSummariesTable.sessionId, sessionId),
          isNull(sessionSummariesTable.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(sessionSummariesTable)
        .set({ ...row, createdAt: new Date() })
        .where(eq(sessionSummariesTable.id, existing.id));
    } else {
      await db.insert(sessionSummariesTable).values({ userId, sessionId, ...row });
    }

    logger.info({ userId, sessionId }, "session summarized");
  } catch (err) {
    logger.warn({ err, userId, sessionId }, "session summarizer failed");
  }
}

/**
 * Carica gli ultimi N riepiloghi di sessione di un utente.
 * Usato per iniettare il contesto nel system prompt della sessione successiva.
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
      .where(
        and(
          eq(sessionSummariesTable.userId, userId),
          isNull(sessionSummariesTable.deletedAt),
        ),
      )
      .orderBy(desc(sessionSummariesTable.createdAt))
      .limit(limit);
    return rows as Array<{ summary: string; keyThemes: string[]; mood: string }>;
  } catch {
    return [];
  }
}

/**
 * Formatta i riepiloghi recenti come sezione da iniettare nel system prompt.
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
