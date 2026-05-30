import { and, eq } from "drizzle-orm";
import { db, discoverySourcesTable } from "@workspace/db";
import { logger } from "../logger";
import type { ItemType, RawItem } from "./collector-types";
import { mapWithConcurrency } from "../utils";

export interface ScrapingDiscoverySource {
  id: number;
  name: string;
  itemType: string;
  sector: string;
  category: string;
  scrapingUrl: string | null;
  scrapingSelector?: string | null;
  itemsPerRun?: number | null;
}

export interface ScrapedItem {
  title?: string | null;
  url?: string | null;
  summary?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | Date | null;
}

function isItemType(value: string): value is ItemType {
  return value === "news" || value === "opportunity" || value === "formation" || value === "growth" || value === "sector_trend";
}

function resolveUrl(baseUrl: string, value: string): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseDate(value: string | Date | null | undefined): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeScrapedItems(
  source: ScrapingDiscoverySource,
  scrapedItems: ScrapedItem[],
): RawItem[] {
  const baseUrl = source.scrapingUrl;
  if (!baseUrl) return [];

  return scrapedItems.flatMap((item) => {
    const title = String(item.title ?? "").trim();
    const rawUrl = String(item.url ?? "").trim();
    if (!title || !rawUrl) return [];

    const url = resolveUrl(baseUrl, rawUrl);
    if (!url) return [];

    return [{
      type: isItemType(source.itemType) ? source.itemType : "news",
      title,
      url,
      source: source.name,
      summary: String(item.summary ?? `${source.name}: ${title}`).trim(),
      imageUrl: item.imageUrl ?? undefined,
      publishedAt: parseDate(item.publishedAt),
      category: source.category ?? source.itemType ?? "news",
      sectorNames: [source.sector ?? "General"],
      collectorSource: `scraping_${source.id}`,
      searchQuery: source.name,
    }];
  });
}

async function callPrintingPressBridge(source: ScrapingDiscoverySource): Promise<ScrapedItem[]> {
  const bridgeUrl = process.env.PRINTING_PRESS_BRIDGE_URL;
  if (!bridgeUrl || !source.scrapingUrl) return [];

  const res = await fetch(bridgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: source.scrapingUrl,
      selector: source.scrapingSelector ?? undefined,
      limit: source.itemsPerRun ?? 6,
      output: "items",
    }),
    signal: AbortSignal.timeout(Number(process.env.PRINTING_PRESS_TIMEOUT_MS ?? 45_000)),
  });
  if (!res.ok) throw new Error(`printing-press bridge ${res.status}`);
  const parsed = await res.json() as { items?: ScrapedItem[] } | ScrapedItem[];
  return Array.isArray(parsed) ? parsed : parsed.items ?? [];
}

export async function collectScrapingSources(): Promise<RawItem[]> {
  let sources: ScrapingDiscoverySource[];
  try {
    sources = await db
      .select({
        id: discoverySourcesTable.id,
        name: discoverySourcesTable.name,
        itemType: discoverySourcesTable.itemType,
        sector: discoverySourcesTable.sector,
        category: discoverySourcesTable.category,
        scrapingUrl: discoverySourcesTable.scrapingUrl,
        scrapingSelector: discoverySourcesTable.scrapingSelector,
        itemsPerRun: discoverySourcesTable.itemsPerRun,
      })
      .from(discoverySourcesTable)
      .where(and(
        eq(discoverySourcesTable.enabled, true),
        eq(discoverySourcesTable.sourceType, "scraping"),
      ));
  } catch (err) {
    logger.warn({ err }, "[collector] scraping sources DB read failed");
    return [];
  }

  if (!process.env.PRINTING_PRESS_BRIDGE_URL) {
    if (sources.length > 0) {
      logger.warn({ count: sources.length }, "[collector] scraping sources configured but PRINTING_PRESS_BRIDGE_URL is not set");
    }
    return [];
  }

  const batches = await mapWithConcurrency(sources, 3, async (source) => {
    try {
      const scraped = await callPrintingPressBridge(source);
      return normalizeScrapedItems(source, scraped);
    } catch (err) {
      logger.warn({ err, sourceName: source.name }, "[collector] scraping source failed");
      return [];
    }
  });
  return batches.flat();
}
