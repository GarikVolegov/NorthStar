import type { RawItem } from "./collector-types";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return !(host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local"));
  } catch {
    return false;
  }
}

function extractMetaImage(html: string, pageUrl: string): string | undefined {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const raw = html.match(pattern)?.[1]?.trim();
    if (!raw) continue;
    try {
      const resolved = new URL(decodeHtmlEntities(raw), pageUrl).toString();
      if (isSafeHttpUrl(resolved)) return resolved;
    } catch {
      // skip malformed image URL
    }
  }
  return undefined;
}

async function fetchPagePreviewImage(pageUrl: string): Promise<string | undefined> {
  if (!isSafeHttpUrl(pageUrl)) return undefined;
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "NorthStar/1.0 (news-preview-image; +https://northstar.app)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return undefined;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return undefined;
    return extractMetaImage((await res.text()).slice(0, 250_000), pageUrl);
  } catch {
    return undefined;
  }
}

export async function hydrateMissingImages<T extends RawItem>(items: T[]): Promise<T[]> {
  const hydrated = [...items];
  const missingIndexes = hydrated
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.imageUrl && isSafeHttpUrl(item.url))
    .slice(0, 40);
  for (let i = 0; i < missingIndexes.length; i += 8) {
    const chunk = missingIndexes.slice(i, i + 8);
    const results = await Promise.allSettled(chunk.map(({ item }) => fetchPagePreviewImage(item.url)));
    results.forEach((result, offset) => {
      if (result.status === "fulfilled" && result.value) {
        hydrated[chunk[offset]!.index] = { ...hydrated[chunk[offset]!.index]!, imageUrl: result.value };
      }
    });
  }
  return hydrated;
}
