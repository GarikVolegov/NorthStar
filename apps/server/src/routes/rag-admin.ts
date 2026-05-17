/**
 * rag-admin.ts — route admin per gestione RAG, segnali deboli e catalogo.
 *
 * Tutte le route richiedono role = 'admin' (requireAuth + requireAdmin).
 *
 * Endpoints:
 *   GET  /api/admin/weak-signals                   — lista segnali filtrabili
 *   PATCH /api/admin/weak-signals/:id              — aggiorna status/strength
 *   POST /api/admin/weak-signals/:id/approve       — promuovi a ruolo ufficiale
 *   POST /api/admin/weak-signals/:id/dismiss       — marca come faded
 *   GET  /api/admin/rag-sources                    — lista fonti RAG con stats
 *   POST /api/admin/rag-sources                    — aggiungi nuova fonte
 *   POST /api/admin/rag-sources/:id/ingest-pdf     — ingesta PDF (base64 in body)
 *   POST /api/admin/rag-sources/:id/ingest-rss     — trigger ingestione RSS
 *   GET  /api/admin/rag-sources/:id/chunks         — lista chunk con stats
 */
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { db, weakSignalsTable, ragSourcesTable, ragChunksTable } from "@workspace/db";
import { ingestPdfToRag, ingestRssToRag } from "@workspace/ai-server";
import { rootLogger } from "../middleware/logger";

const router = Router();
const log = rootLogger.child({ module: "rag-admin" });

// ── GET /api/admin/weak-signals ──────────────────────────────────────────────

router.get("/weak-signals", requireAuth, requireAdmin, async (req, res) => {
  const status  = (req.query.status as string) || "emerging";
  const limit   = Math.min(parseInt(req.query.limit as string || "20"), 50);

  try {
    const rows = await db
      .select()
      .from(weakSignalsTable)
      .where(status !== "all" ? eq(weakSignalsTable.status, status as any) : undefined)
      .orderBy(desc(weakSignalsTable.strength))
      .limit(limit);

    res.json({ signals: rows, total: rows.length });
  } catch (e) {
    log.error({ e }, "[rag-admin] list weak signals error");
    res.status(500).json({ error: "Errore nel recupero dei segnali" });
  }
});

// ── PATCH /api/admin/weak-signals/:id ───────────────────────────────────────

const PatchWeakSignalSchema = z.object({
  status:      z.enum(["emerging", "confirmed", "mainstream", "faded"]).optional(),
  strength:    z.number().min(0).max(1).optional(),
  description: z.string().max(1000).optional(),
});

router.patch("/weak-signals/:id", requireAuth, requireAdmin, async (req, res) => {
  const id   = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = PatchWeakSignalSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [updated] = await db
      .update(weakSignalsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(weakSignalsTable.id, id))
      .returning({ id: weakSignalsTable.id, status: weakSignalsTable.status });

    if (!updated) { res.status(404).json({ error: "Segnale non trovato" }); return; }
    log.info({ id, patch: parsed.data, adminId: req.user?.id }, "[rag-admin] weak signal patched");
    res.json({ ok: true, signal: updated });
  } catch (e) {
    log.error({ e, id }, "[rag-admin] patch weak signal error");
    res.status(500).json({ error: "Errore nell'aggiornamento" });
  }
});

// ── POST /api/admin/weak-signals/:id/approve ────────────────────────────────
// Promuove un segnale a 'confirmed' e opzionalmente lo lega a un settore.

const ApproveSchema = z.object({
  linkedSectorId: z.string().optional(),
});

