/**
 * tool-handlers-web.ts — handler per i tool web di Wendy (Firecrawl).
 *
 * Tutti i tool falliscono gracefully se Firecrawl non è configurato (UNAVAILABLE),
 * così l'LLM può ricorrere a RAG o continuare senza bloccare la conversazione.
 *
 * SECURITY:
 *   - Limite hard sul numero di URL e sulla lunghezza del markdown restituito
 *   - URL validati (solo http/https) per evitare SSRF verso schemi interni
 */
import { getFirecrawlClient, FirecrawlError } from "../firecrawl";
import { logger } from "../logger";
import type { ToolResult } from "./tool-handlers";

const MAX_MARKDOWN_CHARS = 12_000;
const MAX_SEARCH_RESULTS = 8;
const MAX_EXTRACT_URLS   = 5;

function err(code: string, message: string): ToolResult {
  return { ok: false, code, message };
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "\n…[truncated]";
}

export async function handleWebSearch(
  args: { query: string; limit?: number; country?: string; lang?: string; scrape?: boolean },
): Promise<ToolResult> {
  if (!args.query?.trim()) return err("INVALID_INPUT", "Query di ricerca vuota");
  const limit = Math.min(Math.max(args.limit ?? 5, 1), MAX_SEARCH_RESULTS);

  const client = getFirecrawlClient();
  if (!client.isAvailable()) return err("UNAVAILABLE", "Ricerca web non configurata");

  try {
    const results = await client.search(args.query.trim(), {
      limit,
      ...(args.country ? { country: args.country } : {}),
      ...(args.lang    ? { lang: args.lang }       : {}),
      ...(args.scrape  ? { scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } : {}),
    });

    return {
      ok: true,
      data: {
        query: args.query,
        results: results.map((r) => ({
          url:         r.url,
          title:       r.title ?? "",
          description: r.description ?? "",
          markdown:    r.markdown ? truncate(r.markdown, Math.floor(MAX_MARKDOWN_CHARS / Math.max(results.length, 1))) : undefined,
        })),
        totalFound: results.length,
      },
    };
  } catch (e) {
    const status = e instanceof FirecrawlError ? e.status : 0;
    logger.warn({ e, args, status }, "[tool] web_search error");
    return err("UNAVAILABLE", "Ricerca web temporaneamente non disponibile");
  }
}

export async function handleWebScrapeUrl(
  args: { url: string; onlyMainContent?: boolean; waitFor?: number },
): Promise<ToolResult> {
  if (!args.url?.trim()) return err("INVALID_INPUT", "URL mancante");
  if (!isHttpUrl(args.url)) return err("INVALID_INPUT", "URL non valido (richiesto http/https)");

  const client = getFirecrawlClient();
  if (!client.isAvailable()) return err("UNAVAILABLE", "Scrape non configurato");

  try {
    const result = await client.scrape(args.url, {
      formats:         ["markdown"],
      onlyMainContent: args.onlyMainContent ?? true,
      ...(args.waitFor !== undefined ? { waitFor: Math.min(args.waitFor, 8_000) } : {}),
    });

    return {
      ok: true,
      data: {
        url:         result.url,
        title:       result.metadata?.title       ?? "",
        description: result.metadata?.description ?? "",
        language:    result.metadata?.language    ?? "",
        markdown:    truncate(result.markdown ?? "", MAX_MARKDOWN_CHARS),
        statusCode:  result.metadata?.statusCode,
      },
    };
  } catch (e) {
    const status = e instanceof FirecrawlError ? e.status : 0;
    logger.warn({ e, args, status }, "[tool] web_scrape_url error");
    if (status >= 400 && status < 500) {
      return err("INVALID_INPUT", `Pagina non raggiungibile (HTTP ${status})`);
    }
    return err("UNAVAILABLE", "Scrape temporaneamente non disponibile");
  }
}

export async function handleWebExtractStructured(
  args: { urls: string[] | string; schema?: string; prompt?: string },
): Promise<ToolResult> {
  const rawUrls = Array.isArray(args.urls)
    ? args.urls
    : typeof args.urls === "string"
      ? args.urls.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const urls = rawUrls.filter((u): u is string => typeof u === "string" && isHttpUrl(u));
  if (urls.length === 0) return err("INVALID_INPUT", "Nessun URL valido (richiesto http/https)");
  if (urls.length > MAX_EXTRACT_URLS) {
    return err("INVALID_INPUT", `Massimo ${MAX_EXTRACT_URLS} URL per chiamata`);
  }
  if (!args.schema && !args.prompt) {
    return err("INVALID_INPUT", "Specifica almeno uno tra schema (JSON) o prompt (testo)");
  }

  let parsedSchema: Record<string, unknown> | undefined;
  if (args.schema) {
    try {
      parsedSchema = JSON.parse(args.schema) as Record<string, unknown>;
    } catch {
      return err("INVALID_INPUT", "schema non è JSON valido");
    }
  }

  const client = getFirecrawlClient();
  if (!client.isAvailable()) return err("UNAVAILABLE", "Extract non configurato");

  try {
    const result = await client.extract({
      urls,
      ...(parsedSchema ? { schema: parsedSchema } : {}),
      ...(args.prompt  ? { prompt: args.prompt } : {}),
    });

    if (!result.success) {
      return err("UNAVAILABLE", result.error ?? "Extract fallito");
    }

    return {
      ok: true,
      data: {
        urls,
        extracted: result.data,
      },
    };
  } catch (e) {
    const status = e instanceof FirecrawlError ? e.status : 0;
    logger.warn({ e, args, status }, "[tool] web_extract_structured error");
    return err("UNAVAILABLE", "Extract temporaneamente non disponibile");
  }
}
