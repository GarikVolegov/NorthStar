import { getNonChatOpenAI } from "../client";
import { generateImageBuffer } from "../image/client";
import { logger } from "../logger";
import type { RawItem } from "./collector-types";

const MAX_IMAGES_PER_RUN = 10;
const PRIORITY_SECTORS = new Set([
  "artificial intelligence",
  "digital economy",
  "digital marketing",
  "economia italia",
  "finanza",
  "labor market",
  "mercato del lavoro",
  "startup",
  "technology",
]);

// Mappa i settori (spesso in italiano) a query inglesi: Unsplash rende molto
// meglio in inglese. Default: settore + termine generico editoriale.
const SECTOR_QUERY: Record<string, string> = {
  "artificial intelligence": "artificial intelligence technology",
  "digital economy": "digital economy office",
  "digital marketing": "digital marketing team",
  "economia italia": "italy business economy",
  "finanza": "finance business",
  "labor market": "job interview office",
  "mercato del lavoro": "job interview office",
  "startup": "startup team office",
  "technology": "technology software team",
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function unsplashReady(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

function openaiImagesReady(): boolean {
  return process.env.NEWS_IMAGE_GENERATION === "true"
    && Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY);
}

function isPriorityItem(item: RawItem): boolean {
  return item.sectorNames.some((sector) => PRIORITY_SECTORS.has(normalize(sector)));
}

function dedupeKey(item: RawItem): string {
  return normalize(item.url || item.title);
}

function stableHash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Foto editoriale REALE da Unsplash (gratis, no AI-generated). Sceglie tra i
 * primi risultati in modo deterministico per dare varietà tra articoli, e
 * notifica il download come richiesto dalle API guidelines Unsplash.
 */
async function fetchUnsplashImage(query: string, variantSeed: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "10");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("content_filter", "high");
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, query }, "[news-image-generator] Unsplash search failed");
      return null;
    }
    const data = (await res.json()) as {
      results?: Array<{ urls?: { regular?: string }; links?: { download_location?: string } }>;
    };
    const results = data.results ?? [];
    if (results.length === 0) return null;
    const pick = results[stableHash(variantSeed) % results.length];
    const photoUrl = pick?.urls?.regular ?? null;

    // Compliance Unsplash: notifica il "download" quando l'immagine viene usata.
    const dl = pick?.links?.download_location;
    if (dl) {
      void fetch(dl, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
    }
    return photoUrl;
  } catch (err) {
    logger.warn({ err, query }, "[news-image-generator] Unsplash error");
    return null;
  }
}

export async function generateNewsImage<T extends RawItem>(items: T[]): Promise<T[]> {
  const hasUnsplash = unsplashReady();
  const hasOpenAI = openaiImagesReady();
  if (!hasUnsplash && !hasOpenAI) return items;

  // Il fallback DALL-E richiede il client OpenAI: verificane la disponibilità.
  let openAiUsable = hasOpenAI;
  if (openAiUsable) {
    try {
      getNonChatOpenAI();
    } catch (err) {
      logger.warn({ err }, "[news-image-generator] OpenAI image client unavailable");
      openAiUsable = false;
    }
  }
  if (!hasUnsplash && !openAiUsable) return items;

  const seen = new Set<string>();
  const candidates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item.imageUrl || !isPriorityItem(item)) return false;
      const key = dedupeKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_IMAGES_PER_RUN);

  if (candidates.length === 0) return items;

  const withImages = [...items];
  for (const { item, index } of candidates) {
    const sector = normalize(item.sectorNames[0] ?? "economia");
    const query = SECTOR_QUERY[sector] ?? `${sector} business`;
    try {
      // 1) Foto REALE Unsplash (preferita).
      let imageUrl: string | null = hasUnsplash
        ? await fetchUnsplashImage(query, dedupeKey(item))
        : null;

      // 2) Fallback: immagine generata (solo se abilitato e Unsplash non ha dato nulla).
      if (!imageUrl && openAiUsable) {
        const prompt = `${item.title}, ${sector}, professional news photo, clean editorial style`;
        const imageBuffer = await generateImageBuffer(prompt, "512x512");
        imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
      }

      if (imageUrl) {
        withImages[index] = { ...item, imageUrl } as T;
      }
    } catch (err) {
      logger.warn({ err, title: item.title }, "[news-image-generator] image generation failed");
    }
  }

  return withImages;
}
