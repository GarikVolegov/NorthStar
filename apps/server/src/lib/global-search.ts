import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  db,
  sectorsTable,
  professionsTable,
  growthArticlesTable,
  newsArticlesTable,
  businessIdeasTable,
  userObjectivesTable,
  calendarEventsTable,
  certificationsTable,
  coachMemoryFactsTable,
  coachMemoryPatternsTable,
  userProfileSettingsTable,
  workspacesTable,
} from "@workspace/db";
import { generateEmbedding } from "@workspace/ai-server/embeddings/generate";
import {
  buildDiscoveryMetadata,
  type DiscoveryPersonalization,
  type DiscoveryReason,
  type DiscoverySource,
} from "./content-discovery";

export type GlobalSearchEntityType =
  | "sector"
  | "role"
  | "article"
  | "news"
  | "idea"
  | "objective"
  | "calendar"
  | "certification"
  | "memory"
  | "workspace"
  | "profile";

export interface GlobalSearchResult {
  type: GlobalSearchEntityType;
  id: number;
  entityId?: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  score_lexical: number;
  score_semantic: number | null;
  score_total: number;
  visibility?: "public" | "private";
  metadata?: Record<string, unknown>;
  source: DiscoverySource;
  sourceLabel: string;
  personalization: DiscoveryPersonalization;
  reasonLabels: string[];
  matchSignals: string[];
  actionLabel: string;
  matchScore?: number;
  reasons?: DiscoveryReason[];
  freshnessLabel?: string;
  readingTime?: number | string;
  matchedKeywords?: string[];
}

export interface GlobalSearchResponse {
  results: GlobalSearchResult[];
  has_semantic: boolean;
  searchMode: "semantic" | "hybrid" | "keyword";
  indexStatus: "ready" | "degraded" | "unavailable";
}

interface AppSearchRow extends Record<string, unknown> {
  id: number;
  entity_type: GlobalSearchEntityType;
  entity_id: string;
  user_id: number | null;
  title: string;
  content: string;
  url: string;
  visibility: "public" | "private";
  metadata: Record<string, unknown> | null;
  score_lexical: number;
  score_semantic: number | null;
  score_total: number;
}

const TYPE_META: Record<GlobalSearchEntityType, { icon: string; color: string }> = {
  sector: { icon: "layers", color: "#6366f1" },
  role: { icon: "briefcase", color: "#10b981" },
  article: { icon: "book-open-text", color: "#f59e0b" },
  news: { icon: "newspaper", color: "#8b5cf6" },
  idea: { icon: "lightbulb", color: "#eab308" },
  objective: { icon: "target", color: "#22c55e" },
  calendar: { icon: "calendar", color: "#06b6d4" },
  certification: { icon: "badge-check", color: "#3b82f6" },
  memory: { icon: "brain", color: "#a855f7" },
  workspace: { icon: "users", color: "#14b8a6" },
  profile: { icon: "user", color: "#64748b" },
};

function textIncludesScore(query: string, ...parts: Array<string | null | undefined>) {
  const q = query.toLowerCase();
  return parts.reduce((score, part, index) => {
    const text = (part ?? "").toLowerCase();
    if (!text) return score;
    if (text === q) return score + (index === 0 ? 4 : 2);
    if (text.startsWith(q)) return score + (index === 0 ? 3 : 1.5);
    if (text.includes(q)) return score + (index === 0 ? 2 : 1);
    return score;
  }, 0);
}

function normalizeLexical(score: number) {
  return Math.min(1, score / 4);
}

