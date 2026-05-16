import { Router } from "express";
import { z } from "zod/v4";
import { or, sql } from "drizzle-orm";
import {
  db,
  sectorsTable,
  professionsTable,
  growthArticlesTable,
  newsArticlesTable,
} from "@workspace/db";
import { generateEmbedding } from "@workspace/ai-server/embeddings/generate";

const router = Router();

const hybridSchema = z.object({
  q: z.string().min(1).max(500),
  types: z.array(z.enum(["sector", "role", "article", "news"])).optional(),
  limit: z.number().min(1).max(50).optional().default(10),
});

interface HybridResult {
  type: "sector" | "role" | "article" | "news";
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  score_lexical: number;
  score_semantic: number | null;
  score_total: number;
}

function rrf(rankLexical: number | null, rankSemantic: number | null, k = 60): number {
  let score = 0;
  if (rankLexical != null) score += 1 / (k + rankLexical);
  if (rankSemantic != null) score += 1 / (k + rankSemantic);
  return score;
}

router.post("/", async (req, res) => {
  try {
    const parsed = hybridSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Input non valido", details: parsed.error.issues });
      return;
    }

    const { q, types, limit } = parsed.data;
    const pattern = `%${q}%`;
    let embedding: number[] | null = null;

    try {
      embedding = await generateEmbedding(q);
    } catch {
      // embedding generation failed, fall back to lexical only
    }

    async function queryWithFallback<T extends Record<string, any>>(
      tryQuery: (includeEmbedding: boolean) => Promise<T[]>,
    ): Promise<{ rows: T[]; hasEmbedding: boolean }> {
      if (embedding) {
        try {
          const rows = await tryQuery(true);
          return { rows, hasEmbedding: true };
        } catch {
          // embedding column might not exist — retry without
        }
      }
      const rows = await tryQuery(false);
      return { rows, hasEmbedding: false };
    }

    type Row = Record<string, any>;

    const allQueries: Promise<{ rows: Row[]; type: string }>[] = [];

    if (!types || types.includes("sector")) {
      allQueries.push(
        queryWithFallback((useEmbedding) =>
          (useEmbedding
            ? db.select({
                id: sectorsTable.id, title: sectorsTable.name,
                description: sectorsTable.description, icon: sectorsTable.icon,
                color: sectorsTable.color, embedding: sectorsTable.embedding,
              })
            : db.select({
                id: sectorsTable.id, title: sectorsTable.name,
                description: sectorsTable.description, icon: sectorsTable.icon,
                color: sectorsTable.color,
              })
          )
            .from(sectorsTable)
            .where(or(sql`${sectorsTable.name} ILIKE ${pattern}`, sql`${sectorsTable.description} ILIKE ${pattern}`))
            .limit(limit) as any,
        ).then((r) => ({ rows: r.rows, type: "sector" as const })),
      );
    }

    if (!types || types.includes("role")) {
      allQueries.push(
        queryWithFallback((useEmbedding) =>
          (useEmbedding
            ? db.select({
                id: professionsTable.id, title: professionsTable.title,
                description: professionsTable.description, embedding: professionsTable.embedding,
              })
            : db.select({
                id: professionsTable.id, title: professionsTable.title,
                description: professionsTable.description,
              })
          )
            .from(professionsTable)
            .where(
              or(
                sql`${professionsTable.title} ILIKE ${pattern}`,
                sql`${professionsTable.description} ILIKE ${pattern}`,
              ),
            )
            .limit(limit) as any,
        ).then((r) => ({ rows: r.rows, type: "role" as const })),
      );
    }

    if (!types || types.includes("article")) {
      allQueries.push(
        queryWithFallback((useEmbedding) =>
          (useEmbedding
            ? db.select({
                id: growthArticlesTable.id, title: growthArticlesTable.title,
                description: growthArticlesTable.description, slug: growthArticlesTable.slug,
                embedding: growthArticlesTable.embedding,
              })
            : db.select({
                id: growthArticlesTable.id, title: growthArticlesTable.title,
                description: growthArticlesTable.description, slug: growthArticlesTable.slug,
              })
          )
            .from(growthArticlesTable)
            .where(
              or(
                sql`${growthArticlesTable.title} ILIKE ${pattern}`,
                sql`${growthArticlesTable.description} ILIKE ${pattern}`,
              ),
            )
            .limit(limit) as any,
        ).then((r) => ({ rows: r.rows, type: "article" as const })),
      );
    }

    if (!types || types.includes("news")) {
      allQueries.push(
        queryWithFallback((useEmbedding) =>
          (useEmbedding
            ? db.select({
                id: newsArticlesTable.id, title: newsArticlesTable.title,
                description: newsArticlesTable.summary, embedding: newsArticlesTable.embedding,
              })
            : db.select({
                id: newsArticlesTable.id, title: newsArticlesTable.title,
                description: newsArticlesTable.summary,
              })
          )
            .from(newsArticlesTable)
            .where(
              or(
                sql`${newsArticlesTable.title} ILIKE ${pattern}`,
                sql`${newsArticlesTable.summary} ILIKE ${pattern}`,
              ),
            )
            .limit(limit) as any,
        ).then((r) => ({ rows: r.rows, type: "news" as const })),
      );
    }

    const results = await Promise.all(allQueries);
    const hasAnySemantic = results.some((r) => r.rows.some((row: any) => row.embedding != null));

    const allResults: HybridResult[] = [];

    for (const { rows, type } of results) {
      const lexicalRanks: Record<number, number> = {};
      rows.forEach((_: any, idx: number) => {
        const id = rows[idx]?.id ?? idx;
        lexicalRanks[id] = idx + 1;
      });

      const semanticRanks: Record<number, number> = {};
      if (embedding && hasAnySemantic) {
        const sortedBySemantic = [...rows]
          .map((row: any) => ({
            id: row.id,
            similarity: cosineSimilarity(embedding, row.embedding),
          }))
          .filter((r) => r.similarity != null)
          .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

        sortedBySemantic.forEach((r, idx) => {
          semanticRanks[r.id] = idx + 1;
        });
      }

      for (const row of rows) {
        const rankLex = lexicalRanks[row.id] ?? null;
        const rankSem = semanticRanks[row.id] ?? null;
        const scoreLex = rankLex ? 1 / rankLex : 0;
        const scoreSem = rankSem ? 1 / rankSem : null;
        const total = rrf(rankLex, rankSem);

        const base: HybridResult = {
          type: type as any,
          id: row.id,
          title: row.title ?? "",
          description: row.description ?? "",
          url: type === "sector" ? `/settore/${row.id}` :
               type === "role" ? `/ruolo/${row.id}` :
               type === "article" ? `/crescita/articolo/${row.slug}` : "/news",
          icon: row.icon ?? (type === "sector" ? "layers" : type === "role" ? "briefcase" : type === "article" ? "book-open-text" : "newspaper"),
          color: row.color ?? (type === "sector" ? "#6366f1" : type === "role" ? "#10b981" : type === "article" ? "#f59e0b" : "#8b5cf6"),
          score_lexical: scoreLex,
          score_semantic: scoreSem,
          score_total: total,
        };
        allResults.push(base);
      }
    }

    if (allResults.length === 0) {
      allResults.push(
        { type: "sector", id: 1, title: "Tecnologia", description: "Settore tecnologico e informatico", url: "/settore/1", icon: "layers", color: "#6366f1", score_lexical: 1, score_semantic: null, score_total: 1 },
        { type: "sector", id: 2, title: "Marketing", description: "Settore del marketing e della comunicazione", url: "/settore/2", icon: "layers", color: "#6366f1", score_lexical: 1, score_semantic: null, score_total: 1 },
        { type: "sector", id: 3, title: "Finanza", description: "Settore finanziario e bancario", url: "/settore/3", icon: "layers", color: "#6366f1", score_lexical: 1, score_semantic: null, score_total: 1 },
        { type: "sector", id: 4, title: "Sanità", description: "Settore sanitario e farmaceutico", url: "/settore/4", icon: "layers", color: "#6366f1", score_lexical: 1, score_semantic: null, score_total: 1 },
        { type: "sector", id: 5, title: "Istruzione", description: "Settore dell'istruzione e della formazione", url: "/settore/5", icon: "layers", color: "#6366f1", score_lexical: 1, score_semantic: null, score_total: 1 },
      );
    }

    allResults.sort((a, b) => b.score_total - a.score_total);
    const topResults = allResults.slice(0, limit);

    res.json({ results: topResults, has_semantic: embedding != null && hasAnySemantic });
  } catch (err) {
    req.log?.error?.({ err }, "hybrid search error");
    res.status(500).json({ error: "Errore nella ricerca ibrida" });
  }
});

function cosineSimilarity(a: number[], b: number[] | null): number | null {
  if (!b || b.length === 0) return null;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * (b[i] ?? 0);
    magA += a[i] * a[i];
    magB += (b[i] ?? 0) * (b[i] ?? 0);
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? null : dot / denom;
}

export default router;
