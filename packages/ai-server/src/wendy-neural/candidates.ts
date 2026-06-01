import { buildContextualMemorySection, searchMemory } from "../growth-agent/memory-search";
import { buildWendyBrainContextSection, searchWendyBrain } from "../wendy-brain";
import { handleSearchBrain } from "../wendy-router/tool-handlers-market";
import { getToolsForIntent } from "../wendy-router/tool-registry";
import type { WendyIntent, WendyPageContext } from "../wendy-router/types";
import { clamp01 } from "../utils";
import { DEFAULT_COMPONENTS, type ActivationCandidate, type WendyIntentLike } from "./types";

function safeRef(kind: string, ref: string): string {
  return `${kind}:${ref}`.slice(0, 500);
}

export function dedupeCandidates(candidates: ActivationCandidate[]): ActivationCandidate[] {
  const seen = new Set<string>();
  const result: ActivationCandidate[] = [];
  for (const candidate of candidates) {
    const key = safeRef(candidate.itemKind, candidate.itemRef);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export function buildToolCandidates(intent: WendyIntentLike, message: string): ActivationCandidate[] {
  if (!["navigation", "simple_qa", "conversation", "planning", "deep_analysis"].includes(intent)) {
    return [];
  }
  const q = message.toLowerCase();
  const internalQuestion = /\b(northstar|wendy|pipeline|architett|prodotto|process|gsd|cervello|brain|search_brain|codice)\b/.test(q);
  const marketQuestion = /\b(mercato|lavoro|trend|ruol|profession|salari|stipendi|annunci|skill richieste|job)\b/.test(q);
  return getToolsForIntent(intent as WendyIntent).map((tool) => ({
    itemKind: "tool" as const,
    itemRef: `tool:${tool.name}`,
    label: tool.name,
    components: {
      ...DEFAULT_COMPONENTS,
      semantic: tool.name === "search_rag" && marketQuestion && !internalQuestion ? 0.75 : 0.5,
      userRelevance: 0.7,
      graphProximity:
        tool.name === "search_brain" && internalQuestion ? 0.55 :
        tool.name === "search_rag" && marketQuestion && !internalQuestion ? 0.55 :
        tool.name === "search_brain" && marketQuestion ? 0.2 :
        0.35,
      salience:
        tool.name === "search_brain" && internalQuestion ? 0.8 :
        tool.name === "search_rag" && marketQuestion && !internalQuestion ? 0.9 :
        tool.name === "search_brain" && marketQuestion ? 0.35 :
        tool.name === "search_brain" ? 0.65 :
        0.55,
      trust: 0.85,
    },
    metadata: { description: tool.description },
    content: tool.description,
  }));
}

export async function buildBrainCandidates(message: string): Promise<ActivationCandidate[]> {
  const result = await handleSearchBrain({ query: message, limit: 4 });
  if (!result.ok) return [];
  const rawChunks = (result.data as { chunks?: Array<{
    obsidianPath?: string;
    content?: string;
    similarity?: number;
    trustScore?: number;
    sectors?: string[];
    roles?: string[];
  }> }).chunks;
  const chunks = Array.isArray(rawChunks) ? rawChunks : [];
  return chunks.map((chunk) => ({
    itemKind: "brain_note" as const,
    itemRef: chunk.obsidianPath || chunk.content?.slice(0, 120) || "brain:unknown",
    label: chunk.obsidianPath || "Brain note",
    content: chunk.content,
    components: {
      ...DEFAULT_COMPONENTS,
      semantic: clamp01(chunk.similarity, 0.5),
      graphProximity: 0.7,
      salience: 0.65,
      trust: clamp01(chunk.trustScore, 0.8),
    },
    metadata: {
      sectors: chunk.sectors ?? [],
      roles: chunk.roles ?? [],
      obsidianPath: chunk.obsidianPath ?? "",
    },
  }));
}

export async function buildWendyBrainCandidates(message: string): Promise<{
  candidates: ActivationCandidate[];
  section: string;
}> {
  const hits = await searchWendyBrain(message, { limit: 5, includeCandidates: false });
  return {
    section: buildWendyBrainContextSection(hits),
    candidates: hits.map((hit) => ({
      itemKind: "wendy_brain_node" as const,
      itemRef: `wendy_brain:${hit.id}`,
      label: hit.title,
      content: hit.content,
      components: {
        ...DEFAULT_COMPONENTS,
        semantic: clamp01(hit.score, 0.5),
        userRelevance: 0.4,
        salience: clamp01(hit.importance, 0.5),
        trust: clamp01(hit.confidence, 0.7),
      },
      metadata: { type: hit.type, sourceType: hit.sourceType, sourceRef: hit.sourceRef },
    })),
  };
}

export async function buildMemoryCandidates(userId: number, message: string): Promise<{
  candidates: ActivationCandidate[];
  section: string;
}> {
  const hits = userId > 0 ? await searchMemory(userId, message, 5) : [];
  return {
    section: buildContextualMemorySection(hits),
    candidates: hits.map((hit: { id?: number; title?: string; content?: string; score?: number; type?: string }) => ({
      itemKind: "personal_memory" as const,
      itemRef: `memory:${hit.id ?? hit.title ?? hit.content?.slice(0, 80) ?? "unknown"}`,
      label: hit.title ?? hit.type ?? "Memoria personale",
      content: hit.content,
      components: {
        ...DEFAULT_COMPONENTS,
        semantic: clamp01(hit.score, 0.45),
        userRelevance: 0.9,
        recency: 0.45,
        salience: 0.55,
        trust: 0.75,
      },
      metadata: { type: hit.type ?? "memory" },
    })),
  };
}

export function buildPageContextCandidate(pageContext?: WendyPageContext): ActivationCandidate[] {
  if (!pageContext) return [];
  return [{
    itemKind: "page_context",
    itemRef: `page:${pageContext.page}`,
    label: `Pagina corrente: ${pageContext.page}`,
    components: {
      ...DEFAULT_COMPONENTS,
      userRelevance: 0.85,
      recency: 1,
      salience: 0.55,
      trust: 0.65,
    },
    metadata: {
      page: pageContext.page,
      entityType: pageContext.entityType,
      entityId: pageContext.entityId,
      entityName: pageContext.entityName,
      journeyType: pageContext.journeyType,
    },
  }];
}
