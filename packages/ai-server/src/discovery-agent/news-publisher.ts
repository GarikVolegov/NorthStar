/**
 * news-publisher.ts - transfers enriched discovery_items into news_articles.
 *
 * The publisher never creates synthetic placeholder articles. If a sector has
 * too few real news items, it reports missing coverage to the admin console.
 */
import { db } from "@workspace/db";
import { discoveryItemsTable, newsArticlesTable, sectorsTable } from "@workspace/db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { logger } from "../logger";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";
import { hydrateMissingImages } from "./collector-preview";
import type { RawItem } from "./collector-types";
import { generateNewsImage } from "./news-image-generator";
import { isPublishableDiscoveryNews, normalize } from "./news-policy";
import { computeCorroboration } from "./news-verifier";

const MIN_RELEVANCE = 0.25;
const MIN_ARTICLES_PER_SECTOR = 3;

export interface MissingNewsCoverage {
  sectorId: number;
  sectorName: string;
  realArticles: number;
  needed: number;
}

export interface NewsPublisherResult {
  transferred: number;
  /** @deprecated Temporary compatibility: synthetic seeds are no longer generated. */
  seeded: number;
  missingCoverage: MissingNewsCoverage[];
  durationMs: number;
}

interface NewsRewriteInput {
  title: string;
  source: string;
  summary: string;
  insightText: string | null;
  sectorNames: string[];
  publishedAt: Date | null;
}

interface NewsRewriteOutput {
  preview: string;
  content: string;
}

interface PublishableItem extends RawItem {
  urlHash: string;
  insightText: string | null;
  relevanceScore: number;
}

