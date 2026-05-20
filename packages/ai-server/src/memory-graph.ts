import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  businessIdeasTable,
  calendarEventsTable,
  coachMemoryFactsTable,
  coachMemoryPatternsTable,
  db,
  knowledgeEdgesTable,
  knowledgeNodesTable,
  userObjectivesTable,
  userProfileSettingsTable,
} from "@workspace/db";
import { generateEmbedding } from "./embeddings/generate";
import { logger } from "./logger";

type MemoryNodeStatus = "candidate" | "active" | "rejected" | "archived";

export type MemoryGraphSource =
  | "business_idea"
  | "objective"
  | "calendar_event"
  | "profile"
  | "wendy_fact"
  | "wendy_pattern";

export type MemoryGraphSearchResult = {
  id: number;
  title: string;
  content: string;
  type: string;
  score: number;
  confidence: number;
  importance: number;
  sourceType: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  provenance: Record<string, unknown>;
  url: string | null;
  related: Array<{
    edgeId: number;
    nodeId: number;
    title: string;
    relationType: string;
    label: string | null;
    confidence: number;
    reason: string | null;
  }>;
};

export type MemoryGraphSearchResponse = {
  results: MemoryGraphSearchResult[];
  sources: Array<{
    id: number;
    title: string;
    sourceType: string;
    confidence: number;
    score: number;
  }>;
  searchMode: "semantic" | "keyword";
  indexStatus: "ready" | "degraded" | "unavailable";
};

type IngestCandidate = {
  type: string;
  title: string;
  content: string;
  sourceEntityType: MemoryGraphSource;
  sourceEntityId: string;
  sourceType: string;
  url?: string | null;
  importance?: number;
  confidence?: number;
  provenance?: Record<string, unknown>;
};

function compactText(value: unknown, max = 1400): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim().slice(0, max);
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

function nodeEmbeddingText(candidate: Pick<IngestCandidate, "title" | "content" | "type">): string {
  return `${candidate.type}\n${candidate.title}\n${candidate.content}`.slice(0, 6000);
}

async function upsertMemoryNode(userId: number, candidate: IngestCandidate): Promise<"created" | "updated" | "skipped"> {
  if (!candidate.title.trim() || !candidate.content.trim()) return "skipped";

  const embeddedText = nodeEmbeddingText(candidate);
  const embedding = await generateEmbedding(embeddedText).catch(() => null);

  const values = {
    userId,
    type: candidate.type.slice(0, 32),
    title: candidate.title.slice(0, 200),
    content: candidate.content,
    url: candidate.url ?? null,
    sourceType: candidate.sourceType,
    sourceEntityType: candidate.sourceEntityType,
    sourceEntityId: candidate.sourceEntityId,
    visibility: "private",
    status: "active" as MemoryNodeStatus,
    confidence: candidate.confidence ?? 0.82,
    importance: candidate.importance ?? 0.55,
    extractedBy: "memory_ingestion",
    provenance: {
      sourceEntityType: candidate.sourceEntityType,
      sourceEntityId: candidate.sourceEntityId,
      ingestedAt: new Date().toISOString(),
      ...(candidate.provenance ?? {}),
    },
    embeddedText,
    embedding,
    embeddingVec: embedding,
    lastReinforcedAt: new Date(),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: knowledgeNodesTable.id })
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        eq(knowledgeNodesTable.sourceEntityType, candidate.sourceEntityType),
        eq(knowledgeNodesTable.sourceEntityId, candidate.sourceEntityId),
      ),
    )
    .limit(1);

  if (existing) {
    await db.update(knowledgeNodesTable).set(values).where(eq(knowledgeNodesTable.id, existing.id));
    return "updated";
  }

  await db.insert(knowledgeNodesTable).values({
    ...values,
    x: Math.round(Math.random() * 480 - 240),
    y: Math.round(Math.random() * 320 - 160),
  });
  return "created";
}