router.post("/weak-signals/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = ApproveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const existing = await db
      .select({ id: weakSignalsTable.id, linkedSectorIds: weakSignalsTable.linkedSectorIds })
      .from(weakSignalsTable)
      .where(eq(weakSignalsTable.id, id))
      .limit(1);

    if (!existing[0]) { res.status(404).json({ error: "Segnale non trovato" }); return; }

    const newSectorIds = parsed.data.linkedSectorId
      ? [...new Set([...existing[0].linkedSectorIds, parsed.data.linkedSectorId])]
      : existing[0].linkedSectorIds;

    await db
      .update(weakSignalsTable)
      .set({
        status:          "confirmed",
        linkedSectorIds: newSectorIds,
        updatedAt:       new Date(),
      })
      .where(eq(weakSignalsTable.id, id));

    log.info({ id, adminId: req.user?.id }, "[rag-admin] weak signal approved → confirmed");
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, id }, "[rag-admin] approve weak signal error");
    res.status(500).json({ error: "Errore nell'approvazione" });
  }
});

// ── POST /api/admin/weak-signals/:id/dismiss ────────────────────────────────

router.post("/weak-signals/:id/dismiss", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    const [updated] = await db
      .update(weakSignalsTable)
      .set({ status: "faded", updatedAt: new Date() })
      .where(eq(weakSignalsTable.id, id))
      .returning({ id: weakSignalsTable.id });

    if (!updated) { res.status(404).json({ error: "Segnale non trovato" }); return; }
    log.info({ id, adminId: req.user?.id }, "[rag-admin] weak signal dismissed → faded");
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, id }, "[rag-admin] dismiss weak signal error");
    res.status(500).json({ error: "Errore nella dismissione" });
  }
});

// ── GET /api/admin/rag-sources ───────────────────────────────────────────────

router.get("/rag-sources", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(ragSourcesTable)
      .orderBy(desc(ragSourcesTable.createdAt))
      .limit(50);
    res.json({ sources: rows, total: rows.length });
  } catch (e) {
    log.error({ e }, "[rag-admin] list rag sources error");
    res.status(500).json({ error: "Errore nel recupero delle fonti" });
  }
});

// ── POST /api/admin/rag-sources ─────────────────────────────────────────────

const CreateSourceSchema = z.object({
  name:        z.string().min(3).max(200),
  url:         z.string().url().optional(),
  sourceType:  z.enum(["report", "job_agg", "news", "community"]),
  format:      z.enum(["pdf", "json", "html", "rss"]),
  trustScore:  z.number().min(0).max(1).default(0.7),
  geography:   z.array(z.string()).default([]),
  publishedAt: z.string().optional(), // ISO date string
});

router.post("/rag-sources", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateSourceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [row] = await db
      .insert(ragSourcesTable)
      .values({
        name:        parsed.data.name,
        url:         parsed.data.url,
        sourceType:  parsed.data.sourceType,
        format:      parsed.data.format,
        trustScore:  parsed.data.trustScore,
        geography:   parsed.data.geography,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
      })
      .returning({ id: ragSourcesTable.id, name: ragSourcesTable.name });

    log.info({ id: row.id, name: row.name, adminId: req.user?.id }, "[rag-admin] rag source created");
    res.status(201).json({ ok: true, source: row });
  } catch (e) {
    log.error({ e }, "[rag-admin] create rag source error");
    res.status(500).json({ error: "Errore nella creazione della fonte" });
  }
});

// ── GET /api/admin/rag-sources (override con stats chunk) ───────────────────

router.get("/rag-sources/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute<{
      id: number; name: string; source_type: string; trust_score: number;
      last_ingested_at: string | null; chunk_count: number;
    }>(sql`
      SELECT rs.id, rs.name, rs.source_type, rs.trust_score, rs.last_ingested_at,
             COUNT(rc.id)::int AS chunk_count
      FROM rag_sources rs
      LEFT JOIN rag_chunks rc ON rc.source_id = rs.id
      GROUP BY rs.id
      ORDER BY rs.created_at DESC
      LIMIT 50
    `);
    res.json({ sources: rows.rows });
  } catch (e) {
    log.error({ e }, "[rag-admin] rag sources stats error");
    res.status(500).json({ error: "Errore nel recupero delle statistiche" });
  }
});

