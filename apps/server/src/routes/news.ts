import { Router } from "express";
import {
  getFreeNews,
  getSectorNews,
  getMultiCategoryNews,
  warmCache,
  FREE_CATEGORIES,
  type FreeCategory,
} from "../lib/news";
import { getAuthenticatedUserId, getUserPlan } from "../lib/plan-utils";
import { logger } from "../lib/logger";

const router = Router();

// Warm the most common categories eagerly on first import so the
// in-memory cache is populated before the first user request.
warmCache().catch((err) => logger.warn({ err }, "News cache warm-up failed"));

router.get("/news", async (req, res) => {
  const category = (req.query["category"] as string) || "general";
  const limit = Math.min(Number(req.query["limit"]) || 6, 20);
  const multi = req.query["multi"] === "true";

  if (multi) {
    const cats = ((req.query["categories"] as string) || "general,technology,business,science")
      .split(",")
      .filter((c) => FREE_CATEGORIES.includes(c as FreeCategory)) as FreeCategory[];
    const perCat = Math.min(Number(req.query["perCategory"]) || 2, 5);
    const news = await getMultiCategoryNews(cats, perCat);
    return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
  }

  if (!FREE_CATEGORIES.includes(category as FreeCategory)) {
    return res.status(400).json({ error: "Categoria non valida" });
  }

  try {
    const news = await getFreeNews(category as FreeCategory, limit);
    return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
  } catch (err) {
    logger.error({ err }, "getFreeNews failed in /news");
    return res.status(500).json({ error: "Errore nel caricamento delle notizie" });
  }
});

router.get("/news/sector/:sector", async (req, res) => {
  const { sector } = req.params;
  const limit = Math.min(Number(req.query["limit"]) || 8, 20);

  try {
    const news = await getSectorNews(sector, limit);
    return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
  } catch (err) {
    logger.error({ err }, "getSectorNews failed in /news/sector/:sector");
    return res.status(500).json({ error: "Errore nel caricamento delle notizie di settore" });
  }
});

router.get("/news/personalizzate", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const plan = userId ? await getUserPlan(userId) : "free";

  const categories = req.query["categories"]
    ? (req.query["categories"] as string)
        .split(",")
        .filter((c) => FREE_CATEGORIES.includes(c as FreeCategory)) as FreeCategory[]
    : (["general", "technology"] as FreeCategory[]);

  try {
    const news = await getMultiCategoryNews(categories, 3);
    return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static", personalized: false, plan });
  } catch (err) {
    logger.error({ err }, "getMultiCategoryNews failed in /news/personalizzate");
    return res.status(500).json({ error: "Errore nel caricamento delle notizie personalizzate" });
  }
});

export default router;