export async function ingestUserMemoryGraph(userId: number): Promise<{
  ok: true;
  userId: number;
  created: number;
  updated: number;
  skipped: number;
  sources: Record<string, number>;
}> {
  const candidates: IngestCandidate[] = [];

  const [ideas, objectives, events, profile, facts, patterns] = await Promise.all([
    db
      .select()
      .from(businessIdeasTable)
      .where(and(eq(businessIdeasTable.userId, userId), isNull(businessIdeasTable.deletedAt)))
      .limit(100),
    db
      .select()
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.userId, userId), isNull(userObjectivesTable.deletedAt)))
      .limit(100),
    db
      .select()
      .from(calendarEventsTable)
      .where(eq(calendarEventsTable.userId, userId))
      .orderBy(desc(calendarEventsTable.startAt))
      .limit(100),
    db.select().from(userProfileSettingsTable).where(eq(userProfileSettingsTable.userId, userId)).limit(1),
    db
      .select()
      .from(coachMemoryFactsTable)
      .where(and(eq(coachMemoryFactsTable.userId, userId), isNull(coachMemoryFactsTable.deletedAt)))
      .limit(100),
    db
      .select()
      .from(coachMemoryPatternsTable)
      .where(and(eq(coachMemoryPatternsTable.userId, userId), isNull(coachMemoryPatternsTable.deletedAt)))
      .limit(100),
  ]);

  for (const idea of ideas) {
    candidates.push({
      type: "concept",
      title: idea.title || "Idea",
      content: compactText({
        pitch: idea.ideaText,
        status: idea.status,
        score: idea.validationScore,
        validationData: idea.validationData,
      }),
      sourceEntityType: "business_idea",
      sourceEntityId: String(idea.id),
      sourceType: "business_idea",
      url: `/validatore-idea?ideaId=${idea.id}`,
      importance: idea.status === "validated" ? 0.9 : 0.65,
      confidence: 0.9,
    });
  }

  for (const objective of objectives) {
    candidates.push({
      type: "concept",
      title: objective.text.slice(0, 120),
      content: compactText({
        text: objective.text,
        category: objective.category,
        progress: objective.progress,
        dueDate: objective.dueDate,
        completed: objective.completed,
      }),
      sourceEntityType: "objective",
      sourceEntityId: String(objective.id),
      sourceType: "objective",
      url: "/dashboard",
      importance: objective.completed ? 0.45 : 0.75,
      confidence: 0.9,
    });
  }

  for (const event of events) {
    candidates.push({
      type: "note",
      title: event.title,
      content: compactText({
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        category: event.category,
        priority: event.priority,
        status: event.status,
        tags: event.tags,
      }),
      sourceEntityType: "calendar_event",
      sourceEntityId: String(event.id),
      sourceType: "calendar",
      url: "/calendario",
      importance: event.status === "done" ? 0.35 : 0.6,
      confidence: 0.86,
    });
  }

  const profileRow = profile[0];
  if (profileRow) {
    candidates.push({
      type: "note",
      title: "Profilo e preferenze",
      content: compactText({
        bio: profileRow.bio,
        city: profileRow.city,
        userMode: profileRow.userMode,
        horizon: profileRow.horizon,
        wendyTonePreference: profileRow.wendyTonePreference,
        workPreference: profileRow.workPreference,
      }),
      sourceEntityType: "profile",
      sourceEntityId: String(userId),
      sourceType: "profile",
      url: "/profilo#impostazioni",
      importance: 0.7,
      confidence: 0.88,
    });
  }

  for (const fact of facts) {
    candidates.push({
      type: "note",
      title: `Wendy ricorda: ${fact.key}`,
      content: fact.value,
      sourceEntityType: "wendy_fact",
      sourceEntityId: String(fact.id),
      sourceType: "wendy_memory",
      url: "/memoria-wendy",
      importance: Math.min(0.95, 0.5 + fact.confirmedCount * 0.08),
      confidence: Math.min(0.95, 0.65 + fact.confirmedCount * 0.06),
    });
  }

  for (const pattern of patterns) {
    candidates.push({
      type: "concept",
      title: `Pattern Wendy: ${pattern.patternType}`,
      content: pattern.description,
      sourceEntityType: "wendy_pattern",
      sourceEntityId: String(pattern.id),
      sourceType: "wendy_memory",
      url: "/memoria-wendy",
      importance: Math.min(0.95, 0.55 + pattern.observedCount * 0.05),
      confidence: pattern.confidence,
    });
  }

  const counters = { created: 0, updated: 0, skipped: 0 };
  const sources: Record<string, number> = {};
  for (const candidate of candidates) {
    sources[candidate.sourceEntityType] = (sources[candidate.sourceEntityType] ?? 0) + 1;
    const result = await upsertMemoryNode(userId, candidate);
    counters[result] += 1;
  }

  return { ok: true, userId, ...counters, sources };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