// ── POST /api/admin/rag-sources/:id/ingest-pdf ──────────────────────────────
// Accetta il PDF come stringa base64 in body (nessuna dipendenza multer)

const IngestPdfSchema = z.object({
  pdfBase64:   z.string().min(100),
  publishedAt: z.string().optional(),
  geography:   z.array(z.string()).default([]),
  sectors:     z.array(z.string()).default([]),
});

router.post("/rag-sources/:id/ingest-pdf", requireAuth, requireAdmin, async (req, res) => {
  const sourceId = parseInt(req.params.id);
  if (isNaN(sourceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = IngestPdfSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const buffer = Buffer.from(parsed.data.pdfBase64, "base64");
    const result = await ingestPdfToRag(buffer, {
      sourceId,
      geography:   parsed.data.geography,
      sectors:     parsed.data.sectors,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
    });

    log.info({ sourceId, ...result, adminId: req.user?.id }, "[rag-admin] PDF ingested");
    res.json({ ok: true, ...result });
  } catch (e) {
    log.error({ e, sourceId }, "[rag-admin] ingest-pdf error");
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
});

// ── POST /api/admin/rag-sources/:id/ingest-rss ──────────────────────────────

const IngestRssSchema = z.object({
  geography:  z.array(z.string()).default([]),
  sectors:    z.array(z.string()).default([]),
  maxAgeDays: z.number().int().min(1).max(365).default(30),
  maxItems:   z.number().int().min(1).max(50).default(20),
});

router.post("/rag-sources/:id/ingest-rss", requireAuth, requireAdmin, async (req, res) => {
  const sourceId = parseInt(req.params.id);
  if (isNaN(sourceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = IngestRssSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Recupera URL della fonte
  const [source] = await db
    .select({ url: ragSourcesTable.url, format: ragSourcesTable.format })
    .from(ragSourcesTable)
    .where(eq(ragSourcesTable.id, sourceId))
    .limit(1);

  if (!source) { res.status(404).json({ error: "Fonte non trovata" }); return; }
  if (source.format !== "rss") { res.status(400).json({ error: "Questa fonte non è di formato RSS" }); return; }
  if (!source.url) { res.status(400).json({ error: "URL mancante per la fonte RSS" }); return; }

  try {
    const result = await ingestRssToRag({
      sourceId,
      feedUrl:    source.url,
      geography:  parsed.data.geography,
      sectors:    parsed.data.sectors,
      maxAgeDays: parsed.data.maxAgeDays,
      maxItems:   parsed.data.maxItems,
    });

    log.info({ sourceId, ...result, adminId: req.user?.id }, "[rag-admin] RSS ingested");
    res.json({ ok: true, ...result });
  } catch (e) {
    log.error({ e, sourceId }, "[rag-admin] ingest-rss error");
    res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
  }
});

// ── GET /api/admin/rag-sources/:id/chunks ───────────────────────────────────

router.get("/rag-sources/:id/chunks", requireAuth, requireAdmin, async (req, res) => {
  const sourceId = parseInt(req.params.id);
  if (isNaN(sourceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  try {
    const rows = await db
      .select({
        id:          ragChunksTable.id,
        chunkIndex:  ragChunksTable.chunkIndex,
        tokenCount:  ragChunksTable.tokenCount,
        trustScore:  ragChunksTable.trustScore,
        publishedAt: ragChunksTable.publishedAt,
        preview:     sql<string>`LEFT(${ragChunksTable.content}, 120)`,
        hasEmbedding: sql<boolean>`${ragChunksTable.embedding} IS NOT NULL`,
      })
      .from(ragChunksTable)
      .where(eq(ragChunksTable.sourceId, sourceId))
      .orderBy(ragChunksTable.chunkIndex)
      .limit(100);

    res.json({ chunks: rows, total: rows.length });
  } catch (e) {
    log.error({ e, sourceId }, "[rag-admin] list chunks error");
    res.status(500).json({ error: "Errore nel recupero dei chunk" });
  }
});

export default router;
