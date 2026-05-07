/**
 * Discovery Feed Routes
 * ─────────────────────────────────────────────────
 *
 * GET  /api/discovery/feed
 *   Restituisce il feed personalizzato per l'utente autenticato.
 *   Query params:
 *     ?limit=N          — numero di item (default 20, max 50)
 *     ?type=news|opportunity|formation|growth|sector_trend — filtro per tipo
 *     ?refresh=1        — forza il ricalcolo ignorando la cache
 *
 *   Response:
 *   {
 *     items: PersonalizedItem[],
 *     meta: { total, cachedAt, journeyType }
 *   }
 *
 * GET  /api/discovery/feed/:id
 *   Restituisce un singolo item per id.
 *
 * POST /api/admin/discovery/collect
 *   Triggera manualmente una run del collector + enricher.
 *   Protetto da adminOnly middleware.
 */
import { Router, Request, Response } from "express";
import {
  getPersonalizedFeed,
} from "@workspace/integrations-openai-ai-server/discovery-agent/personalizer-agent";
import { db } from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/discovery/feed
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId: number = (req as any).user.id;

  const limitRaw  = parseInt(String(req.query["limit"] ?? "20"), 10);
  const limit     = Math.min(Math.max(1, isNaN(limitRaw) ? 20 : limitRaw), 50);
  const typeFilter = typeof req.query["type"] === "string" ? req.query["type"] : undefined;
  const refresh   = req.query["refresh"] === "1";

  const validTypes = ["news", "opportunity", "formation", "growth", "sector_trend"];
  if (typeFilter && !validTypes.includes(typeFilter)) {
    res.status(400).json({ error: `Invalid type. Valid: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const items = await getPersonalizedFeed({
      userId,
      limit,
      typeFilter,
      forceRefresh: refresh,
    });

    res.json({
      items,
      meta: {
        total:    items.length,
        limit,
        typeFilter: typeFilter ?? null,
      },
    });
  } catch (err) {
    console.error("[discovery/feed] error:", err);
    res.status(500).json({ error: "Failed to generate feed" });
  }
});

// GET /api/discovery/feed/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [item] = await db
      .select()
      .from(discoveryItemsTable)
      .where(eq(discoveryItemsTable.id, id))
      .limit(1);

    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