export async function searchMemoryGraph(input: {
  userId: number;
  query: string;
  limit?: number;
  includeCandidates?: boolean;
}): Promise<MemoryGraphSearchResponse> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 12);
  const allowedStatuses = input.includeCandidates ? ["active", "candidate"] : ["active"];
  const statusSql = input.includeCandidates ? sql`AND status IN ('active', 'candidate')` : sql`AND status = 'active'`;
  const embedding = await generateEmbedding(input.query).catch(() => null);

  let rows: Array<{
    id: number;
    title: string;
    content: string;
    type: string;
    score: number;
    confidence: number;
    importance: number;
    source_type: string;
    source_entity_type: string | null;
    source_entity_id: string | null;
    provenance: Record<string, unknown>;
    url: string | null;
  }> = [];
  let searchMode: MemoryGraphSearchResponse["searchMode"] = "keyword";
  let indexStatus: MemoryGraphSearchResponse["indexStatus"] = embedding ? "ready" : "degraded";

  if (embedding) {
    try {
      const vectorLiteral = `[${embedding.join(",")}]`;
      const result = await db.execute<typeof rows[number]>(sql`
        SELECT
          id,
          title,
          content,
          type,
          confidence,
          importance,
          source_type,
          source_entity_type,
          source_entity_id,
          provenance,
          url,
          (
            1 - (embedding_vec <=> ${vectorLiteral}::vector)
            + (confidence * 0.08)
            + (importance * 0.08)
          ) AS score
        FROM knowledge_nodes
        WHERE user_id = ${input.userId}
          ${statusSql}
          AND embedding_vec IS NOT NULL
        ORDER BY embedding_vec <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `);
      rows = result.rows;
      searchMode = "semantic";
    } catch (err) {
      logger.warn({ err, userId: input.userId }, "[memory-graph] pgvector search failed, using keyword fallback");
      indexStatus = "degraded";
    }
  }

  if (rows.length === 0) {
    const pattern = `%${input.query}%`;
    const fallback = await db
      .select({
        id: knowledgeNodesTable.id,
        title: knowledgeNodesTable.title,
        content: knowledgeNodesTable.content,
        type: knowledgeNodesTable.type,
        embedding: knowledgeNodesTable.embedding,
        confidence: knowledgeNodesTable.confidence,
        importance: knowledgeNodesTable.importance,
        sourceType: knowledgeNodesTable.sourceType,
        sourceEntityType: knowledgeNodesTable.sourceEntityType,
        sourceEntityId: knowledgeNodesTable.sourceEntityId,
        provenance: knowledgeNodesTable.provenance,
        url: knowledgeNodesTable.url,
      })
      .from(knowledgeNodesTable)
      .where(
        and(
          eq(knowledgeNodesTable.userId, input.userId),
          inArray(knowledgeNodesTable.status, allowedStatuses),
          or(ilike(knowledgeNodesTable.title, pattern), ilike(knowledgeNodesTable.content, pattern)),
        ),
      )
      .limit(limit * 2);

    rows = fallback
      .map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type,
        score: embedding && Array.isArray(row.embedding) ? cosine(embedding, row.embedding) : 0.5,
        confidence: row.confidence,
        importance: row.importance,
        source_type: row.sourceType,
        source_entity_type: row.sourceEntityType,
        source_entity_id: row.sourceEntityId,
        provenance: row.provenance,
        url: row.url,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  if (rows.length === 0) {
    return { results: [], sources: [], searchMode, indexStatus: embedding ? indexStatus : "unavailable" };
  }

  const nodeIds = rows.map((row) => row.id);
  const edges = await db
    .select({
      id: knowledgeEdgesTable.id,
      sourceId: knowledgeEdgesTable.sourceId,
      targetId: knowledgeEdgesTable.targetId,
      label: knowledgeEdgesTable.label,
      relationType: knowledgeEdgesTable.relationType,
      confidence: knowledgeEdgesTable.confidence,
      reason: knowledgeEdgesTable.reason,
      status: knowledgeEdgesTable.status,
    })
    .from(knowledgeEdgesTable)
    .where(
      and(
        eq(knowledgeEdgesTable.userId, input.userId),
        inArray(knowledgeEdgesTable.status, allowedStatuses),
        or(inArray(knowledgeEdgesTable.sourceId, nodeIds), inArray(knowledgeEdgesTable.targetId, nodeIds)),
      ),
    )
    .limit(80);

  const relatedIds = Array.from(new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]).filter((id) => !nodeIds.includes(id))));
  const relatedNodes = relatedIds.length
    ? await db
        .select({ id: knowledgeNodesTable.id, title: knowledgeNodesTable.title })
        .from(knowledgeNodesTable)
        .where(and(eq(knowledgeNodesTable.userId, input.userId), inArray(knowledgeNodesTable.id, relatedIds)))
    : [];
  const relatedById = new Map(relatedNodes.map((node) => [node.id, node]));

  const results = rows.map((row) => {
    const related = edges
      .filter((edge) => edge.sourceId === row.id || edge.targetId === row.id)
      .map((edge) => {
        const nodeId = edge.sourceId === row.id ? edge.targetId : edge.sourceId;
        return {
          edgeId: edge.id,
          nodeId,
          title: relatedById.get(nodeId)?.title ?? rows.find((candidate) => candidate.id === nodeId)?.title ?? "Nodo collegato",
          relationType: edge.relationType,
          label: edge.label,
          confidence: edge.confidence,
          reason: edge.reason,
        };
      })
      .slice(0, 6);

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      score: Math.round(Number(row.score) * 1000) / 1000,
      confidence: row.confidence,
      importance: row.importance,
      sourceType: row.source_type,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      provenance: row.provenance ?? {},
      url: row.url,
      related,
    };
  });

  return {
    results,
    sources: results.map((result) => ({
      id: result.id,
      title: result.title,
      sourceType: result.sourceType,
      confidence: result.confidence,
      score: result.score,
    })),
    searchMode,
    indexStatus,
  };
}

