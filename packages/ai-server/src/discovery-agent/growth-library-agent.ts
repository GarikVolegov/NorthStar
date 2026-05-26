import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, discoveryItemsTable, growthArticlesTable } from "@workspace/db";
import type { NewGrowthArticle } from "@workspace/db";
import { logger } from "../logger";
import { embedText } from "../growth-agent/embedder";
import { retrieve } from "../growth-agent/retriever";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";
import { supervisorAgent } from "../growth-agent/supervisor-agent";

export const GROWTH_CATEGORIES = [
  "mindset",
  "produttivita",
  "carriera",
  "finanza",
  "salute",
  "relazioni",
  "apprendimento",
] as const;

export type GrowthLibraryCategory = (typeof GROWTH_CATEGORIES)[number];

const MIN_RELEVANCE = 0.60;
const MIN_RECENT_ARTICLES = 3;
const MAX_CURATED_PER_RUN = 10;
const MAX_ORIGINALS_PER_RUN = 2;

const SUGGESTED_TOPICS: Record<GrowthLibraryCategory, string> = {
  mindset: "come trasformare un blocco mentale in una decisione operativa",
  produttivita: "come proteggere focus ed energia in una settimana piena",
  carriera: "come scegliere la prossima mossa professionale con criteri chiari",
  finanza: "come costruire una routine finanziaria semplice e sostenibile",
  salute: "come riconoscere e ridurre i segnali di burnout lavorativo",
  relazioni: "come chiedere feedback e creare alleanze professionali sane",
  apprendimento: "come progettare un piano di studio che regge nel tempo",
};

export interface GrowthDiscoveryInput {
  title: string;
  urlHash: string;
  category: string | null;
  summary: string | null;
  insightText: string | null;
  difficulty: string | null;
  skillTags: string[] | null;
}

export interface GrowthGap {
  category: GrowthLibraryCategory;
  recentCount: number;
  suggestedTopic: string;
}

interface ArticleAgeInput {
  category: string;
  createdAt: Date;
}

function cleanText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadTimeMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 220));
}

export function normalizeGrowthCategory(
  category: string | null | undefined,
  tags: string[] | null | undefined,
): GrowthLibraryCategory {
  const haystack = `${category ?? ""} ${(tags ?? []).join(" ")}`.toLowerCase();
  if (/finance|finanza|money|budget|invest|risparm/.test(haystack)) return "finanza";
  if (/career|carriera|job|lavoro|colloquio|cv|salary/.test(haystack)) return "carriera";
  if (/health|salute|stress|sleep|sonno|burnout|energia/.test(haystack)) return "salute";
  if (/relation|relaz|network|feedback|leadership|team/.test(haystack)) return "relazioni";
  if (/learn|apprend|study|studio|formazione|course|skill/.test(haystack)) return "apprendimento";
  if (/product|produtt|habit|abitud|focus|time|routine/.test(haystack)) return "produttivita";
  return "mindset";
}

export function buildCuratedGrowthArticle(input: GrowthDiscoveryInput): NewGrowthArticle {
  const summary = cleanText(input.summary) || cleanText(input.title);
  const insight = cleanText(input.insightText) || "Questo contenuto offre uno spunto pratico per trasformare crescita personale e professionale in una scelta concreta.";
  const category = normalizeGrowthCategory(input.category, input.skillTags);
  const content = [
    "### Perche conta",
    insight,
    "",
    "### Idea principale",
    summary,
    "",
    "### Come usarlo",
    "Scegli un punto che puoi applicare questa settimana, traducilo in una piccola azione osservabile e verifica dopo sette giorni se ha prodotto piu chiarezza, energia o avanzamento.",
  ].join("\n");

  return {
    title: cleanText(input.title).slice(0, 500),
    slug: `curated-${input.urlHash.slice(0, 16)}`,
    category,
    description: summary.slice(0, 260),
    content,
    tags: input.skillTags ?? [],
    difficulty: input.difficulty ?? "base",
    personalityMatches: [],
    sectorLinks: [],
    status: "published",
    readTimeMinutes: estimateReadTimeMinutes(content),
  };
}

