import { logger } from "../logger";
import type { RSSEntry } from "./collector-types";
import { isSafeHttpUrl, safeFetch } from "../net-safety";

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tag}>`, "i");
  const m = xml.match(re);
  return ((m?.[1] ?? m?.[2]) ?? "").trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function parseRSS(xml: string, limit = 8): RSSEntry[] {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  const entries: RSSEntry[] = [];
  for (const block of blocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    if (!title) continue;
    let url = extractTag(block, "link").trim();
    if (!url || url.startsWith("<")) url = extractAttr(block, "link", "href");
    if (!url) url = extractTag(block, "url");
    if (!url || !url.startsWith("http")) continue;
    const summary = (extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content"))
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 400)
      .trim();
    const imageUrl =
      extractAttr(block, "enclosure", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "media:content", "url") ||
      undefined;
    const dateStr = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
    let publishedAt: Date | undefined;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) publishedAt = d;
    }
    entries.push({ title, url, summary, imageUrl, publishedAt });
  }
  return entries;
}

export async function fetchRSS(feedUrl: string, limit = 8): Promise<RSSEntry[]> {
  if (!isSafeHttpUrl(feedUrl)) {
    logger.warn({ feedUrl }, "[collector] fetchRSS rejected unsafe feed URL");
    return [];
  }
  const headers = {
    "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
    "User-Agent": "NorthStar/1.0 (discovery-agent; +https://northstar.app)",
  };
  const res = await safeFetch(feedUrl, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res) {
    logger.warn({ feedUrl }, "[collector] fetchRSS blocked unsafe redirect");
    return [];
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${feedUrl}`);
  const xml = await res.text();
  if (xml.trimStart().startsWith("<!DOCTYPE") || xml.trimStart().startsWith("<html")) {
    logger.warn({ feedUrl }, "[collector] fetchRSS got HTML instead of XML for %s", feedUrl);
    return [];
  }
  return parseRSS(xml, limit);
}