export async function getMemoryGraphHealth(userId?: number): Promise<{
  nodes: number;
  edges: number;
  candidates: number;
  lowConfidenceEdges: number;
  staleEmbeddings: number;
  orphanNodes: number;
}> {
  const userFilter = userId ? sql`WHERE user_id = ${userId}` : sql``;
  const [nodes, edges, candidates, lowConfidenceEdges, staleEmbeddings, orphanNodes] = await Promise.all([
    db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM knowledge_nodes ${userFilter}`),
    db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM knowledge_edges ${userFilter}`),
    db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM knowledge_edges WHERE status = 'candidate' ${userId ? sql`AND user_id = ${userId}` : sql``}`),
    db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM knowledge_edges WHERE confidence < 0.55 ${userId ? sql`AND user_id = ${userId}` : sql``}`),
    db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM knowledge_nodes WHERE embedding_vec IS NULL ${userId ? sql`AND user_id = ${userId}` : sql``}`),
    db.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count
      FROM knowledge_nodes n
      WHERE NOT EXISTS (
        SELECT 1 FROM knowledge_edges e
        WHERE e.user_id = n.user_id
          AND (e.source_id = n.id OR e.target_id = n.id)
      )
      ${userId ? sql`AND n.user_id = ${userId}` : sql``}
    `),
  ]);

  return {
    nodes: Number(nodes.rows[0]?.count ?? 0),
    edges: Number(edges.rows[0]?.count ?? 0),
    candidates: Number(candidates.rows[0]?.count ?? 0),
    lowConfidenceEdges: Number(lowConfidenceEdges.rows[0]?.count ?? 0),
    staleEmbeddings: Number(staleEmbeddings.rows[0]?.count ?? 0),
    orphanNodes: Number(orphanNodes.rows[0]?.count ?? 0),
  };
}