function result(
  input: Omit<
    GlobalSearchResult,
    | "score_lexical"
    | "score_semantic"
    | "score_total"
    | "source"
    | "sourceLabel"
    | "personalization"
    | "reasonLabels"
    | "matchSignals"
    | "actionLabel"
    | "matchScore"
    | "reasons"
    | "freshnessLabel"
    | "readingTime"
    | "matchedKeywords"
  > & {
    lexicalRaw: number;
  },
): GlobalSearchResult {
  const score_lexical = normalizeLexical(input.lexicalRaw);
  const discovery = buildDiscoveryMetadata(
    {
      title: input.title,
      description: input.description,
      url: input.url,
      type: input.type,
      visibility: input.visibility,
      metadata: input.metadata ?? {},
      scoreLexical: score_lexical,
      scoreSemantic: null,
      scoreTotal: score_lexical,
    },
    { source: "live", visibility: input.visibility },
  );
  return {
    ...input,
    score_lexical,
    score_semantic: null,
    score_total: score_lexical,
    ...discovery,
  };
}

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function liveFallbackSearch(
  query: string,
  userId: number | null,
  limit: number,
  types?: GlobalSearchEntityType[],
): Promise<GlobalSearchResult[]> {
  const pattern = `%${query}%`;
  const chunks = await Promise.all([
    types && !types.includes("sector") ? Promise.resolve([]) : safe(async () => {
      const rows = await db
        .select({
          id: sectorsTable.id,
          title: sectorsTable.name,
          description: sectorsTable.description,
          icon: sectorsTable.icon,
          color: sectorsTable.color,
        })
        .from(sectorsTable)
        .where(or(sql`${sectorsTable.name} ILIKE ${pattern}`, sql`${sectorsTable.description} ILIKE ${pattern}`))
        .limit(limit);
      return rows.map((row) =>
        result({
          type: "sector",
          id: row.id,
          entityId: String(row.id),
          title: row.title,
          description: row.description ?? "",
          url: `/settore/${row.id}`,
          icon: row.icon ?? TYPE_META.sector.icon,
          color: row.color ?? TYPE_META.sector.color,
          visibility: "public",
          lexicalRaw: textIncludesScore(query, row.title, row.description),
        }),
      );
    }),
    types && !types.includes("role") ? Promise.resolve([]) : safe(async () => {
      const rows = await db
        .select({
          id: professionsTable.id,
          title: professionsTable.title,
          description: professionsTable.description,
        })
        .from(professionsTable)
        .where(or(sql`${professionsTable.title} ILIKE ${pattern}`, sql`${professionsTable.description} ILIKE ${pattern}`))
        .limit(limit);
      return rows.map((row) =>
        result({
          type: "role",
          id: row.id,
          entityId: String(row.id),
          title: row.title,
          description: row.description ?? "",
          url: `/ruolo/${row.id}`,
          icon: TYPE_META.role.icon,
          color: TYPE_META.role.color,
          visibility: "public",
          lexicalRaw: textIncludesScore(query, row.title, row.description),
        }),
      );
    }),
    types && !types.includes("article") ? Promise.resolve([]) : safe(async () => {
      const rows = await db
        .select({
          id: growthArticlesTable.id,
          title: growthArticlesTable.title,
          description: growthArticlesTable.description,
          slug: growthArticlesTable.slug,
          content: growthArticlesTable.content,
          tags: growthArticlesTable.tags,
          personalityMatches: growthArticlesTable.personalityMatches,
          sectorLinks: growthArticlesTable.sectorLinks,
        })
        .from(growthArticlesTable)
        .where(and(
          eq(growthArticlesTable.status, "published"),
          or(
            sql`${growthArticlesTable.title} ILIKE ${pattern}`,
            sql`${growthArticlesTable.description} ILIKE ${pattern}`,
            sql`${growthArticlesTable.content} ILIKE ${pattern}`,
            sql`${growthArticlesTable.tags}::text ILIKE ${pattern}`,
            sql`${growthArticlesTable.personalityMatches}::text ILIKE ${pattern}`,
            sql`${growthArticlesTable.sectorLinks}::text ILIKE ${pattern}`,
          ),
        ))
        .limit(limit);
      return rows.map((row) =>
        result({
          type: "article",
          id: row.id,
          entityId: String(row.id),
          title: row.title,
          description: row.description ?? "",
          url: `/crescita/articolo/${row.slug}`,
          icon: TYPE_META.article.icon,
          color: TYPE_META.article.color,
          visibility: "public",
          metadata: {
            tags: row.tags ?? [],
            personalityMatches: row.personalityMatches ?? [],
            sectorLinks: row.sectorLinks ?? [],
          },
          lexicalRaw: textIncludesScore(
            query,
            row.title,
            row.description,
            row.content,
            row.tags?.join(" "),
            row.personalityMatches?.join(" "),
            row.sectorLinks?.join(" "),
          ),
        }),
      );
    }),
    types && !types.includes("news") ? Promise.resolve([]) : safe(async () => {
      const rows = await db
        .select({
          id: newsArticlesTable.id,
          title: newsArticlesTable.title,
          description: newsArticlesTable.summary,
          content: newsArticlesTable.content,
          category: newsArticlesTable.category,
          source: newsArticlesTable.source,
          sectorNames: newsArticlesTable.sectorNames,
        })
        .from(newsArticlesTable)
        .where(or(
          sql`${newsArticlesTable.title} ILIKE ${pattern}`,
          sql`${newsArticlesTable.summary} ILIKE ${pattern}`,
          sql`${newsArticlesTable.content} ILIKE ${pattern}`,
          sql`${newsArticlesTable.category} ILIKE ${pattern}`,
          sql`${newsArticlesTable.source} ILIKE ${pattern}`,
          sql`${newsArticlesTable.sectorNames}::text ILIKE ${pattern}`,
        ))
        .limit(limit);
      return rows.map((row) =>
        result({
          type: "news",
          id: row.id,
          entityId: String(row.id),
          title: row.title,
          description: row.description ?? "",
          url: `/news/${row.id}`,
          icon: TYPE_META.news.icon,
          color: TYPE_META.news.color,
          visibility: "public",
          metadata: {
            category: row.category,
            source: row.source,
            sectorLinks: row.sectorNames ?? [],
          },
          lexicalRaw: textIncludesScore(
            query,
            row.title,
            row.description,
            row.content,
            row.category,
            row.source,
            row.sectorNames?.join(" "),
          ),
        }),
      );
    }),
    userId && (!types || types.includes("idea"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: businessIdeasTable.id,
              title: businessIdeasTable.title,
              ideaText: businessIdeasTable.ideaText,
            })
            .from(businessIdeasTable)
            .where(and(eq(businessIdeasTable.userId, userId), isNull(businessIdeasTable.deletedAt), or(sql`${businessIdeasTable.title} ILIKE ${pattern}`, sql`${businessIdeasTable.ideaText} ILIKE ${pattern}`, sql`${businessIdeasTable.validationData}::text ILIKE ${pattern}`)))
            .limit(limit);
          return rows.map((row) =>
            result({
              type: "idea",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.ideaText ?? "",
              url: `/validatore-idea?ideaId=${row.id}`,
              icon: TYPE_META.idea.icon,
              color: TYPE_META.idea.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.ideaText),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("objective"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: userObjectivesTable.id,
              title: userObjectivesTable.text,
              category: userObjectivesTable.category,
            })
            .from(userObjectivesTable)
            .where(and(eq(userObjectivesTable.userId, userId), isNull(userObjectivesTable.deletedAt), or(sql`${userObjectivesTable.text} ILIKE ${pattern}`, sql`${userObjectivesTable.category} ILIKE ${pattern}`)))
            .limit(limit);
          return rows.map((row) =>
            result({
              type: "objective",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.category,
              url: "/dashboard",
              icon: TYPE_META.objective.icon,
              color: TYPE_META.objective.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.category),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("calendar"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: calendarEventsTable.id,
              title: calendarEventsTable.title,
              description: calendarEventsTable.description,
            })
            .from(calendarEventsTable)
            .where(and(eq(calendarEventsTable.userId, userId), or(sql`${calendarEventsTable.title} ILIKE ${pattern}`, sql`${calendarEventsTable.description} ILIKE ${pattern}`)))
            .limit(limit);
          return rows.map((row) =>
            result({
              type: "calendar",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.description ?? "",
              url: "/calendario",
              icon: TYPE_META.calendar.icon,
              color: TYPE_META.calendar.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.description),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("certification"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: certificationsTable.id,
              title: certificationsTable.name,
              issuer: certificationsTable.issuer,
            })
            .from(certificationsTable)
            .where(and(eq(certificationsTable.userId, userId), isNull(certificationsTable.deletedAt), or(sql`${certificationsTable.name} ILIKE ${pattern}`, sql`${certificationsTable.issuer} ILIKE ${pattern}`, sql`${certificationsTable.skills}::text ILIKE ${pattern}`)))
            .limit(limit);
          return rows.map((row) =>
            result({
              type: "certification",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.issuer,
              url: "/profilo",
              icon: TYPE_META.certification.icon,
              color: TYPE_META.certification.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.issuer),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("memory"))
      ? safe(async () => {
          const [facts, patterns] = await Promise.all([
            db
              .select({ id: coachMemoryFactsTable.id, title: coachMemoryFactsTable.key, value: coachMemoryFactsTable.value })
              .from(coachMemoryFactsTable)
              .where(and(eq(coachMemoryFactsTable.userId, userId), isNull(coachMemoryFactsTable.deletedAt), or(sql`${coachMemoryFactsTable.key} ILIKE ${pattern}`, sql`${coachMemoryFactsTable.value} ILIKE ${pattern}`)))
              .limit(limit),
            db
              .select({ id: coachMemoryPatternsTable.id, title: coachMemoryPatternsTable.patternType, value: coachMemoryPatternsTable.description })
              .from(coachMemoryPatternsTable)
              .where(and(eq(coachMemoryPatternsTable.userId, userId), isNull(coachMemoryPatternsTable.deletedAt), or(sql`${coachMemoryPatternsTable.patternType} ILIKE ${pattern}`, sql`${coachMemoryPatternsTable.description} ILIKE ${pattern}`)))
              .limit(limit),
          ]);
          return [...facts, ...patterns].map((row) =>
            result({
              type: "memory",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.value,
              url: "/wendy/memoria",
              icon: TYPE_META.memory.icon,
              color: TYPE_META.memory.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.value),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("workspace"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: workspacesTable.id,
              title: workspacesTable.name,
              description: workspacesTable.description,
            })
            .from(workspacesTable)
            .where(and(eq(workspacesTable.ownerId, userId), eq(workspacesTable.isActive, true), or(sql`${workspacesTable.name} ILIKE ${pattern}`, sql`${workspacesTable.description} ILIKE ${pattern}`)))
            .limit(limit);
          return rows.map((row) =>
            result({
              type: "workspace",
              id: row.id,
              entityId: String(row.id),
              title: row.title,
              description: row.description ?? "",
              url: "/workspace",
              icon: TYPE_META.workspace.icon,
              color: TYPE_META.workspace.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.description),
            }),
          );
        })
      : Promise.resolve([]),
    userId && (!types || types.includes("profile"))
      ? safe(async () => {
          const rows = await db
            .select({
              id: userProfileSettingsTable.userId,
              title: userProfileSettingsTable.username,
              bio: userProfileSettingsTable.bio,
              city: userProfileSettingsTable.city,
            })
            .from(userProfileSettingsTable)
            .where(and(eq(userProfileSettingsTable.userId, userId), or(sql`${userProfileSettingsTable.username} ILIKE ${pattern}`, sql`${userProfileSettingsTable.bio} ILIKE ${pattern}`, sql`${userProfileSettingsTable.city} ILIKE ${pattern}`)))
            .limit(1);
          return rows.map((row) =>
            result({
              type: "profile",
              id: row.id,
              entityId: String(row.id),
              title: row.title ?? "Profilo",
              description: [row.bio, row.city].filter(Boolean).join(" · "),
              url: "/profilo",
              icon: TYPE_META.profile.icon,
              color: TYPE_META.profile.color,
              visibility: "private",
              lexicalRaw: textIncludesScore(query, row.title, row.bio, row.city),
            }),
          );
        })
      : Promise.resolve([]),
  ]);

  return chunks
    .flat()
    .filter((item) => item.score_total > 0)
    .sort((a, b) => b.score_total - a.score_total)
    .slice(0, limit);
}

export async function globalSearch(input: {
  query: string;
  userId?: number | null;
  limit?: number;
  types?: GlobalSearchEntityType[];
}): Promise<GlobalSearchResponse> {
  const query = input.query.trim();
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const userId = input.userId ?? null;
  const types = input.types;
  const pattern = `%${query}%`;

  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(query);
  } catch {
    embedding = null;
  }

  try {
    const vectorLiteral = embedding ? `[${embedding.join(",")}]` : null;
    const typeFilter = types?.length
      ? sql`AND entity_type = ANY(${types})`
      : sql``;
    const semanticSelect = vectorLiteral
      ? sql<number>`CASE WHEN embedding IS NOT NULL THEN 1 - (embedding <=> ${vectorLiteral}::vector) ELSE NULL END`
      : sql<number | null>`NULL`;
    const semanticWhere = vectorLiteral
      ? sql`OR (embedding IS NOT NULL AND 1 - (embedding <=> ${vectorLiteral}::vector) >= 0.68)`
      : sql``;

    const rows = await db.execute<AppSearchRow>(sql`
      WITH ranked AS (
        SELECT
          id,
          entity_type,
          entity_id,
          user_id,
          title,
          content,
          url,
          visibility,
          metadata,
          CASE
            WHEN title ILIKE ${pattern} THEN 1
            WHEN content ILIKE ${pattern} THEN 0.65
            ELSE 0
          END AS score_lexical,
          ${semanticSelect} AS score_semantic
        FROM app_search_index
        WHERE (visibility = 'public' OR user_id = ${userId})
          ${typeFilter}
          AND (
            title ILIKE ${pattern}
            OR content ILIKE ${pattern}
            ${semanticWhere}
          )
      )
      SELECT
        *,
        (score_lexical + COALESCE(score_semantic, 0)) AS score_total
      FROM ranked
      ORDER BY score_total DESC, score_lexical DESC
      LIMIT ${limit}
    `);

    if (rows.rows.length > 0) {
      return {
        results: rows.rows.map((row) => {
          const meta = TYPE_META[row.entity_type] ?? TYPE_META.article;
          const score_lexical = row.score_lexical ?? 0;
          const score_semantic = row.score_semantic;
          const score_total = row.score_total ?? 0;
          const metadata = row.metadata ?? {};
          const discovery = buildDiscoveryMetadata(
            {
              title: row.title,
              description: row.content,
              url: row.url,
              type: row.entity_type,
              visibility: row.visibility,
              metadata,
              scoreLexical: score_lexical,
              scoreSemantic: score_semantic,
              scoreTotal: score_total,
              score_lexical,
              score_semantic,
              score_total,
            },
            { source: "index", visibility: row.visibility },
          );
          return {
            type: row.entity_type,
            id: Number(row.entity_id) || row.id,
            entityId: row.entity_id,
            title: row.title,
            description: row.content,
            url: row.url,
            icon: meta.icon,
            color: meta.color,
            score_lexical,
            score_semantic,
            score_total,
            visibility: row.visibility,
            metadata,
            ...discovery,
          };
        }),
        has_semantic: !!embedding && rows.rows.some((row) => row.score_semantic != null),
        searchMode: embedding ? "semantic" : "keyword",
        indexStatus: "ready",
      };
    }

    const fallback = await liveFallbackSearch(query, userId, limit, types);
    return {
      results: fallback,
      has_semantic: false,
      searchMode: fallback.length > 0 ? "hybrid" : "keyword",
      indexStatus: "degraded",
    };
  } catch {
    const fallback = await liveFallbackSearch(query, userId, limit, types);
    return {
      results: fallback,
      has_semantic: false,
      searchMode: "keyword",
      indexStatus: "unavailable",
    };
  }
}
