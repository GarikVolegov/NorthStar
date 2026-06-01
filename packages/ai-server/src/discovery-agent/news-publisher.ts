/**
 * news-publisher.ts - transfers enriched discovery_items into news_articles.
 *
 * The publisher never creates synthetic placeholder articles. If a sector has
 * too few real news items, it reports missing coverage to the admin console.
 */
import { db } from "@workspace/db";
import { createHash } from "node:crypto";
import { discoveryItemsTable, newsArticlesTable, sectorsTable } from "@workspace/db";
import { and, count, eq, or, sql } from "drizzle-orm";
import { logger } from "../logger";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";
import { hydrateMissingImages } from "./collector-preview";
import { generateNewsImage } from "./news-image-generator";
import { PUBLIC_NEWS_SOURCES, formatPublicNewsSource, isPublishableDiscoveryNews, normalize, shouldAutoPublishTrustedNews } from "./news-policy";
import { mapWithConcurrency } from "../utils";
import { computeCorroboration } from "./news-verifier";
import { collectTrustedItalianNews } from "./collector-sources";
import type { MissingNewsCoverage, NewsInsertRow, NewsPublisherResult, NewsRewriteInput, NewsRewriteOutput, PublishableItem } from "./news-publisher-types";

export type { MissingNewsCoverage, NewsPublisherResult } from "./news-publisher-types";

const MIN_RELEVANCE = 0.25;
const MIN_ARTICLES_PER_SECTOR = 3;

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
    "### Per chi è",
    `Per chi sta valutando ${sectors}, competenze collegate e prossime scelte professionali.`,
    "",
    "### Cosa è successo",
    summary,
    "",
    "### Perché conta per te",
    insight,
    "",
    "### Cosa fare adesso",
    "Confronta il segnale con il tuo percorso, scegli una competenza da verificare e decidi se cambia una priorità concreta nelle prossime settimane.",
  ].join("\n");

  return { preview, content };
}

function canUseOpenRouterRewrite(): boolean {
  return process.env.NEWS_LLM_REWRITE === "true"
    && process.env.AI_PROVIDER === "openrouter"
    && Boolean(process.env.OPENROUTER_API_KEY);
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
          "content: markdown breve con sezioni: Per chi è, Cosa è successo, Perché conta per te, Cosa fare adesso.",
          "La sezione finale deve essere pratica e verificabile: un piccolo uso concreto della notizia per percorso, competenze o decisioni.",
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

function isMissingRelationError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  const causeCode = (err as { cause?: { code?: unknown } })?.cause?.code;
  return (
    causeCode === "42P01" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("relazione") && message.includes("non esiste"))
  );
}

