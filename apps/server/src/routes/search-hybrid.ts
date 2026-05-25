import { Router } from "express";
import { z } from "zod/v4";
import { optionalAuth } from "../middleware/auth";
import { globalSearch, type GlobalSearchEntityType } from "../lib/global-search";

const router = Router();

const searchTypes = [
  "sector",
  "role",
  "article",
  "news",
  "idea",
  "objective",
  "calendar",
  "certification",
  "memory",
  "workspace",
  "profile",
] as const;

const hybridSchema = z.object({
  q: z.string().min(1).max(500),
  types: z.array(z.enum(searchTypes)).optional(),
  limit: z.number().min(1).max(50).optional().default(10),
});

router.post("/", optionalAuth, async (req, res) => {
  try {
    const parsed = hybridSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Input non valido", details: parsed.error.issues });
      return;
    }

    const { q, types, limit } = parsed.data;
    const response = await globalSearch({
      query: q,
      userId: req.user?.id ?? null,
      limit,
      ...(types ? { types: types as GlobalSearchEntityType[] } : {}),
    });

    res.json(response);
  } catch (err) {
    req.log?.error?.({ err }, "hybrid search error");
    res.status(500).json({ error: "Errore nella ricerca ibrida" });
  }
});

export default router;