function cleanText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value: string, max: number): string {
  const clean = cleanText(value);
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 80 ? lastSpace : sliced.length).trim()}...`;
}

function fallbackRewrite(input: NewsRewriteInput): NewsRewriteOutput {
  const summary = cleanText(input.summary) || cleanText(input.title);
  const insight = cleanText(input.insightText) || "Il segnale e rilevante per capire come cambia il mercato e quali competenze diventano piu utili.";
  const sectors = input.sectorNames.length > 0 ? input.sectorNames.join(", ") : "mercato del lavoro";
  const preview = limitText(summary, 240);

  const content = [
    "### Cosa e successo",
    summary,
    "",
    "### Perche conta per NorthStar",
    insight,
    "",
    "### Impatto pratico",
    `Per chi sta pianificando lavoro, business o formazione, questa notizia e un segnale da leggere dentro il contesto ${sectors}. Aiuta a capire quali competenze, ruoli o decisioni potrebbero diventare piu importanti nei prossimi mesi.`,
    "",
    "### Cosa osservare",
    "Monitora evoluzione della fonte, reazioni del settore, nuove opportunita professionali e possibili effetti su formazione, salario, domanda di skill e modelli di lavoro.",
  ].join("\n");

  return { preview, content };
}

function canUseOpenRouterRewrite(): boolean {
  return process.env.AI_PROVIDER === "openrouter" && Boolean(process.env.OPENROUTER_API_KEY);
}

async function rewriteNewsForNorthStar(input: NewsRewriteInput): Promise<NewsRewriteOutput> {
  const fallback = fallbackRewrite(input);
  if (!canUseOpenRouterRewrite()) return fallback;

  try {
    const route = selectModelFor("discovery-enrich");
    const llm = getLLMForRoute(route);
    const raw = await llm.chatOnce([
      {
        role: "system",
        content: [
          "Sei l'editor news di NorthStar.",
          "Rielabora segnali da fonti esterne senza copiare l'articolo originale.",
          "Rispondi solo JSON con preview e content.",
          "preview: massimo 240 caratteri, italiano chiaro.",
          "content: markdown breve con sezioni: Cosa e successo, Perche conta per NorthStar, Impatto pratico, Cosa osservare.",
          "Non inventare dati non presenti.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          source: input.source,
          summary: input.summary,
          northstarInsight: input.insightText,
          sectors: input.sectorNames,
          publishedAt: input.publishedAt?.toISOString() ?? null,
        }),
      },
    ], {
      model: route.model,
      temperature: 0.2,
      maxTokens: 650,
    });

    const parsed = JSON.parse(raw) as Partial<NewsRewriteOutput>;
    const preview = limitText(parsed.preview ?? fallback.preview, 240);
    const content = cleanText(parsed.content).length >= 120 ? String(parsed.content) : fallback.content;
    return { preview, content };
  } catch (err) {
    logger.warn({ err, title: input.title }, "[news-publisher] AI rewrite failed, using fallback");
    return fallback;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runNewsPublisher(): Promise<NewsPublisherResult> {
  const start = Date.now();
  let transferred = 0;
  const missingCoverage: MissingNewsCoverage[] = [];

  const enrichedItems = await db
    .select({
      title: discoveryItemsTable.title,
      url: discoveryItemsTable.url,
      urlHash: discoveryItemsTable.urlHash,
      source: discoveryItemsTable.source,
      collectorSource: discoveryItemsTable.collectorSource,
      summary: discoveryItemsTable.summary,
      imageUrl: discoveryItemsTable.imageUrl,
      publishedAt: discoveryItemsTable.publishedAt,
      sectorNames: discoveryItemsTable.sectorNames,
      category: discoveryItemsTable.category,
      type: discoveryItemsTable.type,
      relevanceScore: discoveryItemsTable.relevanceScore,
      searchQuery: discoveryItemsTable.searchQuery,
      insightText: discoveryItemsTable.insightText,
    })
    .from(discoveryItemsTable)
    .where(
      and(
        eq(discoveryItemsTable.isEnriched, true),
        eq(discoveryItemsTable.type, "news"),
        gte(discoveryItemsTable.relevanceScore, MIN_RELEVANCE),
      ),
    )
    .limit(500);

  const publishableItems = enrichedItems.filter((item) => isPublishableDiscoveryNews(item));

  if (publishableItems.length > 0) {
    const rawPublishableItems: PublishableItem[] = publishableItems.map((item) => ({
      type: "news",
      title: item.title,
      url: item.url,
      urlHash: item.urlHash,
      source: item.source,
      summary: item.summary ?? "",
      imageUrl: item.imageUrl ?? undefined,
      publishedAt: item.publishedAt ?? undefined,
      category: item.category ?? "general",
      sectorNames: item.sectorNames ?? [],
      collectorSource: item.collectorSource ?? "",
      searchQuery: item.searchQuery ?? undefined,
      insightText: item.insightText,
      relevanceScore: item.relevanceScore,
    }));

    const hydratedItems = await hydrateMissingImages(rawPublishableItems);
    const withImages = await generateNewsImage(hydratedItems);
    const corrobMap = computeCorroboration(withImages);
    const verifiedItems = withImages.filter((item) => {
      const count = corrobMap.get(item.urlHash) ?? 1;
      const isTrustedEditorial = ["sole24ore_rss", "ansa_rss", "ninja_marketing_rss"].includes(
        normalize(item.collectorSource),
      );
      if (withImages.length < 5) return true;
      return isTrustedEditorial ? count >= 1 : count >= 2;
    });

    const rows = await mapWithConcurrency(verifiedItems, 3, async (item) => {
      const rewrite = await rewriteNewsForNorthStar({
        title: item.title,
        source: item.source,
        summary: item.summary,
        insightText: item.insightText,
        sectorNames: item.sectorNames ?? [],
        publishedAt: item.publishedAt ?? null,
      });

      return {
        title: limitText(item.title, 500),
        url: item.url,
        urlHash: item.urlHash,
        source: item.source,
        summary: rewrite.preview,
        imageUrl: item.imageUrl ?? null,
        content: rewrite.content,
        publishedAt: item.publishedAt ?? new Date(),
        sectorNames: item.sectorNames ?? [],
        category: item.category ?? "general",
        relevanceScore: item.relevanceScore,
        searchQuery: item.searchQuery,
      };
    });

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await db
        .insert(newsArticlesTable)
        .values(batch)
        .onConflictDoNothing({ target: newsArticlesTable.urlHash });
      transferred += batch.length;
    }
  }

  const sectors = await db
    .select({ id: sectorsTable.id, name: sectorsTable.name })
    .from(sectorsTable)
    .orderBy(sectorsTable.name);

  for (const sector of sectors) {
    const [countRow] = await db
      .select({ cnt: count() })
      .from(newsArticlesTable)
      .where(
        and(
          sql`${sector.name} = ANY(${newsArticlesTable.sectorNames})`,
          sql`lower(${newsArticlesTable.source}) in ('gnews', 'newsapi', 'il sole 24 ore', 'ninja marketing', 'ansa', 'wired italia', 'la repubblica')`,
        ),
      );

    const realArticles = Number(countRow?.cnt ?? 0);
    const needed = Math.max(0, MIN_ARTICLES_PER_SECTOR - realArticles);

    if (needed > 0) {
      missingCoverage.push({
        sectorId: sector.id,
        sectorName: sector.name,
        realArticles,
        needed,
      });
    }
  }

  return {
    transferred,
    seeded: 0,
    missingCoverage,
    durationMs: Date.now() - start,
  };
}
