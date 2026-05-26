/**
 * Memory Search — semantic retrieval over a user's biographical facts and
 * behavioral patterns using cosine similarity on in-process embeddings.
 *
 * Used by prompt-builder to inject only contextually relevant memory instead
 * of dumping the entire memory into every system prompt.
 *
 * Implementation: embeds the query, then scores all facts + patterns for the
 * user with cosine similarity and returns the top-K results above minScore.
 *
 * Future: when coach_memory_facts / coach_memory_patterns gain a pgvector
 * VECTOR(1536) column, replace the JS loop with a single SQL query for O(log n).
 */
import { loadMemory } from "./memory-manager";
import { embedText } from "./embedder";
import { logger } from "../logger";
import type { CoachMemoryFact, CoachMemoryPattern } from "@workspace/db";

export type MemoryHitType = "fact" | "pattern";

export interface MemoryHit {
  type:        MemoryHitType;
  id:          number;
  text:        string;   // key: value  OR  [patternType] description
  score:       number;   // 0–1 cosine similarity
  fact?:       CoachMemoryFact;
  pattern?:    CoachMemoryPattern;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na  += av * av;
    nb  += bv * bv;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

async function embeddingFor(text: string, stored?: number[] | null): Promise<number[]> {
  return stored && stored.length > 0 ? stored : embedText(text);
}

/**
 * Returns the top-K memory items most relevant to `query` for `userId`.
 *
 * @param userId   The user whose memory to search
 * @param query    The current user message or intent summary
 * @param topK     Max results (default 5)
 * @param minScore Minimum cosine score to include (default 0.30)
 */
export async function searchMemory(
  userId: number,
  query: string,
  topK = 5,
  minScore = 0.30,
): Promise<MemoryHit[]> {
  try {
    const [queryEmb, { facts, patterns }] = await Promise.all([
      embedText(query),
      loadMemory(userId),
    ]);

    if (facts.length === 0 && patterns.length === 0) return [];

    const hits: MemoryHit[] = [];

    // Score facts
    for (const f of facts) {
      const text = `${f.key}: ${f.value}`;
      const emb  = await embeddingFor(text, f.embedding);
      const score = cosine(queryEmb, emb);
      if (score >= minScore) {
        hits.push({ type: "fact", id: f.id, text, score, fact: f });
      }
    }

    // Score patterns (patterns already filtered by effective_confidence in loadMemory)
    for (const p of patterns) {
      const text  = `[${p.patternType}] ${p.description}`;
      const emb   = await embeddingFor(text, p.embedding);
      const score = cosine(queryEmb, emb);
      if (score >= minScore) {
        hits.push({ type: "pattern", id: p.id, text, score, pattern: p });
      }
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

  } catch (err) {
    logger.warn({ err, userId }, "[memory-search] failed — returning empty");
    return [];
  }
}

/**
 * Formats memory hits into a compact system-prompt section.
 * Returns empty string when there are no hits.
 */
export function buildContextualMemorySection(hits: MemoryHit[]): string {
  if (hits.length === 0) return "";

  const lines = ["## Memoria contestuale (rilevante per questo messaggio)"];

  const factHits    = hits.filter((h) => h.type === "fact");
  const patternHits = hits.filter((h) => h.type === "pattern");

  if (factHits.length > 0) {
    lines.push("\n### Fatti rilevanti");
    for (const h of factHits) {
      lines.push(`- ${h.text}`);
    }
  }

  if (patternHits.length > 0) {
    lines.push("\n### Pattern comportamentali rilevanti");
    for (const h of patternHits) {
      const conf = h.pattern?.confidence ?? 0;
      const label = conf >= 0.80 ? "alta" : conf >= 0.65 ? "media" : "bassa";
      lines.push(`- ${h.text} (confidence: ${label})`);
    }
  }

  lines.push(
    "\nCita 1-2 di questi elementi solo se aggiungono valore alla risposta — non forzare la citazione.",
  );

  return lines.join("\n");
}