export function analyzeGrowthLibraryGaps(
  articles: ArticleAgeInput[],
  now = new Date(),
): GrowthGap[] {
  const cutoff = now.getTime() - 30 * 86_400_000;
  const counts = new Map<GrowthLibraryCategory, number>();
  for (const category of GROWTH_CATEGORIES) counts.set(category, 0);

  for (const article of articles) {
    if (article.createdAt.getTime() < cutoff) continue;
    const category = normalizeGrowthCategory(article.category, []);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return GROWTH_CATEGORIES
    .map((category) => ({
      category,
      recentCount: counts.get(category) ?? 0,
      suggestedTopic: SUGGESTED_TOPICS[category],
    }))
    .filter((gap) => gap.recentCount < MIN_RECENT_ARTICLES)
    .sort((a, b) => a.recentCount - b.recentCount);
}

function canGenerateOriginals(): boolean {
  if (process.env.GROWTH_LIBRARY_GENERATE_ORIGINALS === "false") return false;
  if (process.env.AI_PROVIDER === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  if (process.env.AI_PROVIDER === "groq") return Boolean(process.env.GROQ_API_KEY ?? process.env.AI_INTEGRATIONS_GROQ_API_KEY);
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

async function maybeEmbedArticle(article: NewGrowthArticle): Promise<NewGrowthArticle> {
  try {
    return {
      ...article,
      embedding: await embedText(`${article.title}\n${article.description}\n${article.content}`),
    };
  } catch (err) {
    logger.warn({ err, title: article.title }, "[growth-library] embedding failed, storing article without vector");
    return article;
  }
}

async function generateOriginalArticle(gap: GrowthGap): Promise<NewGrowthArticle | null> {
  if (!canGenerateOriginals()) return null;

  try {
    const grounding = await retrieve(gap.suggestedTopic, 0, {
      topK: 4,
      minScore: 0.50,
      sourceTypes: ["platform_content"],
    }).catch(() => []);
    const route = selectModelFor("discovery-enrich");
    const llm = getLLMForRoute(route);
    const raw = await llm.chatOnce([
      {
        role: "system",
        content: [
          "Sei un editor di crescita personale per professionisti italiani.",
          "Genera solo JSON valido con title, description, content, tags.",
          "content deve essere markdown in italiano con intro, 3 sezioni e conclusione con CTA.",
          "Non inventare fonti o statistiche non presenti nel grounding.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          category: gap.category,
          topic: gap.suggestedTopic,
          grounding: grounding.map((hit) => hit.content).join("\n\n").slice(0, 4_000),
        }),
      },
    ], {
      model: route.model,
      temperature: 0.55,
      maxTokens: 1_400,
    });

    const parsed = JSON.parse(raw) as Partial<{ title: string; description: string; content: string; tags: string[] }>;
    const title = cleanText(parsed.title);
    const description = cleanText(parsed.description);
    const content = String(parsed.content ?? "").trim();
    if (!title || !description || content.split(/\s+/).length < 350) return null;

    const quality = await supervisorAgent.evaluate({
      userMessage: gap.suggestedTopic,
      draft: content,
      domain: gap.category === "carriera" ? "career" : gap.category === "salute" ? "health" : gap.category === "finanza" ? "finance" : "mindset",
      intent: "ask_info",
    });
    if (quality.score < 0.65) return null;

    return maybeEmbedArticle({
      title: title.slice(0, 500),
      slug: `original-${gap.category}-${Date.now()}`,
      category: gap.category,
      description: description.slice(0, 260),
      content,
      tags: parsed.tags ?? [gap.category],
      difficulty: "base",
      personalityMatches: [],
      sectorLinks: [],
      status: "published",
      readTimeMinutes: estimateReadTimeMinutes(content),
    });
  } catch (err) {
    logger.warn({ err, category: gap.category }, "[growth-library] original generation failed");
    return null;
  }
}

export interface GrowthLibraryResult {
  curated: number;
  generated: number;
  gaps: GrowthGap[];
  durationMs: number;
}

export async function runGrowthLibraryAgent(): Promise<GrowthLibraryResult> {
  const startedAt = Date.now();
  let curated = 0;
  let generated = 0;

  const discoveries = await db
    .select({
      title: discoveryItemsTable.title,
      urlHash: discoveryItemsTable.urlHash,
      category: discoveryItemsTable.category,
      summary: discoveryItemsTable.summary,
      insightText: discoveryItemsTable.insightText,
      difficulty: discoveryItemsTable.difficulty,
      skillTags: discoveryItemsTable.skillTags,
    })
    .from(discoveryItemsTable)
    .where(and(
      eq(discoveryItemsTable.type, "growth"),
      eq(discoveryItemsTable.isEnriched, true),
      gte(discoveryItemsTable.relevanceScore, MIN_RELEVANCE),
    ))
    .orderBy(desc(discoveryItemsTable.enrichedAt))
    .limit(MAX_CURATED_PER_RUN);

  for (const discovery of discoveries) {
    const article = await maybeEmbedArticle(buildCuratedGrowthArticle(discovery));
    const inserted = await db
      .insert(growthArticlesTable)
      .values(article)
      .onConflictDoNothing({ target: growthArticlesTable.slug })
      .returning({ id: growthArticlesTable.id });
    curated += inserted.length;
  }

  const recentArticles = await db
    .select({
      category: growthArticlesTable.category,
      createdAt: growthArticlesTable.createdAt,
    })
    .from(growthArticlesTable)
    .where(sql`${growthArticlesTable.status} = 'published'`);
  const gaps = analyzeGrowthLibraryGaps(recentArticles);

  for (const gap of gaps.slice(0, MAX_ORIGINALS_PER_RUN)) {
    const article = await generateOriginalArticle(gap);
    if (!article) continue;
    const inserted = await db
      .insert(growthArticlesTable)
      .values(article)
      .onConflictDoNothing({ target: growthArticlesTable.slug })
      .returning({ id: growthArticlesTable.id });
    generated += inserted.length;
  }

  return { curated, generated, gaps, durationMs: Date.now() - startedAt };
}
