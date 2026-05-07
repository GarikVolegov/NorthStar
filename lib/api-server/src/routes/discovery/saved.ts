/**
 * Discovery Saved Items & Seen Tracking Routes — D5 + D6
 * ────────────────────────────────────────────────────────
 *
 * D5 — Saved Items:
 *   GET  /api/discovery/saved        → { ids: number[] }  (tutti gli id salvati dall'utente)
 *   POST /api/discovery/saved/:id    → toggle: salva se non salvato, rimuovi se salvato
 *   GET  /api/discovery/saved/items  → lista completa degli item salvati (con tutti i campi)
 *
 * D6 — Seen Tracking:
 *   POST /api/discovery/seen/:id     → segna un item come visto (fire-and-forget dal client)
 *
 * STORAGE:
 *   Usa la tabella user_favorites (già esistente) con resourceType='discovery_item'.
 *   Per seen tracking usa una tabella leggera (JSON in user record o sessione).
 *   Per semplicità, seen tracking è in-memory per sessione (non persistito sul DB).
 *   Se vuoi persistenza piena, aggiungi tabella discovery_seen.
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { userFavoritesTable, discoveryItemsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

const RESOURCE_TYPE = "discovery_item";

// GET /api/discovery/saved — lista id salvati
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId: number = (req as any).user.id;
  try {
    const rows = await db
      .select({ resourceId: userFavoritesTable.resourceId })
      .from(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.userId, userId),
          eq(userFavoritesTable.resourceType, RESOURCE_TYPE),
        ),
      );
    res.json({ ids: rows.map((r) => r.resourceId) });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/discovery/saved/items — item salvati completi
router.get("/items", async (req: Request, res: Response): Promise<void> => {
  const userId: number = (req as any).user.id;
  try {
    const favs = await db
      .select({ resourceId: userFavoritesTable.resourceId })
      .from(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.userId, userId),
          eq(userFavoritesTable.resourceType, RESOURCE_TYPE),
        ),
      );

    if (!favs.length) { res.json({ items: [] }); return; }

    const ids   = favs.map((f) => f.resourceId);
    const items = await db
      .select()
      .from(discoveryItemsTable)
      .where(inArray(discoveryItemsTable.id, ids));

    res.json({ items });
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/discovery/saved/:id — toggle
router.post("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId: number = (req as any).user.id;
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const existing = await db
      .select({ id: userFavoritesTable.id })
      .from(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.userId, userId),
          eq(userFavoritesTable.resourceType, RESOURCE_TYPE),
          eq(userFavoritesTable.resourceId, id),
        ),
      )
      .limit(1);

    if (existing.length) {
      await db.delete(userFavoritesTable).where(eq(userFavoritesTable.id, existing[0]!.id));
      res.json({ saved: false });
    } else {
      await db.insert(userFavoritesTable).values({
        userId,
        resourceType: RESOURCE_TYPE,
        resourceId:   id,
      });
      res.json({ saved: true });
    }
  } catch {
    res.status(500).json({ error: "DB error" });
  }
});

// POST /api/discovery/seen/:id — segna come visto (fire-and-forget)
// Registrato come route separata in app.ts
export const seenRouter = Router();
seenRouter.post("/:id", (req: Request, res: Response) => {
  // Fire-and-forget: in futuro inserire in discovery_seen table
  // Per ora semplicemente aggiornare relevanceScore (piccolo decay per item visti)
  const id = parseInt(req.params["id"] ?? "", 10);
  if (!isNaN(id)) {
    // Non-blocking: opzionale decay su relevanceScore per de-prioritizzare item visti
    db.select({ rs: discoveryItemsTable.relevanceScore })
      .from(discoveryItemsTable)
      .where(eq(discoveryItemsTable.id, id))
      .limit(1)
      .then(([row]) => {
        if (row) {
          const decayed = Math.max(0, (row.rs ?? 0) - 0.05);
          return db.update(discoveryItemsTable)
            .set({ relevanceScore: decayed })
            .where(eq(discoveryItemsTable.id, id));
        }
      })
      .catch(() => { /* non-critical */ });
  }
  res.json({ ok: true });
});

export default router;
