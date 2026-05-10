/**
 * Memory Manager — persistent memory across coach sessions.
 *
 * ARCHITECTURE
 * ────────────
 * WRITE path (fires AFTER each conversation, non-blocking):
 *   conversation messages
 *       ↓
 *   extractMemory()  ← GPT-4o-mini analyzes the exchange
 *       ↓
 *   { facts: [...], patterns: [...] }
 *       ↓
 *   mergeMemory()    ← upserts facts, increments pattern confidence
 *       ↓
 *   coach_memory_facts + coach_memory_patterns tables
 *
 * READ path (fires BEFORE each response, parallel with RAG retrieval):
 *   loadMemory(userId)
 *       ↓
 *   { facts, patterns }  ← top patterns by confidence + all facts
 *       ↓
 *   buildMemorySection() ← injected into system prompt
 *
 * CONFIDENCE SCORING for patterns:
 *   1st observation  → 0.50
 *   2nd observation  → 0.65
 *   3rd observation  → 0.80
 *   4th+ observation → 0.90 (capped)
 *
 * This means the coach mentions a pattern with certainty only after
 * seeing it multiple times — avoids false positives from a single session.
 */
import { db } from "@workspace/db";
import {
  coachMemoryFactsTable,
  coachMemoryPatternsTable,
  type CoachMemoryFact,
  type CoachMemoryPattern,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "../client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoryFact {
  key: string;
  value: string;
}

export interface MemoryPattern {
  patternType:
    | "limiting_belief"
    | "strength"
    | "recurring_theme"
    | "emotional_trigger"
    | "growth_edge";
  description: string;
}

export interface ExtractedMemory {
  facts: MemoryFact[];
  patterns: MemoryPattern[];
}

export interface UserMemory {
  facts: CoachMemoryFact[];
  patterns: CoachMemoryPattern[];
}

// ── Confidence ladder ────────────────────────────────────────────────────────

function computeConfidence(observedCount: number): number {
  if (observedCount >= 4) return 0.90;
  if (observedCount === 3) return 0.80;
  if (observedCount === 2) return 0.65;
  return 0.50;
}

// ── EXTRACT: GPT-4o-mini analyzes the conversation ───────────────────────────

const EXTRACT_SYSTEM = `
Sei un analista di conversazioni di coaching. Il tuo compito è estrarre:

1. FATTI BIOGRAFICI: informazioni concrete sull'utente menzionate nella conversazione.
   Esempi di chiavi valide:
   - "job" → lavoro attuale
   - "age" → età
   - "city" → città
   - "goal_main" → obiettivo principale dichiarato
   - "goal_secondary" → obiettivo secondario
   - "challenge_current" → sfida attuale
   - "project_current" → progetto in corso
   - "family_situation" → situazione familiare/relazionale
   - "constraint_main" → vincolo principale (tempo, denaro, energia)
   Estrai SOLO fatti esplicitamente dichiarati dall'utente. Mai inferire.

2. PATTERN COMPORTAMENTALI: schemi ricorrenti nel modo di pensare/parlare dell'utente.
   patternType validi: limiting_belief | strength | recurring_theme | emotional_trigger | growth_edge
   Estrai SOLO pattern chiaramente evidenti in questa sessione.

Rispondi SOLO con JSON valido:
{
  "facts": [
    { "key": "job", "value": "sviluppatore freelance" }
  ],
  "patterns": [
    { "patternType": "limiting_belief", "description": "Tende a posticipare decisioni importanti aspettando il momento perfetto" }
  ]
}
Se non hai abbastanza dati per estrarre qualcosa, restituisci array vuoti.
`.trim();

/**
 * Extracts facts and patterns from a completed conversation.
 * Uses gpt-4o-mini (cheap + fast) since this runs post-session.
 *
 * @param messages  The full conversation (user + assistant turns)
 * @returns         Extracted facts and patterns, or null on failure
 */
