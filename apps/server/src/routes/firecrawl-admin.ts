/**
 * firecrawl-admin.ts — route admin per ingestion via Firecrawl nel RAG.
 *
 * Tutte le route richiedono role = 'admin' (requireAuth + requireAdmin).
 *
 * Endpoints:
 *   GET  /api/admin/firecrawl/health                 — verifica disponibilità servizio
 *   POST /api/admin/firecrawl/scrape                 — scrape singolo URL (preview, no ingest)
 *   POST /api/admin/firecrawl/sources/:id/ingest-url   — scrape URL → indicizza chunk
 *   POST /api/admin/firecrawl/sources/:id/ingest-crawl — crawl sito → indicizza chunk
 */
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth, requireAdmin } from "../middleware/auth";
import {
  getFirecrawlClient,
  FirecrawlError,
  ingestFirecrawlUrl,
  ingestFirecrawlCrawl,
} from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const router = Router();
const log = rootLogger.child({ module: "firecrawl-admin" });

// ── GET /health ──────────────────────────────────────────────────────────────

router.get("/health", requireAuth, requireAdmin, async (_req, res) => {
  const client = getFirecrawlClient();
  if (!client.isAvailable()) {
    res.status(503).json({ ok: false, available: false, reason: "FIRECRAWL_BASE_URL non configurato" });
    return;
  }

  try {
    // Probe leggero: search vuota non costa nulla, ma molti deploy non rispondono
    // bene a query vuote; usiamo un map su example.com come ping economico.
    await client.map("https://example.com", { limit: 1 });
    res.json({ ok: true, available: true });
  } catch (e) {
    const status = e instanceof FirecrawlError ? e.status : 0;
    res.status(503).json({ ok: false, available: false, status, error: (e as Error).message });
  }
});

// ── POST /scrape (preview, no ingest) ────────────────────────────────────────

const ScrapeSchema = z.object({
  url:             z.string().url(),
  onlyMainContent: z.boolean().optional(),
  waitFor:         z.number().int().min(0).max(8000).optional(),
});

router.post("/scrape", requireAuth, requireAdmin, async (req, res) => {
  const parsed = ScrapeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const client = getFirecrawlClient();
  if (!client.isAvailable()) {
    res.status(503).json({ error: "Firecrawl non configurato" });
    return;
  }

  try {
    const result = await client.scrape(parsed.data.url, {
      formats:         ["markdown"],
      onlyMainContent: parsed.data.onlyMainContent ?? true,
      ...(parsed.data.waitFor !== undefined ? { waitFor: parsed.data.waitFor } : {}),
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    const status = e instanceof FirecrawlError ? e.status : 0;
    log.warn({ e, url: parsed.data.url }, "[firecrawl-admin] scrape error");
    res.status(status >= 400 && status < 500 ? status : 502).json({ error: (e as Error).message });
  }
});

// ── POST /sources/:id/ingest-url ─────────────────────────────────────────────

const IngestUrlSchema = z.object({
  url:       z.string().url(),
  docType:   z.enum(["report", "news", "generic"]).default("generic"),
  geography: z.array(z.string()).default([]),
  sectors:   z.array(z.string()).default([]),
  roles:     z.array(z.string()).default([]),
});

router.post("/sources/:id/ingest-url", requireAuth, requireAdmin, async (req, res) => {
  const sourceId = parseInt(req.params.id ?? "", 10);
  if (Number.isNaN(sourceId)) {
    res.status(400).json({ error: "sourceId non valido" });
    return;
  }
  const parsed = IngestUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await ingestFirecrawlUrl(parsed.data.url, {
      sourceId,
      docType:   parsed.data.docType,
      geography: parsed.data.geography,
      sectors:   parsed.data.sectors,
      roles:     parsed.data.roles,
    });
    log.info(
      { sourceId, url: parsed.data.url, ...result, adminId: req.user?.id },
      "[firecrawl-admin] ingest-url complete",
    );
    res.json({ ok: true, ...result });
  } catch (e) {
    log.error({ e, sourceId, url: parsed.data.url }, "[firecrawl-admin] ingest-url error");
    res.status(500).json({ error: (e as Error).message });
  }
});

// ── POST /sources/:id/ingest-crawl ───────────────────────────────────────────

const IngestCrawlSchema = z.object({
  url:                z.string().url(),
  docType:            z.enum(["report", "news", "generic"]).default("generic"),
  geography:          z.array(z.string()).default([]),
  sectors:            z.array(z.string()).default([]),
  roles:              z.array(z.string()).default([]),
  maxPages:           z.number().int().min(1).max(200).default(30),
  maxDepth:           z.number().int().min(1).max(10).optional(),
  includePaths:       z.array(z.string()).optional(),
  excludePaths:       z.array(z.string()).optional(),
  allowExternalLinks: z.boolean().optional(),
});

router.post("/sources/:id/ingest-crawl", requireAuth, requireAdmin, async (req, res) => {
  const sourceId = parseInt(req.params.id ?? "", 10);
  if (Number.isNaN(sourceId)) {
    res.status(400).json({ error: "sourceId non valido" });
    return;
  }
  const parsed = IngestCrawlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await ingestFirecrawlCrawl(
      parsed.data.url,
      {
        limit:    parsed.data.maxPages,
        ...(parsed.data.maxDepth          !== undefined ? { maxDepth: parsed.data.maxDepth }           : {}),
        ...(parsed.data.includePaths      ? { includePaths: parsed.data.includePaths }                 : {}),
        ...(parsed.data.excludePaths      ? { excludePaths: parsed.data.excludePaths }                 : {}),
        ...(parsed.data.allowExternalLinks !== undefined ? { allowExternalLinks: parsed.data.allowExternalLinks } : {}),
      },
      {
        sourceId,
        docType:   parsed.data.docType,
        geography: parsed.data.geography,
        sectors:   parsed.data.sectors,
        roles:     parsed.data.roles,
        maxPages:  parsed.data.maxPages,
      },
    );
    log.info(
      { sourceId, url: parsed.data.url, ...result, adminId: req.user?.id },
      "[firecrawl-admin] ingest-crawl complete",
    );
    res.json({ ok: true, ...result });
  } catch (e) {
    log.error({ e, sourceId, url: parsed.data.url }, "[firecrawl-admin] ingest-crawl error");
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
