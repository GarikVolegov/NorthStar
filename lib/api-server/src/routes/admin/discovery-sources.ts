/**
 * Admin routes — Discovery Sources Manager
 * ─────────────────────────────────────────
 *
 * CRUD completo per la tabella discovery_sources.
 * Tutte le route richiedono autenticazione admin (jwtMiddleware).
 *
 * GET    /api/admin/discovery/sources          → lista tutte le fonti
 * POST   /api/admin/discovery/sources          → crea nuova fonte
 * PATCH  /api/admin/discovery/sources/:id      → aggiorna (toggle enabled, modifica campi)
 * DELETE /api/admin/discovery/sources/:id      → elimina fonte
 * POST   /api/admin/discovery/sources/:id/test → testa il feed (fetcha 1 item e ritorna preview)
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { discoverySourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── GET / — lista fonti ─────────────────────────────────────────────────────

router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const sources = await db
      .select()
      .from(discoverySourcesTable)
      .orderBy(discoverySourcesTable.createdAt);
    res.json({ sources });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── POST / — crea fonte ─────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { name, feedUrl, description, itemType, sector, category, language, enabled, itemsPerRun } = req.body as Record<string, unknown>;
  if (!name || !feedUrl) { res.status(400).json({ error: "name e feedUrl sono obbligatori" }); return; }
  try {
    const [created] = await db
      .insert(discoverySourcesTable)
      .values({
        name:        String(name),
        feedUrl:     String(feedUrl),
        description: description ? String(description) : undefined,
        itemType:    itemType   ? String(itemType)   : "news",
        sector:      sector     ? String(sector)     : "General",
        category:    category   ? String(category)   : "news",
        language:    language   ? String(language)   : "it",
        enabled:     enabled !== undefined ? Boolean(enabled) : true,
        itemsPerRun: itemsPerRun ? Number(itemsPerRun) : 6,
      })
      .returning();
    res.status(201).json({ source: created });
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("unique")) { res.status(409).json({ error: "Feed URL già presente" }); return; }
    res.status(500).json({ error: "DB error" });
  }
});

// ── PATCH /:id — aggiorna fonte ─────────────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const allowed = ["name", "feedUrl", "description", "itemType", "sector", "category", "language", "enabled", "itemsPerRun"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  if (!Object.keys(update).length) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }
  update.updatedAt = new Date();
  try {
    const [updated] = await db
      .update(discoverySourcesTable)
      .set(update as Parameters<typeof discoverySourcesTable.$inferInsert>[0])
      .where(eq(discoverySourcesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Fonte non trovata" }); return; }
    res.json({ source: updated });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── DELETE /:id — elimina fonte ─────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const deleted = await db
      .delete(discoverySourcesTable)
      .where(eq(discoverySourcesTable.id, id))
      .returning();
    if (!deleted.length) { res.status(404).json({ error: "Fonte non trovata" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "DB error" }); }
});

// ── POST /:id/test — testa il feed ──────────────────────────────────────────
//
// Fetcha il feed e restituisce i primi 3 titoli come preview.
// Utile per verificare che l'URL sia valido prima di abilitare la fonte.

router.post("/:id/test", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [src] = await db
      .select({ feedUrl: discoverySourcesTable.feedUrl, name: discoverySourcesTable.name })
      .from(discoverySourcesTable)
      .where(eq(discoverySourcesTable.id, id))
      .limit(1);
    if (!src) { res.status(404).json({ error: "Fonte non trovata" }); return; }

    // Fetch inline (no circular import — inline implementation)
    const feedRes = await fetch(src.feedUrl, {
      headers: { "Accept": "application/rss+xml, application/xml, text/xml, */*", "User-Agent": "NorthStar/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!feedRes.ok) {
      await db.update(discoverySourcesTable).set({ lastError: `HTTP ${feedRes.status}`, updatedAt: new Date() }).where(eq(discoverySourcesTable.id, id));
      res.status(200).json({ ok: false, error: `HTTP ${feedRes.status}`, items: [] });
      return;
    }

    const xml    = await feedRes.text();
    const isHtml = xml.trimStart().startsWith("<!DOCTYPE") || xml.trimStart().startsWith("<html");
    if (isHtml) {
      await db.update(discoverySourcesTable).set({ lastError: "Feed restituisce HTML, non XML", updatedAt: new Date() }).where(eq(discoverySourcesTable.id, id));
      res.json({ ok: false, error: "Feed restituisce HTML invece di XML", items: [] });
      return;
    }

    // Parse inline (minimal)
    const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
    const items  = blocks.slice(0, 3).map((block) => {
      const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i);
      const title      = ((titleMatch?.[1] ?? titleMatch?.[2]) ?? "").trim();
      const linkMatch  = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim()
        ?? block.match(/<link[^>]*\shref=["']([^"']+)["'][^>]*>/i)?.[1]?.trim()
        ?? "";
      return { title, url: linkMatch };
    }).filter((i) => i.title);

    // Clear last error on success
    await db.update(discoverySourcesTable).set({ lastError: null, lastFetchAt: new Date(), updatedAt: new Date() }).where(eq(discoverySourcesTable.id, id));
    res.json({ ok: true, itemsPreview: items });
  } catch (err) {
    await db.update(discoverySourcesTable).set({ lastError: String(err), updatedAt: new Date() }).where(eq(discoverySourcesTable.id, id)).catch(() => {});
    res.json({ ok: false, error: String(err), items: [] });
  }
});

export default router;