async function publishRawItems(items: PublishableItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const prioritizedItems = items.slice(0, Number(process.env.NEWS_PUBLISH_MAX_PER_RUN) || 30);
  const hydratedItems = await hydrateMissingImages(prioritizedItems);
  const withImages = await generateNewsImage(hydratedItems);
  const corrobMap = computeCorroboration(withImages);
  const verifiedItems = withImages.filter((item) => {
    const count = corrobMap.get(item.urlHash) ?? 1;
    const isTrustedEditorial = ["sole24ore_rss", "ansa_rss", "ninja_marketing_rss", "gnews", "tavily_news"].includes(
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
      source: formatPublicNewsSource(item),
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

  let inserted = 0;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    inserted += await insertNewsRows(batch);
  }
  return inserted;
}

async function insertNewsRows(rows: NewsInsertRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const textArray = (values: string[]) => {
    if (values.length === 0) return sql`ARRAY[]::text[]`;
    return sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;
  };
  const values = sql.join(
    rows.map((row) => sql`(
      ${row.title},
      ${row.url},
      ${row.urlHash},
      ${row.source},
      ${row.summary},
      ${row.imageUrl},
      ${row.content},
      ${row.publishedAt},
      ${textArray(row.sectorNames)},
      ${row.category},
      ${row.relevanceScore},
      ${row.searchQuery ?? null}
    )`),
    sql`, `,
  );
  const result = await db.execute<{ id: number }>(sql`
    INSERT INTO news_articles
      (title, url, url_hash, source, summary, image_url, content, published_at, sector_names, category, relevance_score, search_query)
    VALUES ${values}
    ON CONFLICT (url_hash) DO UPDATE SET
      title = EXCLUDED.title,
      source = EXCLUDED.source,
      summary = EXCLUDED.summary,
      image_url = COALESCE(news_articles.image_url, EXCLUDED.image_url),
      content = EXCLUDED.content,
      published_at = COALESCE(news_articles.published_at, EXCLUDED.published_at),
      sector_names = EXCLUDED.sector_names,
      category = EXCLUDED.category,
      relevance_score = EXCLUDED.relevance_score,
      search_query = EXCLUDED.search_query
    RETURNING id
  `);
  return result.rows.length;
}

function publicNewsSourceSql() {
  return or(...PUBLIC_NEWS_SOURCES.flatMap((source) => [
    sql`lower(${newsArticlesTable.source}) = ${source}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source}:%`}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source} -%`}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source} %`}`,
  ]))!;
}

async function loadDiscoveryPublishableItems(): Promise<PublishableItem[]> {
  let enrichedItems: Array<{
    title: string;
    url: string;
    urlHash: string;
    source: string;
    collectorSource: string | null;
    summary: string | null;
    imageUrl: string | null;
    publishedAt: Date | null;
    sectorNames: string[];
    category: string | null;
    type: string | null;
    isEnriched: boolean | null;
    relevanceScore: number;
    searchQuery: string | null;
    insightText: string | null;
  }> = [];

  try {
    enrichedItems = await db
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
        isEnriched: discoveryItemsTable.isEnriched,
        relevanceScore: discoveryItemsTable.relevanceScore,
        searchQuery: discoveryItemsTable.searchQuery,
        insightText: discoveryItemsTable.insightText,
      })
      .from(discoveryItemsTable)
      .where(eq(discoveryItemsTable.type, "news"))
      .limit(500);
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
    logger.warn("[news-publisher] discovery_items missing, using direct trusted news backfill");
    return [];
  }

  return enrichedItems
    .filter((item) => {
      if (!isPublishableDiscoveryNews(item)) return false;
      if (item.isEnriched && item.relevanceScore >= MIN_RELEVANCE) return true;
      return shouldAutoPublishTrustedNews(item);
    })
    .map((item) => ({
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
      relevanceScore: item.relevanceScore >= MIN_RELEVANCE ? item.relevanceScore : 0.4,
    }));
}

async function loadDirectTrustedNewsItems(): Promise<PublishableItem[]> {
  const items = await collectTrustedItalianNews();
  return items
    .filter((item) => shouldAutoPublishTrustedNews(item))
    .map((item) => ({
      ...item,
      urlHash: createHash("sha256").update(item.url).digest("hex"),
      insightText: "Notizia italiana rilevante per orientamento, lavoro, competenze e decisioni professionali.",
      relevanceScore: 0.45,
    }));
}

export async function runNewsPublisher(): Promise<NewsPublisherResult> {
  const start = Date.now();
  let transferred = 0;
  const missingCoverage: MissingNewsCoverage[] = [];

  const directTrustedItems = await loadDirectTrustedNewsItems();
  const discoveryItems = await loadDiscoveryPublishableItems();
  const seenUrls = new Set<string>();
  const publishableItems = [...directTrustedItems, ...discoveryItems].filter((item) => {
    const key = item.urlHash || item.url;
    if (seenUrls.has(key)) return false;
    seenUrls.add(key);
    return true;
  });

  if (publishableItems.length > 0) {
    transferred += await publishRawItems(publishableItems);
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
          publicNewsSourceSql(),
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
