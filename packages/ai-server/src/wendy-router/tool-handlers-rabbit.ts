import { logger } from "../logger";
import { err, type ToolResult } from "./tool-handlers";
import { retrieve } from "../growth-agent/retriever";

import { CARE_GUIDE_DATA, FOOD_SAFETY_DATA, BREED_ALIASES, BREED_DATA } from "./rabbit-knowledge-data";

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleGetRabbitCareGuide(
  args: { topic: string; rabbitAge?: string; breed?: string },
): Promise<ToolResult> {
  const topicKey = args.topic?.toLowerCase().trim();
  const guide = CARE_GUIDE_DATA[topicKey];
  if (!guide) {
    return err(
      "NOT_FOUND",
      `Argomento '${args.topic}' non riconosciuto. Temi disponibili: housing, feeding, socialization, health, enrichment, grooming`,
    );
  }
  return { ok: true, data: { ...guide, requestedAge: args.rabbitAge, requestedBreed: args.breed } };
}

export async function handleCheckFoodSafety(
  args: { foodName: string; quantity?: string },
): Promise<ToolResult> {
  const raw = args.foodName ?? "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  const entry = FOOD_SAFETY_DATA[normalized] ?? FOOD_SAFETY_DATA[normalized.replace(/i$/, "o")] ?? FOOD_SAFETY_DATA[normalized.replace(/e$/, "a")];

  if (!entry) {
    return {
      ok: true,
      data: {
        foodName: args.foodName,
        safety: "unknown",
        reason: "Alimento non presente nel database. Non somministrare prima di consultare un veterinario esperto in lagomorfi.",
      },
    };
  }

  return { ok: true, data: { ...entry, quantityAsked: args.quantity } };
}

export async function handleGetBreedInfo(
  args: { breedName: string },
): Promise<ToolResult> {
  const raw = args.breedName ?? "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  const resolvedKey = BREED_ALIASES[normalized] ?? normalized.replace(/\s+/g, "_");
  const breed = BREED_DATA[resolvedKey] ?? BREED_DATA[normalized];

  if (!breed) {
    const available = Object.values(BREED_DATA).map((b) => b.breedName).join(", ");
    return err(
      "NOT_FOUND",
      `Razza '${args.breedName}' non trovata nel database. Razze disponibili: ${available}`,
    );
  }

  return { ok: true, data: breed };
}

export async function handleSearchRabbitKb(
  args: { query: string; topK?: number },
  userId: number,
): Promise<ToolResult> {
  const topK = Math.min(args.topK ?? 4, 8);
  try {
    const chunks = await retrieve(args.query, userId, {
      topK,
      minScore: 0.3,
      sourceTypes: ["rabbit_kb"],
    });

    return {
      ok: true,
      data: {
        chunks: chunks.map((c) => ({
          content: c.content,
          source: c.source,
          score: c.score,
        })),
        totalFound: chunks.length,
        query: args.query,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_rabbit_kb error");
    return { ok: true, data: { chunks: [], totalFound: 0, query: args.query } };
  }
}
