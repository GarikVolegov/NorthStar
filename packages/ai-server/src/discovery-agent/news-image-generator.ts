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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function canGenerateImages(): boolean {
  return process.env.NEWS_IMAGE_GENERATION === "true"
    && Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY);
}

function isPriorityItem(item: RawItem): boolean {
  return item.sectorNames.some((sector) => PRIORITY_SECTORS.has(normalize(sector)));
}

function dedupeKey(item: RawItem): string {
  return normalize(item.url || item.title);
}

export async function generateNewsImage<T extends RawItem>(items: T[]): Promise<T[]> {
  if (!canGenerateImages()) return items;

  try {
    getNonChatOpenAI();
  } catch (err) {
    logger.warn({ err }, "[news-image-generator] OpenAI image client unavailable");
    return items;
  }

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
    const sector = item.sectorNames[0] ?? "economia";
    const prompt = `${item.title}, ${sector}, professional news photo, clean editorial style`;
    try {
      const imageBuffer = await generateImageBuffer(prompt, "512x512");
      withImages[index] = {
        ...item,
        imageUrl: `data:image/png;base64,${imageBuffer.toString("base64")}`,
      } as T;
    } catch (err) {
      logger.warn({ err, title: item.title }, "[news-image-generator] image generation failed");
    }
  }

  return withImages;
}