export async function extractMemory(
  messages: Array<{ role: string; content: string }>,
): Promise<ExtractedMemory | null> {
  // Only extract if there's meaningful content (at least 2 user messages)
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length < 2) return null;

  // Build a compact conversation transcript
  const transcript = messages
    .slice(-20) // last 20 messages max
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 300)}`)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user",   content: transcript },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ExtractedMemory>;

    return {
      facts:    Array.isArray(parsed.facts)    ? parsed.facts    : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    };
  } catch (err) {
    console.warn("[memory] extraction failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── MERGE: Upsert facts, increment pattern confidence ────────────────────────

/**
 * Saves extracted memory to the DB.
 * - Facts: UPSERT on (userId, key) — updates value + increments confirmedCount
 * - Patterns: match by description similarity (exact string for now),
 *   increment observedCount and recompute confidence
 */
export async function mergeMemory(
  userId: number,
  sessionId: number,
  extracted: ExtractedMemory,
): Promise<void> {
  // ── Upsert facts ──────────────────────────────────────────────────────────
  for (const fact of extracted.facts) {
    if (!fact.key?.trim() || !fact.value?.trim()) continue;

    const existing = await db
      .select()
      .from(coachMemoryFactsTable)
      .where(
        and(
          eq(coachMemoryFactsTable.userId, userId),
          eq(coachMemoryFactsTable.key, fact.key),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(coachMemoryFactsTable)
        .set({
          value: fact.value,
          confirmedCount: existing[0].confirmedCount + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(coachMemoryFactsTable.userId, userId),
            eq(coachMemoryFactsTable.key, fact.key),
          ),
        );
    } else {
      await db.insert(coachMemoryFactsTable).values({
        userId,
        key: fact.key,
        value: fact.value,
        sourceSessionId: sessionId,
        confirmedCount: 1,
      });
    }
  }

  // ── Upsert patterns ───────────────────────────────────────────────────────
  for (const pattern of extracted.patterns) {
    if (!pattern.description?.trim()) continue;

    // Match existing pattern by type + description (first 80 chars)
    const descKey = pattern.description.slice(0, 80);
    const existing = await db
      .select()
      .from(coachMemoryPatternsTable)
      .where(eq(coachMemoryPatternsTable.userId, userId));

    const match = existing.find(
      (p) =>
        p.patternType === pattern.patternType &&
        p.description.slice(0, 80) === descKey,
    );

    if (match) {
      const newCount = match.observedCount + 1;
      await db
        .update(coachMemoryPatternsTable)
        .set({
          observedCount: newCount,
          confidence: computeConfidence(newCount),
          sessionIds: [...(match.sessionIds ?? []), sessionId],
          updatedAt: new Date(),
        })
        .where(eq(coachMemoryPatternsTable.id, match.id));
    } else {
      await db.insert(coachMemoryPatternsTable).values({
        userId,
        patternType: pattern.patternType,
        description: pattern.description,
        confidence: 0.5,
        observedCount: 1,
        sessionIds: [sessionId],
      });
    }
  }
}

// ── LOAD: Read memory for prompt injection ───────────────────────────────────

/**
 * Loads all biographical facts + top behavioral patterns for a user.
 * Patterns are filtered by confidence >= 0.5 and sorted by confidence desc.
 */
export async function loadMemory(userId: number): Promise<UserMemory> {
  const [facts, patterns] = await Promise.all([
    db
      .select()
      .from(coachMemoryFactsTable)
      .where(eq(coachMemoryFactsTable.userId, userId)),
    db
      .select()
      .from(coachMemoryPatternsTable)
      .where(eq(coachMemoryPatternsTable.userId, userId)),
  ]);

  const topPatterns = patterns
    .filter((p) => p.confidence >= 0.50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8); // max 8 patterns in prompt

  return { facts, patterns: topPatterns };
}

// ── BUILD PROMPT SECTION ──────────────────────────────────────────────────────

/**
 * Serialises the user's memory into a system prompt section.
 * Only included if there's actually something to say.
 */
export function buildMemorySection(memory: UserMemory): string {
  const hasFacts    = memory.facts.length > 0;
  const hasPatterns = memory.patterns.length > 0;

  if (!hasFacts && !hasPatterns) return "";

  const lines: string[] = ["## Memoria persistente — quello che sai già di questo utente"];

  if (hasFacts) {
    lines.push("\n### Fatti biografici (dichiarati dall'utente in sessioni precedenti)");
    for (const f of memory.facts) {
      lines.push(`- **${f.key}**: ${f.value}`);
    }
  }

  if (hasPatterns) {
    lines.push("\n### Pattern comportamentali osservati (confidence ≥ 0.5)");
    for (const p of memory.patterns) {
      const confidenceLabel =
        p.confidence >= 0.80 ? "alta" :
        p.confidence >= 0.65 ? "media" : "bassa";
      lines.push(
        `- [${p.patternType}, ${confidenceLabel} confidence] ${p.description}`,
      );
    }
  }

  lines.push(
    "\nUSA questa memoria per personalizzare la risposta." ,
    "Non citare mai esplicitamente 'ricordo che mi hai detto' — incorpora naturalmente.",
  );

  return lines.join("\n");
}
